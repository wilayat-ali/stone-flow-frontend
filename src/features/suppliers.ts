import { request } from '@/lib/client-api'

const base = '/api/suppliers'

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

/** A row another module (still a mock) posted to a supplier's khata; the real rows come from the backend. */
type LocalEntry = {
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

// Purchases, payments, expenses and production are not on the backend yet and post here instead of to the
// party ledger. They are added to the real figures below, and go away as each of those modules is integrated.
const localEntries: LocalEntry[] = []

/** The last list the backend gave, for the checks that must answer at once (duplicate name). */
let known: SupplierSummary[] = []

const withLocal = (supplier: SupplierSummary): SupplierSummary => {
    const own = localEntries.filter((e) => e.supplierId === supplier.id)
    if (own.length === 0) return supplier
    const sumOf = (kind: LocalEntry['kind']) => own.filter((e) => e.kind === kind).reduce((total, e) => total + e.amount, 0)
    const charged = supplier.charged + sumOf('charge')
    const paid = supplier.paid + sumOf('credit')
    return {
        ...supplier,
        charged,
        paid,
        balance: charged - paid,
        unclearedCheques: supplier.unclearedCheques + own.filter((e) => e.unclearedCheque).reduce((total, e) => total + e.amount, 0),
    }
}

export const listSuppliers = async (filters: SupplierFilters = {}): Promise<SupplierSummary[]> => {
    const all = (await request<SupplierSummary[]>(base)).map(withLocal)
    known = all
    return all.filter(
        (s) =>
            (!filters.type || s.type === filters.type) &&
            (!filters.balance || (filters.balance === 'owe' ? s.balance > 0 : s.balance < 0))
    )
}

/** Opening row first, then every row by date, with the running balance. */
export const getKhata = async (supplierId: string): Promise<KhataRow[]> => {
    const rows = await request<KhataRow[]>(`${base}/${supplierId}/khata`)
    const opening = rows.find((r) => r.id.startsWith('opening-'))
    const local: KhataRow[] = localEntries
        .filter((e) => e.supplierId === supplierId)
        .map((e) => ({ id: e.id, date: e.date, detail: e.detail, kind: e.kind, amount: e.amount, balance: 0, unclearedCheque: !!e.unclearedCheque }))
    if (local.length === 0) return rows

    let balance = opening?.balance ?? 0
    const rest = [...rows.filter((r) => r !== opening), ...local].sort((a, b) => a.date.localeCompare(b.date))
    return [
        ...(opening ? [opening] : []),
        ...rest.map((row) => {
            balance += row.kind === 'charge' ? row.amount : -row.amount
            return { ...row, balance }
        }),
    ]
}

/** What the add/edit sheet sends; the cutting rate only applies to cutting factories. */
export type SupplierInput = Pick<
    Supplier,
    'name' | 'type' | 'business' | 'phone' | 'city' | 'cuttingRatePerTon' | 'openingBalance' | 'openingDate'
>

/** Soft warning only: two suppliers may share a name, but it is usually a mistake. */
export const nameExists = (name: string, exceptId?: string) =>
    known.some((s) => s.id !== exceptId && s.name.trim().toLowerCase() === name.trim().toLowerCase())

export const createSupplier = (input: SupplierInput) => request<Supplier>(base, { body: input })

export const updateSupplier = (id: string, input: Partial<SupplierInput> & { isActive?: boolean }) =>
    request<Supplier>(`${base}/${id}`, { method: 'PATCH', body: input })

/**
 * Posts a row to a supplier's khata, for a module that is not on the backend yet (an approved truck purchase,
 * a cutting charge, a payment). Replaced by the backend's party ledger as each module is integrated.
 */
export const postSupplierEntry = (entry: Omit<LocalEntry, 'id'>) => {
    localEntries.push({ id: crypto.randomUUID(), ...entry })
}

/** The cutting-factory supplier that stands for a Settings factory of the same name (04a: one record, not two). */
export const findCuttingFactorySupplier = async (factoryName: string) =>
    (await listSuppliers()).find(
        (s) => s.type === 'cutting_factory' && s.isActive && s.name.trim().toLowerCase() === factoryName.trim().toLowerCase()
    )
