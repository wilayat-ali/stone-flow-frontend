import { ApiError } from '@/lib/client-api'
import { listFactories, type Factory } from './factories'
import { allJobs, type CuttingJob } from './cutting-jobs'
import { listMachines, type Machine } from './machines'
import { isCounted } from './production-entries'
import { allPurchases, daysSince, patchPurchase, type Purchase } from './purchases'
import { findCuttingFactorySupplier, postSupplierEntry } from './suppliers'
import { postWorkEntry } from './work-entries'
import { workerByName, workerById } from './workers'

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

export const productionQueryKey = 'production'

/**
 * `waiting` is a truck in the yard, `cutting` is on a machine (or at another factory), and `ready` is a
 * customer's stone that is cut and waiting for them to collect.
 */
export type CuttingStatus = 'waiting' | 'cutting' | 'ready'

type RowBase = {
    id: string
    status: CuttingStatus
    /** Whether the truck is at one of our factories or at another cutting factory. */
    atOtherFactory: boolean
    /** Days in the yard (waiting), on the machine (cutting) or ready to collect. */
    days: number
}

/** Our own approved truck, from Purchasing. */
export type OwnRow = RowBase & { kind: 'own'; purchase: Purchase }

/** A cutting customer's truck (05c): their stone, cut for a fee, never in our stock. */
export type CustomerRow = RowBase & { kind: 'customer'; job: CuttingJob }

export type CuttingRow = OwnRow | CustomerRow

export type CuttingFilters = {
    status?: CuttingStatus
    /** Whose stone: ours, or a customer's. */
    whose?: 'own' | 'customer'
    material?: string
    factoryId?: string
    /** A machine id, or `other` for trucks at other factories. */
    machine?: string
}

/** The fields the Cutting table shows, whichever kind of truck a row is. */
export const viewOf = (row: CuttingRow) =>
    row.kind === 'own'
        ? {
              tag: row.purchase.mark ?? '',
              truckNo: row.purchase.truckNo,
              date: row.purchase.date,
              material: row.purchase.material,
              sub: row.purchase.supplierName,
              tons: row.purchase.tons,
              stones: row.purchase.stones as number | null,
              factoryId: row.purchase.factoryId,
              factoryName: row.purchase.factoryName,
              machineId: row.purchase.machineId,
              machineName: row.purchase.machineName,
              thekadarName: row.purchase.thekadarName,
              minDate: row.purchase.date,
          }
        : {
              tag: row.job.truckNo,
              truckNo: row.job.truckNo,
              date: row.job.date,
              material: row.job.material,
              sub: row.job.customerName,
              tons: row.job.tons,
              stones: null as number | null,
              factoryId: row.job.factoryId,
              factoryName: row.job.factoryName,
              machineId: row.job.machineId,
              machineName: row.job.machineName,
              thekadarName: row.job.thekadarName,
              minDate: row.job.date,
          }

const today = () => new Date().toISOString().slice(0, 10)

const isOwnFactory = (factories: Factory[], factoryId: string) =>
    factories.find((f) => f.id === factoryId)?.kind !== 'cutting'

/**
 * Every truck waiting to cut or on a machine, oldest first: our own approved purchases plus cutting
 * customers' trucks. Pending purchases never appear; only an approved truck (`in_stock`) can be cut.
 * A customer's cut truck stays in the table as `ready` until they collect it.
 */
export const listCuttingRows = async (filters: CuttingFilters = {}): Promise<CuttingRow[]> => {
    const factories = await listFactories()

    const own = allPurchases()
        .filter((p) => p.status === 'in_stock' || p.status === 'cutting')
        .map((purchase): CuttingRow => {
            const status: CuttingStatus = purchase.status === 'in_stock' ? 'waiting' : 'cutting'
            return {
                kind: 'own',
                id: purchase.id,
                purchase,
                status,
                atOtherFactory: !isOwnFactory(factories, purchase.factoryId),
                days: daysSince(status === 'waiting' ? purchase.date : (purchase.cutStart ?? purchase.date)),
            }
        })

    const customer = allJobs()
        .filter((j) => j.status === 'received' || j.status === 'cutting' || j.status === 'ready')
        .map((job): CuttingRow => {
            const status: CuttingStatus = job.status === 'received' ? 'waiting' : job.status === 'cutting' ? 'cutting' : 'ready'
            const since = status === 'waiting' ? job.date : status === 'cutting' ? job.cutStart : job.readyOn
            return { kind: 'customer', id: job.id, job, status, atOtherFactory: false, days: daysSince(since ?? job.date) }
        })

    return [...own, ...customer]
        .filter((row) => {
            const v = viewOf(row)
            return (
                (!filters.status || row.status === filters.status) &&
                (!filters.whose || row.kind === filters.whose) &&
                (!filters.material || v.material === filters.material) &&
                (!filters.factoryId || v.factoryId === filters.factoryId) &&
                (!filters.machine ||
                    (row.status === 'cutting' && (filters.machine === 'other' ? row.atOtherFactory : v.machineId === filters.machine)))
            )
        })
        .sort((a, b) => viewOf(a).date.localeCompare(viewOf(b).date) || a.id.localeCompare(b.id))
}

/** Cut trucks without a cut entry: "Needs attention: count output for truck 20/3". */
export const listOutputToCount = async (): Promise<Purchase[]> => {
    await delay()
    return allPurchases().filter((p) => p.status === 'cut' && !isCounted(p.id))
}

