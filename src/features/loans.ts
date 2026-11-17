import { request } from '@/lib/client-api'

export const loansQueryKey = 'loans'

const base = '/api/loans'

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

/** The loans the backend gave last, for the figures the screens read at once. */
let known: LoanSummary[] = []

const nextMonth = (month: string) => {
    const [y, m] = month.split('-').map(Number)
    return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7)
}

/**
 * The schedule the form previews before saving: one instalment per month, the last one smaller if it needs
 * to be. The real schedule (with closed months and the owner's changes) comes from the backend.
 */
export const previewSchedule = (loan: Pick<Loan, 'amount' | 'monthlyInstalment' | 'firstMonth' | 'priorRepaid'>): InstalmentRow[] => {
    const rows: InstalmentRow[] = []
    let remaining = loan.amount - loan.priorRepaid
    let month = loan.firstMonth
    for (let i = 0; i < 240 && remaining > 0 && loan.monthlyInstalment > 0; i++, month = nextMonth(month)) {
        const amount = Math.min(loan.monthlyInstalment, remaining)
        rows.push({ month, amount, status: 'scheduled' })
        remaining -= amount
    }
    return rows
}

/** Loans of a worker (or all), with their schedules, from the backend. */
export const listLoans = async (workerId?: string): Promise<LoanSummary[]> => {
    const rows = await request<LoanSummary[]>(`${base}${workerId ? `?workerId=${workerId}` : ''}`)
    if (!workerId) known = rows
    return rows
}

/** The loans of a worker from the last list loaded. */
export const loansOf = (workerId?: string) => known.filter((l) => !workerId || l.workerId === workerId)

/** What he still has to repay, across his loans (from the last list loaded). */
export const loanOutstanding = (workerId: string) => loansOf(workerId).reduce((s, l) => s + l.outstanding, 0)

/** Money leaves an account now, unless the loan was given before StoneFlow (no account). */
export const giveLoan = (input: LoanInput) =>
    request<LoanSummary>(base, {
        body: {
            workerId: input.workerId,
            date: input.date,
            amount: input.amount,
            monthlyInstalment: input.monthlyInstalment,
            firstMonth: input.firstMonth,
            priorRepaid: input.priorRepaid,
            accountId: input.accountId || undefined,
            reason: input.reason || undefined,
        },
    })

/** Change one month's instalment (or skip it) before that month is closed. */
export const changeInstalment = (loanId: string, month: string, change: { amount: number } | { skip: true }) =>
    request<LoanSummary>(`${base}/${loanId}/months/${month}`, { method: 'PUT', body: change })

/** Back to the regular instalment for a month. */
export const resetInstalment = (loanId: string, month: string) => request<LoanSummary>(`${base}/${loanId}/months/${month}`, { method: 'DELETE' })

/** This month and the next ones, for choosing when instalments start. */
export const upcomingMonths = (count: number): string[] => {
    const months: string[] = []
    let month = new Date().toISOString().slice(0, 7)
    for (let i = 0; i < count; i++, month = nextMonth(month)) months.push(month)
    return months
}
