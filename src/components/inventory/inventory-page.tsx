'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useQuery } from '@tanstack/react-query'
import { Plus, TriangleAlert } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataTable } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard, StatCardGrid } from '@/components/shared/stat-card'
import { canApprovePurchases, canEnterPurchases, canManageMembers } from '@/features/admin/roles'
import { factoriesQueryKey, listFactories } from '@/features/factories'
import { inventoryQueryKey, listInventory, type InventoryRow } from '@/features/inventory'
import { pieceSizes, sizeLabel, sootTypes, sqFtOfSize } from '@/features/piece-sizes'
import { useTableLabels } from '@/features/resource-labels'
import { listStockEntries, pendingStockEntries, stockEntriesQueryKey } from '@/features/stock-entries'
import { useMoney } from '@/hooks/use-money'
import { cn } from '@/lib/utils'
import { ItemPanel } from './item-panel'
import { StockEntriesTab } from './stock-entries-tab'
import { StockEntryDialog } from './stock-entry-dialog'
import { useItemText } from './use-item-text'

const ALL = 'all'

type Tab = 'pieces' | 'counters' | 'slabs' | 'entries'

type Filters = { material: string; soot: string; finish: string; factoryId: string; lowOnly: boolean }
const NO_FILTERS: Filters = { material: ALL, soot: ALL, finish: ALL, factoryId: ALL, lowOnly: false }

/**
 * Our own stock, view-only: pieces, counters and slabs, each one table and one filter row. Stock changes
 * only through production, sales and a Stock Entry (with a reason, and the owner's approval for a munshi).
 */
