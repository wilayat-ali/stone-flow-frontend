import { NextResponse, type NextRequest } from 'next/server'
import { ADMIN_TOKEN_COOKIE } from '@/config/auth'
import { api } from '@/lib/api'

// Only the companies area of the platform API is reachable through this proxy.
const ALLOWED = ['companies']

type Context = { params: Promise<{ path: string[] }> }

/**
 * Forwards /api/s-admin/* to the backend's /superadmin/* with the staff token
 * (an httpOnly cookie the browser cannot attach itself). The backend decides
 * who may do what: `super_admin` can change things, `support` can only read.
 */
async function forward(request: NextRequest, { params }: Context) {
    const { path } = await params
    if (!ALLOWED.includes(path[0])) return NextResponse.json({ message: 'notFound' }, { status: 404 })

    const isRead = request.method === 'GET'
    const origin = request.headers.get('origin')
    if (!isRead && origin && new URL(origin).host !== request.headers.get('host')) {
        return NextResponse.json({ message: 'forbidden' }, { status: 403 })
    }

    const token = request.cookies.get(ADMIN_TOKEN_COOKIE)?.value
    if (!token) return NextResponse.json({ message: 'unauthorized' }, { status: 401 })

    const body = isRead ? undefined : await request.json().catch(() => ({}))
    const query = request.nextUrl.search
    const result = await api<unknown>(`/superadmin/${path.map(encodeURIComponent).join('/')}${query}`, {
        method: request.method,
        body,
        token,
    })

    if (result.ok) return NextResponse.json(result.data ?? { ok: true }, { status: result.status === 204 ? 200 : result.status })
    return NextResponse.json(result.body ?? { message: 'unavailable' }, { status: result.status || 503 })
}

export const GET = forward
export const POST = forward
export const PUT = forward
export const PATCH = forward
