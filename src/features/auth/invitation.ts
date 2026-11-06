import 'server-only'

import { api } from '@/lib/api'

export type InvitationInfo = {
    type: string
    companyName: string
    companySlug: string
    roleName: string | null
}

/** What an invite or reset link is for; null when it is invalid, used or expired. */
export async function getInvitationInfo(
    token: string | undefined
): Promise<{ ok: true; info: InvitationInfo } | { ok: false; error: 'invalid' | 'unavailable' }> {
    if (!token) return { ok: false, error: 'invalid' }
    const result = await api<InvitationInfo>(`/auth/invitations/info?token=${encodeURIComponent(token)}`)
    if (result.ok) return { ok: true, info: result.data }
    return { ok: false, error: result.status === 404 ? 'invalid' : 'unavailable' }
}
