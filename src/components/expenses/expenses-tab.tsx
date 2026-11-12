'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { TriangleAlert } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { RejectDialog } from '@/components/approvals/reject-dialog'
import { DataTable } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { StatusBadge, type StatusTone } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { expenseCategoriesQueryKey, listExpenseCategories } from '@/features/expense-categories'
import {
    approveExpense,
    cancelExpense,
    expensesQueryKey,
    isOverdue,
    isUnpaidBill,
    listExpenses,
    munshiCashQueryKey,
    payBill,
    payModes,
    rejectExpense,
    type Expense,
    type ExpenseFilters,
    type ExpenseStatus,
    type PayMode,
} from '@/features/expenses'
import { factoriesQueryKey, listFactories } from '@/features/factories'
import { useTableLabels } from '@/features/resource-labels'
import { suppliersQueryKey } from '@/features/suppliers'
import { useExpenseErrorMessage } from '@/features/use-expense-error-message'
import { useMoney } from '@/hooks/use-money'
import { PayBillDialog } from './pay-bill-dialog'

const ALL = 'all'

const statusTone: Record<ExpenseStatus, StatusTone> = { pending: 'warning', approved: 'success', rejected: 'danger', cancelled: 'neutral' }

/**
 * Every expense, newest first. Pay Bill shows only on unpaid bills; a munshi's pending entries wait here
 * for the owner to approve or reject. Cancelling reverses the entry instead of deleting it.
 */
