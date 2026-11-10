'use client'

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useTranslations } from 'next-intl'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { ResourcePage, type ResourceApi } from '@/components/shared/resource-page'
import { useResourceLabels } from '@/features/resource-labels'
import {
    createWorkerRate,
    deactivateWorkerRate,
    listWorkerRates,
    updateWorkerRate,
    workerRatesQueryKey,
    type PayType,
    type WorkerRate,
} from '@/features/worker-rates'
import { formatLakh } from '@/lib/format'

const payTypes: PayType[] = ['perTon', 'perSqft', 'daily', 'monthly']

/** Settings → Rates & Categories: what each job is paid, per the 4 pay types. */
export function WorkerRatesPage() {
    const t = useTranslations('settings.workerRates')
    const tv = useTranslations('validation')

    // Worker rates are never deleted, so the generic "Delete" action reads "Deactivate" here.
    const resourceLabels = useResourceLabels(t)
    const labels = useMemo(
        () => ({ ...resourceLabels, delete: t('deactivate') }),
        [resourceLabels, t]
    )

    const schema = useMemo(
        () =>
            z.object({
                name: z.string().trim().min(1, tv('required')),
                payType: z.enum(['perTon', 'perSqft', 'daily', 'monthly']),
                rate: z
                    .string()
                    .trim()
                    .min(1, tv('required'))
                    .refine((v) => Number(v) > 0, tv('amount')),
            }),
        [tv]
    )

    const columns = useMemo<ColumnDef<WorkerRate>[]>(
        () => [
            {
                accessorKey: 'name',
                header: t('fieldName'),
                cell: ({ row }) => (
                    <span className="font-medium">{row.original.name}</span>
                ),
            },
            {
                accessorKey: 'payType',
                header: t('fieldPayType'),
                cell: ({ row }) => (
                    <Badge variant="outline">
                        {t(`payType.${row.original.payType}`)}
                    </Badge>
                ),
            },
            {
                accessorKey: 'rate',
                header: t('fieldRate'),
                meta: { className: 'text-end' },
                cell: ({ row }) => (
                    <bdi className="tabular-nums">
                        {formatLakh(row.original.rate)}{' '}
                        {t(`unit.${row.original.payType}`)}
                    </bdi>
                ),
            },
        ],
        [t]
    )

    return (
        <ResourcePage
            queryKey={workerRatesQueryKey}
            api={{
                list: listWorkerRates,
                // `ResourcePage` sends the raw form values (`rate` as a string); these two parse them.
                create: createWorkerRate as unknown as ResourceApi<WorkerRate>['create'],
                update: updateWorkerRate as unknown as ResourceApi<WorkerRate>['update'],
                remove: deactivateWorkerRate,
            }}
            columns={columns}
            fields={[
                {
                    name: 'name',
                    label: t('fieldName'),
                    placeholder: t('fieldNamePlaceholder'),
                },
                {
                    name: 'payType',
                    label: t('fieldPayType'),
                    type: 'select',
                    options: payTypes.map((payType) => ({
                        value: payType,
                        label: t(`payType.${payType}`),
                    })),
                },
                {
                    name: 'rate',
                    label: t('fieldRate'),
                    placeholder: t('fieldRatePlaceholder'),
                },
            ]}
            schema={schema}
            defaultValues={{ name: '', payType: 'perTon', rate: '' }}
            toFormValues={(row) => ({
                name: row.name,
                payType: row.payType,
                rate: String(row.rate),
            })}
            getRowName={(row) => row.name}
            labels={labels}
            fill={false}
        />
    )
}
