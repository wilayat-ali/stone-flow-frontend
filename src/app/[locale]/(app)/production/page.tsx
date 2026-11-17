import { ProductionPage } from '@/components/production/production-page'
import { getActiveWorkspace } from '@/lib/session'

export default async function Page() {
    const workspace = await getActiveWorkspace()
    return <ProductionPage roleKey={workspace?.roleKey ?? ''} />
}
