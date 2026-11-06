import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function PageHeader({
    title,
    description,
    actions,
    className,
}: {
    title: string
    description?: string
    actions?: ReactNode
    className?: string
}) {
    return (
        <div
            className={cn(
                'flex flex-wrap items-start justify-between gap-3',
                className
            )}
        >
            <div className="flex flex-col gap-1">
                <h1 className="text-xl font-semibold tracking-tight">
                    {title}
                </h1>
                {description && (
                    <p className="text-muted-foreground text-sm">
                        {description}
                    </p>
                )}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
    )
}
