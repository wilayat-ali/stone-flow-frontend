'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, X } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePicker } from '@/components/shared/date-picker'
import { accountsKey, listAccounts } from '@/features/bank-cash/api'
import { counterWidthsQueryKey, listCounterWidths } from '@/features/counter-widths'
import { customersQueryKey, customerTypes, listCustomers, type CustomerType } from '@/features/customers'
import { factoriesQueryKey, listFactories } from '@/features/factories'
import { inventoryQueryKey } from '@/features/inventory'
import { pieceSizes, sizeLabel, sootTypes, widthInches, type SootType } from '@/features/piece-sizes'
import { stockedMaterials, type Finish, type StockItem } from '@/features/production-entries'
import {
    billsQueryKey,
    createBill,
    createOrder,
    orderRemaining,
    ordersQueryKey,
    lineAmount,
    subtotalOf,
    totalOf,
    updateBill,
    type Bill,
    type BillLine,
    type SalesOrder,
} from '@/features/sales'
import { lineHelper } from '@/features/sales-helper'
import { useSalesErrorMessage } from '@/features/use-sales-error-message'
import { useMoney } from '@/hooks/use-money'
import { todayIso, toIsoDate } from '@/lib/format'

type Kind = 'piece' | 'counter' | 'slab'

/** A line as it is typed: numbers stay strings until saved. */
export type DraftLine = {
    key: string
    lineNo?: number
    kind: Kind
    material: string
    soot: SootType
    size: string
    width: string
    finish: Finish
    qty: string
    inches: string
    tons: string
    rate: string
    orderLineId?: string | null
    /** From an order (07c): the item is fixed and the quantity cannot go above what remains. */
    fixed?: boolean
    maxQty?: number
    maxInches?: number
}

/** Start a bill from something else: an order's remaining stone, or a chosen customer. */
export type BillPreset = { customerId?: string; factoryId?: string; orderId?: string; lines?: DraftLine[]; note?: string }

const NONE: BillPreset = {}
const NEW = 'new'
const WALKIN = 'walkin'
const num = (v: string) => Number(v) || 0
let keySeq = 0
const newKey = () => `l${(keySeq += 1)}`

const blankLine = (material = ''): DraftLine => ({
    key: newKey(),
    kind: 'piece',
    material,
    soot: '14',
    size: pieceSizes['14'][0],
    width: '',
    finish: 'unpolished',
    qty: '',
    inches: '',
    tons: '',
    rate: '',
})

const toItem = (l: DraftLine, factoryId: string): StockItem =>
    l.kind === 'piece'
        ? { itemType: 'piece', material: l.material.trim(), factoryId, soot: l.soot, size: l.size, finish: l.finish }
        : l.kind === 'counter'
          ? { itemType: 'counter', material: l.material.trim(), factoryId, width: num(l.width), finish: l.finish }
          : { itemType: 'slab', material: l.material.trim(), factoryId }

const toBillLine = (l: DraftLine, factoryId: string, i: number): BillLine => ({
    lineNo: l.lineNo ?? 1000 + i,
    item: toItem(l, factoryId),
    qty: num(l.qty),
    inches: l.kind === 'counter' ? num(l.inches) : 0,
    tons: l.kind === 'slab' ? num(l.tons) : 0,
    rate: num(l.rate),
    orderLineId: l.orderLineId ?? null,
})

const fromBill = (line: BillLine): DraftLine => ({
    key: newKey(),
    lineNo: line.lineNo,
    kind: line.item.itemType,
    material: line.item.material,
    soot: (line.item.itemType === 'piece' ? line.item.soot : '14') as SootType,
    size: line.item.itemType === 'piece' ? line.item.size : pieceSizes['14'][0],
    width: line.item.itemType === 'counter' ? String(line.item.width) : '',
    finish: line.item.itemType === 'slab' ? 'unpolished' : line.item.finish,
    qty: String(line.qty),
    inches: line.inches ? String(line.inches) : '',
    tons: line.tons ? String(line.tons) : '',
    rate: String(line.rate),
    orderLineId: line.orderLineId,
})

/**
 * Make or edit a bill. The rate is typed for every item (the price is agreed with each customer); the
 * hint under each item only advises. Stone leaves the yard only when it is collected.
 */
