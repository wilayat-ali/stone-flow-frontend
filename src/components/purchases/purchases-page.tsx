'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Plus, TriangleAlert, Wallet } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RejectDialog } from '@/components/approvals/reject-dialog'
import { DataTable } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard, StatCardGrid } from '@/components/shared/stat-card'
import { canApprovePurchases, canEnterPurchases } from '@/features/admin/roles'
import { approvalsKey } from '@/features/approvals/api'
import { factoriesQueryKey, listFactories } from '@/features/factories'
import {
    approvePurchase,
    cancelPurchase,
    daysSince,
    listPurchases,
    purchaseStatuses,
    purchasesQueryKey,
    rejectPurchase,
    type Purchase,
    type PurchaseFilters,
    type PurchaseStatus,
} from '@/features/purchases'
import { useTableLabels } from '@/features/resource-labels'
import {
    chequesQueryKey,
    isDueThisWeek,
    listCheques,
    paymentsByPurchase,
    type Cheque,
} from '@/features/supplier-payments'
import { listSuppliers, suppliersQueryKey } from '@/features/suppliers'
import { usePurchaseErrorMessage } from '@/features/use-purchase-error-message'
import { useMoney } from '@/hooks/use-money'
import { ChequesTab } from './cheques-tab'
import { MarkDialog } from './mark-dialog'
import { PaymentSheet, type PaymentPreset } from './payment-sheet'
import { PaymentsTab } from './payments-tab'
import { PurchasePanel } from './purchase-panel'
import { PurchaseSheet } from './purchase-sheet'
import { PurchaseStatusBadge } from './purchase-status'

const AGE_OPTIONS = [30, 90, 180]

const ALL = 'all'

type Tab = 'purchases' | 'payments' | 'cheques'

const thisMonth = () => new Date().toISOString().slice(0, 7)

/**
 * Trucks bought from the kanta purchi: enter, approve, mark. Cutting is Production's job (05a), so
 * this page has no Send or Finish buttons. Payments, cheques and the khata tabs come with 04c.
 */
