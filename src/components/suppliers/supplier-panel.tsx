'use client'

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useQuery } from '@tanstack/react-query'
import { Pencil, Wallet } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { DataTable } from '@/components/shared/data-table'
import { StatCard } from '@/components/shared/stat-card'
import { getKhata, khataQueryKey, type KhataRow, type SupplierSummary } from '@/features/suppliers'
import { useTableLabels } from '@/features/resource-labels'
import { useDirection } from '@/hooks/use-direction'
import { useMoney } from '@/hooks/use-money'
import { BalanceText } from './balance-text'

/** Side panel for one supplier: details, the three totals, and the khata with a running balance. */
export function SupplierPanel({
    supplier,
    onClose,
    onEdit,
    onPay,
}: {
    supplier: SupplierSummary | null
    onClose: () => void
    /** Omit to hide Edit (a viewer only looks). */
    onEdit?: (supplier: SupplierSummary) => void
    /** Omit to hide Record Payment. */
    onPay?: (supplier: SupplierSummary) => void
}) {
    const t = useTranslations('suppliers')
    const format = useFormatter()
    const money = useMoney()
    const labels = useTableLabels()
    const { isRtl } = useDirection()

    const khata = useQuery({
        queryKey: [khataQueryKey, supplier?.id],
        queryFn: () => getKhata(supplier!.id),
        enabled: !!supplier,
    })

    const columns = useMemo<ColumnDef<KhataRow>[]>(
        () => [
            {
                accessorKey: 'date',
                header: t('khata.date'),
                enableSorting: false,
                cell: ({ row }) =>
                    format.dateTime(new Date(`${row.original.date}T00:00:00`), { dateStyle: 'medium' }),
            },
            {
                accessorKey: 'detail',
                header: t('khata.detail'),
                enableSorting: false,
                cell: ({ row }) => (
                    <div className="flex flex-col">
                        <span>{row.original.detail === 'opening' ? t('khata.opening') : row.original.detail}</span>
                        {row.original.unclearedCheque && (
                            <span className="text-muted-foreground text-xs">{t('khata.uncleared')}</span>
                        )}
                    </div>
                ),
            },
            {
                id: 'amount',
                header: t('khata.amount'),
                enableSorting: false,
                meta: { className: 'text-end' },
                cell: ({ row }) => (
                    <bdi
                        className={
                            row.original.kind === 'charge' ? 'text-destructive tabular-nums' : 'text-success tabular-nums'
                        }
                    >
                        {row.original.kind === 'charge' ? '+' : '−'} {money(row.original.amount)}
                    </bdi>
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
        [t, format, money]
    )

    // Newest first, like the Cash & Bank statement.
    const rows = useMemo(() => [...(khata.data ?? [])].reverse(), [khata.data])

    return (
        <Sheet open={!!supplier} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side={isRtl ? 'left' : 'right'} className="w-full overflow-y-auto sm:max-w-2xl">
                {supplier && (
                    <>
                        <SheetHeader>
                            <SheetTitle>{supplier.name}</SheetTitle>
                            <SheetDescription>
                                {t(`types.${supplier.type}`)} · {supplier.business ? `${supplier.business} · ` : ''}
                                {supplier.city} · <bdi dir="ltr">{supplier.phone}</bdi>
                                {supplier.cuttingRatePerTon != null &&
                                    ` · ${t('perTon', { amount: money(supplier.cuttingRatePerTon) })}`}
                            </SheetDescription>
                        </SheetHeader>

                        <div className="flex flex-col gap-4 px-4 pb-4">
                            <div className="grid grid-cols-3 gap-2">
                                <StatCard compact label={t('totals.charged')} value={money(supplier.charged)} />
                                <StatCard compact label={t('totals.paid')} value={money(supplier.paid)} />
                                <StatCard
                                    compact
                                    label={supplier.balance < 0 ? t('totals.advance') : t('totals.balance')}
                                    value={money(Math.abs(supplier.balance))}
                                    negative={supplier.balance > 0}
                                    note={
                                        supplier.unclearedCheques
                                            ? t('unclearedNote', { amount: money(supplier.unclearedCheques) })
                                            : undefined
                                    }
                                />
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {onPay && (
                                    <Button onClick={() => onPay(supplier)}>
                                        <Wallet /> {t('recordPayment')}
                                    </Button>
                                )}
                                {onEdit && (
                                    <Button variant="outline" onClick={() => onEdit(supplier)}>
                                        <Pencil /> {t('edit')}
                                    </Button>
                                )}
                            </div>

                            <h3 className="text-sm font-medium">{t('khata.title')}</h3>
                            {khata.isError ? (
                                <p className="text-muted-foreground text-sm">{t('khata.loadFailed')}</p>
                            ) : khata.isLoading ? (
                                <Skeleton className="h-40 w-full" />
                            ) : (
                                <DataTable columns={columns} data={rows} labels={labels} pageSize={25} />
                            )}
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>
    )
}
