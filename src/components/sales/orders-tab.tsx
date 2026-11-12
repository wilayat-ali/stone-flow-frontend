'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useQuery } from '@tanstack/react-query'
import { Receipt, TriangleAlert } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useItemText } from '@/components/inventory/use-item-text'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DataTable } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { StatusBadge } from '@/components/shared/status-badge'
import { useTableLabels } from '@/features/resource-labels'
import {
    advanceOf,
    listOrders,
    orderBilledPercent,
    orderReady,
    orderStatus,
    ordersQueryKey,
    type OrderStatus,
    type SalesOrder,
} from '@/features/sales'
import { useMoney } from '@/hooks/use-money'
import { cn } from '@/lib/utils'

const ALL = 'all'

const today = () => new Date().toISOString().slice(0, 10)

/** True when some line has stone ready to bill. */
export const hasReady = (order: SalesOrder) => orderStatus(order) === 'open' && order.lines.some((l) => orderReady(order, l).ready > 0)

/** Orders for stone that is not ready yet, sorted by the date they are needed, with Make Bill once something is ready. */
export function OrdersTab({
    canAct,
    onOpen,
    onMakeBill,
}: {
    canAct: boolean
    onOpen: (order: SalesOrder) => void
    onMakeBill: (order: SalesOrder) => void
}) {
    const t = useTranslations('sales.orders')
    const format = useFormatter()
    const money = useMoney()
    const labels = useTableLabels()
    const itemText = useItemText()
    const [status, setStatus] = useState<OrderStatus | typeof ALL>('open')

    const list = useQuery({ queryKey: [ordersQueryKey, status], queryFn: () => listOrders(status === ALL ? {} : { status }) })
    const date = (iso: string) => format.dateTime(new Date(`${iso}T00:00:00`), { dateStyle: 'medium' })

    const columns = useMemo<ColumnDef<SalesOrder>[]>(
        () => [
            {
                accessorKey: 'orderNo',
                header: t('columns.order'),
                cell: ({ row }) => (
                    <div className="flex flex-col">
                        <span className="font-medium tabular-nums">{row.original.orderNo}</span>
                        <span className="text-muted-foreground text-xs">{date(row.original.date)}</span>
                    </div>
                ),
            },
            {
                accessorKey: 'customerName',
                header: t('columns.customer'),
                cell: ({ row }) => (
                    <div className="flex flex-col">
                        <span className="font-medium">{row.original.customerName}</span>
                        {advanceOf(row.original) > 0 && (
                            <span className="text-success text-xs tabular-nums">{t('advance', { amount: money(advanceOf(row.original)) })}</span>
                        )}
                    </div>
                ),
            },
            {
                id: 'items',
                accessorFn: (o) => o.lines.map((l) => l.item.material).join(' '),
                header: t('columns.items'),
                cell: ({ row }) => (
                    <div className="flex flex-col gap-1">
                        {row.original.lines.map((l) => (
                            <div key={l.id} className="flex flex-col">
                                <span>{itemText(l.item)}</span>
                                <span className="text-muted-foreground text-xs tabular-nums">
                                    {format.number(l.item.itemType === 'counter' ? l.inches : l.qty)} × {format.number(l.rate)}
                                </span>
                            </div>
                        ))}
                    </div>
                ),
            },
            {
                accessorKey: 'neededBy',
                header: t('columns.neededBy'),
                cell: ({ row }) => (
                    <span className={cn(orderStatus(row.original) === 'open' && row.original.neededBy < today() && 'text-destructive font-medium')}>
                        {date(row.original.neededBy)}
                    </span>
                ),
            },
            {
                id: 'progress',
                header: t('columns.progress'),
                enableSorting: false,
                cell: ({ row }) => {
                    const o = row.original
                    const s = orderStatus(o)
                    if (s !== 'open') return <StatusBadge tone={s === 'completed' ? 'success' : 'neutral'}>{t(`statuses.${s}`)}</StatusBadge>
                    const short = o.lines.some((l) => orderReady(o, l).short > 0)
                    return (
                        <div className="flex flex-col items-start gap-0.5">
                            <StatusBadge tone={short ? 'danger' : 'success'}>{short ? t('short') : t('inStock')}</StatusBadge>
                            <span className="text-muted-foreground text-xs">{t('billedPercent', { percent: orderBilledPercent(o) })}</span>
                        </div>
                    )
                },
            },
            {
                id: 'action',
                header: () => <span className="sr-only">{t('columns.action')}</span>,
                enableSorting: false,
                cell: ({ row }) =>
                    canAct && hasReady(row.original) ? (
                        <Button
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation()
                                onMakeBill(row.original)
                            }}
                        >
                            <Receipt /> {t('makeBill')}
                        </Button>
                    ) : null,
            },
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [t, format, money, itemText, canAct]
    )

    if (list.isError) {
        return (
            <EmptyState
                title={t('loadFailed')}
                icon={TriangleAlert}
                action={
                    <Button variant="outline" onClick={() => list.refetch()}>
                        {t('retry')}
                    </Button>
                }
            />
        )
    }

    return (
        <>
            <DataTable
                columns={columns}
                data={list.data ?? []}
                labels={labels}
                loading={list.isLoading}
                pageSize={25}
                onRowClick={onOpen}
                toolbar={
                    <Select value={status} onValueChange={(v) => setStatus(v as OrderStatus | typeof ALL)}>
                        <SelectTrigger className="w-44">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL}>{t('allOrders')}</SelectItem>
                            {(['open', 'completed', 'cancelled'] as const).map((s) => (
                                <SelectItem key={s} value={s}>
                                    {t(`statuses.${s}`)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                }
            />
            <p className="text-muted-foreground text-sm">{t('note')}</p>
        </>
    )
}
