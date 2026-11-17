export type ItemType = 'piece' | 'counter' | 'slab'

export type Finish = 'polished' | 'unpolished'

/**
 * What identifies one line of stock: `itemType | materialId | factoryId | sootTypeId | sootSizeId |
 * counterWidthId | finish`. Fields that do not apply to the item type are null (a slab has no soot,
 * size, width or finish; a counter has a width but no soot or size).
 */
export type ItemKey = {
    itemType: ItemType
    materialId: string
    factoryId: string
    sootTypeId: string | null
    sootSizeId: string | null
    counterWidthId: string | null
    finish: Finish | null
}

/** An item the way the screens name it: material by name, soot as 14, size as 12x24, width in inches. */
export type StockItemName =
    | { itemType: 'piece'; material: string; factoryId: string; soot: string; size: string; finish: Finish }
    | { itemType: 'counter'; material: string; factoryId: string; width: number; finish: Finish }
    | { itemType: 'slab'; material: string; factoryId: string }

/** One line of stock, summed from the movements. Never typed in by anyone. */
export type StockRow = ItemKey & {
    /** The same item by name, for the screens that are not on ids yet. */
    item: StockItemName
    /** The level below which the item shows as low, if one is set. */
    minQty: number | null
    low: boolean
    /** Pieces (or slabs). */
    qty: number
    /** Total inches; counters only, else 0. */
    inches: number
    /** Display names the backend resolves for the ids. */
    materialName?: string
    factoryName?: string
    sootTypeName?: string | null
    sootSizeName?: string | null
    counterWidthName?: string | null
    /** Piece size in inches, for sq.ft. */
    widthInches?: number | null
    lengthInches?: number | null
}

export type StockSourceType =
    | 'production_output'
    | 'production_input'
    | 'stock_entry'
    | 'sale_give'
    | 'reversal'

export type StockHistoryRow = {
    id: string
    date: string
    qty: number
    inches: number
    sourceType: StockSourceType
    sourceId: string | null
    note: string | null
    /** Running balance after this row. */
    balanceQty: number
    balanceInches: number
}

export type Paged<T> = { total: number; rows: T[] }

export type StockFilters = Partial<{
    type: ItemType
    material: string
    soot: string
    size: string
    width: string
    finish: Finish
    factory: string
    lowOnly: boolean
    page: number
    limit: number
}>
