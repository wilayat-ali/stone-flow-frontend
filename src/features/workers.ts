import { request } from '@/lib/client-api'
import { rateForJob } from './worker-rates'

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

const base = '/api/workers'

/** The last list the backend gave: the lookups the screens and the other modules make without waiting. */
let workers: Worker[] = []

/** Every worker the backend gave last, active or not. */
export const allWorkers = () => workers

/** The worker with this id, from the last list loaded. */
export const workerById = (id: string) => workers.find((w) => w.id === id)

/** The rate that really applies: a sq.ft worker without his own rate is paid by the job rate card. */
export const effectiveRate = (worker: Pick<Worker, 'payType' | 'rate' | 'defaultJob'>) =>
    worker.payType === 'sqft' && !(worker.rate > 0) ? rateForJob(worker.defaultJob) : worker.rate

/** What the add/edit sheet sends. */
export type WorkerInput = Pick<Worker, 'name' | 'phone' | 'jobTitle' | 'factoryId' | 'payType' | 'rate' | 'defaultJob' | 'openingBalance' | 'joinedOn'>

export type WorkerFilters = { payType?: PayType; factoryId?: string; q?: string }

const toQuery = (filters: WorkerFilters) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, String(value))
    const text = params.toString()
    return text ? `?${text}` : ''
}

/** Every worker matching the filters (including inactive ones, shown greyed out). Remembered for the lookups above. */
export const loadWorkers = async <T extends Worker>(filters: WorkerFilters = {}): Promise<T[]> => {
    const list = await request<T[]>(`${base}${toQuery(filters)}`)
    if (!Object.values(filters).some(Boolean)) workers = list
    return list
}

export const createWorker = async (input: WorkerInput): Promise<Worker> => {
    const created = await request<Worker>(base, { body: input })
    workers = [...workers.filter((w) => w.id !== created.id), created]
    return created
}

/** Workers are never deleted: a worker who left is made inactive and keeps their khata. */
export const updateWorker = async (id: string, input: Partial<WorkerInput> & { isActive?: boolean }): Promise<Worker> => {
    const updated = await request<Worker>(`${base}/${id}`, { method: 'PATCH', body: input })
    workers = workers.map((w) => (w.id === id ? updated : w))
    return updated
}
