'use client'

import type { Control, FieldPath, FieldValues } from 'react-hook-form'
import { FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { cn } from '@/lib/utils'

/** A form field shown as big tiles to tap instead of a dropdown, for a short list the user picks from often. */
export function TileField<T extends FieldValues>({
    control,
    name,
    label,
    options,
    columns = 3,
    className,
}: {
    control: Control<T>
    name: FieldPath<T>
    label: string
    options: { value: string; label: string }[]
    columns?: 2 | 3
    className?: string
}) {
    return (
        <FormField
            control={control}
            name={name}
            render={({ field }) => (
                <FormItem className={className}>
                    <FormLabel>{label}</FormLabel>
                    <div className={cn('grid gap-2', columns === 2 ? 'grid-cols-2' : 'grid-cols-3')} role="radiogroup" aria-label={label}>
                        {options.map((option) => {
                            const selected = field.value === option.value
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    role="radio"
                                    aria-checked={selected}
                                    onClick={() => field.onChange(option.value)}
                                    className={cn(
                                        'focus-visible:ring-ring/50 min-h-12 rounded-lg border px-2 py-2 text-center text-sm leading-tight font-medium transition-colors outline-none focus-visible:ring-[3px]',
                                        selected ? 'border-primary bg-primary/10 text-foreground' : 'bg-card text-muted-foreground hover:bg-muted'
                                    )}
                                >
                                    {option.label}
                                </button>
                            )
                        })}
                    </div>
                    <FormMessage />
                </FormItem>
            )}
        />
    )
}
