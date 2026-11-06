import 'server-only'

const API_URL = process.env.API_URL ?? 'http://localhost:3001/api/v1'

export type ApiResult<T> =
    | { ok: true; status: number; data: T }
    | { ok: false; status: number; body: unknown }

/** Server-side call to the Stone Flow backend. Never throws; network errors give status 0. */
export async function api<T>(
    path: string,
    init: { method?: string; body?: unknown; token?: string } = {}
): Promise<ApiResult<T>> {
    try {
        const response = await fetch(`${API_URL}${path}`, {
            method: init.method ?? (init.body ? 'POST' : 'GET'),
            headers: {
                'Content-Type': 'application/json',
                ...(init.token && { Authorization: `Bearer ${init.token}` }),
            },
            body: init.body ? JSON.stringify(init.body) : undefined,
            cache: 'no-store',
        })
        const text = await response.text()
        const json = text ? JSON.parse(text) : null
        if (!response.ok) return { ok: false, status: response.status, body: json }
        return { ok: true, status: response.status, data: json as T }
    } catch {
        return { ok: false, status: 0, body: null }
    }
}
