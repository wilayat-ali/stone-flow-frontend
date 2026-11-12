'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { TriangleAlert, Undo2 } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { DataTable } from '@/components/shared/data-table'
import { DateRangePicker, type DateRange } from '@/components/shared/date-range-picker'
import { EmptyState } from '@/components/shared/empty-state'
import { factoriesQueryKey, listFactories } from '@/features/factories'
import { sizeLabel } from '@/features/piece-sizes'
import { productionQueryKey } from '@/features/production'
import {
    entryTypes,
    listEntries,
    productionEntriesQueryKey,
    reverseEntry,
    sqFtOf,
    totalSqFt,
    type EntryFilters,
    type EntryLine,
    type EntryType,
    type ProductionEntry,
} from '@/features/production-entries'
import { allPurchases } from '@/features/purchases'
import { useTableLabels } from '@/features/resource-labels'
import { useEntryErrorMessage } from '@/features/use-entry-error-message'
import { useDirection } from '@/hooks/use-direction'
import { useMoney } from '@/hooks/use-money'

const ALL = 'all'

/** One line of an entry in words, e.g. `180 × 14 soot 12×24` or `5 pcs · 480 in of 24 in counters`. */
function useLineText() {
    const t = useTranslations('production.entries')
    return (line: EntryLine) => {
        const { item } = line
        if (item.itemType === 'piece') {
            return t('lineText.piece', { qty: line.qty, soot: item.soot, size: sizeLabel(item.size), finish: t(`finishes.${item.finish}`) })
        }
        if (item.itemType === 'counter') {
            return t('lineText.counter', { qty: line.qty, inches: line.inches, width: item.width, finish: t(`finishes.${item.finish}`) })
        }
        return t('lineText.slab', { qty: line.qty })
    }
}

