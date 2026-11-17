import 'server-only'

import { NextResponse, type NextRequest } from 'next/server'
import { REFRESH_COOKIE, TOKEN_COOKIE } from '@/config/auth'
import { api, type ApiResult } from './api'
import { clearSessionCookies, setSessionCookies } from './session-cookies'
import { refreshSession } from './session-refresh'
import { tokenExpiresWithin, type Tokens } from './token-refresh'

/** Renew a little early, so a request is not sent with a token that expires on the way. */
const RENEW_BEFORE_MS = 20_000

export type SessionCall<T> = {
    result: ApiResult<T>
    /** New tokens, when the session was renewed on the way: they must go back to the browser. */
    renewed: Tokens | null
    /** The session is over (nothing to renew from, or the backend refused the refresh token). */
    ended: boolean
    /** The session could not be renewed because the backend was unreachable: nothing says the session is over. */
    down: boolean
}

/**
 * Calls the backend for the signed-in person. If the access token has expired, or is about to, it is renewed
 * from the refresh token first (all calls that need it at the same moment share one renewal), and a call the
 * backend still refuses with 401 is retried once with a fresh token. Only a definite refusal ends the session;
 * a backend that cannot be reached does not sign anyone out.
 */
export async function callWithSession<T>(
    request: NextRequest,
    init: { path: string; method: string; body?: unknown }
): Promise<SessionCall<T>> {
    let token = request.cookies.get(TOKEN_COOKIE)?.value
    const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value
    const state: SessionCall<T> = { result: { ok: false, status: 401, body: null }, renewed: null, ended: false, down: false }

    const renew = async (): Promise<boolean> => {
        if (!refreshToken) return false
        const outcome = await refreshSession(refreshToken)
        if (outcome.ok) {
            state.renewed = outcome.tokens
            token = outcome.tokens.token
            return true
        }
        if (outcome.definitive) state.ended = true
        else state.down = true
        return false
    }

    if (!token && !refreshToken) {
        state.ended = true
        return state
    }

    if (refreshToken && tokenExpiresWithin(token, RENEW_BEFORE_MS)) {
        await renew()
        if (state.ended) return state
    }

    state.result = await api<T>(init.path, { method: init.method, body: init.body, token })

    if (!state.result.ok && state.result.status === 401 && !state.renewed) {
        // The token was refused although it looked valid (revoked, or the clock differs). Renew and try once more.
        if (await renew()) state.result = await api<T>(init.path, { method: init.method, body: init.body, token })
        else if (state.ended) return state
    }

    // Still refused with a fresh token: the session itself is no good (user removed, company suspended).
    if (!state.result.ok && state.result.status === 401 && state.renewed) state.ended = true
    if (!state.result.ok && state.result.status === 401 && !refreshToken) state.ended = true

    return state
}

/** Puts the outcome on the response: new tokens when the session was renewed, cleared cookies when it ended. */
export function withSession(response: NextResponse, call: Pick<SessionCall<unknown>, 'renewed' | 'ended'>): NextResponse {
    if (call.ended) clearSessionCookies(response.cookies)
    else if (call.renewed) setSessionCookies(response.cookies, call.renewed)
    return response
}

/** What the browser gets for a call: the backend's answer, a "session over" 401, or a 503 when it is away. */
export function respond<T>(call: SessionCall<T>): NextResponse {
    const { result } = call
    if (call.ended) return withSession(NextResponse.json({ message: 'sessionExpired' }, { status: 401 }), call)
    if (result.ok) {
        return withSession(NextResponse.json(result.data ?? { ok: true }, { status: result.status === 204 ? 200 : result.status }), call)
    }
    // A 401 with the backend unreachable during renewal is not "signed out".
    if (result.status === 401 && call.down) return withSession(NextResponse.json({ message: 'unavailable' }, { status: 503 }), call)
    return withSession(NextResponse.json(result.body ?? { message: 'unavailable' }, { status: result.status || 503 }), call)
}
