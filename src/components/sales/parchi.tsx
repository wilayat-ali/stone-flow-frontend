'use client'

import { MessageCircle, Printer } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useItemText } from '@/components/inventory/use-item-text'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { whatsappLink } from '@/features/customers'
import { companyProfile } from '@/features/company-profile'
import { lineAmount, lineSqFt, lineUnit, khataBalanceOf, remainingOf, subtotalOf, toCollect, type Bill, type BillLine, type Collection } from '@/features/sales'
import { useMoney } from '@/hooks/use-money'
import en from '@/messages/en.json'
import ur from '@/messages/ur.json'
import { PrintArea } from './print-area'

type PrintKey = keyof typeof en.sales.print

/** A label in English with its Urdu beneath it, whatever language the screen is in. */
function Bi({ k }: { k: PrintKey }) {
    return (
        <span className="flex flex-col leading-tight">
            <span>{en.sales.print[k]}</span>
            <span lang="ur" dir="rtl" className="text-xs" style={{ fontFamily: 'var(--font-urdu)' }}>
                {ur.sales.print[k]}
            </span>
        </span>
    )
}

function useLineQty() {
    const t = useTranslations('sales.units')
    const format = useFormatter()
    return (line: BillLine) => {
        if (line.item.itemType === 'piece') return { main: `${format.number(line.qty)} ${t('pcs')}`, sub: `${format.number(lineSqFt(line), { maximumFractionDigits: 1 })} ${t('sqft')}` }
        if (line.item.itemType === 'counter') return { main: `${format.number(line.qty)} ${t('pcs')}`, sub: `${format.number(line.inches)} ${t('inch')}` }
        return { main: `${format.number(line.qty)} ${t('slabs')}`, sub: `${format.number(line.tons, { maximumFractionDigits: 2 })} ${t('tons')}` }
    }
}

const dateOf = (iso: string, format: ReturnType<typeof useFormatter>) => format.dateTime(new Date(`${iso}T00:00:00`), { dateStyle: 'medium' })

