import { NextResponse, type NextRequest } from 'next/server'
import { COMPANY_SLUG_PATTERN } from '@/config/auth'
import { loginWithCompany, type LoginError } from '@/features/auth/login'

const STATUS: Record<LoginError, number> = {
    invalid: 401,
    throttled: 429,
    unavailable: 503,
}

const fail = (error: LoginError, status = STATUS[error]) =>
    NextResponse.json({ ok: false, error }, { status })

export async function POST(request: NextRequest) {
    // Unlike Server Actions, Route Handlers have no built-in origin check.
    const origin = request.headers.get('origin')
    if (origin && new URL(origin).host !== request.headers.get('host')) {
        return fail('invalid', 403)
    }

    const body = await request.json().catch(() => null)
    const company = typeof body?.company === 'string' ? body.company.trim().toLowerCase() : ''
    const identifier = typeof body?.identifier === 'string' ? body.identifier.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    if (!COMPANY_SLUG_PATTERN.test(company) || !identifier || !password) {
        return fail('invalid', 400)
    }

    const result = await loginWithCompany({ company, identifier, password })
    return result.ok ? NextResponse.json({ ok: true }) : fail(result.error)
}