/** The Production Log: every step with what went in and out, filterable, with a side panel and Reverse. */
export function EntryLog({ canReverse }: { canReverse: boolean }) {
    const t = useTranslations('production.entries')
    const tc = useTranslations('common')
    const format = useFormatter()
    const money = useMoney()
    const labels = useTableLabels()
    const queryClient = useQueryClient()
    const errorMessage = useEntryErrorMessage()
    const lineText = useLineText()
    const { isRtl } = useDirection()

    const [type, setType] = useState<EntryType | typeof ALL>(ALL)
    const [material, setMaterial] = useState(ALL)
    const [factoryId, setFactoryId] = useState(ALL)
    const [range, setRange] = useState<DateRange>({ from: '', to: '' })
    const [openId, setOpenId] = useState<string | null>(null)
    const [reversing, setReversing] = useState<ProductionEntry | null>(null)

    const filters = useMemo<EntryFilters>(
        () => ({
            ...(type !== ALL && { type }),
            ...(material !== ALL && { material }),
            ...(factoryId !== ALL && { factoryId }),
            ...(range.from && { from: range.from }),
            ...(range.to && { to: range.to }),
        }),
        [type, material, factoryId, range]
    )

    const list = useQuery({ queryKey: [productionEntriesQueryKey, filters], queryFn: () => listEntries(filters) })
    const all = useQuery({ queryKey: [productionEntriesQueryKey, 'all'], queryFn: () => listEntries() })
    const factories = useQuery({ queryKey: [factoriesQueryKey], queryFn: listFactories })
    const opened = all.data?.find((e) => e.id === openId) ?? null
    const materials = [...new Set((all.data ?? []).map((e) => e.material))].sort()

    const reverse = useMutation({
        mutationFn: (entry: ProductionEntry) => reverseEntry(entry.id),
        onSuccess: () => {
            toast.success(t('reversed'))
            setReversing(null)
            setOpenId(null)
            for (const key of [productionEntriesQueryKey, productionQueryKey]) queryClient.invalidateQueries({ queryKey: [key] })
        },
        onError: (error) => {
            toast.error(errorMessage(error))
            setReversing(null)
        },
    })

    const markOf = (entry: ProductionEntry) => allPurchases().find((p) => p.id === entry.purchaseId)?.mark ?? null
    const sqft = (v: number) => format.number(v, { maximumFractionDigits: 1 })

    const columns = useMemo<ColumnDef<ProductionEntry>[]>(
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
                header: t('columns.step'),
                cell: ({ row }) => (
                    <div className="flex flex-col items-start gap-1">
                        <Badge variant="outline">{t(`types.${row.original.type}`)}</Badge>
                        {markOf(row.original) && (
                            <span className="text-primary text-xs font-semibold tabular-nums" dir="ltr">
                                {markOf(row.original)}
                            </span>
                        )}
                        {row.original.status === 'reversed' && <span className="text-destructive text-xs">{t('reversedTag')}</span>}
                    </div>
                ),
            },
            {
                accessorKey: 'material',
                header: t('columns.material'),
                cell: ({ row }) => (
                    <div className="flex flex-col">
                        <span>{row.original.material}</span>
                        <span className="text-muted-foreground text-xs">{row.original.factoryName}</span>
                    </div>
                ),
            },
            {
                id: 'flow',
                header: t('columns.inOut'),
                enableSorting: false,
                meta: { className: 'text-end' },
                cell: ({ row }) => {
                    const lines = row.original.lines
                    return (
                        <span className="tabular-nums">
                            {row.original.type === 'cut' ? '' : `${sqft(totalSqFt(lines, 'in'))} → `}
                            {sqft(totalSqFt(lines, 'out'))} {t('sqft')}
                        </span>
                    )
                },
            },
            {
                accessorKey: 'wasteSqft',
                header: t('columns.waste'),
                meta: { className: 'text-end' },
                cell: ({ row }) =>
                    row.original.wasteSqft > 0 ? (
                        <span className="text-destructive tabular-nums">{sqft(row.original.wasteSqft)}</span>
                    ) : (
                        <span className="text-muted-foreground">–</span>
                    ),
            },
            {
                accessorKey: 'workerName',
                header: t('columns.worker'),
                cell: ({ row }) =>
                    row.original.workerName ? (
                        <div className="flex flex-col">
                            <span>{row.original.workerName}</span>
                            <span className="text-muted-foreground text-xs tabular-nums">{money(row.original.workerAmount)}</span>
                        </div>
                    ) : (
                        <span className="text-muted-foreground">–</span>
                    ),
            },
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [t, format, money]
    )

    const select = (value: string, onChange: (v: string) => void, allLabel: string, options: { value: string; label: string }[]) => (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="w-40">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={ALL}>{allLabel}</SelectItem>
                {options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                        {o.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
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
                onRowClick={(row) => setOpenId(row.id)}
                toolbar={
                    <div className="flex flex-wrap gap-2">
                        {select(type, (v) => setType(v as EntryType | typeof ALL), t('filters.allSteps'), entryTypes.map((s) => ({ value: s, label: t(`types.${s}`) })))}
                        {select(material, setMaterial, t('filters.allMaterials'), materials.map((m) => ({ value: m, label: m })))}
                        {select(factoryId, setFactoryId, t('filters.allFactories'), (factories.data ?? []).filter((f) => f.kind === 'own').map((f) => ({ value: f.id, label: f.name })))}
                        <DateRangePicker value={range} onChange={setRange} placeholder={t('filters.dates')} clearLabel={tc('cancel')} className="w-56" />
                    </div>
                }
            />

            <Sheet open={!!opened} onOpenChange={(open) => !open && setOpenId(null)}>
                <SheetContent side={isRtl ? 'left' : 'right'} className="w-full overflow-y-auto sm:max-w-lg">
                    {opened && (
                        <>
                            <SheetHeader>
                                <SheetTitle className="flex items-center gap-2">
                                    {opened.entryNo} <Badge variant="outline">{t(`types.${opened.type}`)}</Badge>
                                </SheetTitle>
                                <SheetDescription>
                                    {format.dateTime(new Date(`${opened.date}T00:00:00`), { dateStyle: 'medium' })} · {opened.material} ·{' '}
                                    {opened.factoryName} · {t('enteredBy', { name: opened.createdBy })}
                                </SheetDescription>
                            </SheetHeader>
                            <div className="flex flex-col gap-4 px-4 pb-4">
                                {markOf(opened) && <p className="text-sm">{t('forTruck', { mark: markOf(opened) ?? '' })}</p>}
                                {(['in', 'out'] as const).map((direction) => {
                                    const rows = opened.lines.filter((l) => l.direction === direction)
                                    if (rows.length === 0) return null
                                    return (
                                        <div key={direction}>
                                            <h3 className="mb-2 text-sm font-medium">{t(direction === 'in' ? 'in' : 'out')}</h3>
                                            <ul className="flex flex-col gap-1 text-sm">
                                                {rows.map((line, i) => (
                                                    <li key={i} className="flex justify-between gap-3">
                                                        <span>{lineText(line)}</span>
                                                        <span className="text-muted-foreground tabular-nums">
                                                            {line.item.itemType === 'slab' ? '' : `${sqft(sqFtOf(line))} ${t('sqft')}`}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )
                                })}
                                <dl className="grid grid-cols-3 gap-2 text-sm">
                                    <div>
                                        <dt className="text-muted-foreground text-xs">{t('columns.waste')}</dt>
                                        <dd className={opened.wasteSqft ? 'text-destructive font-medium' : 'font-medium'}>
                                            {opened.wasteSqft ? `${sqft(opened.wasteSqft)} ${t('sqft')}` : '–'}
                                        </dd>
                                    </div>
                                    <div className="col-span-2">
                                        <dt className="text-muted-foreground text-xs">{t('columns.worker')}</dt>
                                        <dd className="font-medium">
                                            {opened.workerName ? `${opened.workerName} · ${money(opened.workerAmount)}` : '–'}
                                        </dd>
                                    </div>
                                </dl>
                                {opened.note && <p className="text-sm">{opened.note}</p>}
                                {opened.status === 'reversed' ? (
                                    <p className="text-destructive text-sm">{t('reversedNote')}</p>
                                ) : (
                                    canReverse && (
                                        <div>
                                            <Button variant="outline" onClick={() => setReversing(opened)}>
                                                <Undo2 /> {t('reverse')}
                                            </Button>
                                        </div>
                                    )
                                )}
                            </div>
                        </>
                    )}
                </SheetContent>
            </Sheet>

            <ConfirmDialog
                open={!!reversing}
                onOpenChange={(open) => !open && setReversing(null)}
                title={t('reverseDialog.title', { no: reversing?.entryNo ?? '' })}
                description={t('reverseDialog.description')}
                confirmLabel={t('reverse')}
                cancelLabel={tc('cancel')}
                loading={reverse.isPending}
                onConfirm={() => reversing && reverse.mutate(reversing)}
            />
        </>
    )
}
