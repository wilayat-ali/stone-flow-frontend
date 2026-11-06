import type { Account, EntryType, LedgerEntry } from './types'

export type StatementRow = {
    id: string
    date: string
    type: EntryType
    in: number
    out: number
    /** Running balance after this row. */
    balance: number
    refNo: string | null
    note: string | null
}

const signed = (entry: LedgerEntry) => (entry.direction === 'in' ? entry.amount : -entry.amount)

/** Oldest first; on the same day money in comes before money out. */
const byLedgerOrder = (a: LedgerEntry, b: LedgerEntry) =>
    a.date.localeCompare(b.date) || (a.direction === b.direction ? 0 : a.direction === 'in' ? -1 : 1)

const forAccount = (account: Account, entries: LedgerEntry[]) =>
    entries.filter((entry) => entry.accountId === account.id).sort(byLedgerOrder)

export const balanceOf = (account: Account, entries: LedgerEntry[]) =>
    forAccount(account, entries).reduce((sum, entry) => sum + signed(entry), account.openingBalance)

/** The account's rows with a running balance, opening balance first and newest last. */
export function statementOf(account: Account, entries: LedgerEntry[]): StatementRow[] {
    const opening: StatementRow = {
        id: `opening-${account.id}`,
        date: account.openingDate,
        type: 'opening',
        in: Math.max(account.openingBalance, 0),
        out: Math.max(-account.openingBalance, 0),
        balance: account.openingBalance,
        refNo: null,
        note: null,
    }

    let balance = account.openingBalance
    const rows = forAccount(account, entries).map((entry): StatementRow => {
        balance += signed(entry)
        return {
            id: entry.id,
            date: entry.date,
            type: entry.type,
            in: entry.direction === 'in' ? entry.amount : 0,
            out: entry.direction === 'out' ? entry.amount : 0,
            balance,
            refNo: entry.refNo,
            note: entry.note,
        }
    })

    return [opening, ...rows]
}
