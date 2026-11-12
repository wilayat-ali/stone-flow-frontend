import { CustomersPage } from '@/components/customers/customers-page'
import { getActiveWorkspace, getSession } from '@/lib/session'

export default async function Page() {
    const [workspace, session] = await Promise.all([getActiveWorkspace(), getSession()])
    return <CustomersPage roleKey={workspace?.roleKey ?? ''} userName={session?.name ?? ''} />
}
