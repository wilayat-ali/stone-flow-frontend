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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Cheque } from '@/features/supplier-payments'
import { useMoney } from '@/hooks/use-money'

const REASONS = ['insufficientFunds', 'signatureMismatch', 'accountClosed', 'paymentStopped', 'other'] as const

/** Marks a cheque bounced: why, and the bank's charge. The amount goes back on the supplier's khata. */
export function BounceDialog({
    cheque,
    pending,
    onClose,
    onSubmit,
}: {
    cheque: Cheque | null
    pending?: boolean
    onClose: () => void
    onSubmit: (values: { reason: string; charge: number }) => void
}) {
    const t = useTranslations('purchases.cheques.bounce')
    const tc = useTranslations('common')
    const money = useMoney()
    const [reason, setReason] = useState<(typeof REASONS)[number]>('insufficientFunds')
    const [charge, setCharge] = useState('')
    const invalid = charge.trim() !== '' && !(Number.isInteger(Number(charge)) && Number(charge) >= 0)

    return (
        <Dialog open={!!cheque} onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                {cheque && (
                    <>
                        <DialogHeader>
                            <DialogTitle>{t('title', { no: cheque.no })}</DialogTitle>
                            <DialogDescription>
                                {t('description', { amount: money(cheque.amount), supplier: cheque.supplierName })}
                            </DialogDescription>
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
                                <Label htmlFor="bounce-charge">{t('charge')}</Label>
                                <Input
                                    id="bounce-charge"
                                    value={charge}
                                    onChange={(e) => setCharge(e.target.value)}
                                    inputMode="numeric"
                                    placeholder="0"
                                    aria-invalid={invalid}
                                />
                                {invalid && <p className="text-destructive text-sm">{t('chargeInvalid')}</p>}
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" disabled={pending} onClick={onClose}>
                                {tc('cancel')}
                            </Button>
                            <Button
                                variant="destructive"
                                disabled={pending || invalid}
                                onClick={() => onSubmit({ reason: t(`reasons.${reason}`), charge: Number(charge || 0) })}
                            >
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
