'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Lock, TriangleAlert } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { DatePicker } from '@/components/shared/date-picker'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useExpenseErrorMessage } from '@/features/use-expense-error-message'
import { workerKhataQueryKey } from '@/features/worker-khata'
import { getWorkRegister, saveWorkRegister, workRegisterQueryKey } from '@/features/work-register'
import { workersQueryKey } from '@/features/workers'
import { useMoney } from '@/hooks/use-money'
import { todayIso } from '@/lib/format'

/**
 * The sq.ft workers' feet for one day. Feet from production entries are already there, locked; type the rest
 * and save. Each worker gets one entry per day, at his own rate or the job rate card.
 */
export function WorkRegisterTab({ canEnter, userName }: { canEnter: boolean; userName: string }) {
    const t = useTranslations('expenses.register')
    const format = useFormatter()
    const money = useMoney()
    const queryClient = useQueryClient()
    const errorMessage = useExpenseErrorMessage()
    const [date, setDate] = useState(todayIso())
    // What was typed since the page loaded, by worker; cleared when the day changes or is saved.
    const [drafts, setDrafts] = useState<Record<string, string>>({})

    const sheet = useQuery({ queryKey: [workRegisterQueryKey, date], queryFn: () => getWorkRegister(date) })

    const feetOf = (workerId: string, saved: number) => {
        const typed = drafts[workerId]
        return typed === undefined ? saved : Number(typed) || 0
    }

    const save = useMutation({
        mutationFn: () => saveWorkRegister(date, (sheet.data?.rows ?? []).map((r) => ({ workerId: r.workerId, feet: feetOf(r.workerId, r.feet) })), userName),
        onSuccess: () => {
            toast.success(t('saved'))
            setDrafts({})
            for (const key of [workRegisterQueryKey, workerKhataQueryKey, workersQueryKey]) queryClient.invalidateQueries({ queryKey: [key] })
        },
        onError: (error) => toast.error(errorMessage(error)),
    })

    const rows = sheet.data?.rows ?? []
    const total = rows.reduce((s, r) => s + Math.round(feetOf(r.workerId, r.feet) * r.rate) + r.autoAmount, 0)
    const feet = rows.reduce((s, r) => s + feetOf(r.workerId, r.feet) + r.autoFeet, 0)

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium">{t('date')}</span>
                    <DatePicker
                        value={date}
                        onChange={(v) => {
                            if (!v) return
                            setDate(v)
                            setDrafts({})
                        }}
                        placeholder={t('datePlaceholder')}
                        max={todayIso()}
                        className="w-48"
                    />
                </div>
                <p className="text-muted-foreground text-sm">{t('note')}</p>
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
            ) : sheet.isLoading ? (
                <Skeleton className="h-64 w-full" />
            ) : rows.length === 0 ? (
                <EmptyState title={t('noWorkers')} />
            ) : (
                <div className="bg-card rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t('columns.worker')}</TableHead>
                                <TableHead>{t('columns.job')}</TableHead>
                                <TableHead className="w-40">{t('columns.feet')}</TableHead>
                                <TableHead className="text-end">{t('columns.rate')}</TableHead>
                                <TableHead className="text-end">{t('columns.amount')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((r) => {
                                const typed = feetOf(r.workerId, r.feet)
                                return (
                                    <TableRow key={r.workerId}>
                                        <TableCell className="font-medium">{r.workerName}</TableCell>
                                        <TableCell>{r.job}</TableCell>
                                        <TableCell>
                                            <Input
                                                className="h-11 text-lg tabular-nums"
                                                inputMode="decimal"
                                                placeholder="0"
                                                aria-label={t('feetFor', { name: r.workerName })}
                                                disabled={!canEnter}
                                                value={drafts[r.workerId] ?? (r.feet ? String(r.feet) : '')}
                                                onChange={(e) => setDrafts((d) => ({ ...d, [r.workerId]: e.target.value.replace(/[^0-9.]/g, '') }))}
                                            />
                                            {r.autoFeet > 0 && (
                                                <span className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                                                    <Lock className="size-3" /> {t('fromProduction', { feet: format.number(r.autoFeet, { maximumFractionDigits: 2 }) })}
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-end tabular-nums">{r.rate > 0 ? money(r.rate) : '—'}</TableCell>
                                        <TableCell className="text-end font-medium tabular-nums">{money(Math.round(typed * r.rate) + r.autoAmount)}</TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium">{t('dayTotal', { feet: format.number(feet, { maximumFractionDigits: 2 }), amount: money(total) })}</p>
                {canEnter && (
                    <Button disabled={save.isPending || rows.length === 0} onClick={() => save.mutate()}>
                        {save.isPending && <Loader2 className="animate-spin" />}
                        {t('save')}
                    </Button>
                )}
            </div>
        </div>
    )
}
