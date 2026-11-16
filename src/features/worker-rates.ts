import { request } from '@/lib/client-api'

/** The 4 ways a worker is paid, per the business rules. */
export type PayType = 'perTon' | 'perSqft' | 'daily' | 'monthly'

export type WorkerRate = {
    id: string
    /** Job or role, e.g. "Thekadar — Vertical Cutting". */
    name: string
    payType: PayType
    rate: number
    isActive: boolean
}

export const workerRatesQueryKey = 'worker-rates'

const base = '/api/settings/worker-rates'

/** The last rate card the backend gave, for `rateForJob`, which other modules call without waiting. */
let rateCard: WorkerRate[] = []

/** Nothing is ever hard-deleted, so a deactivated rate is simply left out of the list. */
export const listWorkerRates = async (): Promise<WorkerRate[]> => {
    rateCard = await request<WorkerRate[]>(base)
    return rateCard
}

/** The create/edit sheet's own form values: `rate` arrives as a string. */
export type WorkerRateInput = { name: string; payType: PayType; rate: string }

const toBody = (input: WorkerRateInput) => ({
    name: input.name,
    payType: input.payType,
    rate: Number(input.rate),
})

export const createWorkerRate = (input: WorkerRateInput) => request<WorkerRate>(base, { body: toBody(input) })

export const updateWorkerRate = (id: string, input: WorkerRateInput) =>
    request<WorkerRate>(`${base}/${id}`, { method: 'PATCH', body: toBody(input) })

/** Worker rates are never deleted — this only hides the row by setting `isActive: false`. */
export const deactivateWorkerRate = async (id: string): Promise<void> => {
    await request<WorkerRate>(`${base}/${id}`, { method: 'PATCH', body: { isActive: false } })
}

/** The rate card's PKR per sq.ft for a job name, or 0 when the card has none (from the last list loaded, for other modules). */
export const rateForJob = (job: string) => rateCard.find((r) => r.isActive && r.payType === 'perSqft' && r.name === job)?.rate ?? 0
