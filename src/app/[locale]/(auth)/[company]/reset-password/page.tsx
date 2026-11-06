import { InvalidLink } from '@/components/auth/invalid-link'
import { SetPasswordForm } from '@/components/auth/set-password-form'
import { getInvitationInfo } from '@/features/auth/invitation'

export default async function ResetPasswordPage({
    params,
    searchParams,
}: {
    params: Promise<{ company: string }>
    searchParams: Promise<{ token?: string }>
}) {
    const [{ company }, { token }] = await Promise.all([params, searchParams])
    const result = await getInvitationInfo(token)

    if (!result.ok) return <InvalidLink unavailable={result.error === 'unavailable'} />
    if (result.info.type !== 'reset' || result.info.companySlug !== company) return <InvalidLink />

    return <SetPasswordForm company={company} token={token as string} />
}
