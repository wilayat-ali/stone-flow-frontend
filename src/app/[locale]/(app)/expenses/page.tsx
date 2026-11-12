import { ExpensesPage } from '@/components/expenses/expenses-page'
import { getActiveWorkspace, getSession } from '@/lib/session'

export default async function Page() {
    const [workspace, session] = await Promise.all([getActiveWorkspace(), getSession()])
    return <ExpensesPage roleKey={workspace?.roleKey ?? ''} userName={session?.name ?? ''} />
}