export function ExpensesTab({
    canEnter,
    canManage,
    status,
    onStatusChange,
}: {
    canEnter: boolean
    canManage: boolean
    status: ExpenseStatus | typeof ALL
    onStatusChange: (status: ExpenseStatus | typeof ALL) => void
}) {
    const t = useTranslations('expenses')
    const tc = useTranslations('common')
    const format = useFormatter()
    const money = useMoney()
    const labels = useTableLabels()
    const queryClient = useQueryClient()
    const errorMessage = useExpenseErrorMessage()
    const [categoryId, setCategoryId] = useState(ALL)
    const [factoryId, setFactoryId] = useState(ALL)
    const [payMode, setPayMode] = useState<PayMode | typeof ALL>(ALL)
    const [paying, setPaying] = useState<Expense | null>(null)
    const [rejecting, setRejecting] = useState<Expense | null>(null)
    const [cancelling, setCancelling] = useState<Expense | null>(null)

    const filters = useMemo<ExpenseFilters>(
        () => ({
            ...(categoryId !== ALL && { categoryId }),
            ...(factoryId !== ALL && { factoryId }),
            ...(payMode !== ALL && { payMode }),
            ...(status !== ALL && { status }),
        }),
        [categoryId, factoryId, payMode, status]
    )
    const list = useQuery({ queryKey: [expensesQueryKey, filters], queryFn: () => listExpenses(filters) })
    const categories = useQuery({ queryKey: [expenseCategoriesQueryKey], queryFn: listExpenseCategories })
    const factories = useQuery({ queryKey: [factoriesQueryKey], queryFn: listFactories })

    const refresh = () => {
        for (const key of [expensesQueryKey, munshiCashQueryKey, suppliersQueryKey]) queryClient.invalidateQueries({ queryKey: [key] })
    }

    const approve = useMutation({
        mutationFn: (expense: Expense) => approveExpense(expense.id),
        onSuccess: () => {
            toast.success(t('approved'))
            refresh()
        },
        onError: (error) => toast.error(errorMessage(error)),
    })
    const reject = useMutation({
        mutationFn: ({ expense, reason }: { expense: Expense; reason: string }) => rejectExpense(expense.id, reason),
        onSuccess: () => {
            toast.success(t('rejected'))
            setRejecting(null)
            refresh()
        },
        onError: (error) => toast.error(errorMessage(error)),
    })
    const cancel = useMutation({
        mutationFn: ({ expense, reason }: { expense: Expense; reason: string }) => cancelExpense(expense.id, reason),
        onSuccess: () => {
            toast.success(t('cancelled'))
            setCancelling(null)
            refresh()
        },
        onError: (error) => toast.error(errorMessage(error)),
    })
    const pay = useMutation({
        mutationFn: ({ expense, ...values }: { expense: Expense; accountId: string; accountName: string; date: string }) => payBill(expense.id, values),
        onSuccess: () => {
            toast.success(t('billPaid'))
            setPaying(null)
            refresh()
        },
        onError: (error) => toast.error(errorMessage(error)),
    })

    const date = (iso: string) => format.dateTime(new Date(`${iso}T00:00:00`), { dateStyle: 'medium' })

    const columns = useMemo<ColumnDef<Expense>[]>(
        () => [
            {
                accessorKey: 'date',
                header: t('columns.date'),
                cell: ({ row }) => (
                    <div className="flex flex-col">
                        <span className="font-medium">{date(row.original.date)}</span>
                        <span className="text-muted-foreground text-xs tabular-nums">{row.original.expNo}</span>
                    </div>
                ),
            },
            { accessorKey: 'categoryName', header: t('columns.category') },
            {
                accessorKey: 'description',
                header: t('columns.description'),
                cell: ({ row }) => (
                    <div className="flex min-w-0 flex-col">
                        <span className="truncate">{row.original.description}</span>
                        <span className="text-muted-foreground truncate text-xs">{row.original.factoryName}</span>
                    </div>
                ),
            },
            {
                accessorKey: 'amount',
                header: t('columns.amount'),
                meta: { className: 'text-end' },
                cell: ({ row }) => <span className="font-medium tabular-nums">{money(row.original.amount)}</span>,
            },
            {
                id: 'paidFrom',
                header: t('columns.paidFrom'),
                enableSorting: false,
                cell: ({ row }) => {
                    const e = row.original
                    if (e.payMode === 'shop_credit') return <span>{t('paidFrom.credit', { shop: e.shopName })}</span>
                    if (e.payMode === 'unpaid' && !e.paidOn) {
                        return (
                            <span className={isOverdue(e) ? 'text-destructive font-medium' : 'text-warning-foreground'}>
                                {t('paidFrom.unpaid', { date: e.dueDate ? date(e.dueDate) : '' })}
                            </span>
                        )
                    }
                    return <span>{e.accountName}</span>
                },
            },
            {
                accessorKey: 'status',
                header: t('columns.status'),
                cell: ({ row }) => (
                    <div className="flex flex-col items-start gap-1">
                        <StatusBadge tone={statusTone[row.original.status]}>{t(`statuses.${row.original.status}`)}</StatusBadge>
                        {row.original.reason && <span className="text-muted-foreground max-w-40 truncate text-xs">{row.original.reason}</span>}
                    </div>
                ),
            },
            {
                id: 'actions',
                header: () => <span className="sr-only">{tc('actions')}</span>,
                enableSorting: false,
                cell: ({ row }) => {
                    const e = row.original
                    return (
                        <div className="flex flex-wrap justify-end gap-1">
                            {e.status === 'pending' && canManage && (
                                <>
                                    <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate(e)}>
                                        {t('approve')}
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => setRejecting(e)}>
                                        {t('reject')}
                                    </Button>
                                </>
                            )}
                            {isUnpaidBill(e) && canEnter && (
                                <Button size="sm" variant={isOverdue(e) ? 'default' : 'outline'} onClick={() => setPaying(e)}>
                                    {t('payBill.open')}
                                </Button>
                            )}
                            {e.status === 'approved' && canManage && (
                                <Button size="sm" variant="ghost" onClick={() => setCancelling(e)}>
                                    {t('cancel')}
                                </Button>
                            )}
                        </div>
                    )
                },
            },
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [t, tc, format, money, canEnter, canManage, approve.isPending]
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

    const filterSelect = (value: string, onChange: (value: string) => void, allLabel: string, options: { value: string; label: string }[], width = 'w-40') => (
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
                        {filterSelect(
                            categoryId,
                            setCategoryId,
                            t('filters.allCategories'),
                            (categories.data ?? []).map((c) => ({ value: c.id, label: c.name })),
                            'w-48'
                        )}
                        {filterSelect(
                            factoryId,
                            setFactoryId,
                            t('filters.allFactories'),
                            (factories.data ?? []).map((f) => ({ value: f.id, label: f.name })),
                            'w-44'
                        )}
                        {filterSelect(payMode, (v) => setPayMode(v as PayMode | typeof ALL), t('filters.allPayModes'), payModes.map((m) => ({ value: m, label: t(`sheet.payModes.${m}`) })))}
                        {filterSelect(
                            status,
                            (v) => onStatusChange(v as ExpenseStatus | typeof ALL),
                            t('filters.allStatuses'),
                            (['pending', 'approved', 'rejected', 'cancelled'] as const).map((s) => ({ value: s, label: t(`statuses.${s}`) }))
                        )}
                    </div>
                }
            />

            <PayBillDialog
                key={paying?.id ?? 'none'}
                expense={paying}
                pending={pay.isPending}
                onClose={() => setPaying(null)}
                onSubmit={(values) => paying && pay.mutate({ expense: paying, ...values })}
            />

            <RejectDialog
                open={!!rejecting}
                onOpenChange={(open) => !open && setRejecting(null)}
                pending={reject.isPending}
                labels={{
                    title: t('rejectDialog.title', { no: rejecting?.expNo ?? '' }),
                    description: t('rejectDialog.description'),
                    reason: t('rejectDialog.reason'),
                    required: t('rejectDialog.required'),
                    submit: t('reject'),
                    cancel: tc('cancel'),
                }}
                onSubmit={(reason) => rejecting && reject.mutate({ expense: rejecting, reason })}
            />

            <RejectDialog
                open={!!cancelling}
                onOpenChange={(open) => !open && setCancelling(null)}
                pending={cancel.isPending}
                labels={{
                    title: t('cancelDialog.title', { no: cancelling?.expNo ?? '' }),
                    description: cancelling ? t('cancelDialog.description', { amount: money(cancelling.amount) }) : '',
                    reason: t('cancelDialog.reason'),
                    required: t('rejectDialog.required'),
                    submit: t('cancelDialog.submit'),
                    cancel: tc('cancel'),
                }}
                onSubmit={(reason) => cancelling && cancel.mutate({ expense: cancelling, reason })}
            />
        </>
    )
}
