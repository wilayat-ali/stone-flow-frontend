import { ApiError } from '@/lib/client-api'
import { customerCheques, customerChequeState, today, type CustomerCheque, type CustomerChequeState } from './customer-cheque-store'
import { customerBalance, customerById, postCustomerEntry } from './customers'

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

export { customerChequeState, type CustomerCheque, type CustomerChequeState }

export const customerPaymentMethods = ['cash', 'bank', 'cheque'] as const
export type CustomerPaymentMethod = (typeof customerPaymentMethods)[number]

export const customerPaymentsQueryKey = 'customer-payments'
export const customerChequesQueryKey = 'customer-cheques'

export type CustomerPayment = {
    id: string
    receiptNo: string
    date: string
    /** `null` for a walk-in paying a bill; a walk-in has no khata. */
    customerId: string | null
    customerName: string
    amount: number
    method: CustomerPaymentMethod
    accountId: string
    accountName: string
    /** Paid with a bill, or as an advance for an order: shown for reference, allocation stays FIFO. */
    billId: string | null
    billNo: string | null
    orderId: string | null
    orderNo: string | null
    note: string
    status: 'posted' | 'reversed'
    chequeId: string | null
    createdBy: string
}

// In-memory stand-in for the backend; replace with `request()` calls like `features/admin/members.ts`.
// Money rows really go through the ledger service (03a); here only the customer khata is updated.
let payments: CustomerPayment[] = [
    seed('seed-pay1', 'RC-0001', '2026-09-22', 'c3', 'Rehman Marble', 18900, 'cash'),
    seed('seed-pay2', 'RC-0002', '2026-10-08', 'c1', 'Haji Saleem', 10000, 'cash'),
    { ...seed('seed-pay3', 'RC-0003', '2026-09-28', 'c4', 'ABC Builders', 10000, 'cash'), billNo: 'B-0001' },
    seed('seed-pay4', 'RC-0004', '2026-09-20', 'c5', 'Al-Noor Developers', 40000, 'bank', 'HBL · Current A/C'),
    { ...seed('seed-pay5', 'RC-0005', '2026-10-05', 'c6', 'Madina Tiles & Marble', 80000, 'bank', 'HBL · Current A/C'), orderNo: null, note: 'Advance' },
    { ...seed('seed-pay6', 'RC-0006', '2026-09-25', 'c7', 'Royal Interiors', 50000, 'cheque'), chequeId: 'cc1' },
    { ...seed('seed-pay7', 'RC-0007', '2026-11-01', 'c4', 'ABC Builders', 5200, 'cheque'), chequeId: 'cc2' },
    { ...seed('seed-pay8', 'RC-0008', '2026-11-05', 'c5', 'Al-Noor Developers', 60000, 'cheque'), chequeId: 'cc3' },
]

function seed(
    id: string,
    receiptNo: string,
    date: string,
    customerId: string,
    customerName: string,
    amount: number,
    method: CustomerPaymentMethod,
    accountName = ''
): CustomerPayment {
    return {
        id,
        receiptNo,
        date,
        customerId,
        customerName,
        amount,
        method,
        accountId: '',
        accountName,
        billId: null,
        billNo: null,
        orderId: null,
        orderNo: null,
        note: '',
        status: 'posted',
        chequeId: null,
        createdBy: 'Wilayat Ali',
    }
}

let receiptSeq = 8

const nextReceipt = () => {
    receiptSeq += 1
    return `RC-${String(receiptSeq).padStart(4, '0')}`
}

const chequeOf = (payment: CustomerPayment) => customerCheques.find((c) => c.id === payment.chequeId)

/** The cheque a payment was made by, if any, to show its state beside the payment. */
export const chequeOfPayment = (payment: CustomerPayment): CustomerCheque | undefined => chequeOf(payment)

const khataDetail = (payment: CustomerPayment, cheque?: CustomerCheque) =>
    cheque
        ? `Cheque no. ${cheque.chequeNo} · ${cheque.bankName} · dated ${cheque.chequeDate}`
        : `${payment.orderNo ? 'Advance received' : 'Payment received'} · ${payment.method === 'cash' ? 'cash' : `bank${payment.accountName ? ` · ${payment.accountName}` : ''}`}${payment.billNo ? ` · ${payment.billNo}` : ''}`

export type ReceiveInput = {
    date: string
    customerId: string
    amount: number
    method: CustomerPaymentMethod
    accountId: string
    accountName: string
    bankName: string
    chequeNo: string
    chequeDate: string
    note: string
    billId?: string | null
    billNo?: string | null
    orderId?: string | null
    orderNo?: string | null
}

