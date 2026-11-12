'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { useQuery } from '@tanstack/react-query'
import { Plus, TriangleAlert } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DataTable } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { canCreateSuppliers, canManageSuppliers } from '@/features/admin/roles'
import { useTableLabels } from '@/features/resource-labels'
import {
    listSuppliers,
    supplierTypes,
    suppliersQueryKey,
    type SupplierFilters,
    type SupplierSummary,
    type SupplierType,
} from '@/features/suppliers'
import { useMoney } from '@/hooks/use-money'
import { PaymentSheet, type PaymentPreset } from '@/components/purchases/payment-sheet'
import { BalanceText } from './balance-text'
import { SupplierPanel } from './supplier-panel'
import { SupplierSheet } from './supplier-sheet'

type BalanceFilter = NonNullable<SupplierFilters['balance']> | 'all'

/**
 * Everyone we pay, each with a khata. Owner, Partner and Manager add and edit, a Munshi can add,
 * a Viewer only looks (see `SUPPLIERS_*_ROLES`); the backend will enforce the same.
 */
export function SuppliersPage({ roleKey, userName }: { roleKey: string; userName: string }) {
    const t = useTranslations('suppliers')
    const money = useMoney()
    const labels = useTableLabels()
    const canCreate = canCreateSuppliers(roleKey)
    const canManage = canManageSuppliers(roleKey)

    const [type, setType] = useState<SupplierType | 'all'>('all')
    const [balance, setBalance] = useState<BalanceFilter>('all')
    const [selectedId, setSelectedId] = useState<string | null>(useSearchParams().get('open'))
    const [payment, setPayment] = useState<PaymentPreset | null>(null)
    const [sheet, setSheet] = useState<'add' | 'edit' | null>(null)

    const filters = useMemo<SupplierFilters>(
        () => ({ ...(type !== 'all' && { type }), ...(balance !== 'all' && { balance }) }),
        [type, balance]
    )
    const list = useQuery({ queryKey: [suppliersQueryKey, filters], queryFn: () => listSuppliers(filters) })
    const selected = list.data?.find((s) => s.id === selectedId) ?? null

    const columns = useMemo<ColumnDef<SupplierSummary>[]>(
        () => [
            {
                accessorKey: 'name',
                header: t('columns.supplier'),
                cell: ({ row }) => (
                    <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{row.original.name}</span>
                        <span className="text-muted-foreground truncate text-xs" dir="ltr">
                            {row.original.phone}
                        </span>
                    </div>
                ),
            },
            {
                accessorKey: 'type',
                header: t('columns.type'),
                cell: ({ row }) => <Badge variant="outline">{t(`types.${row.original.type}`)}</Badge>,
            },
            { accessorKey: 'city', header: t('columns.city') },
            {
                accessorKey: 'balance',
                header: t('columns.balance'),
                meta: { className: 'text-end' },
                cell: ({ row }) => <BalanceText balance={row.original.balance} className="items-end" />,
            },
            {
                accessorKey: 'unclearedCheques',
                header: t('columns.uncleared'),
                meta: { className: 'text-end' },
                cell: ({ row }) =>
                    row.original.unclearedCheques ? (
                        <bdi className="tabular-nums">{money(row.original.unclearedCheques)}</bdi>
                    ) : (
                        <span className="text-muted-foreground">–</span>
                    ),
            },
        ],
        [t, money]
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
                            <Select value={type} onValueChange={(value) => setType(value as SupplierType | 'all')}>
                                <SelectTrigger className="w-44">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">{t('allTypes')}</SelectItem>
                                    {supplierTypes.map((value) => (
                                        <SelectItem key={value} value={value}>
                                            {t(`types.${value}`)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={balance} onValueChange={(value) => setBalance(value as BalanceFilter)}>
                                <SelectTrigger className="w-44">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">{t('balanceFilter.all')}</SelectItem>
                                    <SelectItem value="owe">{t('balanceFilter.owe')}</SelectItem>
                                    <SelectItem value="advance">{t('balanceFilter.advance')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    }
                />
            )}

            <SupplierPanel
                supplier={selected}
                onClose={() => setSelectedId(null)}
                onEdit={canManage ? () => setSheet('edit') : undefined}
                onPay={
                    canCreate
                        ? (supplier) => setPayment({ supplierId: supplier.id, amount: Math.max(0, supplier.balance) })
                        : undefined
                }
            />

            <PaymentSheet
                open={payment !== null}
                onOpenChange={(open) => !open && setPayment(null)}
                roleKey={roleKey}
                userName={userName}
                preset={payment ?? undefined}
            />

            <SupplierSheet
                open={sheet !== null}
                onOpenChange={(open) => !open && setSheet(null)}
                supplier={sheet === 'edit' ? (selected ?? undefined) : undefined}
            />
        </div>
    )
}
