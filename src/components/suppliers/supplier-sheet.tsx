'use client'

import { useEffect, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { DateField, SelectField, TextField } from '@/components/shared/form-fields'
import { FormSheet } from '@/components/shared/form-sheet'
import {
    createSupplier,
    khataQueryKey,
    nameExists,
    supplierTypes,
    suppliersQueryKey,
    updateSupplier,
    type Supplier,
    type SupplierInput,
} from '@/features/suppliers'
import { supplierSchema, type SupplierValues } from '@/features/suppliers-schema'
import { useSupplierErrorMessage } from '@/features/use-supplier-error-message'
import { todayIso } from '@/lib/format'

const emptyValues = (): SupplierValues => ({
    type: 'mine_owner',
    name: '',
    business: '',
    phone: '',
    city: '',
    cuttingRatePerTon: '',
    openingBalance: '0',
    openingDate: todayIso(),
})

/** Add a mine owner, cutting factory or shop, or edit `supplier`. */
export function SupplierSheet({
    open,
    onOpenChange,
    supplier,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** The supplier being edited; omit to add one. */
    supplier?: Supplier
}) {
    const t = useTranslations('suppliers')
    const tc = useTranslations('common')
    const tv = useTranslations('validation')
    const queryClient = useQueryClient()
    const errorMessage = useSupplierErrorMessage()
    const schema = useMemo(() => supplierSchema(tv), [tv])

    const form = useForm<SupplierValues>({ resolver: zodResolver(schema), defaultValues: emptyValues() })

    useEffect(() => {
        if (!open) return
        form.reset(
            supplier
                ? {
                      type: supplier.type,
                      name: supplier.name,
                      business: supplier.business,
                      phone: supplier.phone,
                      city: supplier.city,
                      cuttingRatePerTon: supplier.cuttingRatePerTon != null ? String(supplier.cuttingRatePerTon) : '',
                      openingBalance: String(supplier.openingBalance),
                      openingDate: supplier.openingDate,
                  }
                : emptyValues()
        )
    }, [open, supplier, form])

    const save = useMutation({
        mutationFn: (values: SupplierValues) => {
            const input: SupplierInput = {
                type: values.type,
                name: values.name,
                business: values.business,
                phone: values.phone,
                city: values.city,
                cuttingRatePerTon: values.type === 'cutting_factory' ? Number(values.cuttingRatePerTon) : null,
                openingBalance: Number(values.openingBalance || 0),
                openingDate: values.openingDate,
            }
            return supplier ? updateSupplier(supplier.id, input) : createSupplier(input)
        },
        onSuccess: () => {
            toast.success(supplier ? t('updated') : t('added'))
            onOpenChange(false)
            queryClient.invalidateQueries({ queryKey: [suppliersQueryKey] })
            queryClient.invalidateQueries({ queryKey: [khataQueryKey] })
        },
        onError: (error) => toast.error(errorMessage(error)),
    })

    const type = useWatch({ control: form.control, name: 'type' })
    const name = useWatch({ control: form.control, name: 'name' })

    return (
        <FormSheet
            open={open}
            onOpenChange={onOpenChange}
            title={supplier ? t('editTitle') : t('createTitle')}
            form={form}
            onSubmit={(values) => save.mutate(values)}
            submitLabel={tc('save')}
            cancelLabel={tc('cancel')}
            pending={save.isPending}
            summary={name.trim() && nameExists(name, supplier?.id) ? t('nameWarning') : undefined}
        >
            <SelectField
                control={form.control}
                name="type"
                label={t('fields.type')}
                options={supplierTypes.map((value) => ({ value, label: t(`types.${value}`) }))}
            />
            <TextField control={form.control} name="name" label={t('fields.name')} autoComplete="off" />
            <TextField
                control={form.control}
                name="business"
                label={t('fields.business')}
                placeholder={t('placeholders.business')}
                autoComplete="off"
            />
            <TextField
                control={form.control}
                name="phone"
                label={t('fields.phone')}
                placeholder="03xx-xxxxxxx"
                inputMode="tel"
                dir="ltr"
                autoComplete="off"
            />
            <TextField control={form.control} name="city" label={t('fields.city')} autoComplete="off" />
            {type === 'cutting_factory' && (
                <TextField
                    control={form.control}
                    name="cuttingRatePerTon"
                    label={t('fields.cuttingRate')}
                    inputMode="numeric"
                    autoComplete="off"
                />
            )}
            <TextField
                control={form.control}
                name="openingBalance"
                label={t('fields.openingBalance')}
                placeholder="0"
                inputMode="numeric"
                autoComplete="off"
            />
            <DateField
                control={form.control}
                name="openingDate"
                label={t('fields.openingDate')}
                placeholder={t('placeholders.date')}
            />
        </FormSheet>
    )
}
