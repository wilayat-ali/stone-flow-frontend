'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { accountsKey, listAccounts } from '@/features/bank-cash/api'
import type { CustomerCheque } from '@/features/customer-payments'
import { useMoney } from '@/hooks/use-money'
import { todayIso } from '@/lib/format'

/** The cheque was deposited: which bank it went into, and the day it cleared. The money reaches that bank on that day. */
export function ClearChequeDialog({
    cheque,
    pending,
    onClose,
    onSubmit,
}: {
    cheque: CustomerCheque | null
    pending?: boolean
    onClose: () => void
    onSubmit: (values: { accountId: string; accountName: string; date: string }) => void
}) {
    const t = useTranslations('sales.cheques.clear')
    const tc = useTranslations('common')
    const money = useMoney()
    const accounts = useQuery({ queryKey: accountsKey, queryFn: listAccounts, enabled: !!cheque })
    const [accountId, setAccountId] = useState('')
    const [date, setDate] = useState(todayIso())

    const banks = (accounts.data ?? []).filter((a) => a.isActive && a.kind === 'bank')
    const invalid = !accountId || !date || date > todayIso() || (!!cheque && date < cheque.receivedOn)

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
                                <Label>{t('bank')}</Label>
                                <Select value={accountId} onValueChange={setAccountId}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder={t('chooseBank')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {banks.map((a) => (
                                            <SelectItem key={a.id} value={a.id}>
                                                {a.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="clear-date">{t('date')}</Label>
                                <Input id="clear-date" type="date" value={date} min={cheque.receivedOn} max={todayIso()} onChange={(e) => setDate(e.target.value)} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" disabled={pending} onClick={onClose}>
                                {tc('cancel')}
                            </Button>
                            <Button
                                disabled={pending || invalid}
                                onClick={() => onSubmit({ accountId, accountName: banks.find((a) => a.id === accountId)?.name ?? '', date })}
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
