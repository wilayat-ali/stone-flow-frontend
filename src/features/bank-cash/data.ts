import type { Account, LedgerEntry } from './types'

const baseAccounts: Account[] = [
    { id: 'cash', kind: 'cash', name: 'Cash in hand', last4: null, openingBalance: 100000, openingDate: '2026-09-01', isActive: true },
    { id: 'hbl', kind: 'bank', name: 'HBL Current A/C', last4: '4471', openingBalance: 900000, openingDate: '2026-09-01', isActive: true },
    { id: 'meezan', kind: 'bank', name: 'Meezan Bank', last4: '0923', openingBalance: 100000, openingDate: '2026-09-01', isActive: true },
    { id: 'mcb', kind: 'bank', name: 'MCB Bank', last4: '1180', openingBalance: 400000, openingDate: '2026-09-01', isActive: true },
]

const baseEntries: LedgerEntry[] = [
    { id: 'e1', accountId: 'hbl', date: '2026-09-05', direction: 'out', amount: 500000, type: 'supplierPayment', refNo: 'Truck 18/4', note: 'Mine owner payment' },
    { id: 'e2', accountId: 'hbl', date: '2026-09-12', direction: 'in', amount: 249500, type: 'customerPayment', refNo: 'Bill 1042', note: 'Bank transfer' },
    { id: 'e3', accountId: 'hbl', date: '2026-10-02', direction: 'out', amount: 240000, type: 'supplierPayment', refNo: 'Cheque 004821', note: 'Cheque cleared' },
    { id: 'e4', accountId: 'hbl', date: '2026-10-20', direction: 'out', amount: 100000, type: 'transfer', refNo: null, note: 'To Cash in hand' },
    { id: 'e5', accountId: 'cash', date: '2026-10-20', direction: 'in', amount: 100000, type: 'transfer', refNo: null, note: 'From HBL' },
    { id: 'e6', accountId: 'cash', date: '2026-10-28', direction: 'in', amount: 36400, type: 'customerPayment', refNo: 'Bill 1051', note: 'Cash sale' },
    { id: 'e7', accountId: 'cash', date: '2026-10-30', direction: 'out', amount: 40000, type: 'expense', refNo: null, note: 'Worker advance' },
    { id: 'e8', accountId: 'meezan', date: '2026-09-15', direction: 'in', amount: 50000, type: 'deposit', refNo: null, note: null },
    { id: 'e9', accountId: 'meezan', date: '2026-10-08', direction: 'out', amount: 50000, type: 'otherPayment', refNo: null, note: 'Electricity bill' },
    { id: 'e10', accountId: 'mcb', date: '2026-10-25', direction: 'in', amount: 33000, type: 'deposit', refNo: null, note: null },
]

/** Temporary: pads the mock data so long lists, scrolling and paging can be checked. Set to `false` to remove. */
const LOAD_TEST = true

const extraBanks: [string, string][] = [
    ['Allied Bank', '2201'], ['UBL Current', '3310'], ['Bank Alfalah', '4482'], ['Faysal Bank', '5513'],
    ['Standard Chartered', '6624'], ['Askari Bank', '7735'], ['Habib Metro', '8846'], ['Soneri Bank', '9957'],
    ['Bank of Punjab', '1068'], ['JS Bank', '2179'],
]

const counts: Record<string, number> = { cash: 120, hbl: 400, meezan: 150, mcb: 150 }

function loadTestEntries(accounts: Account[]): LedgerEntry[] {
    let seed = 7
    const next = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const pick = <T,>(items: T[]) => items[Math.floor(next() * items.length)]
    const inTypes = ['deposit', 'customerPayment', 'otherReceipt'] as const
    const outTypes = ['supplierPayment', 'expense', 'otherPayment'] as const
    const notes = ['Truck payment', 'Worker advance', 'Electricity bill', 'Tea and lunch', 'Cheque cleared', 'Cash sale', 'Spare parts', 'Water tanker']
    const start = Date.UTC(2026, 8, 2)
    const rows: LedgerEntry[] = []

    for (const account of accounts) {
        const count = counts[account.id] ?? 40
        for (let i = 0; i < count; i++) {
            const direction = next() < 0.45 ? 'in' : 'out'
            const day = new Date(start + Math.floor(next() * 63) * 86_400_000)
            rows.push({
                id: `g-${account.id}-${i}`,
                accountId: account.id,
                date: day.toISOString().slice(0, 10),
                direction,
                amount: Math.round((1000 + next() * 249000) / 500) * 500,
                type: direction === 'in' ? pick([...inTypes]) : pick([...outTypes]),
                refNo: next() < 0.4 ? `Bill ${1000 + Math.floor(next() * 900)}` : null,
                note: next() < 0.7 ? pick(notes) : null,
            })
        }
    }
    return rows
}

export const accountsSeed: Account[] = LOAD_TEST
    ? [
          ...baseAccounts,
          ...extraBanks.map(([name, last4], i): Account => ({
              id: `bank-${i}`, kind: 'bank', name, last4, openingBalance: 2000000, openingDate: '2026-09-01', isActive: true,
          })),
      ]
    : baseAccounts

export const entriesSeed: LedgerEntry[] = LOAD_TEST
    ? [...baseEntries, ...loadTestEntries(accountsSeed)]
    : baseEntries
