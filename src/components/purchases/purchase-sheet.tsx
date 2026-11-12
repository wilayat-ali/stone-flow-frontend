'use client'

import { useEffect, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { DateField, SelectField, TextField, TextareaField } from '@/components/shared/form-fields'
import { FormSheet } from '@/components/shared/form-sheet'
import { accountsKey, listAccounts } from '@/features/bank-cash/api'
import { chequesQueryKey, createPayment, paymentMethods, paymentsQueryKey } from '@/features/supplier-payments'
import { companySettingsKey, getCompanySettings } from '@/features/company-settings'
import { factoriesQueryKey, listFactories } from '@/features/factories'
import {
    createPurchase,
    grossOf,
    materials,
    purchasesQueryKey,
    totalOf,
    updatePurchase,
    type Purchase,
    type PurchaseInput,
} from '@/features/purchases'
import { purchaseSchema, type PurchaseValues } from '@/features/purchases-schema'
import { usePurchaseErrorMessage } from '@/features/use-purchase-error-message'
import { listSuppliers, suppliersQueryKey } from '@/features/suppliers'
import { useMoney } from '@/hooks/use-money'
import { todayIso } from '@/lib/format'

const emptyValues = (): PurchaseValues => ({
    purchiNo: '',
    truckNo: '',
    supplierId: '',
    date: todayIso(),
    material: '',
    factoryId: '',
    tons: '',
    ratePerTon: '',
    stones: '',
    discount: '',
    note: '',
    paidMethod: 'none',
    paidAmount: '',
    paidAccountId: '',
    chequeNo: '',
    chequeDate: '',
})

/** What the form shows at the top: the total, worked out live from the purchi. */
function TotalBar({ tons, rate, discount }: { tons: number; rate: number; discount: number }) {
    const t = useTranslations('purchases')
    const money = useMoney()
    const gross = tons > 0 && rate > 0 ? grossOf(tons, rate) : 0

    return (
        <div className="bg-primary text-primary-foreground flex flex-wrap items-center justify-between gap-2 rounded-lg px-4 py-3">
            <div>
                <div className="text-xs uppercase opacity-80">{t('total')}</div>
                <div className="text-2xl font-semibold tabular-nums">{money(totalOf(tons, rate, discount))}</div>
            </div>
            <div className="text-sm tabular-nums opacity-90">
                {gross ? (
                    <>
                        {tons} × {money(rate)} = {money(gross)}
                        {discount > 0 && <div>− {money(discount)}</div>}
                    </>
                ) : (
                    t('enterTonsAndRate')
                )}
            </div>
        </div>
    )
}

/** A truck from the kanta purchi: new, or `purchase` being edited (pending or in stock only). */
export function PurchaseSheet({
    open,
    onOpenChange,
    purchase,
    roleKey,
    userName,
    onSaved,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    purchase?: Purchase
    roleKey: string
    userName: string
    /** Called with the new purchase, so the page can show its mark. */
    onSaved: (purchase: Purchase | null) => void
}) {
    const t = useTranslations('purchases')
    const tc = useTranslations('common')
    const tv = useTranslations('validation')
    const queryClient = useQueryClient()
    const errorMessage = usePurchaseErrorMessage()
    const schema = useMemo(() => purchaseSchema(tv), [tv])

    const form = useForm<PurchaseValues>({ resolver: zodResolver(schema), defaultValues: emptyValues() })

    const suppliers = useQuery({
        queryKey: [suppliersQueryKey, { type: 'mine_owner' }],
        queryFn: () => listSuppliers({ type: 'mine_owner' }),
        enabled: open,
    })
    const factories = useQuery({ queryKey: [factoriesQueryKey], queryFn: listFactories, enabled: open })
    const accounts = useQuery({ queryKey: accountsKey, queryFn: listAccounts, enabled: open && !purchase })
    const settings = useQuery({ queryKey: companySettingsKey, queryFn: getCompanySettings, enabled: open })

    useEffect(() => {
        if (!open) return
        form.reset(
            purchase
                ? {
                      purchiNo: purchase.purchiNo,
                      truckNo: purchase.truckNo,
                      supplierId: purchase.supplierId,
                      date: purchase.date,
                      material: purchase.material,
                      factoryId: purchase.factoryId,
                      tons: String(purchase.tons),
                      ratePerTon: String(purchase.ratePerTon),
                      stones: String(purchase.stones),
                      discount: purchase.discount ? String(purchase.discount) : '',
                      note: purchase.note,
                      paidMethod: 'none',
                      paidAmount: '',
                      paidAccountId: '',
                      chequeNo: '',
                      chequeDate: '',
                  }
                : emptyValues()
        )
    }, [open, purchase, form])

    const save = useMutation({
        mutationFn: async (values: PurchaseValues) => {
            const input: PurchaseInput = {
                date: values.date,
                supplierId: values.supplierId,
                supplierName: suppliers.data?.find((s) => s.id === values.supplierId)?.name ?? '',
                material: values.material,
                purchiNo: values.purchiNo,
                truckNo: values.truckNo.toUpperCase(),
                tons: Number(values.tons),
                ratePerTon: Number(values.ratePerTon),
                discount: Number(values.discount || 0),
                stones: Number(values.stones),
                factoryId: values.factoryId,
                factoryName: factories.data?.find((f) => f.id === values.factoryId)?.name ?? '',
                note: values.note,
            }
            // A munshi's entry waits for the owner when approval is on.
            const pending = roleKey === 'munshi' && (settings.data?.approvalRequired ?? true)
            if (purchase) return updatePurchase(purchase.id, input)
            const created = await createPurchase(input, { pending, by: userName })
            if (values.paidMethod !== 'none') {
                // Linked to this truck; a munshi's payment waits for the owner like the purchase does.
                await createPayment(
                    {
                        date: values.date,
                        supplierId: values.supplierId,
                        supplierName: input.supplierName,
                        method: values.paidMethod,
                        accountId: values.paidAccountId,
                        accountName: accounts.data?.find((a) => a.id === values.paidAccountId)?.name ?? '',
                        amount: Number(values.paidAmount),
                        reference: '',
                        chequeNo: values.chequeNo,
                        chequeDate: values.chequeDate,
                        forPurchaseIds: [created.id],
                        note: t('paidNow.note'),
                    },
                    { pending, by: userName }
                )
            }
            return created
        },
        onSuccess: (saved) => {
            toast.success(purchase ? t('updated') : t('created'))
            onOpenChange(false)
            queryClient.invalidateQueries({ queryKey: [purchasesQueryKey] })
            queryClient.invalidateQueries({ queryKey: [suppliersQueryKey] })
            queryClient.invalidateQueries({ queryKey: [paymentsQueryKey] })
            queryClient.invalidateQueries({ queryKey: [chequesQueryKey] })
            // The munshi paints the mark on every stone, so it is shown big right after saving.
            if (!purchase) onSaved(saved)
        },
        onError: (error) => toast.error(errorMessage(error)),
    })

    const [tons, rate, discount, paidMethod] = useWatch({
        control: form.control,
        name: ['tons', 'ratePerTon', 'discount', 'paidMethod'],
    })
    const paidAccountOptions = (accounts.data ?? [])
        .filter((a) => a.isActive && a.kind === (paidMethod === 'cash' ? 'cash' : 'bank'))
        .map((a) => ({ value: a.id, label: a.name }))

    return (
        <FormSheet
            open={open}
            onOpenChange={onOpenChange}
            title={purchase ? t('editTitle', { mark: purchase.mark ?? purchase.purchiNo }) : t('createTitle')}
            description={t('formDescription')}
            form={form}
            onSubmit={(values) => save.mutate(values)}
            submitLabel={tc('save')}
            cancelLabel={tc('cancel')}
            pending={save.isPending}
        >
            <TotalBar tons={Number(tons) || 0} rate={Number(rate) || 0} discount={Number(discount) || 0} />
            <div className="grid grid-cols-2 gap-3">
                <TextField control={form.control} name="purchiNo" label={t('fields.purchiNo')} placeholder="3360" autoComplete="off" />
                <TextField control={form.control} name="truckNo" label={t('fields.truckNo')} placeholder="LES-947" autoComplete="off" />
                <TextField control={form.control} name="tons" label={t('fields.tons')} inputMode="decimal" autoComplete="off" />
                <TextField control={form.control} name="ratePerTon" label={t('fields.ratePerTon')} inputMode="numeric" autoComplete="off" />
                <TextField control={form.control} name="stones" label={t('fields.stones')} inputMode="numeric" autoComplete="off" />
                <TextField control={form.control} name="discount" label={t('fields.discount')} placeholder="0" inputMode="numeric" autoComplete="off" />
            </div>
            <SelectField
                control={form.control}
                name="supplierId"
                label={t('fields.supplier')}
                placeholder={t('placeholders.supplier')}
                options={(suppliers.data ?? []).filter((s) => s.isActive).map((s) => ({ value: s.id, label: `${s.name} · ${s.business}` }))}
            />
            <SelectField
                control={form.control}
                name="material"
                label={t('fields.material')}
                placeholder={t('placeholders.material')}
                options={materials.map((m) => ({ value: m, label: m }))}
            />
            <SelectField
                control={form.control}
                name="factoryId"
                label={t('fields.factory')}
                placeholder={t('placeholders.factory')}
                options={(factories.data ?? []).map((f) => ({
                    value: f.id,
                    label: f.kind === 'own' ? f.name : `${f.name} (${t('otherFactory')})`,
                }))}
            />
            <DateField control={form.control} name="date" label={t('fields.date')} placeholder={t('placeholders.date')} />
            <TextareaField control={form.control} name="note" label={t('fields.note')} />
            {!purchase && (
                <fieldset className="flex flex-col gap-3 rounded-lg border p-3">
                    <legend className="px-1 text-sm font-medium">{t('paidNow.title')}</legend>
                    <SelectField
                        control={form.control}
                        name="paidMethod"
                        label={t('pay.method')}
                        options={[
                            { value: 'none', label: t('paidNow.none') },
                            ...paymentMethods.map((m) => ({ value: m, label: t(`pay.methods.${m}`) })),
                        ]}
                    />
                    {paidMethod !== 'none' && (
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                <TextField
                                    control={form.control}
                                    name="paidAmount"
                                    label={t('paidNow.amount')}
                                    inputMode="numeric"
                                    autoComplete="off"
                                />
                                <SelectField
                                    control={form.control}
                                    name="paidAccountId"
                                    label={t('pay.account')}
                                    placeholder={t('pay.chooseAccount')}
                                    options={paidAccountOptions}
                                />
                            </div>
                            {paidMethod === 'cheque' && (
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
                            <p className="text-muted-foreground text-xs">{t('paidNow.hint')}</p>
                        </>
                    )}
                </fieldset>
            )}
        </FormSheet>
    )
}
