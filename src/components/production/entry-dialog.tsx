'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePicker } from '@/components/shared/date-picker'
import { counterWidthsQueryKey, listCounterWidths } from '@/features/counter-widths'
import { factoriesQueryKey, listFactories } from '@/features/factories'
import { listMachines, machinesQueryKey } from '@/features/machines'
import { pieceSizes, sootTypes, widthInches, type SootType } from '@/features/piece-sizes'
import {
    entryTypes,
    postEntry,
    productionEntriesQueryKey,
    stockOnHand,
    stockRows,
    stockedMaterials,
    totalSqFt,
    type EntryLine,
    type EntryType,
    type Finish,
    type StockItem,
} from '@/features/production-entries'
import { listOutputToCount, productionQueryKey } from '@/features/production'
import { listWorkerRates, workerRatesQueryKey } from '@/features/worker-rates'
import { listSqftWorkers, workersQueryKey } from '@/features/workers'
import { useEntryErrorMessage } from '@/features/use-entry-error-message'
import { useMoney } from '@/hooks/use-money'
import { todayIso } from '@/lib/format'
import { SizeGrid } from './size-grid'

export type EntryPreset = { type?: EntryType; purchaseId?: string }

type CounterRow = { width: string; pieces: string; inches: string }

const NONE = 'none'
const emptyCounters = (): CounterRow[] => [0, 1, 2, 3].map(() => ({ width: '', pieces: '', inches: '' }))
const num = (v: string) => Number(v) || 0
const stripRough = (material: string) => material.replace(/\s*\(rough\)/i, '').trim()

/** The job rate card names in Settings → Rates, by step (the same ones the backend uses). */
const jobOf: Record<Exclude<EntryType, 'cut'>, string> = {
    section: 'Section Operator',
    counter: 'Resizer',
    resize: 'Resizer',
    polish: 'Polisher',
}

/** The one dialog for every change of stone from one form to another; it also opens after Finish. */
export function EntryDialog({
    open,
    preset,
    userName,
    onClose,
}: {
    open: boolean
    preset: EntryPreset
    userName: string
    onClose: () => void
}) {
    const t = useTranslations('production.entries')
    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>{t('title')}</DialogTitle>
                    <DialogDescription>{t('description')}</DialogDescription>
                </DialogHeader>
                {open && <EntryForm preset={preset} userName={userName} onClose={onClose} />}
            </DialogContent>
        </Dialog>
    )
}

