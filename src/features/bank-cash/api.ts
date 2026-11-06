import { accountsSeed, entriesSeed } from './data'
import type { Account, LedgerEntry } from './types'

/** Prefix of both keys, so one invalidation refreshes the whole tab. */
export const bankCashKey = ['bank-cash'] as const
export const accountsKey = [...bankCashKey, 'accounts'] as const
export const entriesKey = [...bankCashKey, 'entries'] as const

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

// In-memory stand-in for the backend; replace with `request()` calls like `features/admin/members.ts`.
let accounts = [...accountsSeed]
let entries = [...entriesSeed]

export const listAccounts = async (): Promise<Account[]> => {
    await delay()
    return accounts
}

export const listEntries = async (): Promise<LedgerEntry[]> => {
    await delay()
    return entries
}

export type AccountInput = Pick<Account, 'kind' | 'name' | 'last4' | 'openingBalance' | 'openingDate'>

export const createAccount = async (input: AccountInput): Promise<Account> => {
    await delay()
    const account: Account = { ...input, id: crypto.randomUUID(), isActive: true }
    accounts = [...accounts, account]
    return account
}

/** Accounts are never deleted; `isActive: false` hides one. */
export const updateAccount = async (
    id: string,
    values: Partial<Omit<Account, 'id' | 'kind'>>
): Promise<Account> => {
    await delay()
    accounts = accounts.map((a) => (a.id === id ? { ...a, ...values } : a))
    return accounts.find((a) => a.id === id) as Account
}

/** Posts ledger rows together, so a transfer's two sides land or fail as one. */
export const postEntries = async (rows: Omit<LedgerEntry, 'id'>[]): Promise<void> => {
    await delay()
    entries = [...entries, ...rows.map((row) => ({ ...row, id: crypto.randomUUID() }))]
}
