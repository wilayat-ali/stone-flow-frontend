'use client'

import { useEffect, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { FormSheet } from '@/components/shared/form-sheet'
import { DateField, SelectField, TextField } from '@/components/shared/form-fields'
import { bankCashKey, createAccount, updateAccount } from '@/features/bank-cash/api'
import { accountSchema, type AccountValues } from '@/features/bank-cash/schemas'
import type { Account } from '@/features/bank-cash/types'
import { useErrorMessage } from '@/features/bank-cash/use-error-message'
import { todayIso } from '@/lib/format'

const emptyValues = (kind: AccountValues['kind']): AccountValues => ({
    kind,
    name: '',
    last4: '',
    openingBalance: '0',
    openingDate: todayIso(),
})

/** Add a new account, or edit `account`. A company may have several cash accounts and banks. */
export function AccountSheet({
    open,
    onOpenChange,
    account,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** The account being edited; omit to add one. */
    account?: Account
}) {
    const t = useTranslations('settings.bankCash')
    const tc = useTranslations('common')
    const tv = useTranslations('validation')
    const queryClient = useQueryClient()
    const errorMessage = useErrorMessage()
    const schema = useMemo(() => accountSchema(tv), [tv])

    const form = useForm<AccountValues>({
        resolver: zodResolver(schema),
        defaultValues: emptyValues('bank'),
    })

    useEffect(() => {
        if (!open) return
        form.reset(
            account
                ? {
                      kind: account.kind,
                      name: account.name,
                      last4: account.last4 ?? '',
                      openingBalance: String(account.openingBalance),
                      openingDate: account.openingDate,
                  }
                : emptyValues('bank')
        )
    }, [open, account, form])

    const save = useMutation({
        mutationFn: (values: AccountValues) => {
            const input = {
                kind: values.kind,
                name: values.name,
                last4: values.kind === 'bank' ? values.last4 : null,
                openingBalance: Number(values.openingBalance),
                openingDate: values.openingDate,
            }
            return account ? updateAccount(account.id, input) : createAccount(input)
        },
        onSuccess: () => {
            toast.success(account ? t('accountUpdated') : t('accountAdded'))
            onOpenChange(false)
            queryClient.invalidateQueries({ queryKey: bankCashKey })
        },
        onError: (error) => toast.error(errorMessage(error)),
    })

    const kind = useWatch({ control: form.control, name: 'kind' })

    return (
        <FormSheet
            open={open}
            onOpenChange={onOpenChange}
            title={account ? t('editAccount') : t('addAccount')}
            form={form}
            onSubmit={(values) => save.mutate(values)}
            submitLabel={tc('save')}
            cancelLabel={tc('cancel')}
            pending={save.isPending}
        >
            {!account && (
                <SelectField
                    control={form.control}
                    name="kind"
                    label={t('kind')}
                    placeholder={t('placeholders.kind')}
                    options={[
                        { value: 'cash', label: t('kindCash') },
                        { value: 'bank', label: t('kindBank') },
                    ]}
                />
            )}
            <TextField control={form.control} name="name" label={t('name')} placeholder={t('placeholders.name')} autoComplete="off" />
            {kind === 'bank' && (
                <TextField
                    control={form.control}
                    name="last4"
                    label={t('last4')}
                    placeholder={t('placeholders.last4')}
                    inputMode="numeric"
                    maxLength={4}
                    autoComplete="off"
                />
            )}
            {/* The opening balance is the first row of the account's history, so it cannot be edited. */}
            {!account && (
                <>
                    <TextField
                        control={form.control}
                        name="openingBalance"
                        label={t('openingBalance')}
                        placeholder={t('placeholders.openingBalance')}
                        inputMode="decimal"
                        autoComplete="off"
                    />
                    <DateField
                        control={form.control}
                        name="openingDate"
                        label={t('openingDate')}
                        placeholder={t('placeholders.date')}
                    />
                </>
            )}
        </FormSheet>
    )
}
