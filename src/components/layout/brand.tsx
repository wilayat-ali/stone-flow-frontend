import { Layers } from 'lucide-react'
import { cn } from '@/lib/utils'

export function BrandMark({ className }: { className?: string }) {
    return (
        <span
            className={cn(
                'bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg',
                className
            )}
        >
            <Layers className="size-4" aria-hidden />
        </span>
    )
}

export function Brand({
    name,
    className,
}: {
    name: string
    className?: string
}) {
    return (
        <span className={cn('flex items-center gap-2 font-semibold', className)}>
            <BrandMark className="size-7 rounded-md" />
            {name}
        </span>
    )
}
