'use client'

import { Receipt, Wallet, X } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useItemText } from '@/components/inventory/use-item-text'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { StatCard } from '@/components/shared/stat-card'
import { StatusBadge } from '@/components/shared/status-badge'
import {
    advanceOf,
    billedOf,
    billsOfOrder,
    orderReady,
    orderStatus,
    orderTotal,
    type Bill,
    type SalesOrder,
} from '@/features/sales'
import { useDirection } from '@/hooks/use-direction'
import { useMoney } from '@/hooks/use-money'
import { Link } from '@/i18n/navigation'
import { hasReady } from './orders-tab'

/** One order: value, advance, billed; each line's stock readiness; the linked bills; and what to do next. */
export function OrderPanel({
    order,
    canAct,
    onClose,
    onMakeBill,
    onReceiveAdvance,
    onCancel,
    onOpenBill,
}: {
    order: SalesOrder | null
    canAct: boolean
    onClose: () => void
    onMakeBill: (order: SalesOrder) => void
    onReceiveAdvance: (order: SalesOrder) => void
    onCancel: (order: SalesOrder) => void
    onOpenBill: (bill: Bill) => void
}) {
    const t = useTranslations('sales.orders.panel')
    const ts = useTranslations('sales.orders.statuses')
    const format = useFormatter()
    const money = useMoney()
    const itemText = useItemText()
    const { isRtl } = useDirection()
    const date = (iso: string) => format.dateTime(new Date(`${iso}T00:00:00`), { dateStyle: 'medium' })

    const o = order
    const status = o ? orderStatus(o) : null
    const linked = o ? billsOfOrder(o) : []
    const shortLines = o ? o.lines.filter((l) => orderReady(o, l).short > 0) : []

    return (
        <Sheet open={!!o} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side={isRtl ? 'left' : 'right'} className="w-full overflow-y-auto sm:max-w-xl">
                {o && status && (
                    <>
                        <SheetHeader>
                            <SheetTitle className="flex items-center gap-2">
                                {t('title', { no: o.orderNo })}
                                <StatusBadge tone={status === 'open' ? 'info' : status === 'completed' ? 'success' : 'neutral'}>{ts(status)}</StatusBadge>
                            </SheetTitle>
                            <SheetDescription>
                                {date(o.date)} · {o.customerName} · {t('neededBy', { date: date(o.neededBy) })}
                            </SheetDescription>
                        </SheetHeader>
                        <div className="flex flex-col gap-4 px-4 pb-4">
                            <div className="grid grid-cols-3 gap-2">
                                <StatCard compact label={t('value')} value={money(orderTotal(o))} />
                                <StatCard compact label={t('advanceLabel')} value={money(advanceOf(o))} />
                                <StatCard compact label={t('billed')} value={money(linked.reduce((s, b) => s + b.total, 0))} note={t('billsCount', { count: linked.length })} />
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {canAct && hasReady(o) && (
                                    <Button onClick={() => onMakeBill(o)}>
                                        <Receipt /> {t('makeBill')}
                                    </Button>
                                )}
                                {canAct && status === 'open' && (
                                    <Button variant="outline" onClick={() => onReceiveAdvance(o)}>
                                        <Wallet /> {t('receiveAdvance')}
                                    </Button>
                                )}
                                <Button variant="ghost" asChild>
                                    <Link href="/customers">{t('khata')}</Link>
                                </Button>
                                {canAct && status === 'open' && (
                                    <Button variant="outline" onClick={() => onCancel(o)}>
                                        <X /> {t('cancelOrder')}
                                    </Button>
                                )}
                            </div>

                            <div>
                                <h3 className="mb-2 text-sm font-medium">{t('items')}</h3>
                                <ul className="flex flex-col gap-3 text-sm">
                                    {o.lines.map((l) => {
                                        const r = orderReady(o, l)
                                        const done = billedOf(l.id)
                                        const counter = l.item.itemType === 'counter'
                                        const unit = counter ? t('inches') : l.item.itemType === 'slab' ? t('slabs') : t('pcs')
                                        return (
                                            <li key={l.id} className="bg-muted/30 flex flex-col gap-1 rounded-lg border p-3">
                                                <span className="font-medium">{itemText(l.item)}</span>
                                                <span className="text-muted-foreground text-xs tabular-nums">
                                                    {t('ordered', { count: format.number(counter ? l.inches : l.qty), unit })} · {t('billedLine', { count: format.number(counter ? done.inches : done.qty) })} · {format.number(l.rate)}
                                                </span>
                                                {status === 'open' && r.need > 0 && (
                                                    <span className={r.short > 0 ? 'text-destructive text-xs font-medium' : 'text-success text-xs font-medium'}>
                                                        {r.short > 0 ? t('readyOf', { ready: format.number(r.ready), need: format.number(r.need) }) : t('allReady', { count: format.number(r.need) })}
                                                    </span>
                                                )}
                                            </li>
                                        )
                                    })}
                                </ul>
                            </div>

                            {shortLines.length > 0 && status === 'open' && (
                                <div className="bg-muted flex items-start gap-2 rounded-lg border p-3 text-sm">
                                    <span>{t('shortWarning')}</span>
                                    <Button variant="link" className="h-auto p-0" asChild>
                                        <Link href="/production">{t('goProduction')}</Link>
                                    </Button>
                                </div>
                            )}

                            {linked.length > 0 && (
                                <div>
                                    <h3 className="mb-2 text-sm font-medium">{t('bills')}</h3>
                                    <ul className="flex flex-col gap-1 text-sm">
                                        {linked.map((b) => (
                                            <li key={b.id}>
                                                <Button variant="link" className="h-auto p-0" onClick={() => onOpenBill(b)}>
                                                    {b.billNo}
                                                </Button>{' '}
                                                <span className="text-muted-foreground">
                                                    {date(b.date)} · {money(b.total)}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {o.note && <p className="text-sm">{o.note}</p>}
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>
    )
}
