import type { ReactNode } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
    Card,
    CardAction,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type TrendDirection = 'up' | 'down'

export type StatCardProps = {
    label: string
    value: string
    trend?: { value: string; direction: TrendDirection }
    footer?: string
    note?: string
    /** Shows the value in the destructive colour, e.g. a negative balance. */
    negative?: boolean
    /** Shorter card with a smaller figure, for screens where the cards are not the focus. */
    compact?: boolean
    className?: string
}

/** Same markup as the shadcn dashboard-01 `SectionCards` card. */
export function StatCard({
    label,
    value,
    trend,
    footer,
    note,
    negative,
    compact,
    className,
}: StatCardProps) {
    const TrendIcon = trend?.direction === 'down' ? TrendingDown : TrendingUp

    return (
        <Card
            className={cn(
                '@container/card',
                compact && 'gap-2 py-4',
                className
            )}
        >
            <CardHeader>
                <CardDescription>{label}</CardDescription>
                <CardTitle
                    className={cn(
                        'text-2xl font-semibold tabular-nums',
                        !compact && '@[250px]/card:text-3xl',
                        negative && 'text-destructive'
                    )}
                >
                    {value}
                </CardTitle>
                {trend && (
                    <CardAction>
                        <Badge variant="outline">
                            <TrendIcon />
                            <bdi>{trend.value}</bdi>
                        </Badge>
                    </CardAction>
                )}
            </CardHeader>
            {(footer || note) && (
                <CardFooter className="flex-col items-start gap-1.5 text-sm">
                    {footer && (
                        <div className="line-clamp-1 flex gap-2 font-medium">
                            {footer}
                            {trend && <TrendIcon className="size-4" />}
                        </div>
                    )}
                    {note && (
                        <div className="text-muted-foreground">{note}</div>
                    )}
                </CardFooter>
            )}
        </Card>
    )
}

/** Responsive grid + gradient card surface from the dashboard-01 block. */
export function StatCardGrid({
    children,
    className,
}: {
    children: ReactNode
    className?: string
}) {
    return (
        <div
            className={cn(
                '*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4',
                className
            )}
        >
            {children}
        </div>
    )
}
