export class ApiError extends Error {
    constructor(
        public status: number,
        public body: unknown
    ) {
        super(`Request failed with ${status}`)
    }
}

let signingOut = false

/**
 * The session is over (the proxy answered 401 after trying to renew it, and cleared the cookies). Go to the
 * start, where the sign-in page for the person's company is shown. Public pages (invites, resets) are left alone.
 */
function endSession(url: string) {
    if (signingOut || typeof window === 'undefined' || url.startsWith('/api/auth/')) return
    signingOut = true
    // A full load on purpose: it drops everything the old session left in memory.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`${window.location.origin}/`)
}

/** JSON request to one of our own `/api/*` routes from the browser. Throws `ApiError` on failure. */
export async function request<T>(
    url: string,
    init: { method?: string; body?: unknown } = {}
): Promise<T> {
    let response: Response
    try {
        response = await fetch(url, {
            method: init.method ?? (init.body ? 'POST' : 'GET'),
            headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
            body: init.body ? JSON.stringify(init.body) : undefined,
        })
    } catch {
        throw new ApiError(0, null)
    }
    const json = await response.json().catch(() => null)
    if (response.status === 401) endSession(url)
    if (!response.ok) throw new ApiError(response.status, json)
    return json as T
}

/**
 * Short code the backend gives for a failure, such as `alreadyMember` or
 * `invalidPhone` (from `errors.<field>`, `code` or `message`), else null.
 */
export function errorCode(error: unknown): string | null {
    if (!(error instanceof ApiError)) return null
    const body = error.body as {
        message?: unknown
        code?: unknown
        errors?: Record<string, unknown>
    } | null
    const nested = body?.errors && Object.values(body.errors).find((v) => typeof v === 'string')
    if (typeof nested === 'string') return nested
    if (typeof body?.code === 'string') return body.code
    return typeof body?.message === 'string' ? body.message : null
}
