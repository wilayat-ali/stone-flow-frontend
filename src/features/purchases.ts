import { ApiError, request } from '@/lib/client-api'

/** `cutting` and `cut` are set by Production (05a); this module only reads them. */
export const purchaseStatuses = ['pending', 'in_stock', 'cutting', 'cut', 'rejected', 'cancelled'] as const

export type PurchaseStatus = (typeof purchaseStatuses)[number]

export type Purchase = {
    id: string
    /** Business date, separate from `createdAt`. `YYYY-MM-DD` */
    date: string
    supplierId: string
    supplierName: string
    material: string
    /** Number on the kanta purchi from the mine owner. */
    purchiNo: string
    truckNo: string
    /** Tons on the purchi, 2 decimals. */
    tons: number
    /** PKR per ton, as written on the purchi. */
    ratePerTon: number
    discount: number
    /** `tons × ratePerTon − discount`, whole rupees. */
    total: number
    /** Usually 2 to 5. */
    stones: number
    factoryId: string
    factoryName: string
    /** Taken from the factory's own counter when the purchase is approved, so rejected trucks waste none. */
    markSeq: number | null
    /** `seq/stones`, e.g. `20/3`: what the munshi paints on every stone. */
    mark: string | null
    status: PurchaseStatus
    note: string
    /** Why it was rejected or cancelled. */
    reason: string | null
    createdBy: string
    approvedBy: string | null
    createdAt: string
    /** Set when Production sends the truck to one of our machines (05a). */
    machineId: string | null
    machineName: string | null
    thekadarId: string | null
    thekadarName: string | null
    cutStart: string | null
    cutEnd: string | null
    cutRatePerTon: number | null
}

/** The cutting fields every truck starts with. */
export const noCutting = {
    machineId: null,
    machineName: null,
    thekadarId: null,
    thekadarName: null,
    cutStart: null,
    cutEnd: null,
    cutRatePerTon: null,
} as const

export type PurchaseFilters = {
    status?: PurchaseStatus
    supplierId?: string
    factoryId?: string
    /** Only trucks that have waited at least this many days. */
    ageDays?: number
}

export const purchasesQueryKey = 'purchases'

const base = '/api/purchases'

// Stand-in for the material list in Settings.
export const materials = [
    'Ziarat White (rough)',
    'Sunny Grey (rough)',
    'Jet Black (rough)',
    'Black Galaxy (rough)',
    'Carrara White (rough)',
]

export const grossOf = (tons: number, ratePerTon: number) => Math.round(tons * ratePerTon)

export const totalOf = (tons: number, ratePerTon: number, discount: number) =>
    Math.max(0, grossOf(tons, ratePerTon) - discount)

const today = () => new Date().toISOString().slice(0, 10)

export const daysSince = (date: string) =>
    Math.max(0, Math.round((new Date(today()).getTime() - new Date(date).getTime()) / 86_400_000))

// Production (still a mock) moves a truck through cutting. The backend only knows approved, in-stock trucks,
// so what Production changes is kept here on top of the real rows until Production is integrated.
const cuttingOverlay = new Map<string, Partial<Purchase>>()

/** The last list the backend gave, with Production's changes on top, for the mock modules that read it at once. */
let known: Purchase[] = []

const withOverlay = (purchase: Purchase): Purchase => ({ ...purchase, ...cuttingOverlay.get(purchase.id) })

const remember = (purchase: Purchase) => {
    const next = withOverlay(purchase)
    known = known.some((p) => p.id === next.id) ? known.map((p) => (p.id === next.id ? next : p)) : [...known, next]
    return next
}

/** Synchronous view for the payments and production mocks (the last list loaded). */
export const allPurchases = () => known

/** Production (05a) moves a truck through cutting; it never edits the purchase itself. */
export const patchPurchase = (id: string, patch: Partial<Purchase>): Purchase => {
    const current = known.find((p) => p.id === id)
    if (!current) throw new ApiError(404, { code: 'notFound' })
    cuttingOverlay.set(id, { ...cuttingOverlay.get(id), ...patch })
    return remember(current)
}

/** Newest first; oldest first when looking at trucks waiting in the yard. */
export const listPurchases = async (filters: PurchaseFilters = {}): Promise<Purchase[]> => {
    known = (await request<Purchase[]>(base)).map(withOverlay)
    const rows = known.filter(
        (p) =>
            (!filters.status || p.status === filters.status) &&
            (!filters.supplierId || p.supplierId === filters.supplierId) &&
            (!filters.factoryId || p.factoryId === filters.factoryId) &&
            (!filters.ageDays || (p.status === 'in_stock' && daysSince(p.date) >= filters.ageDays))
    )
    const oldestFirst = filters.status === 'in_stock' || !!filters.ageDays
    return rows.sort((a, b) => (oldestFirst ? 1 : -1) * (a.date.localeCompare(b.date) || a.id.localeCompare(b.id)))
}

export type PurchaseInput = {
    date: string
    supplierId: string
    supplierName: string
    material: string
    purchiNo: string
    truckNo: string
    tons: number
    ratePerTon: number
    discount: number
    stones: number
    factoryId: string
    factoryName: string
    note: string
}

/** What the backend takes: names and totals are worked out there, never sent. */
const toBody = (input: PurchaseInput) => ({
    date: input.date,
    supplierId: input.supplierId,
    material: input.material,
    purchiNo: input.purchiNo,
    truckNo: input.truckNo,
    tons: input.tons,
    ratePerTon: input.ratePerTon,
    discount: input.discount,
    stones: input.stones,
    factoryId: input.factoryId,
    note: input.note,
})

/**
 * A munshi's purchase waits as `pending` (no charge, no mark) while approval is on; anyone else's is approved
 * straight away. The backend decides which, and posts the supplier charge.
 */
export const createPurchase = async (input: PurchaseInput): Promise<Purchase> =>
    remember(await request<Purchase>(base, { body: toBody(input) }))

/**
 * Only while pending or in stock. A stock truck's charge is corrected with a reversal row plus a
 * new charge, never by editing the old row.
 */
export const updatePurchase = async (id: string, input: PurchaseInput): Promise<Purchase> =>
    remember(await request<Purchase>(`${base}/${id}`, { method: 'PATCH', body: toBody(input) }))

export const approvePurchase = async (id: string): Promise<Purchase> =>
    remember(await request<Purchase>(`${base}/${id}/approve`, { method: 'POST', body: {} }))

export const rejectPurchase = async (id: string, reason: string): Promise<Purchase> =>
    remember(await request<Purchase>(`${base}/${id}/reject`, { body: { reason } }))

/** Only before cutting starts. The charge comes off the khata as a reversal row. */
export const cancelPurchase = async (id: string, reason: string): Promise<Purchase> =>
    remember(await request<Purchase>(`${base}/${id}/cancel`, { body: { reason } }))
