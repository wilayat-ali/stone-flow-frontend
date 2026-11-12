'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Purchase } from '@/features/purchases'

/** Shown right after saving: the mark is painted on every stone, so it is big. */
export function MarkDialog({ purchase, onClose }: { purchase: Purchase | null; onClose: () => void }) {
    const t = useTranslations('purchases.mark')

    return (
        <Dialog open={!!purchase} onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                {purchase && (
                    <>
                        <DialogHeader>
                            <DialogTitle>{t('title')}</DialogTitle>
                            <DialogDescription>
                                {purchase.supplierName} · {t('purchi', { no: purchase.purchiNo })}
                            </DialogDescription>
                        </DialogHeader>
                        {purchase.mark ? (
                            <div className="flex flex-col items-center gap-2 py-4 text-center">
                                <p className="text-muted-foreground text-sm">{t('writeOnStones', { count: purchase.stones })}</p>
                                <p className="text-primary text-7xl font-extrabold tracking-widest tabular-nums" dir="ltr">
                                    {purchase.mark}
                                </p>
                                <p className="text-sm">
                                    {t('truckAt', { truck: purchase.truckNo, factory: purchase.factoryName })}
                                </p>
                            </div>
                        ) : (
                            <p className="text-muted-foreground py-4 text-center text-sm">{t('pending')}</p>
                        )}
                        <DialogFooter>
                            <Button onClick={onClose}>{t('done')}</Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}
