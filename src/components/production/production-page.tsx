'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Check, MoreHorizontal, PackageCheck, Plus, Settings, TriangleAlert, Truck, X } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { DataTable } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard, StatCardGrid } from '@/components/shared/stat-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { canManageMembers, canOperateProduction, canViewSettings } from '@/features/admin/roles'
import { customerKhataQueryKey, customersQueryKey } from '@/features/customers'
import { balanceDueOf, cancelJob, cuttingJobsQueryKey, deliverJob } from '@/features/cutting-jobs'
import { factoriesQueryKey, listFactories } from '@/features/factories'
import {
    listCuttingRows,
    listMachineLoad,
    listOutputToCount,
    productionQueryKey,
    startAtOtherFactory,
    viewOf,
    type CuttingFilters,
    type CuttingRow,
    type CuttingStatus,
} from '@/features/production'
import { purchasesQueryKey } from '@/features/purchases'
import { shortOrderLines } from '@/features/sales'
import { useItemText } from '@/components/inventory/use-item-text'
import { useTableLabels } from '@/features/resource-labels'
import { useProductionErrorMessage } from '@/features/use-production-error-message'
import { Link } from '@/i18n/navigation'
import { useMoney } from '@/hooks/use-money'
import { todayIso } from '@/lib/format'
import { CustomerFinishDialog } from './customer-finish-dialog'
import { CustomersTab } from './customers-tab'
import { EntryDialog, type EntryPreset } from './entry-dialog'
import { EntryLog } from './entry-log'
import { FinishDialog } from './finish-dialog'
import { ReceivePaymentSheet } from '@/components/sales/receive-payment-sheet'
import { ReceiveJobSheet } from './receive-job-sheet'
import { SendDialog } from './send-dialog'

const ALL = 'all'

type Tab = 'cutting' | 'customers' | 'log'

/**
 * Production → Cutting: every truck waiting to cut or on a machine, ours and cutting customers',
 * oldest first. The Action column has Send (or Start at another factory), Finish and, for a
 * customer's cut truck, Delivered.
 */
