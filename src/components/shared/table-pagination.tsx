'use client'

import type { ReactNode } from 'react'
import type { Table } from '@tanstack/react-table'
import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

export type TablePaginationLabels = {
    rowsPerPage: string
    page: (page: number, total: number) => string
    first: string
    previous: string
    next: string
    last: string
}

const PAGE_SIZES = [10, 20, 30, 40, 50]

const sizesWith = (current: number) =>
    PAGE_SIZES.includes(current) ? PAGE_SIZES : [...PAGE_SIZES, current].sort((a, b) => a - b)

/** Footer from the dashboard-01 table: summary, rows per page, page x of y, 4 nav buttons. */
export function TablePagination<T>({
    table,
    labels,
    summary,
}: {
    table: Table<T>
    labels: TablePaginationLabels
    summary: ReactNode
}) {
    const { pageIndex, pageSize } = table.getState().pagination

    return (
        <div className="flex items-center justify-between px-4">
            <div className="text-muted-foreground hidden flex-1 text-sm lg:flex">
                {summary}
            </div>
            <div className="flex w-full items-center gap-8 lg:w-fit">
                <div className="hidden items-center gap-2 lg:flex">
                    <Label htmlFor="rows-per-page" className="text-sm font-medium">
                        {labels.rowsPerPage}
                    </Label>
                    <Select
                        value={`${pageSize}`}
                        onValueChange={(value) => table.setPageSize(Number(value))}
                    >
                        <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                            <SelectValue placeholder={pageSize} />
                        </SelectTrigger>
                        <SelectContent side="top">
                            {sizesWith(pageSize).map((size) => (
                                <SelectItem key={size} value={`${size}`}>
                                    {size}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex w-fit items-center justify-center text-sm font-medium">
                    {labels.page(pageIndex + 1, Math.max(table.getPageCount(), 1))}
                </div>
                <div className="ms-auto flex items-center gap-2 lg:ms-0">
                    <Button
                        variant="outline"
                        className="hidden size-8 lg:flex"
                        size="icon"
                        onClick={() => table.setPageIndex(0)}
                        disabled={!table.getCanPreviousPage()}
                    >
                        <span className="sr-only">{labels.first}</span>
                        <ChevronsLeft className="rtl:rotate-180" />
                    </Button>
                    <Button
                        variant="outline"
                        className="size-8"
                        size="icon"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        <span className="sr-only">{labels.previous}</span>
                        <ChevronLeft className="rtl:rotate-180" />
                    </Button>
                    <Button
                        variant="outline"
                        className="size-8"
                        size="icon"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        <span className="sr-only">{labels.next}</span>
                        <ChevronRight className="rtl:rotate-180" />
                    </Button>
                    <Button
                        variant="outline"
                        className="hidden size-8 lg:flex"
                        size="icon"
                        onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                        disabled={!table.getCanNextPage()}
                    >
                        <span className="sr-only">{labels.last}</span>
                        <ChevronsRight className="rtl:rotate-180" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
