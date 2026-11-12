import { ApiError } from '@/lib/client-api'
import { allPurchases } from './purchases'
import { markSupplierChequeCleared, postSupplierEntry } from './suppliers'

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

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

// In-memory stand-in for the backend; replace with `request()` calls like `features/admin/members.ts`.
// Money rows really go through the ledger service (03a); here only the supplier khata is updated.
let payments: SupplierPayment[] = [
    {
        id: 'pay1',
        voucherNo: 'PV-0001',
        date: '2026-09-12',
        supplierId: 's1',
        supplierName: 'Haji Gul Khan',
        method: 'cash',
        accountId: '',
        accountName: 'Cash in hand',
        amount: 145000,
        reference: '',
        chequeId: null,
        forPurchaseIds: ['p1'],
        status: 'confirmed',
        note: 'Paid at purchase',
        createdBy: 'Wilayat Ali',
    },
    {
        id: 'pay2',
        voucherNo: 'PV-0002',
        date: '2026-10-08',
        supplierId: 's1',
        supplierName: 'Haji Gul Khan',
        method: 'cheque',
        accountId: '',
        accountName: 'HBL · Current A/C',
        amount: 160000,
        reference: '',
        chequeId: 'chq1',
        forPurchaseIds: ['p5'],
        status: 'confirmed',
        note: 'Paid at purchase',
        createdBy: 'Wilayat Ali',
    },
    {
        id: 'pay3',
        voucherNo: 'PV-0003',
        date: '2026-10-03',
        supplierId: 's3',
        supplierName: 'Sher Zaman',
        method: 'bank_transfer',
        accountId: '',
        accountName: 'HBL · Current A/C',
        amount: 300000,
        reference: 'IBFT 551207',
        chequeId: null,
        forPurchaseIds: [],
        status: 'confirmed',
        note: '',
        createdBy: 'Wilayat Ali',
    },
]

let cheques: Cheque[] = [
    {
        id: 'chq1',
        no: '445125',
        accountId: '',
        accountName: 'HBL · Current A/C',
        supplierId: 's1',
        supplierName: 'Haji Gul Khan',
        amount: 160000,
        issuedOn: '2026-10-08',
        chequeDate: '2026-10-14',
        status: 'issued',
        statusDate: null,
        reason: null,
        charge: 0,
        paymentId: 'pay2',
        replacedByPaymentId: null,
    },
]

let voucherSeq = 3

const byDateDesc = (a: { date: string; id: string }, b: { date: string; id: string }) =>
    b.date.localeCompare(a.date) || b.id.localeCompare(a.id)

export const listPayments = async (): Promise<SupplierPayment[]> => {
    await delay()
    return [...payments].sort(byDateDesc)
}

