'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, MoreHorizontal, Plus, RotateCw, ShieldCheck, Trash2, UserCheck, UserX } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { DataTable } from '@/components/shared/data-table'
import { InitialsStack } from '@/components/shared/initials-stack'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge, type StatusTone } from '@/components/shared/status-badge'
import {
    changeMemberRole,
    createResetLink,
    invitationsKey,
    inviteMember,
    listInvitations,
    listMembers,
    memberName,
    membersKey,
    revokeInvitation,
    setMemberActive,
    type Invitation,
    type Member,
    type MemberStatus,
} from '@/features/admin/members'
import { assignableRoles, canManageMembers, canManageTarget } from '@/features/admin/roles'
import { useRoleLabel, useRoles, useRolesVersion } from '@/features/admin/use-roles'
import { useTableLabels } from '@/features/resource-labels'
import { errorCode } from '@/lib/client-api'
import { ChangeRoleDialog } from './change-role-dialog'
import { InviteUserSheet, toContact } from './invite-user-sheet'
import { ShareLinkDialog, type SharedLink } from './share-link-dialog'

type Tab = 'active' | 'invited' | 'inactive'

type Row = {
    id: string
    name: string
    contact: string
    roleKey: string
    roleName: string
    status: MemberStatus
    date: string | null
    member?: Member
    invitation?: Invitation
}

const statusTone: Record<MemberStatus, StatusTone> = {
    active: 'success',
    invited: 'warning',
    inactive: 'neutral',
}

const memberRow = (member: Member): Row => {
    const contact = member.email ?? member.phone ?? ''
    return {
        id: member.memberId,
        name: memberName(member) || contact,
        contact,
        roleKey: member.roleKey,
        roleName: member.roleName,
        status: member.status,
        date: member.joinedAt,
        member,
    }
}

const invitationRow = (invitation: Invitation): Row => {
    const contact = invitation.email ?? invitation.phone ?? ''
    return {
        id: invitation.id,
        name: contact,
        contact: '',
        roleKey: invitation.roleKey ?? '',
        roleName: invitation.roleName ?? '',
        status: 'invited',
        date: invitation.expiresAt,
        invitation,
    }
}

