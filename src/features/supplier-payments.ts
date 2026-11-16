import { request } from '@/lib/client-api'
import { allPurchases } from './purchases'

export const paymentMethods = ['cash', 'bank_transfer', 'cheque'] as const
export type PaymentMethod = (typeof paymentMethods)[number]

/** `pending` is a munshi's entry that has no effect until the owner confirms it. */
export type PaymentStatus = 'pending' | 'confirmed' | 'reversed'

export type ChequeStatus = 'issued' | 'cleared' | 'bounced' | 'cancelled'

/** `issued` split by date: a cheque past its date should be checked, two days past needs an answer. */
export type ChequeState = ChequeStatus | 'due' | 'confirm'

export type SupplierPayment = {
    id: string
    voucherNo: string
    date: string
    supplierId: string
    supplierName: string
    method: PaymentMethod
    accountId: string
    accountName: string
    amount: number
    /** Bank transfer reference. */
    reference: string
    chequeId: string | null
    /** Trucks this payment was made for; the rest of it goes to the oldest unpaid ones. */
    forPurchaseIds: string[]
    status: PaymentStatus
    note: string
    createdBy: string
}

export type Cheque = {
    id: string
    no: string
    accountId: string
    accountName: string
    supplierId: string
    supplierName: string
    amount: number
    /** The day it was handed over. */
    issuedOn: string
    /** The date written on the cheque. */
    chequeDate: string
    status: ChequeStatus
    statusDate: string | null
    reason: string | null
    /** Bank charge when it bounced, in PKR. */
    charge: number
    paymentId: string
    replacedByPaymentId: string | null
}

export type PaymentInput = {
    date: string
    supplierId: string
    supplierName: string
    method: PaymentMethod
    accountId: string
    accountName: string
    amount: number
    reference: string
    chequeNo: string
    chequeDate: string
    forPurchaseIds: string[]
    note: string
    /** The bounced cheque this one replaces. */
    replacesChequeId?: string
}

/** What one truck has had paid against it. */
export type PurchasePaymentInfo = {
    paid: number
    /** Part of `paid` that is still an uncleared cheque. */
    unclearedCheque: number
}

export const paymentsQueryKey = 'supplier-payments'
export const chequesQueryKey = 'supplier-cheques'

const paymentsBase = '/api/supplier-payments'
const chequesBase = '/api/supplier-cheques'

const today = () => new Date().toISOString().slice(0, 10)

