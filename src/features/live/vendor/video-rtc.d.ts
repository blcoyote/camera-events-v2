// Hand-written type declarations for the vendored `video-rtc.js` (see that
// file's header comment for provenance). Only the members LiveMsePlayer.tsx
// actually touches are declared.
export class VideoRTC extends HTMLElement {
  /** [config] Supported modes (webrtc, webrtc/tcp, mse, hls, mp4, mjpeg). */
  mode: string
  /** [config] Requested medias (video, audio, microphone). */
  media: string
  /** [config] Run stream when not displayed on the screen. Default `false`. */
  background: boolean
  /** Set video source (WebSocket URL). Support relative path. */
  set src(value: string | URL)
  /** Force-disconnect the WebSocket/WebRTC connection immediately. */
  ondisconnect(): void
}
