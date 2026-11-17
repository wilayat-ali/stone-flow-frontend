import { request } from '@/lib/client-api'
import { loadRealStock } from './stock/real-stock'

export const customerPaymentMethods = ['cash', 'bank', 'cheque'] as const
export type CustomerPaymentMethod = (typeof customerPaymentMethods)[number]

export const customerPaymentsQueryKey = 'customer-payments'
export const customerChequesQueryKey = 'customer-cheques'

const paymentsBase = '/api/customer-payments'
const chequesBase = '/api/customer-cheques'

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
    /** Paid with a bill, or as an advance for an order: shown for reference, allocation stays oldest-first. */
    billId: string | null
    billNo: string | null
    orderId: string | null
    orderNo: string | null
    note: string
    status: 'posted' | 'reversed'
    chequeId: string | null
    createdBy: string
}

export type CustomerCheque = {
    id: string
    paymentId: string
    customerId: string
    customerName: string
    bankName: string
    chequeNo: string
    /** The date written on the cheque; often in the future. */
    chequeDate: string
    /** The day the customer handed it over. */
    receivedOn: string
    amount: number
    status: 'pending' | 'cleared' | 'bounced'
    depositAccountId: string | null
    depositAccountName: string | null
    clearedOn: string | null
    bouncedOn: string | null
    bounceReason: string | null
}

export const today = () => new Date().toISOString().slice(0, 10)

export type CustomerChequeState = 'post_dated' | 'due' | 'cleared' | 'bounced'

/** A pending cheque is post-dated until its date arrives, then due: deposit it. */
export const customerChequeState = (cheque: Pick<CustomerCheque, 'status' | 'chequeDate'>): CustomerChequeState =>
    cheque.status !== 'pending' ? cheque.status : cheque.chequeDate > today() ? 'post_dated' : 'due'

/** The last cheques the backend gave (a reversed payment's cheque is already left out), for the badges that read them at once. */
let cheques: CustomerCheque[] = []

const loadCheques = async () => {
    cheques = await request<CustomerCheque[]>(chequesBase)
    return cheques
}

/** The cheque a payment was made by, if any, to show its state beside the payment. */
export const chequeOfPayment = (payment: CustomerPayment): CustomerCheque | undefined => cheques.find((c) => c.id === payment.chequeId)

/** Cheques received but not yet cleared: they already lowered the khata, but no money is in the bank. */
export const unclearedChequeTotal = () => cheques.filter((c) => c.status === 'pending').reduce((s, c) => s + c.amount, 0)

export type ReceiveInput = {
    date: string
    customerId: string
    amount: number
    method: CustomerPaymentMethod
    accountId: string
    bankName: string
    chequeNo: string
    chequeDate: string
    note: string
    billId?: string | null
    orderId?: string | null
}

/**
 * The customer's khata is credited when the money (or cheque) is received. A cheque reaches the bank only
 * when it clears. Anything above what is owed stays as an advance, applied to later bills oldest first.
 */
export const receivePayment = async (input: ReceiveInput): Promise<{ payment: CustomerPayment; advance: number }> => {
    const isCheque = input.method === 'cheque'
    const result = await request<{ payment: CustomerPayment; advance: number }>(paymentsBase, {
        body: {
            date: input.date,
            customerId: input.customerId,
            amount: input.amount,
            method: input.method,
            accountId: !isCheque && input.accountId ? input.accountId : undefined,
            bankName: isCheque ? input.bankName : undefined,
            chequeNo: isCheque ? input.chequeNo : undefined,
            chequeDate: isCheque ? input.chequeDate : undefined,
            note: input.note,
            billId: input.billId ?? undefined,
            orderId: input.orderId ?? undefined,
        },
    })
    await loadRealStock()
    return result
}

export type PaymentFilters = { method?: CustomerPaymentMethod; q?: string }

const toQuery = (filters: PaymentFilters) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value)
    const text = params.toString()
    return text ? `?${text}` : ''
}

/** Newest first. The cheques are loaded too, so each payment can show its cheque's state. */
export const listCustomerPayments = async (filters: PaymentFilters = {}): Promise<CustomerPayment[]> => {
    const [rows] = await Promise.all([request<CustomerPayment[]>(`${paymentsBase}${toQuery(filters)}`), loadCheques()])
    return rows
}

/** Reversing a payment puts the amount back on the khata as a returned-money charge; the receipt stays, marked. */
export const reversePayment = (id: string): Promise<CustomerPayment> => request<CustomerPayment>(`${paymentsBase}/${id}/reverse`, { body: {} })

export type ChequeFilters = { state?: CustomerChequeState }

const stateRank = (c: CustomerCheque) => (customerChequeState(c) === 'due' ? 0 : customerChequeState(c) === 'post_dated' ? 1 : 2)

/** Due cheques first, then post-dated by date, then done ones. */
export const listCustomerCheques = async (filters: ChequeFilters = {}): Promise<CustomerCheque[]> =>
    (await loadCheques())
        .filter((c) => !filters.state || customerChequeState(c) === filters.state)
        .sort((a, b) => stateRank(a) - stateRank(b) || (stateRank(a) < 2 ? a.chequeDate.localeCompare(b.chequeDate) : b.chequeDate.localeCompare(a.chequeDate)))

/** Pending cheques whose date has come: the nav badge and the attention strips. */
export const dueCheques = (): CustomerCheque[] => cheques.filter((c) => customerChequeState(c) === 'due')

export const dueChequeCount = async (): Promise<number> => {
    await loadCheques()
    return dueCheques().length
}

/** Deposited: the money reaches the chosen bank on the cleared date. */
export const clearCustomerCheque = (id: string, values: { accountId: string; date: string }): Promise<CustomerCheque> =>
    request<CustomerCheque>(`${chequesBase}/${id}/clear`, { body: { accountId: values.accountId, date: values.date } })

/** The customer owes again: the amount goes back on the khata as a charge, and the original receipt stays. */
export const bounceCustomerCheque = (id: string, values: { reason: string; date: string }): Promise<CustomerCheque> =>
    request<CustomerCheque>(`${chequesBase}/${id}/bounce`, { body: { reason: values.reason, date: values.date } })
