import { request } from '@/lib/client-api'
import { itemKeyOf } from './format'
import type { ItemKey, Paged, StockFilters, StockHistoryRow, StockRow } from './types'

/** Prefix of every stock key, so one invalidation refreshes all stock screens. */
export const stockKey = ['stock'] as const
export const stockListKey = (filters: StockFilters) => [...stockKey, 'list', filters] as const
export const stockHistoryKey = (key: ItemKey) => [...stockKey, 'history', itemKeyOf(key)] as const

const base = '/api/stock'

const toQuery = (params: Record<string, string | number | boolean | null | undefined>) => {
    const query = new URLSearchParams()
    for (const [name, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '' && value !== false) query.set(name, String(value))
    }
    const text = query.toString()
    return text ? `?${text}` : ''
}

/** Stock grouped by item key, filtered and paged on the server. */
export const listStock = (filters: StockFilters = {}) => request<Paged<StockRow>>(`${base}${toQuery(filters)}`)

/** Every movement of one item, oldest first, with the running balance. */
export const stockHistory = (key: ItemKey, page = 1) =>
    request<Paged<StockHistoryRow>>(
        `${base}/history${toQuery({
            type: key.itemType,
            material: key.materialId,
            factory: key.factoryId,
            soot: key.sootTypeId,
            size: key.sootSizeId,
            width: key.counterWidthId,
            finish: key.finish,
            page,
        })}`
    )
