import { useQuery } from '@tanstack/react-query'
import { accountsKey, entriesKey, listAccounts, listEntries } from '@/features/bank-cash/api'
import { balanceOf } from '@/features/bank-cash/ledger'
import { accountOutflow, getMunshiCash, MUNSHI_ACCOUNT_ID, munshiBalance, munshiCashQueryKey } from '@/features/expenses'

export type PayAccount = {
    id: string
    name: string
    kind: 'cash' | 'bank' | 'munshi'
    /** What is left to spend; `null` when the ledger could not be read, so nothing is checked. */
    balance: number | null
}

/**
 * Every active account an expense can be paid from, with what is left in it: the ledger balance less
 * what expenses and cash given to the munshi have already taken. Munshi cash is listed too.
 */
export function useAccountBalances(enabled: boolean, munshiLabel: string) {
    const accounts = useQuery({ queryKey: accountsKey, queryFn: listAccounts, enabled })
    const entries = useQuery({ queryKey: entriesKey, queryFn: listEntries, enabled, retry: false })
    const munshi = useQuery({ queryKey: [munshiCashQueryKey], queryFn: getMunshiCash, enabled })

    const real: PayAccount[] = (accounts.data ?? [])
        .filter((a) => a.isActive)
        .map((a) => ({
            id: a.id,
            name: a.name,
            kind: a.kind,
            balance: entries.data ? balanceOf(a, entries.data) - accountOutflow(a.id) : null,
        }))
    const munshiAccount: PayAccount = { id: MUNSHI_ACCOUNT_ID, name: munshiLabel, kind: 'munshi', balance: munshi.data ? munshiBalance() : null }

    return { accounts: real, munshi: munshiAccount, loading: accounts.isLoading }
}