/** The bill slip: company, customer, items, totals, what was paid, the khata balance. English and Urdu. */
export function ParchiContent({ bill }: { bill: Bill }) {
    const money = useMoney()
    const format = useFormatter()
    const itemText = useItemText()
    const lineQty = useLineQty()
    const tu = useTranslations('sales.units')
    const paid = bill.payments.reduce((s, p) => s + p.amount, 0)
    const balance = khataBalanceOf(bill)

    return (
        <div className="flex flex-col gap-3 text-sm">
            <div className="flex items-start justify-between gap-4 border-b-2 pb-3">
                <div>
                    <div className="text-lg font-extrabold">{companyProfile.name}</div>
                    <div className="text-xs">
                        {companyProfile.address} · <bdi dir="ltr">{companyProfile.phone}</bdi>
                    </div>
                </div>
                <div className="text-end">
                    <div className="font-bold">
                        <Bi k="parchiTitle" />
                    </div>
                    <div className="font-mono font-bold">{bill.billNo}</div>
                    <div className="text-xs">{dateOf(bill.date, format)}</div>
                </div>
            </div>

            <div className="flex flex-wrap justify-between gap-2">
                <div>
                    <Bi k="customer" />
                    <b>{bill.customerName}</b>
                </div>
                <bdi dir="ltr">{bill.customerPhone}</bdi>
            </div>

            <table className="w-full border-collapse">
                <thead>
                    <tr className="border-b text-start text-xs">
                        <th className="py-1 text-start"><Bi k="item" /></th>
                        <th className="py-1 text-end"><Bi k="qty" /></th>
                        <th className="py-1 text-end"><Bi k="rate" /></th>
                        <th className="py-1 text-end"><Bi k="amount" /></th>
                    </tr>
                </thead>
                <tbody>
                    {bill.lines.map((line) => {
                        const q = lineQty(line)
                        return (
                            <tr key={line.lineNo} className="border-b align-top">
                                <td className="py-1.5">{itemText(line.item)}</td>
                                <td className="py-1.5 text-end tabular-nums">
                                    {q.main}
                                    <div className="text-xs">{q.sub}</div>
                                </td>
                                <td className="py-1.5 text-end tabular-nums">
                                    {format.number(line.rate)}/{tu(lineUnit(line.item))}
                                </td>
                                <td className="py-1.5 text-end tabular-nums">{format.number(lineAmount(line))}</td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>

            <div className="ms-auto flex w-full max-w-xs flex-col gap-1 tabular-nums">
                <div className="flex justify-between"><Bi k="subtotal" /><span>{money(subtotalOf(bill.lines))}</span></div>
                {bill.discount > 0 && <div className="flex justify-between"><Bi k="discount" /><span>− {money(bill.discount)}</span></div>}
                {bill.transport > 0 && <div className="flex justify-between"><Bi k="transport" /><span>+ {money(bill.transport)}</span></div>}
                <div className="flex justify-between border-t-2 pt-1 text-base font-extrabold"><Bi k="total" /><span>{money(bill.total)}</span></div>
                <div className="flex justify-between"><Bi k="paidWithBill" /><span>{money(paid)}</span></div>
                {bill.customerId && (
                    <div className="flex justify-between font-bold">
                        <Bi k={balance < 0 ? 'advanceBalance' : 'khataBalance'} />
                        <span>{money(Math.abs(balance))}</span>
                    </div>
                )}
            </div>

            {toCollect(bill) && (
                <div className="text-xs font-semibold">
                    <Bi k="stillToCollect" />
                </div>
            )}

            <div className="text-muted-foreground mt-4 flex justify-between text-xs">
                <Bi k="signature" />
                <Bi k="thanks" />
            </div>
        </div>
    )
}

/** What the customer's collection looked like, for the gate: what left now and what is still to collect. */
export function GatePassContent({ bill, collection }: { bill: Bill; collection: Collection }) {
    const format = useFormatter()
    const itemText = useItemText()
    const tu = useTranslations('sales.units')

    return (
        <div className="flex flex-col gap-3 text-sm">
            <div className="flex items-start justify-between gap-4 border-b-2 pb-3">
                <div>
                    <div className="text-lg font-extrabold">{companyProfile.name}</div>
                    <div className="text-xs">{companyProfile.address}</div>
                </div>
                <div className="text-end">
                    <div className="font-bold"><Bi k="gateTitle" /></div>
                    <div className="font-mono font-bold">{collection.collNo} · {bill.billNo}</div>
                    <div className="text-xs">{dateOf(collection.date, format)}</div>
                </div>
            </div>
            <div className="flex flex-wrap justify-between gap-3">
                <div>
                    <Bi k="customer" />
                    <b>{bill.customerName}</b>
                </div>
                <div>
                    <Bi k="vehicle" />
                    <b dir="ltr">{collection.vehicle || '—'}</b>
                </div>
            </div>
            <table className="w-full border-collapse">
                <thead>
                    <tr className="border-b text-xs">
                        <th className="py-1 text-start"><Bi k="item" /></th>
                        <th className="py-1 text-end"><Bi k="givenNow" /></th>
                        <th className="py-1 text-end"><Bi k="stillLeft" /></th>
                    </tr>
                </thead>
                <tbody>
                    {collection.lines.map((l) => {
                        const line = bill.lines.find((x) => x.lineNo === l.lineNo)
                        if (!line) return null
                        const rem = remainingOf(bill, line)
                        const counter = line.item.itemType === 'counter'
                        return (
                            <tr key={l.lineNo} className="border-b align-top">
                                <td className="py-1.5">{itemText(line.item)}</td>
                                <td className="py-1.5 text-end tabular-nums">
                                    {format.number(l.qty)} {line.item.itemType === 'slab' ? tu('slabs') : tu('pcs')}
                                    {counter && <div className="text-xs">{format.number(l.inches)} {tu('inch')}</div>}
                                </td>
                                <td className="py-1.5 text-end tabular-nums">{rem.qty || rem.inches ? `${format.number(rem.qty)}${counter ? ` · ${format.number(rem.inches)} ${tu('inch')}` : ''}` : '—'}</td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
            <div className="text-muted-foreground mt-4 flex justify-between text-xs">
                <Bi k="munshi" />
                <Bi k="receiver" />
            </div>
        </div>
    )
}

/** The parchi in a dialog, with Print and a WhatsApp link that carries a text summary. */
export function ParchiDialog({ bill, onClose }: { bill: Bill | null; onClose: () => void }) {
    const t = useTranslations('sales.parchi')
    const tc = useTranslations('common')
    const money = useMoney()
    const itemText = useItemText()
    const lineQty = useLineQty()

    const message = bill
        ? [
              `${companyProfile.name}`,
              `${t('whatsappBill', { no: bill.billNo })}`,
              ...bill.lines.map((l) => `${itemText(l.item)}: ${lineQty(l).main} × ${l.rate} = ${lineAmount(l)}`),
              `${t('whatsappTotal', { total: money(bill.total) })}`,
              `${t('whatsappPaid', { paid: money(bill.payments.reduce((s, p) => s + p.amount, 0)) })}`,
              ...(bill.customerId ? [t('whatsappBalance', { balance: money(Math.max(0, khataBalanceOf(bill))) })] : []),
          ].join('\n')
        : ''

    return (
        <Dialog open={!!bill} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                {bill && (
                    <>
                        <DialogHeader>
                            <DialogTitle>{t('title', { no: bill.billNo })}</DialogTitle>
                            <DialogDescription>{t('description')}</DialogDescription>
                        </DialogHeader>
                        <div className="rounded-lg border p-4">
                            <ParchiContent bill={bill} />
                        </div>
                        <PrintArea>
                            <ParchiContent bill={bill} />
                        </PrintArea>
                        <DialogFooter>
                            <Button variant="outline" onClick={onClose}>
                                {tc('back')}
                            </Button>
                            {bill.customerPhone && (
                                <Button variant="outline" asChild>
                                    <a href={whatsappLink(bill.customerPhone, message)} target="_blank" rel="noopener noreferrer">
                                        <MessageCircle /> {t('whatsapp')}
                                    </a>
                                </Button>
                            )}
                            <Button onClick={() => window.print()}>
                                <Printer /> {t('print')}
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}

export function GatePassDialog({ target, onClose }: { target: { bill: Bill; collection: Collection } | null; onClose: () => void }) {
    const t = useTranslations('sales.gate')
    const tc = useTranslations('common')

    return (
        <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                {target && (
                    <>
                        <DialogHeader>
                            <DialogTitle>{t('title', { no: target.collection.collNo })}</DialogTitle>
                            <DialogDescription>{t('description', { bill: target.bill.billNo, customer: target.bill.customerName })}</DialogDescription>
                        </DialogHeader>
                        <div className="rounded-lg border p-4">
                            <GatePassContent bill={target.bill} collection={target.collection} />
                        </div>
                        <PrintArea>
                            <GatePassContent bill={target.bill} collection={target.collection} />
                        </PrintArea>
                        <DialogFooter>
                            <Button variant="outline" onClick={onClose}>
                                {tc('back')}
                            </Button>
                            <Button onClick={() => window.print()}>
                                <Printer /> {t('print')}
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}
