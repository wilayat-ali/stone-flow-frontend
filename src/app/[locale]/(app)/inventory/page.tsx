import { InventoryPage } from '@/components/inventory/inventory-page'
import { getActiveWorkspace, getSession } from '@/lib/session'

export default async function Page() {
    const [workspace, session] = await Promise.all([getActiveWorkspace(), getSession()])
    return <InventoryPage roleKey={workspace?.roleKey ?? ''} userName={session?.name ?? ''} />
}
