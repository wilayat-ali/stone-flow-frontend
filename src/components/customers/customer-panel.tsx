'use client'

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useQuery } from '@tanstack/react-query'
import { MessageCircle, Pencil, Plus, Truck, Wallet } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { DataTable } from '@/components/shared/data-table'
import { StatCard } from '@/components/shared/stat-card'
import { StatusBadge } from '@/components/shared/status-badge'
import {
    customerKhata,
    customerKhataQueryKey,
    whatsappLink,
    type CustomerSummary,
} from '@/features/customers'
import { cuttingJobsQueryKey, listJobs } from '@/features/cutting-jobs'
import { useTableLabels } from '@/features/resource-labels'
import { useDirection } from '@/hooks/use-direction'
import { useMoney } from '@/hooks/use-money'
import { BalanceText } from './balance-text'

/** One customer's khata: totals, what is open, every row with a running balance, and what to do next. */
export function CustomerPanel({
    customer,
    canReceive,
    canEdit,
    onEdit,
    onReceiveTruck,
    onReceivePayment,
    onClose,
}: {
    customer: CustomerSummary | null
    /** Receive a payment, make a bill, receive a cutting truck. */
    canReceive: boolean
    canEdit: boolean
    onEdit: () => void
    onReceiveTruck: () => void
    onReceivePayment: () => void
    onClose: () => void
}) {
    const t = useTranslations('customers')
    const format = useFormatter()
    const money = useMoney()
    const labels = useTableLabels()
    const { isRtl } = useDirection()

    const khata = useQuery({
        queryKey: [customerKhataQueryKey, customer?.id],
        queryFn: () => customerKhata(customer!.id),
        enabled: !!customer,
    })
    const jobs = useQuery({
        queryKey: [cuttingJobsQueryKey, 'customer', customer?.id],
        queryFn: () => listJobs({ customerId: customer!.id }),
        enabled: !!customer,
    })
    const date = (iso: string) => format.dateTime(new Date(`${iso}T00:00:00`), { dateStyle: 'medium' })
    const openJobs = (jobs.data ?? []).filter((j) => j.status === 'received' || j.status === 'cutting' || j.status === 'ready')

    const columns = useMemo<ColumnDef<NonNullable<typeof khata.data>[number]>[]>(
        () => [
            { accessorKey: 'date', header: t('khata.date'), enableSorting: false, cell: ({ row }) => date(row.original.date) },
            { accessorKey: 'detail', header: t('khata.detail'), enableSorting: false },
            {
                id: 'amount',
                header: t('khata.amount'),
                enableSorting: false,
                meta: { className: 'text-end' },
                cell: ({ row }) => (
                    <span className={row.original.kind === 'charge' ? 'text-destructive tabular-nums' : 'text-success tabular-nums'}>
                        {row.original.kind === 'charge' ? '+' : '−'} {money(row.original.amount)}
                    </span>
                ),
            },
            {
                accessorKey: 'balance',
                header: t('khata.balance'),
                enableSorting: false,
                meta: { className: 'text-end' },
                cell: ({ row }) => <BalanceText balance={row.original.balance} className="items-end" />,
            },
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [t, format, money]
    )

    const c = customer
    const owing = !!c && c.balance > 0
    const oldest = c?.oldestUnpaidDays ?? null

    return (
        <Sheet open={!!c} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side={isRtl ? 'left' : 'right'} className="w-full overflow-y-auto sm:max-w-xl">
                {c && (
                    <>
                        <SheetHeader>
                            <SheetTitle className="flex items-center gap-2">
                                {c.name} <Badge variant="outline">{t(`types.${c.type}`)}</Badge>
                            </SheetTitle>
                            <SheetDescription>
                                <bdi dir="ltr">{c.phone}</bdi>
                                {c.city && ` · ${c.city}`}
                                {c.contactPerson && ` · ${c.contactPerson}`}
                            </SheetDescription>
                        </SheetHeader>
                        <div className="flex flex-col gap-4 px-4 pb-4">
                            <div className="grid grid-cols-3 gap-2">
                                <StatCard compact label={t('panel.totalBusiness')} value={money(c.totalBusiness)} />
                                <StatCard
                                    compact
                                    label={t('panel.received')}
                                    value={money(c.received)}
                                    note={c.unclearedCheques ? t('panel.unclearedNote', { amount: money(c.unclearedCheques) }) : undefined}
                                />
                                <StatCard
                                    compact
                                    label={c.balance < 0 ? t('advance') : t('panel.balance')}
                                    value={money(Math.abs(c.balance))}
                                    negative={owing}
                                    note={owing && oldest !== null ? t('panel.oldest', { days: oldest }) : undefined}
                                />
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {canReceive && (
                                    <Button onClick={onReceivePayment}>
                                        <Wallet /> {t('receivePayment')}
                                    </Button>
                                )}
                                {canReceive && (
                                    <Button variant="outline" onClick={() => toast.info(t('billSoon'))}>
                                        <Plus /> {t('newBill')}
                                    </Button>
                                )}
                                {owing && (
                                    <Button variant="outline" asChild>
                                        <a
                                            href={whatsappLink(
                                                c.phone,
                                                t('reminderMessage', { name: c.name, amount: money(c.balance), days: oldest ?? 0 })
                                            )}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <MessageCircle /> {t('reminder')}
                                        </a>
                                    </Button>
                                )}
                                {canReceive && c.type === 'cutting' && (
                                    <Button variant="outline" onClick={onReceiveTruck}>
                                        <Truck /> {t('receiveTruck')}
                                    </Button>
                                )}
                                {canEdit && (
                                    <Button variant="outline" onClick={onEdit}>
                                        <Pencil /> {t('edit')}
                                    </Button>
                                )}
                            </div>

                            {openJobs.length > 0 && (
                                <div>
                                    <h3 className="mb-2 text-sm font-medium">{t('panel.open')}</h3>
                                    <ul className="flex flex-col gap-1 text-sm">
                                        {openJobs.map((j) => (
                                            <li key={j.id} className="flex flex-wrap items-center gap-2">
                                                <span className="bg-info/15 text-info rounded px-1.5 py-0.5 text-xs font-semibold" dir="ltr">
                                                    {j.truckNo}
                                                </span>
                                                <span>{t('panel.cuttingTruck')}</span>
                                                <StatusBadge tone={j.status === 'ready' ? 'success' : j.status === 'cutting' ? 'info' : 'warning'}>
                                                    {t(`jobStatuses.${j.status}`)}
                                                </StatusBadge>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div>
                                <h3 className="mb-2 text-sm font-medium">{t('khata.title')}</h3>
                                {khata.isLoading ? (
                                    <Skeleton className="h-32 w-full" />
                                ) : khata.isError ? (
                                    <p className="text-muted-foreground text-sm">{t('khata.loadFailed')}</p>
                                ) : (
                                    <DataTable columns={columns} data={[...(khata.data ?? [])].reverse()} labels={labels} pageSize={10} />
                                )}
                            </div>
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>
    )
}
