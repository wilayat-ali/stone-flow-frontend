'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MoreHorizontal, Plus, Power, PowerOff, SlidersHorizontal } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ShareLinkDialog, type SharedLink } from '@/components/admin/share-link-dialog'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { DataTable } from '@/components/shared/data-table'
import { InitialsStack } from '@/components/shared/initials-stack'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge, type StatusTone } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTableLabels } from '@/features/resource-labels'
import {
    failureKey,
    listWorkspaces,
    ownerName,
    platformKeys,
    setWorkspaceActive,
    workspacesKey,
    type CreateWorkspaceResult,
    type Workspace,
    type WorkspaceStatus,
} from '@/features/super-admin/workspaces'
import { CreateWorkspaceSheet } from './create-workspace-sheet'
import { ManagePlatformsDialog } from './manage-platforms-dialog'

const statusTone: Record<WorkspaceStatus, StatusTone> = {
    active: 'success',
    suspended: 'danger',
}

/** All customer workspaces. Only a `super_admin` may create or change them; `support` can look. */
export function WorkspacesPage({ canManage }: { canManage: boolean }) {
    const t = useTranslations('superAdmin.workspaces')
    const tc = useTranslations('common')
    const format = useFormatter()
    const queryClient = useQueryClient()
    const labels = useTableLabels()

    const [statusFilter, setStatusFilter] = useState('all')
    const [createOpen, setCreateOpen] = useState(false)
    const [link, setLink] = useState<SharedLink | null>(null)
    const [managingId, setManagingId] = useState<string | null>(null)
    const [confirm, setConfirm] = useState<Workspace | null>(null)

    const workspaces = useQuery({ queryKey: workspacesKey, queryFn: listWorkspaces })
    const list = useMemo(() => workspaces.data ?? [], [workspaces.data])
    const managing = list.find((w) => w.id === managingId) ?? null

    const rows = useMemo(
        () => (statusFilter === 'all' ? list : list.filter((w) => w.status === statusFilter)),
        [list, statusFilter]
    )

    const onCreated = (result: CreateWorkspaceResult) => {
        queryClient.invalidateQueries({ queryKey: workspacesKey })
        toast.success(t('toast.created'))
        if (result.invite) {
            setLink({
                title: t('share.title'),
                description: t('share.description', { name: result.company.name }),
                url: result.invite.inviteLink,
                whatsappUrl: result.invite.whatsappLink,
                expiresAt: result.invite.expiresAt,
            })
        }
    }

    const toggleStatus = useMutation({
        mutationFn: (workspace: Workspace) => setWorkspaceActive(workspace.id, workspace.status === 'suspended'),
        onSuccess: (_, workspace) => {
            toast.success(t(workspace.status === 'suspended' ? 'toast.reactivated' : 'toast.suspended'))
            setConfirm(null)
            queryClient.invalidateQueries({ queryKey: workspacesKey })
        },
        onError: (error) => {
            const key = `errors.${failureKey(error)}`
            toast.error(t.has(key as never) ? t(key as never) : t('errors.generic'))
        },
    })

    const columns = useMemo<ColumnDef<Workspace>[]>(
        () => [
            {
                accessorKey: 'name',
                header: t('columns.workspace'),
                cell: ({ row }) => (
                    <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{row.original.name}</span>
                        <span className="text-muted-foreground truncate text-xs" dir="ltr">
                            {row.original.slug}
                        </span>
                    </div>
                ),
            },
            {
                id: 'owner',
                header: t('columns.owner'),
                accessorFn: (row) => `${ownerName(row.owner)} ${row.owner.email ?? ''} ${row.owner.phone ?? ''}`,
                cell: ({ row }) => (
                    <div className="flex min-w-0 flex-col">
                        <span className="truncate">{ownerName(row.original.owner)}</span>
                        <span className="text-muted-foreground truncate text-xs" dir="ltr">
                            {row.original.owner.email ?? row.original.owner.phone}
                        </span>
                    </div>
                ),
            },
            {
                id: 'platforms',
                header: t('columns.platforms'),
                enableSorting: false,
                cell: ({ row }) => {
                    const on = platformKeys.filter((key) => row.original.platforms[key])
                    return on.length ? (
                        <InitialsStack
                            items={on.map((key) => ({
                                id: key,
                                label: t(`platforms.${key}`),
                                short: t(`platformShort.${key}`),
                            }))}
                        />
                    ) : (
                        <span className="text-muted-foreground">{t('noPlatforms')}</span>
                    )
                },
            },
            {
                accessorKey: 'status',
                header: t('columns.status'),
                cell: ({ row }) => (
                    <StatusBadge tone={statusTone[row.original.status]}>
                        {t(`statuses.${row.original.status}`)}
                    </StatusBadge>
                ),
            },
            {
                accessorKey: 'createdAt',
                header: t('columns.created'),
                cell: ({ row }) => format.dateTime(new Date(row.original.createdAt), { dateStyle: 'medium' }),
            },
            {
                id: 'actions',
                header: () => <span className="sr-only">{tc('actions')}</span>,
                enableSorting: false,
                cell: ({ row }) => (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                                <MoreHorizontal />
                                <span className="sr-only">{tc('openMenu')}</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setManagingId(row.original.id)}>
                                <SlidersHorizontal /> {t('actions.managePlatforms')}
                            </DropdownMenuItem>
                            {canManage && (
                                <>
                                    <DropdownMenuSeparator />
                                    {row.original.status === 'active' ? (
                                        <DropdownMenuItem variant="destructive" onClick={() => setConfirm(row.original)}>
                                            <PowerOff /> {t('actions.suspend')}
                                        </DropdownMenuItem>
                                    ) : (
                                        <DropdownMenuItem onClick={() => setConfirm(row.original)}>
                                            <Power /> {t('actions.reactivate')}
                                        </DropdownMenuItem>
                                    )}
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                ),
            },
        ],
        [t, tc, format, canManage]
    )

    const suspending = confirm?.status === 'active'

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title={t('title')}
                description={t('description')}
                actions={
                    canManage && (
                        <Button onClick={() => setCreateOpen(true)}>
                            <Plus />
                            {t('add')}
                        </Button>
                    )
                }
            />

            <DataTable
                columns={columns}
                data={rows}
                labels={labels}
                loading={workspaces.isLoading}
                toolbar={
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-44">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{t('allStatuses')}</SelectItem>
                            <SelectItem value="active">{t('statuses.active')}</SelectItem>
                            <SelectItem value="suspended">{t('statuses.suspended')}</SelectItem>
                        </SelectContent>
                    </Select>
                }
            />

            {canManage && (
                <CreateWorkspaceSheet open={createOpen} onOpenChange={setCreateOpen} onCreated={onCreated} />
            )}

            <ShareLinkDialog link={link} onClose={() => setLink(null)} />

            <ManagePlatformsDialog workspace={managing} canManage={canManage} onClose={() => setManagingId(null)} />

            <ConfirmDialog
                open={confirm !== null}
                onOpenChange={(open) => !open && setConfirm(null)}
                title={suspending ? t('confirm.suspendTitle') : t('confirm.reactivateTitle')}
                description={
                    confirm
                        ? t(suspending ? 'confirm.suspendDescription' : 'confirm.reactivateDescription', {
                              name: confirm.name,
                          })
                        : ''
                }
                confirmLabel={suspending ? t('confirm.suspendAction') : t('confirm.reactivateAction')}
                cancelLabel={tc('cancel')}
                destructive={suspending}
                loading={toggleStatus.isPending}
                onConfirm={() => confirm && toggleStatus.mutate(confirm)}
            />
        </div>
    )
}
