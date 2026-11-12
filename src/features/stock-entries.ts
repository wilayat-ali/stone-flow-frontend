import { ApiError } from '@/lib/client-api'
import { postMovement, stockOnHand, type EntryLine, type StockItem } from './production-entries'

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

export const stockEntryTypes = ['opening', 'adjustment', 'transfer'] as const
export type StockEntryType = (typeof stockEntryTypes)[number]

export const adjustmentReasons = ['broken', 'mismatch', 'other'] as const
export type AdjustmentReason = (typeof adjustmentReasons)[number]

export type StockEntryStatus = 'pending' | 'approved' | 'rejected'

/**
 * The only way to change stock outside production and sales, always with a reason and a name:
 * opening stock (owner only), an adjustment up or down, or a transfer between two of our factories.
 */
export type StockEntry = {
    id: string
    entryNo: string
    type: StockEntryType
    date: string
    /** `1` adds, `-1` removes; adjustments only (opening always adds, a transfer moves). */
    direction: 1 | -1
    reason: AdjustmentReason | null
    note: string
    item: StockItem
    qty: number
    /** Total inches; counters only. */
    inches: number
    factoryName: string
    /** A transfer's destination. */
    toFactoryId: string | null
    toFactoryName: string | null
    status: StockEntryStatus
    rejectReason: string | null
    createdBy: string
    approvedBy: string | null
}

export type StockEntryInput = {
    type: StockEntryType
    date: string
    direction: 1 | -1
    reason: AdjustmentReason | null
    note: string
    item: StockItem
    qty: number
    inches: number
    factoryName: string
    toFactoryId: string | null
    toFactoryName: string | null
}

export type StockEntryFilters = { type?: StockEntryType; status?: StockEntryStatus }

export const stockEntriesQueryKey = 'stock-entries'

const today = () => new Date().toISOString().slice(0, 10)

// In-memory stand-in for the backend; replace with `request()` calls like `features/admin/members.ts`.
// SE-001's movement is already in the stock (production-entries seeds it); SE-002 waits for the owner.
let entries: StockEntry[] = [
    {
        id: 'se1',
        entryNo: 'SE-001',
        type: 'adjustment',
        date: '2026-10-06',
        direction: -1,
        reason: 'broken',
        note: '2 pieces cracked while loading',
        item: { itemType: 'piece', material: 'Ziarat White', factoryId: 'main', soot: '14', size: '12x61', finish: 'unpolished' },
        qty: 2,
        inches: 0,
        factoryName: 'Saadat Marble — Main Factory',
        toFactoryId: null,
        toFactoryName: null,
        status: 'approved',
        rejectReason: null,
        createdBy: 'Rashid Khan',
        approvedBy: 'Wilayat Ali',
    },
    {
        id: 'se2',
        entryNo: 'SE-002',
        type: 'adjustment',
        date: '2026-10-09',
        direction: -1,
        reason: 'mismatch',
        note: 'Yard count shows 56, system 60',
        item: { itemType: 'piece', material: 'Ziarat White', factoryId: 'main', soot: '14', size: '12x12', finish: 'unpolished' },
        qty: 4,
        inches: 0,
        factoryName: 'Saadat Marble — Main Factory',
        toFactoryId: null,
        toFactoryName: null,
        status: 'pending',
        rejectReason: null,
        createdBy: 'Rashid Khan',
        approvedBy: null,
    },
]

let seq = 2

const find = (id: string) => {
    const entry = entries.find((e) => e.id === id)
    if (!entry) throw new ApiError(404, { code: 'notFound' })
    return entry
}

/** What this entry does to stock, in the same line form production uses (`in` out, `out` in). */
const linesOf = (e: Pick<StockEntry, 'type' | 'direction' | 'item' | 'qty' | 'inches' | 'toFactoryId'>): EntryLine[] => {
    const base = { qty: e.qty, inches: e.inches }
    if (e.type === 'transfer' && e.toFactoryId) {
        return [
            { direction: 'in', item: e.item, ...base },
            { direction: 'out', item: { ...e.item, factoryId: e.toFactoryId }, ...base },
        ]
    }
    const adds = e.type === 'opening' || e.direction === 1
    return [{ direction: adds ? 'out' : 'in', item: e.item, ...base }]
}

