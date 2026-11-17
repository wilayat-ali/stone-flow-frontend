import { request } from '@/lib/client-api'

export const workerPaymentsQueryKey = 'worker-payments'

const base = '/api/workers/payments'

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

export type WorkerPaymentInput = Pick<WorkerPayment, 'date' | 'workerId' | 'amount' | 'accountId' | 'note'>

/** Confirmed and pending payments, newest first (rejected ones are left out). */
export const listWorkerPayments = (workerId?: string) => request<WorkerPayment[]>(`${base}${workerId ? `?workerId=${workerId}` : ''}`)

/** A munshi's payment waits for the owner when approval is on; anyone else's is paid at once. */
export const createWorkerPayment = (input: WorkerPaymentInput) =>
    request<WorkerPayment>(base, {
        body: { workerId: input.workerId, amount: input.amount, date: input.date, accountId: input.accountId, note: input.note || undefined },
    })

export const confirmWorkerPayment = (id: string) => request<WorkerPayment>(`${base}/${id}/confirm`, { body: {} })

export const rejectWorkerPayment = (id: string, reason: string) => request<WorkerPayment>(`${base}/${id}/reject`, { body: { reason } })
