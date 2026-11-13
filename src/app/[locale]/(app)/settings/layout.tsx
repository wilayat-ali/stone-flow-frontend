import type { ReactNode } from 'react'
import { SettingsShell } from '@/components/settings/settings-shell'

/** Access to Settings is checked in the app shell, from the role's permissions. */
export default function SettingsLayout({ children }: { children: ReactNode }) {
    return <SettingsShell>{children}</SettingsShell>
}
