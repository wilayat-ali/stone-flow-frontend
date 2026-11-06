import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { ADMIN_SESSION_COOKIE, ADMIN_TOKEN_COOKIE } from '@/config/auth'
import { cookieOptions, type LoginError } from '@/features/auth/login'
import { api } from '@/lib/api'
import { serializeSession } from '@/lib/session'

type AdminLoginResponse = {
    token: string
    tokenExpires: number
    admin: { id: string; name: string; email: string; role: string }
}

const STATUS: Record<LoginError, number> = { invalid: 401, throttled: 429, unavailable: 503 }

const fail = (error: LoginError, status = STATUS[error]) =>
    NextResponse.json({ ok: false, error }, { status })

/** Platform staff sign-in (POST /superadmin/auth/login). Their token stays in an httpOnly cookie. */
export async function POST(request: NextRequest) {
    const origin = request.headers.get('origin')
    if (origin && new URL(origin).host !== request.headers.get('host')) return fail('invalid', 403)

    const body = await request.json().catch(() => null)
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    if (!email || !password) return fail('invalid', 400)

    const result = await api<AdminLoginResponse>('/superadmin/auth/login', { body: { email, password } })
    if (!result.ok) {
        if (result.status === 401 || result.status === 422) return fail('invalid')
        if (result.status === 429) return fail('throttled')
        return fail('unavailable')
    }

    const { token, tokenExpires, admin } = result.data
    const store = await cookies()
    store.set(ADMIN_TOKEN_COOKIE, token, { ...cookieOptions, expires: new Date(tokenExpires) })
    store.set(
        ADMIN_SESSION_COOKIE,
        serializeSession({ name: admin.name, email: admin.email, role: admin.role }),
        cookieOptions
    )
    return NextResponse.json({ ok: true })
}
