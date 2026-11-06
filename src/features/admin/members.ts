import { request } from '@/lib/client-api'

export type MemberStatus = 'active' | 'inactive' | 'invited'

export type Member = {
    memberId: string
    userId: number | string
    firstName: string | null
    lastName: string | null
    phone: string | null
    email: string | null
    roleKey: string
    roleName: string
    status: MemberStatus
    joinedAt: string | null
}

export type Invitation = {
    id: string
    phone: string | null
    email: string | null
    roleKey: string | null
    roleName: string | null
    expiresAt: string
    createdAt: string
}

export type InviteInput = { phone?: string; email?: string; roleKey: string }

export type InviteResult = {
    invitationId: string
    inviteLink: string
    whatsappLink: string
    expiresAt: string
    emailQueued: boolean
}

export type ResetLinkResult = { resetLink: string; whatsappLink: string; expiresAt: string }

export const membersKey = ['members'] as const
export const invitationsKey = ['invitations'] as const

const base = '/api/company'

export const listMembers = () => request<Member[]>(`${base}/members`)
export const listInvitations = () => request<Invitation[]>(`${base}/invitations`)

export const inviteMember = (input: InviteInput) =>
    request<InviteResult>(`${base}/invitations`, { body: input })

export const revokeInvitation = (id: string) =>
    request<unknown>(`${base}/invitations/${id}`, { method: 'DELETE' })

export const setMemberActive = (memberId: string, active: boolean) =>
    request<unknown>(`${base}/members/${memberId}/${active ? 'activate' : 'deactivate'}`, {
        method: 'POST',
        body: {},
    })

export const changeMemberRole = (memberId: string, roleKey: string) =>
    request<unknown>(`${base}/members/${memberId}/role`, { method: 'PATCH', body: { roleKey } })

export const createResetLink = (memberId: string) =>
    request<ResetLinkResult>(`${base}/members/${memberId}/reset-link`, { method: 'POST', body: {} })

export const memberName = (member: Pick<Member, 'firstName' | 'lastName'>) =>
    [member.firstName, member.lastName].filter(Boolean).join(' ')
