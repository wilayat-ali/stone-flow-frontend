'use client'

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useTranslations } from 'next-intl'
import { z } from 'zod'
import { ResourcePage, type ResourceApi } from '@/components/shared/resource-page'
import {
    createExpenseCategory,
    deactivateExpenseCategory,
    expenseCategoriesQueryKey,
    listExpenseCategories,
    updateExpenseCategory,
    type ExpenseCategory,
} from '@/features/expense-categories'
import { useResourceLabels } from '@/features/resource-labels'

/** Settings → Rates & Categories: the categories expenses are recorded against. */
export function ExpenseCategoriesPage() {
    const t = useTranslations('settings.expenseCategories')
    const tv = useTranslations('validation')

    // Categories are never deleted, so the generic "Delete" action reads "Deactivate" here.
    const resourceLabels = useResourceLabels(t)
    const labels = useMemo(
        () => ({ ...resourceLabels, delete: t('deactivate') }),
        [resourceLabels, t]
    )

    const schema = useMemo(
        () => z.object({ name: z.string().trim().min(1, tv('required')) }),
        [tv]
    )

    const columns = useMemo<ColumnDef<ExpenseCategory>[]>(
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
            queryKey={expenseCategoriesQueryKey}
            api={{
                list: listExpenseCategories,
                // `ResourcePage` sends the raw form values; these satisfy its own input type.
                create: createExpenseCategory as unknown as ResourceApi<ExpenseCategory>['create'],
                update: updateExpenseCategory as unknown as ResourceApi<ExpenseCategory>['update'],
                remove: deactivateExpenseCategory,
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