/** Which trucks are on which machine, so the send dialog can say "idle" or "2 trucks on it". */
export const listMachineLoad = async (): Promise<{ machines: Machine[]; onMachine: Record<string, number> }> => {
    const machines = await listMachines()
    const onMachine: Record<string, number> = {}
    const add = (machineId: string | null) => {
        if (machineId) onMachine[machineId] = (onMachine[machineId] ?? 0) + 1
    }
    for (const p of allPurchases()) if (p.status === 'cutting') add(p.machineId)
    for (const j of allJobs()) if (j.status === 'cutting') add(j.machineId)
    return { machines, onMachine }
}

const purchaseOf = (id: string) => {
    const purchase = allPurchases().find((p) => p.id === id)
    if (!purchase) throw new ApiError(404, { code: 'notFound' })
    return purchase
}

const assertDate = (date: string, earliest: string) => {
    if (date > today()) throw new ApiError(400, { code: 'DATE_IN_FUTURE' })
    if (date < earliest) throw new ApiError(400, { code: 'DATE_BEFORE_START' })
}

export type SendInput = { machineId: string; machineName: string; thekadarName: string; date: string }

/**
 * Sends an own-factory truck to a machine of that factory: it becomes `cutting`. Several trucks can
 * be on one machine, and the same thekadar completes the whole truck.
 */
export const sendToMachine = async (purchaseId: string, input: SendInput): Promise<Purchase> => {
    await delay()
    const purchase = purchaseOf(purchaseId)
    if (purchase.status !== 'in_stock') throw new ApiError(409, { code: 'NOT_WAITING' })
    const machine = (await listMachines()).find((m) => m.id === input.machineId)
    if (!machine || machine.factoryId !== purchase.factoryId) throw new ApiError(409, { code: 'MACHINE_OTHER_FACTORY' })
    assertDate(input.date, purchase.date)
    const thekadar = workerByName(input.thekadarName)
    return patchPurchase(purchaseId, {
        status: 'cutting',
        machineId: machine.id,
        machineName: machine.name,
        thekadarId: thekadar.id,
        thekadarName: thekadar.name,
        cutStart: input.date,
    })
}

/** At another cutting factory there is no machine: starting only sets `cutting`. */
export const startAtOtherFactory = async (purchaseId: string, date: string): Promise<Purchase> => {
    await delay()
    const purchase = purchaseOf(purchaseId)
    if (purchase.status !== 'in_stock') throw new ApiError(409, { code: 'NOT_WAITING' })
    assertDate(date, purchase.date)
    return patchPurchase(purchaseId, { status: 'cutting', cutStart: date })
}

export type FinishInput = { date: string; ratePerTon: number }

/** What finishing a truck did, so the page can say it and move on to counting the output. */
export type FinishResult = { purchase: Purchase; paid: { to: string; amount: number; kind: 'thekadar' | 'cutting_factory' } }

/**
 * Finishes a truck that is `cutting` and posts what is owed for it exactly once.
 * Own factory: the thekadar earns `tons × rate` (a work entry on his khata).
 * Other factory: `tons × that factory's rate` goes on the cutting factory's supplier khata.
 */
export const finishCutting = async (purchaseId: string, input: FinishInput): Promise<FinishResult> => {
    await delay()
    const purchase = purchaseOf(purchaseId)
    if (purchase.status !== 'cutting' || !purchase.cutStart) throw new ApiError(409, { code: 'NOT_CUTTING' })
    assertDate(input.date, purchase.cutStart)

    const factories = await listFactories()
    const factory = factories.find((f) => f.id === purchase.factoryId)

    if (isOwnFactory(factories, purchase.factoryId)) {
        const worker = purchase.thekadarId ? workerById(purchase.thekadarId) : undefined
        if (!worker) throw new ApiError(409, { code: 'NO_THEKADAR' })
        if (!(input.ratePerTon > 0)) throw new ApiError(400, { code: 'RATE_REQUIRED' })
        const amount = Math.round(purchase.tons * input.ratePerTon)
        postWorkEntry({
            date: input.date,
            workerId: worker.id,
            workerName: worker.name,
            job: `${purchase.machineName ?? ''} cutting`.trim(),
            unit: 'ton',
            qty: purchase.tons,
            rate: input.ratePerTon,
            amount,
            sourceType: 'truck_cut',
            sourceId: purchase.id,
            auto: true,
            createdBy: 'system',
        })
        const done = patchPurchase(purchaseId, { status: 'cut', cutEnd: input.date, cutRatePerTon: input.ratePerTon })
        return { purchase: done, paid: { to: worker.name, amount, kind: 'thekadar' } }
    }

    const supplier = factory && findCuttingFactorySupplier(factory.name)
    if (!factory || !supplier) throw new ApiError(409, { code: 'NO_CUTTING_SUPPLIER' })
    const rate = factory.ratePerTon ?? supplier.cuttingRatePerTon ?? 0
    if (!(rate > 0)) throw new ApiError(400, { code: 'RATE_REQUIRED' })
    const amount = Math.round(purchase.tons * rate)
    postSupplierEntry({
        supplierId: supplier.id,
        date: input.date,
        kind: 'charge',
        amount,
        detail: `Cutting · truck ${purchase.mark} · ${purchase.tons} t × ${rate}`,
        sourceId: `cut-${purchase.id}`,
    })
    const done = patchPurchase(purchaseId, { status: 'cut', cutEnd: input.date, cutRatePerTon: rate })
    return { purchase: done, paid: { to: supplier.name, amount, kind: 'cutting_factory' } }
}

/** The Settings rate per ton for a cutting factory, shown in the finish dialog. */
export const cuttingFactoryRate = (factories: Factory[], factoryId: string) =>
    factories.find((f) => f.id === factoryId)?.ratePerTon ?? null