export function PurchasesPage({ roleKey, userName }: { roleKey: string; userName: string }) {
    const t = useTranslations('purchases')
    const tc = useTranslations('common')
    const format = useFormatter()
    const money = useMoney()
    const labels = useTableLabels()
    const queryClient = useQueryClient()
    const errorMessage = usePurchaseErrorMessage()
    const canEnter = canEnterPurchases(roleKey)
    const canApprove = canApprovePurchases(roleKey)

    const [tab, setTab] = useState<Tab>('purchases')
    const [payment, setPayment] = useState<PaymentPreset | null>(null)
    const [status, setStatus] = useState<PurchaseStatus | typeof ALL>(ALL)
    const [supplierId, setSupplierId] = useState(ALL)
    const [factoryId, setFactoryId] = useState(ALL)
    const [age, setAge] = useState(ALL)
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [sheet, setSheet] = useState<'add' | 'edit' | null>(null)
    const [rejecting, setRejecting] = useState<Purchase | null>(null)
    const [cancelling, setCancelling] = useState<Purchase | null>(null)
    const [marked, setMarked] = useState<Purchase | null>(null)

    const filters = useMemo<PurchaseFilters>(
        () => ({
            ...(status !== ALL && { status }),
            ...(supplierId !== ALL && { supplierId }),
            ...(factoryId !== ALL && { factoryId }),
            ...(age !== ALL && { ageDays: Number(age) }),
        }),
        [status, supplierId, factoryId, age]
    )

    const list = useQuery({ queryKey: [purchasesQueryKey, filters], queryFn: () => listPurchases(filters) })
    // The cards always count everything, whatever the table is filtered to.
    const all = useQuery({ queryKey: [purchasesQueryKey, 'all'], queryFn: () => listPurchases() })
    const suppliers = useQuery({ queryKey: [suppliersQueryKey, {}], queryFn: () => listSuppliers() })
    const factories = useQuery({ queryKey: [factoriesQueryKey], queryFn: listFactories })
    const cheques = useQuery({ queryKey: [chequesQueryKey], queryFn: listCheques })
    const selected = all.data?.find((p) => p.id === selectedId) ?? null

    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: [purchasesQueryKey] })
        queryClient.invalidateQueries({ queryKey: [suppliersQueryKey] })
        queryClient.invalidateQueries({ queryKey: approvalsKey })
    }

    const approve = useMutation({
        mutationFn: (purchase: Purchase) => approvePurchase(purchase.id, userName),
        onSuccess: (purchase) => {
            toast.success(t('approved'))
            refresh()
            setMarked(purchase)
        },
        onError: (error) => toast.error(errorMessage(error)),
    })

    const reject = useMutation({
        mutationFn: ({ purchase, reason }: { purchase: Purchase; reason: string }) =>
            rejectPurchase(purchase.id, reason, userName),
        onSuccess: () => {
            toast.success(t('rejected'))
            setRejecting(null)
            refresh()
        },
        onError: (error) => toast.error(errorMessage(error)),
    })

    const cancel = useMutation({
        mutationFn: ({ purchase, reason }: { purchase: Purchase; reason: string }) =>
            cancelPurchase(purchase.id, reason),
        onSuccess: () => {
            toast.success(t('cancelled'))
            setCancelling(null)
            refresh()
        },
        onError: (error) => toast.error(errorMessage(error)),
    })

    const rows = all.data ?? []
    // Re-worked whenever trucks or cheques change; payments are applied to trucks oldest first.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const paid = useMemo(() => paymentsByPurchase(), [all.dataUpdatedAt, cheques.dataUpdatedAt, list.dataUpdatedAt])
    const dueCheques = (cheques.data ?? []).filter(isDueThisWeek)
    const pending = rows.filter((p) => p.status === 'pending')
    const inStock = rows.filter((p) => p.status === 'in_stock')
    const monthTons = rows
        .filter((p) => ['in_stock', 'cutting', 'cut'].includes(p.status) && p.date.startsWith(thisMonth()))
        .reduce((sum, p) => sum + p.tons, 0)
    const payable = (suppliers.data ?? []).reduce((sum, s) => sum + Math.max(0, s.balance), 0)
    const tons = (value: number) => format.number(value, { maximumFractionDigits: 1 })

    const columns = useMemo<ColumnDef<Purchase>[]>(
        () => [
            {
                accessorKey: 'date',
                header: t('columns.markDate'),
                cell: ({ row }) => (
                    <div className="flex flex-col">
                        {row.original.mark ? (
                            <span className="text-primary font-semibold tabular-nums" dir="ltr">
                                {row.original.mark}
                            </span>
                        ) : (
                            <span className="text-muted-foreground">{t('noMarkYet')}</span>
                        )}
                        <span className="text-muted-foreground text-xs">
                            {format.dateTime(new Date(`${row.original.date}T00:00:00`), { dateStyle: 'medium' })}
                        </span>
                    </div>
                ),
            },
            {
                accessorKey: 'purchiNo',
                header: t('columns.purchiTruck'),
                cell: ({ row }) => (
                    <div className="flex flex-col">
                        <span className="font-medium">{row.original.purchiNo}</span>
                        <span className="text-muted-foreground text-xs">{row.original.truckNo}</span>
                    </div>
                ),
            },
            {
                accessorKey: 'supplierName',
                header: t('columns.supplier'),
                cell: ({ row }) => (
                    <div className="flex flex-col">
                        <span>{row.original.supplierName}</span>
                        <span className="text-muted-foreground text-xs">{row.original.material}</span>
                    </div>
                ),
            },
            {
                accessorKey: 'tons',
                header: t('columns.tonsRate'),
                meta: { className: 'text-end' },
                cell: ({ row }) => (
                    <div className="flex flex-col tabular-nums">
                        <span>{format.number(row.original.tons, { minimumFractionDigits: 2 })} t</span>
                        <span className="text-muted-foreground text-xs">× {money(row.original.ratePerTon)}</span>
                    </div>
                ),
            },
            {
                accessorKey: 'total',
                header: t('columns.total'),
                meta: { className: 'text-end' },
                cell: ({ row }) => (
                    <div className="flex flex-col tabular-nums">
                        <span className="font-medium">{money(row.original.total)}</span>
                        {row.original.discount > 0 && (
                            <span className="text-muted-foreground text-xs">
                                {t('discount', { amount: money(row.original.discount) })}
                            </span>
                        )}
                    </div>
                ),
            },
            { accessorKey: 'factoryName', header: t('columns.factory') },
            {
                id: 'payment',
                header: t('columns.payment'),
                enableSorting: false,
                cell: ({ row }) => {
                    const p = row.original
                    if (!['in_stock', 'cutting', 'cut'].includes(p.status)) return <span className="text-muted-foreground">–</span>
                    const info = paid.get(p.id) ?? { paid: 0, unclearedCheque: 0 }
                    const due = p.total - info.paid
                    return (
                        <div className="flex flex-col items-start gap-0.5">
                            <span className={due <= 0 ? 'text-success text-sm font-medium' : 'text-sm font-medium'}>
                                {due <= 0 ? t('payState.paid') : info.paid > 0 ? t('payState.partly') : t('payState.unpaid')}
                            </span>
                            {due > 0 && <span className="text-destructive text-xs tabular-nums">{t('payState.due', { amount: money(due) })}</span>}
                            {info.unclearedCheque > 0 && <span className="text-muted-foreground text-xs">{t('payState.chequePending')}</span>}
                        </div>
                    )
                },
            },
            {
                accessorKey: 'status',
                header: t('columns.status'),
                cell: ({ row }) => {
                    const p = row.original
                    return (
                        <div className="flex flex-col items-start gap-1">
                            <PurchaseStatusBadge status={p.status} />
                            {p.status === 'in_stock' && (
                                <span className={daysSince(p.date) >= 90 ? 'text-destructive text-xs' : 'text-muted-foreground text-xs'}>
                                    {t('daysInYard', { count: daysSince(p.date) })}
                                </span>
                            )}
                            {p.status === 'pending' &&
                                (canApprove ? (
                                    <Button
                                        size="sm"
                                        disabled={approve.isPending}
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            approve.mutate(p)
                                        }}
                                    >
                                        <Check /> {t('approve')}
                                    </Button>
                                ) : (
                                    <span className="text-muted-foreground text-xs">{t('waitingForOwner')}</span>
                                ))}
                        </div>
                    )
                },
            },
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [t, format, money, canApprove, approve.isPending, paid]
    )

    const filterSelect = (
        value: string,
        onChange: (value: string) => void,
        allLabel: string,
        options: { value: string; label: string }[],
        width = 'w-40'
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

    // Pending rows can be edited by their author (a munshi) or by an approver; later edits are the owner's.
    const canEditSelected = !!selected && (canApprove || (canEnter && selected.status === 'pending'))

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title={t('title')}
                description={t('description')}
                actions={
                    canEnter && (
                        <>
                            <Button variant="outline" onClick={() => setPayment({})}>
                                <Wallet /> {t('pay.open')}
                            </Button>
                            <Button onClick={() => setSheet('add')}>
                                <Plus /> {t('create')}
                            </Button>
                        </>
                    )
                }
            />

            {pending.length > 0 && (
                <div className="bg-muted flex flex-wrap items-center gap-2 rounded-lg border px-4 py-2 text-sm">
                    <TriangleAlert className="text-warning size-4" />
                    <span className="font-medium">{canApprove ? t('attention.owner') : t('attention.munshi')}</span>
                    <Button variant="link" className="h-auto p-0" onClick={() => setStatus('pending')}>
                        {t('attention.toApprove', { count: pending.length })}
                    </Button>
                </div>
            )}

            <StatCardGrid className="@5xl/main:grid-cols-5">
                <StatCard
                    compact
                    label={t('kpi.awaiting')}
                    value={String(pending.length)}
                    note={pending.length ? money(pending.reduce((s, p) => s + p.total, 0)) : t('kpi.nothingPending')}
                />
                <StatCard
                    compact
                    label={t('kpi.inStock')}
                    value={String(inStock.length)}
                    note={t('kpi.tonsNotCut', { tons: tons(inStock.reduce((s, p) => s + p.tons, 0)) })}
                />
                <StatCard compact label={t('kpi.tonsMonth')} value={`${tons(monthTons)} t`} />
                <StatCard compact label={t('kpi.payable')} value={money(payable)} note={t('kpi.payableNote')} />
                <StatCard
                    compact
                    label={t('kpi.chequesDue')}
                    value={String(dueCheques.length)}
                    note={money(dueCheques.reduce((s, c) => s + c.amount, 0))}
                />
            </StatCardGrid>

            <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
                <TabsList>
                    {(['purchases', 'payments', 'cheques'] as const).map((value) => (
                        <TabsTrigger key={value} value={value}>
                            {t(`tabs.${value}`)}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>

            {tab === 'payments' ? (
                <PaymentsTab canApprove={canApprove} />
            ) : tab === 'cheques' ? (
                <ChequesTab canManage={canApprove} onReplace={(cheque: Cheque) => setPayment({ supplierId: cheque.supplierId, amount: cheque.amount, replaces: cheque })} />
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
                    onRowClick={(row) => setSelectedId(row.id)}
                    toolbar={
                        <div className="flex flex-wrap gap-2">
                            {filterSelect(
                                status,
                                (v) => setStatus(v as PurchaseStatus | typeof ALL),
                                t('filters.allStatuses'),
                                purchaseStatuses.map((s) => ({ value: s, label: t(`statuses.${s}`) }))
                            )}
                            {filterSelect(
                                supplierId,
                                setSupplierId,
                                t('filters.allSuppliers'),
                                (suppliers.data ?? [])
                                    .filter((s) => s.type === 'mine_owner')
                                    .map((s) => ({ value: s.id, label: s.name })),
                                'w-44'
                            )}
                            {filterSelect(
                                factoryId,
                                setFactoryId,
                                t('filters.allFactories'),
                                (factories.data ?? []).map((f) => ({ value: f.id, label: f.name })),
                                'w-44'
                            )}
                            {filterSelect(
                                age,
                                setAge,
                                t('filters.anyAge'),
                                AGE_OPTIONS.map((d) => ({ value: String(d), label: t('filters.inYard', { days: d }) }))
                            )}
                        </div>
                    }
                />
            )}

            <PurchasePanel
                purchase={selected}
                onClose={() => setSelectedId(null)}
                canApprove={canApprove}
                canEdit={canEditSelected}
                approving={approve.isPending}
                onApprove={(p) => approve.mutate(p)}
                onReject={setRejecting}
                onEdit={() => setSheet('edit')}
                onCancel={setCancelling}
            />

            <PurchaseSheet
                open={sheet !== null}
                onOpenChange={(open) => !open && setSheet(null)}
                purchase={sheet === 'edit' ? (selected ?? undefined) : undefined}
                roleKey={roleKey}
                userName={userName}
                onSaved={setMarked}
            />

            <MarkDialog purchase={marked} onClose={() => setMarked(null)} />

            <PaymentSheet
                open={payment !== null}
                onOpenChange={(open) => !open && setPayment(null)}
                roleKey={roleKey}
                userName={userName}
                preset={payment ?? undefined}
            />

            <RejectDialog
                open={!!rejecting}
                onOpenChange={(open) => !open && setRejecting(null)}
                pending={reject.isPending}
                labels={{
                    title: t('rejectDialog.title'),
                    description: rejecting ? t('rejectDialog.description', { purchi: rejecting.purchiNo }) : '',
                    reason: t('rejectDialog.reason'),
                    required: t('rejectDialog.required'),
                    submit: t('reject'),
                    cancel: tc('cancel'),
                }}
                onSubmit={(reason) => rejecting && reject.mutate({ purchase: rejecting, reason })}
            />

            <RejectDialog
                open={!!cancelling}
                onOpenChange={(open) => !open && setCancelling(null)}
                pending={cancel.isPending}
                labels={{
                    title: t('cancelDialog.title', { mark: cancelling?.mark ?? '' }),
                    description: cancelling
                        ? t('cancelDialog.description', { amount: money(cancelling.total), tons: cancelling.tons })
                        : '',
                    reason: t('cancelDialog.reason'),
                    required: t('rejectDialog.required'),
                    submit: t('cancelPurchase'),
                    cancel: tc('cancel'),
                }}
                onSubmit={(reason) => cancelling && cancel.mutate({ purchase: cancelling, reason })}
            />
        </div>
    )
}