/** Owner/Partner manage people; Manager can only look. The backend enforces the same rules. */
export function UsersPage({ roleKey }: { roleKey: string }) {
    const t = useTranslations('admin.users')
    const tc = useTranslations('common')
    const format = useFormatter()
    const queryClient = useQueryClient()
    const labels = useTableLabels()
    useRolesVersion()
    const roleLabel = useRoleLabel()
    const allRoles = useRoles().data ?? []
    const canManage = canManageMembers(roleKey)
    const assignable = assignableRoles(roleKey)

    const [tab, setTab] = useState<Tab>('active')
    const [roleFilter, setRoleFilter] = useState('all')
    const [inviteOpen, setInviteOpen] = useState(false)
    const [link, setLink] = useState<SharedLink | null>(null)
    const [roleTarget, setRoleTarget] = useState<Member | null>(null)
    const [confirm, setConfirm] = useState<
        { kind: 'deactivate' | 'activate'; row: Row } | { kind: 'revoke'; row: Row } | null
    >(null)

    const members = useQuery({ queryKey: membersKey, queryFn: listMembers })
    const invitations = useQuery({
        queryKey: invitationsKey,
        queryFn: listInvitations,
        enabled: canManage,
    })

    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: membersKey })
        queryClient.invalidateQueries({ queryKey: invitationsKey })
    }

    const onError = (error: unknown) => {
        const code = errorCode(error)
        const key = `errors.${code}`
        toast.error(code && t.has(key as never) ? t(key as never) : t('errors.generic'))
    }

    const showInviteLink = (result: Awaited<ReturnType<typeof inviteMember>>) => {
        refresh()
        setLink({
            title: t('share.inviteTitle'),
            description: t('share.inviteDescription'),
            url: result.inviteLink,
            whatsappUrl: result.whatsappLink,
            expiresAt: result.expiresAt,
        })
    }

    const toggleActive = useMutation({
        mutationFn: ({ id, active }: { id: string; active: boolean }) => setMemberActive(id, active),
        onSuccess: (_, { active }) => {
            toast.success(active ? t('toast.activated') : t('toast.deactivated'))
            setConfirm(null)
            refresh()
        },
        onError,
    })

    const revoke = useMutation({
        mutationFn: revokeInvitation,
        onSuccess: () => {
            toast.success(t('toast.revoked'))
            setConfirm(null)
            refresh()
        },
        onError,
    })

    const changeRole = useMutation({
        mutationFn: ({ id, role }: { id: string; role: string }) => changeMemberRole(id, role),
        onSuccess: () => {
            toast.success(t('toast.roleChanged'))
            setRoleTarget(null)
            refresh()
        },
        onError,
    })

    const resetLink = useMutation({
        mutationFn: createResetLink,
        onSuccess: (result) =>
            setLink({
                title: t('share.resetTitle'),
                description: t('share.resetDescription'),
                url: result.resetLink,
                whatsappUrl: result.whatsappLink,
                expiresAt: result.expiresAt,
            }),
        onError,
    })

    const reinvite = useMutation({
        mutationFn: (invitation: Invitation) =>
            inviteMember({
                ...toContact(invitation.email ?? invitation.phone ?? ''),
                roleKey: invitation.roleKey ?? 'viewer',
            }),
        onSuccess: showInviteLink,
        onError,
    })

    const memberList = useMemo(() => members.data ?? [], [members.data])
    const invitationList = useMemo(() => invitations.data ?? [], [invitations.data])

    const counts: Record<Tab, number> = {
        active: memberList.filter((m) => m.status === 'active').length,
        inactive: memberList.filter((m) => m.status === 'inactive').length,
        invited: memberList.filter((m) => m.status === 'invited').length + invitationList.length,
    }

    const rows = useMemo<Row[]>(() => {
        const byTab: Row[] =
            tab === 'invited'
                ? [
                      ...invitationList.map(invitationRow),
                      ...memberList.filter((m) => m.status === 'invited').map(memberRow),
                  ]
                : memberList.filter((m) => m.status === tab).map(memberRow)
        return roleFilter === 'all' ? byTab : byTab.filter((row) => row.roleKey === roleFilter)
    }, [tab, roleFilter, memberList, invitationList])

    const columns = useMemo<ColumnDef<Row>[]>(
        () => [
            {
                accessorKey: 'name',
                header: t('columns.user'),
                cell: ({ row }) => (
                    <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{row.original.name}</span>
                        {row.original.contact && (
                            <span className="text-muted-foreground truncate text-xs" dir="ltr">
                                {row.original.contact}
                            </span>
                        )}
                    </div>
                ),
            },
            {
                accessorKey: 'roleKey',
                header: t('columns.role'),
                cell: ({ row }) => (
                    <div className="flex items-center gap-2">
                        <InitialsStack size="sm" items={[{ id: row.original.roleKey, label: row.original.roleName }]} />
                        <span>{row.original.roleName}</span>
                    </div>
                ),
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
                accessorKey: 'date',
                header: tab === 'invited' ? t('columns.expires') : t('columns.joined'),
                cell: ({ row }) =>
                    row.original.date
                        ? format.dateTime(new Date(row.original.date), { dateStyle: 'medium' })
                        : '—',
            },
            {
                id: 'actions',
                header: () => <span className="sr-only">{tc('actions')}</span>,
                enableSorting: false,
                cell: ({ row }) => {
                    const { member, invitation } = row.original
                    const allowed = invitation
                        ? canManage
                        : !!member &&
                          member.status !== 'invited' &&
                          canManage &&
                          canManageTarget(roleKey, member.roleKey)
                    if (!allowed) return null

                    return (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="size-8">
                                    <MoreHorizontal />
                                    <span className="sr-only">{tc('openMenu')}</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {invitation ? (
                                    <>
                                        <DropdownMenuItem onClick={() => reinvite.mutate(invitation)}>
                                            <RotateCw /> {t('actions.reinvite')}
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            variant="destructive"
                                            onClick={() => setConfirm({ kind: 'revoke', row: row.original })}
                                        >
                                            <Trash2 /> {t('actions.revoke')}
                                        </DropdownMenuItem>
                                    </>
                                ) : (
                                    member && (
                                        <>
                                            <DropdownMenuItem onClick={() => setRoleTarget(member)}>
                                                <ShieldCheck /> {t('actions.changeRole')}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => resetLink.mutate(member.memberId)}>
                                                <KeyRound /> {t('actions.resetLink')}
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            {member.status === 'active' ? (
                                                <DropdownMenuItem
                                                    variant="destructive"
                                                    onClick={() =>
                                                        setConfirm({ kind: 'deactivate', row: row.original })
                                                    }
                                                >
                                                    <UserX /> {t('actions.deactivate')}
                                                </DropdownMenuItem>
                                            ) : (
                                                <DropdownMenuItem
                                                    onClick={() => setConfirm({ kind: 'activate', row: row.original })}
                                                >
                                                    <UserCheck /> {t('actions.activate')}
                                                </DropdownMenuItem>
                                            )}
                                        </>
                                    )
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )
                },
            },
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [t, tc, format, tab, canManage, roleKey]
    )

    const confirming = confirm?.row.name ?? ''

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title={t('title')}
                description={t('description')}
                actions={
                    canManage && (
                        <Button onClick={() => setInviteOpen(true)}>
                            <Plus />
                            {t('invite.open')}
                        </Button>
                    )
                }
            />

            <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
                <TabsList>
                    {(['active', 'invited', 'inactive'] as const).map((value) => (
                        <TabsTrigger key={value} value={value}>
                            {t(`tabs.${value}`)}
                            <span className="text-muted-foreground text-xs">{counts[value]}</span>
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>

            <DataTable
                columns={columns}
                data={rows}
                labels={labels}
                loading={members.isLoading}
                toolbar={
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                        <SelectTrigger className="w-44">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{t('allRoles')}</SelectItem>
                            {allRoles.map(({ key }) => (
                                <SelectItem key={key} value={key}>
                                    {roleLabel(key)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                }
            />

            {canManage && (
                <InviteUserSheet
                    open={inviteOpen}
                    onOpenChange={setInviteOpen}
                    assignable={assignable}
                    roleLabel={roleLabel}
                    onInvited={showInviteLink}
                />
            )}

            <ShareLinkDialog link={link} onClose={() => setLink(null)} />

            {roleTarget && (
                <ChangeRoleDialog
                    key={roleTarget.memberId}
                    name={memberName(roleTarget) || roleTarget.email || roleTarget.phone}
                    currentRole={roleTarget.roleKey}
                    assignable={assignable}
                    roleLabel={roleLabel}
                    saving={changeRole.isPending}
                    onSave={(role) => changeRole.mutate({ id: roleTarget.memberId, role })}
                    onClose={() => setRoleTarget(null)}
                />
            )}

            <ConfirmDialog
                open={confirm !== null}
                onOpenChange={(open) => !open && setConfirm(null)}
                title={confirm ? t(`confirm.${confirm.kind}Title`) : ''}
                description={confirm ? t(`confirm.${confirm.kind}Description`, { name: confirming }) : ''}
                confirmLabel={confirm ? t(`confirm.${confirm.kind}Action`) : ''}
                cancelLabel={tc('cancel')}
                destructive={confirm?.kind !== 'activate'}
                loading={toggleActive.isPending || revoke.isPending}
                onConfirm={() => {
                    if (!confirm) return
                    if (confirm.kind === 'revoke') revoke.mutate(confirm.row.id)
                    else toggleActive.mutate({ id: confirm.row.id, active: confirm.kind === 'activate' })
                }}
            />
        </div>
    )
}
