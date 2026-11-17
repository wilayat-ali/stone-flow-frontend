import { CustomersPage } from '@/components/customers/customers-page'
import { getActiveWorkspace } from '@/lib/session'

export default async function Page() {
    const workspace = await getActiveWorkspace()
    return <CustomersPage roleKey={workspace?.roleKey ?? ''} />
}
