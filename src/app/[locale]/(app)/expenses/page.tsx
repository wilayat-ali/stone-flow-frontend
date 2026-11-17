import { ExpensesPage } from '@/components/expenses/expenses-page'
import { getActiveWorkspace } from '@/lib/session'

export default async function Page() {
    const workspace = await getActiveWorkspace()
    return <ExpensesPage roleKey={workspace?.roleKey ?? ''} />
}
