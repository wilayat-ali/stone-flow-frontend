'use client'

import { useMemo, useState } from 'react'
import { MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { useForm, type FieldValues, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { ZodType } from 'zod'
import type { ColumnDef } from '@tanstack/react-table'
import {
    useMutation,
    useQuery,
    useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import { useDirection } from '@/hooks/use-direction'
import { ConfirmDialog } from './confirm-dialog'
import { DataTable, type DataTableLabels } from './data-table'
import { SelectField, TextareaField, TextField } from './form-fields'
import { PageHeader } from './page-header'

export type ResourceApi<T extends { id: string }> = {
    list: () => Promise<T[]>
    create: (values: Omit<T, 'id'>) => Promise<T>
    update: (id: string, values: Partial<Omit<T, 'id'>>) => Promise<T>
    remove: (id: string) => Promise<void>
}

export type ResourceField = {
    name: string
    label: string
    type?: 'text' | 'email' | 'textarea' | 'select'
    placeholder?: string
    options?: { value: string; label: string }[]
}

export type ResourceLabels = DataTableLabels & {
    title: string
    description: string
    create: string
    createTitle: string
    editTitle: string
    deleteTitle: string
    deleteDescription: (name: string) => string
    created: string
    updated: string
    deleted: string
    edit: string
    delete: string
    save: string
    cancel: string
    actions: string
    openMenu: string
}

export type ResourcePageProps<T extends { id: string }, V extends FieldValues> = {
    queryKey: string
    api: ResourceApi<T>
    columns: ColumnDef<T>[]
    fields: ResourceField[]
    schema: ZodType<V>
    defaultValues: V
    toFormValues: (row: T) => V
    getRowName: (row: T) => string
    labels: ResourceLabels
}

/**
 * A complete CRUD screen from config: header, searchable/sortable table,
 * create/edit side sheet and delete confirmation. Every admin module reuses it.
 */
export function ResourcePage<T extends { id: string }, V extends FieldValues>({
    queryKey,
    api,
    columns,
    fields,
    schema,
    defaultValues,
    toFormValues,
    getRowName,
    labels,
}: ResourcePageProps<T, V>) {
    const queryClient = useQueryClient()
    const { isRtl } = useDirection()
    const [editing, setEditing] = useState<T | null>(null)
    const [sheetOpen, setSheetOpen] = useState(false)
    const [deleting, setDeleting] = useState<T | null>(null)

    const { data = [], isLoading } = useQuery({
        queryKey: [queryKey],
        queryFn: api.list,
    })

    const form = useForm<V>({
        resolver: zodResolver(schema as never) as Resolver<V>,
        defaultValues: defaultValues as never,
    })

    const invalidate = () => queryClient.invalidateQueries({ queryKey: [queryKey] })

    const save = useMutation({
        mutationFn: (values: V) =>
            editing
                ? api.update(editing.id, values as Partial<Omit<T, 'id'>>)
                : api.create(values as unknown as Omit<T, 'id'>),
        onSuccess: () => {
            toast.success(editing ? labels.updated : labels.created)
            setSheetOpen(false)
            invalidate()
        },
    })

    const remove = useMutation({
        mutationFn: (id: string) => api.remove(id),
        onSuccess: () => {
            toast.success(labels.deleted)
            setDeleting(null)
            invalidate()
        },
    })

    const openCreate = () => {
        setEditing(null)
        form.reset(defaultValues as never)
        setSheetOpen(true)
    }

    const openEdit = (row: T) => {
        setEditing(row)
        form.reset(toFormValues(row) as never)
        setSheetOpen(true)
    }

    const allColumns = useMemo<ColumnDef<T>[]>(
        () => [
            ...columns,
            {
                id: 'actions',
                header: labels.actions,
                enableSorting: false,
                cell: ({ row }) => (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label={labels.openMenu}
                            >
                                <MoreHorizontal />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem
                                onClick={() => openEdit(row.original)}
                            >
                                <Pencil /> {labels.edit}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                variant="destructive"
                                onClick={() => setDeleting(row.original)}
                            >
                                <Trash2 /> {labels.delete}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ),
            },
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [columns, labels]
    )

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title={labels.title}
                description={labels.description}
                actions={
                    <Button onClick={openCreate}>
                        <Plus /> {labels.create}
                    </Button>
                }
            />

            <DataTable
                columns={allColumns}
                data={data}
                loading={isLoading}
                labels={labels}
            />

            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent side={isRtl ? 'left' : 'right'}>
                    <SheetHeader>
                        <SheetTitle>
                            {editing ? labels.editTitle : labels.createTitle}
                        </SheetTitle>
                        <SheetDescription className="sr-only">
                            {labels.description}
                        </SheetDescription>
                    </SheetHeader>
                    <Form {...form}>
                        <form
                            onSubmit={form.handleSubmit((values) =>
                                save.mutate(values)
                            )}
                            className="flex flex-1 flex-col gap-4 px-4"
                            noValidate
                        >
                            {fields.map((field) => {
                                const common = {
                                    control: form.control,
                                    name: field.name as never,
                                    label: field.label,
                                }
                                if (field.type === 'select') {
                                    return (
                                        <SelectField
                                            key={field.name}
                                            {...common}
                                            options={field.options ?? []}
                                            placeholder={field.placeholder}
                                        />
                                    )
                                }
                                if (field.type === 'textarea') {
                                    return (
                                        <TextareaField
                                            key={field.name}
                                            {...common}
                                            placeholder={field.placeholder}
                                        />
                                    )
                                }
                                return (
                                    <TextField
                                        key={field.name}
                                        {...common}
                                        type={field.type ?? 'text'}
                                        placeholder={field.placeholder}
                                    />
                                )
                            })}
                            <SheetFooter className="mt-auto px-0">
                                <Button type="submit" disabled={save.isPending}>
                                    {labels.save}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setSheetOpen(false)}
                                >
                                    {labels.cancel}
                                </Button>
                            </SheetFooter>
                        </form>
                    </Form>
                </SheetContent>
            </Sheet>

            <ConfirmDialog
                open={!!deleting}
                onOpenChange={(open) => !open && setDeleting(null)}
                title={labels.deleteTitle}
                description={deleting ? labels.deleteDescription(getRowName(deleting)) : ''}
                confirmLabel={labels.delete}
                cancelLabel={labels.cancel}
                loading={remove.isPending}
                onConfirm={() => deleting && remove.mutate(deleting.id)}
            />
        </div>
    )
}
