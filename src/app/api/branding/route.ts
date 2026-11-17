import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { COMPANY_THEME_COOKIE, WORKSPACE_COOKIE } from '@/config/auth'
import { isThemeId } from '@/config/themes'
import { REMEMBER_COMPANY } from '@/features/auth/login'
import { companyThemeCookie } from '@/lib/theme'
import { callWithSession, respond, withSession } from '@/lib/session-call'

/**
 * Owner/Partner sets the company's default colour theme (PATCH /company/branding).
 * The backend checks the role; on success the choice is also remembered in a cookie.
 */
export async function PATCH(request: NextRequest) {
    const origin = request.headers.get('origin')
    if (origin && new URL(origin).host !== request.headers.get('host')) {
        return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const theme = typeof body?.theme === 'string' ? body.theme : ''
    if (!isThemeId(theme)) return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })

    const call = await callWithSession<{ theme: string }>(request, { path: '/company/branding', method: 'PATCH', body: { theme } })
    if (!call.result.ok || call.ended) return respond(call)

    // Tie the remembered theme to the company it was saved for.
    const workspace = request.cookies.get(WORKSPACE_COOKIE)?.value
    if (workspace) (await cookies()).set(COMPANY_THEME_COOKIE, companyThemeCookie(workspace, theme), REMEMBER_COMPANY)
    return withSession(NextResponse.json({ ok: true, theme }), call)
}
