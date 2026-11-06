'use client'

import { useState } from 'react'
import { Building2, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useRouter } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ROUTES } from '@/config/auth'
import { selectWorkspaceAction } from '@/features/auth/actions'
import type { Workspace } from '@/features/workspace/data'

export function WorkspacePicker({ workspaces }: { workspaces: Workspace[] }) {
    const t = useTranslations('workspace')
    const router = useRouter()
    const [pending, setPending] = useState<string | null>(null)

    const choose = async (id: string) => {
        setPending(id)
        const ok = await selectWorkspaceAction(id)
        if (!ok) {
            setPending(null)
            toast.error(t('selectFailed'))
            return
        }
        router.replace(ROUTES.dashboard)
    }

    return (
        <div className="flex w-full max-w-md flex-col gap-6">
            <div className="flex flex-col gap-2 text-center">
                <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
                <p className="text-muted-foreground text-sm">{t('description')}</p>
            </div>
            <div className="flex flex-col gap-3">
                {workspaces.length === 0 && (
                    <p className="text-muted-foreground text-center text-sm">{t('empty')}</p>
                )}
                {workspaces.map((workspace) => (
                    <Card key={workspace.id} className="py-4">
                        <CardContent className="flex items-center gap-3 px-4">
                            <div className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-md">
                                <Building2 className="size-5" aria-hidden />
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate font-medium">{workspace.name}</span>
                                <span className="text-muted-foreground truncate text-xs">
                                    {workspace.roleName}
                                </span>
                            </div>
                            <Button
                                size="sm"
                                disabled={pending !== null}
                                onClick={() => choose(workspace.id)}
                            >
                                {pending === workspace.id && <Loader2 className="animate-spin" />}
                                {t('enter')}
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}
