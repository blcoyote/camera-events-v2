import '@tanstack/react-start/server-only'
import mqtt from 'mqtt'
import type { MqttClient } from 'mqtt'
import { clearFrigateCache } from '#/features/shared/server/frigate/cache'
import { EventBatcher } from './event-batcher'
import type { DetectionInfo, FlushMeta } from './event-batcher'
import { notifyUsersForCamera } from './push-notify'
import {
  CameraAvailabilityTracker,
  parseFrigateStatsMessage,
} from './camera-availability'
import type { CameraAvailabilityStatus } from './camera-availability'
import { notifyUsersForCameraAvailability } from './availability-notify'
import { ReviewAlertGate, parseFrigateReview } from './review-alert'
import type { FrigateReviewMessage } from './review-alert'
import { waitForPersistedEvent } from './event-verify'
import type { FrigateEvent } from '#/features/shared/server/frigate/types'
import { resolveBatcherConfig, resolveOfflineThreshold } from './env'

/** MQTT topics to subscribe to for Frigate event and availability updates. */
export const SUBSCRIBED_TOPICS = [
  'frigate/events',
  'frigate/reviews',
  'frigate/stats',
  'frigate/available',
] as const

export type MqttConnectionState =
  'not_configured' | 'connected' | 'disconnected'

let mqttConnectionState: MqttConnectionState = 'not_configured'

export function getMqttConnectionState(): MqttConnectionState {
  return mqttConnectionState
}

export function _resetMqttConnectionState(): void {
  mqttConnectionState = 'not_configured'
}

const { windowMs, burstGapMs } = resolveBatcherConfig(process.env)
const offlineThreshold = resolveOfflineThreshold(process.env)

/**
 * Flush callback for the EventBatcher: log the batch and dispatch push
 * notifications for a camera's accumulated events. Exported for testing.
 */
export function dispatchBatch(
  camera: string,
  events: DetectionInfo[],
  meta: FlushMeta,
): void {
  const kind = meta.burstStart ? 'new burst' : 'continuation'
  console.log(
    `[mqtt] Flushing batch for camera "${camera}" — ${events.length} detection(s), ${kind}, dispatching push notifications`,
  )
  notifyUsersForCamera(camera, events, meta).catch((err) => {
    console.error('[mqtt] Push notification dispatch failed:', err)
  })
}

/** Singleton event batcher — flushes per-camera batches to push notifications. */
const eventBatcher = new EventBatcher(dispatchBatch, windowMs, burstGapMs)

/**
 * Transition callback for the CameraAvailabilityTracker: log the transition
 * and dispatch an availability push notification. Exported for testing.
 */
export function dispatchAvailability(
  camera: string,
  status: CameraAvailabilityStatus,
): void {
  console.log(`[mqtt] Camera "${camera}" is now ${status}`)
  notifyUsersForCameraAvailability(camera, status).catch((err) => {
    console.error('[mqtt] Availability push dispatch failed:', err)
  })
}

/** Singleton availability tracker — reassignable so tests can isolate state. */
let availabilityTracker = new CameraAvailabilityTracker(
  dispatchAvailability,
  offlineThreshold,
)

/** Reset the availability tracker's internal state. Exported for testing only. */
export function _resetAvailabilityTracker(): void {
  availabilityTracker = new CameraAvailabilityTracker(
    dispatchAvailability,
    offlineThreshold,
  )
}

/** Singleton review alert gate — reassignable so tests can isolate state. */
let reviewGate = new ReviewAlertGate()

/** Reset the review alert gate's internal state. Exported for testing only. */
export function _resetReviewGate(): void {
  reviewGate = new ReviewAlertGate()
}

/**
 * Verify a review alert's event exists in Frigate, then feed it into the
 * batcher. Exported for testing.
 */
