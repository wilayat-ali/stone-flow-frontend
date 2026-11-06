import type { ReactNode } from 'react'
import { Inbox, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function EmptyState({
    title,
    description,
    icon: Icon = Inbox,
    action,
    className,
}: {
    title: string
    description?: string
    icon?: LucideIcon
    action?: ReactNode
    className?: string
}) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
                className
            )}
        >
            <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
                <Icon className="size-6" aria-hidden />
            </div>
            <div className="flex flex-col gap-1">
                <p className="font-medium">{title}</p>
                {description && (
                    <p className="text-muted-foreground text-sm">
                        {description}
                    </p>
                )}
            </div>
            {action}
        </div>
    )
}
