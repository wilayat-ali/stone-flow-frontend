import type { ReactNode } from 'react'

export function AuthCard({
    title,
    description,
    children,
    footer,
}: {
    title: string
    description?: string
    children: ReactNode
    footer?: ReactNode
}) {
    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2 text-center">
                <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                {description && (
                    <p className="text-muted-foreground text-sm text-balance">
                        {description}
                    </p>
                )}
            </div>
            {children}
            {footer && (
                <div className="text-muted-foreground text-center text-sm">
                    {footer}
                </div>
            )}
        </div>
    )
}