export async function handleReviewAlert(
  msg: FrigateReviewMessage,
  verify = waitForPersistedEvent,
): Promise<void> {
  let event: FrigateEvent | null = null
  try {
    event = await verify(msg.detections)
  } catch {
    event = null
  }

  if (!event) {
    reviewGate.release(msg.reviewId)
    console.log(
      `[mqtt] Review ${msg.reviewId} on ${msg.camera} alert skipped — no saved event`,
    )
    return
  }

  console.log(
    `[mqtt] Review alert: ${event.label} on ${event.camera} (review ${msg.reviewId}, event ${event.id})`,
  )
  eventBatcher.add({
    id: event.id,
    camera: msg.camera,
    label: event.label,
    startTime: event.start_time,
    hasSnapshot: event.has_snapshot,
    hasClip: event.has_clip,
  })
}

/**
 * Handle an incoming Frigate MQTT message.
 *
 * Clears the API cache only for `frigate/events` and `frigate/reviews` —
 * `frigate/stats` arrives on a heartbeat interval with no data change most of
 * the time, so clearing the cache on every reading would defeat its purpose.
 * `frigate/reviews` drives push notifications: the first time a review is seen
 * with `alert` severity, its saved event is verified in Frigate and then fed
 * into the per-camera batcher. `frigate/events` only invalidates the cache.
 * `frigate/stats` and `frigate/available` feed the camera availability tracker
 * for online/offline push notifications.
 */
export function onFrigateMessage(topic: string, payload: Buffer): void {
  if (topic === 'frigate/events' || topic === 'frigate/reviews') {
    console.log(`[mqtt] Received message on ${topic} — clearing Frigate cache`)
    clearFrigateCache()
  }

  if (topic === 'frigate/reviews') {
    const msg = parseFrigateReview(payload)
    if (!msg) {
      console.log('[mqtt] Ignored frigate/reviews message (malformed payload)')
    } else if (reviewGate.consider(msg) === 'notify') {
      void handleReviewAlert(msg)
    }
  } else if (topic === 'frigate/stats') {
    const camerasFps = parseFrigateStatsMessage(payload)
    if (camerasFps) {
      availabilityTracker.handleStats(camerasFps)
    } else {
      console.log('[mqtt] Ignored frigate/stats message (malformed payload)')
    }
  } else if (topic === 'frigate/available') {
    const status = payload.toString().trim()
    if (status === 'online' || status === 'offline') {
      availabilityTracker.handleServiceAvailability(status)
    } else {
      console.log(
        `[mqtt] Ignored frigate/available message (unexpected payload: "${status}")`,
      )
    }
  }
}

/**
 * Connect to the MQTT broker and subscribe to Frigate topics.
 *
 * Reads `MQTT_URL` from the environment. If not set, the subscriber is
 * silently skipped (useful for local dev without RabbitMQ).
 *
 * Returns the MQTT client for graceful shutdown, or `null` if skipped.
 */
export function startMqttSubscriber(): MqttClient | null {
  if (process.env.FRIGATE_MOCK === 'true') {
    console.log('[mqtt] FRIGATE_MOCK enabled — skipping MQTT subscriber')
    return null
  }

  const url = process.env.MQTT_URL
  if (!url) {
    console.log('[mqtt] MQTT_URL not set — skipping MQTT subscriber')
    return null
  }

  mqttConnectionState = 'disconnected'
  const client = mqtt.connect(url, { clean: true })

  client.on('connect', () => {
    mqttConnectionState = 'connected'
    console.log(`[mqtt] Connected to ${url}`)
    client.subscribe(SUBSCRIBED_TOPICS as unknown as string[], (err) => {
      if (err) {
        console.error('[mqtt] Failed to subscribe:', err.message)
      } else {
        console.log(`[mqtt] Subscribed to ${SUBSCRIBED_TOPICS.join(', ')}`)
      }
    })
  })

  client.on('message', onFrigateMessage)

  client.on('reconnect', () => {
    console.log('[mqtt] Reconnecting...')
  })

  client.on('close', () => {
    mqttConnectionState = 'disconnected'
  })

  client.on('error', (err) => {
    console.error('[mqtt] Error:', err.message)
  })

  return client
}
