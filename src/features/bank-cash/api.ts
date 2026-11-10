import { request } from '@/lib/client-api'
import type { Account, EntryType, LedgerEntry } from './types'

/** Prefix of both keys, so one invalidation refreshes the whole tab. */
export const bankCashKey = ['bank-cash'] as const
export const accountsKey = [...bankCashKey, 'accounts'] as const
export const entriesKey = [...bankCashKey, 'entries'] as const

const base = '/api/cash-bank'

// What the backend sends. Balances are calculated there from ledger rows; the opening balance is
// itself the account's first ledger row (`sourceType: 'opening'`).
type ApiAccount = {
    id: string
    kind: Account['kind']
    name: string
    last4: string | null
    openingBalance: number | null
    openingDate: string
    isActive: boolean
    balance: number | null
}

type ApiRow = {
    id: string
    date: string
    direction: LedgerEntry['direction']
    amount: number
    sourceType: string
    sourceId: string | null
    note: string | null
}

const fetchAccounts = () => request<ApiAccount[]>(`${base}/accounts?includeInactive=true`)

export const listAccounts = async (): Promise<Account[]> =>
    (await fetchAccounts()).map((a) => ({
        id: a.id,
        kind: a.kind,
        name: a.name,
        last4: a.last4,
        openingBalance: a.openingBalance ?? 0,
        openingDate: a.openingDate,
        isActive: a.isActive,
    }))

const PAGE_SIZE = 200

/** Every row of one account, oldest first (the statement endpoint pages at 200). */
async function allRows(accountId: string): Promise<ApiRow[]> {
    const rows: ApiRow[] = []
    for (let page = 1; ; page++) {
        const statement = await request<{ total: number; rows: ApiRow[] }>(
            `${base}/accounts/${accountId}/statement?order=asc&limit=${PAGE_SIZE}&page=${page}`
        )
        rows.push(...statement.rows)
        if (statement.rows.length === 0 || rows.length >= statement.total) return rows
    }
}

const entryTypes: Record<string, Exclude<EntryType, 'opening'>> = {
    deposit: 'deposit',
    transfer: 'transfer',
    other_receipt: 'otherReceipt',
    other_payment: 'otherPayment',
    cash_adjustment: 'adjustment',
    reversal: 'reversal',
}

/**
 * Every posted row of every account, without the opening rows (the screen shows each account's
 * opening balance itself). A transfer or deposit with no note of its own shows the other account's
 * name, as the screen always has.
 */
export const listEntries = async (): Promise<LedgerEntry[]> => {
    const accounts = await fetchAccounts()
    const perAccount = await Promise.all(
        accounts.map(async (account) => ({ account, rows: await allRows(account.id) }))
    )

    const pairs = new Map<string, { accountName: string; row: ApiRow }[]>()
    for (const { account, rows } of perAccount) {
        for (const row of rows) {
            if (row.sourceId && (row.sourceType === 'transfer' || row.sourceType === 'deposit')) {
                pairs.set(row.sourceId, [...(pairs.get(row.sourceId) ?? []), { accountName: account.name, row }])
            }
        }
    }

    return perAccount.flatMap(({ account, rows }) =>
        rows
            .filter((row) => row.sourceType !== 'opening')
            .map((row): LedgerEntry => {
                const other = row.sourceId ? pairs.get(row.sourceId)?.find((p) => p.row.id !== row.id) : undefined
                return {
                    id: row.id,
                    accountId: account.id,
                    date: row.date,
                    direction: row.direction,
                    amount: row.amount,
                    type: entryTypes[row.sourceType] ?? 'other',
                    refNo: null,
                    note: row.note ?? other?.accountName ?? null,
                }
            })
    )
}

export type AccountInput = Pick<Account, 'kind' | 'name' | 'last4' | 'openingBalance' | 'openingDate'>

export const createAccount = async (input: AccountInput): Promise<Account> => {
    const created = await request<ApiAccount>(`${base}/accounts`, {
        body: {
            kind: input.kind,
            name: input.name,
            ...(input.kind === 'bank' && input.last4 && { last4: input.last4 }),
            openingBalance: input.openingBalance,
            openingDate: input.openingDate,
        },
    })
    return { ...created, openingBalance: created.openingBalance ?? 0 }
}

/**
 * Accounts are never deleted; `isActive: false` hides one. Only the name, the last digits and the
 * active flag can change: the opening balance is the first row of the account's history.
 */
export const updateAccount = async (
    id: string,
    values: Partial<Omit<Account, 'id' | 'kind'>>
): Promise<Account> => {
    const updated = await request<ApiAccount>(`${base}/accounts/${id}`, {
        method: 'PATCH',
        body: {
            ...(values.name !== undefined && { name: values.name }),
            ...(values.last4 && { last4: values.last4 }),
            ...(values.isActive !== undefined && { isActive: values.isActive }),
        },
    })
    return { ...updated, openingBalance: updated.openingBalance ?? 0 }
}

/**
 * Posts what a form built, as the right backend call: one row is a deposit, other payment, other
 * receipt or cash count; an out row plus an in row is a transfer (posted together, or not at all).
 */
export const postEntries = async (rows: Omit<LedgerEntry, 'id'>[]): Promise<void> => {
    if (rows.length === 2 && rows.every((row) => row.type === 'transfer')) {
        const from = rows.find((row) => row.direction === 'out')
        const to = rows.find((row) => row.direction === 'in')
        if (!from || !to) throw new Error('A transfer needs one row out and one row in')

        // The form fills an empty note with the other account's name; that is not a note to keep.
        const names = new Map((await fetchAccounts()).map((a) => [a.id, a.name]))
        const typed = from.note && from.note !== names.get(to.accountId) ? from.note : null
        await request(`${base}/transfers`, {
            body: {
                fromAccountId: from.accountId,
                toAccountId: to.accountId,
                date: from.date,
                amount: from.amount,
                ...(typed && { note: typed }),
            },
        })
        return
    }

    if (rows.length !== 1) throw new Error('Unsupported entry')
    const [row] = rows
    const common = { date: row.date, amount: row.amount }
    const note = row.note ? { note: row.note } : {}

    switch (row.type) {
        case 'deposit':
            await request(`${base}/deposits`, { body: { ...common, toAccountId: row.accountId, ...note } })
            return
        case 'otherPayment':
            await request(`${base}/other-payments`, {
                body: { ...common, accountId: row.accountId, ...(row.note && { reason: row.note }) },
            })
            return
        case 'otherReceipt':
            await request(`${base}/other-receipts`, {
                body: { ...common, accountId: row.accountId, ...(row.note && { reason: row.note }) },
            })
            return
        case 'adjustment': {
            // The form works out the difference; the backend wants the amount that was counted.
            const account = (await fetchAccounts()).find((a) => a.id === row.accountId)
            const inBooks = account?.balance ?? 0
            await request(`${base}/cash-count`, {
                body: {
                    accountId: row.accountId,
                    date: row.date,
                    countedAmount: inBooks + (row.direction === 'in' ? row.amount : -row.amount),
                    reason: row.note ?? undefined,
                },
            })
            return
        }
        default:
            throw new Error('Unsupported entry')
    }
}
