import { ApiError } from '@/lib/client-api'
import { assertMonthOpen } from './month-store'
import { clearExtraOutflow, setExtraOutflow } from './account-outflow'

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

export const workerPaymentsQueryKey = 'worker-payments'

/** `pending` is a munshi's entry that has no effect until the owner confirms it. */
export type WorkerPaymentStatus = 'pending' | 'confirmed' | 'rejected'

export type WorkerPayment = {
    id: string
    date: string
    workerId: string
    workerName: string
    amount: number
    accountId: string
    accountName: string
    note: string
    status: WorkerPaymentStatus
    createdBy: string
}

export type WorkerPaymentInput = Pick<WorkerPayment, 'date' | 'workerId' | 'workerName' | 'amount' | 'accountId' | 'accountName' | 'note'>

const today = () => new Date().toISOString().slice(0, 10)

// In-memory stand-in for the backend; replace with `request()` calls like `features/admin/members.ts`.
// The ledger row (money out) really goes through the ledger service (03a); here the account balance check is fed instead.
let payments: WorkerPayment[] = [
    { id: 'wp1', date: '2026-11-09', workerId: 'w-karim', workerName: 'Karim', amount: 2000, accountId: '', accountName: 'Cash in hand', note: 'Advance', status: 'confirmed', createdBy: 'Wilayat Ali' },
    { id: 'wp2', date: '2026-11-10', workerId: 'w-rafiq', workerName: 'Rafiq (polisher)', amount: 1500, accountId: '', accountName: 'Cash in hand', note: '', status: 'confirmed', createdBy: 'Wilayat Ali' },
]

/** Confirmed and pending payments, newest first. */
export const listWorkerPayments = async (workerId?: string): Promise<WorkerPayment[]> => {
    await delay(250)
    return paymentsOf(workerId)
}

export const paymentsOf = (workerId?: string) =>
    payments.filter((p) => p.status !== 'rejected' && (!workerId || p.workerId === workerId)).sort((a, b) => b.date.localeCompare(a.date))

export const createWorkerPayment = async (input: WorkerPaymentInput, options: { pending: boolean; by: string }): Promise<WorkerPayment> => {
    await delay()
    if (!(input.amount > 0)) throw new ApiError(400, { code: 'INVALID_AMOUNT' })
    if (input.date > today()) throw new ApiError(400, { code: 'FUTURE_DATE' })
    assertMonthOpen(input.date)
    if (!input.accountId) throw new ApiError(400, { code: 'ACCOUNT_REQUIRED' })
    const payment: WorkerPayment = { ...input, id: crypto.randomUUID(), status: options.pending ? 'pending' : 'confirmed', createdBy: options.by }
    payments = [...payments, payment]
    if (payment.status === 'confirmed') setExtraOutflow(payment.id, payment.accountId, payment.amount)
    return payment
}

const find = (id: string) => {
    const payment = payments.find((p) => p.id === id)
    if (!payment) throw new ApiError(404, { code: 'notFound' })
    if (payment.status !== 'pending') throw new ApiError(409, { code: 'ALREADY_DECIDED' })
    return payment
}

export const confirmWorkerPayment = async (id: string): Promise<WorkerPayment> => {
    await delay()
    const payment = { ...find(id), status: 'confirmed' as const }
    payments = payments.map((p) => (p.id === id ? payment : p))
    setExtraOutflow(payment.id, payment.accountId, payment.amount)
    return payment
}

export const rejectWorkerPayment = async (id: string): Promise<WorkerPayment> => {
    await delay()
    const payment = { ...find(id), status: 'rejected' as const }
    payments = payments.map((p) => (p.id === id ? payment : p))
    clearExtraOutflow(id)
    return payment
}

// The seeded cash payments are already out of the books.
for (const p of payments) setExtraOutflow(p.id, p.accountId, p.amount)
