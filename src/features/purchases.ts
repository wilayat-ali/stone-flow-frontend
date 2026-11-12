import { ApiError } from '@/lib/client-api'
import { postSupplierEntry } from './suppliers'

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

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

// In-memory stand-in for the backend; replace with `request()` calls like `features/admin/members.ts`.
// The mark sequence continues forever per factory and never resets.
const counters = new Map<string, number>([
    ['main', 19],
    ['north-yard', 7],
])

const seed = (
    id: string,
    date: string,
    supplierId: string,
    supplierName: string,
    material: string,
    purchiNo: string,
    truckNo: string,
    tons: number,
    ratePerTon: number,
    discount: number,
    stones: number,
    factoryId: string,
    factoryName: string,
    markSeq: number | null,
    status: PurchaseStatus,
    createdBy = 'Wilayat Ali'
): Purchase => ({
    id,
    date,
    supplierId,
    supplierName,
    material,
    purchiNo,
    truckNo,
    tons,
    ratePerTon,
    discount,
    total: totalOf(tons, ratePerTon, discount),
    stones,
    factoryId,
    factoryName,
    markSeq,
    mark: markSeq ? `${markSeq}/${stones}` : null,
    status,
    note: '',
    reason: null,
    createdBy,
    approvedBy: status === 'pending' ? null : 'Wilayat Ali',
    createdAt: `${date}T09:00:00.000Z`,
    ...noCutting,
})

let purchases: Purchase[] = [
    seed('p1', '2026-09-12', 's1', 'Haji Gul Khan', 'Ziarat White (rough)', '7720', 'TKR-219', 21.4, 6800, 520, 3, 'main', 'Saadat Marble — Main Factory', 16, 'cut'),
    seed('p2', '2026-09-24', 's3', 'Sher Zaman', 'Jet Black (rough)', '1190', 'PSA-4471', 24.6, 9000, 1400, 4, 'main', 'Saadat Marble — Main Factory', 17, 'cutting'),
    seed('p3', '2026-09-30', 's1', 'Haji Gul Khan', 'Ziarat White (rough)', '7791', 'TKR-305', 22, 7000, 0, 3, 'main', 'Saadat Marble — Main Factory', 18, 'in_stock'),
    seed('p4', '2026-10-05', 's3', 'Sher Zaman', 'Jet Black (rough)', '1204', 'PSA-5102', 15.2, 9000, 800, 2, 'north-yard', 'North Yard', 7, 'in_stock'),
    seed('p5', '2026-10-08', 's1', 'Haji Gul Khan', 'Ziarat White (rough)', '7810', 'TKR-341', 23.1, 7000, 1700, 4, 'main', 'Saadat Marble — Main Factory', 19, 'in_stock'),
    seed('p7', '2026-10-06', 's2', 'Arshad Khan', 'Sunny Grey (rough)', '3342', 'LES-912', 20.5, 6500, 250, 3, 'khan-cutting', 'Khan Cutting Works', null, 'in_stock'),
    seed('p6', '2026-10-10', 's2', 'Arshad Khan', 'Sunny Grey (rough)', '3360', 'LES-947', 19.8, 6600, 680, 3, 'main', 'Saadat Marble — Main Factory', null, 'pending', 'Rashid Khan'),
]

/** Synchronous view for the payments and production mocks. */
export const allPurchases = () => purchases

/** Production (05a) moves a truck through cutting; it never edits the purchase itself. */
export const patchPurchase = (id: string, patch: Partial<Purchase>): Purchase => {
    const current = purchases.find((p) => p.id === id)
    if (!current) throw new ApiError(404, { code: 'notFound' })
    const next = { ...current, ...patch }
    purchases = purchases.map((p) => (p.id === id ? next : p))
    return next
}

// Trucks the seed has already sent to a machine.
purchases = purchases.map((p) =>
    p.id === 'p1'
        ? { ...p, machineId: 'vertical-1', machineName: 'Vertical Cutter 1', thekadarId: 'w-rashid', thekadarName: 'Rashid Khan', cutStart: '2026-09-15', cutEnd: '2026-09-22', cutRatePerTon: 1100 }
        : p.id === 'p2'
          ? { ...p, machineId: 'gangsaw-1', machineName: 'Gang Saw 1', thekadarId: 'w-shahid', thekadarName: 'Shahid Pervez', cutStart: '2026-10-06', cutEnd: null, cutRatePerTon: null }
          : p
)

const find = (id: string) => {
    const purchase = purchases.find((p) => p.id === id)
    if (!purchase) throw new ApiError(404, { code: 'notFound' })
    return purchase
}

const replace = (next: Purchase) => {
    purchases = purchases.map((p) => (p.id === next.id ? next : p))
    return next
}

