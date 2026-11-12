'use client'

import { useEffect, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { DateField, SelectField, TextField } from '@/components/shared/form-fields'
import { FormSheet } from '@/components/shared/form-sheet'
import { TileField } from '@/components/shared/tile-field'
import { factoriesQueryKey, listFactories } from '@/features/factories'
import { useExpenseErrorMessage } from '@/features/use-expense-error-message'
import { workerKhataQueryKey } from '@/features/worker-khata'
import { listWorkerRates, workerRatesQueryKey } from '@/features/worker-rates'
import { createWorker, payTypes, updateWorker, workersQueryKey, type Worker } from '@/features/workers'
import { workerSchema, type WorkerValues } from '@/features/workers-schema'
import { todayIso } from '@/lib/format'

const emptyValues = (worker?: Worker): WorkerValues => ({
    name: worker?.name ?? '',
    phone: worker?.phone ?? '',
    jobTitle: worker?.jobTitle ?? '',
    factoryId: worker?.factoryId ?? '',
    payType: worker?.payType ?? 'day',
    rate: worker?.rate ? String(worker.rate) : '',
    defaultJob: worker?.defaultJob ?? '',
    openingBalance: worker && worker.openingBalance !== 0 ? String(worker.openingBalance) : '',
    joinedOn: worker?.joinedOn ?? todayIso(),
})

/** Add or edit a worker: pay type and rate decide how he earns. Workers are never deleted, only made inactive. */
export function WorkerSheet({ open, onOpenChange, worker }: { open: boolean; onOpenChange: (open: boolean) => void; worker?: Worker }) {
    const t = useTranslations('expenses.workers.sheet')
    const tc = useTranslations('common')
    const tv = useTranslations('validation')
    const queryClient = useQueryClient()
    const errorMessage = useExpenseErrorMessage()
    const schema = useMemo(() => workerSchema(tv), [tv])
    const form = useForm<WorkerValues>({ resolver: zodResolver(schema), defaultValues: emptyValues(worker) })

    const factories = useQuery({ queryKey: [factoriesQueryKey], queryFn: listFactories, enabled: open })
    const rates = useQuery({ queryKey: [workerRatesQueryKey], queryFn: listWorkerRates, enabled: open })

    useEffect(() => {
        if (open) form.reset(emptyValues(worker))
    }, [open, worker, form])

    const payType = useWatch({ control: form.control, name: 'payType' })

    // The first factory of our own is the usual one.
    useEffect(() => {
        const first = factories.data?.find((f) => f.isActive && f.kind === 'own')
        if (open && first && !form.getValues('factoryId')) form.setValue('factoryId', first.id)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, factories.data])

    const save = useMutation({
        mutationFn: (values: WorkerValues) => {
            const input = {
                name: values.name,
                phone: values.phone,
                jobTitle: values.jobTitle,
                factoryId: values.factoryId,
                payType: values.payType,
                rate: Number(values.rate) || 0,
                defaultJob: values.defaultJob,
                openingBalance: Number(values.openingBalance) || 0,
                joinedOn: values.joinedOn,
            }
            return worker ? updateWorker(worker.id, input) : createWorker(input)
        },
        onSuccess: () => {
            toast.success(worker ? t('updated') : t('created'))
            onOpenChange(false)
            for (const key of [workersQueryKey, workerKhataQueryKey]) queryClient.invalidateQueries({ queryKey: [key] })
        },
        onError: (error) => toast.error(errorMessage(error)),
    })

    return (
        <FormSheet
            open={open}
            onOpenChange={onOpenChange}
            title={worker ? t('editTitle') : t('title')}
            description={t('description')}
            form={form}
            onSubmit={(values) => save.mutate(values)}
            submitLabel={worker ? t('saveEdit') : t('save')}
            cancelLabel={tc('cancel')}
            pending={save.isPending}
        >
            <TextField control={form.control} name="name" label={t('name')} placeholder={t('namePlaceholder')} autoComplete="off" />
            <div className="grid grid-cols-2 gap-3">
                <TextField control={form.control} name="phone" label={t('phone')} placeholder="0300-1234567" autoComplete="off" dir="ltr" />
                <TextField control={form.control} name="jobTitle" label={t('jobTitle')} placeholder={t('jobTitlePlaceholder')} autoComplete="off" />
            </div>
            <SelectField
                control={form.control}
                name="factoryId"
                label={t('factory')}
                placeholder={t('chooseFactory')}
                options={(factories.data ?? []).filter((f) => f.isActive && f.kind === 'own').map((f) => ({ value: f.id, label: f.name }))}
            />
            <TileField control={form.control} name="payType" label={t('payType')} columns={2} options={payTypes.map((p) => ({ value: p, label: t(`payTypes.${p}`) }))} />
            <TextField
                control={form.control}
                name="rate"
                label={t(`rate.${payType}`)}
                placeholder={payType === 'sqft' ? t('rateCardPlaceholder') : t('ratePlaceholder')}
                inputMode="numeric"
                autoComplete="off"
            />
            {payType === 'sqft' && (
                <SelectField
                    control={form.control}
                    name="defaultJob"
                    label={t('defaultJob')}
                    placeholder={t('chooseJob')}
                    options={(rates.data ?? []).filter((r) => r.payType === 'perSqft').map((r) => ({ value: r.name, label: `${r.name} · ${r.rate}` }))}
                />
            )}
            <div className="grid grid-cols-2 gap-3">
                <TextField control={form.control} name="openingBalance" label={t('opening')} placeholder="0" inputMode="numeric" autoComplete="off" />
                <DateField control={form.control} name="joinedOn" label={t('joinedOn')} placeholder={t('datePlaceholder')} />
            </div>
            <p className="text-muted-foreground text-sm">{t('openingNote')}</p>
        </FormSheet>
    )
}
