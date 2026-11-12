'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock, LockOpen, Printer, TriangleAlert } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { StatusBadge } from '@/components/shared/status-badge'
import { BalanceText } from '@/components/suppliers/balance-text'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { attendanceQueryKey } from '@/features/attendance'
import { loansQueryKey } from '@/features/loans'
import { closeMonth, getMonthLog, getMonthSheet, monthEndQueryKey, monthOptions, previewClose, reopenMonth } from '@/features/month-end'
import { useExpenseErrorMessage } from '@/features/use-expense-error-message'
import { workerKhataQueryKey } from '@/features/worker-khata'
import { workRegisterQueryKey } from '@/features/work-register'
import { workersQueryKey } from '@/features/workers'
import { useMoney } from '@/hooks/use-money'

const months = monthOptions()

/**
 * One month for every worker: brought forward, earned, loan instalment, paid and balance. Closing posts the
 * monthly salaries and the instalments once and locks the month; only the owner can re-open it.
 */
export function MonthEndTab({ canClose, canReopen, userName }: { canClose: boolean; canReopen: boolean; userName: string }) {
    const t = useTranslations('expenses.monthEnd')
    const tc = useTranslations('common')
    const format = useFormatter()
    const money = useMoney()
    const queryClient = useQueryClient()
    const errorMessage = useExpenseErrorMessage()
    const [month, setMonth] = useState(months[0])
    const [confirm, setConfirm] = useState<'close' | 'reopen' | null>(null)

    const sheet = useQuery({ queryKey: [monthEndQueryKey, month], queryFn: () => getMonthSheet(month) })
    const log = useQuery({ queryKey: [monthEndQueryKey, 'log'], queryFn: getMonthLog })

    const refresh = () => {
        for (const key of [monthEndQueryKey, workerKhataQueryKey, workersQueryKey, loansQueryKey, attendanceQueryKey, workRegisterQueryKey]) {
            queryClient.invalidateQueries({ queryKey: [key] })
        }
    }
    const close = useMutation({
        mutationFn: () => closeMonth(month, userName),
        onSuccess: () => {
            toast.success(t('closedToast'))
            setConfirm(null)
            refresh()
        },
        onError: (error) => {
            toast.error(errorMessage(error))
            setConfirm(null)
        },
    })
    const reopen = useMutation({
        mutationFn: () => reopenMonth(month, userName),
        onSuccess: () => {
            toast.success(t('reopenedToast'))
            setConfirm(null)
            refresh()
        },
        onError: (error) => {
            toast.error(errorMessage(error))
            setConfirm(null)
        },
    })

    const monthName = (m: string) => format.dateTime(new Date(`${m}-01T00:00:00`), { month: 'long', year: 'numeric' })
    const data = sheet.data
    const preview = confirm === 'close' && data ? previewClose(month) : null
    const entries = (log.data ?? []).filter((l) => l.month === month)

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                    <Select value={month} onValueChange={setMonth}>
                        <SelectTrigger className="w-52" aria-label={t('month')}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {months.map((m) => (
                                <SelectItem key={m} value={m}>
                                    {monthName(m)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {data && (
                        <StatusBadge tone={data.closed ? 'success' : 'warning'}>
                            {data.closed ? t('closed') : data.inProgress ? t('inProgress') : t('open')}
                        </StatusBadge>
                    )}
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => window.print()}>
                        <Printer /> {t('print')}
                    </Button>
                    {data && !data.closed && canClose && (
                        <Button onClick={() => setConfirm('close')}>
                            <Lock /> {t('close')}
                        </Button>
                    )}
                    {data?.closed && canReopen && (
                        <Button variant="outline" onClick={() => setConfirm('reopen')}>
                            <LockOpen /> {t('reopen')}
                        </Button>
                    )}
                </div>
            </div>

            {sheet.isError ? (
                <EmptyState
                    title={t('loadFailed')}
                    icon={TriangleAlert}
                    action={
                        <Button variant="outline" onClick={() => sheet.refetch()}>
                            {t('retry')}
                        </Button>
                    }
                />
            ) : sheet.isLoading || !data ? (
                <Skeleton className="h-64 w-full" />
            ) : data.rows.length === 0 ? (
                <EmptyState title={t('empty')} />
            ) : (
                <div className="bg-card rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t('columns.worker')}</TableHead>
                                <TableHead className="text-end">{t('columns.broughtForward')}</TableHead>
                                <TableHead className="text-end">{t('columns.earned')}</TableHead>
                                <TableHead className="text-end">{t('columns.instalment')}</TableHead>
                                <TableHead className="text-end">{t('columns.paid')}</TableHead>
                                <TableHead className="text-end">{t('columns.balance')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.rows.map((r) => (
                                <TableRow key={r.workerId}>
                                    <TableCell>
                                        <div className="flex flex-col items-start gap-1">
                                            <span className="font-medium">{r.workerName}</span>
                                            <Badge variant="outline">{t(`payTypes.${r.payType}`)}</Badge>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-end">
                                        <BalanceText balance={r.broughtForward} className="items-end" />
                                    </TableCell>
                                    <TableCell className="text-end">
                                        <div className="flex flex-col items-end">
                                            <span className="tabular-nums">{money(r.earned)}</span>
                                            {r.salary && (
                                                <span className="text-muted-foreground text-xs">
                                                    {r.salary.absentDays > 0
                                                        ? t('salaryCut', { salary: money(r.salary.gross), days: r.salary.absentDays, cut: money(r.salary.cut) })
                                                        : t('salaryFull', { salary: money(r.salary.gross) })}
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-end tabular-nums">{r.instalment > 0 ? `− ${money(r.instalment)}` : '—'}</TableCell>
                                    <TableCell className="text-end tabular-nums">{r.paid > 0 ? `− ${money(r.paid)}` : '—'}</TableCell>
                                    <TableCell className="text-end">
                                        <BalanceText balance={r.balance} className="items-end" />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow>
                                <TableCell className="font-medium">{t('total')}</TableCell>
                                <TableCell className="text-end tabular-nums">{money(data.totals.broughtForward)}</TableCell>
                                <TableCell className="text-end tabular-nums">{money(data.totals.earned)}</TableCell>
                                <TableCell className="text-end tabular-nums">{money(data.totals.instalment)}</TableCell>
                                <TableCell className="text-end tabular-nums">{money(data.totals.paid)}</TableCell>
                                <TableCell className="text-end font-medium tabular-nums">{money(data.totals.balance)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
            )}

            <p className="text-muted-foreground text-sm">{data?.closed ? t('closedNote', { by: data.closed.closedBy }) : t('note')}</p>
            {entries.length > 0 && (
                <ul className="text-muted-foreground flex flex-col gap-1 text-xs">
                    {entries.map((l) => (
                        <li key={`${l.action}-${l.at}`}>
                            {t(`log.${l.action}`, { by: l.by, date: format.dateTime(new Date(l.at), { dateStyle: 'medium' }) })}
                        </li>
                    ))}
                </ul>
            )}

            <ConfirmDialog
                open={confirm === 'close'}
                onOpenChange={(open) => !open && setConfirm(null)}
                title={t('confirmClose.title', { month: monthName(month) })}
                description={
                    preview
                        ? [
                              t('confirmClose.summary', { salaries: money(preview.salaries), instalments: money(preview.instalments) }),
                              preview.absentCut > 0 ? t('confirmClose.cut', { cut: money(preview.absentCut) }) : '',
                              data?.inProgress ? t('confirmClose.notOver') : '',
                              t('confirmClose.locks'),
                          ]
                              .filter(Boolean)
                              .join(' ')
                        : ''
                }
                confirmLabel={t('confirmClose.submit')}
                cancelLabel={tc('cancel')}
                loading={close.isPending}
                destructive={false}
                onConfirm={() => close.mutate()}
            />
            <ConfirmDialog
                open={confirm === 'reopen'}
                onOpenChange={(open) => !open && setConfirm(null)}
                title={t('confirmReopen.title', { month: monthName(month) })}
                description={t('confirmReopen.description')}
                confirmLabel={t('confirmReopen.submit')}
                cancelLabel={tc('cancel')}
                loading={reopen.isPending}
                onConfirm={() => reopen.mutate()}
            />
        </div>
    )
}
