import { request } from '@/lib/client-api'
import type { StockItem } from './production-entries'

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

const base = '/api/stock-entries'

/** Waiting entries first, then newest. */
export const listStockEntries = (filters: StockEntryFilters = {}) => {
    const query = new URLSearchParams()
    if (filters.type) query.set('type', filters.type)
    if (filters.status) query.set('status', filters.status)
    const text = query.toString()
    return request<StockEntry[]>(`${base}${text ? `?${text}` : ''}`)
}

/** What the backend takes: names and the entry number are worked out there. */
const toBody = (input: StockEntryInput) => ({
    type: input.type,
    date: input.date,
    ...(input.type === 'adjustment' ? { direction: input.direction, reason: input.reason } : {}),
    note: input.note,
    item: input.item,
    qty: input.qty,
    ...(input.item.itemType === 'counter' ? { inches: input.inches } : {}),
    ...(input.type === 'transfer' && input.toFactoryId ? { toFactoryId: input.toFactoryId } : {}),
})

/**
 * Opening stock is the owner's alone. A munshi's entry waits as `pending` (no effect on stock) while approval
 * is on; anyone else's is approved at once and changes stock. The backend decides which.
 */
export const createStockEntry = (input: StockEntryInput) => request<StockEntry>(base, { body: toBody(input) })

/** Approving checks the stock again: it may have been used since the entry was made. */
export const approveStockEntry = (id: string) => request<StockEntry>(`${base}/${id}/approve`, { method: 'POST', body: {} })

export const rejectStockEntry = (id: string, reason: string) => request<StockEntry>(`${base}/${id}/reject`, { body: { reason } })
