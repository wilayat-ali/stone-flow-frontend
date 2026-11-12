import type { ItemKey, StockRow } from './types'

/** Stable string for one item key, usable as a React key and as the history query. */
export const itemKeyOf = (key: ItemKey): string =>
    [
        key.itemType,
        key.materialId,
        key.factoryId,
        key.sootTypeId ?? '',
        key.sootSizeId ?? '',
        key.counterWidthId ?? '',
        key.finish ?? '',
    ].join('|')

/** Inverse of `itemKeyOf`. */
export function parseItemKey(value: string): ItemKey {
    const [itemType, materialId, factoryId, sootTypeId, sootSizeId, counterWidthId, finish] = value.split('|')
    return {
        itemType: itemType as ItemKey['itemType'],
        materialId,
        factoryId,
        sootTypeId: sootTypeId || null,
        sootSizeId: sootSizeId || null,
        counterWidthId: counterWidthId || null,
        finish: (finish || null) as ItemKey['finish'],
    }
}

/** sq.ft = width × length ÷ 144 × pieces (inches), to one decimal. Only pieces have a size. */
export function sqFt(row: Pick<StockRow, 'itemType' | 'qty' | 'widthInches' | 'lengthInches'>): number {
    if (row.itemType !== 'piece' || !row.widthInches || !row.lengthInches) return 0
    return Math.round(((row.widthInches * row.lengthInches) / 144) * row.qty * 10) / 10
}
