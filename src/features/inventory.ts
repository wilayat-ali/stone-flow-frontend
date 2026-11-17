import { request } from '@/lib/client-api'
import { listEntryRecords, loadAllEntries, sqFtOf, stockRows, itemKeyOf, type HistoryRow, type StockItem } from './production-entries'
import { allPurchases, listPurchases } from './purchases'
import { listBills, reservedFor } from './sales'
import { realStockRows } from './stock/real-stock'
import type { ItemKey, StockHistoryRow } from './stock/types'

export const inventoryQueryKey = 'inventory'

/** One line of stock for the tables: what is on hand, what is free, and what it is worth. */
export type InventoryRow = {
    key: string
    item: StockItem
    qty: number
    inches: number
    /** On bills not yet collected (07b). Nothing is reserved until Sales exists. */
    reserved: number
    available: number
    sqft: number
    /** PKR per sq.ft for pieces and counters; `null` where the cost is not known yet. */
    costPerSqft: number | null
    /** Slabs: PKR per ton and the average tons per slab, from the trucks cut. */
    costPerTon: number | null
    tonsPerSlab: number | null
    value: number | null
    minQty: number | null
    low: boolean
    /** The backend's ids for this item, when the backend holds stock of it (for its history). */
    ids: ItemKey | null
    /** Slabs: the marks of the trucks they were cut from. */
    trucks: string[]
}

/** `0` (or less) removes the alert. */
export const setAlert = async (item: StockItem, minQty: number): Promise<void> => {
    await request<{ minQty: number | null }>('/api/stock/alerts', { method: 'PUT', body: { item, minQty: Math.max(0, Math.round(minQty)) } })
}

/** Where a real movement came from, for the history list. */
const sourceOf = (sourceType: string): HistoryRow['source'] =>
    sourceType.startsWith('production') ? 'production' : sourceType.startsWith('sale') ? 'sale' : 'stock_entry'

/**
 * One item's history: the movements the backend holds (stock entries, production steps, stone given on
 * bills), oldest first, with the running balance worked out again.
 */
export const mergeHistory = (real: StockHistoryRow[]): HistoryRow[] => {
    const raw: Omit<HistoryRow, 'balanceQty' | 'balanceInches'>[] = [
        ...real.map((r) => ({
            id: r.id,
            date: r.date,
            source: sourceOf(r.sourceType),
            ref: (r.note ?? '').split(' · ')[0] || r.sourceType,
            type: null,
            qty: r.qty,
            inches: r.inches,
        })),
    ].sort((a, b) => a.date.localeCompare(b.date) || a.ref.localeCompare(b.ref))
    let qty = 0
    let inches = 0
    return raw.map((r) => {
        qty += r.qty
        inches += r.inches
        return { ...r, balanceQty: qty, balanceInches: inches }
    })
}

type Cost = { perSqft: number | null; perTon: number | null; tonsPerSlab: number | null }

/** The cost figures for one material, for the bill helper and for valuing stock. */
export const costForMaterial = (material: string) => costOf(material)

/**
 * Cost per sq.ft by material (computed, never stored):
 * vertical trucks: (stone price + thekadar pay per ton) ÷ sq.ft of 14 soot output, plus finishing
 * labour (per-sq.ft workers on section, resize and polish) ÷ sq.ft processed.
 * Gang saw slabs: cost per ton = (stone + cutting) ÷ tons. Factory overheads are added later in Reports.
 */