function EntryForm({ preset, userName, onClose }: { preset: EntryPreset; userName: string; onClose: () => void }) {
    const t = useTranslations('production.entries')
    const tc = useTranslations('common')
    const tm = useTranslations('settings.machines.type')
    const money = useMoney()
    const format = useFormatter()
    const queryClient = useQueryClient()
    const errorMessage = useEntryErrorMessage()

    const factories = useQuery({ queryKey: [factoriesQueryKey], queryFn: listFactories })
    const machines = useQuery({ queryKey: [machinesQueryKey], queryFn: listMachines })
    const trucks = useQuery({ queryKey: [productionQueryKey, 'to-count'], queryFn: listOutputToCount })
    const workers = useQuery({ queryKey: [workersQueryKey, 'sqft'], queryFn: listSqftWorkers })
    const rates = useQuery({ queryKey: [workerRatesQueryKey], queryFn: listWorkerRates })
    const counterWidths = useQuery({ queryKey: [counterWidthsQueryKey], queryFn: listCounterWidths })

    const [type, setType] = useState<EntryType>(preset.type ?? 'cut')
    const [date, setDate] = useState(todayIso())
    const [factoryChoice, setFactoryChoice] = useState('')
    const [materialChoice, setMaterialChoice] = useState('')
    const [truckChoice, setTruckChoice] = useState(preset.purchaseId ?? '')
    const [machineTypeChoice, setMachineTypeChoice] = useState('vertical')
    const [workerId, setWorkerId] = useState(NONE)
    const [soot, setSoot] = useState<SootType>('14')
    const [finish, setFinish] = useState<Finish>('unpolished')
    const [kind, setKind] = useState<'pieces' | 'counters'>('pieces')
    const [inQty, setInQty] = useState<Record<string, string>>({})
    const [outQty, setOutQty] = useState<Record<string, string>>({})
    const [slabsIn, setSlabsIn] = useState('')
    const [slabsOut, setSlabsOut] = useState('')
    const [counters, setCounters] = useState<CounterRow[]>(emptyCounters)
    const [polishRows, setPolishRows] = useState<Record<string, { pieces: string; inches: string }>>({})
    const [note, setNote] = useState('')

    const ownFactories = (factories.data ?? []).filter((f) => f.kind === 'own')
    const truck = (trucks.data ?? []).find((p) => p.id === truckChoice) ?? (type === 'cut' ? (trucks.data ?? [])[0] : undefined)
    const truckMachine = truck?.machineId ? machines.data?.find((m) => m.id === truck.machineId) : undefined
    const machineType = truckMachine?.type ?? machineTypeChoice

    // Stock goes to one of our factories: the truck's own, or the one chosen for another factory's truck.
    const truckFactory = ownFactories.find((f) => f.id === truck?.factoryId)
    const factoryId = factoryChoice || (type === 'cut' ? (truckFactory ?? ownFactories[0])?.id : ownFactories[0]?.id) || ''
    const factory = ownFactories.find((f) => f.id === factoryId)
    const materials = useMemo(() => [...new Set([...stockedMaterials()])], [])
    const material = type === 'cut' ? stripRough(truck?.material ?? '') : materialChoice || materials[0] || ''

    const reset = () => {
        setInQty({})
        setOutQty({})
        setSlabsIn('')
        setSlabsOut('')
        setCounters(emptyCounters())
        setPolishRows({})
    }

    const piece = (s: SootType, size: string, f: Finish): StockItem => ({ itemType: 'piece', material, factoryId, soot: s, size, finish: f })
    const counterItem = (width: number, f: Finish): StockItem => ({ itemType: 'counter', material, factoryId, width, finish: f })
    const slabItem: StockItem = { itemType: 'slab', material, factoryId }

    const pieceLines = (direction: EntryLine['direction'], s: SootType, f: Finish, values: Record<string, string>): EntryLine[] =>
        pieceSizes[s].filter((size) => num(values[size] ?? '') > 0).map((size) => ({ direction, item: piece(s, size, f), qty: num(values[size]), inches: 0 }))

    const polishCounterWidths = useMemo(
        () =>
            stockRows()
                .filter((r) => r.item.itemType === 'counter' && r.item.finish === 'unpolished' && r.item.material === material && r.item.factoryId === factoryId && r.qty > 0)
                .map((r) => (r.item as Extract<StockItem, { itemType: 'counter' }>).width)
                .sort((a, b) => b - a),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [material, factoryId, type, kind]
    )

    // What this step takes out of stock and puts in, built from what was typed.
    const lines = useMemo<EntryLine[]>(() => {
        if (type === 'cut') {
            if (machineType === 'gangSaw') return num(slabsOut) > 0 ? [{ direction: 'out', item: slabItem, qty: num(slabsOut), inches: 0 }] : []
            if (machineType === 'vertical') return pieceLines('out', '14', 'unpolished', outQty)
            return []
        }
        if (type === 'section') return [...pieceLines('in', '14', 'unpolished', inQty), ...pieceLines('out', '4', 'unpolished', outQty)]
        if (type === 'resize') return [...pieceLines('in', soot, finish, inQty), ...pieceLines('out', soot, finish, outQty)]
        if (type === 'counter') {
            const made: EntryLine[] = counters
                .filter((c) => num(c.width) > 0 && num(c.pieces) > 0 && num(c.inches) > 0)
                .map((c) => ({ direction: 'out', item: counterItem(num(c.width), 'unpolished'), qty: num(c.pieces), inches: num(c.inches) }))
            const slabs: EntryLine[] = num(slabsIn) > 0 ? [{ direction: 'in', item: slabItem, qty: num(slabsIn), inches: 0 }] : []
            return [...slabs, ...made, ...pieceLines('out', '6', 'unpolished', outQty)]
        }
        if (kind === 'pieces') {
            const taken = pieceLines('in', soot, 'unpolished', inQty)
            return [...taken, ...taken.map((l): EntryLine => ({ ...l, direction: 'out', item: { ...l.item, finish: 'polished' } as StockItem }))]
        }
        const rows = polishCounterWidths.filter((w) => num(polishRows[w]?.pieces ?? '') > 0 && num(polishRows[w]?.inches ?? '') > 0)
        return rows.flatMap((w): EntryLine[] => {
            const base = { qty: num(polishRows[w].pieces), inches: num(polishRows[w].inches) }
            return [
                { direction: 'in', item: counterItem(w, 'unpolished'), ...base },
                { direction: 'out', item: counterItem(w, 'polished'), ...base },
            ]
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [type, machineType, slabsIn, slabsOut, inQty, outQty, soot, finish, kind, counters, polishRows, material, factoryId, polishCounterWidths])

    const inSqft = totalSqFt(lines, 'in')
    const outSqft = totalSqFt(lines, 'out')
    const slabsMade = lines.filter((l) => l.direction === 'out' && l.item.itemType === 'slab').reduce((s, l) => s + l.qty, 0)
    const waste = type === 'resize' ? Math.max(0, inSqft - outSqft) : 0

    const worker = type !== 'cut' && workerId !== NONE ? workers.data?.find((w) => w.id === workerId) : undefined
    const jobRate = type !== 'cut' ? (rates.data?.find((r) => r.name === jobOf[type])?.rate ?? 0) : 0
    const workerRate = worker ? (worker.rate > 0 ? worker.rate : jobRate) : 0
    const workerPay = Math.round(outSqft * workerRate)

    const save = useMutation({
        mutationFn: () =>
            postEntry(
                {
                    type,
                    date,
                    factoryId,
                    factoryName: factory?.name ?? '',
                    material,
                    purchaseId: type === 'cut' ? (truck?.id ?? null) : null,
                    machineType: type === 'cut' ? machineType : null,
                    workerId: worker?.id ?? null,
                    note,
                    lines,
                },
                userName
            ),
        onSuccess: (entry) => {
            toast.success(t('saved', { no: entry.entryNo }))
            for (const key of [productionEntriesQueryKey, productionQueryKey]) queryClient.invalidateQueries({ queryKey: [key] })
            onClose()
        },
        onError: (error) => toast.error(errorMessage(error)),
    })

    const selectOf = (value: string, onChange: (v: string) => void, options: { value: string; label: string }[], placeholder = '') => (
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
    const field = (label: string, control: React.ReactNode) => (
        <div className="flex flex-col gap-2">
            <Label>{label}</Label>
            {control}
        </div>
    )

    const setQty = (set: React.Dispatch<React.SetStateAction<Record<string, string>>>) => (size: string, value: string) =>
        set((cur) => ({ ...cur, [size]: value }))
    const availablePieces = (s: SootType, f: Finish) => (size: string) => stockOnHand(piece(s, size, f)).qty
    const sootOptions = sootTypes.map((s) => ({ value: s, label: t('sootLabel', { soot: s }) }))
    const finishOptions = [
        { value: 'unpolished', label: t('finishes.unpolished') },
        { value: 'polished', label: t('finishes.polished') },
    ]

    const heading = (key: string, values?: Record<string, string>) => <h3 className="text-sm font-medium">{t(key as never, values as never)}</h3>

    const unsupported = type === 'cut' && machineType !== 'vertical' && machineType !== 'gangSaw'
    const canSave = lines.some((l) => l.direction === 'out') && !!factory && !!material && !unsupported && !save.isPending

    return (
        <>
            <div className="bg-primary text-primary-foreground flex flex-wrap items-center justify-between gap-2 rounded-lg px-4 py-3" aria-live="polite">
                <div>
                    <div className="text-xs uppercase opacity-80">{t('output')}</div>
                    <div className="text-2xl font-semibold tabular-nums">
                        {type === 'cut' && machineType === 'gangSaw'
                            ? t('slabsCount', { count: slabsMade })
                            : `${format.number(outSqft, { maximumFractionDigits: 1 })} ${t('sqft')}`}
                    </div>
                </div>
                <div className="text-sm tabular-nums opacity-90">
                    {type !== 'cut' && inSqft > 0 && <div>{t('inSqft', { value: format.number(inSqft, { maximumFractionDigits: 1 }) })}</div>}
                    {type === 'resize' && inSqft > 0 && <div>{t('waste', { value: format.number(waste, { maximumFractionDigits: 1 }) })}</div>}
                    {worker && outSqft > 0 && <div>{t('workerEarns', { name: worker.name, amount: money(workerPay) })}</div>}
                    {type === 'cut' && truck && <div>{t('truckInfo', { mark: truck.mark ?? '', tons: truck.tons })}</div>}
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
                {field(
                    t('step'),
                    selectOf(type, (v) => { setType(v as EntryType); reset() }, entryTypes.map((s) => ({ value: s, label: t(`types.${s}`) })))
                )}
                {field(t('date'), <DatePicker value={date} onChange={setDate} placeholder={t('date')} max={todayIso()} />)}
                {field(
                    type === 'cut' ? t('stockGoesTo') : t('factory'),
                    selectOf(factoryId, (v) => { setFactoryChoice(v); reset() }, ownFactories.map((f) => ({ value: f.id, label: f.name })))
                )}

                {type === 'cut' ? (
                    <>
                        {field(
                            t('truck'),
                            (trucks.data ?? []).length === 0 ? (
                                <p className="text-muted-foreground text-sm">{t('noTruck')}</p>
                            ) : (
                                selectOf(
                                    truck?.id ?? '',
                                    (v) => { setTruckChoice(v); reset() },
                                    (trucks.data ?? []).map((p) => ({ value: p.id, label: `${p.mark} · ${stripRough(p.material)} · ${format.number(p.tons, { maximumFractionDigits: 1 })} t` }))
                                )
                            )
                        )}
                        {field(
                            t('machineType'),
                            truckMachine ? (
                                <p className="text-sm font-medium">
                                    {tm(truckMachine.type)} · {truckMachine.name}
                                </p>
                            ) : (
                                selectOf(machineType, (v) => { setMachineTypeChoice(v); reset() }, (['vertical', 'gangSaw', 'monolama', 'blockCutter'] as const).map((m) => ({ value: m, label: tm(m) })))
                            )
                        )}
                    </>
                ) : (
                    <>
                        {field(t('material'), selectOf(material, (v) => { setMaterialChoice(v); reset() }, materials.map((m) => ({ value: m, label: m }))))}
                        {field(
                            t('worker'),
                            selectOf(workerId, setWorkerId, [{ value: NONE, label: t('noWorker') }, ...(workers.data ?? []).map((w) => ({ value: w.id, label: w.name }))])
                        )}
                    </>
                )}
                {(type === 'resize' || (type === 'polish' && kind === 'pieces')) &&
                    field(t('soot'), selectOf(soot, (v) => { setSoot(v as SootType); reset() }, sootOptions))}
                {type === 'resize' && field(t('finish'), selectOf(finish, (v) => { setFinish(v as Finish); reset() }, finishOptions))}
                {type === 'polish' && field(t('polishKind'), selectOf(kind, (v) => { setKind(v as 'pieces' | 'counters'); reset() }, [{ value: 'pieces', label: t('kinds.pieces') }, { value: 'counters', label: t('kinds.counters') }]))}
            </div>

            {unsupported && <p className="text-destructive text-sm">{t('unsupportedMachine')}</p>}

            {type === 'cut' &&
                (machineType === 'gangSaw' ? (
                    <div className="flex max-w-xs flex-col gap-2">
                        {heading('outSlabs')}
                        <Input value={slabsOut} onChange={(e) => setSlabsOut(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder={t('slabsPlaceholder')} />
                        <p className="text-muted-foreground text-xs">{t('slabsHint')}</p>
                    </div>
                ) : machineType === 'vertical' ? (
                    <div className="flex flex-col gap-2">
                        {heading('outPieces', { soot: '14' })}
                        <SizeGrid sizes={pieceSizes['14']} values={outQty} onChange={setQty(setOutQty)} />
                    </div>
                ) : null)}

            {type === 'section' && (
                <>
                    <div className="flex flex-col gap-2">
                        {heading('inPieces', { soot: '14' })}
                        <SizeGrid sizes={pieceSizes['14']} values={inQty} onChange={setQty(setInQty)} available={availablePieces('14', 'unpolished')} />
                    </div>
                    <div className="flex flex-col gap-2">
                        {heading('outPieces', { soot: '4' })}
                        <SizeGrid sizes={pieceSizes['4']} values={outQty} onChange={setQty(setOutQty)} />
                    </div>
                </>
            )}

            {type === 'resize' && (
                <>
                    <div className="flex flex-col gap-2">
                        {heading('inPieces', { soot })}
                        <SizeGrid sizes={pieceSizes[soot]} values={inQty} onChange={setQty(setInQty)} available={availablePieces(soot, finish)} />
                    </div>
                    <div className="flex flex-col gap-2">
                        {heading('outPieces', { soot })}
                        <SizeGrid sizes={pieceSizes[soot]} values={outQty} onChange={setQty(setOutQty)} />
                    </div>
                </>
            )}

            {type === 'polish' && kind === 'pieces' && (
                <div className="flex flex-col gap-2">
                    {heading('polishPieces', { soot })}
                    <SizeGrid sizes={pieceSizes[soot]} values={inQty} onChange={setQty(setInQty)} available={availablePieces(soot, 'unpolished')} />
                </div>
            )}

            {type === 'polish' && kind === 'counters' && (
                <div className="flex flex-col gap-2">
                    {heading('polishCounters')}
                    {polishCounterWidths.length === 0 ? (
                        <p className="text-muted-foreground text-sm">{t('nothingInStock')}</p>
                    ) : (
                        polishCounterWidths.map((w) => {
                            const have = stockOnHand(counterItem(w, 'unpolished'))
                            return (
                                <div key={w} className="grid grid-cols-[6rem_1fr_1fr] items-center gap-2">
                                    <b className="tabular-nums">{t('widthIn', { width: w })}</b>
                                    <Input
                                        value={polishRows[w]?.pieces ?? ''}
                                        onChange={(e) => setPolishRows((cur) => ({ ...cur, [w]: { pieces: e.target.value.replace(/\D/g, ''), inches: cur[w]?.inches ?? '' } }))}
                                        inputMode="numeric"
                                        placeholder={t('piecesOfMax', { max: have.qty })}
                                    />
                                    <Input
                                        value={polishRows[w]?.inches ?? ''}
                                        onChange={(e) => setPolishRows((cur) => ({ ...cur, [w]: { pieces: cur[w]?.pieces ?? '', inches: e.target.value.replace(/\D/g, '') } }))}
                                        inputMode="numeric"
                                        placeholder={t('inchesOfMax', { max: have.inches })}
                                    />
                                </div>
                            )
                        })
                    )}
                </div>
            )}

            {type === 'counter' && (
                <>
                    <div className="flex max-w-xs flex-col gap-2">
                        {heading('inSlabs')}
                        <Input value={slabsIn} onChange={(e) => setSlabsIn(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder={t('slabsPlaceholder')} />
                        <p className="text-muted-foreground text-xs">{t('inStock', { count: stockOnHand(slabItem).qty })}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                        {heading('outCounters')}
                        {counters.map((row, i) => (
                            <div key={i} className="grid grid-cols-3 gap-2">
                                {selectOf(
                                    row.width,
                                    (v) => setCounters((cur) => cur.map((c, j) => (j === i ? { ...c, width: v } : c))),
                                    (counterWidths.data ?? []).map((w) => ({ value: String(widthInches(w.name)), label: t('widthIn', { width: widthInches(w.name) }) })),
                                    t('width')
                                )}
                                <Input
                                    value={row.pieces}
                                    onChange={(e) => setCounters((cur) => cur.map((c, j) => (j === i ? { ...c, pieces: e.target.value.replace(/\D/g, '') } : c)))}
                                    inputMode="numeric"
                                    placeholder={t('pieces')}
                                />
                                <Input
                                    value={row.inches}
                                    onChange={(e) => setCounters((cur) => cur.map((c, j) => (j === i ? { ...c, inches: e.target.value.replace(/\D/g, '') } : c)))}
                                    inputMode="numeric"
                                    placeholder={t('totalInches')}
                                />
                            </div>
                        ))}
                    </div>
                    <div className="flex flex-col gap-2">
                        {heading('outLeftover', { soot: '6' })}
                        <SizeGrid sizes={pieceSizes['6']} values={outQty} onChange={setQty(setOutQty)} />
                    </div>
                </>
            )}

            <div className="flex flex-col gap-2">
                <Label htmlFor="entry-note">{t('note')}</Label>
                <Input id="entry-note" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>

            <DialogFooter>
                <Button variant="outline" disabled={save.isPending} onClick={onClose}>
                    {tc('cancel')}
                </Button>
                <Button disabled={!canSave} onClick={() => save.mutate()}>
                    {save.isPending && <Loader2 className="animate-spin" />}
                    {t('save')}
                </Button>
            </DialogFooter>
        </>
    )
}
