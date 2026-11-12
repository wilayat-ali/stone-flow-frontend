import { SuppliersPage } from '@/components/suppliers/suppliers-page'
import { getActiveWorkspace, getSession } from '@/lib/session'

export default async function Page() {
    const [workspace, session] = await Promise.all([getActiveWorkspace(), getSession()])
    return <SuppliersPage roleKey={workspace?.roleKey ?? ''} userName={session?.name ?? ''} />
}
