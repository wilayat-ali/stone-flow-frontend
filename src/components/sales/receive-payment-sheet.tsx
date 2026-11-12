'use client'

import { useEffect, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { DateField, SelectField, TextField } from '@/components/shared/form-fields'
import { FormSheet } from '@/components/shared/form-sheet'
import { accountsKey, listAccounts } from '@/features/bank-cash/api'
import { customerChequesQueryKey, customerPaymentMethods, customerPaymentsQueryKey, receivePayment } from '@/features/customer-payments'
import { receivePaymentSchema, type ReceivePaymentValues } from '@/features/customer-payments-schema'
import { customerKhataQueryKey, customersQueryKey, listCustomerSummaries } from '@/features/customers'
import { billsQueryKey, ordersQueryKey } from '@/features/sales'
import { useSalesErrorMessage } from '@/features/use-sales-error-message'
import { useMoney } from '@/hooks/use-money'
import { todayIso } from '@/lib/format'

export type ReceivePreset = {
    customerId?: string
    amount?: number
    /** Paid with a bill, or an advance for an order: shown for reference, the payment is still applied oldest first. */
    billId?: string
    billNo?: string
    orderId?: string
    orderNo?: string
}

/** A stable default: a fresh object each render would reset the form every time. */
const NO_PRESET: ReceivePreset = {}

const emptyValues = (preset: ReceivePreset): ReceivePaymentValues => ({
    customerId: preset.customerId ?? '',
    date: todayIso(),
    method: 'cash',
    amount: preset.amount && preset.amount > 0 ? String(Math.round(preset.amount)) : '',
    accountId: '',
    bankName: '',
    chequeNo: '',
    chequeDate: '',
    note: '',
})

/**
 * Money from a customer: cash or bank transfer goes into an account; a cheque (often post-dated) credits
 * the khata now but reaches the bank only when it clears.
 */
export function ReceivePaymentSheet({
    open,
    onOpenChange,
    userName,
    preset = NO_PRESET,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    userName: string
    preset?: ReceivePreset
}) {
    const t = useTranslations('sales.receive')
    const tc = useTranslations('common')
    const tv = useTranslations('validation')
    const money = useMoney()
    const queryClient = useQueryClient()
    const errorMessage = useSalesErrorMessage()
    const schema = useMemo(() => receivePaymentSchema(tv), [tv])

    const form = useForm<ReceivePaymentValues>({ resolver: zodResolver(schema), defaultValues: emptyValues(preset) })

    const customers = useQuery({ queryKey: [customersQueryKey, 'summaries', 'all'], queryFn: () => listCustomerSummaries(), enabled: open })
    const accounts = useQuery({ queryKey: accountsKey, queryFn: listAccounts, enabled: open })

    useEffect(() => {
        if (!open) return
        form.reset(emptyValues(preset))
    }, [open, preset, form])

    const [customerId, method, amount] = useWatch({ control: form.control, name: ['customerId', 'method', 'amount'] })
    const customer = customers.data?.find((c) => c.id === customerId)

    // Pre-fill what the customer owes, until the amount has been typed.
    useEffect(() => {
        if (!open || preset.amount || form.formState.dirtyFields.amount) return
        form.setValue('amount', customer && customer.balance > 0 ? String(Math.round(customer.balance)) : '')
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [customerId, customer?.balance])

    // Cash goes into a cash account, a transfer into a bank.
    const accountOptions = (accounts.data ?? [])
        .filter((a) => a.isActive && a.kind === (method === 'cash' ? 'cash' : 'bank'))
        .map((a) => ({ value: a.id, label: a.name }))

    const accountId = useWatch({ control: form.control, name: 'accountId' })
    useEffect(() => {
        if (accountId && !accountOptions.some((o) => o.value === accountId)) form.setValue('accountId', '')
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [method, accounts.data])

    const receiving = Number(amount) || 0
    const after = (customer?.balance ?? 0) - receiving

    const save = useMutation({
        mutationFn: (values: ReceivePaymentValues) =>
            receivePayment(
                {
                    date: values.date,
                    customerId: values.customerId,
                    amount: Number(values.amount),
                    method: values.method,
                    accountId: values.accountId,
                    accountName: accounts.data?.find((a) => a.id === values.accountId)?.name ?? '',
                    bankName: values.bankName,
                    chequeNo: values.chequeNo,
                    chequeDate: values.chequeDate,
                    note: values.note,
                    billId: preset.billId,
                    billNo: preset.billNo,
                    orderId: preset.orderId,
                    orderNo: preset.orderNo,
                },
                userName
            ),
        onSuccess: ({ advance }) => {
            toast.success(advance > 0 ? t('savedAdvance', { amount: money(advance) }) : t('saved'))
            onOpenChange(false)
            for (const key of [customerPaymentsQueryKey, customerChequesQueryKey, customersQueryKey, customerKhataQueryKey, billsQueryKey, ordersQueryKey]) {
                queryClient.invalidateQueries({ queryKey: [key] })
            }
        },
        onError: (error) => toast.error(errorMessage(error)),
    })

    const reference = preset.billNo ?? preset.orderNo

    return (
        <FormSheet
            open={open}
            onOpenChange={onOpenChange}
            title={preset.orderNo ? t('advanceTitle', { no: preset.orderNo }) : preset.billNo ? t('billTitle', { no: preset.billNo }) : t('title')}
            description={t('description')}
            form={form}
            onSubmit={(values) => save.mutate(values)}
            submitLabel={t('save')}
            cancelLabel={tc('cancel')}
            pending={save.isPending}
            summary={
                customer
                    ? after < 0
                        ? t('afterAdvance', { amount: money(-after) })
                        : t('afterOwed', { amount: money(after) })
                    : undefined
            }
        >
            <SelectField
                control={form.control}
                name="customerId"
                label={t('customer')}
                placeholder={t('chooseCustomer')}
                options={(customers.data ?? []).map((c) => ({
                    value: c.id,
                    label: `${c.name} · ${c.balance > 0 ? t('owes', { amount: money(c.balance) }) : c.balance < 0 ? t('advanceOf', { amount: money(-c.balance) }) : t('settled')}`,
                }))}
            />
            {reference && <p className="text-muted-foreground -mt-2 text-sm">{t('for', { no: reference })}</p>}
            <div className="grid grid-cols-2 gap-3">
                <TextField control={form.control} name="amount" label={t('amount')} placeholder={t('amountPlaceholder')} inputMode="numeric" autoComplete="off" />
                <DateField control={form.control} name="date" label={t('date')} placeholder={t('datePlaceholder')} />
                <SelectField
                    control={form.control}
                    name="method"
                    label={t('method')}
                    options={customerPaymentMethods.map((m) => ({ value: m, label: t(`methods.${m}`) }))}
                />
                {method !== 'cheque' && (
                    <SelectField
                        control={form.control}
                        name="accountId"
                        label={method === 'cash' ? t('cashAccount') : t('bankAccount')}
                        placeholder={t('chooseAccount')}
                        options={accountOptions}
                    />
                )}
            </div>
            {method === 'cheque' && (
                <>
                    <div className="grid grid-cols-2 gap-3">
                        <TextField control={form.control} name="bankName" label={t('bankName')} placeholder={t('bankNamePlaceholder')} autoComplete="off" />
                        <TextField control={form.control} name="chequeNo" label={t('chequeNo')} placeholder={t('chequeNoPlaceholder')} autoComplete="off" />
                    </div>
                    <DateField control={form.control} name="chequeDate" label={t('chequeDate')} placeholder={t('datePlaceholder')} />
                    <p className="text-muted-foreground text-sm">{t('chequeNote')}</p>
                </>
            )}
            <TextField control={form.control} name="note" label={t('note')} placeholder={t('notePlaceholder')} autoComplete="off" />
        </FormSheet>
    )
}
