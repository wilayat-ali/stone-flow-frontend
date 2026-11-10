import { RolesPage } from '@/components/admin/roles-page'
import { getActiveWorkspace } from '@/lib/session'

export default async function Page() {
    const workspace = await getActiveWorkspace()
    return <RolesPage roleKey={workspace?.roleKey} />
}
