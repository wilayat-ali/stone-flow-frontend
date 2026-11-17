import { NextResponse, type NextRequest } from 'next/server'
import { isAllowedCall } from '@/lib/proxy-rules'
import { callWithSession, respond } from '@/lib/session-call'

type Context = { params: Promise<{ path: string[] }> }

const WITH_BODY = ['POST', 'PATCH', 'PUT']

/**
 * The one door from the browser to the backend: /api/<area>/... goes to the backend's /<area>/... with the
 * caller's token. The token lives in an httpOnly cookie, so the browser cannot attach it itself, and this is
 * where an expired token is renewed (see lib/session-call.ts). Only the calls listed in lib/proxy-rules.ts get
 * through. The backend decides who may do what and which company the data belongs to; this only carries the
 * request. Login, invitations, password reset, branding and the super admin keep their own routes.
 */
async function forward(request: NextRequest, { params }: Context) {
    const { path } = await params
    const [area, ...rest] = path
    if (!isAllowedCall(area, rest, request.method)) return NextResponse.json({ message: 'notFound' }, { status: 404 })

    // Route handlers have no built-in origin check: a write must come from this site.
    const origin = request.headers.get('origin')
    if (request.method !== 'GET' && origin && new URL(origin).host !== request.headers.get('host')) {
        return NextResponse.json({ message: 'forbidden' }, { status: 403 })
    }

    const body = WITH_BODY.includes(request.method) ? await request.json().catch(() => ({})) : undefined
    const call = await callWithSession<unknown>(request, {
        path: `/${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`,
        method: request.method,
        body,
    })
    return respond(call)
}

export const GET = forward
export const POST = forward
export const PATCH = forward
export const PUT = forward
export const DELETE = forward
