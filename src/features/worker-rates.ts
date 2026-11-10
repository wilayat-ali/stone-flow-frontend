const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

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

// In-memory stand-in for the backend; replace with `request()` calls like `features/admin/members.ts`.
let workerRates: WorkerRate[] = [
    { id: 'thekadar-vertical', name: 'Thekadar — Vertical Cutting', payType: 'perTon', rate: 450, isActive: true },
    { id: 'thekadar-gangsaw', name: 'Thekadar — Gang Saw', payType: 'perTon', rate: 500, isActive: true },
    { id: 'section-operator', name: 'Section Operator', payType: 'perSqft', rate: 6, isActive: true },
    { id: 'resizer', name: 'Resizer', payType: 'perSqft', rate: 8, isActive: true },
    { id: 'polisher', name: 'Polisher', payType: 'perSqft', rate: 10, isActive: true },
    { id: 'labour', name: 'Labour', payType: 'daily', rate: 800, isActive: true },
    { id: 'driver', name: 'Driver', payType: 'daily', rate: 900, isActive: true },
    { id: 'munshi', name: 'Munshi', payType: 'monthly', rate: 35000, isActive: true },
]

/** Nothing is ever hard-deleted, so a deactivated rate is simply left out of the list. */
export const listWorkerRates = async (): Promise<WorkerRate[]> => {
    await delay()
    return workerRates.filter((r) => r.isActive)
}

/** The create/edit sheet's own form values: `rate` arrives as a string. */
export type WorkerRateInput = { name: string; payType: PayType; rate: string }

const toWorkerRate = (input: WorkerRateInput) => ({
    name: input.name,
    payType: input.payType,
    rate: Number(input.rate),
})

export const createWorkerRate = async (input: WorkerRateInput): Promise<WorkerRate> => {
    await delay()
    const rate: WorkerRate = { ...toWorkerRate(input), id: crypto.randomUUID(), isActive: true }
    workerRates = [...workerRates, rate]
    return rate
}

export const updateWorkerRate = async (
    id: string,
    input: WorkerRateInput
): Promise<WorkerRate> => {
    await delay()
    workerRates = workerRates.map((r) => (r.id === id ? { ...r, ...toWorkerRate(input) } : r))
    return workerRates.find((r) => r.id === id) as WorkerRate
}

/** Worker rates are never deleted — this only hides the row by setting `isActive: false`. */
export const deactivateWorkerRate = async (id: string): Promise<void> => {
    await delay()
    workerRates = workerRates.map((r) => (r.id === id ? { ...r, isActive: false } : r))
}
