'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useFormatter, useTranslations } from 'next-intl'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { DataTable } from '@/components/shared/data-table'
import {
    DateRangePicker,
    type DateRange,
} from '@/components/shared/date-range-picker'
import { useTableLabels } from '@/features/resource-labels'
import { formatLakh } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { StatementRow } from '@/features/bank-cash/ledger'

type Flow = 'all' | 'in' | 'out'

const amount = (value: number, tone: string) =>
    value ? (
        <bdi className={cn('tabular-nums', tone)}>{formatLakh(value)}</bdi>
    ) : (
        <span className="text-muted-foreground">–</span>
    )

/** One account's statement: one filter row, one table, newest first, 25 per page. */
export function StatementTable({
    rows,
    onRowClick,
}: {
    /** Oldest first, as `statementOf` returns them. */
    rows: StatementRow[]
    onRowClick: (row: StatementRow) => void
}) {
    const t = useTranslations('settings.bankCash')
    const format = useFormatter()
    const labels = useTableLabels()
    const [flow, setFlow] = useState<Flow>('all')
    const [range, setRange] = useState<DateRange>({ from: '', to: '' })

    const visible = useMemo(
        () =>
            rows
                .filter(
                    (row) =>
                        (flow === 'all' ||
                            (flow === 'in' ? row.in > 0 : row.out > 0)) &&
                        (!range.from || row.date >= range.from) &&
                        (!range.to || row.date <= range.to)
                )
                .reverse(),
        [rows, flow, range]
    )

    const columns = useMemo<ColumnDef<StatementRow>[]>(
        () => [
            {
                accessorKey: 'date',
                header: t('date'),
                enableSorting: false,
                cell: ({ row }) =>
                    format.dateTime(new Date(`${row.original.date}T00:00:00`), {
                        dateStyle: 'medium',
                    }),
            },
            {
                id: 'detail',
                header: t('detail'),
                enableSorting: false,
                accessorFn: (row) =>
                    `${t(`types.${row.type}`)} ${row.note ?? ''} ${row.refNo ?? ''}`,
                cell: ({ row }) => (
                    <div className="flex flex-col">
                        <span
                            className={cn(
                                'font-medium',
                                row.original.type === 'opening' &&
                                    'text-muted-foreground'
                            )}
                        >
                            {t(`types.${row.original.type}`)}
                        </span>
                        {(row.original.note || row.original.refNo) && (
                            <span className="text-muted-foreground text-xs">
                                {[row.original.refNo, row.original.note]
                                    .filter(Boolean)
                                    .join(' · ')}
                            </span>
                        )}
                    </div>
                ),
            },
            {
                accessorKey: 'in',
                header: t('in'),
                meta: { className: 'text-end' },
                enableSorting: false,
                cell: ({ row }) => amount(row.original.in, 'text-success'),
            },
            {
                accessorKey: 'out',
                header: t('out'),
                meta: { className: 'text-end' },
                enableSorting: false,
                cell: ({ row }) => amount(row.original.out, 'text-destructive'),
            },
            {
                accessorKey: 'balance',
                header: t('balance'),
                meta: { className: 'text-end' },
                enableSorting: false,
                cell: ({ row }) => (
                    <bdi className="font-medium tabular-nums">
                        {formatLakh(row.original.balance)}
                    </bdi>
                ),
            },
        ],
        [t, format]
    )

    const toolbar = (
        <div className="flex flex-wrap items-center gap-2">
            <Select
                value={flow}
                onValueChange={(value) => setFlow(value as Flow)}
            >
                <SelectTrigger className="w-40" aria-label={t('flow')}>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">{t('allEntries')}</SelectItem>
                    <SelectItem value="in">{t('moneyIn')}</SelectItem>
                    <SelectItem value="out">{t('moneyOut')}</SelectItem>
                </SelectContent>
            </Select>
            <DateRangePicker
                value={range}
                onChange={setRange}
                placeholder={t('dateRange')}
                aria-label={t('dateRange')}
                clearLabel={t('clear')}
                className="w-64"
            />
        </div>
    )

    return (
        <DataTable
            columns={columns}
            data={visible}
            labels={labels}
            pageSize={25}
            toolbar={toolbar}
            onRowClick={onRowClick}
            fill
        />
    )
}
