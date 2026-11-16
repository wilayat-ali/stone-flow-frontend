import { PurchasesPage } from '@/components/purchases/purchases-page'
import { getActiveWorkspace } from '@/lib/session'

export default async function Page() {
    const workspace = await getActiveWorkspace()
    return <PurchasesPage roleKey={workspace?.roleKey ?? ''} />
}
