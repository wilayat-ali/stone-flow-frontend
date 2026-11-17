import { SalesPage } from '@/components/sales/sales-page'
import { getActiveWorkspace } from '@/lib/session'

export default async function Page() {
    const workspace = await getActiveWorkspace()
    return <SalesPage roleKey={workspace?.roleKey ?? ''} />
}
