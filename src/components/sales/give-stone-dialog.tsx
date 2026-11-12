'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useItemText } from '@/components/inventory/use-item-text'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/shared/date-picker'
import { inventoryQueryKey } from '@/features/inventory'
import { stockOnHand } from '@/features/production-entries'
import { billsQueryKey, giveStone, remainingOf, type Bill, type Collection } from '@/features/sales'
import { useSalesErrorMessage } from '@/features/use-sales-error-message'
import { todayIso } from '@/lib/format'

/**
 * Collection: stone leaves the yard now. Each line takes at most what is left on the bill and what is
 * physically in stock; the collection posts a stock movement out and prints a gate pass.
 */
export function GiveStoneDialog({
    bill,
    userName,
    onClose,
    onGiven,
}: {
    bill: Bill | null
    userName: string
    onClose: () => void
    /** Called with the new collection so the page can open its gate pass. */
    onGiven: (bill: Bill, collection: Collection) => void
}) {
    const t = useTranslations('sales.give')
    return (
        <Dialog open={!!bill} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
                {bill && <GiveForm key={bill.id} bill={bill} userName={userName} onClose={onClose} onGiven={onGiven} title={t('title', { no: bill.billNo })} />}
            </DialogContent>
        </Dialog>
    )
}

function GiveForm({ bill, userName, title, onClose, onGiven }: { bill: Bill; userName: string; title: string; onClose: () => void; onGiven: (bill: Bill, collection: Collection) => void }) {
    const t = useTranslations('sales.give')
    const tc = useTranslations('common')
    const format = useFormatter()
    const itemText = useItemText()
    const queryClient = useQueryClient()
    const errorMessage = useSalesErrorMessage()

    const open = bill.lines.map((line) => ({ line, rem: remainingOf(bill, line) })).filter((x) => x.rem.qty > 0 || x.rem.inches > 0)
    // Everything that is left is filled in; the person takes away what is not leaving today.
    const [qty, setQty] = useState<Record<number, string>>(() => Object.fromEntries(open.map((x) => [x.line.lineNo, String(x.rem.qty)])))
    const [inches, setInches] = useState<Record<number, string>>(() => Object.fromEntries(open.map((x) => [x.line.lineNo, String(x.rem.inches)])))
    const [vehicle, setVehicle] = useState('')
    const [receivedBy, setReceivedBy] = useState('')
    const [date, setDate] = useState(todayIso())

    const give = useMutation({
        mutationFn: () =>
            giveStone(
                bill.id,
                {
                    date,
                    vehicle,
                    receivedBy,
                    lines: open.map((x) => ({ lineNo: x.line.lineNo, qty: Number(qty[x.line.lineNo]) || 0, inches: x.line.item.itemType === 'counter' ? Number(inches[x.line.lineNo]) || 0 : 0 })),
                },
                userName
            ),
        onSuccess: ({ bill: saved, collection }) => {
            toast.success(t('given', { no: collection.collNo }))
            for (const key of [billsQueryKey, inventoryQueryKey]) queryClient.invalidateQueries({ queryKey: [key] })
            onClose()
            onGiven(saved, collection)
        },
        onError: (error) => toast.error(errorMessage(error)),
    })

    const any = open.some((x) => Number(qty[x.line.lineNo]) > 0)

    return (
        <>
            <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>{t('description', { customer: bill.customerName })}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
                {open.map(({ line, rem }) => {
                    const have = stockOnHand({ ...line.item, factoryId: bill.factoryId })
                    const counter = line.item.itemType === 'counter'
                    return (
                        <div key={line.lineNo} className="bg-muted/30 flex flex-col gap-2 rounded-lg border p-3">
                            <div className="text-sm font-medium">{itemText(line.item)}</div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col gap-1">
                                    <Label className="text-xs">
                                        {line.item.itemType === 'slab' ? t('slabs') : t('pieces')} ({t('left', { count: format.number(rem.qty) })})
                                    </Label>
                                    <Input value={qty[line.lineNo] ?? ''} onChange={(e) => setQty((c) => ({ ...c, [line.lineNo]: e.target.value.replace(/\D/g, '') }))} inputMode="numeric" aria-invalid={Number(qty[line.lineNo]) > Math.min(rem.qty, have.qty)} />
                                </div>
                                {counter && (
                                    <div className="flex flex-col gap-1">
                                        <Label className="text-xs">
                                            {t('inches')} ({t('left', { count: format.number(rem.inches) })})
                                        </Label>
                                        <Input value={inches[line.lineNo] ?? ''} onChange={(e) => setInches((c) => ({ ...c, [line.lineNo]: e.target.value.replace(/\D/g, '') }))} inputMode="numeric" />
                                    </div>
                                )}
                            </div>
                            <p className={have.qty < rem.qty ? 'text-destructive text-xs' : 'text-muted-foreground text-xs'}>{t('inStock', { count: format.number(have.qty) })}</p>
                        </div>
                    )
                })}
                <div className="grid gap-3 sm:grid-cols-3">
                    <div className="flex flex-col gap-2">
                        <Label>{t('date')}</Label>
                        <DatePicker value={date} onChange={setDate} placeholder={t('date')} min={bill.date} max={todayIso()} />
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="give-vehicle">{t('vehicle')}</Label>
                        <Input id="give-vehicle" value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="Shehzore KHI-551" dir="ltr" />
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="give-by">{t('receivedBy')}</Label>
                        <Input id="give-by" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} />
                    </div>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" disabled={give.isPending} onClick={onClose}>
                    {tc('cancel')}
                </Button>
                <Button disabled={!any || !date || give.isPending} onClick={() => give.mutate()}>
                    {give.isPending && <Loader2 className="animate-spin" />}
                    {t('submit')}
                </Button>
            </DialogFooter>
        </>
    )
}