/**
 * The customer's khata is credited when the money (or cheque) is received. A cheque reaches the bank only
 * when it clears. Anything above what is owed stays as an advance, applied FIFO to later bills.
 */
export const receivePayment = async (input: ReceiveInput, by: string): Promise<{ payment: CustomerPayment; advance: number }> => {
    await delay()
    if (!(input.amount > 0)) throw new ApiError(400, { code: 'PAYMENT_AMOUNT' })
    if (input.date > today()) throw new ApiError(400, { code: 'DATE_IN_FUTURE' })
    const customer = customerById(input.customerId)
    if (!customer) throw new ApiError(404, { code: 'notFound' })
    if (input.method === 'cheque') {
        const duplicate = customerCheques.some(
            (c) => c.bankName.toLowerCase() === input.bankName.trim().toLowerCase() && c.chequeNo === input.chequeNo.trim() && c.status !== 'bounced'
        )
        if (duplicate) throw new ApiError(409, { code: 'DUPLICATE_CHEQUE' })
    }
    const owed = Math.max(customerBalance(customer.id), 0)
    const id = crypto.randomUUID()
    const chequeId = input.method === 'cheque' ? crypto.randomUUID() : null
    const payment: CustomerPayment = {
        id,
        receiptNo: nextReceipt(),
        date: input.date,
        customerId: customer.id,
        customerName: customer.name,
        amount: input.amount,
        method: input.method,
        accountId: input.method === 'cheque' ? '' : input.accountId,
        accountName: input.method === 'cheque' ? '' : input.accountName,
        billId: input.billId ?? null,
        billNo: input.billNo ?? null,
        orderId: input.orderId ?? null,
        orderNo: input.orderNo ?? null,
        note: input.note,
        status: 'posted',
        chequeId,
        createdBy: by,
    }
    let cheque: CustomerCheque | undefined
    if (chequeId) {
        cheque = {
            id: chequeId,
            paymentId: id,
            customerId: customer.id,
            customerName: customer.name,
            bankName: input.bankName.trim(),
            chequeNo: input.chequeNo.trim(),
            chequeDate: input.chequeDate,
            receivedOn: input.date,
            amount: input.amount,
            status: 'pending',
            depositAccountId: null,
            depositAccountName: null,
            clearedOn: null,
            bouncedOn: null,
            bounceReason: null,
        }
        customerCheques.push(cheque)
    }
    payments = [...payments, payment]
    postCustomerEntry({ customerId: customer.id, date: input.date, kind: 'credit', amount: input.amount, detail: khataDetail(payment, cheque), sourceId: id })
    return { payment, advance: Math.max(0, input.amount - owed) }
}

/**
 * A bill's payment-now or an order's advance already posts its own khata row; this only keeps the receipt
 * so the Payments tab shows every rupee received.
 */
export const noteReceipt = (input: {
    id: string
    date: string
    customerId: string | null
    customerName: string
    amount: number
    method: 'cash' | 'bank'
    accountName: string
    billId?: string
    billNo?: string
    orderId?: string
    orderNo?: string
    by: string
}) => {
    payments = [
        ...payments,
        {
            id: input.id,
            receiptNo: nextReceipt(),
            date: input.date,
            customerId: input.customerId,
            customerName: input.customerName,
            amount: input.amount,
            method: input.method,
            accountId: '',
            accountName: input.accountName,
            billId: input.billId ?? null,
            billNo: input.billNo ?? null,
            orderId: input.orderId ?? null,
            orderNo: input.orderNo ?? null,
            note: '',
            status: 'posted',
            chequeId: null,
            createdBy: input.by,
        },
    ]
}

/** Money received for an order that is not already one of the order's own advances. */
export const advancePaymentsFor = (orderId: string, ownIds: string[]) =>
    payments.filter((p) => p.orderId === orderId && p.status === 'posted' && !ownIds.includes(p.id)).reduce((s, p) => s + p.amount, 0)

export type PaymentFilters = { method?: CustomerPaymentMethod; q?: string }

const byDateDesc = (a: { date: string; receiptNo?: string }, b: { date: string; receiptNo?: string }) =>
    b.date.localeCompare(a.date) || (b.receiptNo ?? '').localeCompare(a.receiptNo ?? '')