const costOf = (material: string): Cost => {
    const records = listEntryRecords().filter((e) => e.status === 'posted' && e.material === material)
    const truckCost = (purchaseId: string | null) => {
        const truck = allPurchases().find((p) => p.id === purchaseId)
        if (!truck) return { cost: 0, tons: 0 }
        // What cutting the truck cost: its tons at the rate it was finished with (the thekadar's pay or the cutting factory's charge).
        const pay = Math.round(truck.tons * (truck.cutRatePerTon ?? 0))
        return { cost: truck.total + pay, tons: truck.tons }
    }

    const vertical = records.filter((e) => e.type === 'cut' && e.machineType === 'vertical')
    const verticalSqft = vertical.reduce((s, e) => s + e.lines.filter((l) => l.direction === 'out').reduce((a, l) => a + sqFtOf(l), 0), 0)
    const base = vertical.reduce((s, e) => s + truckCost(e.purchaseId).cost, 0)

    const finishing = records.filter((e) => e.type !== 'cut' && e.workerAmount > 0)
    const labour = finishing.reduce((s, e) => s + e.workerAmount, 0)
    const processed = finishing.reduce((s, e) => s + e.lines.filter((l) => l.direction === 'out').reduce((a, l) => a + sqFtOf(l), 0), 0)

    const gang = records.filter((e) => e.type === 'cut' && e.machineType === 'gangSaw')
    const gangTons = gang.reduce((s, e) => s + truckCost(e.purchaseId).tons, 0)
    const gangCost = gang.reduce((s, e) => s + truckCost(e.purchaseId).cost, 0)
    const slabs = gang.reduce((s, e) => s + e.lines.filter((l) => l.item.itemType === 'slab').reduce((a, l) => a + l.qty, 0), 0)

    return {
        perSqft: verticalSqft > 0 ? base / verticalSqft + (processed > 0 ? labour / processed : 0) : null,
        perTon: gangTons > 0 ? gangCost / gangTons : null,
        tonsPerSlab: gangTons > 0 && slabs > 0 ? gangTons / slabs : null,
    }
}

export const listInventory = async (): Promise<InventoryRow[]> => {
    // What bills have booked comes from Sales; someone without access to Sales sees nothing reserved.
    await Promise.all([listPurchases(), loadAllEntries(), listBills().catch(() => [])])
    // The backend's rows by name key: they carry the running-low level and the ids.
    const real = new Map(realStockRows().map((r) => [itemKeyOf(r.item), r]))
    const costs = new Map<string, Cost>()
    const costFor = (material: string) => {
        if (!costs.has(material)) costs.set(material, costOf(material))
        return costs.get(material)!
    }

    return stockRows()
        .filter((r) => r.qty > 0 || r.inches > 0)
        .map((r): InventoryRow => {
            const key = itemKeyOf(r.item)
            const reserved = reservedFor(r.item)
            const cost = costFor(r.item.material)
            const sqft = sqFtOf({ item: r.item, qty: r.qty, inches: r.inches })
            const realRow = real.get(key)
            const minQty = realRow?.minQty ?? null
            const slab = r.item.itemType === 'slab'
            // Pieces and counters are valued per sq.ft, slabs per ton × the average tons per slab.
            const value = slab
                ? cost.perTon !== null && cost.tonsPerSlab !== null
                    ? Math.round(r.qty * cost.tonsPerSlab * cost.perTon)
                    : null
                : cost.perSqft !== null
                  ? Math.round(sqft * cost.perSqft)
                  : null
            return {
                key,
                item: r.item,
                qty: r.qty,
                inches: r.inches,
                reserved: reserved.qty,
                available: r.qty - reserved.qty,
                sqft,
                costPerSqft: slab ? null : cost.perSqft,
                costPerTon: slab ? cost.perTon : null,
                tonsPerSlab: slab ? cost.tonsPerSlab : null,
                value,
                minQty,
                low: minQty !== null && r.qty < minQty,
                ids: realRow
                    ? {
                          itemType: realRow.itemType,
                          materialId: realRow.materialId,
                          factoryId: realRow.factoryId,
                          sootTypeId: realRow.sootTypeId,
                          sootSizeId: realRow.sootSizeId,
                          counterWidthId: realRow.counterWidthId,
                          finish: realRow.finish,
                      }
                    : null,
                trucks: slab
                    ? listEntryRecords()
                          .filter((e) => e.status === 'posted' && e.type === 'cut' && e.machineType === 'gangSaw' && e.material === r.item.material && e.factoryId === r.item.factoryId)
                          .map((e) => allPurchases().find((p) => p.id === e.purchaseId)?.mark ?? '')
                          .filter(Boolean)
                    : [],
            }
        })
}
