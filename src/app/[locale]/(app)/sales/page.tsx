import { SalesPage } from '@/components/sales/sales-page'
import { getActiveWorkspace, getSession } from '@/lib/session'

export default async function Page() {
    const [workspace, session] = await Promise.all([getActiveWorkspace(), getSession()])
    return <SalesPage roleKey={workspace?.roleKey ?? ''} userName={session?.name ?? ''} />
}
