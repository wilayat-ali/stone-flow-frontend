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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePicker } from '@/components/shared/date-picker'
import { approvalsKey } from '@/features/approvals/api'
import { companySettingsKey, getCompanySettings } from '@/features/company-settings'
import { counterWidthsQueryKey, listCounterWidths } from '@/features/counter-widths'
import { factoriesQueryKey, listFactories } from '@/features/factories'
import { inventoryQueryKey } from '@/features/inventory'
import { pieceSizes, sootTypes, widthInches, type SootType } from '@/features/piece-sizes'
import { stockOnHand, stockedMaterials, type Finish, type StockItem } from '@/features/production-entries'
import {
    adjustmentReasons,
    createStockEntry,
    stockEntriesQueryKey,
    type AdjustmentReason,
    type StockEntryType,
} from '@/features/stock-entries'
import { useInventoryErrorMessage } from '@/features/use-inventory-error-message'
import { sizeLabel } from '@/features/piece-sizes'
import { todayIso } from '@/lib/format'

type Kind = 'piece' | 'counter' | 'slab'

/**
 * A stock entry: opening stock (owner only), an adjustment, or a transfer. It shows only the fields the
 * item needs, and "In stock now" while you type. A munshi's entry waits for the owner when approval is on.
 */
export function StockEntryDialog({
    open,
    roleKey,
    userName,
    onClose,
}: {
    open: boolean
    roleKey: string
    userName: string
    onClose: () => void
}) {
    const t = useTranslations('inventory.entry')
    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>{t('title')}</DialogTitle>
                    <DialogDescription>{t('description')}</DialogDescription>
                </DialogHeader>
                {open && <Form roleKey={roleKey} userName={userName} onClose={onClose} />}
            </DialogContent>
        </Dialog>
    )
}

