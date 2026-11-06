import { NextResponse, type NextRequest } from 'next/server'
import { verifyCompany } from '@/features/auth/company'

export async function GET(request: NextRequest) {
    const slug = request.nextUrl.searchParams.get('slug')?.trim().toLowerCase() ?? ''
    const result = await verifyCompany(slug)

    if (result.ok) return NextResponse.json(result)
    return NextResponse.json(result, { status: result.error === 'invalid' ? 404 : 503 })
}
