'use client'

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Wallet } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { DataTable } from '@/components/shared/data-table'
import { StatCard } from '@/components/shared/stat-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { BalanceText } from '@/components/suppliers/balance-text'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { expensesQueryKey, munshiCashQueryKey } from '@/features/expenses'
import { useTableLabels } from '@/features/resource-labels'
import { useExpenseErrorMessage } from '@/features/use-expense-error-message'
import { getWorkerKhata, workerKhataQueryKey, type WorkerKhataRow, type WorkerSummary } from '@/features/worker-khata'
import { confirmWorkerPayment, rejectWorkerPayment, workerPaymentsQueryKey } from '@/features/worker-payments'
import { workersQueryKey } from '@/features/workers'
import { LoansSection } from './loans-section'
import { useDirection } from '@/hooks/use-direction'
import { useMoney } from '@/hooks/use-money'

/** Side panel for one worker: pay type and rate, the totals, and the khata (earned, paid, balance). */
export function WorkerPanel({
    worker,
    canManage,
    onClose,
    onEdit,
    onPay,
    onGiveLoan,
}: {
    worker: WorkerSummary | null
    /** Owner, Partner and Manager: edit, and decide a munshi's pending payment. */
    canManage: boolean
    onClose: () => void
    onEdit?: (worker: WorkerSummary) => void
    onPay?: (worker: WorkerSummary) => void
    onGiveLoan: (worker: WorkerSummary) => void
}) {
    const t = useTranslations('expenses.workers')
    const format = useFormatter()
    const money = useMoney()
    const labels = useTableLabels()
    const { isRtl } = useDirection()
    const queryClient = useQueryClient()
    const errorMessage = useExpenseErrorMessage()

    const khata = useQuery({ queryKey: [workerKhataQueryKey, worker?.id], queryFn: () => getWorkerKhata(worker!.id), enabled: !!worker })

    const refresh = () => {
        for (const key of [workerPaymentsQueryKey, workerKhataQueryKey, workersQueryKey, munshiCashQueryKey, expensesQueryKey]) {
            queryClient.invalidateQueries({ queryKey: [key] })
        }
    }
    const decide = useMutation({
        mutationFn: ({ id, approve }: { id: string; approve: boolean }) => (approve ? confirmWorkerPayment(id) : rejectWorkerPayment(id)),
        onSuccess: (_, { approve }) => {
            toast.success(approve ? t('panel.confirmed') : t('panel.rejected'))
            refresh()
        },
        onError: (error) => toast.error(errorMessage(error)),
    })

    const detail = (row: WorkerKhataRow) => {
        if (row.type === 'opening') return t('panel.opening')
        if (row.type === 'payment') return row.note ? t('panel.paidNote', { note: row.note }) : t('panel.paid')
        if (row.type === 'attendance') return t('panel.presentDay')
        if (row.type === 'loan') return row.note ? t('panel.loanNote', { note: row.note }) : t('panel.loan')
        if (row.type === 'instalment') return t('panel.instalment')
        if (row.type === 'salary') {
            return row.absentDays ? t('panel.salaryCut', { salary: money(row.qty ?? 0), days: row.absentDays, cut: money(row.cut ?? 0) }) : t('panel.salary')
        }
        const qty = format.number(row.qty ?? 0, { maximumFractionDigits: 2 })
        return t('panel.work', { job: row.job ?? '', qty, unit: t(`units.${row.unit ?? 'sqft'}`), rate: money(row.rate ?? 0) })
    }

    const columns = useMemo<ColumnDef<WorkerKhataRow>[]>(
        () => [
            {
                accessorKey: 'date',
                header: t('panel.date'),
                enableSorting: false,
                cell: ({ row }) => format.dateTime(new Date(`${row.original.date}T00:00:00`), { dateStyle: 'medium' }),
            },
            {
                id: 'detail',
                header: t('panel.detail'),
                enableSorting: false,
                cell: ({ row }) => (
                    <div className="flex flex-col items-start gap-1">
                        <span>{detail(row.original)}</span>
                        {row.original.auto && <span className="text-muted-foreground text-xs">{t('panel.auto')}</span>}
                        {row.original.pending && <StatusBadge tone="warning">{t('panel.pending')}</StatusBadge>}
                        {row.original.memo && <span className="text-muted-foreground text-xs">{t('panel.memo')}</span>}
                    </div>
                ),
            },
            {
                id: 'amount',
                header: t('panel.amount'),
                enableSorting: false,
                meta: { className: 'text-end' },
                cell: ({ row }) =>
                    row.original.memo ? (
                        <bdi className="text-muted-foreground tabular-nums">{money(row.original.amount)}</bdi>
                    ) : (
                    <bdi className={row.original.kind === 'charge' ? 'text-destructive tabular-nums' : 'text-success tabular-nums'}>
                        {row.original.kind === 'charge' ? '+' : '−'} {money(row.original.amount)}
                    </bdi>
                    ),
            },
            {
                accessorKey: 'balance',
                header: t('panel.balance'),
                enableSorting: false,
                meta: { className: 'text-end' },
                cell: ({ row }) => (row.original.memo ? null : <BalanceText balance={row.original.balance} className="items-end" />),
            },
            {
                id: 'actions',
                header: () => <span className="sr-only">{t('panel.actions')}</span>,
                enableSorting: false,
                cell: ({ row }) =>
                    row.original.pending &&
                    canManage &&
                    row.original.paymentId && (
                        <div className="flex justify-end gap-1">
                            <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ id: row.original.paymentId!, approve: true })}>
                                {t('panel.approve')}
                            </Button>
                            <Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => decide.mutate({ id: row.original.paymentId!, approve: false })}>
                                {t('panel.reject')}
                            </Button>
                        </div>
                    ),
            },
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [t, format, money, canManage, decide.isPending]
    )

    // Newest first, like the other khatas.
    const rows = useMemo(() => [...(khata.data ?? [])].reverse(), [khata.data])

    return (
        <Sheet open={!!worker} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side={isRtl ? 'left' : 'right'} className="w-full overflow-y-auto sm:max-w-2xl">
                {worker && (
                    <>
                        <SheetHeader>
                            <SheetTitle>{worker.name}</SheetTitle>
                            <SheetDescription>
                                {worker.jobTitle} · {t(`payTypes.${worker.payType}`)}
                                {worker.rate > 0 && ` · ${t(`perUnit.${worker.payType}`, { amount: money(worker.rate) })}`}
                                {worker.phone && (
                                    <>
                                        {' · '}
                                        <bdi dir="ltr">{worker.phone}</bdi>
                                    </>
                                )}
                            </SheetDescription>
                        </SheetHeader>

                        <div className="flex flex-col gap-4 px-4 pb-4">
                            <div className="grid grid-cols-3 gap-2">
                                <StatCard compact label={t('panel.earned')} value={money(worker.earned)} />
                                <StatCard compact label={t('panel.paidTotal')} value={money(worker.paid)} />
                                <StatCard
                                    compact
                                    label={worker.balance < 0 ? t('panel.advance') : t('panel.owed')}
                                    value={money(Math.abs(worker.balance))}
                                    negative={worker.balance > 0}
                                />
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {onPay && (
                                    <Button onClick={() => onPay(worker)}>
                                        <Wallet /> {t('pay')}
                                    </Button>
                                )}
                                {onEdit && (
                                    <Button variant="outline" onClick={() => onEdit(worker)}>
                                        <Pencil /> {t('edit')}
                                    </Button>
                                )}
                            </div>

                            <LoansSection workerId={worker.id} canManage={canManage} onGive={() => onGiveLoan(worker)} />

                            <h3 className="text-sm font-medium">{t('panel.title')}</h3>
                            {khata.isError ? (
                                <p className="text-muted-foreground text-sm">{t('panel.loadFailed')}</p>
                            ) : khata.isLoading ? (
                                <Skeleton className="h-40 w-full" />
                            ) : (
                                <DataTable columns={columns} data={rows} labels={labels} pageSize={25} />
                            )}
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>
    )
}
