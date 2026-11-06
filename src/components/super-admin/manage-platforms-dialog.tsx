'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import {
    failureKey,
    platformKeys,
    setWorkspacePlatform,
    workspacesKey,
    type PlatformKey,
    type Workspace,
} from '@/features/super-admin/workspaces'

/** Turn the platforms a workspace may use on or off. Each switch saves straight away. */
export function ManagePlatformsDialog({
    workspace,
    canManage,
    onClose,
}: {
    workspace: Workspace | null
    canManage: boolean
    onClose: () => void
}) {
    const t = useTranslations('superAdmin.workspaces')
    const tc = useTranslations('common')
    const queryClient = useQueryClient()
    const [pending, setPending] = useState<PlatformKey | null>(null)

    const toggle = useMutation({
        mutationFn: ({ id, key, enabled }: { id: string; key: PlatformKey; enabled: boolean }) =>
            setWorkspacePlatform(id, key, enabled),
        onMutate: ({ key }) => setPending(key),
        onSuccess: (_, { key, enabled }) => {
            toast.success(t(enabled ? 'toast.platformOn' : 'toast.platformOff', { platform: t(`platforms.${key}`) }))
            queryClient.invalidateQueries({ queryKey: workspacesKey })
        },
        onError: (error) => {
            const key = `errors.${failureKey(error)}`
            toast.error(t.has(key as never) ? t(key as never) : t('errors.generic'))
        },
        onSettled: () => setPending(null),
    })

    return (
        <Dialog open={workspace !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('manage.title')}</DialogTitle>
                    <DialogDescription>{t('manage.description', { name: workspace?.name ?? '' })}</DialogDescription>
                </DialogHeader>
                <ul className="flex flex-col divide-y rounded-lg border">
                    {platformKeys.map((key) => (
                        <li key={key} className="flex items-center justify-between gap-3 p-3">
                            <div className="flex flex-col">
                                <span className="text-sm font-medium">{t(`platforms.${key}`)}</span>
                                <span className="text-muted-foreground text-xs">{t(`platformHints.${key}`)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {pending === key && <Loader2 className="text-muted-foreground size-4 animate-spin" />}
                                <Switch
                                    checked={workspace?.platforms[key] ?? false}
                                    disabled={!canManage || toggle.isPending}
                                    onCheckedChange={(enabled) =>
                                        workspace && toggle.mutate({ id: workspace.id, key, enabled })
                                    }
                                    aria-label={t(`platforms.${key}`)}
                                />
                            </div>
                        </li>
                    ))}
                </ul>
                {!canManage && <p className="text-muted-foreground text-xs">{t('manage.readOnly')}</p>}
                <DialogFooter>
                    <Button type="button" onClick={onClose}>
                        {tc('back')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
