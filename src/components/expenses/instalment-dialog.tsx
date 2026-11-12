'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { InstalmentRow, LoanSummary } from '@/features/loans'
import { useMoney } from '@/hooks/use-money'

export type InstalmentChange = { amount: number } | { skip: true } | { reset: true }

/** Change one month's instalment, skip it, or go back to the regular one. State is inside; callers remount with `key`. */
export function InstalmentDialog({
    target,
    pending,
    onClose,
    onSubmit,
}: {
    target: { loan: LoanSummary; row: InstalmentRow } | null
    pending?: boolean
    onClose: () => void
    onSubmit: (change: InstalmentChange) => void
}) {
    const t = useTranslations('expenses.loans.change')
    const tc = useTranslations('common')
    const format = useFormatter()
    const money = useMoney()
    const [amount, setAmount] = useState(target && target.row.amount > 0 ? String(target.row.amount) : '')

    const valid = Number(amount) > 0 && Number.isInteger(Number(amount))

    return (
        <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                {target && (
                    <>
                        <DialogHeader>
                            <DialogTitle>{t('title', { month: format.dateTime(new Date(`${target.row.month}-01T00:00:00`), { month: 'long', year: 'numeric' }) })}</DialogTitle>
                            <DialogDescription>{t('description', { worker: target.loan.workerName, regular: money(target.loan.monthlyInstalment) })}</DialogDescription>
                        </DialogHeader>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="instalment-amount">{t('amount')}</Label>
                            <Input id="instalment-amount" inputMode="numeric" placeholder={t('amountPlaceholder')} value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} />
                        </div>
                        <DialogFooter className="sm:justify-between">
                            <div className="flex gap-2">
                                <Button variant="outline" disabled={pending} onClick={() => onSubmit({ skip: true })}>
                                    {t('skip')}
                                </Button>
                                <Button variant="ghost" disabled={pending} onClick={() => onSubmit({ reset: true })}>
                                    {t('reset')}
                                </Button>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" disabled={pending} onClick={onClose}>
                                    {tc('cancel')}
                                </Button>
                                <Button disabled={pending || !valid} onClick={() => onSubmit({ amount: Number(amount) })}>
                                    {pending && <Loader2 className="animate-spin" />}
                                    {t('submit')}
                                </Button>
                            </div>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}