/** Newest first; oldest first when looking at trucks waiting in the yard. */
export const listPurchases = async (filters: PurchaseFilters = {}): Promise<Purchase[]> => {
    await delay()
    const rows = purchases.filter(
        (p) =>
            (!filters.status || p.status === filters.status) &&
            (!filters.supplierId || p.supplierId === filters.supplierId) &&
            (!filters.factoryId || p.factoryId === filters.factoryId) &&
            (!filters.ageDays || (p.status === 'in_stock' && daysSince(p.date) >= filters.ageDays))
    )
    const oldestFirst = filters.status === 'in_stock' || !!filters.ageDays
    return rows.sort(
        (a, b) => (oldestFirst ? 1 : -1) * (a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    )
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

const assertNotDuplicate = (input: PurchaseInput, exceptId?: string) => {
    const same = purchases.some(
        (p) =>
            p.id !== exceptId &&
            p.supplierId === input.supplierId &&
            p.purchiNo === input.purchiNo &&
            !['rejected', 'cancelled'].includes(p.status)
    )
    if (same) throw new ApiError(409, { code: 'DUPLICATE_PURCHI' })
}

/** Posts the supplier charge and takes the next mark; only ever called when an entry is approved. */
const approveNow = (purchase: Purchase, approvedBy: string): Purchase => {
    const seq = (counters.get(purchase.factoryId) ?? 0) + 1
    counters.set(purchase.factoryId, seq)
    postSupplierEntry({
        supplierId: purchase.supplierId,
        date: purchase.date,
        kind: 'charge',
        amount: purchase.total,
        detail: `Truck ${seq}/${purchase.stones} · purchi ${purchase.purchiNo}`,
    })
    return { ...purchase, markSeq: seq, mark: `${seq}/${purchase.stones}`, status: 'in_stock', approvedBy }
}

/**
 * A munshi's purchase waits as `pending` (no charge, no mark) when approval is on; anyone else's
 * is approved straight away.
 */
export const createPurchase = async (
    input: PurchaseInput,
    options: { pending: boolean; by: string }
): Promise<Purchase> => {
    await delay()
    assertNotDuplicate(input)
    const purchase: Purchase = {
        ...input,
        id: crypto.randomUUID(),
        total: totalOf(input.tons, input.ratePerTon, input.discount),
        markSeq: null,
        mark: null,
        status: 'pending',
        reason: null,
        createdBy: options.by,
        approvedBy: null,
        createdAt: new Date().toISOString(),
        ...noCutting,
    }
    const saved = options.pending ? purchase : approveNow(purchase, options.by)
    purchases = [...purchases, saved]
    return saved
}

/**
 * Only while pending or in stock. A stock truck's charge is corrected with a reversal row plus a
 * new charge, never by editing the old row.
 */
export const updatePurchase = async (id: string, input: PurchaseInput): Promise<Purchase> => {
    await delay()
    const current = find(id)
    if (current.status !== 'pending' && current.status !== 'in_stock') {
        throw new ApiError(409, { code: 'NOT_EDITABLE' })
    }
    assertNotDuplicate(input, id)
    const total = totalOf(input.tons, input.ratePerTon, input.discount)
    if (current.status === 'in_stock') {
        const detail = `Truck ${current.mark} · purchi ${input.purchiNo}`
        postSupplierEntry({ supplierId: current.supplierId, date: today(), kind: 'credit', amount: current.total, detail: `Reversal · ${detail}` })
        postSupplierEntry({ supplierId: input.supplierId, date: input.date, kind: 'charge', amount: total, detail })
    }
    return replace({
        ...current,
        ...input,
        total,
        mark: current.markSeq ? `${current.markSeq}/${input.stones}` : null,
    })
}

export const approvePurchase = async (id: string, by: string): Promise<Purchase> => {
    await delay()
    const current = find(id)
    if (current.status !== 'pending') throw new ApiError(409, { code: 'ALREADY_DECIDED' })
    return replace(approveNow(current, by))
}

export const rejectPurchase = async (id: string, reason: string, by: string): Promise<Purchase> => {
    await delay()
    const current = find(id)
    if (current.status !== 'pending') throw new ApiError(409, { code: 'ALREADY_DECIDED' })
    return replace({ ...current, status: 'rejected', reason, approvedBy: by })
}

/** Only before cutting starts. The charge comes off the khata as a reversal row. */
export const cancelPurchase = async (id: string, reason: string): Promise<Purchase> => {
    await delay()
    const current = find(id)
    if (current.status !== 'in_stock') throw new ApiError(409, { code: 'CANCEL_AFTER_CUTTING' })
    postSupplierEntry({
        supplierId: current.supplierId,
        date: today(),
        kind: 'credit',
        amount: current.total,
        detail: `Cancelled · truck ${current.mark} · purchi ${current.purchiNo}`,
    })
    return replace({ ...current, status: 'cancelled', reason })
}
