'use client'

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useTranslations } from 'next-intl'
import { z } from 'zod'
import { ResourcePage, type ResourceApi } from '@/components/shared/resource-page'
import {
    createSootSize,
    deactivateSootSize,
    listSootSizes,
    sootSizesQueryKey,
    updateSootSize,
    type SootSize,
} from '@/features/soot-sizes'
import { useResourceLabels } from '@/features/resource-labels'

/** Settings → Sizes & Soot: the soot sizes vertical-cutting output is recorded against. */
export function SootSizesPage() {
    const t = useTranslations('settings.sootSizes')
    const tv = useTranslations('validation')

    // Sizes are never deleted, so the generic "Delete" action reads "Deactivate" here.
    const resourceLabels = useResourceLabels(t)
    const labels = useMemo(
        () => ({ ...resourceLabels, delete: t('deactivate') }),
        [resourceLabels, t]
    )

    const schema = useMemo(
        () => z.object({ name: z.string().trim().min(1, tv('required')) }),
        [tv]
    )

    const columns = useMemo<ColumnDef<SootSize>[]>(
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
            queryKey={sootSizesQueryKey}
            api={{
                list: listSootSizes,
                // `ResourcePage` sends the raw form values; these satisfy its own input type.
                create: createSootSize as unknown as ResourceApi<SootSize>['create'],
                update: updateSootSize as unknown as ResourceApi<SootSize>['update'],
                remove: deactivateSootSize,
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
