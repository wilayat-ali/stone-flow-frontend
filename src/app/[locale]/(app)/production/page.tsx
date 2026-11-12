import { ProductionPage } from '@/components/production/production-page'
import { getActiveWorkspace, getSession } from '@/lib/session'

export default async function Page() {
    const [workspace, session] = await Promise.all([getActiveWorkspace(), getSession()])
    return <ProductionPage roleKey={workspace?.roleKey ?? ''} userName={session?.name ?? ''} />
}
