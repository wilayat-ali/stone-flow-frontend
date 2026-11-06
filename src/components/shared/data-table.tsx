'use client'

import { useState, type ReactNode } from 'react'
import {
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
    type ColumnDef,
    type SortingState,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { useFillHeight } from '@/hooks/use-fill-height'
import { EmptyState } from './empty-state'
import { TablePagination, type TablePaginationLabels } from './table-pagination'

declare module '@tanstack/react-table' {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface ColumnMeta<TData, TValue> {
        /** Extra classes for this column's header and cells, e.g. `text-end` for numbers. */
        className?: string
    }
}

export type DataTableLabels = TablePaginationLabels & {
    search: string
    noData: string
    noDataDescription: string
    rows: (count: number) => string
}

export type DataTableProps<T> = {
    columns: ColumnDef<T>[]
    data: T[]
    labels: DataTableLabels
    loading?: boolean
    pageSize?: number
    toolbar?: ReactNode
    /** Makes rows clickable (and keyboard-focusable), e.g. to open a side panel. */
    onRowClick?: (row: T) => void
    /** Fills the space left on screen: the rows scroll (header stays) and the pager stays in view, so the page does not scroll. */
    fill?: boolean
}

/** Searchable, sortable, paginated table styled like the dashboard-01 block table. */
export function DataTable<T>({
    columns,
    data,
    labels,
    loading,
    pageSize = 10,
    toolbar,
    onRowClick,
    fill,
}: DataTableProps<T>) {
    const [sorting, setSorting] = useState<SortingState>([])
    const [globalFilter, setGlobalFilter] = useState('')

    // eslint-disable-next-line react-hooks/incompatible-library
    const table = useReactTable({
        data,
        columns,
        state: { sorting, globalFilter },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageSize } },
    })

    const rows = table.getRowModel().rows
    const { blockRef, footerRef, height } = useFillHeight(!!fill)

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="relative w-full max-w-xs">
                    <Search
                        className="text-muted-foreground pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2"
                        aria-hidden
                    />
                    <Input
                        value={globalFilter}
                        onChange={(e) => setGlobalFilter(e.target.value)}
                        placeholder={labels.search}
                        className="ps-8"
                    />
                </div>
                {toolbar}
            </div>

            <div ref={blockRef} className="overflow-hidden rounded-lg border">
                <div
                    className={
                        fill
                            ? 'overflow-auto **:data-[slot=table-container]:overflow-visible'
                            : undefined
                    }
                    style={
                        fill && height ? { maxHeight: height - 2 } : undefined
                    }
                >
                    <Table>
                        <TableHeader className="bg-muted sticky top-0 z-10">
                            {table.getHeaderGroups().map((group) => (
                                <TableRow key={group.id}>
                                    {group.headers.map((header) => {
                                        const sorted =
                                            header.column.getIsSorted()
                                        const content = flexRender(
                                            header.column.columnDef.header,
                                            header.getContext()
                                        )
                                        return (
                                            <TableHead
                                                key={header.id}
                                                className={
                                                    header.column.columnDef.meta
                                                        ?.className
                                                }
                                            >
                                                {header.column.getCanSort() ? (
                                                    <button
                                                        type="button"
                                                        className="hover:text-foreground inline-flex items-center gap-1"
                                                        onClick={header.column.getToggleSortingHandler()}
                                                    >
                                                        {content}
                                                        {sorted === 'asc' ? (
                                                            <ArrowUp className="size-3.5" />
                                                        ) : sorted ===
                                                          'desc' ? (
                                                            <ArrowDown className="size-3.5" />
                                                        ) : (
                                                            <ChevronsUpDown className="text-muted-foreground size-3.5" />
                                                        )}
                                                    </button>
                                                ) : (
                                                    content
                                                )}
                                            </TableHead>
                                        )
                                    })}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        {columns.map((_, j) => (
                                            <TableCell key={j}>
                                                <Skeleton className="h-5 w-full" />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : rows.length ? (
                                rows.map((row) => (
                                    <TableRow
                                        key={row.id}
                                        className={
                                            onRowClick
                                                ? 'cursor-pointer'
                                                : undefined
                                        }
                                        tabIndex={onRowClick ? 0 : undefined}
                                        onClick={
                                            onRowClick &&
                                            (() => onRowClick(row.original))
                                        }
                                        onKeyDown={
                                            onRowClick &&
                                            ((e) => {
                                                if (e.key === 'Enter')
                                                    onRowClick(row.original)
                                            })
                                        }
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell
                                                key={cell.id}
                                                className={
                                                    cell.column.columnDef.meta
                                                        ?.className
                                                }
                                            >
                                                {flexRender(
                                                    cell.column.columnDef.cell,
                                                    cell.getContext()
                                                )}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={columns.length}>
                                        <EmptyState
                                            title={labels.noData}
                                            description={
                                                labels.noDataDescription
                                            }
                                        />
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <div ref={footerRef}>
                {table.getPageCount() > 1 ? (
                    <div>
                        <TablePagination
                            table={table}
                            labels={labels}
                            summary={labels.rows(
                                table.getFilteredRowModel().rows.length
                            )}
                        />
                    </div>
                ) : (
                    <p className="text-muted-foreground px-4 text-sm">
                        {labels.rows(table.getFilteredRowModel().rows.length)}
                    </p>
                )}
            </div>
        </div>
    )
}
