'use client'

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useTranslations } from 'next-intl'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { ResourcePage, type ResourceApi } from '@/components/shared/resource-page'
import {
    createFactory,
    deactivateFactory,
    factoriesQueryKey,
    listFactories,
    updateFactory,
    type Factory,
    type FactoryKind,
} from '@/features/factories'
import { useResourceLabels } from '@/features/resource-labels'
import { formatLakh } from '@/lib/format'

const kinds: FactoryKind[] = ['own', 'cutting']

/** Settings → Factories & Truck Numbers: own factories, and the other factories cutting is sent to. */
export function FactoriesPage() {
    const t = useTranslations('settings.factories')
    const tv = useTranslations('validation')

    // Factories are never deleted, so the generic "Delete" action reads "Deactivate" here.
    const resourceLabels = useResourceLabels(t)
    const labels = useMemo(
        () => ({ ...resourceLabels, delete: t('deactivate') }),
        [resourceLabels, t]
    )

    const schema = useMemo(
        () =>
            z.object({
                name: z.string().trim().min(1, tv('required')),
                kind: z.enum(['own', 'cutting']),
                ratePerTon: z.string().trim(),
            }),
        [tv]
    )

    const columns = useMemo<ColumnDef<Factory>[]>(
        () => [
            {
                accessorKey: 'name',
                header: t('fieldName'),
                cell: ({ row }) => (
                    <span className="font-medium">{row.original.name}</span>
                ),
            },
            {
                accessorKey: 'kind',
                header: t('fieldKind'),
                cell: ({ row }) => (
                    <Badge variant="outline">
                        {row.original.kind === 'own'
                            ? t('kindOwn')
                            : t('kindCutting')}
                    </Badge>
                ),
            },
            {
                accessorKey: 'ratePerTon',
                header: t('fieldRatePerTon'),
                meta: { className: 'text-end' },
                cell: ({ row }) =>
                    row.original.ratePerTon ? (
                        <bdi className="tabular-nums">
                            {formatLakh(row.original.ratePerTon)}
                        </bdi>
                    ) : (
                        <span className="text-muted-foreground">–</span>
                    ),
            },
        ],
        [t]
    )

    return (
        <ResourcePage
            queryKey={factoriesQueryKey}
            api={{
                list: listFactories,
                // `ResourcePage` sends the raw form values (`ratePerTon` as a string); these two parse them.
                create: createFactory as unknown as ResourceApi<Factory>['create'],
                update: updateFactory as unknown as ResourceApi<Factory>['update'],
                remove: deactivateFactory,
            }}
            columns={columns}
            fields={[
                {
                    name: 'name',
                    label: t('fieldName'),
                    placeholder: t('fieldNamePlaceholder'),
                },
                {
                    name: 'kind',
                    label: t('fieldKind'),
                    type: 'select',
                    options: kinds.map((kind) => ({
                        value: kind,
                        label: kind === 'own' ? t('kindOwn') : t('kindCutting'),
                    })),
                },
                {
                    name: 'ratePerTon',
                    label: t('fieldRatePerTon'),
                    placeholder: t('fieldRatePerTonPlaceholder'),
                },
            ]}
            schema={schema}
            defaultValues={{ name: '', kind: 'own', ratePerTon: '' }}
            toFormValues={(row) => ({
                name: row.name,
                kind: row.kind,
                ratePerTon: row.ratePerTon != null ? String(row.ratePerTon) : '',
            })}
            getRowName={(row) => row.name}
            labels={labels}
        />
    )
}
