'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { TriangleAlert } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DataTable } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import {
    bounceCustomerCheque,
    clearCustomerCheque,
    customerChequeState,
    customerChequesQueryKey,
    customerPaymentsQueryKey,
    listCustomerCheques,
    type CustomerCheque,
    type CustomerChequeState,
} from '@/features/customer-payments'
import { customerKhataQueryKey, customersQueryKey } from '@/features/customers'
import { useTableLabels } from '@/features/resource-labels'
import { useSalesErrorMessage } from '@/features/use-sales-error-message'
import { useMoney } from '@/hooks/use-money'
import { ClearChequeDialog } from './clear-cheque-dialog'
import { CustomerBounceDialog } from './customer-bounce-dialog'
import { CustomerChequeStateBadge } from './customer-cheque-state'

const ALL = 'all'

/**
 * Cheques customers handed over, due ones first. A cheque lowers the balance when it is received; the money
 * reaches the bank only when it clears, and a bounced cheque goes back on the khata.
 */
export function CustomerChequesTab({ canManage }: { canManage: boolean }) {
    const t = useTranslations('sales.cheques')
    const tc = useTranslations('common')
    const ts = useTranslations('sales')
    const format = useFormatter()
    const money = useMoney()
    const labels = useTableLabels()
    const queryClient = useQueryClient()
    const errorMessage = useSalesErrorMessage()
    const [state, setState] = useState<CustomerChequeState | typeof ALL>(ALL)
    const [clearing, setClearing] = useState<CustomerCheque | null>(null)
    const [bouncing, setBouncing] = useState<CustomerCheque | null>(null)

    const list = useQuery({
        queryKey: [customerChequesQueryKey, state],
        queryFn: () => listCustomerCheques(state === ALL ? {} : { state }),
    })

    const refresh = () => {
        for (const key of [customerChequesQueryKey, customerPaymentsQueryKey, customersQueryKey, customerKhataQueryKey]) {
            queryClient.invalidateQueries({ queryKey: [key] })
        }
    }

    const clear = useMutation({
        mutationFn: ({ cheque, ...values }: { cheque: CustomerCheque; accountId: string; accountName: string; date: string }) => clearCustomerCheque(cheque.id, values),
        onSuccess: () => {
            toast.success(t('cleared'))
            setClearing(null)
            refresh()
        },
        onError: (error) => toast.error(errorMessage(error)),
    })

    const bounce = useMutation({
        mutationFn: ({ cheque, ...values }: { cheque: CustomerCheque; reason: string; date: string }) => bounceCustomerCheque(cheque.id, values),
        onSuccess: () => {
            toast.success(t('bounced'))
            setBouncing(null)
            refresh()
        },
        onError: (error) => toast.error(errorMessage(error)),
    })

    const date = (iso: string) => format.dateTime(new Date(`${iso}T00:00:00`), { dateStyle: 'medium' })

    const columns = useMemo<ColumnDef<CustomerCheque>[]>(
        () => [
            {
                accessorKey: 'chequeNo',
                header: t('columns.no'),
                cell: ({ row }) => (
                    <div className="flex flex-col">
                        <span className="font-medium tabular-nums">#{row.original.chequeNo}</span>
                        <span className="text-muted-foreground text-xs">{row.original.bankName}</span>
                    </div>
                ),
            },
            {
                accessorKey: 'customerName',
                header: t('columns.customer'),
                cell: ({ row }) => (
                    <div className="flex flex-col">
                        <span className="font-medium">{row.original.customerName}</span>
                        <span className="text-muted-foreground text-xs">{t('receivedOn', { date: date(row.original.receivedOn) })}</span>
                    </div>
                ),
            },
            { accessorKey: 'chequeDate', header: t('columns.chequeDate'), cell: ({ row }) => date(row.original.chequeDate) },
            {
                accessorKey: 'amount',
                header: t('columns.amount'),
                meta: { className: 'text-end' },
                cell: ({ row }) => <span className="font-medium tabular-nums">{money(row.original.amount)}</span>,
            },
            {
                accessorKey: 'status',
                header: t('columns.status'),
                cell: ({ row }) => {
                    const c = row.original
                    return (
                        <div className="flex flex-col items-start gap-1">
                            <CustomerChequeStateBadge cheque={c} />
                            {c.status === 'cleared' && (
                                <span className="text-muted-foreground text-xs">
                                    {t('depositedIn', { bank: c.depositAccountName ?? '', date: c.clearedOn ? date(c.clearedOn) : '' })}
                                </span>
                            )}
                            {c.status === 'bounced' && (
                                <span className="text-muted-foreground text-xs">
                                    {c.bounceReason}
                                    {c.bouncedOn ? ` · ${date(c.bouncedOn)}` : ''}
                                </span>
                            )}
                        </div>
                    )
                },
            },
            {
                id: 'actions',
                header: () => <span className="sr-only">{tc('actions')}</span>,
                enableSorting: false,
                cell: ({ row }) => {
                    const c = row.original
                    if (!canManage || c.status !== 'pending') return null
                    return (
                        <div className="flex flex-wrap justify-end gap-1">
                            <Button
                                size="sm"
                                variant={customerChequeState(c) === 'due' ? 'default' : 'outline'}
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setClearing(c)
                                }}
                            >
                                {t('markCleared')}
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setBouncing(c)
                                }}
                            >
                                {t('markBounced')}
                            </Button>
                        </div>
                    )
                },
            },
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [t, tc, format, money, canManage]
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
                toolbar={
                    <Select value={state} onValueChange={(v) => setState(v as CustomerChequeState | typeof ALL)}>
                        <SelectTrigger className="w-48">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL}>{t('allStates')}</SelectItem>
                            {(['due', 'post_dated', 'cleared', 'bounced'] as const).map((s) => (
                                <SelectItem key={s} value={s}>
                                    {t(`states.${s}`)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                }
            />
            <p className="text-muted-foreground text-sm">{t('note')}</p>

            <ClearChequeDialog key={clearing?.id ?? 'none'} cheque={clearing} pending={clear.isPending} onClose={() => setClearing(null)} onSubmit={(values) => clearing && clear.mutate({ cheque: clearing, ...values })} />
            <CustomerBounceDialog key={bouncing?.id ?? 'none'} cheque={bouncing} pending={bounce.isPending} onClose={() => setBouncing(null)} onSubmit={(values) => bouncing && bounce.mutate({ cheque: bouncing, ...values })} />
        </>
    )
}
