'use client'

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Pencil, Printer, Truck, Wallet, X } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useItemText } from '@/components/inventory/use-item-text'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { DataTable } from '@/components/shared/data-table'
import { StatCard } from '@/components/shared/stat-card'
import { useTableLabels } from '@/features/resource-labels'
import { collectedOf, lineAmount, paymentInfo, remainingOf, toCollect, type Bill, type BillLine, type Collection } from '@/features/sales'
import { useDirection } from '@/hooks/use-direction'
import { useMoney } from '@/hooks/use-money'
import { Link } from '@/i18n/navigation'
import { PaymentStateBadge } from './payment-state'

/** One bill: totals, what has left and what is left, its collections (each opens its gate pass) and its history. */
export function BillPanel({
    bill,
    canAct,
    onClose,
    onGive,
    onParchi,
    onEdit,
    onCancel,
    onGatePass,
    onReceive,
}: {
    bill: Bill | null
    /** Make, edit and cancel bills; the munshi can, a viewer cannot. */
    canAct: boolean
    onClose: () => void
    onGive: (bill: Bill) => void
    onParchi: (bill: Bill) => void
    onEdit: (bill: Bill) => void
    onCancel: (bill: Bill) => void
    onGatePass: (bill: Bill, collection: Collection) => void
    onReceive: (bill: Bill) => void
}) {
    const t = useTranslations('sales.panel')
    const format = useFormatter()
    const money = useMoney()
    const labels = useTableLabels()
    const itemText = useItemText()
    const { isRtl } = useDirection()
    const date = (iso: string) => format.dateTime(new Date(`${iso}T00:00:00`), { dateStyle: 'medium' })

    const b = bill
    const info = b ? paymentInfo(b) : null
    const active = b?.status === 'active'

    const columns = useMemo<ColumnDef<BillLine>[]>(
        () => [
            {
                id: 'item',
                header: t('item'),
                enableSorting: false,
                cell: ({ row }) => (
                    <div className="flex flex-col">
                        <span>{itemText(row.original.item)}</span>
                        <span className="text-muted-foreground text-xs tabular-nums">
                            {format.number(row.original.qty)} × {format.number(row.original.rate)}
                        </span>
                    </div>
                ),
            },
            {
                id: 'amount',
                header: t('amount'),
                enableSorting: false,
                meta: { className: 'text-end' },
                cell: ({ row }) => <span className="tabular-nums">{money(lineAmount(row.original))}</span>,
            },
            {
                id: 'collected',
                header: t('collected'),
                enableSorting: false,
                meta: { className: 'text-end' },
                cell: ({ row }) => {
                    if (!b) return null
                    const got = collectedOf(b, row.original.lineNo)
                    const rem = remainingOf(b, row.original)
                    return (
                        <div className="flex flex-col tabular-nums">
                            <span>{format.number(got.qty)}</span>
                            {(rem.qty > 0 || rem.inches > 0) && b.status === 'active' && (
                                <span className="text-destructive text-xs">{t('left', { count: format.number(rem.qty) })}</span>
                            )}
                        </div>
                    )
                },
            },
        ],
        [t, format, money, itemText, b]
    )

    return (
        <Sheet open={!!b} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side={isRtl ? 'left' : 'right'} className="w-full overflow-y-auto sm:max-w-xl">
                {b && info && (
                    <>
                        <SheetHeader>
                            <SheetTitle className="flex items-center gap-2">
                                {t('title', { no: b.billNo })} <PaymentStateBadge state={info.state} />
                            </SheetTitle>
                            <SheetDescription>
                                {date(b.date)} · {b.customerName}
                                {b.orderId && ` · ${t('order', { no: b.orderId })}`}
                            </SheetDescription>
                        </SheetHeader>
                        <div className="flex flex-col gap-4 px-4 pb-4">
                            <div className="bg-primary text-primary-foreground flex flex-wrap items-center justify-between gap-2 rounded-lg px-4 py-3">
                                <div>
                                    <div className="text-xs uppercase opacity-80">{t('total')}</div>
                                    <div className="text-2xl font-semibold tabular-nums">{money(b.total)}</div>
                                </div>
                                <div className="text-sm tabular-nums opacity-90">
                                    {b.discount > 0 && <div>− {money(b.discount)} {t('discount')}</div>}
                                    {b.transport > 0 && <div>+ {money(b.transport)} {t('transport')}</div>}
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                <StatCard compact label={t('received')} value={money(info.paid)} />
                                <StatCard compact label={t('dueOnBill')} value={money(info.due)} negative={info.due > 0} />
                                <StatCard compact label={t('stone')} value={!active ? '—' : toCollect(b) ? t('toCollect') : t('collectedAll')} negative={active && toCollect(b)} />
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {canAct && active && toCollect(b) && (
                                    <Button onClick={() => onGive(b)}>
                                        <Truck /> {t('giveStone')}
                                    </Button>
                                )}
                                {canAct && b.customerId && (
                                    <Button variant="outline" onClick={() => onReceive(b)}>
                                        <Wallet /> {t('receivePayment')}
                                    </Button>
                                )}
                                <Button variant="outline" onClick={() => onParchi(b)}>
                                    <Printer /> {t('parchi')}
                                </Button>
                                {canAct && active && (
                                    <Button variant="outline" onClick={() => onEdit(b)}>
                                        <Pencil /> {t('edit')}
                                    </Button>
                                )}
                                {canAct && active && b.collections.length === 0 && (
                                    <Button variant="outline" onClick={() => onCancel(b)}>
                                        <X /> {t('cancelBill')}
                                    </Button>
                                )}
                                {b.customerId && (
                                    <Button variant="ghost" asChild>
                                        <Link href="/customers">{t('khata')}</Link>
                                    </Button>
                                )}
                            </div>

                            {b.status === 'cancelled' && <p className="text-destructive text-sm">{t('cancelledNote', { reason: b.cancelReason ?? '' })}</p>}

                            <div>
                                <h3 className="mb-2 text-sm font-medium">{t('items')}</h3>
                                <DataTable columns={columns} data={b.lines} labels={labels} pageSize={10} />
                            </div>

                            {b.collections.length > 0 && (
                                <div>
                                    <h3 className="mb-2 text-sm font-medium">{t('collections')}</h3>
                                    <ul className="flex flex-col gap-1 text-sm">
                                        {b.collections.map((c) => (
                                            <li key={c.id}>
                                                <Button variant="link" className="h-auto p-0" onClick={() => onGatePass(b, c)}>
                                                    {c.collNo}
                                                </Button>{' '}
                                                <span className="text-muted-foreground">
                                                    {date(c.date)}
                                                    {c.vehicle && ` · ${c.vehicle}`}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {b.note && <p className="text-sm">{b.note}</p>}

                            <div>
                                <h3 className="mb-2 text-sm font-medium">{t('history')}</h3>
                                <ul className="flex flex-col gap-2 text-sm">
                                    {[...b.log].reverse().map((l, i) => (
                                        <li key={i} className="flex justify-between gap-3">
                                            <span>
                                                {l.text} <span className="text-muted-foreground">· {l.by}</span>
                                            </span>
                                            <span className="text-muted-foreground shrink-0">{date(l.date)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>
    )
}
