import { request } from '@/lib/client-api'
import { loadRealStock, realStockRows } from './stock/real-stock'
import { sqFtOfSize } from './piece-sizes'

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

const base = '/api/production/entries'

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
 * Stock is never stored: it is what the backend holds, the sum of its movements (stock entries, production
 * steps and stone given on bills).
 */
const stockFrom = (): Map<string, StockRow> => {
    const map = new Map<string, StockRow>()
    for (const r of realStockRows()) map.set(itemKeyOf(r.item), { item: r.item, qty: r.qty, inches: r.inches })
    return map
}

/** The posted steps, as the last list from the backend gave them (cutting counts and costs read these at once). */
let entries: ProductionEntry[] = []

/** Synchronous view of stock for the entry form, which shows "in stock now" while you type. */
export const stockOnHand = (item: StockItem) => stockFrom().get(itemKeyOf(item)) ?? { item, qty: 0, inches: 0 }

/** Everything currently in stock, for Inventory (06). */
export const stockRows = (): StockRow[] => [...stockFrom().values()].filter((r) => r.qty !== 0 || r.inches !== 0)

/** Materials that have stock or entries, for the pickers. */
export const stockedMaterials = () => [...new Set([...entries.map((e) => e.material), ...realStockRows().map((r) => r.item.material)])]

/** A truck whose cutting output has been counted leaves "output to count". */
export const isCounted = (purchaseId: string) =>
    entries.some((e) => e.type === 'cut' && e.purchaseId === purchaseId && e.status === 'posted')

const toQuery = (filters: EntryFilters) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value)
    const text = params.toString()
    return text ? `?${text}` : ''
}

/** Every step, newest first. Also refreshes stock, which the entry form reads at once. */
export const loadAllEntries = async (): Promise<ProductionEntry[]> => {
    const [all] = await Promise.all([request<ProductionEntry[]>(base), loadRealStock()])
    entries = all
    return all
}

export const listEntries = async (filters: EntryFilters = {}): Promise<ProductionEntry[]> => {
    if (!Object.values(filters).some(Boolean)) return loadAllEntries()
    const [rows] = await Promise.all([request<ProductionEntry[]>(`${base}${toQuery(filters)}`), loadRealStock()])
    return rows
}

/**
 * Active workers paid per sq.ft, for the "who did it" picker. They are the real workers (the backend's
 * Workers), so the pay lands on their khata.
 */
export type SqftWorker = { id: string; name: string; defaultJob: string; rate: number }

export const listSqftWorkers = () => request<SqftWorker[]>('/api/production/workers')

/**
 * One entry is one step: its inputs come out of stock, its outputs go in, and a worker paid per sq.ft
 * is paid for the output. The backend checks everything first and saves it all together, so nothing is
 * half-posted.
 */
export const postEntry = async (input: EntryInput): Promise<ProductionEntry> => {
    const entry = await request<ProductionEntry>(base, {
        body: {
            type: input.type,
            date: input.date,
            factoryId: input.factoryId,
            material: input.material,
            purchaseId: input.purchaseId ?? undefined,
            machineType: input.machineType ?? undefined,
            workerId: input.workerId ?? undefined,
            note: input.note,
            lines: input.lines
                .filter((l) => l.qty > 0)
                .map((l) => ({
                    direction: l.direction,
                    item: l.item,
                    qty: l.qty,
                    inches: l.item.itemType === 'counter' ? l.inches : undefined,
                })),
        },
    })
    await loadRealStock()
    return entry
}

/**
 * Takes an entry back: its stock moves and its worker pay are undone. Refused when something it made
 * has already been used (reversing would leave stock below zero).
 */
export const reverseEntry = async (id: string): Promise<ProductionEntry> => {
    const entry = await request<ProductionEntry>(`${base}/${id}/reverse`, { body: {} })
    await loadRealStock()
    return entry
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

/** The recorded production steps, newest first, for cost work (the last list loaded). */
export const listEntryRecords = (): ProductionEntry[] => entries
