'use client'

import { useId, useMemo, useState } from 'react'
import {
    closestCenter,
    DndContext,
    KeyboardSensor,
    MouseSensor,
    TouchSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
    type UniqueIdentifier,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
    arrayMove,
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
    type ColumnDef,
    type PaginationState,
    type Row,
    type RowSelectionState,
    type SortingState,
    type VisibilityState,
} from '@tanstack/react-table'
import {
    CheckCircle2,
    ChevronDown,
    Columns3,
    EllipsisVertical,
    GripVertical,
    Loader,
    Plus,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { TablePagination } from '@/components/shared/table-pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from '@/components/ui/drawer'
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { DocumentRow } from '@/features/dashboard/documents'
import { useDirection } from '@/hooks/use-direction'
import { useIsMobile } from '@/hooks/use-mobile'

type ColumnId = 'header' | 'type' | 'status' | 'target' | 'limit' | 'reviewer'

const SECTION_TYPES = [
    'Table of Contents',
    'Executive Summary',
    'Technical Approach',
    'Design',
    'Capabilities',
    'Focus Documents',
    'Narrative',
    'Cover Page',
]
const REVIEWERS = ['Eddie Lake', 'Jamik Tashpulatov', 'Emily Whalen']
const STATUSES = ['Done', 'In Process', 'Not Started']

const inlineInput =
    'h-8 w-16 border-transparent bg-transparent text-end shadow-none hover:bg-input/30 focus-visible:border focus-visible:bg-background dark:bg-transparent dark:hover:bg-input/30 dark:focus-visible:bg-input/30'

function DragHandle({ id, label }: { id: number; label: string }) {
    const { attributes, listeners } = useSortable({ id })

    return (
        <Button
            {...attributes}
            {...listeners}
            variant="ghost"
            size="icon"
            className="text-muted-foreground size-7 hover:bg-transparent"
        >
            <GripVertical className="text-muted-foreground size-3" />
            <span className="sr-only">{label}</span>
        </Button>
    )
}

function DraggableRow({ row }: { row: Row<DocumentRow> }) {
    const { transform, transition, setNodeRef, isDragging } = useSortable({
        id: row.original.id,
    })

    return (
        <TableRow
            data-state={row.getIsSelected() && 'selected'}
            data-dragging={isDragging}
            ref={setNodeRef}
            className="relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80"
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
            }}
        >
            {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
            ))}
        </TableRow>
    )
}

