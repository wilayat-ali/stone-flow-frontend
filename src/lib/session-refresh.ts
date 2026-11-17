import { createRefresher, type BackendRefresh, type RefreshOutcome } from './token-refresh'

// Not marked server-only on purpose: proxy.ts and the API routes both use it, and both run on the Node server.
const API_URL = process.env.API_URL ?? 'http://localhost:3001/api/v1'

async function callBackend(refreshToken: string): Promise<BackendRefresh> {
    try {
        const response = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${refreshToken}` },
            cache: 'no-store',
        })
        if (!response.ok) return { status: response.status }
        return { status: response.status, tokens: await response.json() }
    } catch {
        return { status: 0 }
    }
}

// One queue for the whole Node process. proxy.ts and the route handlers are bundled separately, so a module
// variable would give each its own; globalThis is shared by both.
const SHARED = Symbol.for('stoneflow.session-refresher')
const shared = globalThis as unknown as Record<symbol, ((refreshToken: string) => Promise<RefreshOutcome>) | undefined>

/** Renews the session from a refresh token. Concurrent calls with the same token share one backend call. */
export const refreshSession = (shared[SHARED] ??= createRefresher(callBackend))
