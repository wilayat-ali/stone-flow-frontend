import createMiddleware from 'next-intl/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { routing } from '@/i18n/routing'
import {
    ADMIN_TOKEN_COOKIE,
    COMPANY_COOKIE,
    COMPANY_SLUG_PATTERN,
    PUBLIC_AUTH_PATHS,
    REFRESH_COOKIE,
    RENEWED_COOKIE,
    ROUTES,
    SESSION_COOKIE_OPTIONS,
    TOKEN_COOKIE,
    WORKSPACE_COOKIE,
    companyLoginRoute,
    isCompanyLinkPath,
    isCompanyFirstPath,
    isCompanyLoginPath,
} from '@/config/auth'
import { clearSessionCookies, setSessionCookies } from '@/lib/session-cookies'
import { refreshSession } from '@/lib/session-refresh'
import { tokenExpiresWithin } from '@/lib/token-refresh'

const handleI18n = createMiddleware(routing)

/** Renew a little early, so a page is not rendered with a token that expires while it loads. */
const RENEW_BEFORE_MS = 60_000

export default async function proxy(request: NextRequest) {
    const response = handleI18n(request)
    const { pathname } = request.nextUrl

    const locale = routing.locales.find(
        (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`)
    )
    // No locale yet: next-intl is redirecting to the prefixed URL.
    if (!locale) return response

    const path = pathname.slice(locale.length + 1) || '/'
    const has = (name: string) => request.cookies.has(name)
    const go = (to: string) =>
        NextResponse.redirect(new URL(`/${locale}${to}`, request.url))

    if (path.startsWith('/s-admin')) {
        if (path !== ROUTES.superAdminLogin && !has(ADMIN_TOKEN_COOKIE)) {
            return go(ROUTES.superAdminLogin)
        }
        return response
    }

    if (isCompanyLinkPath(path)) return response

    if (PUBLIC_AUTH_PATHS.includes(path) || isCompanyLoginPath(path)) {
        return has(TOKEN_COOKIE) ? go(ROUTES.dashboard) : response
    }

    // Typed company names (/acme, /acme/anything) are checked by the page, not guessed from the last login.
    if (isCompanyFirstPath(path)) return response

    // Back to the company the user last signed in to, if we know it.
    const loginRoute = () => {
        const company = request.cookies.get(COMPANY_COOKIE)?.value
        return company && COMPANY_SLUG_PATTERN.test(company) ? companyLoginRoute(company) : ROUTES.login
    }

    // The access token lasts 15 minutes. A page is rendered on the server, which cannot set cookies, so the
    // token is renewed here, before the page, from the refresh token. Pages that start a write (Server
    // Actions) renew for themselves.
    const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value
    if (
        request.method === 'GET' &&
        refreshToken &&
        !has(RENEWED_COOKIE) &&
        tokenExpiresWithin(request.cookies.get(TOKEN_COOKIE)?.value, RENEW_BEFORE_MS)
    ) {
        const outcome = await refreshSession(refreshToken)
        if (outcome.ok) {
            // Come back to the same page with the new cookies, so the page sees them. The short "renewed" mark
            // stops a loop if the browser refuses cookies.
            const again = NextResponse.redirect(request.nextUrl)
            setSessionCookies(again.cookies, outcome.tokens)
            again.cookies.set(RENEWED_COOKIE, '1', { ...SESSION_COOKIE_OPTIONS, maxAge: 5 })
            return again
        }
        if (outcome.definitive) {
            const out = go(loginRoute())
            clearSessionCookies(out.cookies)
            return out
        }
        // The backend is away: carry on with what there is rather than signing anyone out.
    }

    if (!has(TOKEN_COOKIE)) return go(loginRoute())
    if (path === '/') return go(ROUTES.dashboard)
    if (path !== ROUTES.selectWorkspace && !has(WORKSPACE_COOKIE)) {
        return go(ROUTES.selectWorkspace)
    }

    return response
}

export const config = {
    matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
