import { ApiError } from '@/lib/client-api'
import './work-register'
import { presentDays } from './attendance'
import { loansOf } from './loans'
import { allCloses, monthEnd } from './month-store'
import { allWorkEntries } from './work-entries'
import { paymentsOf } from './worker-payments'
import { allWorkers, effectiveRate, type PayType, type Worker } from './workers'

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

export const workerKhataQueryKey = 'worker-khata'

const month = () => new Date().toISOString().slice(0, 7)

/** One line of a worker's khata. Earnings are charges (we owe him); payments are credits. */
export type WorkerKhataRow = {
    id: string
    date: string
    type: 'opening' | 'work' | 'attendance' | 'payment' | 'salary' | 'instalment' | 'loan'
    kind: 'charge' | 'credit'
    amount: number
    /** Running balance after this row; a pending payment leaves it unchanged. */
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

/** A worker with the figures calculated from the khata rows (never stored). */
export type WorkerSummary = Worker & {
    monthEarned: number
    monthPaid: number
    earned: number
    paid: number
    /** Positive: we owe him. Negative: he owes us (an advance). */
    balance: number
}

type Line = Omit<WorkerKhataRow, 'balance'>

const linesOf = (worker: Worker): Line[] => {
    const lines: Line[] = []
    if (worker.openingBalance !== 0) {
        lines.push({
            id: `opening-${worker.id}`,
            date: worker.joinedOn,
            type: 'opening',
            kind: worker.openingBalance > 0 ? 'charge' : 'credit',
            amount: Math.abs(worker.openingBalance),
        })
    }
    for (const e of allWorkEntries().filter((x) => x.workerId === worker.id)) {
        lines.push({ id: e.id, date: e.date, type: 'work', kind: 'charge', amount: e.amount, job: e.job, unit: e.unit, qty: e.qty, rate: e.rate, auto: e.auto })
    }
    // A daily worker earns his rate for every saved day he was present.
    if (worker.payType === 'day') {
        for (const date of presentDays(worker.id)) {
            lines.push({ id: `att-${worker.id}-${date}`, date, type: 'attendance', kind: 'charge', amount: worker.rate, unit: 'day', qty: 1, rate: worker.rate })
        }
    }
    // Closing a month posted these: the salary as a charge, the loan instalments as a deduction.
    for (const close of allCloses()) {
        const posting = close.postings.find((x) => x.workerId === worker.id)
        if (!posting) continue
        const date = monthEnd(close.month)
        if (posting.net > 0) {
            lines.push({ id: `salary-${worker.id}-${close.month}`, date, type: 'salary', kind: 'charge', amount: posting.net, qty: posting.salary, absentDays: posting.absentDays, cut: posting.cut })
        }
        const instalment = posting.instalments.reduce((sum, x) => sum + x.amount, 0)
        if (instalment > 0) lines.push({ id: `instalment-${worker.id}-${close.month}`, date, type: 'instalment', kind: 'credit', amount: instalment })
    }
    for (const loan of loansOf(worker.id)) {
        lines.push({ id: `loan-${loan.id}`, date: loan.date, type: 'loan', kind: 'charge', amount: loan.amount, note: loan.reason, memo: true })
    }
    for (const p of paymentsOf(worker.id)) {
        lines.push({ id: p.id, date: p.date, type: 'payment', kind: 'credit', amount: p.amount, note: p.note, paymentId: p.id, pending: p.status === 'pending' })
    }
    return lines.sort((a, b) => a.date.localeCompare(b.date) || (a.kind === b.kind ? 0 : a.kind === 'charge' ? -1 : 1))
}

export const khataOf = (worker: Worker): WorkerKhataRow[] => {
    let balance = 0
    return linesOf(worker).map((line) => {
        if (!line.pending && !line.memo) balance += line.kind === 'charge' ? line.amount : -line.amount
        return { ...line, balance }
    })
}

const summarise = (worker: Worker): WorkerSummary => {
    const rows = khataOf(worker)
    const counted = rows.filter((r) => !r.pending && !r.memo)
    const sum = (list: WorkerKhataRow[], kind: WorkerKhataRow['kind']) =>
        list.filter((r) => r.kind === kind && (kind === 'charge' ? r.type !== 'opening' : r.type === 'payment')).reduce((s, r) => s + r.amount, 0)
    const inMonth = counted.filter((r) => r.date.startsWith(month()))
    return {
        ...worker,
        earned: sum(counted, 'charge'),
        paid: sum(counted, 'credit'),
        monthEarned: sum(inMonth, 'charge'),
        monthPaid: sum(inMonth, 'credit'),
        balance: counted.length ? counted[counted.length - 1].balance : 0,
    }
}

export type WorkerFilters = { payType?: PayType; factoryId?: string; q?: string }

export const listWorkers = async (filters: WorkerFilters = {}): Promise<WorkerSummary[]> => {
    await delay()
    const q = filters.q?.trim().toLowerCase()
    return allWorkers()
        .filter(
            (w) =>
                (!filters.payType || w.payType === filters.payType) &&
                (!filters.factoryId || w.factoryId === filters.factoryId) &&
                (!q || [w.name, w.phone, w.jobTitle].some((v) => v.toLowerCase().includes(q)))
        )
        .map(summarise)
}

export const getWorkerKhata = async (workerId: string): Promise<WorkerKhataRow[]> => {
    await delay(250)
    const worker = allWorkers().find((w) => w.id === workerId)
    if (!worker) throw new ApiError(404, { code: 'notFound' })
    return khataOf(worker)
}

/** Everything we owe active workers (a worker who is owed nothing, or owes us, adds nothing). */
export const workersPayable = () => allWorkers().filter((w) => w.isActive).reduce((s, w) => s + Math.max(0, summarise(w).balance), 0)

export { effectiveRate }
