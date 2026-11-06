import { getTranslations } from 'next-intl/server'
import { Brand } from '@/components/layout/brand'
import { LanguageSwitcher } from '@/components/layout/language-switcher'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { WorkspacePicker } from '@/components/workspace/workspace-picker'
import { listWorkspaces } from '@/features/workspace/data'

export default async function SelectWorkspacePage() {
    const [t, workspaces] = await Promise.all([
        getTranslations('common'),
        listWorkspaces(),
    ])

    return (
        <div className="flex min-h-svh flex-col gap-4 p-6 md:p-10">
            <div className="flex items-center justify-between">
                <Brand name={t('appName')} />
                <div className="flex items-center gap-1">
                    <LanguageSwitcher />
                    <ThemeToggle />
                </div>
            </div>
            <div className="flex flex-1 items-center justify-center">
                <WorkspacePicker workspaces={workspaces} />
            </div>
        </div>
    )
}
