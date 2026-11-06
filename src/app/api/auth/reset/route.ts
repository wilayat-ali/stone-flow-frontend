import { NextResponse, type NextRequest } from 'next/server'
import { api } from '@/lib/api'

/** Sets a new password from a reset link an administrator shared. */
export async function POST(request: NextRequest) {
    const origin = request.headers.get('origin')
    if (origin && new URL(origin).host !== request.headers.get('host')) {
        return NextResponse.json({ ok: false, error: 'invalid' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const token = typeof body?.token === 'string' ? body.token : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    if (!token || password.length < 6) return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })

    const result = await api<unknown>('/auth/invitations/reset-password', { body: { token, password } })
    if (result.ok) return NextResponse.json({ ok: true })
    const invalid = result.status === 404 || result.status === 422
    return NextResponse.json(
        { ok: false, error: invalid ? 'invalid' : 'unavailable' },
        { status: invalid ? 404 : 503 }
    )
}
