'use client'

import { Check, Pencil, X } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { daysSince, grossOf, type Purchase } from '@/features/purchases'
import { useDirection } from '@/hooks/use-direction'
import { useMoney } from '@/hooks/use-money'
import { PurchaseStatusBadge } from './purchase-status'

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">{label}</dt>
            <dd className="text-sm font-medium">{children}</dd>
        </div>
    )
}

/** Side panel for one truck: purchi details, mark, status history and the actions this role may take. */
export function PurchasePanel({
    purchase,
    onClose,
    canApprove,
    canEdit,
    onApprove,
    onReject,
    onEdit,
    onCancel,
    approving,
}: {
    purchase: Purchase | null
    onClose: () => void
    canApprove: boolean
    canEdit: boolean
    onApprove: (purchase: Purchase) => void
    onReject: (purchase: Purchase) => void
    onEdit: (purchase: Purchase) => void
    onCancel: (purchase: Purchase) => void
    approving?: boolean
}) {
    const t = useTranslations('purchases')
    const format = useFormatter()
    const money = useMoney()
    const { isRtl } = useDirection()
    const date = (iso: string) => format.dateTime(new Date(`${iso.slice(0, 10)}T00:00:00`), { dateStyle: 'medium' })

    const p = purchase
    const editable = !!p && (p.status === 'pending' || p.status === 'in_stock') && canEdit
    const history = p
        ? [
              { text: t('history.entered', { name: p.createdBy }), at: p.createdAt },
              ...(p.approvedBy && p.status !== 'rejected'
                  ? [{ text: t('history.approved', { name: p.approvedBy }), at: p.createdAt }]
                  : []),
              ...(p.status === 'rejected' ? [{ text: t('history.rejected', { name: p.approvedBy ?? '', reason: p.reason ?? '' }), at: p.createdAt }] : []),
              ...(p.status === 'cancelled' ? [{ text: t('history.cancelled', { reason: p.reason ?? '' }), at: p.createdAt }] : []),
          ]
        : []

    return (
        <Sheet open={!!p} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side={isRtl ? 'left' : 'right'} className="w-full overflow-y-auto sm:max-w-lg">
                {p && (
                    <>
                        <SheetHeader>
                            <SheetTitle className="flex items-center gap-2">
                                {p.mark ? <span className="text-primary tabular-nums" dir="ltr">{p.mark}</span> : t('noMarkYet')}
                                <PurchaseStatusBadge status={p.status} />
                            </SheetTitle>
                            <SheetDescription>
                                {t('purchi', { no: p.purchiNo })} · {p.truckNo}
                            </SheetDescription>
                        </SheetHeader>

                        <div className="flex flex-col gap-4 px-4 pb-4">
                            <div className="bg-muted rounded-lg p-4">
                                <div className="text-muted-foreground text-xs uppercase">{t('total')}</div>
                                <div className="text-2xl font-semibold tabular-nums">{money(p.total)}</div>
                                <div className="text-muted-foreground text-sm tabular-nums">
                                    {p.tons} × {money(p.ratePerTon)} = {money(grossOf(p.tons, p.ratePerTon))}
                                    {p.discount > 0 && ` − ${money(p.discount)}`}
                                </div>
                            </div>

                            <dl className="grid grid-cols-2 gap-4">
                                <Detail label={t('fields.supplier')}>{p.supplierName}</Detail>
                                <Detail label={t('fields.date')}>{date(p.date)}</Detail>
                                <Detail label={t('fields.material')}>{p.material}</Detail>
                                <Detail label={t('fields.stones')}>
                                    {p.stones}
                                    {p.mark && <span className="text-muted-foreground"> · {t('markedAs', { mark: p.mark })}</span>}
                                </Detail>
                                <Detail label={t('fields.factory')}>{p.factoryName}</Detail>
                                {p.status === 'in_stock' && (
                                    <Detail label={t('inYard')}>{t('days', { count: daysSince(p.date) })}</Detail>
                                )}
                            </dl>

                            {p.note && <p className="text-sm">{p.note}</p>}

                            <div>
                                <h3 className="mb-2 text-sm font-medium">{t('historyTitle')}</h3>
                                <ul className="flex flex-col gap-2 text-sm">
                                    {history.map((h, i) => (
                                        <li key={i} className="flex justify-between gap-3">
                                            <span>{h.text}</span>
                                            <span className="text-muted-foreground shrink-0">{date(h.at)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {p.status === 'pending' && canApprove && (
                                    <>
                                        <Button disabled={approving} onClick={() => onApprove(p)}>
                                            <Check /> {t('approve')}
                                        </Button>
                                        <Button variant="outline" onClick={() => onReject(p)}>
                                            <X /> {t('reject')}
                                        </Button>
                                    </>
                                )}
                                {p.status === 'pending' && !canApprove && (
                                    <span className="text-muted-foreground text-sm">{t('waitingForOwner')}</span>
                                )}
                                {editable && (
                                    <Button variant="outline" onClick={() => onEdit(p)}>
                                        <Pencil /> {t('edit')}
                                    </Button>
                                )}
                                {p.status === 'in_stock' && canApprove && (
                                    <Button variant="outline" onClick={() => onCancel(p)}>
                                        {t('cancelPurchase')}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>
    )
}
