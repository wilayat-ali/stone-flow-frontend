'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/shared/date-picker'
import { factoriesQueryKey, listFactories } from '@/features/factories'
import { purchasesQueryKey } from '@/features/purchases'
import { cuttingFactoryRate, finishCutting, productionQueryKey, type OwnRow } from '@/features/production'
import { suppliersQueryKey } from '@/features/suppliers'
import { useProductionErrorMessage } from '@/features/use-production-error-message'
import { workerById } from '@/features/workers'
import { useMoney } from '@/hooks/use-money'
import { todayIso } from '@/lib/format'

/**
 * Finish a truck. Own factory: confirm the thekadar's rate per ton and the date, and the total
 * goes on his khata. Other factory: the charge is the factory's rate per ton on the purchi tons.
 */
export function FinishDialog({
    row,
    onClose,
    onFinished,
}: {
    row: OwnRow | null
    onClose: () => void
    /** Called with the finished truck, so the page can open counting its output straight away. */
    onFinished: (purchaseId: string) => void
}) {
    return (
        <Dialog open={!!row} onOpenChange={(open) => !open && onClose()}>
            <DialogContent>{row && <FinishForm key={row.id} row={row} onClose={onClose} onFinished={onFinished} />}</DialogContent>
        </Dialog>
    )
}

function FinishForm({
    row,
    onClose,
    onFinished,
}: {
    row: OwnRow
    onClose: () => void
    onFinished: (purchaseId: string) => void
}) {
    const t = useTranslations('production')
    const tc = useTranslations('common')
    const money = useMoney()
    const queryClient = useQueryClient()
    const errorMessage = useProductionErrorMessage()
    const purchase = row.purchase
    const other = row.atOtherFactory

    const factories = useQuery({ queryKey: [factoriesQueryKey], queryFn: listFactories, enabled: other })
    const otherRate = other ? cuttingFactoryRate(factories.data ?? [], purchase.factoryId) : null
    const thekadar = purchase.thekadarId ? workerById(purchase.thekadarId) : undefined

    // The worker's own rate is the default; it can be changed for this truck.
    const [rate, setRate] = useState(thekadar ? String(thekadar.rate) : '')
    const [date, setDate] = useState(todayIso())

    const perTon = other ? (otherRate ?? 0) : Number(rate) || 0
    const total = Math.round(purchase.tons * perTon)
    const rateInvalid = !other && !(Number(rate) > 0)

    const finish = useMutation({
        mutationFn: () => finishCutting(purchase.id, { date, ratePerTon: perTon }),
        onSuccess: (result) => {
            toast.success(
                result.paid.kind === 'thekadar'
                    ? t('finished.thekadar', { to: result.paid.to, amount: money(result.paid.amount) })
                    : t('finished.factory', { to: result.paid.to, amount: money(result.paid.amount) })
            )
            for (const key of [productionQueryKey, purchasesQueryKey, suppliersQueryKey]) {
                queryClient.invalidateQueries({ queryKey: [key] })
            }
            onClose()
            onFinished(purchase.id)
        },
        onError: (error) => toast.error(errorMessage(error)),
    })

    return (
        <>
            <DialogHeader>
                <DialogTitle>{t('finishDialog.title', { mark: purchase.mark ?? '' })}</DialogTitle>
                <DialogDescription>
                    {other
                        ? t('finishDialog.descriptionOther', { factory: purchase.factoryName, tons: purchase.tons })
                        : t('finishDialog.descriptionOwn', {
                              thekadar: purchase.thekadarName ?? '',
                              machine: purchase.machineName ?? '',
                              tons: purchase.tons,
                          })}
                </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4">
                {!other && (
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="finish-rate">{t('finishDialog.rate')}</Label>
                        <Input
                            id="finish-rate"
                            value={rate}
                            onChange={(e) => setRate(e.target.value)}
                            inputMode="numeric"
                            aria-invalid={rateInvalid}
                        />
                        {thekadar && <p className="text-muted-foreground text-xs">{t('finishDialog.workerRate', { name: thekadar.name })}</p>}
                    </div>
                )}
                <div className="flex flex-col gap-2">
                    <Label>{t('finishDialog.date')}</Label>
                    <DatePicker
                        value={date}
                        onChange={setDate}
                        placeholder={t('finishDialog.date')}
                        min={purchase.cutStart ?? purchase.date}
                        max={todayIso()}
                    />
                </div>
                <div className="bg-primary text-primary-foreground flex items-center justify-between gap-2 rounded-lg px-4 py-3">
                    <div>
                        <div className="text-xs uppercase opacity-80">
                            {other ? t('finishDialog.charge') : t('finishDialog.thekadarEarns')}
                        </div>
                        <div className="text-2xl font-semibold tabular-nums">{money(total)}</div>
                    </div>
                    <div className="text-sm tabular-nums opacity-90">
                        {purchase.tons} t × {money(perTon)}
                        <div>{other ? t('finishDialog.toFactory', { factory: purchase.factoryName }) : t('finishDialog.toKhata')}</div>
                    </div>
                </div>
            </div>

            <DialogFooter>
                <Button variant="outline" disabled={finish.isPending} onClick={onClose}>
                    {tc('cancel')}
                </Button>
                <Button disabled={rateInvalid || (other && !otherRate) || !date || finish.isPending} onClick={() => finish.mutate()}>
                    {finish.isPending && <Loader2 className="animate-spin" />}
                    {t('finishDialog.submit')}
                </Button>
            </DialogFooter>
        </>
    )
}
