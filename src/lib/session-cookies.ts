import {
    COMPANY_THEME_COOKIE,
    REFRESH_COOKIE,
    SESSION_COOKIE,
    SESSION_COOKIE_OPTIONS,
    SESSION_MAX_AGE,
    TOKEN_COOKIE,
    WORKSPACE_COOKIE,
} from '@/config/auth'

type Setter = { set: (name: string, value: string, options?: Record<string, unknown>) => unknown }
type Remover = { delete: (name: string) => unknown }

/**
 * Stores the tokens in httpOnly cookies. Both last as long as the refresh token does: the access token inside
 * is short-lived (15 minutes) and is renewed from the refresh token, so the cookie must outlive it. Leaving
 * the access cookie to expire with its token would sign the person out every 15 minutes.
 */
export function setSessionCookies(target: Setter, tokens: { token: string; refreshToken?: string }) {
    const options = { ...SESSION_COOKIE_OPTIONS, maxAge: SESSION_MAX_AGE }
    target.set(TOKEN_COOKIE, tokens.token, options)
    if (tokens.refreshToken) target.set(REFRESH_COOKIE, tokens.refreshToken, options)
}

/** Ends the session in the browser. The company name stays, so the login page comes back to the same company. */
export function clearSessionCookies(target: Remover) {
    for (const name of [TOKEN_COOKIE, REFRESH_COOKIE, SESSION_COOKIE, WORKSPACE_COOKIE, COMPANY_THEME_COOKIE]) target.delete(name)
}
