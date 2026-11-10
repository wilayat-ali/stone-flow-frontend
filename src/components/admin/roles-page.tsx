'use client'

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useQuery } from '@tanstack/react-query'
import { Info, Lock } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/data-table'
import { PageHeader } from '@/components/shared/page-header'
import { listMembers, membersKey } from '@/features/admin/members'
import { canManageMembers, roleKeys, type RoleKey } from '@/features/admin/roles'
import { useTableLabels } from '@/features/resource-labels'
import { ApprovalSettingCard } from './approval-setting-card'

type Row = { key: RoleKey; members: number }

/** The five system roles every company gets. Read-only until the permission matrix exists. */
export function RolesPage({ roleKey }: { roleKey?: string }) {
    const t = useTranslations('admin.roles')
    const tu = useTranslations('admin.users')
    const format = useFormatter()
    const labels = useTableLabels()
    const members = useQuery({ queryKey: membersKey, queryFn: listMembers })

    const rows = useMemo<Row[]>(
        () =>
            roleKeys.map((key) => ({
                key,
                members: (members.data ?? []).filter(
                    (m) => m.roleKey === key && m.status !== 'inactive'
                ).length,
            })),
        [members.data]
    )

    const columns = useMemo<ColumnDef<Row>[]>(
        () => [
            {
                accessorKey: 'key',
                header: t('role'),
                cell: ({ row }) => (
                    <div className="flex items-center gap-2">
                        <span className="font-medium">{tu(`roles.${row.original.key}`)}</span>
                        <Badge variant="outline" className="gap-1">
                            <Lock className="size-3" />
                            {t('system')}
                        </Badge>
                    </div>
                ),
            },
            {
                id: 'description',
                header: t('descriptionField'),
                enableSorting: false,
                cell: ({ row }) => (
                    <span className="text-muted-foreground">{t(`descriptions.${row.original.key}`)}</span>
                ),
            },
            {
                accessorKey: 'members',
                header: t('usersCount'),
                cell: ({ row }) => format.number(row.original.members),
            },
        ],
        [t, tu, format]
    )

    return (
        <div className="flex flex-col gap-4">
            <PageHeader title={t('title')} description={t('description')} />
            <ApprovalSettingCard canManage={canManageMembers(roleKey)} />
            <Alert>
                <Info />
                <AlertTitle>{t('soonTitle')}</AlertTitle>
                <AlertDescription>{t('soonDescription')}</AlertDescription>
            </Alert>
            <DataTable columns={columns} data={rows} labels={labels} loading={members.isLoading} />
        </div>
    )
}
