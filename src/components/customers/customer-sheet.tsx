'use client'

import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { DateField, SelectField, TextField } from '@/components/shared/form-fields'
import { FormSheet } from '@/components/shared/form-sheet'
import {
    createCustomer,
    customerKhataQueryKey,
    customersQueryKey,
    customerTypes,
    updateCustomer,
    type CustomerSummary,
} from '@/features/customers'
import { customerSchema, type CustomerValues } from '@/features/customers-schema'
import { useCustomerErrorMessage } from '@/features/use-customer-error-message'
import { todayIso } from '@/lib/format'

const emptyValues = (): CustomerValues => ({
    name: '',
    phone: '',
    type: 'builder',
    city: '',
    contactPerson: '',
    openingBalance: '0',
    openingDate: todayIso(),
})

/**
 * Add a customer, or edit `customer`. The opening balance (udhaar from before StoneFlow) is the owner's
 * and partner's to set or change; everyone else who adds a customer starts them at zero.
 */
export function CustomerSheet({
    open,
    onOpenChange,
    customer,
    canEditOpening,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** The customer being edited; omit to add one. */
    customer?: CustomerSummary
    canEditOpening: boolean
}) {
    const t = useTranslations('customers')
    const tc = useTranslations('common')
    const tv = useTranslations('validation')
    const queryClient = useQueryClient()
    const errorMessage = useCustomerErrorMessage()
    const schema = useMemo(() => customerSchema(tv), [tv])

    const form = useForm<CustomerValues>({ resolver: zodResolver(schema), defaultValues: emptyValues() })

    useEffect(() => {
        if (!open) return
        form.reset(
            customer
                ? {
                      name: customer.name,
                      phone: customer.phone,
                      type: customer.type,
                      city: customer.city,
                      contactPerson: customer.contactPerson,
                      openingBalance: String(customer.openingBalance),
                      openingDate: customer.openingDate,
                  }
                : emptyValues()
        )
    }, [open, customer, form])

    const save = useMutation({
        mutationFn: (v: CustomerValues) => {
            const input = {
                name: v.name,
                phone: v.phone,
                type: v.type,
                city: v.city,
                contactPerson: v.contactPerson,
                // Without permission the opening balance is never sent, so it can neither be set nor changed.
                ...(canEditOpening && { openingBalance: Number(v.openingBalance || 0), openingDate: v.openingDate }),
            }
            return customer ? updateCustomer(customer.id, input) : createCustomer(input)
        },
        onSuccess: () => {
            toast.success(customer ? t('updated') : t('added'))
            onOpenChange(false)
            for (const key of [customersQueryKey, customerKhataQueryKey]) queryClient.invalidateQueries({ queryKey: [key] })
        },
        onError: (error) => toast.error(errorMessage(error)),
    })

    return (
        <FormSheet
            open={open}
            onOpenChange={onOpenChange}
            title={customer ? t('editTitle') : t('createTitle')}
            form={form}
            onSubmit={(values) => save.mutate(values)}
            submitLabel={tc('save')}
            cancelLabel={tc('cancel')}
            pending={save.isPending}
        >
            <TextField control={form.control} name="name" label={t('fields.name')} autoComplete="off" />
            <TextField control={form.control} name="phone" label={t('fields.phone')} placeholder="03xx-xxxxxxx" inputMode="tel" dir="ltr" autoComplete="off" />
            <SelectField
                control={form.control}
                name="type"
                label={t('fields.type')}
                options={customerTypes.map((value) => ({ value, label: t(`types.${value}`) }))}
            />
            <div className="grid grid-cols-2 gap-3">
                <TextField control={form.control} name="city" label={t('fields.city')} autoComplete="off" />
                <TextField control={form.control} name="contactPerson" label={t('fields.contactPerson')} autoComplete="off" />
            </div>
            {canEditOpening && (
                <div className="grid grid-cols-2 gap-3">
                    <TextField
                        control={form.control}
                        name="openingBalance"
                        label={t('fields.openingBalance')}
                        placeholder="0"
                        inputMode="numeric"
                        autoComplete="off"
                    />
                    <DateField control={form.control} name="openingDate" label={t('fields.openingDate')} placeholder={t('fields.openingDate')} />
                </div>
            )}
        </FormSheet>
    )
}
