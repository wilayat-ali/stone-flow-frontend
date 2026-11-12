'use client'

import { useEffect, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { z } from 'zod'
import { DateField, SelectField, TextField } from '@/components/shared/form-fields'
import { FormSheet } from '@/components/shared/form-sheet'
import { customersQueryKey, listCustomers } from '@/features/customers'
import { cuttingJobsQueryKey, DEFAULT_RATE_PER_SQFT, lastRateFor, receiveJob } from '@/features/cutting-jobs'
import { factoriesQueryKey, listFactories } from '@/features/factories'
import { productionQueryKey } from '@/features/production'
import { useProductionErrorMessage } from '@/features/use-production-error-message'
import { todayIso } from '@/lib/format'

const NEW = 'new'
const PHONE = /^03\d{2}-?\d{7}$/

type Message = (key: 'required' | 'amount' | 'phone') => string

const schema = (message: Message) =>
    z
        .object({
            customerId: z.string().min(1, message('required')),
            name: z.string().trim(),
            phone: z.string().trim(),
            truckNo: z.string().trim().min(1, message('required')),
            material: z.string().trim().min(1, message('required')),
            tons: z.string().trim().refine((v) => Number(v) > 0, message('amount')),
            factoryId: z.string().min(1, message('required')),
            ratePerSqft: z.string().trim().refine((v) => Number(v) > 0, message('amount')),
            date: z.string().min(1, message('required')),
        })
        .superRefine((v, ctx) => {
            if (v.customerId !== NEW) return
            if (!v.name) ctx.addIssue({ code: 'custom', path: ['name'], message: message('required') })
            if (!PHONE.test(v.phone)) ctx.addIssue({ code: 'custom', path: ['phone'], message: message('phone') })
        })

type Values = z.infer<ReturnType<typeof schema>>

const empty = (customerId: string): Values => ({
    customerId,
    name: '',
    phone: '',
    truckNo: '',
    material: '',
    tons: '',
    factoryId: '',
    ratePerSqft: String(customerId && customerId !== NEW ? lastRateFor(customerId) : DEFAULT_RATE_PER_SQFT),
    date: todayIso(),
})

/**
 * Receive a customer's own truck for cutting. The rate per sq.ft is filled from that customer's last
 * truck, else the default; the truck then waits in the Cutting table. It never joins our stock.
 */
export function ReceiveJobSheet({
    open,
    onOpenChange,
    customerId,
    userName,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Start from this customer (the "Receive Truck" button on a customer's panel). */
    customerId?: string
    userName: string
}) {
    const t = useTranslations('production.customers')
    const tc = useTranslations('common')
    const tv = useTranslations('validation')
    const queryClient = useQueryClient()
    const errorMessage = useProductionErrorMessage()
    const formSchema = useMemo(() => schema(tv), [tv])

    const customers = useQuery({ queryKey: [customersQueryKey], queryFn: listCustomers, enabled: open })
    const factories = useQuery({ queryKey: [factoriesQueryKey], queryFn: listFactories, enabled: open })
    const ownFactories = (factories.data ?? []).filter((f) => f.kind === 'own')

    const form = useForm<Values>({ resolver: zodResolver(formSchema), defaultValues: empty(customerId ?? NEW) })

    useEffect(() => {
        if (open) form.reset({ ...empty(customerId ?? NEW), factoryId: ownFactories[0]?.id ?? '' })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, customerId, factories.data])

    const chosen = useWatch({ control: form.control, name: 'customerId' })
    // A customer's usual rate is the one on their last truck.
    useEffect(() => {
        if (open) form.setValue('ratePerSqft', String(chosen && chosen !== NEW ? lastRateFor(chosen) : DEFAULT_RATE_PER_SQFT))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chosen, open])

    const save = useMutation({
        mutationFn: (v: Values) =>
            receiveJob(
                {
                    customerId: v.customerId,
                    name: v.name,
                    phone: v.phone,
                    date: v.date,
                    truckNo: v.truckNo,
                    material: v.material,
                    tons: Number(v.tons),
                    factoryId: v.factoryId,
                    factoryName: ownFactories.find((f) => f.id === v.factoryId)?.name ?? '',
                    ratePerSqft: Number(v.ratePerSqft),
                },
                userName
            ),
        onSuccess: (job) => {
            toast.success(t('received', { customer: job.customerName, truck: job.truckNo }))
            onOpenChange(false)
            for (const key of [productionQueryKey, cuttingJobsQueryKey, customersQueryKey]) {
                queryClient.invalidateQueries({ queryKey: [key] })
            }
        },
        onError: (error) => toast.error(errorMessage(error)),
    })

    return (
        <FormSheet
            open={open}
            onOpenChange={onOpenChange}
            title={t('receiveTitle')}
            description={t('receiveDescription')}
            form={form}
            onSubmit={(values) => save.mutate(values)}
            submitLabel={t('receiveSubmit')}
            cancelLabel={tc('cancel')}
            pending={save.isPending}
        >
            <SelectField
                control={form.control}
                name="customerId"
                label={t('customer')}
                options={[
                    ...(customers.data ?? []).map((c) => ({ value: c.id, label: `${c.name} · ${c.phone}` })),
                    { value: NEW, label: t('newCustomer') },
                ]}
            />
            {chosen === NEW && (
                <div className="grid grid-cols-2 gap-3">
                    <TextField control={form.control} name="name" label={t('name')} autoComplete="off" />
                    <TextField control={form.control} name="phone" label={t('phone')} placeholder="03xx-xxxxxxx" dir="ltr" autoComplete="off" />
                </div>
            )}
            <div className="grid grid-cols-2 gap-3">
                <TextField control={form.control} name="truckNo" label={t('truckNo')} autoComplete="off" />
                <TextField control={form.control} name="tons" label={t('tons')} inputMode="decimal" autoComplete="off" />
            </div>
            <TextField control={form.control} name="material" label={t('material')} placeholder={t('materialPlaceholder')} autoComplete="off" />
            <SelectField
                control={form.control}
                name="factoryId"
                label={t('factory')}
                options={ownFactories.map((f) => ({ value: f.id, label: f.name }))}
            />
            <div className="grid grid-cols-2 gap-3">
                <TextField control={form.control} name="ratePerSqft" label={t('ratePerSqft')} inputMode="decimal" autoComplete="off" />
                <DateField control={form.control} name="date" label={t('date')} placeholder={t('date')} />
            </div>
        </FormSheet>
    )
}
