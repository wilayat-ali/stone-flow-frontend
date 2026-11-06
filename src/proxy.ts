import createMiddleware from 'next-intl/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { routing } from '@/i18n/routing'
import {
    ADMIN_TOKEN_COOKIE,
    COMPANY_COOKIE,
    COMPANY_SLUG_PATTERN,
    PUBLIC_AUTH_PATHS,
    ROUTES,
    TOKEN_COOKIE,
    WORKSPACE_COOKIE,
    companyLoginRoute,
    isCompanyLinkPath,
    isCompanyFirstPath,
    isCompanyLoginPath,
} from '@/config/auth'

const handleI18n = createMiddleware(routing)

export default function proxy(request: NextRequest) {
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

    if (!has(TOKEN_COOKIE)) {
        // Back to the company the user last signed in to, if we know it.
        const company = request.cookies.get(COMPANY_COOKIE)?.value
        return go(
            company && COMPANY_SLUG_PATTERN.test(company)
                ? companyLoginRoute(company)
                : ROUTES.login
        )
    }
    if (path === '/') return go(ROUTES.dashboard)
    if (path !== ROUTES.selectWorkspace && !has(WORKSPACE_COOKIE)) {
        return go(ROUTES.selectWorkspace)
    }

    return response
}

export const config = {
    matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
