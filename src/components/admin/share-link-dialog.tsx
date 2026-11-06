'use client'

import { useState } from 'react'
import { Check, Copy, MessageCircle } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

export type SharedLink = {
    title: string
    description: string
    url: string
    whatsappUrl?: string
    expiresAt?: string
}

/** Shows a link the admin shares by hand (invite or password reset): copy it or open WhatsApp. */
export function ShareLinkDialog({
    link,
    onClose,
}: {
    link: SharedLink | null
    onClose: () => void
}) {
    const t = useTranslations('admin.users.share')
    const format = useFormatter()
    const [copied, setCopied] = useState(false)

    const copy = async () => {
        if (!link) return
        try {
            await navigator.clipboard.writeText(link.url)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {}
    }

    return (
        <Dialog open={link !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{link?.title}</DialogTitle>
                    <DialogDescription>{link?.description}</DialogDescription>
                </DialogHeader>
                <div className="flex items-center gap-2">
                    <Input readOnly dir="ltr" value={link?.url ?? ''} onFocus={(e) => e.target.select()} />
                    <Button type="button" variant="outline" size="icon" onClick={copy} aria-label={t('copy')}>
                        {copied ? <Check /> : <Copy />}
                    </Button>
                </div>
                {link?.expiresAt && (
                    <p className="text-muted-foreground text-xs">
                        {t('expires', {
                            date: format.dateTime(new Date(link.expiresAt), {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                            }),
                        })}
                    </p>
                )}
                <DialogFooter>
                    {link?.whatsappUrl && (
                        <Button asChild variant="outline">
                            <a href={link.whatsappUrl} target="_blank" rel="noreferrer">
                                <MessageCircle />
                                {t('whatsapp')}
                            </a>
                        </Button>
                    )}
                    <Button type="button" onClick={onClose}>
                        {t('done')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
