'use client'

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useQuery } from '@tanstack/react-query'
import { TriangleAlert } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { DataTable } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { BalanceText } from '@/components/suppliers/balance-text'
import { Button } from '@/components/ui/button'
import { useTableLabels } from '@/features/resource-labels'
import { listSuppliers, suppliersQueryKey, type SupplierSummary } from '@/features/suppliers'

/**
 * Shops that give on credit: what we owe each one. A row opens the shop's khata on Suppliers, and Pay Shop
 * is an ordinary supplier payment.
 */
export function ShopsTab({
    canPay,
    onOpen,
    onPay,
}: {
    canPay: boolean
    onOpen: (shop: SupplierSummary) => void
    onPay: (shop: SupplierSummary) => void
}) {
    const t = useTranslations('expenses.shops')
    const tc = useTranslations('common')
    const labels = useTableLabels()
    const list = useQuery({ queryKey: [suppliersQueryKey, { type: 'shop' }], queryFn: () => listSuppliers({ type: 'shop' }) })

    const columns = useMemo<ColumnDef<SupplierSummary>[]>(
        () => [
            {
                accessorKey: 'name',
                header: t('columns.shop'),
                cell: ({ row }) => (
                    <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{row.original.name}</span>
                        <span className="text-muted-foreground truncate text-xs">{row.original.business}</span>
                    </div>
                ),
            },
            {
                accessorKey: 'phone',
                header: t('columns.phone'),
                cell: ({ row }) => <span dir="ltr">{row.original.phone}</span>,
            },
            {
                accessorKey: 'balance',
                header: t('columns.owed'),
                meta: { className: 'text-end' },
                cell: ({ row }) => <BalanceText balance={row.original.balance} className="items-end" />,
            },
            {
                id: 'actions',
                header: () => <span className="sr-only">{tc('actions')}</span>,
                enableSorting: false,
                cell: ({ row }) =>
                    canPay && (
                        <div className="flex justify-end">
                            <Button
                                size="sm"
                                variant={row.original.balance > 0 ? 'default' : 'outline'}
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onPay(row.original)
                                }}
                            >
                                {t('pay')}
                            </Button>
                        </div>
                    ),
            },
        ],
        [t, tc, canPay, onPay]
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
            <DataTable columns={columns} data={(list.data ?? []).filter((s) => s.isActive)} labels={labels} loading={list.isLoading} pageSize={25} onRowClick={onOpen} />
            <p className="text-muted-foreground text-sm">{t('note')}</p>
        </>
    )
}
