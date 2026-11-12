'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useQuery } from '@tanstack/react-query'
import { Plus, TriangleAlert } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { DataTable } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { BalanceText } from '@/components/suppliers/balance-text'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { factoriesQueryKey, listFactories } from '@/features/factories'
import { useTableLabels } from '@/features/resource-labels'
import { listWorkers, type WorkerFilters, type WorkerSummary } from '@/features/worker-khata'
import { effectiveRate, payTypes, workersQueryKey, type PayType } from '@/features/workers'
import { useMoney } from '@/hooks/use-money'
import { GiveLoanSheet } from './give-loan-sheet'
import { WorkerPanel } from './worker-panel'
import { WorkerSheet } from './worker-sheet'

const ALL = 'all'

/**
 * Every worker with what they earned this month, what they were paid and the balance. A row opens the khata,
 * where the worker is paid. Owner, Partner and Manager add and edit; a munshi only looks and pays.
 */
export function WorkersTab({ canEnter, canManage, onPay }: { canEnter: boolean; canManage: boolean; onPay: (worker: WorkerSummary) => void }) {
    const t = useTranslations('expenses.workers')
    const money = useMoney()
    const labels = useTableLabels()
    const [payType, setPayType] = useState<PayType | typeof ALL>(ALL)
    const [factoryId, setFactoryId] = useState(ALL)
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [sheet, setSheet] = useState<'add' | 'edit' | null>(null)
    const [loanFor, setLoanFor] = useState<string | null>(null)

    const filters = useMemo<WorkerFilters>(
        () => ({ ...(payType !== ALL && { payType }), ...(factoryId !== ALL && { factoryId }) }),
        [payType, factoryId]
    )
    const list = useQuery({ queryKey: [workersQueryKey, 'summaries', filters], queryFn: () => listWorkers(filters) })
    const factories = useQuery({ queryKey: [factoriesQueryKey], queryFn: listFactories })
    const selected = list.data?.find((w) => w.id === selectedId) ?? null

    const columns = useMemo<ColumnDef<WorkerSummary>[]>(
        () => [
            {
                accessorKey: 'name',
                header: t('columns.worker'),
                cell: ({ row }) => (
                    <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{row.original.name}</span>
                        <span className="text-muted-foreground truncate text-xs" dir="ltr">
                            {row.original.phone}
                        </span>
                    </div>
                ),
            },
            { accessorKey: 'jobTitle', header: t('columns.job') },
            {
                accessorKey: 'payType',
                header: t('columns.payType'),
                cell: ({ row }) => <Badge variant="outline">{t(`payTypes.${row.original.payType}`)}</Badge>,
            },
            {
                id: 'rate',
                header: t('columns.rate'),
                enableSorting: false,
                meta: { className: 'text-end' },
                cell: ({ row }) => {
                    const rate = effectiveRate(row.original)
                    return rate > 0 ? <span className="tabular-nums">{t(`perUnit.${row.original.payType}`, { amount: money(rate) })}</span> : <span className="text-muted-foreground">—</span>
                },
            },
            {
                accessorKey: 'monthEarned',
                header: t('columns.monthEarned'),
                meta: { className: 'text-end' },
                cell: ({ row }) => <span className="tabular-nums">{money(row.original.monthEarned)}</span>,
            },
            {
                accessorKey: 'monthPaid',
                header: t('columns.monthPaid'),
                meta: { className: 'text-end' },
                cell: ({ row }) => <span className="tabular-nums">{money(row.original.monthPaid)}</span>,
            },
            {
                accessorKey: 'balance',
                header: t('columns.balance'),
                meta: { className: 'text-end' },
                cell: ({ row }) => <BalanceText balance={row.original.balance} className="items-end" />,
            },
        ],
        [t, money]
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

    return (
        <>
            <DataTable
                columns={columns}
                data={list.data ?? []}
                labels={labels}
                loading={list.isLoading}
                pageSize={25}
                onRowClick={(row) => setSelectedId(row.id)}
                toolbar={
                    <div className="flex flex-wrap gap-2">
                        <Select value={payType} onValueChange={(v) => setPayType(v as PayType | typeof ALL)}>
                            <SelectTrigger className="w-44">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL}>{t('filters.allPayTypes')}</SelectItem>
                                {payTypes.map((p) => (
                                    <SelectItem key={p} value={p}>
                                        {t(`payTypes.${p}`)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={factoryId} onValueChange={setFactoryId}>
                            <SelectTrigger className="w-44">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL}>{t('filters.allFactories')}</SelectItem>
                                {(factories.data ?? []).map((f) => (
                                    <SelectItem key={f.id} value={f.id}>
                                        {f.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {canManage && (
                            <Button onClick={() => setSheet('add')}>
                                <Plus /> {t('add')}
                            </Button>
                        )}
                    </div>
                }
            />

            <WorkerPanel
                worker={selected}
                canManage={canManage}
                onClose={() => setSelectedId(null)}
                onEdit={canManage ? () => setSheet('edit') : undefined}
                onPay={canEnter ? onPay : undefined}
                onGiveLoan={(w) => setLoanFor(w.id)}
            />

            <GiveLoanSheet open={loanFor !== null} onOpenChange={(open) => !open && setLoanFor(null)} workerId={loanFor ?? undefined} />

            <WorkerSheet open={sheet !== null} onOpenChange={(open) => !open && setSheet(null)} worker={sheet === 'edit' ? (selected ?? undefined) : undefined} />
        </>
    )
}
