import { NextResponse, type NextRequest } from 'next/server'
import { TOKEN_COOKIE } from '@/config/auth'
import { api } from '@/lib/api'

// Only these backend areas are reachable through this proxy.
const ALLOWED = [
    'accounts',
    'transfers',
    'deposits',
    'other-payments',
    'other-receipts',
    'cash-count',
    'entries',
    'approvals',
]

type Context = { params: Promise<{ path: string[] }> }

/**
 * Forwards /api/cash-bank/* to the backend's /cash-bank/* with the caller's token (kept in an
 * httpOnly cookie, so the browser cannot attach it itself) and the query string, which the
 * statement filters and paging need. The backend decides who may do what and which company the
 * data belongs to; this only carries the request.
 */
async function forward(request: NextRequest, { params }: Context) {
    const { path } = await params
    if (!ALLOWED.includes(path[0])) return NextResponse.json({ message: 'notFound' }, { status: 404 })

    const isRead = request.method === 'GET'
    const origin = request.headers.get('origin')
    if (!isRead && origin && new URL(origin).host !== request.headers.get('host')) {
        return NextResponse.json({ message: 'forbidden' }, { status: 403 })
    }

    const token = request.cookies.get(TOKEN_COOKIE)?.value
    if (!token) return NextResponse.json({ message: 'unauthorized' }, { status: 401 })

    const body = isRead ? undefined : await request.json().catch(() => ({}))
    const result = await api<unknown>(
        `/cash-bank/${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`,
        { method: request.method, body, token }
    )

    if (result.ok) {
        return NextResponse.json(result.data ?? { ok: true }, { status: result.status === 204 ? 200 : result.status })
    }
    return NextResponse.json(result.body ?? { message: 'unavailable' }, { status: result.status || 503 })
}

export const GET = forward
export const POST = forward
export const PATCH = forward
