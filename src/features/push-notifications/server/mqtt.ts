import '@tanstack/react-start/server-only'
import { SpanKind } from '@opentelemetry/api'
import { log } from '#/features/shared/server/log'
import { withSpan, withSpanSync } from '#/features/shared/server/tracing'
import mqtt from 'mqtt'
import type { MqttClient } from 'mqtt'
import { clearFrigateCache } from '#/features/shared/server/frigate/cache'
import {
  observeMqttConnection,
  recordMqttMessage,
} from '#/features/shared/server/metrics'
import { EventBatcher } from './event-batcher'
import type { DetectionInfo, FlushMeta } from './event-batcher'
import { notifyUsersForCamera } from './push-notify'
import {
  CameraAvailabilityTracker,
  parseFrigateStatsMessage,
} from './camera-availability'
import type { CameraAvailabilityStatus } from './camera-availability'
import { notifyUsersForCameraAvailability } from './availability-notify'
import { resolveBatcherConfig, resolveOfflineThreshold } from './env'

/** MQTT topics to subscribe to for Frigate event and availability updates. */
export const SUBSCRIBED_TOPICS = [
  'frigate/events',
  'frigate/reviews',
  'frigate/stats',
  'frigate/available',
] as const

export type MqttConnectionState =
  | 'not_configured'
  | 'connected'
  | 'disconnected'

let mqttConnectionState: MqttConnectionState = 'not_configured'

// Module level so the gauge reports 0 even when the subscriber is skipped.
observeMqttConnection(() => mqttConnectionState === 'connected')

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
  // Batches flush from a timer, so they start their own trace. Logs and error
  // handling run inside it so they carry the batch's trace (log.error marks it).
  void withSpan(
    'push.batch',
    {
      'frigate.camera': camera,
      'frigate.event.ids': events.map((e) => e.id),
      'push.burst_start': meta.burstStart,
    },
    async () => {
      log.info('mqtt', 'Flushing detection batch', {
        camera,
        count: events.length,
        burst_start: meta.burstStart,
      })
      try {
        await notifyUsersForCamera(camera, events, meta)
      } catch (err) {
        log.error('mqtt', 'Push notification dispatch failed', err, { camera })
      }
    },
    { root: true },
  )
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
  void withSpan(
    'push.availability',
    { 'frigate.camera': camera, 'camera.status': status },
    async () => {
      log.info('mqtt', 'Camera availability changed', { camera, status })
      try {
        await notifyUsersForCameraAvailability(camera, status)
      } catch (err) {
        log.error('mqtt', 'Availability push dispatch failed', err, { camera })
      }
    },
    { root: true },
  )
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

/**
 * Parse a Frigate MQTT event payload into a DetectionInfo, or null
 * if the message should be ignored (not a "new" event, or malformed).
 */
export function parseFrigateEvent(payload: Buffer): DetectionInfo | null {
  try {
    const msg = JSON.parse(payload.toString())
    if (msg.type !== 'new') return null

    const after = msg.after
    if (
      !after ||
      typeof after.id !== 'string' ||
      typeof after.camera !== 'string' ||
      typeof after.label !== 'string' ||
      typeof after.start_time !== 'number'
    ) {
      return null
    }

    return {
      id: after.id,
      camera: after.camera,
      label: after.label,
      startTime: after.start_time,
      hasSnapshot: after.has_snapshot === true,
      hasClip: after.has_clip === true,
    }
  } catch {
    return null
  }
}

/**
 * Handle an incoming Frigate MQTT message.
 *
 * Clears the API cache only for `frigate/events` and `frigate/reviews` —
 * `frigate/stats` arrives on a heartbeat interval with no data change most of
 * the time, so clearing the cache on every reading would defeat its purpose.
 * `frigate/events` also feeds new events into the per-camera batcher for push
 * notification dispatch; `frigate/stats` and `frigate/available` feed the
 * camera availability tracker for online/offline push notifications.
 */
export function onFrigateMessage(topic: string, payload: Buffer): void {
  recordMqttMessage(topic)

  if (topic === 'frigate/events' || topic === 'frigate/reviews') {
    log.debug('mqtt', 'Message received, clearing Frigate cache', { topic })
    clearFrigateCache()
  }

  if (topic === 'frigate/events') {
    withSpanSync(
      'mqtt frigate/events',
      {},
      (span) => {
        const event = parseFrigateEvent(payload)
        if (event) {
          span?.setAttributes({
            'frigate.camera': event.camera,
            'frigate.event.id': event.id,
            'frigate.label': event.label,
            'mqtt.outcome': 'batched',
          })
          log.info('mqtt', 'New detection', {
            label: event.label,
            camera: event.camera,
            event_id: event.id,
          })
          eventBatcher.add(event)
        } else {
          span?.setAttribute('mqtt.outcome', 'ignored')
          log.debug('mqtt', 'Ignored message, not a new event or malformed', {
            topic,
          })
        }
      },
      { kind: SpanKind.CONSUMER },
    )
  } else if (topic === 'frigate/stats') {
    const camerasFps = parseFrigateStatsMessage(payload)
    if (camerasFps) {
      availabilityTracker.handleStats(camerasFps)
    } else {
      log.debug('mqtt', 'Ignored message, malformed payload', { topic })
    }
  } else if (topic === 'frigate/available') {
    const status = payload.toString().trim()
    if (status === 'online' || status === 'offline') {
      availabilityTracker.handleServiceAvailability(status)
    } else {
      log.debug('mqtt', 'Ignored message, unexpected payload', {
        topic,
        status,
      })
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
    log.info('mqtt', 'FRIGATE_MOCK enabled, skipping MQTT subscriber')
    return null
  }

  const url = process.env.MQTT_URL
  if (!url) {
    log.info('mqtt', 'MQTT_URL not set, skipping MQTT subscriber')
    return null
  }

  mqttConnectionState = 'disconnected'
  const client = mqtt.connect(url, { clean: true })

  client.on('connect', () => {
    mqttConnectionState = 'connected'
    log.info('mqtt', 'Connected to broker')
    client.subscribe(SUBSCRIBED_TOPICS as unknown as string[], (err) => {
      if (err) {
        log.error('mqtt', 'Failed to subscribe', err)
      } else {
        log.info('mqtt', 'Subscribed to topics', {
          topics: [...SUBSCRIBED_TOPICS],
        })
      }
    })
  })

  client.on('message', onFrigateMessage)

  client.on('reconnect', () => {
    log.info('mqtt', 'Reconnecting')
  })

  client.on('close', () => {
    mqttConnectionState = 'disconnected'
  })

  client.on('error', (err) => {
    log.error('mqtt', 'MQTT client error', err)
  })

  return client
}
