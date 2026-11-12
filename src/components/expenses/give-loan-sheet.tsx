'use client'

import { useEffect, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useFormatter, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { DateField, SelectField, TextField } from '@/components/shared/form-fields'
import { FormSheet } from '@/components/shared/form-sheet'
import { expensesQueryKey, munshiCashQueryKey } from '@/features/expenses'
import { BEFORE, loanSchema, type LoanValues } from '@/features/loans-schema'
import { giveLoan, loansQueryKey, previewSchedule, upcomingMonths } from '@/features/loans'
import { monthEndQueryKey } from '@/features/month-end'
import { useExpenseErrorMessage } from '@/features/use-expense-error-message'
import { listWorkers, workerKhataQueryKey } from '@/features/worker-khata'
import { workersQueryKey } from '@/features/workers'
import { useMoney } from '@/hooks/use-money'
import { todayIso } from '@/lib/format'
import { useAccountBalances } from './use-account-balances'

const emptyValues = (workerId?: string): LoanValues => ({
    workerId: workerId ?? '',
    amount: '',
    source: '',
    monthlyInstalment: '',
    firstMonth: upcomingMonths(2)[1],
    priorRepaid: '',
    date: todayIso(),
    reason: '',
})

/**
 * A loan to a worker, repaid in monthly instalments that are deducted when each month closes. Money leaves
 * the account you choose now, or nothing moves for a loan given before StoneFlow.
 */
export function GiveLoanSheet({
    open,
    onOpenChange,
    workerId,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    workerId?: string
}) {
    const t = useTranslations('expenses.loans.give')
    const tc = useTranslations('common')
    const tv = useTranslations('validation')
    const format = useFormatter()
    const money = useMoney()
    const queryClient = useQueryClient()
    const errorMessage = useExpenseErrorMessage()
    const schema = useMemo(() => loanSchema(tv), [tv])
    const form = useForm<LoanValues>({ resolver: zodResolver(schema), defaultValues: emptyValues(workerId) })

    const workers = useQuery({ queryKey: [workersQueryKey, 'summaries'], queryFn: () => listWorkers(), enabled: open })
    const { accounts, munshi } = useAccountBalances(open, t('munshiCash'))

    useEffect(() => {
        if (open) form.reset(emptyValues(workerId))
    }, [open, workerId, form])

    const [amount, source, instalment, firstMonth, prior] = useWatch({
        control: form.control,
        name: ['amount', 'source', 'monthlyInstalment', 'firstMonth', 'priorRepaid'],
    })
    const account = [munshi, ...accounts].find((a) => a.id === source)
    const lending = Number(amount) || 0
    const short = !!account && account.kind !== 'munshi' && account.balance !== null && lending > account.balance

    const monthName = (month: string) => format.dateTime(new Date(`${month}-01T00:00:00`), { month: 'long', year: 'numeric' })
    const schedule = lending > 0 && Number(instalment) > 0 ? previewSchedule({ amount: lending, monthlyInstalment: Number(instalment), firstMonth, priorRepaid: Number(prior) || 0 }) : []
    const last = schedule[schedule.length - 1]

    const save = useMutation({
        mutationFn: (values: LoanValues) =>
            giveLoan({
                workerId: values.workerId,
                workerName: workers.data?.find((w) => w.id === values.workerId)?.name ?? '',
                date: values.date,
                amount: Number(values.amount),
                monthlyInstalment: Number(values.monthlyInstalment),
                firstMonth: values.firstMonth,
                priorRepaid: Number(values.priorRepaid) || 0,
                accountId: values.source === BEFORE ? '' : values.source,
                accountName: values.source === BEFORE ? t('before') : ([munshi, ...accounts].find((a) => a.id === values.source)?.name ?? ''),
                reason: values.reason,
            }),
        onSuccess: () => {
            toast.success(t('saved'))
            onOpenChange(false)
            for (const key of [loansQueryKey, workerKhataQueryKey, workersQueryKey, monthEndQueryKey, munshiCashQueryKey, expensesQueryKey]) {
                queryClient.invalidateQueries({ queryKey: [key] })
            }
        },
        onError: (error) => toast.error(errorMessage(error)),
    })

    return (
        <FormSheet
            open={open}
            onOpenChange={onOpenChange}
            title={t('title')}
            description={t('description')}
            form={form}
            onSubmit={(values) => save.mutate(values)}
            submitLabel={t('save')}
            cancelLabel={tc('cancel')}
            pending={save.isPending}
            submitDisabled={short}
            summary={
                short ? (
                    <span className="text-destructive">{t('short', { account: account?.name ?? '', amount: money(account?.balance ?? 0) })}</span>
                ) : last ? (
                    t('plan', { count: schedule.filter((r) => r.amount > 0).length, month: monthName(last.month) })
                ) : undefined
            }
        >
            <SelectField
                control={form.control}
                name="workerId"
                label={t('worker')}
                placeholder={t('chooseWorker')}
                options={(workers.data ?? []).filter((w) => w.isActive).map((w) => ({ value: w.id, label: w.name }))}
            />
            <div className="grid grid-cols-2 gap-3">
                <TextField control={form.control} name="amount" label={t('amount')} placeholder={t('amountPlaceholder')} inputMode="numeric" autoComplete="off" />
                <DateField control={form.control} name="date" label={t('date')} placeholder={t('datePlaceholder')} />
            </div>
            <SelectField
                control={form.control}
                name="source"
                label={t('from')}
                placeholder={t('chooseAccount')}
                options={[
                    ...[munshi, ...accounts].map((a) => ({ value: a.id, label: a.balance === null ? a.name : `${a.name} · ${money(a.balance)}` })),
                    { value: BEFORE, label: t('before') },
                ]}
            />
            <div className="grid grid-cols-2 gap-3">
                <TextField control={form.control} name="monthlyInstalment" label={t('instalment')} placeholder={t('instalmentPlaceholder')} inputMode="numeric" autoComplete="off" />
                <SelectField
                    control={form.control}
                    name="firstMonth"
                    label={t('firstMonth')}
                    options={upcomingMonths(13).map((m) => ({ value: m, label: monthName(m) }))}
                />
            </div>
            <TextField control={form.control} name="priorRepaid" label={t('priorRepaid')} placeholder="0" inputMode="numeric" autoComplete="off" />
            <TextField control={form.control} name="reason" label={t('reason')} placeholder={t('reasonPlaceholder')} autoComplete="off" />
            <p className="text-muted-foreground text-sm">{t('note')}</p>
        </FormSheet>
    )
}
