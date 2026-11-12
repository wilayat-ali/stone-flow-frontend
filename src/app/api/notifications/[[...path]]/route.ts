import { NextResponse, type NextRequest } from 'next/server'
import { TOKEN_COOKIE } from '@/config/auth'
import { api } from '@/lib/api'

type Context = { params: Promise<{ path?: string[] }> }

/** Forwards /api/notifications (list) and /api/notifications/:id/read, /read-all to the backend. */
async function forward(request: NextRequest, { params }: Context) {
    const { path = [] } = await params
    const valid =
        path.length === 0
            ? request.method === 'GET'
            : request.method === 'POST' &&
              ((path.length === 1 && path[0] === 'read-all') || (path.length === 2 && path[1] === 'read'))
    if (!valid) return NextResponse.json({ message: 'notFound' }, { status: 404 })

    const isRead = request.method === 'GET'
    const origin = request.headers.get('origin')
    if (!isRead && origin && new URL(origin).host !== request.headers.get('host')) {
        return NextResponse.json({ message: 'forbidden' }, { status: 403 })
    }

    const token = request.cookies.get(TOKEN_COOKIE)?.value
    if (!token) return NextResponse.json({ message: 'unauthorized' }, { status: 401 })

    const suffix = path.map((p) => `/${encodeURIComponent(p)}`).join('')
    const result = await api<unknown>(`/notifications${suffix}${request.nextUrl.search}`, {
        method: request.method,
        body: isRead ? undefined : {},
        token,
    })

    if (result.ok) {
        return NextResponse.json(result.data ?? { ok: true }, { status: result.status === 204 ? 200 : result.status })
    }
    return NextResponse.json(result.body ?? { message: 'unavailable' }, { status: result.status || 503 })
}

export const GET = forward
export const POST = forward
