import { NextResponse, type NextRequest } from 'next/server'
import { TOKEN_COOKIE } from '@/config/auth'
import { api } from '@/lib/api'

type Context = { params: Promise<{ path?: string[] }> }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ACTIONS = ['confirm', 'reject']

/** `/supplier-payments`, `/supplier-payments/<id>` and `/supplier-payments/<id>/confirm|reject`: nothing else. */
const isKnownPath = (path: string[]) =>
    path.length === 0 || (UUID.test(path[0]) && (path.length === 1 || (path.length === 2 && ACTIONS.includes(path[1]))))

/**
 * Forwards /api/supplier-payments/* to the backend with the caller's token (kept in an httpOnly cookie, so
 * the browser cannot attach it itself). The backend decides who may do what and which company the data
 * belongs to; this only carries the request.
 */
async function forward(request: NextRequest, { params }: Context) {
    const { path = [] } = await params
    if (!isKnownPath(path)) return NextResponse.json({ message: 'notFound' }, { status: 404 })

    const isRead = request.method === 'GET'
    const origin = request.headers.get('origin')
    if (!isRead && origin && new URL(origin).host !== request.headers.get('host')) {
        return NextResponse.json({ message: 'forbidden' }, { status: 403 })
    }

    const token = request.cookies.get(TOKEN_COOKIE)?.value
    if (!token) return NextResponse.json({ message: 'unauthorized' }, { status: 401 })

    const body = isRead ? undefined : await request.json().catch(() => ({}))
    const result = await api<unknown>(`/supplier-payments${path.map((p) => `/${encodeURIComponent(p)}`).join('')}${request.nextUrl.search}`, {
        method: request.method,
        body,
        token,
    })

    if (result.ok) return NextResponse.json(result.data ?? { ok: true }, { status: result.status })
    return NextResponse.json(result.body ?? { message: 'unavailable' }, { status: result.status || 503 })
}

export const GET = forward
export const POST = forward
