'use client'

import { useEffect, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { DateField, SelectField, TextField } from '@/components/shared/form-fields'
import { FormSheet } from '@/components/shared/form-sheet'
import { expensesQueryKey, getMunshiCash, giveCashToMunshi, munshiCashQueryKey } from '@/features/expenses'
import { giveCashSchema, type GiveCashValues } from '@/features/expenses-schema'
import { useExpenseErrorMessage } from '@/features/use-expense-error-message'
import { useMoney } from '@/hooks/use-money'
import { todayIso } from '@/lib/format'
import { useAccountBalances } from './use-account-balances'

const emptyValues = (amount?: number): GiveCashValues => ({
    fromAccountId: '',
    amount: amount && amount > 0 ? String(Math.round(amount)) : '',
    date: todayIso(),
    note: '',
})

/**
 * A transfer from cash or a bank to Munshi cash. The munshi pays small expenses and worker payments from
 * it; when it has gone negative this is also how the owner settles up what he owes him.
 */
export function GiveCashSheet({
    open,
    onOpenChange,
    userName,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    userName: string
}) {
    const t = useTranslations('expenses.give')
    const tc = useTranslations('common')
    const tv = useTranslations('validation')
    const money = useMoney()
    const queryClient = useQueryClient()
    const errorMessage = useExpenseErrorMessage()
    const schema = useMemo(() => giveCashSchema(tv), [tv])
    const form = useForm<GiveCashValues>({ resolver: zodResolver(schema), defaultValues: emptyValues() })

    const munshi = useQuery({ queryKey: [munshiCashQueryKey], queryFn: getMunshiCash, enabled: open })
    const { accounts } = useAccountBalances(open, '')

    // When the munshi is owed money, the amount starts at what settles him.
    const owed = munshi.data?.ownerOwes ?? 0
    useEffect(() => {
        if (open) form.reset(emptyValues(owed))
    }, [open, owed, form])

    const [fromAccountId, amount] = useWatch({ control: form.control, name: ['fromAccountId', 'amount'] })
    const from = accounts.find((a) => a.id === fromAccountId)
    const giving = Number(amount) || 0
    const short = !!from && from.balance !== null && giving > from.balance
    const after = (munshi.data?.balance ?? 0) + giving

    const save = useMutation({
        mutationFn: (values: GiveCashValues) =>
            giveCashToMunshi(
                {
                    fromAccountId: values.fromAccountId,
                    fromAccountName: accounts.find((a) => a.id === values.fromAccountId)?.name ?? '',
                    amount: Number(values.amount),
                    date: values.date,
                    note: values.note,
                },
                userName
            ),
        onSuccess: () => {
            toast.success(t('saved'))
            onOpenChange(false)
            for (const key of [munshiCashQueryKey, expensesQueryKey]) queryClient.invalidateQueries({ queryKey: [key] })
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
                    <span className="text-destructive">{t('short', { account: from?.name ?? '', amount: money(from?.balance ?? 0) })}</span>
                ) : munshi.data ? (
                    after < 0 ? t('afterOwed', { amount: money(-after) }) : t('after', { amount: money(after) })
                ) : undefined
            }
        >
            {owed > 0 && <p className="bg-muted rounded-lg border px-3 py-2 text-sm">{t('owed', { amount: money(owed) })}</p>}
            <SelectField
                control={form.control}
                name="fromAccountId"
                label={t('from')}
                placeholder={t('chooseAccount')}
                options={accounts.map((a) => ({ value: a.id, label: a.balance === null ? a.name : `${a.name} · ${money(a.balance)}` }))}
            />
            <div className="grid grid-cols-2 gap-3">
                <TextField control={form.control} name="amount" label={t('amount')} placeholder={t('amountPlaceholder')} inputMode="numeric" autoComplete="off" />
                <DateField control={form.control} name="date" label={t('date')} placeholder={t('datePlaceholder')} />
            </div>
            <TextField control={form.control} name="note" label={t('note')} placeholder={t('notePlaceholder')} autoComplete="off" />
        </FormSheet>
    )
}
