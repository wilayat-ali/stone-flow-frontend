export type AccountKind = 'cash' | 'bank'

export type Account = {
    id: string
    kind: AccountKind
    name: string
    /** Last digits of the bank account number; cash has none. */
    last4: string | null
    openingBalance: number
    /** `YYYY-MM-DD` */
    openingDate: string
    /** Accounts are never deleted. */
    isActive: boolean
}

export type Direction = 'in' | 'out'

/** `opening` is the account's own opening balance; the rest are posted ledger rows. */
export const entryTypes = [
    'opening',
    'deposit',
    'otherReceipt',
    'otherPayment',
    'transfer',
    'adjustment',
    'supplierPayment',
    'customerPayment',
    'expense',
] as const

export type EntryType = (typeof entryTypes)[number]

/** One money-ledger row. Balances are always calculated from these, never stored. */
export type LedgerEntry = {
    id: string
    accountId: string
    /** `YYYY-MM-DD` */
    date: string
    direction: Direction
    amount: number
    type: Exclude<EntryType, 'opening'>
    /** Module reference, e.g. a purchi or bill number. */
    refNo: string | null
    note: string | null
}

/** An active account with its calculated balance, as the entry forms need it. */
export type AccountOption = Pick<Account, 'id' | 'name' | 'kind'> & { balance: number }
