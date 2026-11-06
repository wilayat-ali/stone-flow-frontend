'use client'

import { useState, type ReactNode } from 'react'
import { ThemeProvider } from 'next-themes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'

export function AppProviders({
    children,
    dir,
}: {
    children: ReactNode
    dir: 'ltr' | 'rtl'
}) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: { staleTime: 60_000, refetchOnWindowFocus: false },
                },
            })
    )

    return (
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
        >
            <QueryClientProvider client={queryClient}>
                <TooltipProvider>{children}</TooltipProvider>
                <Toaster dir={dir} position="bottom-center" />
            </QueryClientProvider>
        </ThemeProvider>
    )
}
