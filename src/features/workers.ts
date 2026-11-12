import { ApiError } from '@/lib/client-api'
import { rateForJob } from './worker-rates'

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

/** Per ton (thekadar), per sq.ft, per day (attendance) or per month (salary at month close). */
export const payTypes = ['ton', 'sqft', 'day', 'month'] as const
export type PayType = (typeof payTypes)[number]

export type Worker = {
    id: string
    name: string
    phone: string
    jobTitle: string
    factoryId: string
    payType: PayType
    /** PKR per ton, per sq.ft, per day or per month, by `payType`. A sq.ft worker with 0 is paid by the job rate card. */
    rate: number
    /** The rate-card job of a sq.ft worker, e.g. "Polisher". */
    defaultJob: string
    /** What we already owed him (positive) or he already owed us (negative) before StoneFlow. */
    openingBalance: number
    /** `YYYY-MM-DD` */
    joinedOn: string
    isActive: boolean
}

export const workersQueryKey = 'workers'

// In-memory stand-in for the backend; replace with `request()` calls like `features/admin/members.ts`.
const make = (w: Partial<Worker> & Pick<Worker, 'id' | 'name' | 'payType' | 'rate'>): Worker => ({
    phone: '',
    jobTitle: '',
    factoryId: 'main',
    defaultJob: '',
    openingBalance: 0,
    joinedOn: '2026-09-01',
    isActive: true,
    ...w,
})

let workers: Worker[] = [
    // Thekadars are paid per ton. These are the ones named on the Settings machines.
    make({ id: 'w-rashid', name: 'Rashid Khan', payType: 'ton', rate: 1100, phone: '0300-1112233', jobTitle: 'Thekadar' }),
    make({ id: 'w-aslam', name: 'Aslam Baig', payType: 'ton', rate: 1200, phone: '0301-2223344', jobTitle: 'Thekadar' }),
    make({ id: 'w-bilal', name: 'Bilal Ahmed', payType: 'ton', rate: 1200, phone: '0302-3334455', jobTitle: 'Thekadar' }),
    make({ id: 'w-shahid', name: 'Shahid Pervez', payType: 'ton', rate: 1000, phone: '0303-4445566', jobTitle: 'Thekadar' }),
    make({ id: 'w-imran', name: 'Imran Ali', payType: 'ton', rate: 1000, phone: '0304-5556677', jobTitle: 'Thekadar' }),
    make({ id: 'w-tariq', name: 'Tariq Mehmood', payType: 'ton', rate: 1100, phone: '0305-6667788', jobTitle: 'Thekadar' }),
    // Paid per sq.ft: a rate of 0 means the job rate card in Settings applies.
    make({ id: 'w-imran-s', name: 'Imran (section)', payType: 'sqft', rate: 0, jobTitle: 'Section maker', defaultJob: 'Section Operator', phone: '0306-7778899' }),
    make({ id: 'w-shahid-r', name: 'Shahid (resizer)', payType: 'sqft', rate: 0, jobTitle: 'Resizer', defaultJob: 'Resizer', phone: '0307-8889900' }),
    make({ id: 'w-rafiq', name: 'Rafiq (polisher)', payType: 'sqft', rate: 9, jobTitle: 'Polisher', defaultJob: 'Polisher', phone: '0308-9990011', openingBalance: 4000 }),
    // Paid per day from attendance.
    make({ id: 'w-karim', name: 'Karim', payType: 'day', rate: 800, jobTitle: 'Helper', phone: '0309-1010101' }),
    make({ id: 'w-salman', name: 'Salman', payType: 'day', rate: 800, jobTitle: 'Loader', phone: '0310-2020202' }),
    make({ id: 'w-yasir', name: 'Yasir', payType: 'day', rate: 900, jobTitle: 'Driver', phone: '0311-3030303' }),
    // Paid a salary at month close.
    make({ id: 'w-munshi', name: 'Munshi Ahmed', payType: 'month', rate: 35000, jobTitle: 'Munshi', phone: '0312-4040404' }),
    make({ id: 'w-chokidar', name: 'Gul Zaman', payType: 'month', rate: 22000, jobTitle: 'Chokidar', phone: '0313-5050505' }),
]

/** Default rate for a thekadar who is not on the list yet. */
const DEFAULT_TON_RATE = 1100

/**
 * The worker a machine's thekadar name stands for. Settings keeps thekadars as names, so one that
 * has not been seen before is added here, paid per ton at the default rate.
 */
export const workerByName = (name: string): Worker => {
    const found = workers.find((w) => w.name.trim().toLowerCase() === name.trim().toLowerCase())
    if (found) return found
    const created = make({ id: crypto.randomUUID(), name: name.trim(), payType: 'ton', rate: DEFAULT_TON_RATE, jobTitle: 'Thekadar' })
    workers = [...workers, created]
    return created
}

export const workerById = (id: string) => workers.find((w) => w.id === id)

/** Every worker, active or not (other modules look people up by id). */
export const allWorkers = () => workers

/** The rate that really applies: a sq.ft worker without his own rate is paid by the job rate card. */
export const effectiveRate = (worker: Pick<Worker, 'payType' | 'rate' | 'defaultJob'>) =>
    worker.payType === 'sqft' && !(worker.rate > 0) ? rateForJob(worker.defaultJob) : worker.rate

export const listSqftWorkers = async (): Promise<Worker[]> => {
    await delay(200)
    return workers.filter((w) => w.payType === 'sqft' && w.isActive)
}

/** What the add/edit sheet sends. */
export type WorkerInput = Pick<Worker, 'name' | 'phone' | 'jobTitle' | 'factoryId' | 'payType' | 'rate' | 'defaultJob' | 'openingBalance' | 'joinedOn'>

const clean = (input: WorkerInput): WorkerInput => ({ ...input, defaultJob: input.payType === 'sqft' ? input.defaultJob : '' })

export const createWorker = async (input: WorkerInput): Promise<Worker> => {
    await delay()
    const worker: Worker = { ...clean(input), id: crypto.randomUUID(), isActive: true }
    workers = [...workers, worker]
    return worker
}

/** Workers are never deleted: a worker who left is made inactive and keeps their khata. */
export const updateWorker = async (id: string, input: Partial<WorkerInput> & { isActive?: boolean }): Promise<Worker> => {
    await delay()
    const current = workers.find((w) => w.id === id)
    if (!current) throw new ApiError(404, { code: 'notFound' })
    const next = { ...current, ...input }
    const updated: Worker = { ...next, defaultJob: next.payType === 'sqft' ? next.defaultJob : '' }
    workers = workers.map((w) => (w.id === id ? updated : w))
    return updated
}
