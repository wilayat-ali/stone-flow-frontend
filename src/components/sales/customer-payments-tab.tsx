'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Undo2, TriangleAlert } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { DataTable } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { StatusBadge } from '@/components/shared/status-badge'
import {
    chequeOfPayment,
    customerChequesQueryKey,
    customerPaymentMethods,
    customerPaymentsQueryKey,
    listCustomerPayments,
    reversePayment,
    type CustomerPayment,
    type CustomerPaymentMethod,
} from '@/features/customer-payments'
import { customerKhataQueryKey, customersQueryKey } from '@/features/customers'
import { useTableLabels } from '@/features/resource-labels'
import { billsQueryKey, ordersQueryKey } from '@/features/sales'
import { useSalesErrorMessage } from '@/features/use-sales-error-message'
import { useMoney } from '@/hooks/use-money'
import { CustomerChequeStateBadge } from './customer-cheque-state'

const ALL = 'all'

/** Every payment received, newest first. Clicking a row opens that customer's khata; the owner can reverse one. */
export function CustomerPaymentsTab({
    canReverse,
    onOpenCustomer,
}: {
    canReverse: boolean
    onOpenCustomer: (customerId: string) => void
}) {
    const t = useTranslations('sales.payments')
    const tc = useTranslations('common')
    const ts = useTranslations('sales')
    const format = useFormatter()
    const money = useMoney()
    const labels = useTableLabels()
    const queryClient = useQueryClient()
    const errorMessage = useSalesErrorMessage()
    const [method, setMethod] = useState<CustomerPaymentMethod | typeof ALL>(ALL)
    const [reversing, setReversing] = useState<CustomerPayment | null>(null)

    const list = useQuery({
        queryKey: [customerPaymentsQueryKey, method],
        queryFn: () => listCustomerPayments(method === ALL ? {} : { method }),
    })

    const reverse = useMutation({
        mutationFn: (p: CustomerPayment) => reversePayment(p.id),
        onSuccess: () => {
            toast.success(t('reversed'))
            setReversing(null)
            for (const key of [customerPaymentsQueryKey, customerChequesQueryKey, customersQueryKey, customerKhataQueryKey, billsQueryKey, ordersQueryKey]) {
                queryClient.invalidateQueries({ queryKey: [key] })
            }
        },
        onError: (error) => toast.error(errorMessage(error)),
    })

    const date = (iso: string) => format.dateTime(new Date(`${iso}T00:00:00`), { dateStyle: 'medium' })

    const columns = useMemo<ColumnDef<CustomerPayment>[]>(
        () => [
            {
                accessorKey: 'receiptNo',
                header: t('columns.receipt'),
                cell: ({ row }) => (
                    <div className="flex flex-col">
                        <span className="font-medium tabular-nums">{row.original.receiptNo}</span>
                        <span className="text-muted-foreground text-xs">{date(row.original.date)}</span>
                    </div>
                ),
            },
            {
                accessorKey: 'customerName',
                header: t('columns.customer'),
                cell: ({ row }) => {
                    const p = row.original
                    const ref = p.billNo ?? p.orderNo
                    return (
                        <div className="flex flex-col">
                            <span className="font-medium">{p.customerName}</span>
                            {(ref || p.note) && (
                                <span className="text-muted-foreground text-xs">
                                    {ref ? (p.orderNo ? t('advanceFor', { no: ref }) : t('billRef', { no: ref })) : p.note}
                                </span>
                            )}
                        </div>
                    )
                },
            },
            {
                accessorKey: 'method',
                header: t('columns.method'),
                cell: ({ row }) => {
                    const p = row.original
                    const cheque = chequeOfPayment(p)
                    return (
                        <div className="flex flex-col items-start gap-1">
                            <span>
                                {t(`methods.${p.method}`)}
                                {p.accountName && <span className="text-muted-foreground"> · {p.accountName}</span>}
                            </span>
                            {cheque && <CustomerChequeStateBadge cheque={cheque} />}
                            {p.status === 'reversed' && <StatusBadge tone="neutral">{t('reversedBadge')}</StatusBadge>}
                        </div>
                    )
                },
            },
            {
                accessorKey: 'amount',
                header: t('columns.amount'),
                meta: { className: 'text-end' },
                cell: ({ row }) => (
                    <span className={row.original.status === 'reversed' ? 'text-muted-foreground font-medium tabular-nums line-through' : 'font-medium tabular-nums'}>
                        {money(row.original.amount)}
                    </span>
                ),
            },
            {
                id: 'actions',
                header: () => <span className="sr-only">{tc('actions')}</span>,
                enableSorting: false,
                cell: ({ row }) => {
                    const p = row.original
                    const cheque = chequeOfPayment(p)
                    if (!canReverse || p.status !== 'posted' || cheque?.status === 'bounced') return null
                    return (
                        <div className="flex justify-end">
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setReversing(p)
                                }}
                            >
                                <Undo2 /> {t('reverse')}
                            </Button>
                        </div>
                    )
                },
            },
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [t, tc, format, money, canReverse]
    )

    if (list.isError) {
        return (
            <EmptyState
                title={ts('loadFailed')}
                icon={TriangleAlert}
                action={
                    <Button variant="outline" onClick={() => list.refetch()}>
                        {ts('retry')}
                    </Button>
                }
            />
        )
    }

    return (
        <>
            <DataTable
                columns={columns}
                data={list.data ?? []}
                labels={labels}
                loading={list.isLoading}
                pageSize={25}
                onRowClick={(row) => row.customerId && onOpenCustomer(row.customerId)}
                toolbar={
                    <Select value={method} onValueChange={(v) => setMethod(v as CustomerPaymentMethod | typeof ALL)}>
                        <SelectTrigger className="w-44">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL}>{t('allMethods')}</SelectItem>
                            {customerPaymentMethods.map((m) => (
                                <SelectItem key={m} value={m}>
                                    {t(`methods.${m}`)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                }
            />

            <ConfirmDialog
                open={!!reversing}
                onOpenChange={(open) => !open && setReversing(null)}
                title={t('reverseDialog.title', { no: reversing?.receiptNo ?? '' })}
                description={t('reverseDialog.description', { amount: money(reversing?.amount ?? 0), customer: reversing?.customerName ?? '' })}
                confirmLabel={t('reverseDialog.submit')}
                cancelLabel={tc('cancel')}
                destructive
                loading={reverse.isPending}
                onConfirm={() => reversing && reverse.mutate(reversing)}
            />
        </>
    )
}