export const listCustomerPayments = async (filters: PaymentFilters = {}): Promise<CustomerPayment[]> => {
    await delay()
    const q = filters.q?.trim().toLowerCase()
    return payments
        .filter(
            (p) =>
                (!filters.method || p.method === filters.method) &&
                (!q || [p.customerName, p.receiptNo, p.billNo ?? '', p.orderNo ?? '', chequeOf(p)?.chequeNo ?? ''].some((v) => v.toLowerCase().includes(q)))
        )
        .sort(byDateDesc)
}

/** Reversing a payment puts the amount back on the khata as a returned-money charge; the receipt stays, marked. */
export const reversePayment = async (id: string): Promise<CustomerPayment> => {
    await delay()
    const payment = payments.find((p) => p.id === id)
    if (!payment) throw new ApiError(404, { code: 'notFound' })
    if (payment.status !== 'posted') throw new ApiError(409, { code: 'ALREADY_REVERSED' })
    const cheque = chequeOf(payment)
    if (cheque?.status === 'bounced') throw new ApiError(409, { code: 'ALREADY_RETURNED' })
    if (payment.customerId) {
        postCustomerEntry({
            customerId: payment.customerId,
            date: today(),
            kind: 'charge',
            amount: payment.amount,
            detail: `Payment ${payment.receiptNo} reversed`,
            sourceId: `${payment.id}-reversed`,
            returned: true,
        })
    }
    const reversed = { ...payment, status: 'reversed' as const }
    payments = payments.map((p) => (p.id === id ? reversed : p))
    return reversed
}

export type ChequeFilters = { state?: CustomerChequeState }

const stateRank = (c: CustomerCheque) => (customerChequeState(c) === 'due' ? 0 : customerChequeState(c) === 'post_dated' ? 1 : 2)

/** A reversed payment's cheque is dropped. Due cheques first, then post-dated by date, then done ones. */
export const listCustomerCheques = async (filters: ChequeFilters = {}): Promise<CustomerCheque[]> => {
    await delay()
    const live = (c: CustomerCheque) => payments.find((p) => p.id === c.paymentId)?.status !== 'reversed'
    return customerCheques
        .filter((c) => live(c) && (!filters.state || customerChequeState(c) === filters.state))
        .sort((a, b) => stateRank(a) - stateRank(b) || (stateRank(a) < 2 ? a.chequeDate.localeCompare(b.chequeDate) : b.chequeDate.localeCompare(a.chequeDate)))
}

/** Pending cheques whose date has come: the nav badge and the attention strips. */
export const dueCheques = (): CustomerCheque[] =>
    customerCheques.filter((c) => customerChequeState(c) === 'due' && payments.find((p) => p.id === c.paymentId)?.status !== 'reversed')

export const dueChequeCount = async (): Promise<number> => dueCheques().length

const findCheque = (id: string) => {
    const cheque = customerCheques.find((c) => c.id === id)
    if (!cheque) throw new ApiError(404, { code: 'notFound' })
    if (cheque.status !== 'pending') throw new ApiError(409, { code: 'ALREADY_DECIDED' })
    return cheque
}

const update = (id: string, patch: Partial<CustomerCheque>) => {
    const i = customerCheques.findIndex((c) => c.id === id)
    customerCheques[i] = { ...customerCheques[i], ...patch }
    return customerCheques[i]
}

/** Deposited: the money reaches the chosen bank on the cleared date. */
export const clearCustomerCheque = async (id: string, values: { accountId: string; accountName: string; date: string }): Promise<CustomerCheque> => {
    await delay()
    const cheque = findCheque(id)
    if (values.date > today()) throw new ApiError(400, { code: 'DATE_IN_FUTURE' })
    if (values.date < cheque.receivedOn) throw new ApiError(400, { code: 'BEFORE_RECEIVED' })
    return update(id, { status: 'cleared', depositAccountId: values.accountId, depositAccountName: values.accountName, clearedOn: values.date })
}

/** The customer owes again: the amount goes back on the khata as a charge, and the original receipt stays. */
export const bounceCustomerCheque = async (id: string, values: { reason: string; date: string }): Promise<CustomerCheque> => {
    await delay()
    const cheque = findCheque(id)
    if (values.date > today()) throw new ApiError(400, { code: 'DATE_IN_FUTURE' })
    postCustomerEntry({
        customerId: cheque.customerId,
        date: values.date,
        kind: 'charge',
        amount: cheque.amount,
        detail: `Cheque #${cheque.chequeNo} bounced`,
        sourceId: `${cheque.paymentId}-bounced`,
        returned: true,
    })
    return update(id, { status: 'bounced', bouncedOn: values.date, bounceReason: values.reason })
}
