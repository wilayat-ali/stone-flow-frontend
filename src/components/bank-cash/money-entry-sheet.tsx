'use client'

import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { FormSheet } from '@/components/shared/form-sheet'
import { DateField, SelectField, TextField } from '@/components/shared/form-fields'
import { bankCashKey, postEntries } from '@/features/bank-cash/api'
import { entrySchema, type EntryValues } from '@/features/bank-cash/schemas'
import type { AccountOption, Direction, EntryType } from '@/features/bank-cash/types'
import { useErrorMessage } from '@/features/bank-cash/use-error-message'
import { todayIso } from '@/lib/format'

export type MoneyMode = 'deposit' | 'otherReceipt' | 'otherPayment'

const directionOf: Record<MoneyMode, Direction> = {
    deposit: 'in',
    otherReceipt: 'in',
    otherPayment: 'out',
}

/** Money in (deposit, other receipt) or money out (other payment) on one account. */
export function MoneyEntrySheet({
    mode,
    onClose,
    accounts,
    defaultAccountId,
}: {
    /** `null` keeps the sheet closed. */
    mode: MoneyMode | null
    onClose: () => void
    accounts: AccountOption[]
    defaultAccountId?: string
}) {
    const t = useTranslations('settings.bankCash')
    const tc = useTranslations('common')
    const tv = useTranslations('validation')
    const queryClient = useQueryClient()
    const errorMessage = useErrorMessage()
    const schema = useMemo(() => entrySchema(tv), [tv])

    const form = useForm<EntryValues>({
        resolver: zodResolver(schema),
        defaultValues: { accountId: '', date: todayIso(), amount: '', note: '' },
    })

    useEffect(() => {
        if (mode) {
            form.reset({ accountId: defaultAccountId ?? '', date: todayIso(), amount: '', note: '' })
        }
    }, [mode, defaultAccountId, form])

    const save = useMutation({
        mutationFn: (values: EntryValues) =>
            postEntries([
                {
                    accountId: values.accountId,
                    date: values.date,
                    direction: directionOf[mode as MoneyMode],
                    amount: Number(values.amount),
                    type: mode as Exclude<EntryType, 'opening'>,
                    refNo: null,
                    note: values.note || null,
                },
            ]),
        onSuccess: () => {
            toast.success(t('entrySaved'))
            onClose()
            queryClient.invalidateQueries({ queryKey: bankCashKey })
        },
        onError: (error) => toast.error(errorMessage(error)),
    })

    return (
        <FormSheet
            open={!!mode}
            onOpenChange={(open) => !open && onClose()}
            title={mode ? t(`types.${mode}`) : ''}
            form={form}
            onSubmit={(values) => save.mutate(values)}
            submitLabel={tc('save')}
            cancelLabel={tc('cancel')}
            pending={save.isPending}
        >
            <SelectField
                control={form.control}
                name="accountId"
                label={t('account')}
                placeholder={t('placeholders.account')}
                options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            />
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
