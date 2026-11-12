'use client'

import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { sizeLabel } from '@/features/piece-sizes'

/**
 * One box per size, to type counts fast. With `available`, only sizes that have stock are shown and
 * each says how many are in stock (an input cannot be more than that).
 */
export function SizeGrid({
    sizes,
    values,
    onChange,
    available,
}: {
    sizes: string[]
    values: Record<string, string>
    onChange: (size: string, value: string) => void
    available?: (size: string) => number
}) {
    const t = useTranslations('production.entries')
    const shown = available ? sizes.filter((s) => available(s) > 0) : sizes

    if (shown.length === 0) return <p className="text-muted-foreground text-sm">{t('nothingInStock')}</p>

    return (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-2">
            {shown.map((size) => {
                const have = available?.(size)
                const over = have !== undefined && Number(values[size] || 0) > have
                return (
                    <label key={size} className="bg-muted/40 flex flex-col gap-1 rounded-lg border p-2 text-sm">
                        <span className="font-semibold tabular-nums" dir="ltr">
                            {sizeLabel(size)}
                        </span>
                        <Input
                            value={values[size] ?? ''}
                            onChange={(e) => onChange(size, e.target.value.replace(/\D/g, ''))}
                            inputMode="numeric"
                            placeholder="0"
                            aria-label={t('piecesOf', { size: sizeLabel(size) })}
                            aria-invalid={over}
                            className="h-8"
                        />
                        {have !== undefined && (
                            <span className={over ? 'text-destructive text-xs' : 'text-muted-foreground text-xs'}>
                                {t('inStock', { count: have })}
                            </span>
                        )}
                    </label>
                )
            })}
        </div>
    )
}
