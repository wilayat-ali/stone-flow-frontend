import { NextResponse, type NextRequest } from 'next/server'
import { TOKEN_COOKIE } from '@/config/auth'
import { api } from '@/lib/api'

// Stock is read-only from the browser: it only changes through production, stock entries and sales.
const ALLOWED = ['history']

type Context = { params: Promise<{ path?: string[] }> }

/**
 * Forwards GET /api/stock and /api/stock/history to the backend's /stock with the caller's token
 * (kept in an httpOnly cookie) and the query string the filters and paging need.
 */
export async function GET(request: NextRequest, { params }: Context) {
    const { path = [] } = await params
    if (path.length > 1 || (path.length === 1 && !ALLOWED.includes(path[0]))) {
        return NextResponse.json({ message: 'notFound' }, { status: 404 })
    }

    const token = request.cookies.get(TOKEN_COOKIE)?.value
    if (!token) return NextResponse.json({ message: 'unauthorized' }, { status: 401 })

    const suffix = path.map((p) => `/${encodeURIComponent(p)}`).join('')
    const result = await api<unknown>(`/stock${suffix}${request.nextUrl.search}`, { method: 'GET', token })

    if (result.ok) return NextResponse.json(result.data ?? {}, { status: result.status })
    return NextResponse.json(result.body ?? { message: 'unavailable' }, { status: result.status || 503 })
}
