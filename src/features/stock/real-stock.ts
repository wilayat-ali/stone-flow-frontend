import { listStock } from './api'
import type { StockRow } from './types'

/**
 * What the backend holds in stock, as the last list it gave. The Production and Sales screens are still
 * mocks and read stock at once, so they add this to their own movements (see `production-entries.ts`).
 */
let rows: StockRow[] = []

export const realStockRows = () => rows

/** Loads every page of stock. Someone without access to Inventory just keeps what was loaded before. */
export const loadRealStock = async (): Promise<StockRow[]> => {
    try {
        const all: StockRow[] = []
        for (let page = 1; ; page += 1) {
            const result = await listStock({ page, limit: 200 })
            all.push(...result.rows)
            if (all.length >= result.total || result.rows.length === 0) break
        }
        rows = all
    } catch {
        // No access (or the backend is away): keep the last list.
    }
    return rows
}
