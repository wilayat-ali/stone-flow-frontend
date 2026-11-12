/** The munshi's petty cash is not a bank or cash account of its own on the backend; it is shown as one here. */
export const MUNSHI_ACCOUNT_ID = 'munshi-cash'

// Money other modules (worker payments) have taken out of an account, so Expenses can check balances and
// work out Munshi cash without importing them. Stand-in for the ledger rows of 03a.
const taken = new Map<string, { accountId: string; amount: number }>()

export const setExtraOutflow = (key: string, accountId: string, amount: number) => {
    taken.set(key, { accountId, amount })
}

export const clearExtraOutflow = (key: string) => {
    taken.delete(key)
}

export const extraOutflow = (accountId: string) => [...taken.values()].filter((t) => t.accountId === accountId).reduce((s, t) => s + t.amount, 0)
