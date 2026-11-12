import { costForMaterial } from './inventory'
import { itemKeyOf, type StockItem } from './production-entries'
import { allBills, availableFor } from './sales'

export type LineHelper = {
    /** On hand − booked on other uncollected bills. */
    available: number
    availableInches: number
    /** Booked on other bills. */
    reserved: number
    /** The rate on this customer's last bill for the same item. */
    lastRate: { rate: number; date: string } | null
    /** PKR per sq.ft (pieces), per inch (counters), per ton (slabs); `null` where the cost is not known yet. */
    cost: number | null
}

/**
 * What the New Bill form shows under each item: how much is free, the last rate this customer paid,
 * and what it costs us. These only advise and never block, since the munshi knows the minimum rate.
 */
export const lineHelper = (customerId: string | null, item: StockItem, exceptBillId?: string): LineHelper => {
    const avail = availableFor(item, exceptBillId)
    const key = itemKeyOf({ ...item, factoryId: '' })
    const last = customerId
        ? allBills()
              .filter((b) => b.customerId === customerId && b.status === 'active' && b.id !== exceptBillId)
              .sort((a, b) => b.date.localeCompare(a.date))
              .flatMap((b) => b.lines.filter((l) => itemKeyOf({ ...l.item, factoryId: '' }) === key).map((l) => ({ rate: l.rate, date: b.date })))[0]
        : undefined

    const c = costForMaterial(item.material)
    // A counter is sold per inch: its width times the cost per sq.ft, divided by 144.
    const cost = item.itemType === 'piece' ? c.perSqft : item.itemType === 'counter' ? (c.perSqft !== null ? (c.perSqft * item.width) / 144 : null) : c.perTon

    return { available: avail.qty, availableInches: avail.inches, reserved: avail.reserved, lastRate: last ?? null, cost }
}
