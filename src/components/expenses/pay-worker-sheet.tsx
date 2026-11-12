'use client'

import { useEffect, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { DateField, SelectField, TextField } from '@/components/shared/form-fields'
import { FormSheet } from '@/components/shared/form-sheet'
import { companySettingsKey, getCompanySettings } from '@/features/company-settings'
import { expensesQueryKey, munshiCashQueryKey } from '@/features/expenses'
import { useExpenseErrorMessage } from '@/features/use-expense-error-message'
import { listWorkers, workerKhataQueryKey } from '@/features/worker-khata'
import { createWorkerPayment, workerPaymentsQueryKey } from '@/features/worker-payments'
import { payWorkerSchema, type PayWorkerValues } from '@/features/workers-schema'
import { workersQueryKey } from '@/features/workers'
import { useMoney } from '@/hooks/use-money'
import { todayIso } from '@/lib/format'
import { useAccountBalances } from './use-account-balances'

export type PayWorkerPreset = { workerId?: string }

const NO_PRESET: PayWorkerPreset = {}

const emptyValues = (roleKey: string, preset: PayWorkerPreset, munshiId: string): PayWorkerValues => ({
    workerId: preset.workerId ?? '',
    amount: '',
    // A munshi pays from his own cash.
    accountId: roleKey === 'munshi' ? munshiId : '',
    date: todayIso(),
    note: '',
})

/**
 * Workers take money any time, as an advance or a payment: it comes out of cash, a bank or the munshi's
 * cash and goes on the worker's khata. A munshi's payment waits for the owner when approval is on.
 */
export function PayWorkerSheet({
    open,
    onOpenChange,
    roleKey,
    userName,
    preset = NO_PRESET,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    roleKey: string
    userName: string
    preset?: PayWorkerPreset
}) {
    const t = useTranslations('expenses.payWorker')
    const tc = useTranslations('common')
    const tv = useTranslations('validation')
    const money = useMoney()
    const queryClient = useQueryClient()
    const errorMessage = useExpenseErrorMessage()
    const schema = useMemo(() => payWorkerSchema(tv), [tv])

    const { accounts, munshi } = useAccountBalances(open, t('munshiCash'))
    const form = useForm<PayWorkerValues>({ resolver: zodResolver(schema), defaultValues: emptyValues(roleKey, preset, munshi.id) })

    const workers = useQuery({ queryKey: [workersQueryKey, 'summaries'], queryFn: () => listWorkers(), enabled: open })
    const settings = useQuery({ queryKey: companySettingsKey, queryFn: getCompanySettings })

    useEffect(() => {
        if (open) form.reset(emptyValues(roleKey, preset, munshi.id))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, preset, roleKey, form])

    const [workerId, accountId, amount] = useWatch({ control: form.control, name: ['workerId', 'accountId', 'amount'] })
    const worker = workers.data?.find((w) => w.id === workerId)
    const payAccounts = [munshi, ...accounts]
    const account = payAccounts.find((a) => a.id === accountId)
    const paying = Number(amount) || 0
    const short = !!account && account.kind !== 'munshi' && account.balance !== null && paying > account.balance
    const after = (worker?.balance ?? 0) - paying

    const save = useMutation({
        mutationFn: (values: PayWorkerValues) =>
            createWorkerPayment(
                {
                    date: values.date,
                    workerId: values.workerId,
                    workerName: worker?.name ?? '',
                    amount: Number(values.amount),
                    accountId: values.accountId,
                    accountName: payAccounts.find((a) => a.id === values.accountId)?.name ?? '',
                    note: values.note,
                },
                { pending: roleKey === 'munshi' && (settings.data?.approvalRequired ?? true), by: userName }
            ),
        onSuccess: (payment) => {
            toast.success(payment.status === 'pending' ? t('savedPending') : t('saved'))
            onOpenChange(false)
            for (const key of [workerPaymentsQueryKey, workerKhataQueryKey, workersQueryKey, munshiCashQueryKey, expensesQueryKey]) {
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
                ) : worker ? (
                    after < 0 ? (
                        t('afterAdvance', { amount: money(-after) })
                    ) : (
                        t('afterOwed', { amount: money(after) })
                    )
                ) : undefined
            }
        >
            <SelectField
                control={form.control}
                name="workerId"
                label={t('worker')}
                placeholder={t('chooseWorker')}
                options={(workers.data ?? [])
                    .filter((w) => w.isActive)
                    .map((w) => ({
                        value: w.id,
                        label: `${w.name} · ${w.balance > 0 ? t('owed', { amount: money(w.balance) }) : w.balance < 0 ? t('advance', { amount: money(-w.balance) }) : t('settled')}`,
                    }))}
            />
            <div className="grid grid-cols-2 gap-3">
                <TextField control={form.control} name="amount" label={t('amount')} placeholder={t('amountPlaceholder')} inputMode="numeric" autoComplete="off" />
                <DateField control={form.control} name="date" label={t('date')} placeholder={t('datePlaceholder')} />
            </div>
            <SelectField
                control={form.control}
                name="accountId"
                label={t('from')}
                placeholder={t('chooseAccount')}
                options={payAccounts.map((a) => ({ value: a.id, label: a.balance === null ? a.name : `${a.name} · ${money(a.balance)}` }))}
            />
            <TextField control={form.control} name="note" label={t('note')} placeholder={t('notePlaceholder')} autoComplete="off" />
        </FormSheet>
    )
}
