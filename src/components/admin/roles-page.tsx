'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { DataTable } from '@/components/shared/data-table'
import { PageHeader } from '@/components/shared/page-header'
import { InitialsStack } from '@/components/shared/initials-stack'
import { listMembers, memberName, membersKey } from '@/features/admin/members'
import { deleteRole, myAccessKey, OWNER_ROLE, rolesQueryKey, type Role } from '@/features/admin/role-store'
import { canConfigureApprovals, canManageRoles } from '@/features/admin/roles'
import { useRoleDescription, useRoleLabel, useRoles } from '@/features/admin/use-roles'
import { useTableLabels } from '@/features/resource-labels'
import { errorCode } from '@/lib/client-api'
import { ApprovalSettingCard } from './approval-setting-card'
import { RoleSheet } from './role-sheet'

type Row = { role: Role; members: number; people: { id: string; label: string }[] }

/** Every company role: create, edit, delete (when nobody has it) and look at its permissions. */
export function RolesPage({ roleKey }: { roleKey?: string }) {
    const t = useTranslations('admin.roles')
    const tc = useTranslations('common')
    const labels = useTableLabels()
    const queryClient = useQueryClient()
    const roleLabel = useRoleLabel()
    const roleDescription = useRoleDescription()
    const canManage = canManageRoles(roleKey)

    const roles = useRoles()
    const members = useQuery({ queryKey: membersKey, queryFn: listMembers })

    const [sheet, setSheet] = useState<{ role: Role | null } | null>(null)
    const [removing, setRemoving] = useState<Row | null>(null)

    const remove = useMutation({
        mutationFn: ({ role }: Row) => deleteRole(role.key),
        onSuccess: () => {
            toast.success(t('deleted'))
            setRemoving(null)
            queryClient.invalidateQueries({ queryKey: rolesQueryKey })
            queryClient.invalidateQueries({ queryKey: myAccessKey })
        },
        onError: (error) => {
            const code = errorCode(error)
            const key = `errors.${code}`
            toast.error(code && t.has(key as never) ? t(key as never) : t('errors.generic'))
            setRemoving(null)
        },
    })

    const rows = useMemo<Row[]>(
        () =>
            (roles.data ?? []).map((role) => {
                const people = (members.data ?? [])
                    .filter((m) => m.roleKey === role.key && m.status !== 'inactive')
                    .map((m) => ({ id: m.memberId, label: memberName(m) || m.email || m.phone || '' }))
                return { role, members: role.memberCount, people }
            }),
        [roles.data, members.data]
    )

    const columns = useMemo<ColumnDef<Row>[]>(
        () => [
            {
                id: 'role',
                accessorFn: (row) => roleLabel(row.role.key),
                header: t('role'),
                cell: ({ row }) => <span className="font-medium">{roleLabel(row.original.role.key)}</span>,
            },
            {
                id: 'description',
                header: t('descriptionField'),
                enableSorting: false,
                cell: ({ row }) => <span className="text-muted-foreground">{roleDescription(row.original.role.key)}</span>,
            },
            {
                accessorKey: 'members',
                header: t('usersCount'),
                cell: ({ row }) =>
                    row.original.people.length > 0 ? <InitialsStack items={row.original.people} size="md" /> : <span className="text-muted-foreground">—</span>,
            },
            {
                id: 'actions',
                header: () => <span className="sr-only">{tc('actions')}</span>,
                enableSorting: false,
                cell: ({ row }) => {
                    const { role, members: count } = row.original
                    const locked = role.key === OWNER_ROLE
                    return (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="size-8">
                                    <MoreHorizontal />
                                    <span className="sr-only">{tc('openMenu')}</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setSheet({ role })}>
                                    {canManage && !locked ? <Pencil /> : <Eye />}
                                    {canManage && !locked ? t('actions.edit') : t('actions.view')}
                                </DropdownMenuItem>
                                {canManage && !locked && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem variant="destructive" disabled={count > 0} onClick={() => setRemoving(row.original)}>
                                            <Trash2 /> {count > 0 ? t('actions.deleteBlocked') : t('actions.delete')}
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )
                },
            },
        ],
        [t, tc, roleLabel, roleDescription, canManage]
    )

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title={t('title')}
                description={t('description')}
                actions={
                    canManage && (
                        <Button onClick={() => setSheet({ role: null })}>
                            <Plus /> {t('new')}
                        </Button>
                    )
                }
            />
            <ApprovalSettingCard canManage={canConfigureApprovals(roleKey)} />
            <DataTable columns={columns} data={rows} labels={labels} loading={members.isLoading} />

            <RoleSheet
                open={sheet !== null}
                onOpenChange={(open) => !open && setSheet(null)}
                role={sheet?.role ?? null}
                readOnly={!canManage}
            />

            <ConfirmDialog
                open={removing !== null}
                onOpenChange={(open) => !open && setRemoving(null)}
                title={removing ? t('deleteTitle', { name: roleLabel(removing.role.key) }) : ''}
                description={t('deleteDescription')}
                confirmLabel={t('actions.delete')}
                cancelLabel={tc('cancel')}
                loading={remove.isPending}
                onConfirm={() => removing && remove.mutate(removing)}
            />
        </div>
    )
}
