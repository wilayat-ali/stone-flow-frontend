import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export type InitialsItem = {
    id: string
    /** Full name, shown in the tooltip. */
    label: string
    /** Two or three letters shown inside the circle; defaults to the initials of `label`. */
    short?: string
}

/** "Super Admin" gives "SA", "Owner" gives "OW". */
export function initialsOf(label: string): string {
    const words = label.trim().split(/\s+/).filter(Boolean)
    const letters = words.length > 1 ? words.slice(0, 2).map((word) => word[0]) : [...(words[0] ?? '')].slice(0, 2)
    return letters.join('').toUpperCase()
}

const sizes = {
    sm: 'size-6 text-[9px]',
    md: 'size-8 text-[10px]',
    lg: 'size-10 text-xs',
} as const

/**
 * Overlapping round badges with initials; hover a badge for its full name.
 * Reusable for roles, platforms or any short list, as in the AuditVare users table.
 */
export function InitialsStack({
    items,
    max = 4,
    size = 'md',
    className,
}: {
    items: InitialsItem[]
    /** Badges beyond this collapse into one "+N" badge that lists the rest in its tooltip. */
    max?: number
    size?: keyof typeof sizes
    className?: string
}) {
    const shown = items.length > max ? items.slice(0, max - 1) : items
    const hidden = items.length > max ? items.slice(max - 1) : []
    const total = shown.length + (hidden.length ? 1 : 0)

    return (
        <div className={cn('flex items-center', className)}>
            {shown.map((item, index) => (
                <InitialsBadge key={item.id} label={item.label} size={size} layer={total - index}>
                    {item.short ?? initialsOf(item.label)}
                </InitialsBadge>
            ))}
            {hidden.length > 0 && (
                <InitialsBadge label={hidden.map((item) => item.label).join(', ')} size={size} layer={1}>
                    {`+${hidden.length}`}
                </InitialsBadge>
            )}
        </div>
    )
}

function InitialsBadge({
    label,
    size,
    layer,
    children,
}: {
    label: string
    size: keyof typeof sizes
    /** Earlier badges sit above later ones, so every badge keeps its initials fully visible. */
    layer: number
    children: string
}) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span
                    tabIndex={0}
                    aria-label={label}
                    style={{ zIndex: layer }}
                    className={cn(
                        'bg-primary text-primary-foreground ring-background relative -ms-1.5 flex shrink-0 cursor-default items-center justify-center rounded-full leading-none font-semibold ring-2 first:ms-0',
                        sizes[size]
                    )}
                >
                    {children}
                </span>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    )
}
