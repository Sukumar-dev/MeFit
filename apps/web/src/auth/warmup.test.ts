import { afterEach, describe, expect, it, vi } from 'vitest'
import { KeycloakWarmupTimeoutError, oidcAuthority, waitForKeycloak } from './warmup'

function readyResponse() {
  return new Response(JSON.stringify({ issuer: oidcAuthority }), { status: 200, headers: { 'content-type': 'application/json' } })
}

afterEach(() => vi.useRealTimers())

describe('Keycloak warm-up', () => {
  it('returns immediately when discovery is ready', async () => {
    const fetcher = vi.fn().mockResolvedValue(readyResponse())

    await expect(waitForKeycloak({ fetcher })).resolves.toBeUndefined()
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledWith(`${oidcAuthority}/.well-known/openid-configuration`, expect.objectContaining({ mode: 'cors' }))
  })

  it('continues polling through unavailable responses until discovery is ready', async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response('', { status: 502 }))
      .mockResolvedValueOnce(readyResponse())
    const promise = waitForKeycloak({ fetcher, pollIntervalMs: 50, requestTimeoutMs: 20 })

    await vi.advanceTimersByTimeAsync(100)
    await expect(promise).resolves.toBeUndefined()
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it('does not treat an opaque Render wake-up response as ready', async () => {
    vi.useFakeTimers()
    const opaqueResponse = { type: 'opaque', ok: false } as Response
    const fetcher = vi.fn().mockResolvedValueOnce(opaqueResponse).mockResolvedValueOnce(readyResponse())
    const promise = waitForKeycloak({ fetcher, pollIntervalMs: 50, requestTimeoutMs: 20 })

    await vi.advanceTimersByTimeAsync(50)
    await expect(promise).resolves.toBeUndefined()
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.mock.calls.every(([, init]) => init?.mode === 'cors')).toBe(true)
  })

  it('stops after the maximum wait and returns a friendly timeout error', async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 503 }))
    const promise = waitForKeycloak({ fetcher, timeoutMs: 100, requestTimeoutMs: 20, pollIntervalMs: 40 })

    const assertion = expect(promise).rejects.toBeInstanceOf(KeycloakWarmupTimeoutError)
    await vi.advanceTimersByTimeAsync(100)
    await assertion
  })

  it('cancels an in-flight discovery request', async () => {
    const controller = new AbortController()
    let requestSignal: AbortSignal | undefined
    const fetcher = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      requestSignal = init?.signal as AbortSignal
      return new Promise<Response>((_resolve, reject) => {
        requestSignal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
      })
    })
    const promise = waitForKeycloak({ fetcher, signal: controller.signal, requestTimeoutMs: 1_000 })

    await vi.waitFor(() => expect(requestSignal).toBeDefined())
    controller.abort()
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
  })
})
