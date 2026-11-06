import { UsersPage } from '@/components/admin/users-page'
import { getActiveWorkspace } from '@/lib/session'

export default async function Page() {
    const workspace = await getActiveWorkspace()
    return <UsersPage roleKey={workspace?.roleKey ?? ''} />
}
