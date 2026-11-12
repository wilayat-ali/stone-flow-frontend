import { ApiError } from '@/lib/client-api'
import { createCustomer, customerBalance, customerById, postCustomerEntry } from './customers'
import { listMachines } from './machines'
import { postWorkEntry } from './work-entries'
import { workerById, workerByName } from './workers'

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

/** `ready` means cut and waiting for the customer to collect. */
export const jobStatuses = ['received', 'cutting', 'ready', 'delivered', 'cancelled'] as const
export type JobStatus = (typeof jobStatuses)[number]

/**
 * A customer's own truck, cut on our machines and charged per sq.ft. Their stone never enters our
 * stock: no stock movement is made at any step.
 */
export type CuttingJob = {
    id: string
    jobNo: string
    customerId: string
    customerName: string
    customerPhone: string
    date: string
    truckNo: string
    material: string
    tons: number
    factoryId: string
    factoryName: string
    ratePerSqft: number
    status: JobStatus
    machineId: string | null
    machineName: string | null
    thekadarId: string | null
    thekadarName: string | null
    cutStart: string | null
    sqft: number | null
    outputNote: string
    readyOn: string | null
    deliveredOn: string | null
    createdBy: string
}

export const cuttingJobsQueryKey = 'cutting-jobs'

/** Used for a customer who has no earlier truck (the Settings default rate). */
export const DEFAULT_RATE_PER_SQFT = 35

const today = () => new Date().toISOString().slice(0, 10)

const job = (
    id: string,
    jobNo: string,
    customerId: string,
    customerName: string,
    phone: string,
    date: string,
    truckNo: string,
    material: string,
    tons: number,
    status: JobStatus,
    extra: Partial<CuttingJob> = {}
): CuttingJob => ({
    id,
    jobNo,
    customerId,
    customerName,
    customerPhone: phone,
    date,
    truckNo,
    material,
    tons,
    factoryId: 'main',
    factoryName: 'Saadat Marble — Main Factory',
    ratePerSqft: DEFAULT_RATE_PER_SQFT,
    status,
    machineId: null,
    machineName: null,
    thekadarId: null,
    thekadarName: null,
    cutStart: null,
    sqft: null,
    outputNote: '',
    readyOn: null,
    deliveredOn: null,
    createdBy: 'Rashid Khan',
    ...extra,
})

// In-memory stand-in for the backend; replace with `request()` calls like `features/admin/members.ts`.
let jobs: CuttingJob[] = [
    job('j1', 'CJ-001', 'c1', 'Haji Saleem', '0300-5512398', '2026-10-02', 'KHT-552', 'Ziarat Grey', 16.5, 'ready', {
        machineId: 'vertical-2', machineName: 'Vertical Cutter 2', thekadarId: 'w-aslam', thekadarName: 'Aslam Baig',
        cutStart: '2026-10-03', sqft: 720, outputNote: '14 soot 12×24 and 12×12', readyOn: '2026-10-08',
    }),
    job('j2', 'CJ-002', 'c2', 'Malik Traders', '0321-8834512', '2026-10-08', 'LHR-882', 'Black Galaxy', 12, 'received', {
        factoryId: 'north-yard', factoryName: 'North Yard',
    }),
    job('j3', 'CJ-003', 'c3', 'Rehman Marble', '0333-4410982', '2026-09-15', 'KHT-407', 'Sunny Grey', 14, 'delivered', {
        sqft: 540, outputNote: 'Counters and leftovers', readyOn: '2026-09-21', deliveredOn: '2026-09-22',
    }),
    job('j4', 'CJ-004', 'c1', 'Haji Saleem', '0300-5512398', '2026-10-09', 'KHT-611', 'Ziarat Grey', 11.2, 'received'),
]

let seq = 4

export const allJobs = () => jobs

const find = (id: string) => {
    const found = jobs.find((j) => j.id === id)
    if (!found) throw new ApiError(404, { code: 'notFound' })
    return found
}

const replace = (next: CuttingJob) => {
    jobs = jobs.map((j) => (j.id === next.id ? next : j))
    return next
}

export const chargeOf = (j: Pick<CuttingJob, 'sqft' | 'ratePerSqft'>) => Math.round((j.sqft ?? 0) * j.ratePerSqft)

/** The rate of that customer's last truck, else the Settings default. */
export const lastRateFor = (customerId: string) => {
    const last = jobs.filter((j) => j.customerId === customerId && j.status !== 'cancelled').sort((a, b) => b.date.localeCompare(a.date))[0]
    return last?.ratePerSqft ?? DEFAULT_RATE_PER_SQFT
}

export type JobFilters = { status?: JobStatus; customerId?: string }

export const listJobs = async (filters: JobFilters = {}): Promise<CuttingJob[]> => {
    await delay()
    return jobs
        .filter((j) => (!filters.status || j.status === filters.status) && (!filters.customerId || j.customerId === filters.customerId))
        .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
}