/** Removing or transferring more than is on hand is refused, and checked again at approval. */
const assertOnHand = (e: Pick<StockEntry, 'type' | 'direction' | 'item' | 'qty' | 'inches'>) => {
    const removes = e.type === 'transfer' || (e.type === 'adjustment' && e.direction === -1)
    if (!removes) return
    const have = stockOnHand(e.item)
    if (e.qty > have.qty) throw new ApiError(409, { code: 'INSUFFICIENT_STOCK', available: have.qty })
    if (e.item.itemType === 'counter' && e.inches > have.inches) {
        throw new ApiError(409, { code: 'INSUFFICIENT_INCHES', available: have.inches })
    }
}

export const listStockEntries = async (filters: StockEntryFilters = {}): Promise<StockEntry[]> => {
    await delay()
    return entries
        .filter((e) => (!filters.type || e.type === filters.type) && (!filters.status || e.status === filters.status))
        .sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1) || b.date.localeCompare(a.date) || b.entryNo.localeCompare(a.entryNo))
}

/**
 * Opening stock is the owner's alone. A munshi's entry waits as `pending` (no effect on stock) when
 * approval is on; anyone else's is approved at once and posts its movement.
 */
export const createStockEntry = async (
    input: StockEntryInput,
    options: { pending: boolean; by: string; roleKey: string }
): Promise<StockEntry> => {
    await delay()
    if (input.type === 'opening' && options.roleKey !== 'owner') throw new ApiError(403, { code: 'OPENING_OWNER_ONLY' })
    if (input.date > today()) throw new ApiError(400, { code: 'DATE_IN_FUTURE' })
    if (!(input.qty > 0)) throw new ApiError(400, { code: 'QTY_REQUIRED' })
    if (input.item.itemType === 'counter' && !(input.inches > 0)) throw new ApiError(400, { code: 'INCHES_REQUIRED' })
    if (input.type === 'adjustment' && input.reason === 'other' && !input.note.trim()) throw new ApiError(400, { code: 'NOTE_REQUIRED' })
    if (input.type === 'transfer' && (!input.toFactoryId || input.toFactoryId === input.item.factoryId)) {
        throw new ApiError(400, { code: 'SAME_FACTORY' })
    }
    assertOnHand(input)

    seq += 1
    const entry: StockEntry = {
        ...input,
        id: crypto.randomUUID(),
        entryNo: `SE-${String(seq).padStart(3, '0')}`,
        status: options.pending ? 'pending' : 'approved',
        rejectReason: null,
        createdBy: options.by,
        approvedBy: options.pending ? null : options.by,
    }
    entries = [...entries, entry]
    if (entry.status === 'approved') postMovement({ id: entry.id, date: entry.date, entryNo: entry.entryNo, lines: linesOf(entry) })
    return entry
}

/** Approving checks the stock again: it may have been used since the entry was made. */
export const approveStockEntry = async (id: string, by: string): Promise<StockEntry> => {
    await delay()
    const entry = find(id)
    if (entry.status !== 'pending') throw new ApiError(409, { code: 'ALREADY_DECIDED' })
    assertOnHand(entry)
    const approved = { ...entry, status: 'approved' as const, approvedBy: by }
    entries = entries.map((e) => (e.id === id ? approved : e))
    postMovement({ id: entry.id, date: entry.date, entryNo: entry.entryNo, lines: linesOf(entry) })
    return approved
}

export const rejectStockEntry = async (id: string, reason: string, by: string): Promise<StockEntry> => {
    await delay()
    const entry = find(id)
    if (entry.status !== 'pending') throw new ApiError(409, { code: 'ALREADY_DECIDED' })
    const rejected = { ...entry, status: 'rejected' as const, rejectReason: reason, approvedBy: by }
    entries = entries.map((e) => (e.id === id ? rejected : e))
    return rejected
}

export const pendingStockEntries = () => entries.filter((e) => e.status === 'pending')
