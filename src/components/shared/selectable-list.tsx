import type { ReactNode } from 'react'
import { Search, X, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

export type SelectableItem = {
    id: string
    title: string
    meta?: string
    value: string
    icon?: LucideIcon
    negative?: boolean
    /** Shown at the end of the row on hover or focus (always on touch screens), e.g. a "more" menu. */
    actions?: ReactNode
}

export type SelectableListSearch = {
    value: string
    onChange: (value: string) => void
    placeholder: string
    clearLabel: string
}

/**
 * A list of choices with a value each, one selected. The title, action and search stay pinned;
 * the cards scroll. Give it a height (e.g. `h-full`) to make it scroll.
 */
export function SelectableList({
    items,
    selectedId,
    onSelect,
    label,
    count,
    action,
    search,
    emptyLabel,
    className,
}: {
    items: SelectableItem[]
    selectedId: string | undefined
    onSelect: (id: string) => void
    label: string
    /** Shown beside the label, e.g. how many there are in total. */
    count?: number
    /** Sits at the end of the title row, e.g. an add button. */
    action?: ReactNode
    search?: SelectableListSearch
    /** Shown when `items` is empty, e.g. after a search. */
    emptyLabel?: string
    className?: string
}) {
    return (
        <div className={cn('flex min-h-0 flex-col', className)}>
            <div className="flex h-14 shrink-0 items-center justify-between gap-2 px-1">
                <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold">{label}</span>
                    {count !== undefined && (
                        <span className="text-muted-foreground text-xs tabular-nums">
                            {count}
                        </span>
                    )}
                </div>
                {action}
            </div>
            {search && (
                <div className="relative flex h-15 shrink-0 items-center">
                    <Search
                        className="text-muted-foreground pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2"
                        aria-hidden
                    />
                    <Input
                        value={search.value}
                        onChange={(e) => search.onChange(e.target.value)}
                        placeholder={search.placeholder}
                        aria-label={search.placeholder}
                        className="px-8"
                    />
                    {search.value && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="absolute end-1.5 top-1/2 -translate-y-1/2"
                            aria-label={search.clearLabel}
                            onClick={() => search.onChange('')}
                        >
                            <X />
                        </Button>
                    )}
                </div>
            )}
            <div className="relative min-h-0 flex-1 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-6 after:bg-linear-to-t after:from-[var(--list-fade,var(--background))] after:to-transparent">
                <ScrollArea className="h-full [&_[data-radix-scroll-area-viewport]>div]:block!">
                    <div className="flex flex-col gap-2 px-1 pb-6">
                        {items.length === 0 && emptyLabel && (
                            <p className="text-muted-foreground py-6 text-center text-sm">
                                {emptyLabel}
                            </p>
                        )}
                        {items.map(
                            ({
                                id,
                                title,
                                meta,
                                value,
                                icon: Icon,
                                negative,
                                actions,
                            }) => (
                                <div
                                    key={id}
                                    className={cn(
                                        'group bg-card hover:bg-accent relative flex items-center rounded-lg border shadow-xs transition-colors',
                                        id === selectedId &&
                                            'bg-accent before:bg-foreground before:absolute before:inset-y-2 before:start-0 before:w-0.5 before:rounded-full'
                                    )}
                                >
                                    <button
                                        type="button"
                                        onClick={() => onSelect(id)}
                                        aria-pressed={id === selectedId}
                                        className={cn(
                                            'focus-visible:ring-ring/50 flex min-w-0 flex-1 items-center gap-3 rounded-lg p-3 text-start outline-none focus-visible:ring-[3px]',
                                            actions && 'pe-1'
                                        )}
                                    >
                                        {Icon && (
                                            <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-md">
                                                <Icon
                                                    className="size-4"
                                                    aria-hidden
                                                />
                                            </span>
                                        )}
                                        <span className="flex min-w-0 flex-1 flex-col">
                                            <span className="truncate text-sm font-medium">
                                                {title}
                                            </span>
                                            {meta && (
                                                <bdi className="text-muted-foreground text-xs">
                                                    {meta}
                                                </bdi>
                                            )}
                                        </span>
                                        <bdi
                                            className={cn(
                                                'text-sm font-semibold tabular-nums',
                                                negative && 'text-destructive'
                                            )}
                                        >
                                            {value}
                                        </bdi>
                                    </button>
                                    {actions && (
                                        <div className="flex w-8 shrink-0 items-center justify-center pe-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 has-[[data-state=open]]:opacity-100 pointer-coarse:opacity-100">
                                            {actions}
                                        </div>
                                    )}
                                </div>
                            )
                        )}
                    </div>
                </ScrollArea>
            </div>
        </div>
    )
}
