'use client'

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, TriangleAlert, X } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { StatusBadge, type StatusTone } from '@/components/shared/status-badge'
import { useTableLabels } from '@/features/resource-labels'
import {
    chequesQueryKey,
    confirmPayment,
    listCheques,
    listPayments,
    paymentsQueryKey,
    rejectPayment,
    type PaymentStatus,
    type SupplierPayment,
} from '@/features/supplier-payments'
import { purchasesQueryKey } from '@/features/purchases'
import { suppliersQueryKey } from '@/features/suppliers'
import { usePaymentErrorMessage } from '@/features/use-payment-error-message'
import { useMoney } from '@/hooks/use-money'
import { ChequeStateBadge } from './cheque-state'

const tone: Record<PaymentStatus, StatusTone> = { pending: 'warning', confirmed: 'success', reversed: 'neutral' }

/** Every payment to a mine owner, cutter or shop; a munshi's wait here until the owner confirms them. */
export function PaymentsTab({ canApprove }: { canApprove: boolean }) {
    const t = useTranslations('purchases')
    const format = useFormatter()
    const money = useMoney()
    const labels = useTableLabels()
    const queryClient = useQueryClient()
    const errorMessage = usePaymentErrorMessage()

    const list = useQuery({ queryKey: [paymentsQueryKey], queryFn: listPayments })
    const cheques = useQuery({ queryKey: [chequesQueryKey], queryFn: listCheques })

    const refresh = () => {
        for (const key of [paymentsQueryKey, chequesQueryKey, suppliersQueryKey, purchasesQueryKey]) {
            queryClient.invalidateQueries({ queryKey: [key] })
        }
    }

    const confirm = useMutation({
        mutationFn: (p: SupplierPayment) => confirmPayment(p.id),
        onSuccess: () => {
            toast.success(t('payments.confirmed'))
            refresh()
        },
        onError: (error) => toast.error(errorMessage(error)),
    })

    const reject = useMutation({
        mutationFn: (p: SupplierPayment) => rejectPayment(p.id),
        onSuccess: () => {
            toast.success(t('payments.rejected'))
            refresh()
        },
        onError: (error) => toast.error(errorMessage(error)),
    })

    const columns = useMemo<ColumnDef<SupplierPayment>[]>(
        () => [
            {
                accessorKey: 'voucherNo',
                header: t('payments.columns.voucher'),
                cell: ({ row }) => (
                    <div className="flex flex-col">
                        <span className="font-medium tabular-nums">{row.original.voucherNo}</span>
                        <span className="text-muted-foreground text-xs">
                            {format.dateTime(new Date(`${row.original.date}T00:00:00`), { dateStyle: 'medium' })}
                        </span>
                    </div>
                ),
            },
            { accessorKey: 'supplierName', header: t('payments.columns.paidTo') },
            {
                accessorKey: 'method',
                header: t('payments.columns.method'),
                cell: ({ row }) => {
                    const cheque = cheques.data?.find((c) => c.id === row.original.chequeId)
                    return (
                        <div className="flex flex-col">
                            <span>
                                {t(`pay.methods.${row.original.method}`)}
                                {cheque && ` #${cheque.no}`}
                            </span>
                            <span className="text-muted-foreground text-xs">{row.original.accountName}</span>
                        </div>
                    )
                },
            },
            {
                accessorKey: 'amount',
                header: t('payments.columns.amount'),
                meta: { className: 'text-end' },
                cell: ({ row }) => <span className="font-medium tabular-nums">{money(row.original.amount)}</span>,
            },
            { accessorKey: 'createdBy', header: t('payments.columns.enteredBy') },
            {
                accessorKey: 'status',
                header: t('payments.columns.status'),
                cell: ({ row }) => {
                    const cheque = cheques.data?.find((c) => c.id === row.original.chequeId)
                    return (
                        <div className="flex flex-col items-start gap-1">
                            <StatusBadge tone={tone[row.original.status]}>{t(`payments.statuses.${row.original.status}`)}</StatusBadge>
                            {cheque && row.original.status !== 'reversed' && <ChequeStateBadge cheque={cheque} />}
                            {row.original.status === 'pending' &&
                                (canApprove ? (
                                    <div className="flex gap-1">
                                        <Button
                                            size="sm"
                                            disabled={confirm.isPending}
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                confirm.mutate(row.original)
                                            }}
                                        >
                                            <Check /> {t('payments.confirm')}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={reject.isPending}
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                reject.mutate(row.original)
                                            }}
                                        >
                                            <X /> {t('reject')}
                                        </Button>
                                    </div>
                                ) : (
                                    <span className="text-muted-foreground text-xs">{t('waitingForOwner')}</span>
                                ))}
                        </div>
                    )
                },
            },
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [t, format, money, cheques.data, canApprove, confirm.isPending, reject.isPending]
    )

    if (list.isError) {
        return (
            <EmptyState
                title={t('loadFailed')}
                icon={TriangleAlert}
                action={
                    <Button variant="outline" onClick={() => list.refetch()}>
                        {t('retry')}
                    </Button>
                }
            />
        )
    }

    return <DataTable columns={columns} data={list.data ?? []} labels={labels} loading={list.isLoading} pageSize={25} />
}
