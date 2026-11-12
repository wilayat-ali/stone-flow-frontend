import { PurchasesPage } from '@/components/purchases/purchases-page'
import { getActiveWorkspace, getSession } from '@/lib/session'

export default async function Page() {
    const [workspace, session] = await Promise.all([getActiveWorkspace(), getSession()])
    return <PurchasesPage roleKey={workspace?.roleKey ?? ''} userName={session?.name ?? ''} />
}
