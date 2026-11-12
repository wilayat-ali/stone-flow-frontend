import { ApiError } from '@/lib/client-api'

/** The months that were closed, and what closing posted. Kept apart so the khata, loans and the entry screens can read it without importing the month-end sheet. */

/** Salary charges and loan instalments are posted per worker when a month closes. */
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

// In-memory stand-in for the backend; replace with `request()` calls like `features/admin/members.ts`.
let closes: MonthClose[] = [
    {
        month: '2026-10',
        closedBy: 'Wilayat Ali',
        closedAt: '2026-11-01T09:00:00.000Z',
        postings: [
            { workerId: 'w-munshi', workerName: 'Munshi Ahmed', salary: 35000, absentDays: 0, cut: 0, net: 35000, instalments: [] },
            { workerId: 'w-chokidar', workerName: 'Gul Zaman', salary: 22000, absentDays: 0, cut: 0, net: 22000, instalments: [] },
        ],
        totals: { salaries: 57000, instalments: 0 },
    },
]

let log: MonthLogEntry[] = [{ month: '2026-10', action: 'closed', by: 'Wilayat Ali', at: '2026-11-01T09:00:00.000Z' }]

export const monthOf = (date: string) => date.slice(0, 7)

/** The last day of a `YYYY-MM` month, as `YYYY-MM-DD`. */
export const monthEnd = (month: string) => {
    const [y, m] = month.split('-').map(Number)
    return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}

export const closedRecord = (month: string) => closes.find((c) => c.month === month)

export const isMonthClosed = (month: string) => !!closedRecord(month)

/** A closed month takes no new or edited work, attendance or payment entries. */
export const assertMonthOpen = (date: string) => {
    if (isMonthClosed(monthOf(date))) throw new ApiError(409, { code: 'MONTH_CLOSED' })
}

export const allCloses = () => closes

export const monthLog = () => [...log].sort((a, b) => b.at.localeCompare(a.at))

export const saveClose = (close: MonthClose) => {
    closes = [...closes, close]
    log = [...log, { month: close.month, action: 'closed', by: close.closedBy, at: close.closedAt }]
}

export const removeClose = (month: string, by: string) => {
    closes = closes.filter((c) => c.month !== month)
    log = [...log, { month, action: 'reopened', by, at: new Date().toISOString() }]
}
