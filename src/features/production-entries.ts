import { ApiError } from '@/lib/client-api'
import { sqFtOfSize } from './piece-sizes'
import { allPurchases } from './purchases'
import { listWorkerRates } from './worker-rates'
import { postWorkEntry, reverseWorkEntries } from './work-entries'
import { workerById } from './workers'

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

export const entryTypes = ['cut', 'section', 'counter', 'resize', 'polish'] as const
export type EntryType = (typeof entryTypes)[number]

export type Finish = 'polished' | 'unpolished'

/**
 * One kind of stock. A piece has soot, size and finish; a counter has a width and finish (counted in
 * pieces and total inches); a slab has only material and factory. Polished and unpolished are separate.
 */
export type StockItem =
    | { itemType: 'piece'; material: string; factoryId: string; soot: string; size: string; finish: Finish }
    | { itemType: 'counter'; material: string; factoryId: string; width: number; finish: Finish }
    | { itemType: 'slab'; material: string; factoryId: string }

export type EntryLine = {
    direction: 'in' | 'out'
    item: StockItem
    qty: number
    /** Total inches; counters only. */
    inches: number
}

export type ProductionEntry = {
    id: string
    entryNo: string
    date: string
    type: EntryType
    factoryId: string
    factoryName: string
    material: string
    /** The truck, for a cutting-output entry. */
    purchaseId: string | null
    machineType: string | null
    workerId: string | null
    workerName: string | null
    workerRate: number
    workerAmount: number
    /** Input sq.ft − output sq.ft, for resize. */
    wasteSqft: number
    note: string
    status: 'posted' | 'reversed'
    lines: EntryLine[]
    createdBy: string
}

export type EntryInput = {
    type: EntryType
    date: string
    factoryId: string
    factoryName: string
    material: string
    purchaseId: string | null
    machineType: string | null
    workerId: string | null
    note: string
    lines: EntryLine[]
}

export type EntryFilters = { type?: EntryType; material?: string; factoryId?: string; from?: string; to?: string }

export const productionEntriesQueryKey = 'production-entries'

/** The job rate card names in Settings → Rates, by step. */
const rateCardJob: Record<Exclude<EntryType, 'cut'>, string> = {
    section: 'Section Operator',
    counter: 'Resizer',
    resize: 'Resizer',
    polish: 'Polisher',
}

const today = () => new Date().toISOString().slice(0, 10)

// ---------- stock ----------

export const itemKeyOf = (item: StockItem): string =>
    [
        item.itemType,
        item.material,
        item.factoryId,
        item.itemType === 'piece' ? item.soot : '',
        item.itemType === 'piece' ? item.size : '',
        item.itemType === 'counter' ? item.width : '',
        item.itemType === 'slab' ? '' : item.finish,
    ].join('|')

export const sqFtOf = (line: Pick<EntryLine, 'item' | 'qty' | 'inches'>): number => {
    if (line.item.itemType === 'piece') return sqFtOfSize(line.item.size) * line.qty
    if (line.item.itemType === 'counter') return (line.item.width * line.inches) / 144
    return 0
}

export const totalSqFt = (lines: EntryLine[], direction: EntryLine['direction']) =>
    lines.filter((l) => l.direction === direction).reduce((sum, l) => sum + sqFtOf(l), 0)

type StockRow = { item: StockItem; qty: number; inches: number }

/**
 * A change to stock that is not a production step: an approved stock entry (opening stock, an
 * adjustment, a transfer). Its lines follow the same rule as a production step's: `in` takes stock
 * out, `out` puts stock in.
 */
export type StockMovement = {
    id: string
    date: string
    entryNo: string
    lines: EntryLine[]
    /** A stock entry (the default) or stone given to a customer on a bill. */
    source?: 'stock_entry' | 'sale'
}

// Seed: the one approved sample adjustment (SE-001), two pieces broken while loading.
let movements: StockMovement[] = [
    {
        id: 'se1',
        date: '2026-10-06',
        entryNo: 'SE-001',
        lines: [
            {
                direction: 'in',
                item: { itemType: 'piece', material: 'Ziarat White', factoryId: 'main', soot: '14', size: '12x61', finish: 'unpolished' },
                qty: 2,
                inches: 0,
            },
        ],
    },
    {
        // G-001: ABC Builders collected all of bill B-0001 (40 pieces of 14 soot 12×24).
        id: 'g1',
        date: '2026-09-28',
        entryNo: 'G-001',
        source: 'sale',
        lines: [
            {
                direction: 'in',
                item: { itemType: 'piece', material: 'Ziarat White', factoryId: 'main', soot: '14', size: '12x24', finish: 'unpolished' },
                qty: 40,
                inches: 0,
            },
        ],
    },
]

/** Posts an approved stock entry's movement. The stock service refuses negative stock before this is called. */
export const postMovement = (movement: StockMovement) => {
    movements = [...movements, movement]
}

