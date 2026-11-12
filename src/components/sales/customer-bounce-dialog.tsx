'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { CustomerCheque } from '@/features/customer-payments'
import { useMoney } from '@/hooks/use-money'
import { todayIso } from '@/lib/format'

const REASONS = ['insufficientFunds', 'signatureMismatch', 'accountClosed', 'paymentStopped', 'other'] as const

/** A customer's cheque bounced: why, and when. The amount goes back on their khata as a charge. */
export function CustomerBounceDialog({
    cheque,
    pending,
    onClose,
    onSubmit,
}: {
    cheque: CustomerCheque | null
    pending?: boolean
    onClose: () => void
    onSubmit: (values: { reason: string; date: string }) => void
}) {
    const t = useTranslations('sales.cheques.bounce')
    const tc = useTranslations('common')
    const money = useMoney()
    const [reason, setReason] = useState<(typeof REASONS)[number]>('insufficientFunds')
    const [date, setDate] = useState(todayIso())

    const invalid = !date || date > todayIso()

    return (
        <Dialog open={!!cheque} onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                {cheque && (
                    <>
                        <DialogHeader>
                            <DialogTitle>{t('title', { no: cheque.chequeNo })}</DialogTitle>
                            <DialogDescription>{t('description', { amount: money(cheque.amount), customer: cheque.customerName })}</DialogDescription>
                        </DialogHeader>
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-col gap-2">
                                <Label>{t('reason')}</Label>
                                <Select value={reason} onValueChange={(v) => setReason(v as (typeof REASONS)[number])}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {REASONS.map((r) => (
                                            <SelectItem key={r} value={r}>
                                                {t(`reasons.${r}`)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="bounce-date">{t('date')}</Label>
                                <Input id="bounce-date" type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" disabled={pending} onClick={onClose}>
                                {tc('cancel')}
                            </Button>
                            <Button variant="destructive" disabled={pending || invalid} onClick={() => onSubmit({ reason: t(`reasons.${reason}`), date })}>
                                {pending && <Loader2 className="animate-spin" />}
                                {t('submit')}
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}
