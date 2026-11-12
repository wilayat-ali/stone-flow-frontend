'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/shared/date-picker'
import { customerKhataQueryKey, customersQueryKey } from '@/features/customers'
import { cuttingJobsQueryKey, finishJob } from '@/features/cutting-jobs'
import { productionQueryKey, type CustomerRow } from '@/features/production'
import { useProductionErrorMessage } from '@/features/use-production-error-message'
import { workerById } from '@/features/workers'
import { useMoney } from '@/hooks/use-money'
import { todayIso } from '@/lib/format'

/**
 * Finish a customer's truck: the sq.ft that came out and the rate decide what they owe, and the
 * thekadar is still paid per ton, as for our own trucks.
 */
export function CustomerFinishDialog({ row, onClose }: { row: CustomerRow | null; onClose: () => void }) {
    return (
        <Dialog open={!!row} onOpenChange={(open) => !open && onClose()}>
            <DialogContent>{row && <Form key={row.id} row={row} onClose={onClose} />}</DialogContent>
        </Dialog>
    )
}

function Form({ row, onClose }: { row: CustomerRow; onClose: () => void }) {
    const t = useTranslations('production')
    const tc = useTranslations('common')
    const money = useMoney()
    const queryClient = useQueryClient()
    const errorMessage = useProductionErrorMessage()
    const job = row.job
    const thekadar = job.thekadarId ? workerById(job.thekadarId) : undefined

    const [sqft, setSqft] = useState('')
    const [rate, setRate] = useState(String(job.ratePerSqft))
    const [tonRate, setTonRate] = useState(thekadar ? String(thekadar.rate) : '')
    const [note, setNote] = useState('')
    const [date, setDate] = useState(todayIso())

    const charge = Math.round((Number(sqft) || 0) * (Number(rate) || 0))
    const invalid = !(Number(sqft) > 0) || !(Number(rate) > 0)

    const finish = useMutation({
        mutationFn: () => finishJob(job.id, { date, sqft: Number(sqft), ratePerSqft: Number(rate), outputNote: note, ratePerTon: Number(tonRate) || 0 }),
        onSuccess: () => {
            toast.success(t('customers.finished', { customer: job.customerName, amount: money(charge) }))
            for (const key of [productionQueryKey, cuttingJobsQueryKey, customersQueryKey, customerKhataQueryKey]) {
                queryClient.invalidateQueries({ queryKey: [key] })
            }
            onClose()
        },
        onError: (error) => toast.error(errorMessage(error)),
    })

    return (
        <>
            <DialogHeader>
                <DialogTitle>{t('customers.finishTitle', { truck: job.truckNo })}</DialogTitle>
                <DialogDescription>
                    {job.customerName} · {job.machineName} · {job.thekadarName} · {job.tons} t
                </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                    <Label htmlFor="cf-sqft">{t('customers.sqft')}</Label>
                    <Input id="cf-sqft" value={sqft} onChange={(e) => setSqft(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" />
                </div>
                <div className="flex flex-col gap-2">
                    <Label htmlFor="cf-rate">{t('customers.rate')}</Label>
                    <Input id="cf-rate" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" />
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                    <Label htmlFor="cf-note">{t('customers.outputNote')}</Label>
                    <Input id="cf-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('customers.outputNotePlaceholder')} />
                </div>
                <div className="flex flex-col gap-2">
                    <Label htmlFor="cf-ton">{t('customers.thekadarRate')}</Label>
                    <Input id="cf-ton" value={tonRate} onChange={(e) => setTonRate(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
                    {thekadar && <p className="text-muted-foreground text-xs">{t('finishDialog.workerRate', { name: thekadar.name })}</p>}
                </div>
                <div className="flex flex-col gap-2">
                    <Label>{t('finishDialog.date')}</Label>
                    <DatePicker value={date} onChange={setDate} placeholder={t('finishDialog.date')} min={job.cutStart ?? job.date} max={todayIso()} />
                </div>
            </div>

            <div className="bg-primary text-primary-foreground flex items-center justify-between gap-2 rounded-lg px-4 py-3">
                <div>
                    <div className="text-xs uppercase opacity-80">{t('customers.chargeTo', { customer: job.customerName })}</div>
                    <div className="text-2xl font-semibold tabular-nums">{money(charge)}</div>
                </div>
                <div className="text-sm tabular-nums opacity-90">
                    {t('customers.sqftTimesRate')}
                    {thekadar && Number(tonRate) > 0 && (
                        <div>{t('customers.thekadarEarns', { name: thekadar.name, amount: money(Math.round(job.tons * Number(tonRate))) })}</div>
                    )}
                </div>
            </div>

            <DialogFooter>
                <Button variant="outline" disabled={finish.isPending} onClick={onClose}>
                    {tc('cancel')}
                </Button>
                <Button disabled={invalid || !date || finish.isPending} onClick={() => finish.mutate()}>
                    {finish.isPending && <Loader2 className="animate-spin" />}
                    {t('customers.finishSubmit')}
                </Button>
            </DialogFooter>
        </>
    )
}
