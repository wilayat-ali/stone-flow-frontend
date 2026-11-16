import { SuppliersPage } from '@/components/suppliers/suppliers-page'
import { getActiveWorkspace } from '@/lib/session'

export default async function Page() {
    const workspace = await getActiveWorkspace()
    return <SuppliersPage roleKey={workspace?.roleKey ?? ''} />
}
