import mqtt from 'mqtt'
import type { MqttClient } from 'mqtt'
import { clearFrigateCache } from './frigate/cache'

/** MQTT topics to subscribe to for Frigate event updates. */
export const SUBSCRIBED_TOPICS = ['frigate/events', 'frigate/reviews'] as const

/**
 * Handle an incoming Frigate MQTT message.
 *
 * This function is the primary extension point for reacting to Frigate events.
 * Currently it clears the API cache so the next request fetches fresh data.
 * Future uses: real-time push to clients, notifications, event aggregation.
 */
export function onFrigateMessage(topic: string, _payload: Buffer): void {
  console.log(`[mqtt] Received message on ${topic} — clearing Frigate cache`)
  clearFrigateCache()
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
