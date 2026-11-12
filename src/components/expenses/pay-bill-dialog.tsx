'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Expense } from '@/features/expenses'
import { useMoney } from '@/hooks/use-money'
import { todayIso } from '@/lib/format'
import { useAccountBalances } from './use-account-balances'

/** Pay an unpaid bill now: choose the account and the day. Only then does the money leave. State is inside; callers remount with `key`. */
export function PayBillDialog({
    expense,
    pending,
    onClose,
    onSubmit,
}: {
    expense: Expense | null
    pending?: boolean
    onClose: () => void
    onSubmit: (values: { accountId: string; accountName: string; date: string }) => void
}) {
    const t = useTranslations('expenses.payBill')
    const tc = useTranslations('common')
    const money = useMoney()
    const { accounts, munshi } = useAccountBalances(!!expense, t('munshiCash'))
    const [accountId, setAccountId] = useState('')
    const [date, setDate] = useState(todayIso())

    const options = [munshi, ...accounts]
    const account = options.find((a) => a.id === accountId)
    const short = !!expense && !!account && account.kind !== 'munshi' && account.balance !== null && expense.amount > account.balance
    const invalid = !accountId || !date || date > todayIso() || (!!expense && date < expense.date) || short

    return (
        <Dialog open={!!expense} onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                {expense && (
                    <>
                        <DialogHeader>
                            <DialogTitle>{t('title', { no: expense.expNo })}</DialogTitle>
                            <DialogDescription>{t('description', { amount: money(expense.amount), what: expense.description })}</DialogDescription>
                        </DialogHeader>
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-col gap-2">
                                <Label>{t('account')}</Label>
                                <Select value={accountId} onValueChange={setAccountId}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder={t('chooseAccount')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {options.map((a) => (
                                            <SelectItem key={a.id} value={a.id}>
                                                {a.balance === null ? a.name : `${a.name} · ${money(a.balance)}`}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {short && <p className="text-destructive text-sm">{t('short', { account: account?.name ?? '', amount: money(account?.balance ?? 0) })}</p>}
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="pay-bill-date">{t('date')}</Label>
                                <Input id="pay-bill-date" type="date" value={date} min={expense.date} max={todayIso()} onChange={(e) => setDate(e.target.value)} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" disabled={pending} onClick={onClose}>
                                {tc('cancel')}
                            </Button>
                            <Button disabled={pending || invalid} onClick={() => onSubmit({ accountId, accountName: account?.name ?? '', date })}>
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
