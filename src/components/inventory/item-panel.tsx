'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { DataTable } from '@/components/shared/data-table'
import { StatCard } from '@/components/shared/stat-card'
import { inventoryQueryKey, setAlert, type InventoryRow } from '@/features/inventory'
import { stockHistory, type HistoryRow } from '@/features/production-entries'
import { useTableLabels } from '@/features/resource-labels'
import { useDirection } from '@/hooks/use-direction'
import { useMoney } from '@/hooks/use-money'
import { useItemText } from './use-item-text'

/** Side panel for one item: in stock, reserved, available, cost, value, the low-stock alert, and history. */
export function ItemPanel({
    row,
    canViewValue,
    canSetAlert,
    onClose,
}: {
    row: InventoryRow | null
    canViewValue: boolean
    canSetAlert: boolean
    onClose: () => void
}) {
    const t = useTranslations('inventory.panel')
    const format = useFormatter()
    const money = useMoney()
    const labels = useTableLabels()
    const itemText = useItemText()
    const { isRtl } = useDirection()
    const [editing, setEditing] = useState(false)

    const history = useMemo(() => (row ? [...stockHistory(row.item)].reverse() : []), [row])
    const counter = row?.item.itemType === 'counter'

    const columns = useMemo<ColumnDef<HistoryRow>[]>(
        () => [
            {
                accessorKey: 'date',
                header: t('date'),
                enableSorting: false,
                cell: ({ row: r }) => format.dateTime(new Date(`${r.original.date}T00:00:00`), { dateStyle: 'medium' }),
            },
            {
                id: 'entry',
                header: t('entry'),
                enableSorting: false,
                cell: ({ row: r }) => (
                    <div className="flex flex-col items-start gap-1">
                        <Badge variant="outline">{r.original.type ? t(`types.${r.original.type}`) : r.original.source === 'sale' ? t('sale') : t('stockEntry')}</Badge>
                        <span className="text-muted-foreground text-xs tabular-nums">{r.original.ref}</span>
                    </div>
                ),
            },
            {
                id: 'qty',
                header: t('inOut'),
                enableSorting: false,
                meta: { className: 'text-end' },
                cell: ({ row: r }) => (
                    <div className="flex flex-col tabular-nums">
                        <b className={r.original.qty < 0 ? 'text-destructive' : 'text-success'}>
                            {r.original.qty > 0 ? '+' : ''}
                            {format.number(r.original.qty)}
                        </b>
                        {counter && (
                            <span className="text-muted-foreground text-xs">
                                {r.original.inches > 0 ? '+' : ''}
                                {format.number(r.original.inches)} {t('in')}
                            </span>
                        )}
                    </div>
                ),
            },
            {
                accessorKey: 'balanceQty',
                header: t('balance'),
                enableSorting: false,
                meta: { className: 'text-end' },
                cell: ({ row: r }) => <span className="tabular-nums">{format.number(r.original.balanceQty)}</span>,
            },
        ],
        [t, format, counter]
    )

    return (
        <>
            <Sheet open={!!row} onOpenChange={(open) => !open && onClose()}>
                <SheetContent side={isRtl ? 'left' : 'right'} className="w-full overflow-y-auto sm:max-w-xl">
                    {row && (
                        <>
                            <SheetHeader>
                                <SheetTitle className="flex items-center gap-2">{itemText(row.item)}</SheetTitle>
                                <SheetDescription>{t(row.item.itemType === 'slab' ? 'soldByTon' : row.item.itemType === 'counter' ? 'soldByInch' : 'soldBySqft')}</SheetDescription>
                            </SheetHeader>
                            <div className="flex flex-col gap-4 px-4 pb-4">
                                <div className="grid grid-cols-3 gap-2">
                                    <StatCard
                                        compact
                                        label={t('onHand')}
                                        value={format.number(row.qty)}
                                        negative={row.low}
                                        note={counter ? t('inchesNote', { inches: format.number(row.inches), sqft: format.number(row.sqft, { maximumFractionDigits: 1 }) }) : row.item.itemType === 'piece' ? t('sqftNote', { sqft: format.number(row.sqft, { maximumFractionDigits: 1 }) }) : undefined}
                                    />
                                    <StatCard compact label={t('reserved')} value={format.number(row.reserved)} />
                                    <StatCard compact label={t('available')} value={format.number(row.available)} />
                                </div>

                                {canViewValue && (
                                    <div className="grid grid-cols-2 gap-2">
                                        <StatCard
                                            compact
                                            label={row.item.itemType === 'slab' ? t('costPerTon') : t('costPerSqft')}
                                            value={(row.item.itemType === 'slab' ? row.costPerTon : row.costPerSqft) !== null ? money(Math.round((row.item.itemType === 'slab' ? row.costPerTon : row.costPerSqft) as number)) : '—'}
                                        />
                                        <StatCard compact label={t('value')} value={row.value !== null ? money(row.value) : '—'} />
                                    </div>
                                )}

                                <div>
                                    <h3 className="mb-2 text-sm font-medium">{t('alertTitle')}</h3>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <span className="text-sm">
                                            {row.minQty ? t('alertWhenBelow', { count: row.minQty }) : <span className="text-muted-foreground">{t('noAlert')}</span>}
                                        </span>
                                        {canSetAlert && (
                                            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                                                {row.minQty ? t('changeAlert') : t('setAlert')}
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <h3 className="mb-2 text-sm font-medium">{t('history')}</h3>
                                    <DataTable columns={columns} data={history} labels={labels} pageSize={10} />
                                </div>
                            </div>
                        </>
                    )}
                </SheetContent>
            </Sheet>
            {row && <AlertDialog row={row} open={editing} onClose={() => setEditing(false)} />}
        </>
    )
}

function AlertDialog({ row, open, onClose }: { row: InventoryRow; open: boolean; onClose: () => void }) {
    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent>{open && <AlertForm key={row.key} row={row} onClose={onClose} />}</DialogContent>
        </Dialog>
    )
}

function AlertForm({ row, onClose }: { row: InventoryRow; onClose: () => void }) {
    const t = useTranslations('inventory.panel')
    const tc = useTranslations('common')
    const itemText = useItemText()
    const queryClient = useQueryClient()
    const [min, setMin] = useState(row.minQty ? String(row.minQty) : '')

    const save = useMutation({
        mutationFn: () => setAlert(row.item, Number(min) || 0),
        onSuccess: () => {
            toast.success(Number(min) > 0 ? t('alertSet', { count: Number(min) }) : t('alertRemoved'))
            queryClient.invalidateQueries({ queryKey: [inventoryQueryKey] })
            onClose()
        },
        onError: () => toast.error(t('alertFailed')),
    })

    return (
        <>
            <DialogHeader>
                <DialogTitle>{t('alertDialogTitle')}</DialogTitle>
                <DialogDescription>{itemText(row.item)}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
                <Label htmlFor="alert-min">{row.item.itemType === 'slab' ? t('alertBelowSlabs') : t('alertBelowPieces')}</Label>
                <Input id="alert-min" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
                <p className="text-muted-foreground text-xs">{t('alertHint')}</p>
            </div>
            <DialogFooter>
                <Button variant="outline" disabled={save.isPending} onClick={onClose}>
                    {tc('cancel')}
                </Button>
                <Button disabled={save.isPending} onClick={() => save.mutate()}>
                    {save.isPending && <Loader2 className="animate-spin" />}
                    {t('saveAlert')}
                </Button>
            </DialogFooter>
        </>
    )
}
