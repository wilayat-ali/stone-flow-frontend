'use client'

import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import type { FieldValues, SubmitHandler, UseFormReturn } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import { useDirection } from '@/hooks/use-direction'

/** A side sheet around a react-hook-form form: title, fields, optional summary, submit and cancel. */
export function FormSheet<V extends FieldValues>({
    open,
    onOpenChange,
    title,
    description,
    form,
    onSubmit,
    submitLabel,
    cancelLabel,
    pending,
    submitDisabled,
    summary,
    children,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    description?: string
    form: UseFormReturn<V>
    onSubmit: SubmitHandler<V>
    submitLabel: string
    cancelLabel: string
    pending?: boolean
    submitDisabled?: boolean
    /** Plain-language line shown above the buttons, e.g. what is about to happen. */
    summary?: ReactNode
    children: ReactNode
}) {
    const { isRtl } = useDirection()

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side={isRtl ? 'left' : 'right'}>
                <SheetHeader>
                    <SheetTitle>{title}</SheetTitle>
                    <SheetDescription className={description ? undefined : 'sr-only'}>
                        {description ?? title}
                    </SheetDescription>
                </SheetHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col" noValidate>
                        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
                            {children}
                            {summary && <div className="bg-muted text-muted-foreground rounded-md p-3 text-sm">{summary}</div>}
                        </div>
                        <SheetFooter className="border-t">
                            <Button type="submit" disabled={pending || submitDisabled}>
                                {pending && <Loader2 className="animate-spin" />}
                                {submitLabel}
                            </Button>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                {cancelLabel}
                            </Button>
                        </SheetFooter>
                    </form>
                </Form>
            </SheetContent>
        </Sheet>
    )
}
