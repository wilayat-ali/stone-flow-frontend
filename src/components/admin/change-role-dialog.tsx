'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

/** Pick a new role for one person. The parent supplies the target and the save call. */
export function ChangeRoleDialog({
    name,
    currentRole,
    assignable,
    roleLabel,
    saving,
    onSave,
    onClose,
}: {
    name: string | null
    currentRole: string
    assignable: string[]
    roleLabel: (key: string) => string
    saving: boolean
    onSave: (roleKey: string) => void
    onClose: () => void
}) {
    const t = useTranslations('admin.users')
    const tc = useTranslations('common')
    const [picked, setPicked] = useState(currentRole)

    return (
        <Dialog open={name !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('changeRole.title')}</DialogTitle>
                    <DialogDescription>{t('changeRole.description', { name: name ?? '' })}</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-2">
                    <Label>{t('invite.role')}</Label>
                    <Select value={picked} onValueChange={setPicked}>
                        <SelectTrigger className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {assignable.map((key) => (
                                <SelectItem key={key} value={key}>
                                    {roleLabel(key)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onClose}>
                        {tc('cancel')}
                    </Button>
                    <Button
                        type="button"
                        disabled={saving || picked === currentRole}
                        onClick={() => onSave(picked)}
                    >
                        {saving && <Loader2 className="animate-spin" />}
                        {tc('save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
