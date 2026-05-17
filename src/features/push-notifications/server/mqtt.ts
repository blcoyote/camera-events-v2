import '@tanstack/react-start/server-only'
import mqtt from 'mqtt'
import type { MqttClient } from 'mqtt'
import { clearFrigateCache } from '#/features/shared/server/frigate/cache'
import { EventBatcher } from './event-batcher'
import type { FrigateEventInfo } from './event-batcher'
import { notifyUsersForCamera } from './push-notify'

/** MQTT topics to subscribe to for Frigate event updates. */
export const SUBSCRIBED_TOPICS = ['frigate/events', 'frigate/reviews'] as const

/**
 * Parse the EVENT_BATCH_WINDOW_MS env variable into a millisecond count.
 * Defaults to 30 000 ms when the value is absent, empty, or non-numeric.
 * Unlike a plain `|| 30_000` guard, this correctly treats "0" as a valid
 * value (immediate flush with no batching window).
 */
export function parseBatchWindowMs(envValue: string | undefined): number {
  if (envValue === undefined) return 30_000
  const trimmedEnvValue = envValue.trim()
  if (trimmedEnvValue === '') return 30_000
  const raw = Number(trimmedEnvValue)
  return Number.isFinite(raw) ? raw : 30_000
}

const batchWindowMs = parseBatchWindowMs(process.env.EVENT_BATCH_WINDOW_MS)

/** Singleton event batcher — flushes per-camera batches to push notifications. */
const eventBatcher = new EventBatcher((camera, events) => {
  notifyUsersForCamera(camera, events).catch((err) => {
    console.error('[mqtt] Push notification dispatch failed:', err)
  })
}, batchWindowMs)

/**
 * Parse a Frigate MQTT event payload into a FrigateEventInfo, or null
 * if the message should be ignored (not a "new" event, or malformed).
 */
export function parseFrigateEvent(payload: Buffer): FrigateEventInfo | null {
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
    }
  } catch {
    return null
  }
}

/**
 * Handle an incoming Frigate MQTT message.
 *
 * Clears the API cache for all topics. For `frigate/events`, also parses
 * the payload and feeds new events into the per-camera batcher for push
 * notification dispatch.
 */
export function onFrigateMessage(topic: string, payload: Buffer): void {
  console.log(`[mqtt] Received message on ${topic} — clearing Frigate cache`)
  clearFrigateCache()

  if (topic === 'frigate/events') {
    const event = parseFrigateEvent(payload)
    if (event) {
      console.log(
        `[mqtt] New event: ${event.label} on ${event.camera} (${event.id})`,
      )
      eventBatcher.add(event)
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

  const client = mqtt.connect(url, { clean: true })

  client.on('connect', () => {
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

  client.on('error', (err) => {
    console.error('[mqtt] Error:', err.message)
  })

  return client
}
