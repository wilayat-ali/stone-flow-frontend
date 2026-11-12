'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePicker } from '@/components/shared/date-picker'
import { cuttingJobsQueryKey, sendJob } from '@/features/cutting-jobs'
import { purchasesQueryKey } from '@/features/purchases'
import { listMachineLoad, productionQueryKey, sendToMachine, viewOf, type CuttingRow } from '@/features/production'
import { useProductionErrorMessage } from '@/features/use-production-error-message'
import { todayIso } from '@/lib/format'

/** Send a waiting truck to one of its factory's machines, with the thekadar who will complete it. */
export function SendDialog({ row, onClose }: { row: CuttingRow | null; onClose: () => void }) {
    return (
        <Dialog open={!!row} onOpenChange={(open) => !open && onClose()}>
            <DialogContent>{row && <SendForm key={row.id} row={row} onClose={onClose} />}</DialogContent>
        </Dialog>
    )
}

function SendForm({ row, onClose }: { row: CuttingRow; onClose: () => void }) {
    const t = useTranslations('production')
    const tm = useTranslations('settings.machines.type')
    const tc = useTranslations('common')
    const queryClient = useQueryClient()
    const errorMessage = useProductionErrorMessage()
    const purchase = viewOf(row)

    const load = useQuery({ queryKey: [productionQueryKey, 'machine-load'], queryFn: listMachineLoad })
    const machines = (load.data?.machines ?? []).filter((m) => m.factoryId === purchase.factoryId)

    const [machineChoice, setMachineChoice] = useState('')
    const [shift, setShift] = useState<'day' | 'night'>('day')
    const [date, setDate] = useState(todayIso())

    // Until one is picked, the factory's first machine is the default.
    const machine = machines.find((m) => m.id === machineChoice) ?? machines[0]
    const thekadarName = machine ? (shift === 'night' && machine.nightThekadar ? machine.nightThekadar : machine.dayThekadar) : ''
    const onIt = machine ? (load.data?.onMachine[machine.id] ?? 0) : 0

    const send = useMutation({
        mutationFn: async () => {
            const input = { machineId: machine!.id, machineName: machine!.name, thekadarName, date }
            // A customer's truck and our own truck go to a machine the same way.
            await (row.kind === 'own' ? sendToMachine(row.id, input) : sendJob(row.id, input))
        },
        onSuccess: () => {
            toast.success(t('sent', { mark: purchase.tag, machine: machine!.name }))
            queryClient.invalidateQueries({ queryKey: [productionQueryKey] })
            queryClient.invalidateQueries({ queryKey: [purchasesQueryKey] })
            queryClient.invalidateQueries({ queryKey: [cuttingJobsQueryKey] })
            onClose()
        },
        onError: (error) => toast.error(errorMessage(error)),
    })

    return (
        <>
            <DialogHeader>
                <DialogTitle>{t('sendDialog.title', { mark: purchase.tag })}</DialogTitle>
                <DialogDescription>
                    {purchase.material} · {purchase.tons} t · {purchase.stones != null && `${purchase.stones} ${t('stones')} · `}{purchase.factoryName}
                </DialogDescription>
            </DialogHeader>

            {load.isLoading ? (
                <p className="text-muted-foreground text-sm">{tc('loading')}</p>
            ) : machines.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t('sendDialog.noMachines')}</p>
            ) : (
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <Label>{t('sendDialog.machine')}</Label>
                        <Select value={machine?.id} onValueChange={(v) => { setMachineChoice(v); setShift('day') }}>
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {machines.map((m) => {
                                    const n = load.data?.onMachine[m.id] ?? 0
                                    return (
                                        <SelectItem key={m.id} value={m.id}>
                                            {m.name} · {n ? t('sendDialog.trucksOn', { count: n }) : t('sendDialog.idle')}
                                        </SelectItem>
                                    )
                                })}
                            </SelectContent>
                        </Select>
                        {machine && (
                            <p className="text-muted-foreground text-xs">
                                {tm(machine.type)} · {t(`gives.${machine.type}`)}
                                {onIt > 0 && ` · ${t('sendDialog.severalOk')}`}
                            </p>
                        )}
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label>{t('sendDialog.thekadar')}</Label>
                        {machine?.nightThekadar ? (
                            <Select value={shift} onValueChange={(v) => setShift(v as 'day' | 'night')}>
                                <SelectTrigger className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="day">
                                        {machine.dayThekadar} · {t('sendDialog.day')}
                                    </SelectItem>
                                    <SelectItem value="night">
                                        {machine.nightThekadar} · {t('sendDialog.night')}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        ) : (
                            <p className="text-sm font-medium">{thekadarName}</p>
                        )}
                        <p className="text-muted-foreground text-xs">{t('sendDialog.wholeTruck')}</p>
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label>{t('sendDialog.date')}</Label>
                        <DatePicker value={date} onChange={setDate} placeholder={t('sendDialog.date')} min={purchase.minDate} max={todayIso()} />
                    </div>
                </div>
            )}

            <DialogFooter>
                <Button variant="outline" disabled={send.isPending} onClick={onClose}>
                    {tc('cancel')}
                </Button>
                <Button disabled={!machine || !date || send.isPending} onClick={() => send.mutate()}>
                    {send.isPending && <Loader2 className="animate-spin" />}
                    {t('sendDialog.submit')}
                </Button>
            </DialogFooter>
        </>
    )
}
