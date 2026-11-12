'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HandCoins } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { StatusBadge, type StatusTone } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { changeInstalment, listLoans, loansQueryKey, resetInstalment, type InstalmentRow, type InstalmentStatus, type LoanSummary } from '@/features/loans'
import { monthEndQueryKey } from '@/features/month-end'
import { useExpenseErrorMessage } from '@/features/use-expense-error-message'
import { workerKhataQueryKey } from '@/features/worker-khata'
import { useMoney } from '@/hooks/use-money'
import { InstalmentDialog, type InstalmentChange } from './instalment-dialog'

const tone: Record<InstalmentStatus, StatusTone> = { scheduled: 'info', deducted: 'success', skipped: 'neutral' }

/** A worker's loans: what is left, and the month-by-month schedule. The owner can change or skip a month before it is closed. */
export function LoansSection({ workerId, canManage, onGive }: { workerId: string; canManage: boolean; onGive: () => void }) {
    const t = useTranslations('expenses.loans')
    const format = useFormatter()
    const money = useMoney()
    const queryClient = useQueryClient()
    const errorMessage = useExpenseErrorMessage()
    const [target, setTarget] = useState<{ loan: LoanSummary; row: InstalmentRow } | null>(null)

    const loans = useQuery({ queryKey: [loansQueryKey, workerId], queryFn: () => listLoans(workerId) })

    const change = useMutation({
        mutationFn: ({ loan, row, change }: { loan: LoanSummary; row: InstalmentRow; change: InstalmentChange }) =>
            'reset' in change ? resetInstalment(loan.id, row.month) : changeInstalment(loan.id, row.month, change),
        onSuccess: () => {
            toast.success(t('change.saved'))
            setTarget(null)
            for (const key of [loansQueryKey, monthEndQueryKey, workerKhataQueryKey]) queryClient.invalidateQueries({ queryKey: [key] })
        },
        onError: (error) => toast.error(errorMessage(error)),
    })

    const month = (m: string) => format.dateTime(new Date(`${m}-01T00:00:00`), { month: 'short', year: 'numeric' })

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium">{t('title')}</h3>
                {canManage && (
                    <Button size="sm" variant="outline" onClick={onGive}>
                        <HandCoins /> {t('give.open')}
                    </Button>
                )}
            </div>

            {loans.isLoading ? (
                <Skeleton className="h-24 w-full" />
            ) : loans.isError ? (
                <p className="text-muted-foreground text-sm">{t('loadFailed')}</p>
            ) : (loans.data ?? []).length === 0 ? (
                <p className="text-muted-foreground text-sm">{t('none')}</p>
            ) : (
                (loans.data ?? []).map((loan) => (
                    <div key={loan.id} className="bg-card flex flex-col gap-2 rounded-lg border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-col">
                                <span className="font-medium">{t('summary', { amount: money(loan.amount), instalment: money(loan.monthlyInstalment) })}</span>
                                <span className="text-muted-foreground text-xs">
                                    {format.dateTime(new Date(`${loan.date}T00:00:00`), { dateStyle: 'medium' })}
                                    {loan.reason && ` · ${loan.reason}`}
                                </span>
                            </div>
                            <StatusBadge tone={loan.status === 'active' ? 'warning' : 'success'}>{t(`status.${loan.status}`)}</StatusBadge>
                        </div>
                        <p className="text-sm">
                            {t('outstanding', { amount: money(loan.outstanding), repaid: money(loan.deducted + loan.priorRepaid) })}
                            {loan.endMonth && loan.status === 'active' && ` · ${t('ends', { month: month(loan.endMonth) })}`}
                        </p>
                        {loan.schedule.length > 0 && (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>{t('columns.month')}</TableHead>
                                        <TableHead className="text-end">{t('columns.instalment')}</TableHead>
                                        <TableHead>{t('columns.status')}</TableHead>
                                        <TableHead className="w-24" />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loan.schedule.map((row) => (
                                        <TableRow key={row.month}>
                                            <TableCell>{month(row.month)}</TableCell>
                                            <TableCell className="text-end tabular-nums">{row.status === 'skipped' ? '—' : money(row.amount)}</TableCell>
                                            <TableCell>
                                                <StatusBadge tone={tone[row.status]}>{t(`rowStatus.${row.status}`)}</StatusBadge>
                                            </TableCell>
                                            <TableCell className="text-end">
                                                {canManage && row.status !== 'deducted' && (
                                                    <Button size="sm" variant="ghost" onClick={() => setTarget({ loan, row })}>
                                                        {t('change.open')}
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                ))
            )}

            <InstalmentDialog
                key={target ? `${target.loan.id}-${target.row.month}` : 'none'}
                target={target}
                pending={change.isPending}
                onClose={() => setTarget(null)}
                onSubmit={(c) => target && change.mutate({ ...target, change: c })}
            />
        </div>
    )
}