/** Stock is never stored: it is the sum of every posted entry's and approved movement's lines. */
const stockFrom = (entries: ProductionEntry[]): Map<string, StockRow> => {
    const map = new Map<string, StockRow>()
    const steps: { status: string; lines: EntryLine[] }[] = [
        ...entries.filter((e) => e.status === 'posted'),
        ...movements.map((m) => ({ status: 'posted', lines: m.lines })),
    ]
    for (const entry of steps) {
        for (const line of entry.lines) {
            const key = itemKeyOf(line.item)
            const row = map.get(key) ?? { item: line.item, qty: 0, inches: 0 }
            const sign = line.direction === 'in' ? -1 : 1
            row.qty += sign * line.qty
            row.inches += sign * line.inches
            map.set(key, row)
        }
    }
    return map
}

const sizes = (soot: string, ...list: [string, number][]): EntryLine[] =>
    list.map(([size, qty]) => ({
        direction: 'out',
        item: { itemType: 'piece', material: 'Ziarat White', factoryId: 'main', soot, size, finish: 'unpolished' },
        qty,
        inches: 0,
    }))

// In-memory stand-in for the backend; replace with `request()` calls like `features/admin/members.ts`.
// Posting really goes through the stock service (03b); here the stock is worked out from the entries.
let entries: ProductionEntry[] = [
    {
        id: 'pe1',
        entryNo: 'PE-0001',
        date: '2026-09-22',
        type: 'cut',
        factoryId: 'main',
        factoryName: 'Saadat Marble — Main Factory',
        material: 'Ziarat White',
        purchaseId: 'p1',
        machineType: 'vertical',
        workerId: null,
        workerName: null,
        workerRate: 0,
        workerAmount: 0,
        wasteSqft: 0,
        note: '',
        status: 'posted',
        lines: sizes('14', ['12x61', 40], ['12x55', 30], ['12x24', 180], ['12x12', 120], ['6x12', 80]),
        createdBy: 'Rashid Khan',
    },
]

let seq = 1

const find = (id: string) => {
    const entry = entries.find((e) => e.id === id)
    if (!entry) throw new ApiError(404, { code: 'notFound' })
    return entry
}

/** Synchronous view of stock for the entry form, which shows "in stock now" while you type. */
export const stockOnHand = (item: StockItem) => stockFrom(entries).get(itemKeyOf(item)) ?? { item, qty: 0, inches: 0 }

/** Everything currently in stock, for Inventory (06). */
export const stockRows = (): StockRow[] =>
    [...stockFrom(entries).values()].filter((r) => r.qty !== 0 || r.inches !== 0)

/** Materials that have stock or entries, for the pickers. */
export const stockedMaterials = () => [...new Set(entries.map((e) => e.material))]

/** A truck whose cutting output has been counted leaves "output to count". */
export const isCounted = (purchaseId: string) =>
    entries.some((e) => e.type === 'cut' && e.purchaseId === purchaseId && e.status === 'posted')

export const listEntries = async (filters: EntryFilters = {}): Promise<ProductionEntry[]> => {
    await delay()
    return entries
        .filter(
            (e) =>
                (!filters.type || e.type === filters.type) &&
                (!filters.material || e.material === filters.material) &&
                (!filters.factoryId || e.factoryId === filters.factoryId) &&
                (!filters.from || e.date >= filters.from) &&
                (!filters.to || e.date <= filters.to)
        )
        .sort((a, b) => b.date.localeCompare(a.date) || b.entryNo.localeCompare(a.entryNo))
}

const describe = (item: StockItem) =>
    item.itemType === 'piece' ? `${item.soot} soot ${item.size}` : item.itemType === 'counter' ? `${item.width} in counters` : 'slabs'

/**
 * One entry is one step: its inputs come out of stock, its outputs go in, and a worker paid per sq.ft
 * is paid for the output. Everything is checked first, so nothing is half-posted.
 */