export type ReceiveInput = {
    /** An existing customer, or `new` with the name and phone below. */
    customerId: string
    name: string
    phone: string
    date: string
    truckNo: string
    material: string
    tons: number
    factoryId: string
    factoryName: string
    ratePerSqft: number
}

/** The customer's truck arrives: status `received`, shown in the Cutting table as waiting. */
export const receiveJob = async (input: ReceiveInput, by: string): Promise<CuttingJob> => {
    await delay()
    if (input.date > today()) throw new ApiError(400, { code: 'DATE_IN_FUTURE' })
    const customer =
        input.customerId === 'new'
            ? await createCustomer({ name: input.name, phone: input.phone, type: 'cutting', city: '', contactPerson: '' })
            : customerById(input.customerId)
    if (!customer) throw new ApiError(404, { code: 'notFound' })
    seq += 1
    const created = job(crypto.randomUUID(), `CJ-${String(seq).padStart(3, '0')}`, customer.id, customer.name, customer.phone, input.date, input.truckNo.toUpperCase(), input.material, input.tons, 'received', {
        factoryId: input.factoryId,
        factoryName: input.factoryName,
        ratePerSqft: input.ratePerSqft,
        createdBy: by,
    })
    jobs = [...jobs, created]
    return created
}

export const sendJob = async (
    id: string,
    input: { machineId: string; machineName: string; thekadarName: string; date: string }
): Promise<CuttingJob> => {
    await delay()
    const current = find(id)
    if (current.status !== 'received') throw new ApiError(409, { code: 'NOT_WAITING' })
    const machine = (await listMachines()).find((m) => m.id === input.machineId)
    if (!machine || machine.factoryId !== current.factoryId) throw new ApiError(409, { code: 'MACHINE_OTHER_FACTORY' })
    if (input.date > today()) throw new ApiError(400, { code: 'DATE_IN_FUTURE' })
    if (input.date < current.date) throw new ApiError(400, { code: 'DATE_BEFORE_START' })
    const thekadar = workerByName(input.thekadarName)
    return replace({
        ...current,
        status: 'cutting',
        machineId: machine.id,
        machineName: machine.name,
        thekadarId: thekadar.id,
        thekadarName: thekadar.name,
        cutStart: input.date,
    })
}

export type FinishJobInput = { date: string; sqft: number; ratePerSqft: number; outputNote: string; ratePerTon: number }

/**
 * Finishing posts both sides exactly once: the thekadar's per-ton work entry (`tons × rate`, as for
 * our own trucks) and the customer's charge (`sq.ft × rate`). The job becomes `ready` to collect.
 */
export const finishJob = async (id: string, input: FinishJobInput): Promise<CuttingJob> => {
    await delay()
    const current = find(id)
    if (current.status !== 'cutting' || !current.cutStart) throw new ApiError(409, { code: 'NOT_CUTTING' })
    if (input.date > today()) throw new ApiError(400, { code: 'DATE_IN_FUTURE' })
    if (input.date < current.cutStart) throw new ApiError(400, { code: 'DATE_BEFORE_START' })
    if (!(input.sqft > 0)) throw new ApiError(400, { code: 'SQFT_REQUIRED' })
    if (!(input.ratePerSqft > 0)) throw new ApiError(400, { code: 'RATE_REQUIRED' })

    const worker = current.thekadarId ? workerById(current.thekadarId) : undefined
    if (worker && input.ratePerTon > 0) {
        postWorkEntry({
            date: input.date,
            workerId: worker.id,
            workerName: worker.name,
            job: `${current.machineName ?? ''} cutting · ${current.customerName}`.trim(),
            unit: 'ton',
            qty: current.tons,
            rate: input.ratePerTon,
            amount: Math.round(current.tons * input.ratePerTon),
            sourceType: 'truck_cut',
            sourceId: current.id,
            auto: true,
            createdBy: 'system',
        })
    }
    const done = replace({
        ...current,
        status: 'ready',
        sqft: input.sqft,
        ratePerSqft: input.ratePerSqft,
        outputNote: input.outputNote,
        readyOn: input.date,
    })
    postCustomerEntry({
        customerId: done.customerId,
        date: input.date,
        kind: 'charge',
        amount: chargeOf(done),
        detail: `Cutting ${done.truckNo} · ${input.sqft} sq.ft × ${input.ratePerSqft}`,
        sourceId: done.id,
    })
    return done
}

/** The customer collects all the output. Whether they still owe is for the page to warn about. */
export const deliverJob = async (id: string): Promise<CuttingJob> => {
    await delay()
    const current = find(id)
    if (current.status !== 'ready') throw new ApiError(409, { code: 'NOT_READY' })
    return replace({ ...current, status: 'delivered', deliveredOn: today() })
}

/** Only while still `received`. */
export const cancelJob = async (id: string): Promise<CuttingJob> => {
    await delay()
    const current = find(id)
    if (current.status !== 'received') throw new ApiError(409, { code: 'CANCEL_AFTER_START' })
    return replace({ ...current, status: 'cancelled' })
}

export const balanceDueOf = (j: CuttingJob) => Math.max(0, customerBalance(j.customerId))