export function ProductionPage({ roleKey, userName }: { roleKey: string; userName: string }) {
    const t = useTranslations('production')
    const tm = useTranslations('settings.machines.type')
    const format = useFormatter()
    const money = useMoney()
    const labels = useTableLabels()
    const queryClient = useQueryClient()
    const errorMessage = useProductionErrorMessage()
    const canOperate = canOperateProduction(roleKey)
    const itemText = useItemText()

    const [tab, setTab] = useState<Tab>('cutting')
    const [entry, setEntry] = useState<EntryPreset | null>(null)
    const [receive, setReceive] = useState<{ customerId?: string } | null>(null)
    const [receivePay, setReceivePay] = useState<string | null>(null)
    const [status, setStatus] = useState<CuttingStatus | typeof ALL>(ALL)
    const [whose, setWhose] = useState<'own' | 'customer' | typeof ALL>(ALL)
    const [material, setMaterial] = useState(ALL)
    const [factoryId, setFactoryId] = useState(ALL)
    const [machine, setMachine] = useState(ALL)
    const [sending, setSending] = useState<CuttingRow | null>(null)
    const [finishing, setFinishing] = useState<CuttingRow | null>(null)
    const [starting, setStarting] = useState<CuttingRow | null>(null)
    const [delivering, setDelivering] = useState<CuttingRow | null>(null)
    const [cancelling, setCancelling] = useState<CuttingRow | null>(null)

    const filters = useMemo<CuttingFilters>(
        () => ({
            ...(status !== ALL && { status }),
            ...(whose !== ALL && { whose }),
            ...(material !== ALL && { material }),
            ...(factoryId !== ALL && { factoryId }),
            ...(machine !== ALL && { machine }),
        }),
        [status, whose, material, factoryId, machine]
    )

    const list = useQuery({ queryKey: [productionQueryKey, 'rows', filters], queryFn: () => listCuttingRows(filters) })
    // The cards count everything, whatever the table is filtered to.
    const all = useQuery({ queryKey: [productionQueryKey, 'rows', 'all'], queryFn: () => listCuttingRows() })
    const toCount = useQuery({ queryKey: [productionQueryKey, 'to-count'], queryFn: listOutputToCount })
    const load = useQuery({ queryKey: [productionQueryKey, 'machine-load'], queryFn: listMachineLoad })
    const factories = useQuery({ queryKey: [factoriesQueryKey], queryFn: listFactories })

    const refresh = () => {
        for (const key of [productionQueryKey, purchasesQueryKey, cuttingJobsQueryKey, customersQueryKey, customerKhataQueryKey]) {
            queryClient.invalidateQueries({ queryKey: [key] })
        }
    }

    const start = useMutation({
        mutationFn: (row: CuttingRow) => startAtOtherFactory(row.id, todayIso()),
        onSuccess: (purchase) => {
            toast.success(t('started', { mark: purchase.mark ?? '', factory: purchase.factoryName }))
            setStarting(null)
            refresh()
        },
        onError: (error) => {
            toast.error(errorMessage(error))
            setStarting(null)
        },
    })

    const deliver = useMutation({
        mutationFn: (row: CuttingRow) => deliverJob(row.id),
        onSuccess: (job) => {
            toast.success(t('customers.delivered', { customer: job.customerName, truck: job.truckNo }))
            setDelivering(null)
            refresh()
        },
        onError: (error) => {
            toast.error(errorMessage(error))
            setDelivering(null)
        },
    })

    const cancel = useMutation({
        mutationFn: (row: CuttingRow) => cancelJob(row.id),
        onSuccess: () => {
            toast.success(t('customers.cancelled'))
            setCancelling(null)
            refresh()
        },
        onError: (error) => {
            toast.error(errorMessage(error))
            setCancelling(null)
        },
    })

    // Open orders that have more stone ordered than is ready: Production is asked to make the rest.
    const shortOrders = shortOrderLines()
    const rows = all.data ?? []
    const waiting = rows.filter((r) => r.status === 'waiting')
    const cutting = rows.filter((r) => r.status === 'cutting')
    const ready = rows.flatMap((r) => (r.kind === 'customer' && r.status === 'ready' ? [r] : []))
    const machines = load.data?.machines ?? []
    const idle = machines.filter((m) => !(load.data?.onMachine[m.id] ?? 0))
    const oldest = waiting.length ? Math.max(...waiting.map((r) => r.days)) : 0
    const tons = (value: number) => format.number(value, { maximumFractionDigits: 1 })
    const materials = [...new Set(rows.map((r) => viewOf(r).material))].sort()

    // Counting a cut truck's output is a cutting-output entry for that truck.
    const countOutput = (purchaseId: string) => setEntry({ type: 'cut', purchaseId })

    const columns = useMemo<ColumnDef<CuttingRow>[]>(
        () => [
            {
                id: 'date',
                accessorFn: (r) => viewOf(r).date,
                header: t('columns.markDate'),
                cell: ({ row }) => {
                    const v = viewOf(row.original)
                    return (
                        <div className="flex flex-col items-start">
                            {row.original.kind === 'own' ? (
                                <span className="text-primary font-semibold tabular-nums" dir="ltr">
                                    {v.tag}
                                </span>
                            ) : (
                                <span className="bg-info/15 text-info rounded px-1.5 py-0.5 text-xs font-semibold" dir="ltr">
                                    {v.truckNo}
                                </span>
                            )}
                            <span className="text-muted-foreground mt-0.5 text-xs">
                                {format.dateTime(new Date(`${v.date}T00:00:00`), { dateStyle: 'medium' })}
                            </span>
                        </div>
                    )
                },
            },
            {
                id: 'material',
                accessorFn: (r) => {
                    const v = viewOf(r)
                    return `${v.material} ${v.sub} ${v.truckNo} ${v.tag}`
                },
                header: t('columns.material'),
                cell: ({ row }) => {
                    const v = viewOf(row.original)
                    return (
                        <div className="flex flex-col">
                            <span className="font-medium">{v.material}</span>
                            <span className="text-muted-foreground text-xs">
                                {row.original.kind === 'customer' && (
                                    <span className="bg-info/15 text-info me-1 rounded px-1 text-[11px] font-semibold">
                                        {t('customerTag')}
                                    </span>
                                )}
                                {v.sub}
                            </span>
                        </div>
                    )
                },
            },
            {
                id: 'tons',
                accessorFn: (r) => viewOf(r).tons,
                header: t('columns.tons'),
                meta: { className: 'text-end' },
                cell: ({ row }) => {
                    const v = viewOf(row.original)
                    return (
                        <div className="flex flex-col tabular-nums">
                            <span>{format.number(v.tons, { minimumFractionDigits: 2 })}</span>
                            {v.stones != null && (
                                <span className="text-muted-foreground text-xs">
                                    {v.stones} {t('stones')}
                                </span>
                            )}
                        </div>
                    )
                },
            },
            {
                id: 'factory',
                accessorFn: (r) => viewOf(r).factoryName,
                header: t('columns.factory'),
                cell: ({ row }) => (
                    <div className="flex flex-col">
                        <span>{viewOf(row.original).factoryName}</span>
                        {row.original.atOtherFactory && <span className="text-muted-foreground text-xs">{t('otherFactory')}</span>}
                    </div>
                ),
            },
            {
                accessorKey: 'status',
                header: t('columns.status'),
                cell: ({ row }) => {
                    const r = row.original
                    const v = viewOf(r)
                    if (r.status === 'waiting') return <StatusBadge tone="warning">{t('filters.waiting')}</StatusBadge>
                    if (r.status === 'ready') {
                        return (
                            <div className="flex flex-col items-start gap-0.5">
                                <StatusBadge tone="success">{t('filters.ready')}</StatusBadge>
                                {r.kind === 'customer' && (
                                    <span className="text-muted-foreground text-xs tabular-nums">
                                        {r.job.sqft} {t('customers.sqft')}
                                    </span>
                                )}
                            </div>
                        )
                    }
                    if (r.atOtherFactory) {
                        return <span className="font-medium">{t('atOtherFactory', { factory: v.factoryName })}</span>
                    }
                    return (
                        <div className="flex flex-col">
                            <span className="font-medium">{v.machineName}</span>
                            <span className="text-muted-foreground text-xs">{v.thekadarName ?? t('noThekadar')}</span>
                        </div>
                    )
                },
            },
            {
                accessorKey: 'days',
                header: t('columns.days'),
                meta: { className: 'text-end' },
                cell: ({ row }) => (
                    <div className="flex flex-col tabular-nums">
                        <span className={row.original.status === 'waiting' && row.original.days >= 90 ? 'text-destructive' : undefined}>
                            {row.original.days}
                        </span>
                        <span className="text-muted-foreground text-xs">
                            {row.original.status === 'waiting' ? t('inYard') : row.original.status === 'ready' ? t('ready') : t('onMachine')}
                        </span>
                    </div>
                ),
            },
            {
                id: 'action',
                header: () => <span className="sr-only">{t('columns.action')}</span>,
                enableSorting: false,
                cell: ({ row }) => {
                    const r = row.original
                    if (!canOperate) return null
                    if (r.status === 'ready') {
                        return (
                            <Button size="sm" variant="secondary" onClick={() => setDelivering(r)}>
                                <PackageCheck /> {t('customers.deliveredAction')}
                            </Button>
                        )
                    }
                    if (r.status === 'cutting') {
                        return (
                            <Button size="sm" variant="secondary" onClick={() => setFinishing(r)}>
                                <Check /> {t('finish')}
                            </Button>
                        )
                    }
                    return (
                        <div className="flex items-center gap-1">
                            <Button size="sm" onClick={() => (r.atOtherFactory ? setStarting(r) : setSending(r))}>
                                {r.atOtherFactory ? t('start') : t('send')} <ArrowRight className="rtl:rotate-180" />
                            </Button>
                            {r.kind === 'customer' && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="size-8" aria-label={t('columns.action')}>
                                            <MoreHorizontal />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem variant="destructive" onClick={() => setCancelling(r)}>
                                            <X /> {t('customers.cancelTruck')}
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>
                    )
                },
            },
        ],
        [t, format, canOperate]
    )

    const select = (
        value: string,
        onChange: (value: string) => void,
        allLabel: string,
        options: { value: string; label: string }[],
        width = 'w-44'
    ) => (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className={width}>
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

    const delJob = delivering?.kind === 'customer' ? delivering.job : null
    const due = delJob ? balanceDueOf(delJob) : 0

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title={t('title')}
                description={t('description')}
                actions={
                    <>
                        {canViewSettings(roleKey) && (
                            <Button variant="outline" asChild>
                                <Link href="/settings/machines">
                                    <Settings /> {t('manageMachines')}
                                </Link>
                            </Button>
                        )}
                        {canOperate && (
                            <Button variant="outline" onClick={() => setReceive({})}>
                                <Truck /> {t('customers.receive')}
                            </Button>
                        )}
                        {canOperate && (
                            <Button onClick={() => setEntry({})}>
                                <Plus /> {t('entries.open')}
                            </Button>
                        )}
                    </>
                }
            />

            {((toCount.data ?? []).length > 0 || ready.length > 0 || shortOrders.length > 0) && (
                <div className="bg-muted flex flex-wrap items-center gap-2 rounded-lg border px-4 py-2 text-sm">
                    <TriangleAlert className="text-warning size-4" />
                    <span className="font-medium">{t('attention.title')}</span>
                    {(toCount.data ?? []).map((p) => (
                        <Button key={p.id} variant="link" className="h-auto p-0" onClick={() => countOutput(p.id)}>
                            {t('attention.countOutput', { mark: p.mark ?? '' })}
                        </Button>
                    ))}
                    {shortOrders.map((s) => (
                        <Link key={`${s.orderNo}-${itemText(s.item)}`} href="/sales" className="text-primary text-sm underline-offset-4 hover:underline">
                            {t('attention.orderShort', { no: s.orderNo, customer: s.customerName, count: s.short, unit: s.counter ? t('attention.inches') : t('attention.pcs'), item: itemText(s.item) })}
                        </Link>
                    ))}
                    {ready.map((r) => (
                        <Button
                            key={r.id}
                            variant="link"
                            className="h-auto p-0"
                            onClick={() => {
                                setTab('cutting')
                                setStatus('ready')
                            }}
                        >
                            {t('attention.readyToCollect', { customer: r.job.customerName })}
                        </Button>
                    ))}
                </div>
            )}

            <StatCardGrid className="@5xl/main:grid-cols-5">
                <StatCard
                    compact
                    label={t('kpi.waiting')}
                    value={String(waiting.length)}
                    note={
                        waiting.length
                            ? t('kpi.waitingNote', { tons: tons(waiting.reduce((s, r) => s + viewOf(r).tons, 0)), days: oldest })
                            : t('kpi.nothingWaiting')
                    }
                    negative={oldest >= 90}
                />
                <StatCard
                    compact
                    label={t('kpi.onMachines')}
                    value={String(cutting.length)}
                    note={t('kpi.tonsBeingCut', { tons: tons(cutting.reduce((s, r) => s + viewOf(r).tons, 0)) })}
                />
                <StatCard compact label={t('kpi.idle')} value={String(idle.length)} note={t('kpi.idleNote', { total: machines.length })} />
                <StatCard
                    compact
                    label={t('kpi.toCount')}
                    value={String((toCount.data ?? []).length)}
                    note={(toCount.data ?? []).length ? t('kpi.toCountNote') : t('kpi.allCounted')}
                    negative={(toCount.data ?? []).length > 0}
                />
                <StatCard
                    compact
                    label={t('kpi.toCollect')}
                    value={String(ready.length)}
                    note={
                        ready.length
                            ? t('kpi.toCollectNote', { sqft: format.number(ready.reduce((s, r) => s + (r.job.sqft ?? 0), 0)) })
                            : t('kpi.nothingToCollect')
                    }
                />
            </StatCardGrid>

            <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
                <TabsList>
                    {(['cutting', 'customers', 'log'] as const).map((value) => (
                        <TabsTrigger key={value} value={value}>
                            {t(`tabs.${value}`)}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>

            {/* Without this a stopped server would read as "No records found". */}
            {tab === 'log' ? (
                <EntryLog canReverse={canManageMembers(roleKey)} />
            ) : tab === 'customers' ? (
                <CustomersTab canOperate={canOperate} onReceive={(customerId) => setReceive({ customerId })} onReceivePayment={setReceivePay} />
            ) : list.isError ? (
                <EmptyState
                    title={t('loadFailed')}
                    icon={TriangleAlert}
                    action={
                        <Button variant="outline" onClick={() => list.refetch()}>
                            {t('retry')}
                        </Button>
                    }
                />
            ) : (
                <DataTable
                    columns={columns}
                    data={list.data ?? []}
                    labels={labels}
                    loading={list.isLoading}
                    pageSize={25}
                    toolbar={
                        <div className="flex flex-wrap gap-2">
                            {select(status, (v) => setStatus(v as CuttingStatus | typeof ALL), t('filters.allStatuses'), [
                                { value: 'waiting', label: t('filters.waiting') },
                                { value: 'cutting', label: t('filters.cutting') },
                                { value: 'ready', label: t('filters.ready') },
                            ])}
                            {select(whose, (v) => setWhose(v as 'own' | 'customer' | typeof ALL), t('filters.allStone'), [
                                { value: 'own', label: t('filters.ours') },
                                { value: 'customer', label: t('filters.customers') },
                            ])}
                            {select(material, setMaterial, t('filters.allMaterials'), materials.map((m) => ({ value: m, label: m })))}
                            {select(
                                factoryId,
                                setFactoryId,
                                t('filters.allFactories'),
                                (factories.data ?? []).map((f) => ({ value: f.id, label: f.name }))
                            )}
                            {select(machine, setMachine, t('filters.allMachines'), [
                                ...machines.map((m) => ({ value: m.id, label: `${m.name} (${tm(m.type)})` })),
                                { value: 'other', label: t('filters.otherFactories') },
                            ])}
                        </div>
                    }
                />
            )}

            <SendDialog row={sending} onClose={() => setSending(null)} />

            <FinishDialog
                row={finishing?.kind === 'own' ? finishing : null}
                onClose={() => setFinishing(null)}
                // Counting the output opens straight after finishing.
                onFinished={(purchaseId) => countOutput(purchaseId)}
            />

            <CustomerFinishDialog row={finishing?.kind === 'customer' ? finishing : null} onClose={() => setFinishing(null)} />

            <ReceivePaymentSheet
                open={receivePay !== null}
                onOpenChange={(open) => !open && setReceivePay(null)}
                userName={userName}
                preset={receivePay ? { customerId: receivePay } : undefined}
            />
            <ReceiveJobSheet
                open={receive !== null}
                onOpenChange={(open) => !open && setReceive(null)}
                customerId={receive?.customerId}
                userName={userName}
            />

            <EntryDialog open={entry !== null} preset={entry ?? {}} userName={userName} onClose={() => setEntry(null)} />

            <ConfirmDialog
                open={!!starting}
                onOpenChange={(open) => !open && setStarting(null)}
                title={t('startDialog.title', { mark: starting ? viewOf(starting).tag : '' })}
                description={t('startDialog.description', { factory: starting ? viewOf(starting).factoryName : '' })}
                confirmLabel={t('startDialog.submit')}
                cancelLabel={t('startDialog.cancel')}
                destructive={false}
                loading={start.isPending}
                onConfirm={() => starting && start.mutate(starting)}
            />

            <ConfirmDialog
                open={!!delivering}
                onOpenChange={(open) => !open && setDelivering(null)}
                title={t('customers.deliverTitle', { customer: delJob?.customerName ?? '' })}
                description={
                    delJob
                        ? due > 0
                            ? t('customers.deliverDue', { truck: delJob.truckNo, sqft: delJob.sqft ?? 0, amount: money(due) })
                            : t('customers.deliverDescription', { truck: delJob.truckNo, sqft: delJob.sqft ?? 0 })
                        : ''
                }
                confirmLabel={t('customers.deliverSubmit')}
                cancelLabel={t('startDialog.cancel')}
                destructive={false}
                loading={deliver.isPending}
                onConfirm={() => delivering && deliver.mutate(delivering)}
            />

            <ConfirmDialog
                open={!!cancelling}
                onOpenChange={(open) => !open && setCancelling(null)}
                title={t('customers.cancelTitle', { truck: cancelling ? viewOf(cancelling).truckNo : '' })}
                description={t('customers.cancelDescription')}
                confirmLabel={t('customers.cancelTruck')}
                cancelLabel={t('startDialog.cancel')}
                loading={cancel.isPending}
                onConfirm={() => cancelling && cancel.mutate(cancelling)}
            />
        </div>
    )
}
