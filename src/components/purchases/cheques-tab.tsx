'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { TriangleAlert } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { DataTable } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { useTableLabels } from '@/features/resource-labels'
import {
    bounceCheque,
    cancelCheque,
    chequeState,
    chequesQueryKey,
    clearCheque,
    listCheques,
    paymentsQueryKey,
    type Cheque,
} from '@/features/supplier-payments'
import { purchasesQueryKey } from '@/features/purchases'
import { suppliersQueryKey } from '@/features/suppliers'
import { usePaymentErrorMessage } from '@/features/use-payment-error-message'
import { useMoney } from '@/hooks/use-money'
import { todayIso } from '@/lib/format'
import { BounceDialog } from './bounce-dialog'
import { ChequeStateBadge } from './cheque-state'

type Confirming = { kind: 'clear' | 'cancel'; cheque: Cheque }

/**
 * Cheques given to suppliers. A cheque lowers what is owed when it is given, but the money leaves the
 * bank only when it clears; if it bounces the amount goes back on the supplier's khata.
 */
export function ChequesTab({ canManage, onReplace }: { canManage: boolean; onReplace: (cheque: Cheque) => void }) {
    const t = useTranslations('purchases.cheques')
    const tp = useTranslations('purchases')
    const tc = useTranslations('common')
    const format = useFormatter()
    const money = useMoney()
    const labels = useTableLabels()
    const queryClient = useQueryClient()
    const errorMessage = usePaymentErrorMessage()
    const [confirming, setConfirming] = useState<Confirming | null>(null)
    const [bouncing, setBouncing] = useState<Cheque | null>(null)

    const list = useQuery({ queryKey: [chequesQueryKey], queryFn: listCheques })

    const refresh = () => {
        for (const key of [chequesQueryKey, paymentsQueryKey, suppliersQueryKey, purchasesQueryKey]) {
            queryClient.invalidateQueries({ queryKey: [key] })
        }
    }
    const onError = (error: unknown) => toast.error(errorMessage(error))

    const clear = useMutation({
        mutationFn: (c: Cheque) => clearCheque(c.id, todayIso()),
        onSuccess: () => {
            toast.success(t('cleared'))
            setConfirming(null)
            refresh()
        },
        onError,
    })

    const cancel = useMutation({
        mutationFn: (c: Cheque) => cancelCheque(c.id),
        onSuccess: () => {
            toast.success(t('cancelled'))
            setConfirming(null)
            refresh()
        },
        onError,
    })

    const bounce = useMutation({
        mutationFn: ({ cheque, ...values }: { cheque: Cheque; reason: string; charge: number }) =>
            bounceCheque(cheque.id, { ...values, date: todayIso() }),
        onSuccess: () => {
            toast.success(t('bounced'))
            setBouncing(null)
            refresh()
        },
        onError,
    })

    const date = (iso: string) => format.dateTime(new Date(`${iso}T00:00:00`), { dateStyle: 'medium' })

    const columns = useMemo<ColumnDef<Cheque>[]>(
        () => [
            {
                accessorKey: 'no',
                header: t('columns.no'),
                cell: ({ row }) => (
                    <div className="flex flex-col">
                        <span className="font-medium tabular-nums">#{row.original.no}</span>
                        <span className="text-muted-foreground text-xs">{row.original.accountName}</span>
                    </div>
                ),
            },
            { accessorKey: 'supplierName', header: t('columns.payTo') },
            {
                accessorKey: 'amount',
                header: t('columns.amount'),
                meta: { className: 'text-end' },
                cell: ({ row }) => <span className="font-medium tabular-nums">{money(row.original.amount)}</span>,
            },
            {
                accessorKey: 'chequeDate',
                header: t('columns.chequeDate'),
                cell: ({ row }) => (
                    <div className="flex flex-col">
                        <span>{date(row.original.chequeDate)}</span>
                        <span className="text-muted-foreground text-xs">{t('givenOn', { date: date(row.original.issuedOn) })}</span>
                    </div>
                ),
            },
            {
                accessorKey: 'status',
                header: t('columns.status'),
                cell: ({ row }) => {
                    const c = row.original
                    return (
                        <div className="flex flex-col items-start gap-1">
                            <ChequeStateBadge cheque={c} />
                            {c.status === 'bounced' && (
                                <span className="text-muted-foreground text-xs">
                                    {c.reason}
                                    {c.replacedByPaymentId ? ` · ${t('replaced')}` : ` · ${t('notReplaced')}`}
                                </span>
                            )}
                            {c.status === 'cleared' && c.statusDate && (
                                <span className="text-muted-foreground text-xs">{t('clearedOn', { date: date(c.statusDate) })}</span>
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
                    if (!canManage) return null
                    if (c.status === 'issued') {
                        return (
                            <div className="flex flex-wrap justify-end gap-1">
                                <Button
                                    size="sm"
                                    variant={chequeState(c) === 'confirm' ? 'default' : 'outline'}
                                    onClick={() => setConfirming({ kind: 'clear', cheque: c })}
                                >
                                    {t('markCleared')}
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setBouncing(c)}>
                                    {t('markBounced')}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setConfirming({ kind: 'cancel', cheque: c })}>
                                    {t('markCancelled')}
                                </Button>
                            </div>
                        )
                    }
                    if (c.status === 'bounced' && !c.replacedByPaymentId) {
                        return (
                            <div className="flex justify-end">
                                <Button size="sm" onClick={() => onReplace(c)}>
                                    {t('replace')}
                                </Button>
                            </div>
                        )
                    }
                    return null
                },
            },
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [t, tc, format, money, canManage, onReplace]
    )

    if (list.isError) {
        return (
            <EmptyState
                title={tp('loadFailed')}
                icon={TriangleAlert}
                action={
                    <Button variant="outline" onClick={() => list.refetch()}>
                        {tp('retry')}
                    </Button>
                }
            />
        )
    }

    return (
        <>
            <DataTable columns={columns} data={list.data ?? []} labels={labels} loading={list.isLoading} pageSize={25} />
            <p className="text-muted-foreground text-sm">{t('note')}</p>

            <ConfirmDialog
                open={!!confirming}
                onOpenChange={(open) => !open && setConfirming(null)}
                title={confirming ? t(`confirm.${confirming.kind}Title`, { no: confirming.cheque.no }) : ''}
                description={
                    confirming
                        ? t(`confirm.${confirming.kind}Description`, {
                              amount: money(confirming.cheque.amount),
                              supplier: confirming.cheque.supplierName,
                          })
                        : ''
                }
                confirmLabel={confirming ? t(`confirm.${confirming.kind}Action`) : ''}
                cancelLabel={tc('cancel')}
                destructive={confirming?.kind === 'cancel'}
                loading={clear.isPending || cancel.isPending}
                onConfirm={() => {
                    if (!confirming) return
                    if (confirming.kind === 'clear') clear.mutate(confirming.cheque)
                    else cancel.mutate(confirming.cheque)
                }}
            />

            <BounceDialog
                cheque={bouncing}
                pending={bounce.isPending}
                onClose={() => setBouncing(null)}
                onSubmit={(values) => bouncing && bounce.mutate({ cheque: bouncing, ...values })}
            />
        </>
    )
}
