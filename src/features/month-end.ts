import { ApiError } from '@/lib/client-api'
import { absentDays } from './attendance'
import { instalmentFor } from './loans'
import { closedRecord, monthEnd, monthLog, removeClose, saveClose, type ClosedPosting, type MonthClose, type MonthLogEntry } from './month-store'
import { khataOf } from './worker-khata'
import { allWorkers, type PayType, type Worker } from './workers'

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

export const monthEndQueryKey = 'month-end'

/** Days a salary is divided by to cut an absent day. A Settings option on the backend; 30 until that exists. */
export const MONTH_DAYS = 30

const thisMonth = () => new Date().toISOString().slice(0, 7)

/** Months from when the factory started on StoneFlow until this one, newest first. */
export const monthOptions = (): string[] => {
    const months: string[] = []
    const now = thisMonth()
    let [y, m] = [2026, 9]
    for (;;) {
        const month = `${y}-${String(m).padStart(2, '0')}`
        if (month > now) break
        months.push(month)
        m += 1
        if (m > 12) [y, m] = [y + 1, 1]
    }
    return months.reverse()
}

export type SheetRow = {
    workerId: string
    workerName: string
    payType: PayType
    broughtForward: number
    /** Work, daily wages and the net monthly salary. */
    earned: number
    /** Monthly workers: the salary behind `earned`, with the cut for absent days. */
    salary: { gross: number; absentDays: number; cut: number; net: number } | null
    instalment: number
    paid: number
    /** brought forward + earned − instalment − paid */
    balance: number
}

export type MonthSheet = {
    month: string
    closed: MonthClose | null
    /** The month is not over yet. */
    inProgress: boolean
    rows: SheetRow[]
    totals: { broughtForward: number; earned: number; instalment: number; paid: number; balance: number; salaries: number }
}

/** Net salary: the salary less each absent day at salary ÷ month days. */
const netSalary = (worker: Worker, month: string) => {
    const absent = absentDays(worker.id, month)
    const cut = Math.min(worker.rate, Math.round(absent * (worker.rate / MONTH_DAYS)))
    return { gross: worker.rate, absentDays: absent, cut, net: worker.rate - cut }
}

const rowOf = (worker: Worker, month: string): SheetRow => {
    const rows = khataOf(worker).filter((r) => !r.pending && !r.memo)
    const start = `${month}-01`
    const before = rows.filter((r) => r.date < start)
    const inMonth = rows.filter((r) => r.date.startsWith(month))
    const sum = (list: typeof rows, pick: (r: (typeof rows)[number]) => boolean) => list.filter(pick).reduce((s, r) => s + r.amount, 0)

    const closed = closedRecord(month)
    // A closed month already has the salary and instalments in the khata; an open one shows what closing will post.
    const salary = worker.payType === 'month' && worker.isActive && worker.joinedOn <= monthEnd(month) && !closed ? netSalary(worker, month) : null
    const posted = closed?.postings.find((p) => p.workerId === worker.id)
    const projectedInstalment = !closed ? instalmentFor(worker.id, month).reduce((s, x) => s + x.amount, 0) : 0

    const earned = sum(inMonth, (r) => r.kind === 'charge' && r.type !== 'opening') + (salary?.net ?? 0)
    const instalment = sum(inMonth, (r) => r.type === 'instalment') + projectedInstalment
    const paid = sum(inMonth, (r) => r.type === 'payment')
    const broughtForward = before.length ? before[before.length - 1].balance : 0

    return {
        workerId: worker.id,
        workerName: worker.name,
        payType: worker.payType,
        broughtForward,
        earned,
        salary: salary ?? (posted && posted.salary > 0 ? { gross: posted.salary, absentDays: posted.absentDays, cut: posted.cut, net: posted.net } : null),
        instalment,
        paid,
        balance: broughtForward + earned - instalment - paid,
    }
}

const sheetOf = (month: string): MonthSheet => {
    const rows = allWorkers()
        .filter((w) => w.joinedOn <= monthEnd(month) && (w.isActive || khataOf(w).some((r) => r.date.startsWith(month))))
        .map((w) => rowOf(w, month))
        // Someone with nothing in the month and nothing carried over is not on the sheet.
        .filter((r) => r.broughtForward !== 0 || r.earned !== 0 || r.instalment !== 0 || r.paid !== 0 || r.salary)
    const total = (pick: (r: SheetRow) => number) => rows.reduce((s, r) => s + pick(r), 0)
    return {
        month,
        closed: closedRecord(month) ?? null,
        inProgress: monthEnd(month) >= new Date().toISOString().slice(0, 10),
        rows,
        totals: {
            broughtForward: total((r) => r.broughtForward),
            earned: total((r) => r.earned),
            instalment: total((r) => r.instalment),
            paid: total((r) => r.paid),
            balance: total((r) => r.balance),
            salaries: total((r) => r.salary?.net ?? 0),
        },
    }
}

export const getMonthSheet = async (month: string): Promise<MonthSheet> => {
    await delay()
    return sheetOf(month)
}

export const getMonthLog = async (): Promise<MonthLogEntry[]> => {
    await delay(150)
    return monthLog()
}

/** What closing would post, for the confirmation: salaries after absent days, and instalments. */
const postingsOf = (month: string): ClosedPosting[] =>
    allWorkers()
        .filter((w) => w.isActive && w.joinedOn <= monthEnd(month))
        .map((w): ClosedPosting => {
            const salary = w.payType === 'month' ? netSalary(w, month) : { gross: 0, absentDays: 0, cut: 0, net: 0 }
            return {
                workerId: w.id,
                workerName: w.name,
                salary: salary.gross,
                absentDays: salary.absentDays,
                cut: salary.cut,
                net: salary.net,
                instalments: instalmentFor(w.id, month),
            }
        })
        .filter((p) => p.net > 0 || p.instalments.some((i) => i.amount > 0 || i.skipped))

/**
 * Close the month: post salary charges and loan instalments once, then lock it. Closing a closed month is
 * refused, so a repeated request cannot post twice.
 */
export const closeMonth = async (month: string, by: string): Promise<MonthClose> => {
    await delay()
    if (closedRecord(month)) throw new ApiError(409, { code: 'ALREADY_CLOSED' })
    const postings = postingsOf(month)
    const close: MonthClose = {
        month,
        closedBy: by,
        closedAt: new Date().toISOString(),
        postings,
        totals: {
            salaries: postings.reduce((s, p) => s + p.net, 0),
            instalments: postings.reduce((s, p) => s + p.instalments.reduce((a, i) => a + i.amount, 0), 0),
        },
    }
    saveClose(close)
    return close
}

/** Re-opening takes the month's postings back and unlocks it. It is logged. */
export const reopenMonth = async (month: string, by: string): Promise<void> => {
    await delay()
    if (!closedRecord(month)) throw new ApiError(409, { code: 'NOT_CLOSED' })
    removeClose(month, by)
}

/** What closing a month would post, for the confirmation dialog. */
export const previewClose = (month: string) => {
    const postings = postingsOf(month)
    return {
        salaries: postings.reduce((s, p) => s + p.net, 0),
        instalments: postings.reduce((s, p) => s + p.instalments.reduce((a, i) => a + i.amount, 0), 0),
        absentCut: postings.reduce((s, p) => s + p.cut, 0),
    }
}
