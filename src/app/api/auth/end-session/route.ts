import { NextResponse, type NextRequest } from 'next/server'
import { COMPANY_COOKIE, COMPANY_SLUG_PATTERN, ROUTES, companyLoginRoute } from '@/config/auth'
import { routing } from '@/i18n/routing'
import { clearSessionCookies } from '@/lib/session-cookies'

/**
 * Ends a session that has no workspace left, then sends the browser to the login page. A server component
 * cannot clear cookies, so the app layout redirects here instead.
 */
export function GET(request: NextRequest) {
    const requested = request.nextUrl.searchParams.get('locale')
    const locale = routing.locales.find((l) => l === requested) ?? routing.defaultLocale
    const company = request.cookies.get(COMPANY_COOKIE)?.value
    const loginPath = company && COMPANY_SLUG_PATTERN.test(company) ? companyLoginRoute(company) : ROUTES.login

    const response = NextResponse.redirect(new URL(`/${locale}${loginPath}`, request.url))
    clearSessionCookies(response.cookies)
    return response
}