const addDays = (date: string, days: number) => {
    const d = new Date(`${date}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().slice(0, 10)
}

export const chequeState = (cheque: Cheque): ChequeState => {
    if (cheque.status !== 'issued') return cheque.status
    if (addDays(cheque.chequeDate, 2) <= today()) return 'confirm'
    return cheque.chequeDate <= today() ? 'due' : 'issued'
}

export const isDueThisWeek = (cheque: Cheque) => cheque.status === 'issued' && cheque.chequeDate <= addDays(today(), 7)

// The last lists the backend gave. `paymentsByPurchase` reads them at once, so it can be called while rendering.
let payments: SupplierPayment[] = []
let cheques: Cheque[] = []

const byDateDesc = (a: { date: string; id: string }, b: { date: string; id: string }) =>
    b.date.localeCompare(a.date) || b.id.localeCompare(a.id)

export const listPayments = async (): Promise<SupplierPayment[]> => {
    payments = await request<SupplierPayment[]>(paymentsBase)
    return [...payments].sort(byDateDesc)
}

/** Cheques that need a decision first, then by cheque date. */
export const listCheques = async (): Promise<Cheque[]> => {
    cheques = await request<Cheque[]>(chequesBase)
    const rank = (c: Cheque) => (chequeState(c) === 'confirm' ? 0 : c.status === 'issued' ? 1 : 2)
    return [...cheques].sort(
        (a, b) =>
            rank(a) - rank(b) ||
            (rank(a) < 2 ? a.chequeDate.localeCompare(b.chequeDate) : b.chequeDate.localeCompare(a.chequeDate))
    )
}

const chequeOf = (payment: SupplierPayment) => cheques.find((c) => c.id === payment.chequeId)

/** A payment counts while confirmed, unless its cheque bounced or was cancelled. */
const isActive = (payment: SupplierPayment) => {
    if (payment.status !== 'confirmed') return false
    const cheque = chequeOf(payment)
    return !cheque || (cheque.status !== 'bounced' && cheque.status !== 'cancelled')
}

/**
 * Applies each active payment to its supplier's trucks: first the trucks it was made for, then the
 * oldest unpaid ones. Money paid for a truck still waiting for approval is held, not spread.
 */
export const paymentsByPurchase = (): Map<string, PurchasePaymentInfo> => {
    const items = new Map<string, { total: number; paid: number; uncleared: number }>()
    const billable = allPurchases().filter((p) => ['in_stock', 'cutting', 'cut'].includes(p.status))
    for (const p of billable) items.set(p.id, { total: p.total, paid: 0, uncleared: 0 })

    const give = (id: string, payment: SupplierPayment, amount: number) => {
        const item = items.get(id)
        if (!item) return 0
        const applied = Math.min(amount, item.total - item.paid)
        if (applied <= 0) return 0
        item.paid += applied
        if (chequeOf(payment)?.status === 'issued') item.uncleared += applied
        return applied
    }

    const suppliers = new Set(payments.map((p) => p.supplierId))
    for (const supplierId of suppliers) {
        const charges = billable
            .filter((p) => p.supplierId === supplierId)
            .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
        const mine = payments.filter((p) => p.supplierId === supplierId && isActive(p)).sort((a, b) => a.date.localeCompare(b.date))
        for (const payment of mine) {
            let left = payment.amount
            let held = false
            for (const id of payment.forPurchaseIds) {
                if (items.has(id)) left -= give(id, payment, left)
                else if (allPurchases().find((p) => p.id === id)?.status === 'pending') held = true
            }
            if (held) continue
            for (const charge of charges) {
                if (left <= 0) break
                left -= give(charge.id, payment, left)
            }
        }
    }
    return new Map([...items].map(([id, v]) => [id, { paid: v.paid, unclearedCheque: v.uncleared }]))
}

/** What the backend takes: names are looked up there, and a cheque's fields only matter for a cheque. */
const toBody = (input: PaymentInput) => ({
    date: input.date,
    supplierId: input.supplierId,
    method: input.method,
    accountId: input.accountId,
    amount: input.amount,
    ...(input.method === 'bank_transfer' && input.reference ? { reference: input.reference } : {}),
    ...(input.method === 'cheque' ? { chequeNo: input.chequeNo, chequeDate: input.chequeDate } : {}),
    forPurchaseIds: input.forPurchaseIds,
    note: input.note,
    ...(input.replacesChequeId ? { replacesChequeId: input.replacesChequeId } : {}),
})

/**
 * A munshi's payment waits as `pending` (no effect) while approval is on; anyone else's counts at once. The
 * backend decides which. A cheque is recorded when it is given, but reaches the bank only when it clears.
 */
export const createPayment = (input: PaymentInput) => request<SupplierPayment>(paymentsBase, { body: toBody(input) })

export const confirmPayment = (id: string) =>
    request<SupplierPayment>(`${paymentsBase}/${id}/confirm`, { method: 'POST', body: {} })

/** Rejecting reverses a pending payment: nothing was ever posted, and its cheque is cancelled. */
export const rejectPayment = (id: string) => request<SupplierPayment>(`${paymentsBase}/${id}/reject`, { body: {} })

/** The money left the bank: the cheque stops showing as uncleared. */
export const clearCheque = (id: string, date: string) => request<Cheque>(`${chequesBase}/${id}/clear`, { body: { date } })

export const bounceCheque = (id: string, values: { date: string; reason: string; charge: number }) =>
    request<Cheque>(`${chequesBase}/${id}/bounce`, { body: values })

/** The supplier returned it unused. */
export const cancelCheque = (id: string) => request<Cheque>(`${chequesBase}/${id}/cancel`, { method: 'POST', body: {} })
