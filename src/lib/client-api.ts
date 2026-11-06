export class ApiError extends Error {
    constructor(
        public status: number,
        public body: unknown
    ) {
        super(`Request failed with ${status}`)
    }
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
    if (!response.ok) throw new ApiError(response.status, json)
    return json as T
}

/**
 * Short code the backend gives for a failure, such as `alreadyMember` or
 * `invalidPhone` (from `errors.<field>` or `message`), else null.
 */
export function errorCode(error: unknown): string | null {
    if (!(error instanceof ApiError)) return null
    const body = error.body as { message?: unknown; errors?: Record<string, unknown> } | null
    const nested = body?.errors && Object.values(body.errors).find((v) => typeof v === 'string')
    if (typeof nested === 'string') return nested
    return typeof body?.message === 'string' ? body.message : null
}
