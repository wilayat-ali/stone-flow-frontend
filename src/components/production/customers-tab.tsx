'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useQuery } from '@tanstack/react-query'
import { Plus, TriangleAlert, Wallet } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { DataTable } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { StatCard } from '@/components/shared/stat-card'
import { StatusBadge, type StatusTone } from '@/components/shared/status-badge'
import {
    customerKhata,
    customerKhataQueryKey,
    customersQueryKey,
    customerTotals,
    listCustomers,
    type Customer,
} from '@/features/customers'
import { chargeOf, cuttingJobsQueryKey, listJobs, type CuttingJob, type JobStatus } from '@/features/cutting-jobs'
import { useTableLabels } from '@/features/resource-labels'
import { useDirection } from '@/hooks/use-direction'
import { useMoney } from '@/hooks/use-money'

const tone: Record<JobStatus, StatusTone> = {
    received: 'warning',
    cutting: 'info',
    ready: 'success',
    delivered: 'neutral',
    cancelled: 'neutral',
}

type Row = {
    customer: Customer
    trucks: number
    open: number
    last: string
    charged: number
    received: number
    balance: number
}

/** Balance as owed (red) or advance (green). */
function Balance({ value }: { value: number }) {
    const t = useTranslations('production.customers')
    const money = useMoney()
    if (value === 0) return <span className="text-muted-foreground">{t('settled')}</span>
    return (
        <span className="flex flex-col items-end tabular-nums">
            <span className={value > 0 ? 'text-destructive font-medium' : 'text-success font-medium'}>{money(Math.abs(value))}</span>
            <span className="text-muted-foreground text-xs">{value > 0 ? t('owes') : t('advance')}</span>
        </span>
    )
}

