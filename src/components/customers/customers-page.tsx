'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { useQuery } from '@tanstack/react-query'
import { Plus, TriangleAlert } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ReceiveJobSheet } from '@/components/production/receive-job-sheet'
import { ReceivePaymentSheet } from '@/components/sales/receive-payment-sheet'
import { DataTable } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard, StatCardGrid } from '@/components/shared/stat-card'
import { canCreateCustomers, canEditCustomerOpening, canEditCustomers } from '@/features/admin/roles'
import {
    customersQueryKey,
    customerTypes,
    listCustomerSummaries,
    type CustomerFilters,
    type CustomerSummary,
    type CustomerType,
} from '@/features/customers'
import { cuttingJobsQueryKey, listJobs } from '@/features/cutting-jobs'
import { useTableLabels } from '@/features/resource-labels'
import { useMoney } from '@/hooks/use-money'
import { BalanceText } from './balance-text'
import { CustomerPanel } from './customer-panel'
import { CustomerSheet } from './customer-sheet'

const ALL = 'all'
type BalanceFilter = NonNullable<CustomerFilters['balance']> | typeof ALL

/**
 * One Customers page and one khata per customer. Everyone can view; the munshi can add customers and
 * receive payments; only the owner and partner set an opening balance.
 */
export function CustomersPage({ roleKey, userName }: { roleKey: string; userName: string }) {
    const t = useTranslations('customers')
    const format = useFormatter()
    const money = useMoney()
    const labels = useTableLabels()
    const canCreate = canCreateCustomers(roleKey)
    const canEdit = canEditCustomers(roleKey)
    const canEditOpening = canEditCustomerOpening(roleKey)

    const [type, setType] = useState<CustomerType | typeof ALL>(ALL)
    const [balance, setBalance] = useState<BalanceFilter>(ALL)
    // `?open=<id>` opens a customer's khata straight away (from the Payments tab on Sales).
    const [selectedId, setSelectedId] = useState<string | null>(useSearchParams().get('open'))
    const [sheet, setSheet] = useState<'add' | 'edit' | null>(null)
    const [receive, setReceive] = useState<string | null>(null)
    const [payment, setPayment] = useState<string | null>(null)

    const filters = useMemo<CustomerFilters>(
        () => ({ ...(type !== ALL && { type }), ...(balance !== ALL && { balance }) }),
        [type, balance]
    )
    const list = useQuery({ queryKey: [customersQueryKey, 'summaries', filters], queryFn: () => listCustomerSummaries(filters) })
    // The cards and the attention strip always count everyone.
    const all = useQuery({ queryKey: [customersQueryKey, 'summaries', 'all'], queryFn: () => listCustomerSummaries() })
    const jobs = useQuery({ queryKey: [cuttingJobsQueryKey, 'all'], queryFn: () => listJobs() })

    const people = all.data ?? []
    const selected = people.find((c) => c.id === selectedId) ?? null

    // A truck received but not yet charged is still activity.
    const lastActivity = (c: CustomerSummary) =>
        [c.lastActivity, ...(jobs.data ?? []).filter((j) => j.customerId === c.id).map((j) => j.date)].sort().pop() ?? c.lastActivity

    const owing = people.filter((c) => c.balance > 0)
    const old30 = people.filter((c) => c.balance > 0 && (c.oldestUnpaidDays ?? 0) >= 30)
    const advances = people.filter((c) => c.balance < 0)
    const date = (iso: string) => format.dateTime(new Date(`${iso}T00:00:00`), { dateStyle: 'medium' })

    const columns = useMemo<ColumnDef<CustomerSummary>[]>(
        () => [
            {
                id: 'customer',
                accessorFn: (c) => `${c.name} ${c.phone} ${c.city} ${c.contactPerson}`,
                header: t('columns.customer'),
                cell: ({ row }) => (
                    <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{row.original.name}</span>
                        <span className="text-muted-foreground truncate text-xs">
                            <bdi dir="ltr">{row.original.phone}</bdi>
                            {row.original.city && ` · ${row.original.city}`}
                        </span>
                    </div>
                ),
            },
            { accessorKey: 'type', header: t('columns.type'), cell: ({ row }) => <Badge variant="outline">{t(`types.${row.original.type}`)}</Badge> },
            {
                id: 'last',
                accessorFn: (c) => lastActivity(c),
                header: t('columns.last'),
                cell: ({ row }) => date(lastActivity(row.original)),
            },
            {
                accessorKey: 'oldestUnpaidDays',
                header: t('columns.oldest'),
                meta: { className: 'text-end' },
                cell: ({ row }) =>
                    row.original.balance > 0 && row.original.oldestUnpaidDays !== null ? (
                        <span className={row.original.oldestUnpaidDays >= 30 ? 'text-destructive font-medium tabular-nums' : 'tabular-nums'}>
                            {t('days', { count: row.original.oldestUnpaidDays })}
                        </span>
                    ) : (
                        <span className="text-muted-foreground">–</span>
                    ),
            },
            {
                accessorKey: 'balance',
                header: t('columns.balance'),
                meta: { className: 'text-end' },
                cell: ({ row }) => (
                    <div className="flex flex-col items-end">
                        <BalanceText balance={row.original.balance} className="items-end" />
                        {row.original.unclearedCheques > 0 && (
                            <span className="text-muted-foreground text-xs">{t('inCheques', { amount: money(row.original.unclearedCheques) })}</span>
                        )}
                    </div>
                ),
            },
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [t, format, money, jobs.data]
    )

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title={t('title')}
                description={t('description')}
                actions={
                    canCreate && (
                        <Button onClick={() => setSheet('add')}>
                            <Plus /> {t('create')}
                        </Button>
                    )
                }
            />

            {old30.length > 0 && (
                <div className="bg-muted flex flex-wrap items-center gap-2 rounded-lg border px-4 py-2 text-sm">
                    <TriangleAlert className="text-warning size-4" />
                    <span className="font-medium">{t('attention.title')}</span>
                    {old30.map((c) => (
                        <Button key={c.id} variant="link" className="text-destructive h-auto p-0" onClick={() => setSelectedId(c.id)}>
                            {t('attention.unpaid', { name: c.name, amount: money(c.balance), days: c.oldestUnpaidDays ?? 0 })}
                        </Button>
                    ))}
                </div>
            )}

            <StatCardGrid className="@5xl/main:grid-cols-5">
                <StatCard
                    compact
                    label={t('kpi.customers')}
                    value={String(people.length)}
                    note={customerTypes.map((x) => t('kpi.byType', { count: people.filter((c) => c.type === x).length, type: t(`typesShort.${x}`) })).join(' · ')}
                />
                <StatCard
                    compact
                    label={t('kpi.udhaar')}
                    value={money(owing.reduce((s, c) => s + c.balance, 0))}
                    note={t('kpi.udhaarNote', { count: owing.length })}
                />
                <StatCard
                    compact
                    label={t('kpi.old')}
                    value={String(old30.length)}
                    note={old30.length ? money(old30.reduce((s, c) => s + c.balance, 0)) : t('kpi.none')}
                    negative={old30.length > 0}
                />
                <StatCard
                    compact
                    label={t('kpi.advances')}
                    value={money(advances.reduce((s, c) => s - c.balance, 0))}
                    note={t('kpi.advancesNote', { count: advances.length })}
                />
                <StatCard
                    compact
                    label={t('kpi.cheques')}
                    value={money(people.reduce((s, c) => s + c.unclearedCheques, 0))}
                    note={t('kpi.chequesNote')}
                />
            </StatCardGrid>

            {/* Without this a stopped server would read as "No records found". */}
            {list.isError ? (
                <EmptyState
                    title={t('loadFailed')}
                    icon={TriangleAlert}
                    action={
                        <Button variant="outline" onClick={() => list.refetch()}>
                            {t('retry')}
                        </Button>
                    }
                />
            ) : (
                <DataTable
                    columns={columns}
                    data={list.data ?? []}
                    labels={labels}
                    loading={list.isLoading}
                    pageSize={25}
                    onRowClick={(row) => setSelectedId(row.id)}
                    toolbar={
                        <div className="flex flex-wrap gap-2">
                            <Select value={type} onValueChange={(v) => setType(v as CustomerType | typeof ALL)}>
                                <SelectTrigger className="w-48">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL}>{t('allTypes')}</SelectItem>
                                    {customerTypes.map((value) => (
                                        <SelectItem key={value} value={value}>
                                            {t(`types.${value}`)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={balance} onValueChange={(v) => setBalance(v as BalanceFilter)}>
                                <SelectTrigger className="w-48">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL}>{t('balanceFilter.all')}</SelectItem>
                                    <SelectItem value="due">{t('balanceFilter.due')}</SelectItem>
                                    <SelectItem value="old30">{t('balanceFilter.old30')}</SelectItem>
                                    <SelectItem value="advance">{t('balanceFilter.advance')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    }
                />
            )}

            <CustomerPanel
                customer={selected}
                canReceive={canCreate}
                canEdit={canEdit}
                onEdit={() => setSheet('edit')}
                onReceiveTruck={() => selected && setReceive(selected.id)}
                onReceivePayment={() => selected && setPayment(selected.id)}
                onClose={() => setSelectedId(null)}
            />

            <CustomerSheet
                open={sheet !== null}
                onOpenChange={(open) => !open && setSheet(null)}
                customer={sheet === 'edit' ? (selected ?? undefined) : undefined}
                canEditOpening={canEditOpening}
            />

            <ReceivePaymentSheet
                open={payment !== null}
                onOpenChange={(open) => !open && setPayment(null)}
                userName={userName}
                preset={payment ? { customerId: payment } : undefined}
            />

            <ReceiveJobSheet open={receive !== null} onOpenChange={(open) => !open && setReceive(null)} customerId={receive ?? undefined} userName={userName} />
        </div>
    )
}
