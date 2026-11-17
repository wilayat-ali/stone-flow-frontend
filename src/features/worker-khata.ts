import { request } from '@/lib/client-api'
import { loadWorkers, type PayType, type Worker } from './workers'

export const workerKhataQueryKey = 'worker-khata'

/** One line of a worker's khata. Earnings are charges (we owe him); payments are credits. */
export type WorkerKhataRow = {
    id: string
    date: string
    type: 'opening' | 'work' | 'attendance' | 'payment' | 'salary' | 'instalment' | 'loan'
    kind: 'charge' | 'credit'
    amount: number
    /** Running balance after this row. */
    balance: number
    /** Work entries: what was done. */
    job?: string
    unit?: 'ton' | 'sqft' | 'day'
    qty?: number
    rate?: number
    /** Made by the system from a truck cut or a production entry. */
    auto?: boolean
    note?: string
    paymentId?: string
    pending?: boolean
    /** Shown for information only: it does not change what we owe him (a loan given sits in his loan account). */
    memo?: boolean
    /** Salary rows: absent days and the cut. */
    absentDays?: number
    cut?: number
}

/** A worker with the figures calculated from the khata rows. */
export type WorkerSummary = Worker & {
    monthEarned: number
    monthPaid: number
    earned: number
    paid: number
    /** Positive: we owe him. Negative: he owes us (an advance). */
    balance: number
}

export type WorkerFilters = { payType?: PayType; factoryId?: string; q?: string }

/** The summaries of the last list loaded, for the payable total. */
let summaries: WorkerSummary[] = []

/** Every worker with the figures the list shows (calculated by the backend from the khata). */
export const listWorkers = async (filters: WorkerFilters = {}): Promise<WorkerSummary[]> => {
    summaries = await loadWorkers<WorkerSummary>(filters)
    return summaries
}

/** A worker's khata, oldest first, with the running balance. */
export const getWorkerKhata = (workerId: string) => request<WorkerKhataRow[]>(`/api/workers/${workerId}/khata`)

/** Everything we owe active workers (a worker who is owed nothing, or owes us, adds nothing). */
export const workersPayable = () => summaries.filter((w) => w.isActive).reduce((s, w) => s + Math.max(0, w.balance), 0)
