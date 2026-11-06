import { WorkspacesPage } from '@/components/super-admin/workspaces-page'
import { getAdminSession } from '@/lib/session'

export default async function Page() {
    const session = await getAdminSession()
    return <WorkspacesPage canManage={session?.role === 'super_admin'} />
}