export function InventoryPage({ roleKey, userName }: { roleKey: string; userName: string }) {
    const t = useTranslations('inventory')
    const format = useFormatter()
    const money = useMoney()
    const labels = useTableLabels()
    const itemText = useItemText()
    const canViewValue = canManageMembers(roleKey)
    const canApprove = canApprovePurchases(roleKey)
    const canEnter = canEnterPurchases(roleKey)

    const [tab, setTab] = useState<Tab>('pieces')
    const [filters, setFilters] = useState<Filters>(NO_FILTERS)
    const [entryOpen, setEntryOpen] = useState(false)
    const [openKey, setOpenKey] = useState<string | null>(null)
    const [entriesStatus, setEntriesStatus] = useState<'pending' | undefined>()

    const inventory = useQuery({ queryKey: [inventoryQueryKey], queryFn: listInventory })
    const factories = useQuery({ queryKey: [factoriesQueryKey], queryFn: listFactories })
    // Only to refresh the "to approve" count when entries change.
    useQuery({ queryKey: [stockEntriesQueryKey, 'count'], queryFn: () => listStockEntries({ status: 'pending' }) })

    const all = inventory.data ?? []
    const factoryName = (id: string) => factories.data?.find((f) => f.id === id)?.name ?? id
    const opened = all.find((r) => r.key === openKey) ?? null

    const pieces = all.filter((r) => r.item.itemType === 'piece')
    const counters = all.filter((r) => r.item.itemType === 'counter')
    const slabs = all.filter((r) => r.item.itemType === 'slab')
    const low = all.filter((r) => r.low)
    const pendingCount = pendingStockEntries().length
    const knownValue = all.reduce((s, r) => s + (r.value ?? 0), 0)

    const sumSqft = (rows: InventoryRow[]) => rows.reduce((s, r) => s + r.sqft, 0)
    const polishedSqft = pieces.filter((r) => 'finish' in r.item && r.item.finish === 'polished').reduce((s, r) => s + r.sqft, 0)

    const switchTab = (next: Tab) => {
        // Filters reset when switching tabs.
        setTab(next)
        setFilters(NO_FILTERS)
        setEntriesStatus(undefined)
    }

    const rowsFor = (source: InventoryRow[]) =>
        source.filter((r) => {
            const item = r.item
            return (
                (filters.material === ALL || item.material === filters.material) &&
                (filters.factoryId === ALL || item.factoryId === filters.factoryId) &&
                (filters.soot === ALL || (item.itemType === 'piece' && item.soot === filters.soot)) &&
                (filters.finish === ALL || (item.itemType !== 'slab' && item.finish === filters.finish)) &&
                (!filters.lowOnly || r.low)
            )
        })

    const sortKey = (r: InventoryRow) => {
        const i = r.item
        return i.itemType === 'piece'
            ? `${i.material}|${sootTypes.indexOf(i.soot as (typeof sootTypes)[number])}|${String(pieceSizes[i.soot as (typeof sootTypes)[number]]?.indexOf(i.size) ?? 99).padStart(2, '0')}|${i.finish}`
            : i.itemType === 'counter'
              ? `${i.material}|${String(1000 - i.width).padStart(4, '0')}|${i.finish}`
              : i.material
    }
    const sorted = (rows: InventoryRow[]) => [...rows].sort((a, b) => sortKey(a).localeCompare(sortKey(b)))

    const qty = (r: InventoryRow) => (
        <div className="flex flex-col tabular-nums">
            <b className={cn(r.low && 'text-destructive')}>{format.number(r.qty)}</b>
            {r.reserved > 0 && (
                <span className="text-muted-foreground text-xs">{t('availableNote', { count: format.number(r.available) })}</span>
            )}
            {r.minQty !== null && (
                <span className={cn('text-xs', r.low ? 'text-destructive' : 'text-muted-foreground')}>{t('alertBelow', { count: r.minQty })}</span>
            )}
        </div>
    )
    const valueCell = (r: InventoryRow) => (r.value !== null ? <span className="tabular-nums">{money(r.value)}</span> : <span className="text-muted-foreground">—</span>)
    const material = (r: InventoryRow) => (
        <div className="flex flex-col">
            <span className="font-medium">{r.item.material}</span>
            <span className="text-muted-foreground text-xs">{factoryName(r.item.factoryId)}</span>
        </div>
    )
    const finishBadge = (r: InventoryRow) =>
        r.item.itemType === 'slab' ? null : <Badge variant="outline">{t(`item.finishes.${r.item.finish}`)}</Badge>
    const num = 'text-end'

    const pieceColumns = useMemo<ColumnDef<InventoryRow>[]>(
        () => [
            { id: 'material', accessorFn: (r) => `${r.item.material} ${factoryName(r.item.factoryId)}`, header: t('columns.material'), cell: ({ row }) => material(row.original) },
            { id: 'soot', accessorFn: (r) => (r.item.itemType === 'piece' ? r.item.soot : ''), header: t('columns.soot'), cell: ({ row }) => (row.original.item.itemType === 'piece' ? t('item.sootLabel', { soot: row.original.item.soot }) : '') },
            {
                id: 'size',
                accessorFn: (r) => (r.item.itemType === 'piece' ? sqFtOfSize(r.item.size) : 0),
                header: t('columns.size'),
                cell: ({ row }) => (row.original.item.itemType === 'piece' ? <b dir="ltr">{sizeLabel(row.original.item.size)}</b> : null),
            },
            { id: 'finish', accessorFn: (r) => (r.item.itemType === 'slab' ? '' : r.item.finish), header: t('columns.finish'), cell: ({ row }) => finishBadge(row.original) },
            { accessorKey: 'qty', header: t('columns.pieces'), meta: { className: num }, cell: ({ row }) => qty(row.original) },
            { accessorKey: 'sqft', header: t('columns.sqft'), meta: { className: num }, cell: ({ row }) => <span className="tabular-nums">{format.number(row.original.sqft, { maximumFractionDigits: 1 })}</span> },
            ...(canViewValue
                ? ([
                      { accessorKey: 'costPerSqft', header: t('columns.costSqft'), meta: { className: num }, cell: ({ row }) => (row.original.costPerSqft !== null ? <span className="tabular-nums">{money(Math.round(row.original.costPerSqft))}</span> : <span className="text-muted-foreground">—</span>) },
                      { accessorKey: 'value', header: t('columns.value'), meta: { className: num }, cell: ({ row }) => valueCell(row.original) },
                  ] as ColumnDef<InventoryRow>[])
                : []),
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [t, format, money, canViewValue, factories.data]
    )

    const counterColumns = useMemo<ColumnDef<InventoryRow>[]>(
        () => [
            { id: 'material', accessorFn: (r) => `${r.item.material} ${factoryName(r.item.factoryId)}`, header: t('columns.material'), cell: ({ row }) => material(row.original) },
            { id: 'width', accessorFn: (r) => (r.item.itemType === 'counter' ? r.item.width : 0), header: t('columns.width'), meta: { className: num }, cell: ({ row }) => (row.original.item.itemType === 'counter' ? <b>{t('item.widthIn', { width: row.original.item.width })}</b> : null) },
            { id: 'finish', accessorFn: (r) => (r.item.itemType === 'slab' ? '' : r.item.finish), header: t('columns.finish'), cell: ({ row }) => finishBadge(row.original) },
            { accessorKey: 'qty', header: t('columns.pieces'), meta: { className: num }, cell: ({ row }) => qty(row.original) },
            {
                accessorKey: 'inches',
                header: t('columns.length'),
                meta: { className: num },
                cell: ({ row }) => (
                    <div className="flex flex-col tabular-nums">
                        <b>{format.number(row.original.inches)} {t('inches')}</b>
                        <span className="text-muted-foreground text-xs">{t('feet', { count: format.number(row.original.inches / 12, { maximumFractionDigits: 1 }) })}</span>
                    </div>
                ),
            },
            { accessorKey: 'sqft', header: t('columns.sqft'), meta: { className: num }, cell: ({ row }) => <span className="tabular-nums">{format.number(row.original.sqft, { maximumFractionDigits: 1 })}</span> },
            ...(canViewValue ? ([{ accessorKey: 'value', header: t('columns.value'), meta: { className: num }, cell: ({ row }) => valueCell(row.original) }] as ColumnDef<InventoryRow>[]) : []),
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [t, format, money, canViewValue, factories.data]
    )

    const slabColumns = useMemo<ColumnDef<InventoryRow>[]>(
        () => [
            { id: 'material', accessorFn: (r) => r.item.material, header: t('columns.material'), cell: ({ row }) => <span className="font-medium">{row.original.item.material}</span> },
            { id: 'factory', accessorFn: (r) => factoryName(r.item.factoryId), header: t('columns.factory') },
            { accessorKey: 'qty', header: t('columns.slabs'), meta: { className: num }, cell: ({ row }) => qty(row.original) },
            {
                id: 'weight',
                accessorFn: (r) => r.qty * (r.tonsPerSlab ?? 0),
                header: t('columns.weight'),
                meta: { className: num },
                cell: ({ row }) =>
                    row.original.tonsPerSlab ? (
                        <div className="flex flex-col tabular-nums">
                            <span>{format.number(row.original.qty * row.original.tonsPerSlab, { maximumFractionDigits: 1 })} t</span>
                            <span className="text-muted-foreground text-xs">{t('avgPerSlab', { tons: format.number(row.original.tonsPerSlab, { maximumFractionDigits: 2 }) })}</span>
                        </div>
                    ) : (
                        <span className="text-muted-foreground">—</span>
                    ),
            },
            {
                id: 'trucks',
                header: t('columns.trucks'),
                enableSorting: false,
                cell: ({ row }) => (
                    <div className="flex flex-wrap gap-1">
                        {row.original.trucks.map((m) => (
                            <span key={m} className="text-primary font-semibold tabular-nums" dir="ltr">
                                {m}
                            </span>
                        ))}
                    </div>
                ),
            },
            ...(canViewValue ? ([{ accessorKey: 'value', header: t('columns.value'), meta: { className: num }, cell: ({ row }) => valueCell(row.original) }] as ColumnDef<InventoryRow>[]) : []),
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [t, format, money, canViewValue, factories.data]
    )

    const materials = [...new Set(all.map((r) => r.item.material))].sort()
    const filterSelect = (value: string, onChange: (v: string) => void, allLabel: string, options: { value: string; label: string }[]) => (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="w-44">
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
    const set = (patch: Partial<Filters>) => setFilters((cur) => ({ ...cur, ...patch }))

    const toolbar = (
        <div className="flex flex-wrap gap-2">
            {filterSelect(filters.material, (v) => set({ material: v }), t('filters.allMaterials'), materials.map((m) => ({ value: m, label: m })))}
            {tab === 'pieces' && filterSelect(filters.soot, (v) => set({ soot: v }), t('filters.allSoot'), sootTypes.map((s) => ({ value: s, label: t('item.sootLabel', { soot: s }) })))}
            {tab !== 'slabs' && filterSelect(filters.finish, (v) => set({ finish: v }), t('filters.allFinishes'), [{ value: 'unpolished', label: t('item.finishes.unpolished') }, { value: 'polished', label: t('item.finishes.polished') }])}
            {filterSelect(filters.factoryId, (v) => set({ factoryId: v }), t('filters.allFactories'), (factories.data ?? []).filter((f) => f.kind === 'own').map((f) => ({ value: f.id, label: f.name })))}
            <Button variant={filters.lowOnly ? 'default' : 'outline'} onClick={() => set({ lowOnly: !filters.lowOnly })}>
                {t('filters.lowOnly')}
            </Button>
        </div>
    )

    const table = (columns: ColumnDef<InventoryRow>[], source: InventoryRow[]) => (
        <DataTable columns={columns} data={sorted(rowsFor(source))} labels={labels} loading={inventory.isLoading} pageSize={25} onRowClick={(r) => setOpenKey(r.key)} toolbar={toolbar} />
    )

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title={t('title')}
                description={t('description')}
                actions={
                    canEnter && (
                        <Button onClick={() => setEntryOpen(true)}>
                            <Plus /> {t('entry.open')}
                        </Button>
                    )
                }
            />

            {(low.length > 0 || (canApprove && pendingCount > 0)) && (
                <div className="bg-muted flex flex-wrap items-center gap-2 rounded-lg border px-4 py-2 text-sm">
                    <TriangleAlert className="text-warning size-4" />
                    <span className="font-medium">{t('attention.title')}</span>
                    {low.map((r) => (
                        <Button key={r.key} variant="link" className="text-destructive h-auto p-0" onClick={() => setOpenKey(r.key)}>
                            {t('attention.low', { item: itemText(r.item), qty: format.number(r.qty), min: r.minQty ?? 0 })}
                        </Button>
                    ))}
                    {canApprove && pendingCount > 0 && (
                        <Button
                            variant="link"
                            className="h-auto p-0"
                            onClick={() => {
                                setTab('entries')
                                setFilters(NO_FILTERS)
                                setEntriesStatus('pending')
                            }}
                        >
                            {t('attention.toApprove', { count: pendingCount })}
                        </Button>
                    )}
                </div>
            )}

            <StatCardGrid className={canViewValue ? '@5xl/main:grid-cols-5' : '@5xl/main:grid-cols-4'}>
                <StatCard
                    compact
                    label={t('kpi.pieces')}
                    value={`${format.number(sumSqft(pieces), { maximumFractionDigits: 0 })} ${t('sqft')}`}
                    note={t('kpi.piecesNote', { pieces: format.number(pieces.reduce((s, r) => s + r.qty, 0)), polished: format.number(polishedSqft, { maximumFractionDigits: 0 }) })}
                />
                <StatCard
                    compact
                    label={t('kpi.counters')}
                    value={`${format.number(counters.reduce((s, r) => s + r.inches, 0))} ${t('inches')}`}
                    note={t('kpi.countersNote', { pieces: format.number(counters.reduce((s, r) => s + r.qty, 0)) })}
                />
                <StatCard compact label={t('kpi.slabs')} value={format.number(slabs.reduce((s, r) => s + r.qty, 0))} note={t('kpi.slabsNote')} />
                <StatCard compact label={t('kpi.low')} value={String(low.length)} note={low.length ? t('kpi.lowNote') : t('kpi.allAbove')} negative={low.length > 0} />
                {canViewValue && <StatCard compact label={t('kpi.value')} value={money(knownValue)} note={t('kpi.valueNote')} />}
            </StatCardGrid>

            <Tabs value={tab} onValueChange={(v) => switchTab(v as Tab)}>
                <TabsList>
                    {(['pieces', 'counters', 'slabs', 'entries'] as const).map((value) => (
                        <TabsTrigger key={value} value={value}>
                            {t(`tabs.${value}`)}
                            {value === 'entries' && canApprove && pendingCount > 0 && (
                                <span className="text-muted-foreground ms-1 text-xs">{pendingCount}</span>
                            )}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>

            {/* Without this a stopped server would read as "No records found". */}
            {inventory.isError ? (
                <EmptyState
                    title={t('loadFailed')}
                    icon={TriangleAlert}
                    action={
                        <Button variant="outline" onClick={() => inventory.refetch()}>
                            {t('retry')}
                        </Button>
                    }
                />
            ) : tab === 'entries' ? (
                <StockEntriesTab key={entriesStatus ?? 'all'} canApprove={canApprove} userName={userName} initialStatus={entriesStatus} />
            ) : tab === 'counters' ? (
                table(counterColumns, counters)
            ) : tab === 'slabs' ? (
                <>
                    {table(slabColumns, slabs)}
                    <p className="text-muted-foreground text-sm">{t('slabNote')}</p>
                </>
            ) : (
                table(pieceColumns, pieces)
            )}

            <ItemPanel row={opened} canViewValue={canViewValue} canSetAlert={canEnter} onClose={() => setOpenKey(null)} />
            <StockEntryDialog open={entryOpen} roleKey={roleKey} userName={userName} onClose={() => setEntryOpen(false)} />
        </div>
    )
}
