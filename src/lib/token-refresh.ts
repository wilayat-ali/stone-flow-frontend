// Renewing the short-lived access token from the long-lived refresh token. No framework imports, so the
// queue below can be tested on its own.

export type Tokens = { token: string; refreshToken: string; tokenExpires: number }

/**
 * `definitive`: the backend refused the refresh token (expired, revoked, user removed), so the session is over.
 * Not definitive: the backend could not be reached or failed, so the person stays signed in and tries again.
 */
export type RefreshOutcome = { ok: true; tokens: Tokens } | { ok: false; definitive: boolean }

/** What one call to the backend's refresh endpoint gave. `status` 0 means it could not be reached. */
export type BackendRefresh = { status: number; tokens?: Tokens }

/** True when the access token has expired or will within `ms`. A token that cannot be read counts as fine. */
export function tokenExpiresWithin(token: string | undefined, ms: number, now = Date.now()): boolean {
    if (!token) return true
    try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')) as { exp?: number }
        return typeof payload.exp === 'number' && payload.exp * 1000 - now < ms
    } catch {
        return false
    }
}

const classify = (result: BackendRefresh): RefreshOutcome => {
    if (result.status >= 200 && result.status < 300 && result.tokens?.token && result.tokens.refreshToken) {
        return { ok: true, tokens: result.tokens }
    }
    // The backend answered and said no: the refresh token is no good. Anything else (no answer, 5xx, throttled)
    // says nothing about the session.
    const refused = result.status >= 400 && result.status < 500 && result.status !== 429 && result.status !== 408
    return { ok: false, definitive: refused }
}

/**
 * One refresh at a time per refresh token. The backend gives out a new refresh token on every refresh and
 * retires the old one, so a page that fires six requests at once must not refresh six times: the first call
 * asks the backend, the others wait for its answer (the queue). A call that arrives just after (another tab, a
 * slow request that still carries the old token) gets the same answer from a short memory instead of being
 * refused for using a retired token.
 */
export function createRefresher(callBackend: (refreshToken: string) => Promise<BackendRefresh>, options: { keepMs?: number; now?: () => number } = {}) {
    const keepMs = options.keepMs ?? 30_000
    const now = options.now ?? Date.now
    const inflight = new Map<string, Promise<RefreshOutcome>>()
    const recent = new Map<string, { at: number; outcome: RefreshOutcome }>()

    return (refreshToken: string): Promise<RefreshOutcome> => {
        for (const [key, entry] of recent) if (now() - entry.at > keepMs) recent.delete(key)

        const done = recent.get(refreshToken)
        if (done) return Promise.resolve(done.outcome)

        const running = inflight.get(refreshToken)
        if (running) return running

        const call = callBackend(refreshToken)
            .then(classify)
            .catch((): RefreshOutcome => ({ ok: false, definitive: false }))
            .then((outcome) => {
                inflight.delete(refreshToken)
                if (outcome.ok) recent.set(refreshToken, { at: now(), outcome })
                return outcome
            })
        inflight.set(refreshToken, call)
        return call
    }
}
