declare module 'web-push' {
  interface PushSubscription {
    endpoint: string
    keys: {
      p256dh: string
      auth: string
    }
  }

  interface SendResult {
    statusCode: number
    body: string
    headers: Record<string, string>
  }

  interface WebPush {
    setVapidDetails: (
      subject: string,
      publicKey: string,
      privateKey: string,
    ) => void
    sendNotification: (
      subscription: PushSubscription,
      payload: string | Buffer,
    ) => Promise<SendResult>
    generateVAPIDKeys: () => { publicKey: string; privateKey: string }
  }

  const webPush: WebPush
  export default webPush
}
