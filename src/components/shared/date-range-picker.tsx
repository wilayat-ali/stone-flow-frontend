'use client'

import { useState } from 'react'
import { CalendarIcon, X } from 'lucide-react'
import { useFormatter } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useDirection } from '@/hooks/use-direction'
import { useIsMobile } from '@/hooks/use-mobile'
import { fromIsoDate, toIsoDate } from '@/lib/format'
import { cn } from '@/lib/utils'

export type DateRange = { from: string; to: string }

/**
 * One field for a start and end date, with a calendar popup (never the browser's own).
 * First click sets the start, second the end; the popup then closes. Values are `YYYY-MM-DD`.
 */
export function DateRangePicker({
    value,
    onChange,
    placeholder,
    clearLabel,
    className,
    ...buttonProps
}: {
    value: DateRange
    onChange: (value: DateRange) => void
    placeholder: string
    clearLabel: string
    className?: string
} & Omit<React.ComponentProps<'button'>, 'value' | 'onChange' | 'children'>) {
    const [open, setOpen] = useState(false)
    const format = useFormatter()
    const { dir } = useDirection()
    const isMobile = useIsMobile()
    const from = fromIsoDate(value.from)
    const to = fromIsoDate(value.to)
    const show = (date: Date) => format.dateTime(date, { dateStyle: 'medium' })
    const hasValue = !!from

    const pick = (day: Date) => {
        // A complete range, or none yet: start over from this day.
        if (!from || to) {
            onChange({ from: toIsoDate(day), to: '' })
            return
        }
        const [start, end] = day < from ? [day, from] : [from, day]
        onChange({ from: toIsoDate(start), to: toIsoDate(end) })
        setOpen(false)
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <div className={cn('relative', className)}>
                <PopoverTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        className={cn(
                            'border-input bg-input/30 hover:bg-input/50 w-full justify-start font-normal',
                            hasValue && 'pe-9',
                            !hasValue && 'text-muted-foreground'
                        )}
                        {...buttonProps}
                    >
                        <CalendarIcon className="text-muted-foreground" />
                        <span className="truncate">
                            {from ? (
                                <bdi>
                                    {show(from)}
                                    {to && to.getTime() !== from.getTime() && ` – ${show(to)}`}
                                </bdi>
                            ) : (
                                placeholder
                            )}
                        </span>
                    </Button>
                </PopoverTrigger>
                {hasValue && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="absolute end-1.5 top-1/2 -translate-y-1/2"
                        aria-label={clearLabel}
                        onClick={() => onChange({ from: '', to: '' })}
                    >
                        <X />
                    </Button>
                )}
            </div>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="range"
                    dir={dir}
                    numberOfMonths={isMobile ? 1 : 2}
                    selected={from ? { from, to: to ?? from } : undefined}
                    defaultMonth={from}
                    onSelect={(_, day) => pick(day)}
                />
            </PopoverContent>
        </Popover>
    )
}