export const postEntry = async (input: EntryInput, by: string): Promise<ProductionEntry> => {
    await delay()
    if (input.date > today()) throw new ApiError(400, { code: 'DATE_IN_FUTURE' })
    const outputs = input.lines.filter((l) => l.direction === 'out' && l.qty > 0)
    const inputs = input.lines.filter((l) => l.direction === 'in' && l.qty > 0)
    if (outputs.length === 0) throw new ApiError(400, { code: 'NO_OUTPUT' })
    if (input.type !== 'cut' && inputs.length === 0) throw new ApiError(400, { code: 'NO_INPUT' })

    if (input.type === 'cut') {
        const truck = allPurchases().find((p) => p.id === input.purchaseId)
        if (!truck || truck.status !== 'cut') throw new ApiError(409, { code: 'TRUCK_NOT_CUT' })
        if (isCounted(truck.id)) throw new ApiError(409, { code: 'ALREADY_COUNTED' })
    }

    // Inputs must be in stock: stock never goes negative.
    const stock = stockFrom(entries)
    for (const line of inputs) {
        const have = stock.get(itemKeyOf(line.item)) ?? { qty: 0, inches: 0 }
        if (line.qty > have.qty) throw new ApiError(409, { code: 'INSUFFICIENT_STOCK', available: have.qty, what: describe(line.item) })
        if (line.item.itemType === 'counter' && line.inches > have.inches) {
            throw new ApiError(409, { code: 'INSUFFICIENT_INCHES', available: have.inches, what: describe(line.item) })
        }
    }

    const inSqft = totalSqFt(inputs, 'in')
    const outSqft = totalSqFt(outputs, 'out')
    if (input.type === 'resize' && outSqft > inSqft + 0.01) throw new ApiError(409, { code: 'OUTPUT_MORE_THAN_INPUT' })

    // A worker paid per sq.ft: his own rate if he has one, else the job rate card.
    let workerRate = 0
    let workerName: string | null = null
    if (input.workerId && input.type !== 'cut') {
        const worker = workerById(input.workerId)
        if (worker) {
            workerName = worker.name
            workerRate = worker.rate > 0 ? worker.rate : ((await listWorkerRates()).find((r) => r.name === rateCardJob[input.type as Exclude<EntryType, 'cut'>])?.rate ?? 0)
        }
    }
    const workerAmount = workerName ? Math.round(outSqft * workerRate) : 0

    seq += 1
    const entry: ProductionEntry = {
        id: crypto.randomUUID(),
        entryNo: `PE-${String(seq).padStart(4, '0')}`,
        date: input.date,
        type: input.type,
        factoryId: input.factoryId,
        factoryName: input.factoryName,
        material: input.material,
        purchaseId: input.purchaseId,
        machineType: input.machineType,
        workerId: workerName ? input.workerId : null,
        workerName,
        workerRate,
        workerAmount,
        wasteSqft: input.type === 'resize' ? Math.max(0, Math.round((inSqft - outSqft) * 100) / 100) : 0,
        note: input.note,
        status: 'posted',
        lines: [...inputs, ...outputs],
        createdBy: by,
    }
    entries = [...entries, entry]

    if (workerName && workerAmount > 0 && input.workerId) {
        postWorkEntry({
            date: input.date,
            workerId: input.workerId,
            workerName,
            job: rateCardJob[input.type as Exclude<EntryType, 'cut'>],
            unit: 'sqft',
            qty: Math.round(outSqft * 100) / 100,
            rate: workerRate,
            amount: workerAmount,
            sourceType: 'production',
            sourceId: entry.id,
            auto: true,
            createdBy: by,
        })
    }
    return entry
}

/**
 * Takes an entry back: its stock moves and its worker pay are undone. Refused when something it made
 * has already been used (reversing would leave stock below zero).
 */
export const reverseEntry = async (id: string): Promise<ProductionEntry> => {
    await delay()
    const entry = find(id)
    if (entry.status !== 'posted') throw new ApiError(409, { code: 'ALREADY_REVERSED' })
    const after = stockFrom(entries.filter((e) => e.id !== id))
    for (const row of after.values()) {
        if (row.qty < 0 || row.inches < 0) {
            throw new ApiError(409, { code: 'REVERSE_NEGATIVE', available: Math.max(0, stockFrom(entries).get(itemKeyOf(row.item))?.qty ?? 0) })
        }
    }
    const reversed = { ...entry, status: 'reversed' as const }
    entries = entries.map((e) => (e.id === id ? reversed : e))
    reverseWorkEntries('production', id)
    return reversed
}

export type HistoryRow = {
    id: string
    date: string
    /** What moved it: a production step, or a stock entry. */
    source: 'production' | 'stock_entry' | 'sale'
    ref: string
    type: EntryType | null
    /** Signed: stock in is positive, stock out is negative. */
    qty: number
    inches: number
    balanceQty: number
    balanceInches: number
}

/** Every movement of one item, oldest first, with the running balance. */
export const stockHistory = (item: StockItem): HistoryRow[] => {
    const key = itemKeyOf(item)
    const raw: Omit<HistoryRow, 'balanceQty' | 'balanceInches'>[] = []
    for (const e of entries.filter((x) => x.status === 'posted')) {
        for (const l of e.lines) {
            if (itemKeyOf(l.item) !== key) continue
            const sign = l.direction === 'out' ? 1 : -1
            raw.push({ id: e.id, date: e.date, source: 'production', ref: e.entryNo, type: e.type, qty: sign * l.qty, inches: sign * l.inches })
        }
    }
    for (const m of movements) {
        for (const l of m.lines) {
            if (itemKeyOf(l.item) !== key) continue
            const sign = l.direction === 'out' ? 1 : -1
            raw.push({ id: m.id, date: m.date, source: m.source ?? 'stock_entry', ref: m.entryNo, type: null, qty: sign * l.qty, inches: sign * l.inches })
        }
    }
    raw.sort((a, b) => a.date.localeCompare(b.date) || a.ref.localeCompare(b.ref))
    let qty = 0
    let inches = 0
    return raw.map((r) => {
        qty += r.qty
        inches += r.inches
        return { ...r, balanceQty: qty, balanceInches: inches }
    })
}

/** The recorded production steps, oldest first, for cost work. */
export const listEntryRecords = (): ProductionEntry[] => entries
