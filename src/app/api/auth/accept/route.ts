import { NextResponse, type NextRequest } from 'next/server'
import { startSession, type LoginResponse } from '@/features/auth/login'
import { api } from '@/lib/api'

type AcceptError = 'invalid' | 'accountExists' | 'unavailable'

const STATUS: Record<AcceptError, number> = { invalid: 404, accountExists: 409, unavailable: 503 }

const fail = (error: AcceptError, status = STATUS[error]) =>
    NextResponse.json({ ok: false, error }, { status })

/** New person accepts an invite: sets a name and password, joins, and is signed in. */
export async function POST(request: NextRequest) {
    const origin = request.headers.get('origin')
    if (origin && new URL(origin).host !== request.headers.get('host')) return fail('invalid', 403)

    const body = await request.json().catch(() => null)
    const token = typeof body?.token === 'string' ? body.token : ''
    const firstName = typeof body?.firstName === 'string' ? body.firstName.trim() : ''
    const lastName = typeof body?.lastName === 'string' ? body.lastName.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    if (!token || !firstName || password.length < 6) return fail('invalid', 400)

    // The company comes from the invite itself, never from the request.
    const info = await api<{ companySlug: string }>(`/auth/invitations/info?token=${encodeURIComponent(token)}`)
    if (!info.ok) return fail(info.status === 404 ? 'invalid' : 'unavailable')

    const result = await api<LoginResponse>('/auth/invitations/accept', {
        body: { token, firstName, ...(lastName && { lastName }), password },
    })
    if (!result.ok) {
        if (result.status === 409) return fail('accountExists')
        if (result.status === 404 || result.status === 422) return fail('invalid')
        return fail('unavailable')
    }

    await startSession(result.data, info.data.companySlug, result.data.user.email ?? '')
    return NextResponse.json({ ok: true })
}
