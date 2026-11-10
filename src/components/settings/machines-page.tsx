'use client'

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { ResourcePage, type ResourceApi } from '@/components/shared/resource-page'
import { factoriesQueryKey, listFactories } from '@/features/factories'
import { useResourceLabels } from '@/features/resource-labels'
import {
    createMachine,
    deactivateMachine,
    listMachines,
    machinesQueryKey,
    updateMachine,
    type Machine,
    type MachineType,
} from '@/features/machines'

const types: MachineType[] = ['vertical', 'gangSaw', 'monolama', 'blockCutter']

/** Settings → Machines: own-factory machines, each with a day thekadar and an optional night one. */
export function MachinesPage() {
    const t = useTranslations('settings.machines')
    const tv = useTranslations('validation')
    const factories = useQuery({ queryKey: [factoriesQueryKey], queryFn: listFactories })
    const ownFactories = useMemo(
        () => (factories.data ?? []).filter((f) => f.kind === 'own'),
        [factories.data]
    )
    const factoryName = useMemo(
        () => new Map(ownFactories.map((f) => [f.id, f.name])),
        [ownFactories]
    )

    // Machines are never deleted, so the generic "Delete" action reads "Deactivate" here.
    const resourceLabels = useResourceLabels(t)
    const labels = useMemo(
        () => ({ ...resourceLabels, delete: t('deactivate') }),
        [resourceLabels, t]
    )

    const schema = useMemo(
        () =>
            z.object({
                name: z.string().trim().min(1, tv('required')),
                type: z.enum(['vertical', 'gangSaw', 'monolama', 'blockCutter']),
                factoryId: z.string().min(1, tv('required')),
                dayThekadar: z.string().trim().min(1, tv('required')),
                nightThekadar: z.string().trim(),
            }),
        [tv]
    )

    const columns = useMemo<ColumnDef<Machine>[]>(
        () => [
            {
                accessorKey: 'name',
                header: t('fieldName'),
                cell: ({ row }) => (
                    <span className="font-medium">{row.original.name}</span>
                ),
            },
            {
                accessorKey: 'type',
                header: t('fieldType'),
                cell: ({ row }) => (
                    <Badge variant="outline">{t(`type.${row.original.type}`)}</Badge>
                ),
            },
            {
                accessorKey: 'factoryId',
                header: t('fieldFactory'),
                cell: ({ row }) =>
                    factoryName.get(row.original.factoryId) ?? (
                        <span className="text-muted-foreground">–</span>
                    ),
            },
            {
                accessorKey: 'dayThekadar',
                header: t('fieldDayThekadar'),
            },
            {
                accessorKey: 'nightThekadar',
                header: t('fieldNightThekadar'),
                cell: ({ row }) =>
                    row.original.nightThekadar ?? (
                        <span className="text-muted-foreground">–</span>
                    ),
            },
        ],
        [t, factoryName]
    )

    return (
        <ResourcePage
            queryKey={machinesQueryKey}
            api={{
                list: listMachines,
                // `ResourcePage` sends the raw form values (`nightThekadar` as a plain string); these parse them.
                create: createMachine as unknown as ResourceApi<Machine>['create'],
                update: updateMachine as unknown as ResourceApi<Machine>['update'],
                remove: deactivateMachine,
            }}
            columns={columns}
            fields={[
                {
                    name: 'name',
                    label: t('fieldName'),
                    placeholder: t('fieldNamePlaceholder'),
                },
                {
                    name: 'type',
                    label: t('fieldType'),
                    type: 'select',
                    options: types.map((type) => ({
                        value: type,
                        label: t(`type.${type}`),
                    })),
                },
                {
                    name: 'factoryId',
                    label: t('fieldFactory'),
                    type: 'select',
                    options: ownFactories.map((f) => ({ value: f.id, label: f.name })),
                },
                {
                    name: 'dayThekadar',
                    label: t('fieldDayThekadar'),
                    placeholder: t('fieldDayThekadarPlaceholder'),
                },
                {
                    name: 'nightThekadar',
                    label: t('fieldNightThekadar'),
                    placeholder: t('fieldNightThekadarPlaceholder'),
                },
            ]}
            schema={schema}
            defaultValues={{
                name: '',
                type: 'vertical',
                factoryId: '',
                dayThekadar: '',
                nightThekadar: '',
            }}
            toFormValues={(row) => ({
                name: row.name,
                type: row.type,
                factoryId: row.factoryId,
                dayThekadar: row.dayThekadar,
                nightThekadar: row.nightThekadar ?? '',
            })}
            getRowName={(row) => row.name}
            labels={labels}
        />
    )
}
