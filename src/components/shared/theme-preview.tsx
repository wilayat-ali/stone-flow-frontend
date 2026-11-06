import { Check } from 'lucide-react'
import type { ThemeId } from '@/config/themes'
import { cn } from '@/lib/utils'

/**
 * Everything here sets `data-theme` on its own element, so the semantic tokens inside
 * (bg-primary, bg-card, ...) resolve to that theme's colours, whatever theme the page uses.
 */

/** A small round dot in the theme's primary colour. */
export function ThemeDot({ theme, className }: { theme: ThemeId; className?: string }) {
    return <span data-theme={theme} aria-hidden className={cn('bg-primary inline-block size-3.5 shrink-0 rounded-full', className)} />
}

/** A mini mock screen (sidebar, header, cards, button) painted with one theme. */
export function ThemePreview({ theme, className }: { theme: ThemeId; className?: string }) {
    return (
        <div
            data-theme={theme}
            aria-hidden
            className={cn('bg-background text-foreground flex h-24 w-full overflow-hidden rounded-md border', className)}
        >
            <div className="bg-sidebar border-sidebar-border flex w-1/4 flex-col gap-1.5 border-e p-2">
                <span className="bg-sidebar-primary h-2 w-2/3 rounded-sm" />
                <span className="bg-sidebar-accent h-1.5 w-full rounded-sm" />
                <span className="bg-sidebar-accent h-1.5 w-4/5 rounded-sm" />
            </div>
            <div className="flex flex-1 flex-col gap-1.5 p-2">
                <div className="flex items-center justify-between">
                    <span className="bg-foreground/70 h-1.5 w-1/3 rounded-sm" />
                    <span className="bg-primary h-3 w-8 rounded-sm" />
                </div>
                <div className="grid flex-1 grid-cols-3 gap-1.5">
                    <span className="bg-card border-border rounded-sm border" />
                    <span className="bg-secondary rounded-sm" />
                    <span className="bg-accent rounded-sm" />
                </div>
                <div className="flex items-end gap-1">
                    <span className="bg-chart-1 h-2 w-2 rounded-sm" />
                    <span className="bg-chart-2 h-3 w-2 rounded-sm" />
                    <span className="bg-chart-3 h-1.5 w-2 rounded-sm" />
                    <span className="bg-chart-4 h-2.5 w-2 rounded-sm" />
                </div>
            </div>
        </div>
    )
}

/** Selectable gallery card: preview, name and a check when it is the current choice. */
export function ThemeCard({
    theme,
    name,
    selected,
    badge,
    onSelect,
    disabled,
}: {
    theme: ThemeId
    name: string
    selected: boolean
    /** Small note beside the name, such as "Current". */
    badge?: string
    onSelect: () => void
    disabled?: boolean
}) {
    return (
        <button
            type="button"
            onClick={onSelect}
            disabled={disabled}
            aria-pressed={selected}
            className={cn(
                'bg-card hover:border-primary/60 flex flex-col gap-2 rounded-lg border p-2 text-start transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60',
                selected && 'border-primary ring-primary/30 ring-2'
            )}
        >
            <ThemePreview theme={theme} />
            <div className="flex items-center justify-between gap-2 px-1 pb-0.5">
                <span className="flex items-center gap-2 text-sm font-medium">
                    <ThemeDot theme={theme} />
                    {name}
                </span>
                <span className="flex items-center gap-1.5">
                    {badge && <span className="text-muted-foreground text-xs">{badge}</span>}
                    {selected && <Check className="text-primary size-4" aria-hidden />}
                </span>
            </div>
        </button>
    )
}