export function BillDialog({
    open,
    bill,
    preset = NONE,
    userName,
    mode = 'bill',
    onClose,
    onSaved,
    onSavedOrder,
}: {
    open: boolean
    /** The bill being edited; omit to make a new one. */
    bill?: Bill
    preset?: BillPreset
    userName: string
    /** `order` is the same form without availability, discount, transport or collection, plus a needed-by date and an advance. */
    mode?: 'bill' | 'order'
    onClose: () => void
    /** Called with a new bill, so the page can open its parchi. */
    onSaved: (bill: Bill) => void
    onSavedOrder?: (order: SalesOrder) => void
}) {
    const t = useTranslations('sales.bill')
    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>{mode === 'order' ? t('orderTitle') : bill ? t('editTitle', { no: bill.billNo }) : preset.orderId ? t('fromOrderTitle') : t('title')}</DialogTitle>
                    <DialogDescription>{mode === 'order' ? t('orderDescription') : t('description')}</DialogDescription>
                </DialogHeader>
                {open && <BillForm bill={bill} preset={preset} userName={userName} mode={mode} onClose={onClose} onSaved={onSaved} onSavedOrder={onSavedOrder} />}
            </DialogContent>
        </Dialog>
    )
}

function BillForm({ bill, preset, userName, mode, onClose, onSaved, onSavedOrder }: { bill?: Bill; preset: BillPreset; userName: string; mode: 'bill' | 'order'; onClose: () => void; onSaved: (bill: Bill) => void; onSavedOrder?: (order: SalesOrder) => void }) {
    const isOrder = mode === 'order'
    const t = useTranslations('sales.bill')
    const tc = useTranslations('common')
    const tf = useTranslations('inventory.item.finishes')
    const format = useFormatter()
    const money = useMoney()
    const queryClient = useQueryClient()
    const errorMessage = useSalesErrorMessage()

    const customers = useQuery({ queryKey: [customersQueryKey], queryFn: listCustomers })
    const factories = useQuery({ queryKey: [factoriesQueryKey], queryFn: listFactories })
    const widths = useQuery({ queryKey: [counterWidthsQueryKey], queryFn: listCounterWidths })
    const accounts = useQuery({ queryKey: accountsKey, queryFn: listAccounts, enabled: !bill })
    const own = (factories.data ?? []).filter((f) => f.kind === 'own')

    const [customerChoice, setCustomerChoice] = useState(bill ? (bill.customerId ?? WALKIN) : (preset.customerId ?? ''))
    const [name, setName] = useState(bill && !bill.customerId ? bill.customerName : '')
    const [phone, setPhone] = useState(bill && !bill.customerId ? bill.customerPhone : '')
    const [customerType, setCustomerType] = useState<CustomerType>('builder')
    const [date, setDate] = useState(bill?.date ?? todayIso())
    const [factoryChoice, setFactoryChoice] = useState(bill?.factoryId ?? preset.factoryId ?? '')
    const [lines, setLines] = useState<DraftLine[]>(() => bill?.lines.map(fromBill) ?? preset.lines ?? [blankLine(stockedMaterials()[0] ?? '')])
    const [discount, setDiscount] = useState(bill?.discount ? String(bill.discount) : '')
    const [transport, setTransport] = useState(bill?.transport ? String(bill.transport) : '')
    const [note, setNote] = useState(bill?.note ?? preset.note ?? '')
    const [payMethod, setPayMethod] = useState<'none' | 'cash' | 'bank'>('none')
    const [payAmount, setPayAmount] = useState('')
    const [payAccount, setPayAccount] = useState('')
    const [takeAll, setTakeAll] = useState(true)
    const [neededBy, setNeededBy] = useState(() => {
        const d = new Date()
        d.setDate(d.getDate() + 10)
        return toIsoDate(d)
    })

    const factoryId = factoryChoice || own[0]?.id || ''
    const customerId = customerChoice && customerChoice !== WALKIN && customerChoice !== NEW ? customerChoice : null
    const billLines = lines.map((l, i) => toBillLine(l, factoryId, i))
    const total = totalOf(billLines, num(discount), num(transport))
    const walkin = customerChoice === WALKIN
    const fromOrder = !!preset.orderId
    const bankAccounts = (accounts.data ?? []).filter((a) => a.isActive && a.kind === 'bank')

    const patch = (key: string, p: Partial<DraftLine>) => setLines((cur) => cur.map((l) => (l.key === key ? { ...l, ...p } : l)))

    const save = useMutation({
        mutationFn: async (): Promise<Bill | SalesOrder> => {
            if (isOrder) {
                return createOrder(
                    {
                        customerId: customerChoice,
                        date,
                        neededBy,
                        factoryId,
                        factoryName: own.find((f) => f.id === factoryId)?.name ?? '',
                        lines: billLines,
                        note,
                        advance: { method: payMethod, amount: num(payAmount), accountName: bankAccounts.find((a) => a.id === payAccount)?.name ?? '' },
                    },
                    userName
                )
            }
            if (bill) {
                return updateBill(bill.id, { lines: billLines, discount: num(discount), transport: num(transport), note, date }, userName)
            }
            const method = walkin && payMethod === 'none' ? 'cash' : payMethod
            return createBill(
                {
                    customerId: customerChoice,
                    name,
                    phone,
                    customerType,
                    date,
                    factoryId,
                    factoryName: own.find((f) => f.id === factoryId)?.name ?? '',
                    lines: billLines,
                    discount: num(discount),
                    transport: num(transport),
                    note,
                    orderId: preset.orderId ?? null,
                    payment: { method, amount: walkin && !payAmount ? total : num(payAmount), accountName: bankAccounts.find((a) => a.id === payAccount)?.name ?? '' },
                    takeAll,
                },
                userName
            )
        },
        onSuccess: (saved) => {
            for (const key of [billsQueryKey, ordersQueryKey, inventoryQueryKey, customersQueryKey, 'customer-khata']) queryClient.invalidateQueries({ queryKey: [key] })
            onClose()
            if ('orderNo' in saved) {
                toast.success(t('orderSaved', { no: saved.orderNo }))
                onSavedOrder?.(saved)
                return
            }
            toast.success(bill ? t('updated', { no: saved.billNo }) : t('saved', { no: saved.billNo, total: money(saved.total) }))
            if (!bill) onSaved(saved)
        },
        onError: (error) => toast.error(errorMessage(error)),
    })

    const pick = (value: string, onChange: (v: string) => void, options: { value: string; label: string }[], placeholder?: string, disabled?: boolean) => (
        <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
            <SelectTrigger className="w-full">
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
                {options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                        {o.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
    const field = (label: string, control: React.ReactNode, className?: string) => (
        <div className={`flex flex-col gap-2 ${className ?? ''}`}>
            <Label>{label}</Label>
            {control}
        </div>
    )

    const unitRate = (kind: Kind) => (kind === 'piece' ? t('perSqft') : kind === 'counter' ? t('perInch') : t('perTon'))

    const canSave =
        lines.length > 0 &&
        lines.every((l) => l.material.trim() && num(l.qty) > 0 && num(l.rate) > 0 && (l.kind !== 'counter' || (num(l.inches) > 0 && num(l.width) > 0)) && (l.kind !== 'slab' || num(l.tons) > 0)) &&
        !!customerChoice &&
        (customerChoice !== NEW && !walkin ? true : !!name.trim() && !!phone.trim()) &&
        (isOrder || total > 0) &&
        !!factoryId &&
        !save.isPending

    const materials = stockedMaterials()

    return (
        <>
            <div className="bg-primary text-primary-foreground flex flex-wrap items-center justify-between gap-2 rounded-lg px-4 py-3" aria-live="polite">
                <div>
                    <div className="text-xs uppercase opacity-80">{isOrder ? t('orderTotal') : t('billTotal')}</div>
                    <div className="text-2xl font-semibold tabular-nums">{money(total)}</div>
                </div>
                <div className="text-sm tabular-nums opacity-90">
                    {money(subtotalOf(billLines))} {t('items')}
                    {num(discount) > 0 && <div>− {money(num(discount))} {t('discountShort')}</div>}
                    {num(transport) > 0 && <div>+ {money(num(transport))} {t('transportShort')}</div>}
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
                {field(
                    t('customer'),
                    bill || fromOrder
                        ? <p className="text-sm font-medium">{bill ? bill.customerName : (customers.data?.find((c) => c.id === customerChoice)?.name ?? '')}</p>
                        : pick(
                              customerChoice,
                              setCustomerChoice,
                              [
                                  ...(customers.data ?? []).map((c) => ({ value: c.id, label: `${c.name} · ${c.phone}` })),
                                  ...(isOrder ? [] : [{ value: WALKIN, label: t('walkin') }, { value: NEW, label: t('newCustomer') }]),
                              ],
                              t('chooseCustomer')
                          )
                )}
                {(walkin || customerChoice === NEW) && !bill && (
                    <>
                        {field(t('name'), <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />)}
                        {field(t('phone'), <Input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" placeholder="03xx-xxxxxxx" autoComplete="off" />)}
                    </>
                )}
                {customerChoice === NEW && !bill &&
                    field(t('customerType'), pick(customerType, (v) => setCustomerType(v as CustomerType), customerTypes.map((x) => ({ value: x, label: t(`customerTypes.${x}`) }))))}
                {field(isOrder ? t('orderDate') : t('date'), <DatePicker value={date} onChange={setDate} placeholder={t('date')} max={todayIso()} />)}
                {isOrder && field(t('neededBy'), <DatePicker value={neededBy} onChange={setNeededBy} placeholder={t('neededBy')} min={date} />)}
                {field(t('stoneFrom'), pick(factoryId, setFactoryChoice, own.map((f) => ({ value: f.id, label: f.name })), undefined, !!bill || fromOrder))}
            </div>

            <div className="flex flex-col gap-3">
                <h3 className="text-sm font-medium">{t('itemsTitle')}</h3>
                {lines.map((l) => {
                    const item = l.material.trim() ? toItem(l, factoryId) : null
                    const helper = item ? lineHelper(customerId, item, bill?.id) : null
                    const amount = lineAmount(toBillLine(l, factoryId, 0))
                    const rate = num(l.rate)
                    const below = helper?.cost != null && rate > 0 && rate < helper.cost
                    return (
                        <div key={l.key} className="bg-muted/30 relative grid gap-2 rounded-lg border p-3 sm:grid-cols-6">
                            {field(t('item'), pick(l.kind, (v) => patch(l.key, { kind: v as Kind }), [{ value: 'piece', label: t('kinds.piece') }, { value: 'counter', label: t('kinds.counter') }, { value: 'slab', label: t('kinds.slab') }], undefined, l.fixed))}
                            {field(t('material'), <><Input list="bill-materials" value={l.material} onChange={(e) => patch(l.key, { material: e.target.value })} disabled={l.fixed} autoComplete="off" /></>)}
                            {l.kind === 'piece' && (
                                <>
                                    {field(t('soot'), pick(l.soot, (v) => patch(l.key, { soot: v as SootType, size: pieceSizes[v as SootType][0] }), sootTypes.map((s) => ({ value: s, label: t('sootLabel', { soot: s }) })), undefined, l.fixed))}
                                    {field(t('size'), pick(l.size, (v) => patch(l.key, { size: v }), pieceSizes[l.soot].map((s) => ({ value: s, label: sizeLabel(s) })), undefined, l.fixed))}
                                </>
                            )}
                            {l.kind === 'counter' &&
                                field(t('width'), pick(l.width, (v) => patch(l.key, { width: v }), (widths.data ?? []).map((w) => ({ value: String(widthInches(w.name)), label: t('widthIn', { width: widthInches(w.name) }) })), undefined, l.fixed))}
                            {l.kind !== 'slab' &&
                                field(t('finish'), pick(l.finish, (v) => patch(l.key, { finish: v as Finish }), [{ value: 'unpolished', label: tf('unpolished') }, { value: 'polished', label: tf('polished') }], undefined, l.fixed))}
                            {field(l.kind === 'slab' ? t('slabs') : t('pieces'), <Input value={l.qty} onChange={(e) => patch(l.key, { qty: e.target.value.replace(/\D/g, '') })} inputMode="numeric" aria-invalid={l.maxQty !== undefined && num(l.qty) > l.maxQty} />)}
                            {l.kind === 'counter' && field(t('totalInches'), <Input value={l.inches} onChange={(e) => patch(l.key, { inches: e.target.value.replace(/\D/g, '') })} inputMode="numeric" />)}
                            {l.kind === 'slab' && field(t('kantaWeight'), <Input value={l.tons} onChange={(e) => patch(l.key, { tons: e.target.value.replace(/[^\d.]/g, '') })} inputMode="decimal" />)}
                            {field(unitRate(l.kind), <Input value={l.rate} onChange={(e) => patch(l.key, { rate: e.target.value.replace(/[^\d.]/g, '') })} inputMode="decimal" />)}
                            <div className="flex flex-col justify-end gap-1">
                                <span className="text-muted-foreground text-xs">{t('amount')}</span>
                                <span className="text-lg font-semibold tabular-nums">{money(amount)}</span>
                            </div>

                            {helper && (
                                <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs sm:col-span-6">
                                    {!isOrder && <span>
                                        {t('available')}:{' '}
                                        <b className="text-foreground tabular-nums">
                                            {format.number(Math.max(0, l.kind === 'counter' ? helper.availableInches : helper.available))} {l.kind === 'counter' ? t('inchesShort') : l.kind === 'slab' ? t('slabsShort') : t('pcsShort')}
                                        </b>
                                        {helper.reserved > 0 && ` (${t('booked', { count: helper.reserved })})`}
                                    </span>}
                                    {helper.lastRate && (
                                        <span>
                                            {t('lastRate')}: <b className="text-foreground tabular-nums">{money(helper.lastRate.rate)}</b> ({format.dateTime(new Date(`${helper.lastRate.date}T00:00:00`), { dateStyle: 'medium' })})
                                        </span>
                                    )}
                                    {helper.cost != null && (
                                        <span className={below ? 'text-destructive font-semibold' : undefined}>
                                            {below ? t('belowCost', { cost: money(Math.round(helper.cost)) }) : t('cost', { cost: money(Math.round(helper.cost)) })}
                                        </span>
                                    )}
                                    {l.maxQty !== undefined && <span>{t('leftOnOrder', { count: l.maxQty })}</span>}
                                </div>
                            )}

                            {!l.fixed && lines.length > 1 && !(bill && l.lineNo && bill.collections.some((c) => c.lines.some((x) => x.lineNo === l.lineNo))) && (
                                <Button type="button" variant="ghost" size="icon" className="absolute end-1 top-1 size-7" aria-label={t('removeItem')} onClick={() => setLines((cur) => cur.filter((x) => x.key !== l.key))}>
                                    <X />
                                </Button>
                            )}
                        </div>
                    )
                })}
                <datalist id="bill-materials">
                    {materials.map((m) => (
                        <option key={m} value={m} />
                    ))}
                </datalist>
                {!fromOrder && (
                    <div>
                        <Button type="button" variant="outline" size="sm" onClick={() => setLines((cur) => [...cur, blankLine(cur[cur.length - 1]?.material ?? materials[0] ?? '')])}>
                            <Plus /> {t('addItem')}
                        </Button>
                    </div>
                )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
                {!isOrder && field(t('discount'), <Input value={discount} onChange={(e) => setDiscount(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="0" />)}
                {!isOrder && field(t('transport'), <Input value={transport} onChange={(e) => setTransport(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="0" />)}
                {field(t('note'), <Input value={note} onChange={(e) => setNote(e.target.value)} />)}
            </div>
            {!isOrder && <p className="text-muted-foreground -mt-1 text-xs">{t('transportHint')}</p>}

            {!bill && (
                <fieldset className="flex flex-col gap-3 rounded-lg border p-3">
                    <legend className="px-1 text-sm font-medium">{isOrder ? t('advance') : t('paymentNow')}</legend>
                    <div className="grid gap-3 sm:grid-cols-3">
                        {field(t('how'), pick(walkin && payMethod === 'none' ? 'cash' : payMethod, (v) => setPayMethod(v as 'none' | 'cash' | 'bank'), [
                            ...(walkin ? [] : [{ value: 'none', label: isOrder ? t('noAdvance') : t('nothingUdhaar') }]),
                            { value: 'cash', label: t('cash') },
                            { value: 'bank', label: t('bank') },
                        ]))}
                        {(payMethod !== 'none' || walkin) && field(t('amountPaid'), <Input value={payAmount || (walkin ? String(total || '') : '')} onChange={(e) => setPayAmount(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />)}
                        {payMethod === 'bank' && field(t('account'), pick(payAccount, setPayAccount, bankAccounts.map((a) => ({ value: a.id, label: a.name })), t('chooseAccount')))}
                    </div>
                    <p className="text-muted-foreground text-xs">{walkin ? t('walkinHint') : ''}</p>
                    {!isOrder && (
                        <label className="flex items-center gap-2 text-sm">
                            <Checkbox checked={takeAll} onCheckedChange={(c) => setTakeAll(!!c)} />
                            {t('takesAll')}
                        </label>
                    )}
                </fieldset>
            )}

            <DialogFooter>
                <Button variant="outline" disabled={save.isPending} onClick={onClose}>
                    {tc('cancel')}
                </Button>
                <Button disabled={!canSave} onClick={() => save.mutate()}>
                    {save.isPending && <Loader2 className="animate-spin" />}
                    {isOrder ? t('saveOrder') : bill ? t('saveChanges') : t('saveBill')}
                </Button>
            </DialogFooter>
        </>
    )
}

/**
 * The bill draft for an order: its remaining quantities, with the item, factory and rate fixed. The
 * person may bill less (to bill in parts) but not more than what remains.
 */
export function draftsFromOrder(order: SalesOrder): DraftLine[] {
    return order.lines.flatMap((line) => {
        const rem = orderRemaining(line)
        if (rem.qty <= 0 && rem.inches <= 0) return []
        return [
            {
                ...fromBill(line),
                lineNo: undefined,
                qty: String(rem.qty),
                inches: rem.inches ? String(rem.inches) : '',
                tons: rem.tons ? String(Math.round(rem.tons * 100) / 100) : '',
                orderLineId: line.id,
                fixed: true,
                maxQty: rem.qty,
                maxInches: rem.inches || undefined,
            },
        ]
    })
}