function SelectField({
    id,
    label,
    value,
    options,
    placeholder,
}: {
    id: string
    label: string
    value: string
    options: string[]
    placeholder: string
}) {
    return (
        <div className="flex flex-col gap-3">
            <Label htmlFor={id}>{label}</Label>
            <Select defaultValue={value}>
                <SelectTrigger id={id} className="w-full">
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent>
                    {options.map((option) => (
                        <SelectItem key={option} value={option}>
                            {option}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}

function TableCellViewer({ item }: { item: DocumentRow }) {
    const t = useTranslations('dashboard.documents')
    const isMobile = useIsMobile()
    const { isRtl } = useDirection()

    return (
        <Drawer
            direction={isMobile ? 'bottom' : isRtl ? 'left' : 'right'}
        >
            <DrawerTrigger asChild>
                <Button
                    variant="link"
                    className="text-foreground w-fit px-0 text-start"
                >
                    {item.header}
                </Button>
            </DrawerTrigger>
            <DrawerContent>
                <DrawerHeader className="gap-1">
                    <DrawerTitle>{item.header}</DrawerTitle>
                    <DrawerDescription>
                        {t('drawer.description')}
                    </DrawerDescription>
                </DrawerHeader>
                <div className="flex flex-col gap-4 overflow-y-auto px-4 text-sm">
                    <form className="flex flex-col gap-4">
                        <div className="flex flex-col gap-3">
                            <Label htmlFor="header">{t('columns.header')}</Label>
                            <Input id="header" defaultValue={item.header} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <SelectField
                                id="type"
                                label={t('columns.type')}
                                value={item.type}
                                options={SECTION_TYPES}
                                placeholder={t('drawer.selectType')}
                            />
                            <SelectField
                                id="status"
                                label={t('columns.status')}
                                value={item.status}
                                options={STATUSES}
                                placeholder={t('drawer.selectStatus')}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-3">
                                <Label htmlFor="target">
                                    {t('columns.target')}
                                </Label>
                                <Input id="target" defaultValue={item.target} />
                            </div>
                            <div className="flex flex-col gap-3">
                                <Label htmlFor="limit">{t('columns.limit')}</Label>
                                <Input id="limit" defaultValue={item.limit} />
                            </div>
                        </div>
                        <SelectField
                            id="reviewer"
                            label={t('columns.reviewer')}
                            value={item.reviewer}
                            options={REVIEWERS}
                            placeholder={t('drawer.selectReviewer')}
                        />
                    </form>
                </div>
                <DrawerFooter>
                    <Button>{t('drawer.submit')}</Button>
                    <DrawerClose asChild>
                        <Button variant="outline">{t('drawer.done')}</Button>
                    </DrawerClose>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    )
}

/** The dashboard-01 documents table: tabs, column toggle, drag-to-reorder, selection, pagination. */
export function DocumentsTable({ data: initialData }: { data: DocumentRow[] }) {
    const t = useTranslations('dashboard.documents')
    const tt = useTranslations('table')
    const [data, setData] = useState(() => initialData)
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
    const [sorting, setSorting] = useState<SortingState>([])
    const [pagination, setPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: 10,
    })
    const sortableId = useId()
    const sensors = useSensors(
        useSensor(MouseSensor, {}),
        useSensor(TouchSensor, {}),
        useSensor(KeyboardSensor, {})
    )

    const dataIds = useMemo<UniqueIdentifier[]>(
        () => data.map(({ id }) => id),
        [data]
    )

    const saveCell = (name: string) =>
        toast.promise(new Promise((resolve) => setTimeout(resolve, 1000)), {
            loading: t('saving', { name }),
            success: t('saved'),
            error: t('saveFailed'),
        })

    const statusLabel = (status: string) =>
        status === 'Done'
            ? t('status.done')
            : status === 'In Process'
              ? t('status.inProcess')
              : status

    const columns = useMemo<ColumnDef<DocumentRow>[]>(() => {
        const numberColumn = (key: 'target' | 'limit'): ColumnDef<DocumentRow> => ({
            accessorKey: key,
            header: () => <div className="w-full text-end">{t(`columns.${key}`)}</div>,
            cell: ({ row }) => (
                <form
                    onSubmit={(e) => {
                        e.preventDefault()
                        saveCell(row.original.header)
                    }}
                >
                    <Label htmlFor={`${row.original.id}-${key}`} className="sr-only">
                        {t(`columns.${key}`)}
                    </Label>
                    <Input
                        className={inlineInput}
                        defaultValue={row.original[key]}
                        id={`${row.original.id}-${key}`}
                    />
                </form>
            ),
        })

        return [
            {
                id: 'drag',
                header: () => null,
                cell: ({ row }) => (
                    <DragHandle id={row.original.id} label={t('dragToReorder')} />
                ),
            },
            {
                id: 'select',
                header: ({ table }) => (
                    <div className="flex items-center justify-center">
                        <Checkbox
                            checked={
                                table.getIsAllPageRowsSelected() ||
                                (table.getIsSomePageRowsSelected() && 'indeterminate')
                            }
                            onCheckedChange={(value) =>
                                table.toggleAllPageRowsSelected(!!value)
                            }
                            aria-label={t('selectAll')}
                        />
                    </div>
                ),
                cell: ({ row }) => (
                    <div className="flex items-center justify-center">
                        <Checkbox
                            checked={row.getIsSelected()}
                            onCheckedChange={(value) => row.toggleSelected(!!value)}
                            aria-label={t('selectRow')}
                        />
                    </div>
                ),
                enableSorting: false,
                enableHiding: false,
            },
            {
                accessorKey: 'header',
                header: t('columns.header'),
                cell: ({ row }) => <TableCellViewer item={row.original} />,
                enableHiding: false,
            },
            {
                accessorKey: 'type',
                header: t('columns.type'),
                cell: ({ row }) => (
                    <div className="w-32">
                        <Badge
                            variant="outline"
                            className="text-muted-foreground px-1.5"
                        >
                            {row.original.type}
                        </Badge>
                    </div>
                ),
            },
            {
                accessorKey: 'status',
                header: t('columns.status'),
                cell: ({ row }) => (
                    <Badge variant="outline" className="text-muted-foreground px-1.5">
                        {row.original.status === 'Done' ? (
                            <CheckCircle2 className="text-success" />
                        ) : (
                            <Loader />
                        )}
                        {statusLabel(row.original.status)}
                    </Badge>
                ),
            },
            numberColumn('target'),
            numberColumn('limit'),
            {
                accessorKey: 'reviewer',
                header: t('columns.reviewer'),
                cell: ({ row }) => {
                    if (row.original.reviewer !== 'Assign reviewer') {
                        return row.original.reviewer
                    }
                    return (
                        <>
                            <Label
                                htmlFor={`${row.original.id}-reviewer`}
                                className="sr-only"
                            >
                                {t('columns.reviewer')}
                            </Label>
                            <Select>
                                <SelectTrigger
                                    className="w-38 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate"
                                    size="sm"
                                    id={`${row.original.id}-reviewer`}
                                >
                                    <SelectValue placeholder={t('assignReviewer')} />
                                </SelectTrigger>
                                <SelectContent align="end">
                                    {REVIEWERS.slice(0, 2).map((name) => (
                                        <SelectItem key={name} value={name}>
                                            {name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </>
                    )
                },
            },
            {
                id: 'actions',
                cell: () => (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                className="data-[state=open]:bg-muted text-muted-foreground flex size-8"
                                size="icon"
                            >
                                <EllipsisVertical />
                                <span className="sr-only">{tt('actionsMenu')}</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-32">
                            <DropdownMenuItem>{t('menu.edit')}</DropdownMenuItem>
                            <DropdownMenuItem>{t('menu.copy')}</DropdownMenuItem>
                            <DropdownMenuItem>{t('menu.favorite')}</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive">
                                {t('menu.delete')}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ),
            },
        ]
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [t, tt])

    // eslint-disable-next-line react-hooks/incompatible-library
    const table = useReactTable({
        data,
        columns,
        state: { sorting, columnVisibility, rowSelection, pagination },
        getRowId: (row) => row.id.toString(),
        enableRowSelection: true,
        onRowSelectionChange: setRowSelection,
        onSortingChange: setSorting,
        onColumnVisibilityChange: setColumnVisibility,
        onPaginationChange: setPagination,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
    })

    const handleDragEnd = ({ active, over }: DragEndEvent) => {
        if (active && over && active.id !== over.id) {
            setData((current) =>
                arrayMove(
                    current,
                    dataIds.indexOf(active.id),
                    dataIds.indexOf(over.id)
                )
            )
        }
    }

    const tabs = [
        { value: 'outline', label: t('tabs.outline') },
        { value: 'past-performance', label: t('tabs.pastPerformance'), badge: 3 },
        { value: 'key-personnel', label: t('tabs.keyPersonnel'), badge: 2 },
        { value: 'focus-documents', label: t('tabs.focusDocuments') },
    ]

    return (
        <Tabs defaultValue="outline" className="w-full flex-col justify-start gap-6">
            <div className="flex items-center justify-between">
                <Label htmlFor="view-selector" className="sr-only">
                    {t('selectView')}
                </Label>
                <Select defaultValue="outline">
                    <SelectTrigger
                        className="flex w-fit @4xl/main:hidden"
                        size="sm"
                        id="view-selector"
                    >
                        <SelectValue placeholder={t('selectView')} />
                    </SelectTrigger>
                    <SelectContent>
                        {tabs.map((tab) => (
                            <SelectItem key={tab.value} value={tab.value}>
                                {tab.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <TabsList className="**:data-[slot=badge]:bg-muted-foreground/30 hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:px-1 @4xl/main:flex">
                    {tabs.map((tab) => (
                        <TabsTrigger key={tab.value} value={tab.value}>
                            {tab.label}
                            {tab.badge && (
                                <Badge variant="secondary">{tab.badge}</Badge>
                            )}
                        </TabsTrigger>
                    ))}
                </TabsList>
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                                <Columns3 />
                                <span className="hidden lg:inline">
                                    {t('customizeColumns')}
                                </span>
                                <span className="lg:hidden">{t('columnsShort')}</span>
                                <ChevronDown />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            {table
                                .getAllColumns()
                                .filter(
                                    (column) =>
                                        typeof column.accessorFn !== 'undefined' &&
                                        column.getCanHide()
                                )
                                .map((column) => (
                                    <DropdownMenuCheckboxItem
                                        key={column.id}
                                        checked={column.getIsVisible()}
                                        onCheckedChange={(value) =>
                                            column.toggleVisibility(!!value)
                                        }
                                    >
                                        {t(`columns.${column.id as ColumnId}`)}
                                    </DropdownMenuCheckboxItem>
                                ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="outline" size="sm">
                        <Plus />
                        <span className="hidden lg:inline">{t('addSection')}</span>
                    </Button>
                </div>
            </div>
            <TabsContent
                value="outline"
                className="relative flex flex-col gap-4 overflow-auto"
            >
                <div className="overflow-hidden rounded-lg border">
                    <DndContext
                        collisionDetection={closestCenter}
                        modifiers={[restrictToVerticalAxis]}
                        onDragEnd={handleDragEnd}
                        sensors={sensors}
                        id={sortableId}
                    >
                        <Table>
                            <TableHeader className="bg-muted sticky top-0 z-10">
                                {table.getHeaderGroups().map((headerGroup) => (
                                    <TableRow key={headerGroup.id}>
                                        {headerGroup.headers.map((header) => (
                                            <TableHead
                                                key={header.id}
                                                colSpan={header.colSpan}
                                            >
                                                {header.isPlaceholder
                                                    ? null
                                                    : flexRender(
                                                          header.column.columnDef.header,
                                                          header.getContext()
                                                      )}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableHeader>
                            <TableBody className="**:data-[slot=table-cell]:first:w-8">
                                {table.getRowModel().rows.length ? (
                                    <SortableContext
                                        items={dataIds}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        {table.getRowModel().rows.map((row) => (
                                            <DraggableRow key={row.id} row={row} />
                                        ))}
                                    </SortableContext>
                                ) : (
                                    <TableRow>
                                        <TableCell
                                            colSpan={columns.length}
                                            className="h-24 text-center"
                                        >
                                            {tt('noResults')}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </DndContext>
                </div>
                <TablePagination
                    table={table}
                    labels={{
                        rowsPerPage: tt('rowsPerPage'),
                        page: (page, total) => tt('page', { page, total }),
                        first: tt('first'),
                        previous: tt('previous'),
                        next: tt('next'),
                        last: tt('last'),
                    }}
                    summary={tt('selected', {
                        selected: table.getFilteredSelectedRowModel().rows.length,
                        total: table.getFilteredRowModel().rows.length,
                    })}
                />
            </TabsContent>
            {tabs.slice(1).map((tab) => (
                <TabsContent
                    key={tab.value}
                    value={tab.value}
                    className="flex flex-col"
                >
                    <div className="aspect-video w-full flex-1 rounded-lg border border-dashed" />
                </TabsContent>
            ))}
        </Tabs>
    )
}
