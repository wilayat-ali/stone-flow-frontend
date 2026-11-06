'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import { LinkTabs } from '@/components/shared/link-tabs'

const tabs = [
    { href: '/settings/bank-cash', key: 'bankCash' },
    { href: '/settings/factories', key: 'factories' },
    { href: '/settings/approval', key: 'approval' },
    { href: '/settings/rates', key: 'rates' },
    { href: '/settings/sizes', key: 'sizes' },
    { href: '/settings/machines', key: 'machines' },
] as const

const ActionsSlot = createContext<HTMLElement | null>(null)

/** Puts a tab's primary actions at the end of the tab row, from inside the tab's own page. */
export function SettingsActions({ children }: { children: ReactNode }) {
    const slot = useContext(ActionsSlot)
    return slot ? createPortal(children, slot) : null
}

/** Settings tabs; each tab is its own route under `/settings`. The top bar already says "Settings". */
export function SettingsShell({ children }: { children: ReactNode }) {
    const t = useTranslations('settings.tabs')
    const [slot, setSlot] = useState<HTMLElement | null>(null)

    return (
        <ActionsSlot.Provider value={slot}>
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:border-b">
                    <div className="min-w-0 border-b sm:border-b-0">
                        <LinkTabs tabs={tabs.map(({ href, key }) => ({ href, label: t(key) }))} />
                    </div>
                    <div ref={setSlot} className="flex flex-wrap items-center gap-2" />
                </div>
                {children}
            </div>
        </ActionsSlot.Provider>
    )
}