/** Cheques that need a decision first, then by cheque date. */
export const listCheques = async (): Promise<Cheque[]> => {
    await delay()
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

const supplierDetail = (payment: SupplierPayment, cheque?: Cheque) =>
    cheque
        ? `Cheque no. ${cheque.no} · ${payment.accountName} · dated ${cheque.chequeDate}`
        : payment.method === 'cash'
          ? `Cash paid · ${payment.voucherNo}`
          : `Bank transfer · ${payment.accountName}${payment.reference ? ` · ${payment.reference}` : ''}`

/** The payment now counts: it comes off what the supplier is owed. */
const postToKhata = (payment: SupplierPayment) => {
    const cheque = chequeOf(payment)
    postSupplierEntry({
        supplierId: payment.supplierId,
        date: payment.date,
        kind: 'credit',
        amount: payment.amount,
        detail: supplierDetail(payment, cheque),
        unclearedCheque: cheque?.status === 'issued',
        sourceId: payment.id,
    })
}

/**
 * A munshi's payment waits as `pending` (no effect) when approval is on; anyone else's counts at once.
 * A cheque is recorded when it is given, but reaches the bank only when it clears.
 */
export const createPayment = async (
    input: PaymentInput,
    options: { pending: boolean; by: string }
): Promise<SupplierPayment> => {
    await delay()
    if (input.method === 'cheque') {
        const used = cheques.some((c) => c.accountId === input.accountId && c.no === input.chequeNo && c.status !== 'cancelled')
        if (used) throw new ApiError(409, { code: 'DUPLICATE_CHEQUE' })
    }
    const id = crypto.randomUUID()
    const chequeId = input.method === 'cheque' ? crypto.randomUUID() : null
    voucherSeq += 1
    const payment: SupplierPayment = {
        id,
        voucherNo: `PV-${String(voucherSeq).padStart(4, '0')}`,
        date: input.date,
        supplierId: input.supplierId,
        supplierName: input.supplierName,
        method: input.method,
        accountId: input.accountId,
        accountName: input.accountName,
        amount: input.amount,
        reference: input.reference,
        chequeId,
        forPurchaseIds: input.forPurchaseIds,
        status: options.pending ? 'pending' : 'confirmed',
        note: input.note,
        createdBy: options.by,
    }
    if (chequeId) {
        cheques = [
            ...cheques,
            {
                id: chequeId,
                no: input.chequeNo,
                accountId: input.accountId,
                accountName: input.accountName,
                supplierId: input.supplierId,
                supplierName: input.supplierName,
                amount: input.amount,
                issuedOn: input.date,
                chequeDate: input.chequeDate,
                status: 'issued',
                statusDate: null,
                reason: null,
                charge: 0,
                paymentId: id,
                replacedByPaymentId: null,
            },
        ]
    }
    if (input.replacesChequeId) {
        cheques = cheques.map((c) => (c.id === input.replacesChequeId ? { ...c, replacedByPaymentId: id } : c))
    }
    payments = [...payments, payment]
    if (payment.status === 'confirmed') postToKhata(payment)
    return payment
}

export const confirmPayment = async (id: string): Promise<SupplierPayment> => {
    await delay()
    const payment = payments.find((p) => p.id === id)
    if (!payment) throw new ApiError(404, { code: 'notFound' })
    if (payment.status !== 'pending') throw new ApiError(409, { code: 'ALREADY_DECIDED' })
    const confirmed = { ...payment, status: 'confirmed' as const }
    payments = payments.map((p) => (p.id === id ? confirmed : p))
    postToKhata(confirmed)
    return confirmed
}

/** Rejecting reverses a pending payment: nothing was ever posted, and its cheque is cancelled. */
export const rejectPayment = async (id: string): Promise<SupplierPayment> => {
    await delay()
    const payment = payments.find((p) => p.id === id)
    if (!payment) throw new ApiError(404, { code: 'notFound' })
    if (payment.status !== 'pending') throw new ApiError(409, { code: 'ALREADY_DECIDED' })
    const reversed = { ...payment, status: 'reversed' as const }
    payments = payments.map((p) => (p.id === id ? reversed : p))
    cheques = cheques.map((c) => (c.paymentId === id ? { ...c, status: 'cancelled', statusDate: today() } : c))
    return reversed
}

const findCheque = (id: string) => {
    const cheque = cheques.find((c) => c.id === id)
    if (!cheque) throw new ApiError(404, { code: 'notFound' })
    return cheque
}

const setCheque = (next: Cheque) => {
    cheques = cheques.map((c) => (c.id === next.id ? next : c))
    return next
}

/** The money left the bank: the cheque stops showing as uncleared. */
export const clearCheque = async (id: string, date: string): Promise<Cheque> => {
    await delay()
    const cheque = findCheque(id)
    if (cheque.status !== 'issued') throw new ApiError(409, { code: 'ALREADY_DECIDED' })
    markSupplierChequeCleared(cheque.paymentId)
    return setCheque({ ...cheque, status: 'cleared', statusDate: date })
}

/** The amount is owed again: a charge goes back on the khata, the original payment row stays. */
const owedAgain = (cheque: Cheque, date: string, what: string) =>
    postSupplierEntry({
        supplierId: cheque.supplierId,
        date,
        kind: 'charge',
        amount: cheque.amount,
        detail: `Cheque no. ${cheque.no} ${what}`,
        sourceId: cheque.paymentId,
    })

export const bounceCheque = async (
    id: string,
    values: { date: string; reason: string; charge: number }
): Promise<Cheque> => {
    await delay()
    const cheque = findCheque(id)
    if (cheque.status !== 'issued') throw new ApiError(409, { code: 'ALREADY_DECIDED' })
    markSupplierChequeCleared(cheque.paymentId)
    owedAgain(cheque, values.date, 'bounced')
    return setCheque({ ...cheque, status: 'bounced', statusDate: values.date, reason: values.reason, charge: values.charge })
}

/** The supplier returned it unused. */
export const cancelCheque = async (id: string): Promise<Cheque> => {
    await delay()
    const cheque = findCheque(id)
    if (cheque.status !== 'issued') throw new ApiError(409, { code: 'ALREADY_DECIDED' })
    markSupplierChequeCleared(cheque.paymentId)
    owedAgain(cheque, today(), 'cancelled')
    return setCheque({ ...cheque, status: 'cancelled', statusDate: today() })
}
