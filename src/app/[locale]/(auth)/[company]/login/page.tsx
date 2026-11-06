import { InvalidCompany } from '@/components/auth/invalid-company'
import { LoginForm } from '@/components/auth/login-form'
import { verifyCompany } from '@/features/auth/company'

export default async function LoginPage({
    params,
}: {
    params: Promise<{ company: string }>
}) {
    const { company } = await params
    const check = await verifyCompany(company)

    if (!check.ok) return <InvalidCompany unavailable={check.error === 'unavailable'} />

    return <LoginForm company={company} companyName={check.name} />
}
