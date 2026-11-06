'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import type { DataTableLabels } from '@/components/shared/data-table'
import type { ResourceLabels } from '@/components/shared/resource-page'

// Scoped translator for a namespace that follows the shared resource shape.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ScopedT = (key: any, values?: any) => string

/**
 * Builds every label `ResourcePage` needs from a namespace shaped like
 * `{ title, description, create, createTitle, editTitle, deleteTitle,
 *    deleteDescription, created, updated, deleted }` plus shared common/table keys.
 */
export function useResourceLabels(t: ScopedT): ResourceLabels {
    const tc = useTranslations('common')
    const tt = useTranslations('table')

    return useMemo(
        () => ({
            title: t('title'),
            description: t('description'),
            create: t('create'),
            createTitle: t('createTitle'),
            editTitle: t('editTitle'),
            deleteTitle: t('deleteTitle'),
            deleteDescription: (name: string) => t('deleteDescription', { name }),
            created: t('created'),
            updated: t('updated'),
            deleted: t('deleted'),
            edit: tc('edit'),
            delete: tc('delete'),
            save: tc('save'),
            cancel: tc('cancel'),
            actions: tc('actions'),
            openMenu: tc('openMenu'),
            search: tc('search'),
            noData: tt('noData'),
            noDataDescription: tt('noDataDescription'),
            rowsPerPage: tt('rowsPerPage'),
            first: tt('first'),
            previous: tt('previous'),
            next: tt('next'),
            last: tt('last'),
            page: (page: number, total: number) => tt('page', { page, total }),
            rows: (count: number) => tt('rowsCount', { count }),
        }),
        [t, tc, tt]
    )
}

/** Just the table labels (search, empty state, pagination) for screens that are not full CRUD pages. */
export function useTableLabels(): DataTableLabels {
    const tc = useTranslations('common')
    const tt = useTranslations('table')

    return useMemo(
        () => ({
            search: tc('search'),
            noData: tt('noData'),
            noDataDescription: tt('noDataDescription'),
            rowsPerPage: tt('rowsPerPage'),
            first: tt('first'),
            previous: tt('previous'),
            next: tt('next'),
            last: tt('last'),
            page: (page: number, total: number) => tt('page', { page, total }),
            rows: (count: number) => tt('rowsCount', { count }),
        }),
        [tc, tt]
    )
}
