'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, TriangleAlert } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { DatePicker } from '@/components/shared/date-picker'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { absentDays, attendanceQueryKey, getAttendance, saveAttendance } from '@/features/attendance'
import { useExpenseErrorMessage } from '@/features/use-expense-error-message'
import { workerKhataQueryKey } from '@/features/worker-khata'
import { workersQueryKey } from '@/features/workers'
import { todayIso } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Daily and monthly workers for one day: everyone starts Present, tap A for the ones who were not there,
 * then Save. A daily worker earns only for saved days. No half-days.
 */
export function AttendanceTab({ canEnter, userName }: { canEnter: boolean; userName: string }) {
    const t = useTranslations('expenses.attendance')
    const queryClient = useQueryClient()
    const errorMessage = useExpenseErrorMessage()
    const [date, setDate] = useState(todayIso())
    // Taps since the day was loaded, by worker (true: present); cleared when the day changes or is saved.
    const [drafts, setDrafts] = useState<Record<string, boolean>>({})

    const sheet = useQuery({ queryKey: [attendanceQueryKey, date], queryFn: () => getAttendance(date) })
    const rows = sheet.data?.rows ?? []
    const presentOf = (workerId: string, saved: boolean) => drafts[workerId] ?? saved

    const save = useMutation({
        mutationFn: () => saveAttendance(date, rows.filter((r) => !presentOf(r.worker.id, r.present)).map((r) => r.worker.id), userName),
        onSuccess: () => {
            toast.success(t('saved'))
            setDrafts({})
            for (const key of [attendanceQueryKey, workerKhataQueryKey, workersQueryKey]) queryClient.invalidateQueries({ queryKey: [key] })
        },
        onError: (error) => toast.error(errorMessage(error)),
    })

    const month = date.slice(0, 7)
    const absentCount = rows.filter((r) => !presentOf(r.worker.id, r.present)).length

    const toggle = (workerId: string, present: boolean, label: string, active: boolean) => (
        <Button
            type="button"
            size="lg"
            variant={active ? (present ? 'default' : 'destructive') : 'outline'}
            className="w-14 text-base"
            disabled={!canEnter}
            aria-pressed={active}
            aria-label={label}
            onClick={() => setDrafts((d) => ({ ...d, [workerId]: present }))}
        >
            {present ? t('p') : t('a')}
        </Button>
    )

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
                <p className="text-muted-foreground text-sm">{sheet.data && !sheet.data.saved ? t('notSaved') : t('note')}</p>
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
                <div className="bg-card divide-y rounded-lg border">
                    {rows.map((r) => {
                        const present = presentOf(r.worker.id, r.present)
                        return (
                            <div key={r.worker.id} className={cn('flex items-center justify-between gap-3 px-4 py-3', !present && 'bg-destructive/5')}>
                                <div className="flex min-w-0 flex-col">
                                    <span className="truncate font-medium">{r.worker.name}</span>
                                    <span className="text-muted-foreground truncate text-xs">
                                        {r.worker.jobTitle} · {t(`payTypes.${r.worker.payType === 'month' ? 'month' : 'day'}`)} · {t('absentThisMonth', { count: absentDays(r.worker.id, month) })}
                                    </span>
                                </div>
                                <div className="flex gap-2" role="group" aria-label={r.worker.name}>
                                    {toggle(r.worker.id, true, t('present'), present)}
                                    {toggle(r.worker.id, false, t('absent'), !present)}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium">{t('summary', { present: rows.length - absentCount, absent: absentCount })}</p>
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
