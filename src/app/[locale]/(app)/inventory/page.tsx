import { InventoryPage } from '@/components/inventory/inventory-page'
import { getActiveWorkspace } from '@/lib/session'

export default async function Page() {
    const workspace = await getActiveWorkspace()
    return <InventoryPage roleKey={workspace?.roleKey ?? ''} />
}
