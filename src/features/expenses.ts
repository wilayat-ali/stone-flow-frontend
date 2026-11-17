import { request } from '@/lib/client-api'

export const expensesQueryKey = 'expenses'
export const munshiCashQueryKey = 'munshi-cash'

const base = '/api/expenses'

export const payModes = ['paid', 'unpaid', 'shop_credit'] as const
export type PayMode = (typeof payModes)[number]

/** `pending` is a munshi's entry that has no effect until the owner confirms it. */
export type ExpenseStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export type Expense = {
    id: string
    expNo: string
    date: string
    categoryId: string
    categoryName: string
    description: string
    amount: number
    factoryId: string
    factoryName: string
    payMode: PayMode
    /** Where the money came from: an account, or the munshi's cash. */
    accountId: string | null
    accountName: string
    /** Unpaid bills only. */
    dueDate: string | null
    paidOn: string | null
    shopId: string | null
    shopName: string
    /** Name of the bill photo that was attached. */
    photoName: string | null
    status: ExpenseStatus
    reason: string | null
    createdBy: string
    approvedBy: string | null
}

export type ExpenseFilters = {
    categoryId?: string
    factoryId?: string
    payMode?: PayMode
    status?: ExpenseStatus
    q?: string
}

export type ExpenseInput = Pick<
    Expense,
    'date' | 'categoryId' | 'categoryName' | 'description' | 'amount' | 'factoryId' | 'factoryName' | 'payMode' | 'accountId' | 'accountName' | 'dueDate' | 'shopId' | 'shopName' | 'photoName'
>

/** Money the owner gave the munshi, from cash or a bank. */
export type MunshiGive = {
    id: string
    date: string
    fromAccountId: string
    fromAccountName: string
    amount: number
    note: string
    by: string
}

export type MunshiSummary = {
    /** The munshi's own cash account: he pays from it. */
    accountId: string
    /** What he holds. Negative: he spent his own money. */
    balance: number
    /** What the owner owes the munshi when his cash has gone negative. */
    ownerOwes: number
    recent: MunshiGive[]
}

const today = () => new Date().toISOString().slice(0, 10)

const addDays = (date: string, days: number) => {
    const d = new Date(`${date}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().slice(0, 10)
}

/** An unpaid bill whose due date has gone by. */
export const isOverdue = (e: Pick<Expense, 'payMode' | 'status' | 'paidOn' | 'dueDate'>) =>
    e.payMode === 'unpaid' && e.status === 'approved' && !e.paidOn && !!e.dueDate && e.dueDate < today()

export const isUnpaidBill = (e: Pick<Expense, 'payMode' | 'status' | 'paidOn'>) => e.payMode === 'unpaid' && e.status === 'approved' && !e.paidOn

/** Due within a week, or already late. */
export const isDueSoon = (e: Pick<Expense, 'payMode' | 'status' | 'paidOn' | 'dueDate'>) =>
    isUnpaidBill(e) && !!e.dueDate && e.dueDate <= addDays(today(), 7)

const toQuery = (filters: ExpenseFilters) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value)
    const text = params.toString()
    return text ? `?${text}` : ''
}

/** Newest first; a pending munshi entry is listed first. */
export const listExpenses = (filters: ExpenseFilters = {}): Promise<Expense[]> => request<Expense[]>(`${base}${toQuery(filters)}`)

/**
 * The backend decides whether it waits: a munshi's expense is pending while approval is on, anyone else's
 * counts at once.
 */
export const createExpense = (input: ExpenseInput): Promise<Expense> =>
    request<Expense>(base, {
        body: {
            date: input.date,
            categoryId: input.categoryId,
            description: input.description,
            amount: input.amount,
            factoryId: input.factoryId,
            payMode: input.payMode,
            accountId: input.payMode === 'paid' ? input.accountId || undefined : undefined,
            dueDate: input.payMode === 'unpaid' ? input.dueDate || undefined : undefined,
            shopId: input.payMode === 'shop_credit' ? input.shopId || undefined : undefined,
            photoName: input.photoName || undefined,
        },
    })

export const approveExpense = (id: string): Promise<Expense> => request<Expense>(`${base}/${id}/approve`, { body: {} })

/** Nothing was ever posted for a pending entry, so rejecting only records why. */
export const rejectExpense = (id: string, reason: string): Promise<Expense> => request<Expense>(`${base}/${id}/reject`, { body: { reason } })

/** Cancel is a reversal, not an edit: the money goes back, and a shop bill comes off the shop's khata. */
export const cancelExpense = (id: string, reason: string): Promise<Expense> => request<Expense>(`${base}/${id}/cancel`, { body: { reason } })

/** Pay an unpaid bill from an account on a date; only then does money leave. */
export const payBill = (id: string, input: { accountId: string; date: string }): Promise<Expense> =>
    request<Expense>(`${base}/${id}/pay`, { body: { accountId: input.accountId, date: input.date } })

export const getMunshiCash = (): Promise<MunshiSummary> => request<MunshiSummary>(`${base}/munshi-cash`)

/**
 * Give cash to the munshi: a transfer from cash or a bank into his own cash. Also how the owner settles a
 * negative balance. The name is kept for the form; the backend works it out from the account.
 */
export const giveCashToMunshi = (input: { fromAccountId: string; amount: number; date: string; note: string }): Promise<MunshiGive> =>
    request<MunshiGive>(`${base}/munshi-cash/gives`, {
        body: { fromAccountId: input.fromAccountId, amount: input.amount, date: input.date, note: input.note || undefined },
    })
