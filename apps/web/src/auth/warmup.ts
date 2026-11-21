export const oidcAuthority = (import.meta.env.VITE_OIDC_AUTHORITY ?? 'http://localhost:8080/realms/mefit').replace(/\/$/, '')
const discoveryUrl = `${oidcAuthority}/.well-known/openid-configuration`

type WarmupOptions = {
  signal?: AbortSignal
  onWaiting?: () => void
  onElapsed?: (elapsedMs: number) => void
  fetcher?: typeof fetch
  timeoutMs?: number
  requestTimeoutMs?: number
  pollIntervalMs?: number
  slowThresholdMs?: number
}

export class KeycloakWarmupTimeoutError extends Error {
  constructor() {
    super('The sign-in server is taking longer than expected.')
    this.name = 'KeycloakWarmupTimeoutError'
  }
}

function abortError() {
  return new DOMException('Sign-in server check was cancelled.', 'AbortError')
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(abortError())
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      reject(abortError())
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

async function requestWithTimeout(
  url: string,
  mode: RequestMode,
  fetcher: typeof fetch,
  parentSignal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<Response> {
  if (parentSignal?.aborted) throw abortError()

  const controller = new AbortController()
  const abortFromParent = () => controller.abort()
  parentSignal?.addEventListener('abort', abortFromParent, { once: true })
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetcher(url, { method: 'GET', mode, cache: 'no-store', signal: controller.signal })
    if (parentSignal?.aborted) throw abortError()
    return response
  } finally {
    clearTimeout(timeout)
    parentSignal?.removeEventListener('abort', abortFromParent)
  }
}

async function isReadyResponse(response: Response): Promise<boolean> {
  // Render can return a successful-looking HTML wake-up page before Keycloak is
  // ready. Opaque responses hide the status and body, so they are never proof
  // that the Keycloak discovery document is available.
  if (response.type === 'opaque') return false
  if (!response.ok) return false

  try {
    const body = await response.json() as { issuer?: unknown }
    return body.issuer === oidcAuthority
  } catch {
    return false
  }
}

async function checkOnce(fetcher: typeof fetch, signal: AbortSignal | undefined, timeoutMs: number): Promise<boolean> {
  try {
    const response = await requestWithTimeout(discoveryUrl, 'cors', fetcher, signal, timeoutMs)
    return isReadyResponse(response)
  } catch {
    if (signal?.aborted) throw abortError()
    // A no-cors fallback cannot validate JSON or distinguish a Render wake-up
    // page from Keycloak. Keep polling and only redirect on a readable issuer.
    return false
  }
}

export async function waitForKeycloak(options: WarmupOptions = {}): Promise<void> {
  const {
    signal,
    onWaiting,
    onElapsed,
    fetcher = fetch,
    timeoutMs = 150_000,
    requestTimeoutMs = 8_000,
    pollIntervalMs = 4_000,
    slowThresholdMs = 3_000,
  } = options
  const startedAt = Date.now()
  let waitingAnnounced = false
  const announceWaiting = () => {
    if (waitingAnnounced) return
    waitingAnnounced = true
    onWaiting?.()
  }
  let slowTimer: ReturnType<typeof setTimeout> | undefined

  while (true) {
    if (signal?.aborted) throw abortError()
    const elapsed = Date.now() - startedAt
    onElapsed?.(elapsed)
    const remaining = timeoutMs - elapsed
    if (remaining <= 0) throw new KeycloakWarmupTimeoutError()

    if (!waitingAnnounced) {
      slowTimer = setTimeout(announceWaiting, Math.min(slowThresholdMs, remaining))
    }
    let ready: boolean
    try {
      ready = await checkOnce(fetcher, signal, Math.min(requestTimeoutMs, remaining))
    } finally {
      if (slowTimer) clearTimeout(slowTimer)
      slowTimer = undefined
    }
    if (ready) return

    announceWaiting()
    const elapsedAfterRequest = Date.now() - startedAt
    onElapsed?.(elapsedAfterRequest)
    const timeLeft = timeoutMs - elapsedAfterRequest
    if (timeLeft <= 0) throw new KeycloakWarmupTimeoutError()
    await delay(Math.min(pollIntervalMs, timeLeft), signal)
  }
}

let prewarmStarted = false

/** Start one silent best-effort request per page load; interactive sign-in owns retries. */
export function prewarmKeycloakOnce(): void {
  if (prewarmStarted) return
  prewarmStarted = true

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3_000)
  void fetch(discoveryUrl, { method: 'GET', mode: 'no-cors', cache: 'no-store', signal: controller.signal })
    .catch(() => undefined)
    .finally(() => clearTimeout(timeout))
}
