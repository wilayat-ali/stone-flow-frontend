import { request } from '@/lib/client-api'
import type { PayType } from './workers'

export const monthEndQueryKey = 'month-end'

const base = '/api/months'

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

/** Salary charges and loan instalments posted for one worker when a month closed. */
export type ClosedPosting = {
    workerId: string
    workerName: string
    /** Monthly workers: salary, absent days, the cut and what was posted. */
    salary: number
    absentDays: number
    cut: number
    net: number
    instalments: { loanId: string; amount: number; skipped: boolean }[]
}

export type MonthClose = {
    /** `YYYY-MM` */
    month: string
    closedBy: string
    closedAt: string
    postings: ClosedPosting[]
    totals: { salaries: number; instalments: number }
}

export type MonthLogEntry = { month: string; action: 'closed' | 'reopened'; by: string; at: string }

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

/** The month's sheet: what each worker brought forward, earned, repays, was paid, and owes now. */
export const getMonthSheet = (month: string) => request<MonthSheet>(`${base}/${month}/sheet`)

export const getMonthLog = () => request<MonthLogEntry[]>(`${base}/log`)

/** What closing would post, for the confirmation: salaries after absent days, and instalments. */
export const previewClose = (month: string) =>
    request<{ salaries: number; instalments: number; absentCut: number }>(`${base}/${month}/preview`)

/** Closes the month: salary charges and loan instalments are posted once, then the month is locked. */
export const closeMonth = (month: string) => request<MonthClose>(`${base}/${month}/close`, { body: {} })

/** Re-opening takes the month's postings back and unlocks it. It is logged. */
export const reopenMonth = (month: string) => request<{ ok: true }>(`${base}/${month}/reopen`, { body: {} })
