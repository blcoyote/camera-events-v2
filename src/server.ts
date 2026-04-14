import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'
import { createServerEntry } from '@tanstack/react-start/server-entry'
import { startMqttSubscriber } from './server/mqtt'

// Start MQTT subscriber on server init (runs once at startup)
startMqttSubscriber()

const fetch = createStartHandler(defaultStreamHandler)

export default createServerEntry({ fetch })
