import { ApiError } from '@/lib/client-api'

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

export const supplierTypes = ['mine_owner', 'cutting_factory', 'shop'] as const

export type SupplierType = (typeof supplierTypes)[number]

export type Supplier = {
    id: string
    name: string
    type: SupplierType
    /** Quarry, workshop or shop name. */
    business: string
    /** WhatsApp number; unique per company. */
    phone: string
    city: string
    /** PKR per ton; cutting factories only. */
    cuttingRatePerTon: number | null
    /** What we already owed (positive) or had paid ahead (negative) before StoneFlow. */
    openingBalance: number
    /** `YYYY-MM-DD` */
    openingDate: string
    isActive: boolean
}

/** A supplier with its figures, calculated from the khata rows (never stored). */
export type SupplierSummary = Supplier & {
    /** Truck purchases, cutting charges, shop bills and bounced cheques put back. */
    charged: number
    paid: number
    /** Positive: we owe them. Negative: we paid more than we owed (an advance). */
    balance: number
    /** Cheques given but not yet cleared; they come back as owed if they bounce. */
    unclearedCheques: number
}

export type KhataRow = {
    id: string
    date: string
    detail: string
    /** `charge` adds to what we owe, `credit` (a payment) reduces it. */
    kind: 'charge' | 'credit'
    amount: number
    /** Running balance after this row. */
    balance: number
    unclearedCheque: boolean
}

export type SupplierFilters = { type?: SupplierType; balance?: 'owe' | 'advance' }

export const suppliersQueryKey = 'suppliers'
export const khataQueryKey = 'supplier-khata'

type Entry = {
    id: string
    supplierId: string
    date: string
    kind: 'charge' | 'credit'
    amount: number
    detail: string
    unclearedCheque?: boolean
    /** The payment or purchase that caused this row, so a later step can find it. */
    sourceId?: string
}

// In-memory stand-in for the backend; replace with `request()` calls like `features/admin/members.ts`.
// Khata rows really live in the party ledger (03a); they are seeded here so the screen has something to show.
let suppliers: Supplier[] = [
    {
        id: 's1',
        name: 'Haji Gul Khan',
        type: 'mine_owner',
        business: 'Ziarat Marble Mines',
        phone: '0333-7812345',
        city: 'Ziarat',
        cuttingRatePerTon: null,
        openingBalance: 120000,
        openingDate: '2026-09-01',
        isActive: true,
    },
    {
        id: 's2',
        name: 'Arshad Khan',
        type: 'mine_owner',
        business: 'Pak Marble Traders',
        phone: '0301-5566778',
        city: 'Mohmand',
        cuttingRatePerTon: null,
        openingBalance: 0,
        openingDate: '2026-09-01',
        isActive: true,
    },
    {
        id: 's3',
        name: 'Sher Zaman',
        type: 'mine_owner',
        business: 'Bajaur Black Quarry',
        phone: '0345-9081123',
        city: 'Bajaur',
        cuttingRatePerTon: null,
        openingBalance: 0,
        openingDate: '2026-09-01',
        isActive: true,
    },
    {
        id: 's4',
        name: 'Al-Madina Marble Cutting',
        type: 'cutting_factory',
        business: 'Ustad Rafiq',
        phone: '0300-2299451',
        city: 'Hub, Balochistan',
        cuttingRatePerTon: 1500,
        openingBalance: 0,
        openingDate: '2026-09-01',
        isActive: true,
    },
    {
        id: 's6',
        name: 'Khan Cutting Works',
        type: 'cutting_factory',
        business: 'Cutting for hire',
        phone: '0302-7788991',
        city: 'Karachi',
        cuttingRatePerTon: 350,
        openingBalance: 0,
        openingDate: '2026-09-01',
        isActive: true,
    },
    {
        id: 's5',
        name: 'Madina Machinery Store',
        type: 'shop',
        business: 'Spare parts',
        phone: '0321-2456789',
        city: 'Karachi',
        cuttingRatePerTon: null,
        openingBalance: 0,
        openingDate: '2026-09-01',
        isActive: true,
    },
]

const entries: Entry[] = [
    { id: 'e1', supplierId: 's1', date: '2026-09-12', kind: 'charge', amount: 142000, detail: 'Truck 16/3 · purchi 7720' },
    { id: 'e2', supplierId: 's1', date: '2026-09-12', kind: 'credit', amount: 145000, detail: 'Payment at purchase' },
    { id: 'e3', supplierId: 's1', date: '2026-09-30', kind: 'charge', amount: 154000, detail: 'Truck 18/3 · purchi 7791' },
    { id: 'e4', supplierId: 's1', date: '2026-10-08', kind: 'credit', amount: 160000, detail: 'Cheque no. 445125 · HBL', unclearedCheque: true, sourceId: 'pay2' },
    { id: 'e5', supplierId: 's2', date: '2026-09-18', kind: 'charge', amount: 117000, detail: 'Truck 4/2 · purchi 3315' },
    { id: 'e6', supplierId: 's2', date: '2026-09-18', kind: 'credit', amount: 117000, detail: 'Bank transfer · MCB' },
    { id: 'e7', supplierId: 's2', date: '2026-10-02', kind: 'charge', amount: 133250, detail: 'Truck 5/3 · purchi 3342' },
    { id: 'e8', supplierId: 's3', date: '2026-09-24', kind: 'charge', amount: 220000, detail: 'Truck 17/4 · purchi 1190' },
    { id: 'e9', supplierId: 's3', date: '2026-10-03', kind: 'credit', amount: 300000, detail: 'Bank transfer · HBL' },
    { id: 'e10', supplierId: 's4', date: '2026-09-26', kind: 'charge', amount: 27000, detail: 'Cutting · truck 4/2' },
    { id: 'e11', supplierId: 's4', date: '2026-10-01', kind: 'credit', amount: 15000, detail: 'Cash' },
    { id: 'e12', supplierId: 's5', date: '2026-10-03', kind: 'charge', amount: 26500, detail: 'Polishing pads and bricks' },
]