function Form({ roleKey, userName, onClose }: { roleKey: string; userName: string; onClose: () => void }) {
    const t = useTranslations('inventory.entry')
    const tc = useTranslations('common')
    const tf = useTranslations('inventory.item.finishes')
    const queryClient = useQueryClient()
    const errorMessage = useInventoryErrorMessage()

    const factories = useQuery({ queryKey: [factoriesQueryKey], queryFn: listFactories })
    const widths = useQuery({ queryKey: [counterWidthsQueryKey], queryFn: listCounterWidths })
    const settings = useQuery({ queryKey: companySettingsKey, queryFn: getCompanySettings })

    const types: StockEntryType[] = [...(roleKey === 'owner' ? (['opening'] as const) : []), 'adjustment', 'transfer']
    const own = (factories.data ?? []).filter((f) => f.kind === 'own')
    // A transfer needs a second factory to move to.
    const availableTypes = types.filter((x) => x !== 'transfer' || own.length > 1)

    const [type, setType] = useState<StockEntryType>(types[0])
    const [direction, setDirection] = useState<'1' | '-1'>('-1')
    const [reason, setReason] = useState<AdjustmentReason>('broken')
    const [kind, setKind] = useState<Kind>('piece')
    const [material, setMaterial] = useState('')
    const [soot, setSoot] = useState<SootType>('14')
    const [size, setSize] = useState(pieceSizes['14'][0])
    const [width, setWidth] = useState('')
    const [finish, setFinish] = useState<Finish>('unpolished')
    const [qty, setQty] = useState('')
    const [inches, setInches] = useState('')
    const [factoryChoice, setFactoryChoice] = useState('')
    const [toChoice, setToChoice] = useState('')
    const [date, setDate] = useState(todayIso())
    const [note, setNote] = useState('')

    const factoryId = factoryChoice || own[0]?.id || ''
    const toFactoryId = toChoice || own.find((f) => f.id !== factoryId)?.id || ''
    const widthValue = width || String(widthInches(widths.data?.[0]?.name ?? '')) || ''

    const item: StockItem | null = !material.trim()
        ? null
        : kind === 'piece'
          ? { itemType: 'piece', material: material.trim(), factoryId, soot, size, finish }
          : kind === 'counter'
            ? { itemType: 'counter', material: material.trim(), factoryId, width: Number(widthValue) || 0, finish }
            : { itemType: 'slab', material: material.trim(), factoryId }

    const have = item ? stockOnHand(item) : null
    const removes = type === 'transfer' || (type === 'adjustment' && direction === '-1')
    const pending = roleKey === 'munshi' && (settings.data?.approvalRequired ?? true)

    const save = useMutation({
        mutationFn: () =>
            createStockEntry(
                {
                    type,
                    date,
                    direction: type === 'adjustment' ? (Number(direction) as 1 | -1) : 1,
                    reason: type === 'adjustment' ? reason : null,
                    note,
                    item: item!,
                    qty: Number(qty),
                    inches: kind === 'counter' ? Number(inches) : 0,
                    factoryName: own.find((f) => f.id === factoryId)?.name ?? '',
                    toFactoryId: type === 'transfer' ? toFactoryId : null,
                    toFactoryName: type === 'transfer' ? (own.find((f) => f.id === toFactoryId)?.name ?? null) : null,
                },
                { pending, by: userName, roleKey }
            ),
        onSuccess: (entry) => {
            toast.success(entry.status === 'pending' ? t('sentForApproval', { no: entry.entryNo }) : t('saved', { no: entry.entryNo }))
            for (const key of [stockEntriesQueryKey, inventoryQueryKey, approvalsKey[0]]) queryClient.invalidateQueries({ queryKey: [key] })
            onClose()
        },
        onError: (error) => toast.error(errorMessage(error)),
    })

    const pick = (value: string, onChange: (v: string) => void, options: { value: string; label: string }[], placeholder?: string) => (
        <Select value={value || undefined} onValueChange={onChange}>
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

    const canSave = !!item && Number(qty) > 0 && (kind !== 'counter' || Number(inches) > 0) && (kind !== 'counter' || item.itemType !== 'counter' || item.width > 0) && !!factoryId && !save.isPending

    return (
        <>
            <div className="grid gap-3 sm:grid-cols-2">
                {field(t('type'), pick(type, (v) => setType(v as StockEntryType), availableTypes.map((x) => ({ value: x, label: t(`types.${x}`) }))), 'sm:col-span-2')}

                {type === 'adjustment' && (
                    <>
                        {field(t('direction'), pick(direction, (v) => setDirection(v as '1' | '-1'), [{ value: '-1', label: t('remove') }, { value: '1', label: t('add') }]))}
                        {field(t('reason'), pick(reason, (v) => setReason(v as AdjustmentReason), adjustmentReasons.map((r) => ({ value: r, label: t(`reasons.${r}`) }))))}
                    </>
                )}

                {field(t('item'), pick(kind, (v) => setKind(v as Kind), [{ value: 'piece', label: t('kinds.piece') }, { value: 'counter', label: t('kinds.counter') }, { value: 'slab', label: t('kinds.slab') }]))}
                {field(
                    t('material'),
                    <>
                        <Input list="stock-materials" value={material} onChange={(e) => setMaterial(e.target.value)} autoComplete="off" />
                        <datalist id="stock-materials">
                            {stockedMaterials().map((m) => (
                                <option key={m} value={m} />
                            ))}
                        </datalist>
                    </>
                )}

                {kind === 'piece' && (
                    <>
                        {field(t('soot'), pick(soot, (v) => { setSoot(v as SootType); setSize(pieceSizes[v as SootType][0]) }, sootTypes.map((s) => ({ value: s, label: t('sootLabel', { soot: s }) }))))}
                        {field(t('size'), pick(size, setSize, pieceSizes[soot].map((s) => ({ value: s, label: sizeLabel(s) }))))}
                    </>
                )}
                {kind === 'counter' &&
                    field(t('width'), pick(widthValue, setWidth, (widths.data ?? []).map((w) => ({ value: String(widthInches(w.name)), label: t('widthIn', { width: widthInches(w.name) }) }))))}
                {kind !== 'slab' && field(t('finish'), pick(finish, (v) => setFinish(v as Finish), [{ value: 'unpolished', label: tf('unpolished') }, { value: 'polished', label: tf('polished') }]))}

                {field(kind === 'slab' ? t('slabs') : t('pieces'), <Input value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />)}
                {kind === 'counter' && field(t('totalInches'), <Input value={inches} onChange={(e) => setInches(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />)}

                {field(type === 'transfer' ? t('from') : t('factory'), pick(factoryId, setFactoryChoice, own.map((f) => ({ value: f.id, label: f.name }))))}
                {type === 'transfer' && field(t('to'), pick(toFactoryId, setToChoice, own.filter((f) => f.id !== factoryId).map((f) => ({ value: f.id, label: f.name }))))}
                {field(t('date'), <DatePicker value={date} onChange={setDate} placeholder={t('date')} max={todayIso()} />)}
                {field(t('note'), <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('notePlaceholder')} />, 'sm:col-span-2')}
            </div>

            {have && (
                <p className={removes && Number(qty) > have.qty ? 'text-destructive text-sm' : 'text-muted-foreground text-sm'}>
                    {t('inStockNow', { count: have.qty })}
                    {kind === 'counter' && ` · ${t('inchesNow', { count: have.inches })}`}
                </p>
            )}
            {pending && <p className="text-muted-foreground text-sm">{t('waitsForOwner')}</p>}

            <DialogFooter>
                <Button variant="outline" disabled={save.isPending} onClick={onClose}>
                    {tc('cancel')}
                </Button>
                <Button disabled={!canSave} onClick={() => save.mutate()}>
                    {save.isPending && <Loader2 className="animate-spin" />}
                    {pending ? t('sendForApproval') : t('save')}
                </Button>
            </DialogFooter>
        </>
    )
}
