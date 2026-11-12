import { ApiError } from '@/lib/client-api'
import { extraOutflow, MUNSHI_ACCOUNT_ID } from './account-outflow'
import { postSupplierEntry } from './suppliers'

export { MUNSHI_ACCOUNT_ID }

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

export const expensesQueryKey = 'expenses'
export const munshiCashQueryKey = 'munshi-cash'


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
    accountId: string
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

const today = () => new Date().toISOString().slice(0, 10)

const addDays = (date: string, days: number) => {
    const d = new Date(`${date}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().slice(0, 10)
}

/** An unpaid bill whose due date has gone by. */
export const isOverdue = (e: Pick<Expense, 'payMode' | 'status' | 'paidOn' | 'dueDate'>) =>
    e.payMode === 'unpaid' && e.status === 'approved' && !e.paidOn && !!e.dueDate && e.dueDate < today()

export const isUnpaidBill = (e: Pick<Expense, 'payMode' | 'status' | 'paidOn'>) =>
    e.payMode === 'unpaid' && e.status === 'approved' && !e.paidOn

/** Due within a week, or already late. */
export const isDueSoon = (e: Pick<Expense, 'payMode' | 'status' | 'paidOn' | 'dueDate'>) =>
    isUnpaidBill(e) && !!e.dueDate && e.dueDate <= addDays(today(), 7)

// In-memory stand-in for the backend; replace with `request()` calls like `features/admin/members.ts`.
// Money rows really go through the ledger service (03a); here only the supplier (shop) khata is updated.
let expenses: Expense[] = [
    {
        id: 'ex1',
        expNo: 'EX-0001',
        date: '2026-11-03',
        categoryId: 'lunch-tea',
        categoryName: 'Lunch & tea',
        description: 'Tea and lunch for the cutting crew',
        amount: 3500,
        factoryId: 'main',
        factoryName: 'Saadat Marble — Main Factory',
        payMode: 'paid',
        accountId: '',
        accountName: 'Cash in hand',
        dueDate: null,
        paidOn: '2026-11-03',
        shopId: null,
        shopName: '',
        photoName: null,
        status: 'approved',
        reason: null,
        createdBy: 'Wilayat Ali',
    },
    {
        id: 'ex2',
        expNo: 'EX-0002',
        date: '2026-11-05',
        categoryId: 'electricity',
        categoryName: 'Electricity bill',
        description: 'K-Electric, October',
        amount: 48200,
        factoryId: 'main',
        factoryName: 'Saadat Marble — Main Factory',
        payMode: 'unpaid',
        accountId: '',
        accountName: '',
        dueDate: '2026-11-15',
        paidOn: null,
        shopId: null,
        shopName: '',
        photoName: 'k-electric-oct.jpg',
        status: 'approved',
        reason: null,
        createdBy: 'Wilayat Ali',
    },
    {
        id: 'ex3',
        expNo: 'EX-0003',
        date: '2026-11-08',
        categoryId: 'machine-parts',
        categoryName: 'Machine & spare parts',
        description: 'Gang saw blade segments',
        amount: 18500,
        factoryId: 'main',
        factoryName: 'Saadat Marble — Main Factory',
        payMode: 'shop_credit',
        accountId: '',
        accountName: '',
        dueDate: null,
        paidOn: null,
        shopId: 's5',
        shopName: 'Madina Machinery Store',
        photoName: null,
        status: 'approved',
        reason: null,
        createdBy: 'Wilayat Ali',
    },
    {
        id: 'ex4',
        expNo: 'EX-0004',
        date: '2026-11-09',
        categoryId: 'water',
        categoryName: 'Water tanker',
        description: 'Two tankers',
        amount: 6000,
        factoryId: 'main',
        factoryName: 'Saadat Marble — Main Factory',
        payMode: 'paid',
        accountId: MUNSHI_ACCOUNT_ID,
        accountName: 'Munshi cash',
        dueDate: null,
        paidOn: '2026-11-09',
        shopId: null,
        shopName: '',
        photoName: null,
        status: 'approved',
        reason: null,
        createdBy: 'Munshi',
    },
    {
        id: 'ex5',
        expNo: 'EX-0005',
        date: '2026-11-11',
        categoryId: 'diesel',
        categoryName: 'Diesel & transport',
        description: 'Diesel for the loader',
        amount: 4500,
        factoryId: 'north-yard',
        factoryName: 'North Yard',
        payMode: 'paid',
        accountId: MUNSHI_ACCOUNT_ID,
        accountName: 'Munshi cash',
        dueDate: null,
        paidOn: '2026-11-11',
        shopId: null,
        shopName: '',
        photoName: null,
        status: 'pending',
        reason: null,
        createdBy: 'Munshi',
    },
]
let expenseSeq = expenses.length

let gives: MunshiGive[] = [
    {
        id: 'mg1',
        date: '2026-11-01',
        fromAccountId: '',
        fromAccountName: 'Cash in hand',
        amount: 20000,
        note: '',
        by: 'Wilayat Ali',
    },
]

// The seeded credit expense is already on the shop's khata.
postSupplierEntry({ supplierId: 's5', date: '2026-11-08', kind: 'charge', amount: 18500, detail: 'EX-0003 · Gang saw blade segments', sourceId: 'ex3' })

/** What an approved expense does: a shop bill goes on the shop's khata. */
const applyNow = (expense: Expense) => {
    if (expense.payMode === 'shop_credit' && expense.shopId) {
        postSupplierEntry({
            supplierId: expense.shopId,
            date: expense.date,
            kind: 'charge',
            amount: expense.amount,
            detail: `${expense.expNo} · ${expense.description}`,
            sourceId: expense.id,
        })
    }
}

const find = (id: string) => {
    const expense = expenses.find((e) => e.id === id)
    if (!expense) throw new ApiError(404, { code: 'notFound' })
    return expense
}

const replace = (next: Expense) => {
    expenses = expenses.map((e) => (e.id === next.id ? next : e))
    return next
}

/** Money paid out of an account by expenses (paid now, or a bill paid later) and gifts to the munshi, so balances can be checked. */
export const accountOutflow = (accountId: string) =>
    expenses
        .filter((e) => e.status === 'approved' && e.payMode !== 'shop_credit' && e.accountId === accountId && (e.payMode === 'paid' || !!e.paidOn))
        .reduce((s, e) => s + e.amount, 0) + gives.filter((g) => g.fromAccountId === accountId).reduce((s, g) => s + g.amount, 0) +
    extraOutflow(accountId)

/** What the munshi has been given minus what he spent (positive: he holds it; negative: he spent his own money). */
export const munshiBalance = () =>
    gives.reduce((s, g) => s + g.amount, 0) -
    expenses
        .filter((e) => e.status === 'approved' && e.accountId === MUNSHI_ACCOUNT_ID && (e.payMode === 'paid' || !!e.paidOn))
        .reduce((s, e) => s + e.amount, 0) -
    extraOutflow(MUNSHI_ACCOUNT_ID)

export const listExpenses = async (filters: ExpenseFilters = {}): Promise<Expense[]> => {
    await delay()
    const q = filters.q?.trim().toLowerCase()
    return expenses
        .filter(
            (e) =>
                (!filters.categoryId || e.categoryId === filters.categoryId) &&
                (!filters.factoryId || e.factoryId === filters.factoryId) &&
                (!filters.payMode || e.payMode === filters.payMode) &&
                (!filters.status || e.status === filters.status) &&
                (!q || [e.expNo, e.description, e.categoryName, e.shopName].some((v) => v.toLowerCase().includes(q)))
        )
        .sort((a, b) => b.date.localeCompare(a.date) || b.expNo.localeCompare(a.expNo))
}

/**
 * A munshi's expense waits as `pending` (no effect) when approval is on; anyone else's counts at once.
 * A munshi's cash may go negative, since he spent his own money; any other account is checked on the form.
 */
export const createExpense = async (input: ExpenseInput, options: { pending: boolean; by: string }): Promise<Expense> => {
    await delay()
    if (!(input.amount > 0)) throw new ApiError(400, { code: 'INVALID_AMOUNT' })
    if (input.date > today()) throw new ApiError(400, { code: 'FUTURE_DATE' })
    if (input.payMode === 'paid' && !input.accountId) throw new ApiError(400, { code: 'ACCOUNT_REQUIRED' })
    if (input.payMode === 'unpaid' && !input.dueDate) throw new ApiError(400, { code: 'DUE_DATE_REQUIRED' })
    if (input.payMode === 'shop_credit' && !input.shopId) throw new ApiError(400, { code: 'SHOP_REQUIRED' })
    expenseSeq += 1
    const expense: Expense = {
        ...input,
        id: crypto.randomUUID(),
        expNo: `EX-${String(expenseSeq).padStart(4, '0')}`,
        accountId: input.payMode === 'paid' ? input.accountId : '',
        accountName: input.payMode === 'paid' ? input.accountName : '',
        dueDate: input.payMode === 'unpaid' ? input.dueDate : null,
        paidOn: input.payMode === 'paid' ? input.date : null,
        shopId: input.payMode === 'shop_credit' ? input.shopId : null,
        shopName: input.payMode === 'shop_credit' ? input.shopName : '',
        status: options.pending ? 'pending' : 'approved',
        reason: null,
        createdBy: options.by,
    }
    expenses = [...expenses, expense]
    if (expense.status === 'approved') applyNow(expense)
    return expense
}

export const approveExpense = async (id: string): Promise<Expense> => {
    await delay()
    const expense = find(id)
    if (expense.status !== 'pending') throw new ApiError(409, { code: 'ALREADY_DECIDED' })
    const approved = replace({ ...expense, status: 'approved' })
    applyNow(approved)
    return approved
}

/** Nothing was ever posted for a pending entry, so rejecting only records why. */
export const rejectExpense = async (id: string, reason: string): Promise<Expense> => {
    await delay()
    const expense = find(id)
    if (expense.status !== 'pending') throw new ApiError(409, { code: 'ALREADY_DECIDED' })
    return replace({ ...expense, status: 'rejected', reason })
}

/** Cancel is a reversal, not an edit: a shop bill comes back off the shop's khata as a credit. */
export const cancelExpense = async (id: string, reason: string): Promise<Expense> => {
    await delay()
    const expense = find(id)
    if (expense.status !== 'approved') throw new ApiError(409, { code: 'ALREADY_DECIDED' })
    if (expense.payMode === 'shop_credit' && expense.shopId) {
        postSupplierEntry({
            supplierId: expense.shopId,
            date: today(),
            kind: 'credit',
            amount: expense.amount,
            detail: `${expense.expNo} cancelled`,
            sourceId: expense.id,
        })
    }
    return replace({ ...expense, status: 'cancelled', reason })
}

/** Pay an unpaid bill from an account on a date; only then does money leave. */
export const payBill = async (id: string, input: { accountId: string; accountName: string; date: string }): Promise<Expense> => {
    await delay()
    const expense = find(id)
    if (!isUnpaidBill(expense)) throw new ApiError(409, { code: 'ALREADY_PAID' })
    if (!input.accountId) throw new ApiError(400, { code: 'ACCOUNT_REQUIRED' })
    if (input.date > today()) throw new ApiError(400, { code: 'FUTURE_DATE' })
    if (input.date < expense.date) throw new ApiError(400, { code: 'BEFORE_BILL' })
    return replace({ ...expense, accountId: input.accountId, accountName: input.accountName, paidOn: input.date })
}

export type MunshiSummary = {
    balance: number
    /** What the owner owes the munshi when his cash has gone negative. */
    ownerOwes: number
    recent: MunshiGive[]
}

export const getMunshiCash = async (): Promise<MunshiSummary> => {
    await delay(250)
    const balance = munshiBalance()
    return { balance, ownerOwes: Math.max(0, -balance), recent: [...gives].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5) }
}

/** Give cash to the munshi: a transfer from cash or a bank to Munshi cash. Also how the owner settles a negative balance. */
export const giveCashToMunshi = async (
    input: { fromAccountId: string; fromAccountName: string; amount: number; date: string; note: string },
    by: string
): Promise<MunshiGive> => {
    await delay()
    if (!(input.amount > 0)) throw new ApiError(400, { code: 'INVALID_AMOUNT' })
    if (input.date > today()) throw new ApiError(400, { code: 'FUTURE_DATE' })
    if (!input.fromAccountId) throw new ApiError(400, { code: 'ACCOUNT_REQUIRED' })
    const give: MunshiGive = { ...input, id: crypto.randomUUID(), by }
    gives = [...gives, give]
    return give
}
