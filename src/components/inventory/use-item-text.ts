'use client'

import { useTranslations } from 'next-intl'
import { sizeLabel } from '@/features/piece-sizes'
import type { StockItem } from '@/features/production-entries'

/** An item in words: `Ziarat White · 14 soot 12×24 · unpolished`, `… · 24 in counter …`, `… · slabs`. */
export function useItemText() {
    const t = useTranslations('inventory.item')
    return (item: StockItem): string => {
        if (item.itemType === 'piece') {
            return t('piece', { material: item.material, soot: item.soot, size: sizeLabel(item.size), finish: t(`finishes.${item.finish}`) })
        }
        if (item.itemType === 'counter') {
            return t('counter', { material: item.material, width: item.width, finish: t(`finishes.${item.finish}`) })
        }
        return t('slab', { material: item.material })
    }
}
