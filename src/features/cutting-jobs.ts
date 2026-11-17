import { request } from '@/lib/client-api'
import { customerBalance } from './customers'

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

/** The last list the backend gave, for the Cutting table and the machine load, which read it at once. */
let jobs: CuttingJob[] = []

export const allJobs = () => jobs

const base = '/api/cutting-jobs'

const remember = (job: CuttingJob) => {
    jobs = jobs.some((j) => j.id === job.id) ? jobs.map((j) => (j.id === job.id ? job : j)) : [...jobs, job]
    return job
}

export const chargeOf = (j: Pick<CuttingJob, 'sqft' | 'ratePerSqft'>) => Math.round((j.sqft ?? 0) * j.ratePerSqft)

/** The rate of that customer's last truck, else the Settings default. */
export const lastRateFor = (customerId: string) => {
    const last = jobs.filter((j) => j.customerId === customerId && j.status !== 'cancelled').sort((a, b) => b.date.localeCompare(a.date))[0]
    return last?.ratePerSqft ?? DEFAULT_RATE_PER_SQFT
}

export type JobFilters = { status?: JobStatus; customerId?: string }

/** Oldest first. Every job is fetched (and remembered for the Cutting table); the filters narrow the list. */
export const listJobs = async (filters: JobFilters = {}): Promise<CuttingJob[]> => {
    jobs = await request<CuttingJob[]>(base)
    return jobs.filter((j) => (!filters.status || j.status === filters.status) && (!filters.customerId || j.customerId === filters.customerId))
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
    ratePerSqft: number
}

/** The customer's truck arrives: status `received`, shown in the Cutting table as waiting. */
export const receiveJob = async (input: ReceiveInput): Promise<CuttingJob> => {
    const existing = input.customerId !== 'new'
    return remember(
        await request<CuttingJob>(base, {
            body: {
                customerId: existing ? input.customerId : undefined,
                name: existing ? undefined : input.name,
                phone: existing ? undefined : input.phone,
                date: input.date,
                truckNo: input.truckNo,
                material: input.material,
                tons: input.tons,
                factoryId: input.factoryId,
                ratePerSqft: input.ratePerSqft,
            },
        })
    )
}

export const sendJob = async (
    id: string,
    input: { machineId: string; machineName: string; thekadarName: string; date: string }
): Promise<CuttingJob> =>
    remember(await request<CuttingJob>(`${base}/${id}/send`, { body: { machineId: input.machineId, thekadarName: input.thekadarName, date: input.date } }))

export type FinishJobInput = { date: string; sqft: number; ratePerSqft: number; outputNote: string; ratePerTon: number }

/**
 * Finishing posts both sides exactly once: the thekadar's per-ton work entry (`tons × rate`, as for
 * our own trucks) and the customer's charge (`sq.ft × rate`). The job becomes `ready` to collect.
 */
export const finishJob = async (id: string, input: FinishJobInput): Promise<CuttingJob> =>
    remember(
        await request<CuttingJob>(`${base}/${id}/finish`, {
            body: {
                date: input.date,
                sqft: input.sqft,
                ratePerSqft: input.ratePerSqft,
                outputNote: input.outputNote,
                ratePerTon: input.ratePerTon > 0 ? input.ratePerTon : undefined,
            },
        })
    )

/** The customer collects all the output. Whether they still owe is for the page to warn about. */
export const deliverJob = async (id: string): Promise<CuttingJob> => remember(await request<CuttingJob>(`${base}/${id}/deliver`, { body: {} }))

/** Only while still `received`. */
export const cancelJob = async (id: string): Promise<CuttingJob> => remember(await request<CuttingJob>(`${base}/${id}/cancel`, { body: {} }))

export const balanceDueOf = (j: CuttingJob) => Math.max(0, customerBalance(j.customerId))