/** Customers whose own stone we cut for a fee: trucks, what they owe, and their khata in a side panel. */
export function CustomersTab({
    canOperate,
    onReceive,
    onReceivePayment,
}: {
    canOperate: boolean
    /** Receive a truck, from this customer when given. */
    onReceive: (customerId?: string) => void
    /** Take money from this customer. */
    onReceivePayment: (customerId: string) => void
}) {
    const t = useTranslations('production.customers')
    const format = useFormatter()
    const money = useMoney()
    const labels = useTableLabels()
    const { isRtl } = useDirection()
    const [openId, setOpenId] = useState<string | null>(null)

    const customers = useQuery({ queryKey: [customersQueryKey], queryFn: listCustomers })
    const jobs = useQuery({ queryKey: [cuttingJobsQueryKey, 'all'], queryFn: () => listJobs() })

    const rows = useMemo<Row[]>(() => {
        const all = jobs.data ?? []
        return (customers.data ?? [])
            .filter((c) => c.type === 'cutting' || all.some((j) => j.customerId === c.id))
            .map((customer) => {
                const own = all.filter((j) => j.customerId === customer.id && j.status !== 'cancelled')
                return {
                    customer,
                    trucks: own.length,
                    open: own.filter((j) => j.status !== 'delivered').length,
                    last: own.map((j) => j.date).sort().pop() ?? '',
                    ...customerTotals(customer.id),
                }
            })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [customers.data, jobs.data, jobs.dataUpdatedAt])

    const opened = rows.find((r) => r.customer.id === openId) ?? null
    const date = (iso: string) => format.dateTime(new Date(`${iso}T00:00:00`), { dateStyle: 'medium' })

    const columns = useMemo<ColumnDef<Row>[]>(
        () => [
            {
                id: 'customer',
                accessorFn: (r) => `${r.customer.name} ${r.customer.phone}`,
                header: t('columns.customer'),
                cell: ({ row }) => (
                    <div className="flex flex-col">
                        <span className="font-medium">{row.original.customer.name}</span>
                        <span className="text-muted-foreground text-xs" dir="ltr">
                            {row.original.customer.phone}
                        </span>
                    </div>
                ),
            },
            {
                accessorKey: 'trucks',
                header: t('columns.trucks'),
                meta: { className: 'text-end' },
                cell: ({ row }) => (
                    <div className="flex flex-col tabular-nums">
                        <span>{row.original.trucks}</span>
                        {row.original.open > 0 && <span className="text-muted-foreground text-xs">{t('open', { count: row.original.open })}</span>}
                    </div>
                ),
            },
            { accessorKey: 'last', header: t('columns.last'), cell: ({ row }) => (row.original.last ? date(row.original.last) : '–') },
            {
                accessorKey: 'charged',
                header: t('columns.charged'),
                meta: { className: 'text-end' },
                cell: ({ row }) => <span className="tabular-nums">{money(row.original.charged)}</span>,
            },
            {
                accessorKey: 'received',
                header: t('columns.received'),
                meta: { className: 'text-end' },
                cell: ({ row }) => <span className="tabular-nums">{money(row.original.received)}</span>,
            },
            {
                accessorKey: 'balance',
                header: t('columns.balance'),
                meta: { className: 'text-end' },
                cell: ({ row }) => <Balance value={row.original.balance} />,
            },
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [t, format, money]
    )

    if (customers.isError || jobs.isError) {
        return (
            <EmptyState
                title={t('loadFailed')}
                icon={TriangleAlert}
                action={
                    <Button variant="outline" onClick={() => { customers.refetch(); jobs.refetch() }}>
                        {t('retry')}
                    </Button>
                }
            />
        )
    }

    return (
        <>
            <DataTable
                columns={columns}
                data={rows}
                labels={labels}
                loading={customers.isLoading || jobs.isLoading}
                pageSize={25}
                onRowClick={(row) => setOpenId(row.customer.id)}
            />
            <p className="text-muted-foreground text-sm">{t('note')}</p>

            <Sheet open={!!opened} onOpenChange={(open) => !open && setOpenId(null)}>
                <SheetContent side={isRtl ? 'left' : 'right'} className="w-full overflow-y-auto sm:max-w-xl">
                    {opened && (
                        <Panel
                            row={opened}
                            jobs={(jobs.data ?? []).filter((j) => j.customerId === opened.customer.id)}
                            canOperate={canOperate}
                            onReceive={() => onReceive(opened.customer.id)}
                            onReceivePayment={() => onReceivePayment(opened.customer.id)}
                        />
                    )}
                </SheetContent>
            </Sheet>
        </>
    )
}

function Panel({ row, jobs, canOperate, onReceive, onReceivePayment }: { row: Row; jobs: CuttingJob[]; canOperate: boolean; onReceive: () => void; onReceivePayment: () => void }) {
    const t = useTranslations('production.customers')
    const format = useFormatter()
    const money = useMoney()
    const labels = useTableLabels()
    const khata = useQuery({ queryKey: [customerKhataQueryKey, row.customer.id], queryFn: () => customerKhata(row.customer.id) })
    const date = (iso: string) => format.dateTime(new Date(`${iso}T00:00:00`), { dateStyle: 'medium' })

    const truckColumns = useMemo<ColumnDef<CuttingJob>[]>(
        () => [
            {
                accessorKey: 'truckNo',
                header: t('panel.truck'),
                cell: ({ row: r }) => (
                    <div className="flex flex-col">
                        <span className="font-medium">{r.original.truckNo}</span>
                        <span className="text-muted-foreground text-xs">{date(r.original.date)}</span>
                    </div>
                ),
            },
            {
                accessorKey: 'material',
                header: t('panel.stone'),
                cell: ({ row: r }) => (
                    <div className="flex flex-col">
                        <span>{r.original.material}</span>
                        <span className="text-muted-foreground text-xs">{r.original.tons} t</span>
                    </div>
                ),
            },
            { accessorKey: 'status', header: t('panel.status'), cell: ({ row: r }) => <StatusBadge tone={tone[r.original.status]}>{t(`statuses.${r.original.status}`)}</StatusBadge> },
            {
                id: 'charge',
                header: t('panel.charge'),
                meta: { className: 'text-end' },
                cell: ({ row: r }) =>
                    r.original.sqft ? (
                        <div className="flex flex-col tabular-nums">
                            <span>{money(chargeOf(r.original))}</span>
                            <span className="text-muted-foreground text-xs">{r.original.sqft} {t('sqft')}</span>
                        </div>
                    ) : (
                        <span className="text-muted-foreground text-xs">{t('perSqft', { rate: r.original.ratePerSqft })}</span>
                    ),
            },
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [t, format, money]
    )

    const khataColumns = useMemo<ColumnDef<NonNullable<typeof khata.data>[number]>[]>(
        () => [
            { accessorKey: 'date', header: t('panel.date'), enableSorting: false, cell: ({ row: r }) => date(r.original.date) },
            { accessorKey: 'detail', header: t('panel.detail'), enableSorting: false },
            {
                id: 'amount',
                header: t('panel.amount'),
                enableSorting: false,
                meta: { className: 'text-end' },
                cell: ({ row: r }) => (
                    <span className={r.original.kind === 'charge' ? 'text-destructive tabular-nums' : 'text-success tabular-nums'}>
                        {r.original.kind === 'charge' ? '+' : '−'} {money(r.original.amount)}
                    </span>
                ),
            },
            {
                accessorKey: 'balance',
                header: t('panel.balance'),
                enableSorting: false,
                meta: { className: 'text-end' },
                cell: ({ row: r }) => <Balance value={r.original.balance} />,
            },
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [t, format, money]
    )

    return (
        <>
            <SheetHeader>
                <SheetTitle>{row.customer.name}</SheetTitle>
                <SheetDescription>
                    <bdi dir="ltr">{row.customer.phone}</bdi>
                    {row.customer.city && ` · ${row.customer.city}`} · {t('cuttingCustomer')}
                </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-4 px-4 pb-4">
                <div className="grid grid-cols-3 gap-2">
                    <StatCard compact label={t('panel.charged')} value={money(row.charged)} />
                    <StatCard compact label={t('panel.received')} value={money(row.received)} />
                    <StatCard compact label={row.balance < 0 ? t('advance') : t('panel.balanceDue')} value={money(Math.abs(row.balance))} negative={row.balance > 0} />
                </div>

                <div className="flex flex-wrap gap-2">
                    {canOperate && (
                        <Button variant="outline" onClick={onReceivePayment}>
                            <Wallet /> {t('receivePayment')}
                        </Button>
                    )}
                    {canOperate && (
                        <Button onClick={onReceive}>
                            <Plus /> {t('receiveTruck')}
                        </Button>
                    )}
                </div>

                <h3 className="text-sm font-medium">{t('panel.trucks')}</h3>
                <DataTable columns={truckColumns} data={jobs} labels={labels} pageSize={10} />

                <h3 className="text-sm font-medium">{t('panel.khata')}</h3>
                {khata.isLoading ? (
                    <Skeleton className="h-32 w-full" />
                ) : (
                    <DataTable columns={khataColumns} data={[...(khata.data ?? [])].reverse()} labels={labels} pageSize={10} />
                )}
            </div>
        </>
    )
}
