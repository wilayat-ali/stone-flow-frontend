'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, TriangleAlert, X } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataTable } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge, type StatusTone } from '@/components/shared/status-badge'
import {
    approvalEntityTypes,
    approvalsKey,
    approvalsListKey,
    approveEntry,
    listApprovals,
    rejectEntry,
    type Approval,
    type ApprovalEntityType,
    type ApprovalStatus,
} from '@/features/approvals/api'
import { useApprovalErrorMessage } from '@/features/approvals/use-error-message'
import { notificationsKey } from '@/features/notifications'
import { useTableLabels } from '@/features/resource-labels'
import { useMoney } from '@/hooks/use-money'
import { RejectDialog } from './reject-dialog'

const statuses: ApprovalStatus[] = ['pending', 'approved', 'rejected']

const statusTone: Record<ApprovalStatus, StatusTone> = {
    pending: 'warning',
    approved: 'success',
    rejected: 'danger',
}

/** The owner's "To approve" list: what, by whom, amount, date, with Approve / Reject. */
export function ApprovalsPage() {
    const t = useTranslations('approvals')
    const tc = useTranslations('common')
    const format = useFormatter()
    const money = useMoney()
    const labels = useTableLabels()
    const queryClient = useQueryClient()
    const errorMessage = useApprovalErrorMessage()

    const [status, setStatus] = useState<ApprovalStatus>('pending')
    const [type, setType] = useState<ApprovalEntityType | 'all'>('all')
    const [rejecting, setRejecting] = useState<Approval | null>(null)

    const filters = useMemo(
        () => ({ status, ...(type !== 'all' && { type }) }),
        [status, type]
    )
    const list = useQuery({
        queryKey: approvalsListKey(filters),
        queryFn: () => listApprovals(filters),
    })

    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: approvalsKey })
        queryClient.invalidateQueries({ queryKey: notificationsKey })
    }

    const approve = useMutation({
        mutationFn: (approval: Approval) => approveEntry(approval.id),
        onSuccess: () => {
            toast.success(t('approved'))
            refresh()
        },
        // A failed re-validation leaves the entry pending; the reason is shown, nothing else changes.
        onError: (error) => toast.error(errorMessage(error)),
    })

    const reject = useMutation({
        mutationFn: ({
            approval,
            reason,
        }: {
            approval: Approval
            reason: string
        }) => rejectEntry(approval.id, reason),
        onSuccess: () => {
            toast.success(t('rejected'))
            setRejecting(null)
            refresh()
        },
        onError: (error) => toast.error(errorMessage(error)),
    })

    const columns = useMemo<ColumnDef<Approval>[]>(
        () => [
            {
                accessorKey: 'summary',
                header: t('columns.what'),
                cell: ({ row }) => (
                    <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">
                            {row.original.summary}
                        </span>
                        <span className="text-muted-foreground text-xs">
                            {t(`types.${row.original.entityType}`)}
                        </span>
                    </div>
                ),
            },
            { accessorKey: 'requestedBy', header: t('columns.by') },
            {
                accessorKey: 'amount',
                header: t('columns.amount'),
                meta: { className: 'text-end' },
                cell: ({ row }) =>
                    row.original.amount === null
                        ? '—'
                        : money(row.original.amount),
            },
            {
                accessorKey: 'requestedAt',
                header: t('columns.date'),
                cell: ({ row }) =>
                    format.dateTime(new Date(row.original.requestedAt), {
                        dateStyle: 'medium',
                    }),
            },
            {
                accessorKey: 'status',
                header: t('columns.status'),
                cell: ({ row }) => (
                    <div className="flex flex-col items-start gap-1">
                        <StatusBadge tone={statusTone[row.original.status]}>
                            {t(`statuses.${row.original.status}`)}
                        </StatusBadge>
                        {row.original.reason && (
                            <span className="text-muted-foreground text-xs">
                                {row.original.reason}
                            </span>
                        )}
                    </div>
                ),
            },
            {
                id: 'actions',
                header: () => <span className="sr-only">{tc('actions')}</span>,
                enableSorting: false,
                cell: ({ row }) =>
                    row.original.status === 'pending' && (
                        <div className="flex justify-end gap-2">
                            <Button
                                size="sm"
                                disabled={approve.isPending}
                                onClick={() => approve.mutate(row.original)}
                            >
                                <Check /> {t('approve')}
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setRejecting(row.original)}
                            >
                                <X /> {t('reject')}
                            </Button>
                        </div>
                    ),
            },
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [t, tc, format, money, approve.isPending]
    )

    return (
        <div className="flex flex-col gap-4">
            <PageHeader title={t('title')} description={t('description')} />

            <Tabs
                value={status}
                onValueChange={(value) => setStatus(value as ApprovalStatus)}
            >
                <TabsList>
                    {statuses.map((value) => (
                        <TabsTrigger key={value} value={value}>
                            {t(`statuses.${value}`)}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>

            {/* Without this a stopped server would read as "No records found". */}
            {list.isError ? (
                <EmptyState
                    title={t('loadFailed')}
                    icon={TriangleAlert}
                    action={
                        <Button
                            variant="outline"
                            onClick={() => list.refetch()}
                        >
                            {t('retry')}
                        </Button>
                    }
                />
            ) : (
                <DataTable
                    columns={columns}
                    data={list.data?.rows ?? []}
                    labels={labels}
                    loading={list.isLoading}
                    pageSize={25}
                    toolbar={
                        <Select
                            value={type}
                            onValueChange={(value) =>
                                setType(value as ApprovalEntityType | 'all')
                            }
                        >
                            <SelectTrigger className="w-48">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    {t('allTypes')}
                                </SelectItem>
                                {approvalEntityTypes.map((key) => (
                                    <SelectItem key={key} value={key}>
                                        {t(`types.${key}`)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    }
                />
            )}

            <RejectDialog
                open={!!rejecting}
                onOpenChange={(open) => !open && setRejecting(null)}
                pending={reject.isPending}
                labels={{
                    title: t('rejectDialog.title'),
                    description: rejecting
                        ? t('rejectDialog.description', {
                              summary: rejecting.summary,
                          })
                        : '',
                    reason: t('rejectDialog.reason'),
                    required: t('rejectDialog.required'),
                    submit: t('reject'),
                    cancel: tc('cancel'),
                }}
                onSubmit={(reason) =>
                    rejecting && reject.mutate({ approval: rejecting, reason })
                }
            />
        </div>
    )
}
