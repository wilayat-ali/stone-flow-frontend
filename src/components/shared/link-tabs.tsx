'use client'

import { Link, usePathname } from '@/i18n/navigation'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export type LinkTab = { href: string; label: string }

/** Tabs that are routes: the active one follows the URL. Sits on a divider drawn by its parent. */
export function LinkTabs({ tabs }: { tabs: LinkTab[] }) {
    const pathname = usePathname()
    const active = tabs.find(
        (tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`)
    )

    return (
        <Tabs value={active?.href} className="min-w-0">
            <TabsList
                variant="line"
                className="h-11 w-full justify-start gap-6 overflow-x-auto rounded-none p-0"
            >
                {tabs.map((tab) => (
                    <TabsTrigger
                        key={tab.href}
                        value={tab.href}
                        asChild
                        className="data-[state=active]:text-foreground h-full flex-none rounded-none px-0 text-sm group-data-[orientation=horizontal]/tabs:after:bottom-0"
                    >
                        <Link href={tab.href}>{tab.label}</Link>
                    </TabsTrigger>
                ))}
            </TabsList>
        </Tabs>
    )
}
