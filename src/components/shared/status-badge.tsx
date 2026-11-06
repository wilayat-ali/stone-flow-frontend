import type { ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const statusBadgeVariants = cva(
    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
    {
        variants: {
            tone: {
                success: 'bg-success/15 text-success',
                warning: 'bg-warning/20 text-foreground',
                info: 'bg-info/15 text-info',
                danger: 'bg-destructive/15 text-destructive',
                neutral: 'bg-muted text-muted-foreground',
            },
        },
        defaultVariants: { tone: 'neutral' },
    }
)

const dotVariants = cva('size-1.5 rounded-full', {
    variants: {
        tone: {
            success: 'bg-success',
            warning: 'bg-warning',
            info: 'bg-info',
            danger: 'bg-destructive',
            neutral: 'bg-muted-foreground',
        },
    },
    defaultVariants: { tone: 'neutral' },
})

export type StatusTone = NonNullable<
    VariantProps<typeof statusBadgeVariants>['tone']
>

export function StatusBadge({
    tone,
    children,
    className,
}: {
    tone?: StatusTone
    children: ReactNode
    className?: string
}) {
    return (
        <span className={cn(statusBadgeVariants({ tone }), className)}>
            <span className={dotVariants({ tone })} aria-hidden />
            {children}
        </span>
    )
}
