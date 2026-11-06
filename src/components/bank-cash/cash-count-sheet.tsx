'use client'

import { useEffect, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { FormSheet } from '@/components/shared/form-sheet'
import { DateField, SelectField, TextField } from '@/components/shared/form-fields'
import { bankCashKey, postEntries } from '@/features/bank-cash/api'
import { cashCountSchema, type CashCountValues } from '@/features/bank-cash/schemas'
import type { AccountOption } from '@/features/bank-cash/types'
import { useMoney } from '@/hooks/use-money'
import { cn } from '@/lib/utils'
import { todayIso } from '@/lib/format'

/** Cash count: the counted amount against the books; the difference is posted with a reason. */
export function CashCountSheet({
    open,
    onOpenChange,
    accounts,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Cash accounts only. */
    accounts: AccountOption[]
}) {
    const t = useTranslations('settings.bankCash')
    const tc = useTranslations('common')
    const tv = useTranslations('validation')
    const money = useMoney()
    const queryClient = useQueryClient()
    const schema = useMemo(() => cashCountSchema(tv), [tv])
    const onlyId = accounts.length === 1 ? accounts[0].id : ''

    const form = useForm<CashCountValues>({
        resolver: zodResolver(schema),
        defaultValues: { accountId: onlyId, date: todayIso(), counted: '', reason: '' },
    })

    useEffect(() => {
        if (open) form.reset({ accountId: onlyId, date: todayIso(), counted: '', reason: '' })
    }, [open, onlyId, form])

    const [accountId, counted] = useWatch({ control: form.control, name: ['accountId', 'counted'] })
    const account = accounts.find((a) => a.id === accountId)
    const difference = account && counted.trim() !== '' ? Number(counted) - account.balance : null

    const save = useMutation({
        mutationFn: (values: CashCountValues) => {
            const diff = Number(values.counted) - (account?.balance ?? 0)
            return postEntries([
                {
                    accountId: values.accountId,
                    date: values.date,
                    direction: diff > 0 ? 'in' : 'out',
                    amount: Math.abs(diff),
                    type: 'adjustment',
                    refNo: null,
                    note: values.reason,
                },
            ])
        },
        onSuccess: () => {
            toast.success(t('entrySaved'))
            onOpenChange(false)
            queryClient.invalidateQueries({ queryKey: bankCashKey })
        },
    })

    return (
        <FormSheet
            open={open}
            onOpenChange={onOpenChange}
            title={t('types.adjustment')}
            form={form}
            onSubmit={(values) => save.mutate(values)}
            submitLabel={tc('save')}
            cancelLabel={tc('cancel')}
            pending={save.isPending}
            submitDisabled={difference === 0}
            summary={
                account &&
                difference !== null && (
                    <dl className="flex flex-col gap-1">
                        <div className="flex justify-between gap-4">
                            <dt>{t('inBooks')}</dt>
                            <bdi className="tabular-nums">{money(account.balance)}</bdi>
                        </div>
                        <div className="flex justify-between gap-4">
                            <dt>{t('difference')}</dt>
                            <bdi
                                className={cn(
                                    'font-medium tabular-nums',
                                    difference > 0 && 'text-success',
                                    difference < 0 && 'text-destructive'
                                )}
                            >
                                {difference > 0 && '+'}
                                {money(difference)}
                            </bdi>
                        </div>
                    </dl>
                )
            }
        >
            {accounts.length > 1 && (
                <SelectField
                    control={form.control}
                    name="accountId"
                    label={t('account')}
                placeholder={t('placeholders.account')}
                    options={accounts.map((a) => ({ value: a.id, label: a.name }))}
                />
            )}
            <DateField
                control={form.control}
                name="date"
                label={t('date')}
                placeholder={t('placeholders.date')}
            />
            <TextField
                control={form.control}
                name="counted"
                label={t('counted')}
                placeholder={t('placeholders.counted')}
                inputMode="decimal"
                autoComplete="off"
            />
            <TextField control={form.control} name="reason" label={t('reason')} placeholder={t('placeholders.reason')} autoComplete="off" />
        </FormSheet>
    )
}
