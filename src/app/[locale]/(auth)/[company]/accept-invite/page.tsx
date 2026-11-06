import { AcceptInviteForm } from '@/components/auth/accept-invite-form'
import { InvalidLink } from '@/components/auth/invalid-link'
import { getInvitationInfo } from '@/features/auth/invitation'

export default async function AcceptInvitePage({
    params,
    searchParams,
}: {
    params: Promise<{ company: string }>
    searchParams: Promise<{ token?: string }>
}) {
    const [{ company }, { token }] = await Promise.all([params, searchParams])
    const result = await getInvitationInfo(token)

    // The link must belong to this company's URL and be an invite, not a password reset.
    if (!result.ok) return <InvalidLink unavailable={result.error === 'unavailable'} />
    if (result.info.type !== 'invite' || result.info.companySlug !== company) return <InvalidLink />

    return (
        <AcceptInviteForm
            token={token as string}
            company={company}
            companyName={result.info.companyName}
            roleName={result.info.roleName}
        />
    )
}
