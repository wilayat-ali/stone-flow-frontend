import { ApiError } from '@/lib/client-api'
import { setExtraOutflow } from './account-outflow'
import { closedRecord, isMonthClosed } from './month-store'

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

export const loansQueryKey = 'loans'

export type Loan = {
    id: string
    workerId: string
    workerName: string
    /** `YYYY-MM-DD` */
    date: string
    amount: number
    monthlyInstalment: number
    /** `YYYY-MM` */
    firstMonth: string
    /** Repaid before StoneFlow, for an old loan. */
    priorRepaid: number
    /** Empty: it was given before StoneFlow, so no money leaves an account now. */
    accountId: string
    accountName: string
    reason: string
}

export type InstalmentStatus = 'scheduled' | 'deducted' | 'skipped'

export type InstalmentRow = { month: string; amount: number; status: InstalmentStatus }

export type LoanSummary = Loan & {
    schedule: InstalmentRow[]
    deducted: number
    outstanding: number
    status: 'active' | 'repaid'
    /** Month the last instalment falls in. */
    endMonth: string | null
}

export type LoanInput = Pick<Loan, 'workerId' | 'workerName' | 'date' | 'amount' | 'monthlyInstalment' | 'firstMonth' | 'priorRepaid' | 'accountId' | 'accountName' | 'reason'>

/** The owner's change for one month before it is closed: a different amount, or skip it. */
type Override = { loanId: string; month: string; amount?: number; skip?: boolean }

const today = () => new Date().toISOString().slice(0, 10)

const nextMonth = (month: string) => {
    const [y, m] = month.split('-').map(Number)
    return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7)
}

// In-memory stand-in for the backend; replace with `request()` calls like `features/admin/members.ts`.
let loans: Loan[] = [
    {
        id: 'ln1',
        workerId: 'w-karim',
        workerName: 'Karim',
        date: '2026-10-05',
        amount: 30000,
        monthlyInstalment: 5000,
        firstMonth: '2026-11',
        priorRepaid: 0,
        accountId: '',
        accountName: 'Cash in hand',
        reason: 'Family wedding',
    },
]
let overrides: Override[] = []

/**
 * The schedule: one instalment per month from the first month until the loan is repaid, the last one
 * smaller if it needs to be. A skipped month moves everything one month later; a closed month shows what
 * was really deducted.
 */
export const scheduleOf = (loan: Loan): InstalmentRow[] => {
    const rows: InstalmentRow[] = []
    let remaining = loan.amount - loan.priorRepaid
    let month = loan.firstMonth
    for (let i = 0; i < 240 && remaining > 0 && loan.monthlyInstalment > 0; i++, month = nextMonth(month)) {
        if (isMonthClosed(month)) {
            const posted = closedRecord(month)?.postings.flatMap((p) => p.instalments).find((x) => x.loanId === loan.id)
            const amount = posted && !posted.skipped ? posted.amount : 0
            rows.push({ month, amount, status: amount > 0 ? 'deducted' : 'skipped' })
            remaining -= amount
            continue
        }
        const change = overrides.find((o) => o.loanId === loan.id && o.month === month)
        if (change?.skip) {
            rows.push({ month, amount: 0, status: 'skipped' })
            continue
        }
        const amount = Math.min(change?.amount ?? loan.monthlyInstalment, remaining)
        rows.push({ month, amount, status: 'scheduled' })
        remaining -= amount
    }
    return rows
}

const summarise = (loan: Loan): LoanSummary => {
    const schedule = scheduleOf(loan)
    const deducted = schedule.filter((r) => r.status === 'deducted').reduce((s, r) => s + r.amount, 0)
    const outstanding = loan.amount - loan.priorRepaid - deducted
    const last = [...schedule].reverse().find((r) => r.amount > 0)
    return { ...loan, schedule, deducted, outstanding, status: outstanding > 0 ? 'active' : 'repaid', endMonth: last?.month ?? null }
}

/** One loan with its schedule, as the form previews it before saving. */
export const previewSchedule = (loan: Pick<Loan, 'amount' | 'monthlyInstalment' | 'firstMonth' | 'priorRepaid'>) =>
    scheduleOf({ ...loan, id: 'preview', workerId: '', workerName: '', date: '', accountId: '', accountName: '', reason: '' })

export const listLoans = async (workerId?: string): Promise<LoanSummary[]> => {
    await delay(250)
    return loansOf(workerId)
}

export const loansOf = (workerId?: string) => loans.filter((l) => !workerId || l.workerId === workerId).map(summarise)

/** What a worker is to repay in a month (scheduled or already deducted), for the month-end sheet. */
export const instalmentFor = (workerId: string, month: string) =>
    loansOf(workerId)
        .flatMap((l) => l.schedule.filter((r) => r.month === month).map((r) => ({ loanId: l.id, amount: r.amount, skipped: r.status === 'skipped' })))

/** What he still has to repay, across his loans. */
export const loanOutstanding = (workerId: string) => loansOf(workerId).reduce((s, l) => s + l.outstanding, 0)

/** Money leaves an account now, unless the loan was given before StoneFlow (no account). */
export const giveLoan = async (input: LoanInput): Promise<Loan> => {
    await delay()
    if (!(input.amount > 0)) throw new ApiError(400, { code: 'INVALID_AMOUNT' })
    if (!(input.monthlyInstalment > 0)) throw new ApiError(400, { code: 'INSTALMENT_REQUIRED' })
    if (input.priorRepaid < 0 || input.priorRepaid >= input.amount) throw new ApiError(400, { code: 'PRIOR_TOO_HIGH' })
    if (input.date > today()) throw new ApiError(400, { code: 'FUTURE_DATE' })
    if (isMonthClosed(input.firstMonth)) throw new ApiError(409, { code: 'MONTH_CLOSED' })
    const loan: Loan = { ...input, id: crypto.randomUUID() }
    loans = [...loans, loan]
    if (loan.accountId) setExtraOutflow(loan.id, loan.accountId, loan.amount)
    return loan
}

/** Change one month's instalment (or skip it) before that month is closed. */
export const changeInstalment = async (loanId: string, month: string, change: { amount: number } | { skip: true }): Promise<void> => {
    await delay()
    const loan = loans.find((l) => l.id === loanId)
    if (!loan) throw new ApiError(404, { code: 'notFound' })
    if (isMonthClosed(month)) throw new ApiError(409, { code: 'MONTH_CLOSED' })
    if ('amount' in change && !(change.amount > 0)) throw new ApiError(400, { code: 'INVALID_AMOUNT' })
    overrides = [...overrides.filter((o) => !(o.loanId === loanId && o.month === month)), { loanId, month, ...change }]
}

/** Back to the regular instalment for a month. */
export const resetInstalment = async (loanId: string, month: string): Promise<void> => {
    await delay()
    if (isMonthClosed(month)) throw new ApiError(409, { code: 'MONTH_CLOSED' })
    overrides = overrides.filter((o) => !(o.loanId === loanId && o.month === month))
}

// The seeded loan was already paid out of cash.
for (const l of loans) if (l.accountId) setExtraOutflow(l.id, l.accountId, l.amount)

/** This month and the next ones, for choosing when instalments start. */
export const upcomingMonths = (count: number): string[] => {
    const months: string[] = []
    let month = new Date().toISOString().slice(0, 7)
    for (let i = 0; i < count; i++, month = nextMonth(month)) months.push(month)
    return months
}
