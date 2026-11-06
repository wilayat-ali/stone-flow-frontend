'use client'

import { useState } from 'react'
import { CalendarIcon, X } from 'lucide-react'
import { useFormatter } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useDirection } from '@/hooks/use-direction'
import { fromIsoDate, toIsoDate } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * A themed date field with a calendar popup (never the browser's own).
 * Values are `YYYY-MM-DD` strings; an empty string means no date.
 */
export function DatePicker({
    value,
    onChange,
    placeholder,
    min,
    max,
    clearLabel,
    invalid,
    className,
    ...buttonProps
}: {
    value: string
    onChange: (value: string) => void
    placeholder: string
    min?: string
    max?: string
    /** Adds a clear button when there is a value. */
    clearLabel?: string
    invalid?: boolean
    className?: string
} & Omit<React.ComponentProps<'button'>, 'value' | 'onChange' | 'children'>) {
    const [open, setOpen] = useState(false)
    const format = useFormatter()
    const { dir } = useDirection()
    const selected = fromIsoDate(value)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <div className={cn('relative', className)}>
                <PopoverTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        aria-invalid={invalid}
                        className={cn(
                            'border-input bg-input/30 hover:bg-input/50 w-full justify-start font-normal',
                            clearLabel && value && 'pe-9',
                            !selected && 'text-muted-foreground'
                        )}
                        {...buttonProps}
                    >
                        <CalendarIcon className="text-muted-foreground" />
                        <span className="truncate">
                            {selected ? format.dateTime(selected, { dateStyle: 'medium' }) : placeholder}
                        </span>
                    </Button>
                </PopoverTrigger>
                {clearLabel && value && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="absolute end-1.5 top-1/2 -translate-y-1/2"
                        aria-label={clearLabel}
                        onClick={() => onChange('')}
                    >
                        <X />
                    </Button>
                )}
            </div>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    dir={dir}
                    selected={selected}
                    defaultMonth={selected}
                    onSelect={(date) => {
                        if (!date) return
                        onChange(toIsoDate(date))
                        setOpen(false)
                    }}
                    disabled={[
                        ...(min ? [{ before: fromIsoDate(min) as Date }] : []),
                        ...(max ? [{ after: fromIsoDate(max) as Date }] : []),
                    ]}
                />
            </PopoverContent>
        </Popover>
    )
}
