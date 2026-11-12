'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, TriangleAlert, X } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RejectDialog } from '@/components/approvals/reject-dialog'
import { DataTable } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { StatusBadge, type StatusTone } from '@/components/shared/status-badge'
import { approvalsKey } from '@/features/approvals/api'
import { inventoryQueryKey } from '@/features/inventory'
import { useTableLabels } from '@/features/resource-labels'
import {
    approveStockEntry,
    listStockEntries,
    rejectStockEntry,
    stockEntriesQueryKey,
    stockEntryTypes,
    type StockEntry,
    type StockEntryFilters,
    type StockEntryStatus,
    type StockEntryType,
} from '@/features/stock-entries'
import { useInventoryErrorMessage } from '@/features/use-inventory-error-message'
import { useItemText } from './use-item-text'

const ALL = 'all'

const tone: Record<StockEntryStatus, StatusTone> = { pending: 'warning', approved: 'success', rejected: 'danger' }

/** Every opening, adjustment and transfer: pending ones first, with Approve / Reject for the owner. */
export function StockEntriesTab({
    canApprove,
    userName,
    initialStatus,
}: {
    canApprove: boolean
    userName: string
    initialStatus?: StockEntryStatus
}) {
    const t = useTranslations('inventory.entries')
    const tc = useTranslations('common')
    const format = useFormatter()
    const labels = useTableLabels()
    const itemText = useItemText()
    const queryClient = useQueryClient()
    const errorMessage = useInventoryErrorMessage()

    const [type, setType] = useState<StockEntryType | typeof ALL>(ALL)
    const [status, setStatus] = useState<StockEntryStatus | typeof ALL>(initialStatus ?? ALL)
    const [rejecting, setRejecting] = useState<StockEntry | null>(null)

    const filters = useMemo<StockEntryFilters>(() => ({ ...(type !== ALL && { type }), ...(status !== ALL && { status }) }), [type, status])
    const list = useQuery({ queryKey: [stockEntriesQueryKey, filters], queryFn: () => listStockEntries(filters) })

    const refresh = () => {
        for (const key of [stockEntriesQueryKey, inventoryQueryKey, approvalsKey[0]]) queryClient.invalidateQueries({ queryKey: [key] })
    }

    const approve = useMutation({
        mutationFn: (e: StockEntry) => approveStockEntry(e.id, userName),
        onSuccess: () => {
            toast.success(t('approved'))
            refresh()
        },
        // Approving checks the stock again, so it can fail ("Only 40 in stock") and the entry stays pending.
        onError: (error) => toast.error(errorMessage(error)),
    })

    const reject = useMutation({
        mutationFn: ({ entry, reason }: { entry: StockEntry; reason: string }) => rejectStockEntry(entry.id, reason, userName),
        onSuccess: () => {
            toast.success(t('rejected'))
            setRejecting(null)
            refresh()
        },
        onError: (error) => toast.error(errorMessage(error)),
    })

    const signOf = (e: StockEntry) => (e.type === 'transfer' ? 0 : e.type === 'opening' || e.direction === 1 ? 1 : -1)

    const columns = useMemo<ColumnDef<StockEntry>[]>(
        () => [
            {
                accessorKey: 'entryNo',
                header: t('columns.entry'),
                cell: ({ row }) => (
                    <div className="flex flex-col">
                        <span className="font-medium tabular-nums">{row.original.entryNo}</span>
                        <span className="text-muted-foreground text-xs">
                            {format.dateTime(new Date(`${row.original.date}T00:00:00`), { dateStyle: 'medium' })}
                        </span>
                    </div>
                ),
            },
            {
                accessorKey: 'type',
                header: t('columns.type'),
                cell: ({ row }) => (
                    <div className="flex flex-col items-start gap-1">
                        <Badge variant="outline">{t(`types.${row.original.type}`)}</Badge>
                        {row.original.reason && <span className="text-muted-foreground text-xs">{t(`reasons.${row.original.reason}`)}</span>}
                    </div>
                ),
            },
            {
                id: 'item',
                header: t('columns.item'),
                enableSorting: false,
                cell: ({ row }) => (
                    <div className="flex flex-col">
                        <span>{itemText(row.original.item)}</span>
                        <span className="text-muted-foreground text-xs">
                            {row.original.type === 'transfer'
                                ? `${row.original.factoryName} → ${row.original.toFactoryName}`
                                : row.original.factoryName}
                        </span>
                    </div>
                ),
            },
            {
                accessorKey: 'qty',
                header: t('columns.qty'),
                meta: { className: 'text-end' },
                cell: ({ row }) => {
                    const sign = signOf(row.original)
                    return (
                        <div className="flex flex-col tabular-nums">
                            <b className={sign < 0 ? 'text-destructive' : sign > 0 ? 'text-success' : undefined}>
                                {sign > 0 ? '+' : sign < 0 ? '−' : ''}
                                {format.number(row.original.qty)}
                            </b>
                            {row.original.item.itemType === 'counter' && (
                                <span className="text-muted-foreground text-xs">
                                    {format.number(row.original.inches)} {t('inches')}
                                </span>
                            )}
                        </div>
                    )
                },
            },
            {
                accessorKey: 'status',
                header: t('columns.status'),
                cell: ({ row }) => (
                    <div className="flex flex-col items-start gap-1">
                        <StatusBadge tone={tone[row.original.status]}>{t(`statuses.${row.original.status}`)}</StatusBadge>
                        <span className="text-muted-foreground text-xs">{t('by', { name: row.original.createdBy })}</span>
                        {row.original.rejectReason && <span className="text-destructive text-xs">{row.original.rejectReason}</span>}
                    </div>
                ),
            },
            {
                id: 'actions',
                header: () => <span className="sr-only">{tc('actions')}</span>,
                enableSorting: false,
                cell: ({ row }) =>
                    row.original.status === 'pending' && canApprove ? (
                        <div className="flex justify-end gap-1">
                            <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate(row.original)}>
                                <Check /> {t('approve')}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setRejecting(row.original)}>
                                <X /> {t('reject')}
                            </Button>
                        </div>
                    ) : null,
            },
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [t, tc, format, itemText, canApprove, approve.isPending]
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
                toolbar={
                    <div className="flex flex-wrap gap-2">
                        <Select value={type} onValueChange={(v) => setType(v as StockEntryType | typeof ALL)}>
                            <SelectTrigger className="w-44">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL}>{t('allTypes')}</SelectItem>
                                {stockEntryTypes.map((x) => (
                                    <SelectItem key={x} value={x}>
                                        {t(`types.${x}`)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={status} onValueChange={(v) => setStatus(v as StockEntryStatus | typeof ALL)}>
                            <SelectTrigger className="w-44">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL}>{t('allStatuses')}</SelectItem>
                                {(['pending', 'approved', 'rejected'] as const).map((x) => (
                                    <SelectItem key={x} value={x}>
                                        {t(`statuses.${x}`)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                }
            />
            <p className="text-muted-foreground text-sm">{t('note')}</p>

            <RejectDialog
                open={!!rejecting}
                onOpenChange={(open) => !open && setRejecting(null)}
                pending={reject.isPending}
                labels={{
                    title: t('rejectDialog.title', { no: rejecting?.entryNo ?? '' }),
                    description: t('rejectDialog.description'),
                    reason: t('rejectDialog.reason'),
                    required: t('rejectDialog.required'),
                    submit: t('reject'),
                    cancel: tc('cancel'),
                }}
                onSubmit={(reason) => rejecting && reject.mutate({ entry: rejecting, reason })}
            />
        </>
    )
}
