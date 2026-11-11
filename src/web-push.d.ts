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

  export function setVapidDetails(
    subject: string,
    publicKey: string,
    privateKey: string,
  ): void
  export function sendNotification(
    subscription: PushSubscription,
    payload: string | Buffer,
    options?: { timeout?: number },
  ): Promise<SendResult>
  export function generateVAPIDKeys(): { publicKey: string; privateKey: string }
}