const byDate = (a: Entry, b: Entry) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)

/** Opening balance first, then every row with the running balance. */
const khataOf = (supplier: Supplier): KhataRow[] => {
    let balance = supplier.openingBalance
    const rows: KhataRow[] =
        supplier.openingBalance === 0
            ? []
            : [
                  {
                      id: `opening-${supplier.id}`,
                      date: supplier.openingDate,
                      detail: 'opening',
                      kind: supplier.openingBalance > 0 ? 'charge' : 'credit',
                      amount: Math.abs(supplier.openingBalance),
                      balance,
                      unclearedCheque: false,
                  },
              ]
    for (const entry of entries.filter((e) => e.supplierId === supplier.id).sort(byDate)) {
        balance += entry.kind === 'charge' ? entry.amount : -entry.amount
        rows.push({
            id: entry.id,
            date: entry.date,
            detail: entry.detail,
            kind: entry.kind,
            amount: entry.amount,
            balance,
            unclearedCheque: !!entry.unclearedCheque,
        })
    }
    return rows
}

const summarise = (supplier: Supplier): SupplierSummary => {
    const own = entries.filter((e) => e.supplierId === supplier.id)
    const sumOf = (kind: Entry['kind']) => own.filter((e) => e.kind === kind).reduce((s, e) => s + e.amount, 0)
    const charged = sumOf('charge') + Math.max(supplier.openingBalance, 0)
    const paid = sumOf('credit') + Math.max(-supplier.openingBalance, 0)
    return {
        ...supplier,
        charged,
        paid,
        balance: charged - paid,
        unclearedCheques: own.filter((e) => e.unclearedCheque).reduce((s, e) => s + e.amount, 0),
    }
}

export const listSuppliers = async (filters: SupplierFilters = {}): Promise<SupplierSummary[]> => {
    await delay()
    return suppliers
        .map(summarise)
        .filter(
            (s) =>
                (!filters.type || s.type === filters.type) &&
                (!filters.balance || (filters.balance === 'owe' ? s.balance > 0 : s.balance < 0))
        )
}

export const getKhata = async (supplierId: string): Promise<KhataRow[]> => {
    await delay(250)
    const supplier = suppliers.find((s) => s.id === supplierId)
    if (!supplier) throw new ApiError(404, { code: 'notFound' })
    return khataOf(supplier)
}

/** What the add/edit sheet sends; the cutting rate only applies to cutting factories. */
export type SupplierInput = Pick<
    Supplier,
    'name' | 'type' | 'business' | 'phone' | 'city' | 'cuttingRatePerTon' | 'openingBalance' | 'openingDate'
>

/** Digits only, so `0333-7812345` and `03337812345` count as the same number. */
const digits = (phone: string) => phone.replace(/\D/g, '')

const assertPhoneFree = (phone: string, exceptId?: string) => {
    if (suppliers.some((s) => s.id !== exceptId && digits(s.phone) === digits(phone))) {
        throw new ApiError(409, { code: 'DUPLICATE_PHONE' })
    }
}

/** Soft warning only: two suppliers may share a name, but it is usually a mistake. */
export const nameExists = (name: string, exceptId?: string) =>
    suppliers.some((s) => s.id !== exceptId && s.name.trim().toLowerCase() === name.trim().toLowerCase())

const clean = (input: SupplierInput): SupplierInput => ({
    ...input,
    cuttingRatePerTon: input.type === 'cutting_factory' ? input.cuttingRatePerTon : null,
})

export const createSupplier = async (input: SupplierInput): Promise<Supplier> => {
    await delay()
    assertPhoneFree(input.phone)
    const supplier: Supplier = { ...clean(input), id: crypto.randomUUID(), isActive: true }
    suppliers = [...suppliers, supplier]
    return supplier
}

export const updateSupplier = async (
    id: string,
    input: Partial<SupplierInput> & { isActive?: boolean }
): Promise<Supplier> => {
    await delay()
    const current = suppliers.find((s) => s.id === id)
    if (!current) throw new ApiError(404, { code: 'notFound' })
    if (input.phone) assertPhoneFree(input.phone, id)
    const next = { ...current, ...input }
    const updated: Supplier = {
        ...next,
        cuttingRatePerTon: next.type === 'cutting_factory' ? next.cuttingRatePerTon : null,
    }
    suppliers = suppliers.map((s) => (s.id === id ? updated : s))
    return updated
}

/**
 * Posts a row to a supplier's khata, for the module that caused it (an approved truck purchase,
 * a cutting charge, a payment). Stand-in for the party ledger service in 03a.
 */
export const postSupplierEntry = (entry: {
    supplierId: string
    date: string
    kind: 'charge' | 'credit'
    amount: number
    detail: string
    unclearedCheque?: boolean
    sourceId?: string
}) => {
    entries.push({ id: crypto.randomUUID(), ...entry })
}

/** A cheque cleared: its payment row stops showing as uncleared. */
export const markSupplierChequeCleared = (sourceId: string) => {
    for (const entry of entries) if (entry.sourceId === sourceId) entry.unclearedCheque = false
}

/** The cutting-factory supplier that stands for a Settings factory of the same name (04a: one record, not two). */
export const findCuttingFactorySupplier = (factoryName: string) =>
    suppliers.find(
        (s) =>
            s.type === 'cutting_factory' &&
            s.isActive &&
            s.name.trim().toLowerCase() === factoryName.trim().toLowerCase()
    )
