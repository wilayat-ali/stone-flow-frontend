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
import { transferSchema, type TransferValues } from '@/features/bank-cash/schemas'
import type { AccountOption } from '@/features/bank-cash/types'
import { useErrorMessage } from '@/features/bank-cash/use-error-message'
import { useMoney } from '@/hooks/use-money'
import { todayIso } from '@/lib/format'

/** Moves money between two accounts: one row out of the first, one row into the second. */
export function TransferSheet({
    open,
    onOpenChange,
    accounts,
    defaultFromId,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    accounts: AccountOption[]
    defaultFromId?: string
}) {
    const t = useTranslations('settings.bankCash')
    const tc = useTranslations('common')
    const tv = useTranslations('validation')
    const money = useMoney()
    const queryClient = useQueryClient()
    const errorMessage = useErrorMessage()
    const schema = useMemo(() => transferSchema(tv), [tv])

    const form = useForm<TransferValues>({
        resolver: zodResolver(schema),
        defaultValues: { fromId: '', toId: '', date: todayIso(), amount: '', note: '' },
    })

    useEffect(() => {
        if (open) {
            form.reset({ fromId: defaultFromId ?? '', toId: '', date: todayIso(), amount: '', note: '' })
        }
    }, [open, defaultFromId, form])

    const save = useMutation({
        mutationFn: (values: TransferValues) => {
            const from = accounts.find((a) => a.id === values.fromId)
            const to = accounts.find((a) => a.id === values.toId)
            const base = { date: values.date, amount: Number(values.amount), type: 'transfer' as const, refNo: null }
            return postEntries([
                { ...base, accountId: values.fromId, direction: 'out', note: values.note || to?.name || null },
                { ...base, accountId: values.toId, direction: 'in', note: values.note || from?.name || null },
            ])
        },
        onSuccess: () => {
            toast.success(t('transferred'))
            onOpenChange(false)
            queryClient.invalidateQueries({ queryKey: bankCashKey })
        },
        onError: (error) => toast.error(errorMessage(error)),
    })

    const [fromId, toId, amount] = useWatch({ control: form.control, name: ['fromId', 'toId', 'amount'] })
    const from = accounts.find((a) => a.id === fromId)
    const to = accounts.find((a) => a.id === toId)
    const value = Number(amount)
    const ready = !!from && !!to && from.id !== to.id && value > 0

    const options = accounts.map((a) => ({ value: a.id, label: a.name }))

    return (
        <FormSheet
            open={open}
            onOpenChange={onOpenChange}
            title={t('transfer')}
            form={form}
            onSubmit={(values) => save.mutate(values)}
            submitLabel={tc('save')}
            cancelLabel={tc('cancel')}
            pending={save.isPending}
            summary={
                ready && (
                    <div className="flex flex-col gap-1">
                        <span>{t('transferSummary', { amount: money(value), from: from.name, to: to.name })}</span>
                        {value > from.balance && (
                            <span className="text-destructive">
                                {t('exceedsBalance', { from: from.name, balance: money(from.balance) })}
                            </span>
                        )}
                    </div>
                )
            }
        >
            <SelectField control={form.control} name="fromId" label={t('fromAccount')} placeholder={t('placeholders.account')} options={options} />
            <SelectField control={form.control} name="toId" label={t('toAccount')} placeholder={t('placeholders.account')} options={options} />
            <DateField
                control={form.control}
                name="date"
                label={t('date')}
                placeholder={t('placeholders.date')}
            />
            <TextField
                control={form.control}
                name="amount"
                label={t('amount')}
                placeholder={t('placeholders.amount')}
                inputMode="decimal"
                autoComplete="off"
            />
            <TextField control={form.control} name="note" label={t('noteOptional')} placeholder={t('placeholders.note')} autoComplete="off" />
        </FormSheet>
    )
}
