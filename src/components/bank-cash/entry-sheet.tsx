'use client'

import { useFormatter, useTranslations } from 'next-intl'
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import { useDirection } from '@/hooks/use-direction'
import { formatLakh } from '@/lib/format'
import type { StatementRow } from '@/features/bank-cash/ledger'

/** Side panel with the full detail of one statement row. */
export function EntrySheet({
    row,
    accountName,
    onClose,
}: {
    row: StatementRow | null
    accountName: string
    onClose: () => void
}) {
    const t = useTranslations('settings.bankCash')
    const format = useFormatter()
    const { isRtl } = useDirection()

    const fields: [string, string | null][] = row
        ? [
              [t('account'), accountName],
              [t('date'), format.dateTime(new Date(`${row.date}T00:00:00`), { dateStyle: 'medium' })],
              [row.in ? t('in') : t('out'), formatLakh(row.in || row.out)],
              [t('balance'), formatLakh(row.balance)],
              [t('reference'), row.refNo],
              [t('note'), row.note],
          ]
        : []

    return (
        <Sheet open={!!row} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side={isRtl ? 'left' : 'right'}>
                <SheetHeader>
                    <SheetTitle>{row && t(`types.${row.type}`)}</SheetTitle>
                    <SheetDescription className="sr-only">{accountName}</SheetDescription>
                </SheetHeader>
                <dl className="flex flex-col gap-4 px-4">
                    {fields.map(
                        ([label, value]) =>
                            value && (
                                <div key={label} className="flex flex-col gap-1">
                                    <dt className="text-muted-foreground text-sm">{label}</dt>
                                    <dd className="font-medium">
                                        <bdi>{value}</bdi>
                                    </dd>
                                </div>
                            )
                    )}
                </dl>
            </SheetContent>
        </Sheet>
    )
}
