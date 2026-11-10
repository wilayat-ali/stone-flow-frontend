'use client'

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useTranslations } from 'next-intl'
import { z } from 'zod'
import { ResourcePage, type ResourceApi } from '@/components/shared/resource-page'
import {
    createCounterWidth,
    deactivateCounterWidth,
    counterWidthsQueryKey,
    listCounterWidths,
    updateCounterWidth,
    type CounterWidth,
} from '@/features/counter-widths'
import { useResourceLabels } from '@/features/resource-labels'

/** Settings → Sizes & Soot: the counter widths available when recording stock. */
export function CounterWidthsPage() {
    const t = useTranslations('settings.counterWidths')
    const tv = useTranslations('validation')

    // Widths are never deleted, so the generic "Delete" action reads "Deactivate" here.
    const resourceLabels = useResourceLabels(t)
    const labels = useMemo(
        () => ({ ...resourceLabels, delete: t('deactivate') }),
        [resourceLabels, t]
    )

    const schema = useMemo(
        () => z.object({ name: z.string().trim().min(1, tv('required')) }),
        [tv]
    )

    const columns = useMemo<ColumnDef<CounterWidth>[]>(
        () => [
            {
                accessorKey: 'name',
                header: t('fieldName'),
                cell: ({ row }) => (
                    <span className="font-medium">{row.original.name}</span>
                ),
            },
        ],
        [t]
    )

    return (
        <ResourcePage
            queryKey={counterWidthsQueryKey}
            api={{
                list: listCounterWidths,
                // `ResourcePage` sends the raw form values; these satisfy its own input type.
                create: createCounterWidth as unknown as ResourceApi<CounterWidth>['create'],
                update: updateCounterWidth as unknown as ResourceApi<CounterWidth>['update'],
                remove: deactivateCounterWidth,
            }}
            columns={columns}
            fields={[
                {
                    name: 'name',
                    label: t('fieldName'),
                    placeholder: t('fieldNamePlaceholder'),
                },
            ]}
            schema={schema}
            defaultValues={{ name: '' }}
            toFormValues={(row) => ({ name: row.name })}
            getRowName={(row) => row.name}
            labels={labels}
            fill={false}
        />
    )
}
