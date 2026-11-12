'use client'

import { useEffect, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useFormatter, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { DateField, SelectField, TextField } from '@/components/shared/form-fields'
import { FormSheet } from '@/components/shared/form-sheet'
import { accountsKey, listAccounts } from '@/features/bank-cash/api'
import { companySettingsKey, getCompanySettings } from '@/features/company-settings'
import { listPurchases, purchasesQueryKey } from '@/features/purchases'
import {
    chequesQueryKey,
    createPayment,
    paymentMethods,
    paymentsByPurchase,
    paymentsQueryKey,
    type Cheque,
} from '@/features/supplier-payments'
import { paymentSchema, type PaymentValues } from '@/features/supplier-payments-schema'
import { listSuppliers, suppliersQueryKey } from '@/features/suppliers'
import { usePaymentErrorMessage } from '@/features/use-payment-error-message'
import { useMoney } from '@/hooks/use-money'
import { todayIso } from '@/lib/format'

export type PaymentPreset = {
    supplierId?: string
    amount?: number
    /** Trucks to pay for, when the payment starts from one truck. */
    purchaseIds?: string[]
    /** A bounced cheque this payment replaces. */
    replaces?: Cheque
}

/** A stable default: a fresh object each render would reset the form every time. */
const NO_PRESET: PaymentPreset = {}

const emptyValues = (preset: PaymentPreset): PaymentValues => ({
    supplierId: preset.supplierId ?? '',
    date: todayIso(),
    method: 'cash',
    amount: preset.amount ? String(Math.round(preset.amount)) : '',
    accountId: '',
    reference: '',
    chequeNo: '',
    chequeDate: '',
    applyTo: preset.purchaseIds?.length ? 'pick' : 'fifo',
    note: '',
    picked: preset.purchaseIds ?? [],
})

/** Pay a mine owner, cutting factory or shop: cash, bank transfer or cheque, applied to their trucks. */
export function PaymentSheet({
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
    preset?: PaymentPreset
}) {
    const t = useTranslations('purchases')
    const tc = useTranslations('common')
    const tv = useTranslations('validation')
    const format = useFormatter()
    const money = useMoney()
    const queryClient = useQueryClient()
    const errorMessage = usePaymentErrorMessage()
    const schema = useMemo(() => paymentSchema(tv), [tv])

    const form = useForm<PaymentValues>({ resolver: zodResolver(schema), defaultValues: emptyValues(preset) })

    const suppliers = useQuery({ queryKey: [suppliersQueryKey, {}], queryFn: () => listSuppliers(), enabled: open })
    const accounts = useQuery({ queryKey: accountsKey, queryFn: listAccounts, enabled: open })
    const purchases = useQuery({ queryKey: [purchasesQueryKey, 'all'], queryFn: () => listPurchases(), enabled: open })
    const settings = useQuery({ queryKey: companySettingsKey, queryFn: getCompanySettings, enabled: open })

    useEffect(() => {
        if (!open) return
        form.reset(emptyValues(preset))
    }, [open, preset, form])

    const [supplierId, method, amount, applyTo, picked] = useWatch({
        control: form.control,
        name: ['supplierId', 'method', 'amount', 'applyTo', 'picked'],
    })

    // A cash payment leaves a cash account; bank transfers and cheques leave a bank.
    const accountOptions = (accounts.data ?? [])
        .filter((a) => a.isActive && a.kind === (method === 'cash' ? 'cash' : 'bank'))
        .map((a) => ({ value: a.id, label: a.name }))

    // The chosen account may not suit a changed method.
    const accountId = useWatch({ control: form.control, name: 'accountId' })
    useEffect(() => {
        if (accountId && !accountOptions.some((o) => o.value === accountId)) form.setValue('accountId', '')
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [method, accounts.data])

    const supplier = suppliers.data?.find((s) => s.id === supplierId)
    const unpaid = useMemo(() => {
        const info = paymentsByPurchase()
        return (purchases.data ?? [])
            .filter((p) => p.supplierId === supplierId && ['in_stock', 'cutting', 'cut'].includes(p.status))
            .map((p) => ({ purchase: p, remaining: p.total - (info.get(p.id)?.paid ?? 0) }))
            .filter((x) => x.remaining > 0)
            .sort((a, b) => a.purchase.date.localeCompare(b.purchase.date))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [purchases.data, supplierId, open])

    const paying = Number(amount) || 0
    const after = (supplier?.balance ?? 0) - paying

    const save = useMutation({
        mutationFn: (values: PaymentValues) =>
            createPayment(
                {
                    date: values.date,
                    supplierId: values.supplierId,
                    supplierName: supplier?.name ?? '',
                    method: values.method,
                    accountId: values.accountId,
                    accountName: accounts.data?.find((a) => a.id === values.accountId)?.name ?? '',
                    amount: Number(values.amount),
                    reference: values.method === 'bank_transfer' ? values.reference : '',
                    chequeNo: values.chequeNo,
                    chequeDate: values.chequeDate,
                    forPurchaseIds: values.applyTo === 'pick' ? values.picked : [],
                    note: preset.replaces ? t('pay.replacementNote', { no: preset.replaces.no }) : values.note,
                    replacesChequeId: preset.replaces?.id,
                },
                { pending: roleKey === 'munshi' && (settings.data?.approvalRequired ?? true), by: userName }
            ),
        onSuccess: (payment) => {
            toast.success(payment.status === 'pending' ? t('pay.savedPending') : t('pay.saved'))
            onOpenChange(false)
            for (const key of [paymentsQueryKey, chequesQueryKey, purchasesQueryKey, suppliersQueryKey]) {
                queryClient.invalidateQueries({ queryKey: [key] })
            }
        },
        onError: (error) => toast.error(errorMessage(error)),
    })

    return (
        <FormSheet
            open={open}
            onOpenChange={onOpenChange}
            title={preset.replaces ? t('pay.replaceTitle', { no: preset.replaces.no }) : t('pay.title')}
            description={preset.replaces ? t('pay.replaceDescription') : t('pay.description')}
            form={form}
            onSubmit={(values) => {
                if (values.applyTo === 'pick' && unpaid.length > 0 && values.picked.length === 0) {
                    toast.error(t('pay.pickOne'))
                    return
                }
                save.mutate(values)
            }}
            submitLabel={t('pay.save')}
            cancelLabel={tc('cancel')}
            pending={save.isPending}
            summary={
                supplier
                    ? after < 0
                        ? t('pay.afterAdvance', { amount: money(-after) })
                        : t('pay.afterOwed', { amount: money(after) })
                    : undefined
            }
        >
            <SelectField
                control={form.control}
                name="supplierId"
                label={t('pay.supplier')}
                placeholder={t('pay.chooseSupplier')}
                options={(suppliers.data ?? [])
                    .filter((s) => s.isActive)
                    .map((s) => ({ value: s.id, label: `${s.name} · ${t(`pay.types.${s.type}`)}` }))}
            />
            <div className="grid grid-cols-2 gap-3">
                <TextField control={form.control} name="amount" label={t('pay.amount')} inputMode="numeric" autoComplete="off" />
                <DateField control={form.control} name="date" label={t('pay.date')} placeholder={t('placeholders.date')} />
                <SelectField
                    control={form.control}
                    name="method"
                    label={t('pay.method')}
                    options={paymentMethods.map((m) => ({ value: m, label: t(`pay.methods.${m}`) }))}
                />
                <SelectField
                    control={form.control}
                    name="accountId"
                    label={t('pay.account')}
                    placeholder={t('pay.chooseAccount')}
                    options={accountOptions}
                />
            </div>
            {method === 'bank_transfer' && (
                <TextField control={form.control} name="reference" label={t('pay.reference')} autoComplete="off" />
            )}
            {method === 'cheque' && (
                <div className="grid grid-cols-2 gap-3">
                    <TextField control={form.control} name="chequeNo" label={t('pay.chequeNo')} autoComplete="off" />
                    <DateField
                        control={form.control}
                        name="chequeDate"
                        label={t('pay.chequeDate')}
                        placeholder={t('placeholders.date')}
                    />
                </div>
            )}

            {supplierId && (
                <div className="flex flex-col gap-2">
                    <SelectField
                        control={form.control}
                        name="applyTo"
                        label={t('pay.applyTo')}
                        options={[
                            { value: 'fifo', label: t('pay.fifo') },
                            { value: 'pick', label: t('pay.pick') },
                        ]}
                    />
                    {unpaid.length === 0 ? (
                        <p className="text-muted-foreground text-sm">{t('pay.nothingUnpaid')}</p>
                    ) : (
                        <ul className="flex max-h-44 flex-col gap-1 overflow-y-auto rounded-md border p-2">
                            {unpaid.map(({ purchase, remaining }) => (
                                <li key={purchase.id} className="flex items-center gap-2 text-sm">
                                    {applyTo === 'pick' && (
                                        <Checkbox
                                            id={`pick-${purchase.id}`}
                                            checked={picked.includes(purchase.id)}
                                            onCheckedChange={(checked) =>
                                                form.setValue(
                                                    'picked',
                                                    checked ? [...picked, purchase.id] : picked.filter((id) => id !== purchase.id)
                                                )
                                            }
                                        />
                                    )}
                                    <Label htmlFor={`pick-${purchase.id}`} className="flex-1 font-normal">
                                        <span className="tabular-nums" dir="ltr">{purchase.mark}</span> · {t('purchi', { no: purchase.purchiNo })} ·{' '}
                                        {format.dateTime(new Date(`${purchase.date}T00:00:00`), { dateStyle: 'medium' })}
                                    </Label>
                                    <span className="font-medium tabular-nums">{money(remaining)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
            <TextField control={form.control} name="note" label={t('fields.note')} autoComplete="off" />
        </FormSheet>
    )
}
