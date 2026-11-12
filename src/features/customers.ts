import { ApiError } from '@/lib/client-api'
import { unclearedChequeTotal } from './customer-cheque-store'

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

export const customerTypes = ['builder', 'dealer', 'cutting'] as const
export type CustomerType = (typeof customerTypes)[number]

/**
 * The minimal customer 05c needs. The Customers module (07a) grows this: one khata per customer that
 * also holds sales bills, cheques and advances.
 */
export type Customer = {
    id: string
    name: string
    /** WhatsApp number; unique per company. */
    phone: string
    type: CustomerType
    city: string
    contactPerson: string
    /** Udhaar from before StoneFlow. */
    openingBalance: number
    openingDate: string
}

export type CustomerEntry = {
    id: string
    customerId: string
    date: string
    /** `charge`: the customer owes more. `credit`: a payment, which reduces it. */
    kind: 'charge' | 'credit'
    amount: number
    detail: string
    sourceId: string
    /** The bill (or job) this row belongs to, so charges and their reversals add up per bill. */
    ref?: string
    /** A `credit` that takes a charge back (an edited or cancelled bill); it is not money received. */
    reversal?: boolean
    /**
     * A `charge` that puts money back: a bounced cheque or a reversed payment. It is not business done,
     * and it takes the money off what was received.
     */
    returned?: boolean
}

export const customersQueryKey = 'customers'
export const customerKhataQueryKey = 'customer-khata'

// In-memory stand-in for the backend; replace with `request()` calls like `features/admin/members.ts`.
let customers: Customer[] = [
    { id: 'c1', name: 'Haji Saleem', phone: '0300-5512398', type: 'cutting', city: 'Karachi', contactPerson: '', openingBalance: 0, openingDate: '2026-09-01' },
    { id: 'c2', name: 'Malik Traders', phone: '0321-8834512', type: 'cutting', city: 'Lahore', contactPerson: '', openingBalance: 0, openingDate: '2026-09-01' },
    { id: 'c3', name: 'Rehman Marble', phone: '0333-4410982', type: 'cutting', city: 'Karachi', contactPerson: '', openingBalance: 0, openingDate: '2026-09-01' },
    { id: 'c4', name: 'ABC Builders', phone: '0300-2145678', type: 'builder', city: 'Karachi', contactPerson: 'Faisal Qureshi', openingBalance: 0, openingDate: '2026-09-01' },
    { id: 'c5', name: 'Al-Noor Developers', phone: '0321-8890123', type: 'builder', city: 'Karachi', contactPerson: 'Imran Siddiqui', openingBalance: 0, openingDate: '2026-09-01' },
    { id: 'c6', name: 'Madina Tiles & Marble', phone: '0345-7712093', type: 'dealer', city: 'Hyderabad', contactPerson: 'Haji Yousuf', openingBalance: 0, openingDate: '2026-09-01' },
    { id: 'c7', name: 'Royal Interiors', phone: '0333-4567812', type: 'dealer', city: 'Karachi', contactPerson: 'Sana Malik', openingBalance: 120000, openingDate: '2026-08-15' },
]

const entries: CustomerEntry[] = [
    { id: 'ce1', customerId: 'c3', date: '2026-09-21', kind: 'charge', amount: 18900, detail: 'Cutting KHT-407 · 540 sq.ft × 35', sourceId: 'seed-cj3' },
    { id: 'ce2', customerId: 'c3', date: '2026-09-22', kind: 'credit', amount: 18900, detail: 'Payment received · cash', sourceId: 'seed-pay1' },
    { id: 'ce3', customerId: 'c1', date: '2026-10-08', kind: 'charge', amount: 25200, detail: 'Cutting KHT-552 · 720 sq.ft × 35', sourceId: 'seed-cj1' },
    { id: 'ce4', customerId: 'c1', date: '2026-10-08', kind: 'credit', amount: 10000, detail: 'Payment received · cash', sourceId: 'seed-pay2' },
    { id: 'ce5', customerId: 'c4', date: '2026-09-28', kind: 'charge', amount: 15200, detail: 'Bill B-0001 · 40 × 14 soot 12×24', sourceId: 'seed-b1' },
    { id: 'ce6', customerId: 'c4', date: '2026-09-28', kind: 'credit', amount: 10000, detail: 'Payment received · cash', sourceId: 'seed-pay3' },
    { id: 'ce7', customerId: 'c5', date: '2026-09-10', kind: 'charge', amount: 180000, detail: 'Bill B-0007 · 2,400 sq.ft', sourceId: 'seed-b7' },
    { id: 'ce8', customerId: 'c5', date: '2026-09-20', kind: 'credit', amount: 40000, detail: 'Payment received · bank', sourceId: 'seed-pay4' },
    { id: 'ce9', customerId: 'c6', date: '2026-10-03', kind: 'charge', amount: 56400, detail: 'Bill B-0002 · 4 slabs', sourceId: 'seed-b2' },
    { id: 'ce10', customerId: 'c6', date: '2026-10-05', kind: 'credit', amount: 80000, detail: 'Advance received · bank', sourceId: 'seed-pay5' },
    { id: 'ce11', customerId: 'c7', date: '2026-09-25', kind: 'credit', amount: 50000, detail: 'Cheque no. 0044871 · Meezan Bank', sourceId: 'seed-pay6' },
    { id: 'ce12', customerId: 'c4', date: '2026-11-01', kind: 'credit', amount: 5200, detail: 'Cheque no. 0091822 · UBL · dated 2026-11-10', sourceId: 'seed-pay7' },
    { id: 'ce13', customerId: 'c5', date: '2026-11-05', kind: 'credit', amount: 60000, detail: 'Cheque no. 0310457 · Bank Alfalah · dated 2026-12-10', sourceId: 'seed-pay8' },
]

/** Owed (positive) or paid ahead (negative): opening + charges − payments. */
export const customerBalance = (customerId: string): number => {
    const customer = customers.find((c) => c.id === customerId)
    const own = entries.filter((e) => e.customerId === customerId)
    return (
        (customer?.openingBalance ?? 0) +
        own.filter((e) => e.kind === 'charge').reduce((s, e) => s + e.amount, 0) -
        own.filter((e) => e.kind === 'credit').reduce((s, e) => s + e.amount, 0)
    )
}

export const customerTotals = (customerId: string) => {
    const own = entries.filter((e) => e.customerId === customerId)
    const sum = (rows: CustomerEntry[]) => rows.reduce((s, e) => s + e.amount, 0)
    return {
        // A reversed (edited or cancelled) bill comes off what was charged; it was never money received.
        charged: sum(own.filter((e) => e.kind === 'charge' && !e.returned)) - sum(own.filter((e) => e.kind === 'credit' && e.reversal)),
        received: sum(own.filter((e) => e.kind === 'credit' && !e.reversal)) - sum(own.filter((e) => e.kind === 'charge' && e.returned)),
        balance: customerBalance(customerId),
    }
}

export type ChargeAllocation = { ref: string; date: string; amount: number; paid: number }

/**
 * Payments are applied FIFO to the oldest charges (an advance covers later bills by itself). A bill's
 * charge is its charges minus its reversals. Used for Paid / Partly paid / Udhaar and for how old the
 * oldest unpaid charge is. Computed on read, never stored.
 */
export const customerAllocation = (customerId: string): Map<string, ChargeAllocation> => {
    const customer = customers.find((c) => c.id === customerId)
    const result = new Map<string, ChargeAllocation>()
    if (!customer) return result
    const own = entries.filter((e) => e.customerId === customerId)
    const items = new Map<string, { ref: string; date: string; amount: number }>()
    const add = (ref: string, date: string, amount: number) => {
        const cur = items.get(ref)
        items.set(ref, { ref, date: cur?.date ?? date, amount: (cur?.amount ?? 0) + amount })
    }
    if (customer.openingBalance > 0) add('opening', customer.openingDate, customer.openingBalance)
    for (const e of own) {
        if (e.kind === 'charge') add(e.ref ?? e.id, e.date, e.amount)
        else if (e.reversal) add(e.ref ?? e.id, e.date, -e.amount)
    }
    let pool = own.filter((e) => e.kind === 'credit' && !e.reversal).reduce((s, e) => s + e.amount, 0) + Math.max(-customer.openingBalance, 0)
    for (const item of [...items.values()].filter((i) => i.amount > 0).sort((a, b) => a.date.localeCompare(b.date) || a.ref.localeCompare(b.ref))) {
        const paid = Math.min(pool, item.amount)
        pool -= paid
        result.set(item.ref, { ...item, paid })
    }
    return result
}

/**
 * Posts a row to a customer's khata for the step that caused it (a finished cutting job, a payment).
 * The same source posts once: repeating it changes nothing.
 */
export const postCustomerEntry = (entry: Omit<CustomerEntry, 'id'>): CustomerEntry => {
    const existing = entries.find((e) => e.customerId === entry.customerId && e.sourceId === entry.sourceId && e.kind === entry.kind)
    if (existing) return existing
    const created = { ...entry, id: crypto.randomUUID() }
    entries.push(created)
    return created
}

export const customerById = (id: string) => customers.find((c) => c.id === id)

export const listCustomers = async (): Promise<Customer[]> => {
    await delay()
    return [...customers].sort((a, b) => a.name.localeCompare(b.name))
}

export const customerKhata = async (customerId: string) => {
    await delay(250)
    const customer = customerById(customerId)
    if (!customer) throw new ApiError(404, { code: 'notFound' })
    const rows = entries.filter((e) => e.customerId === customerId).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    let balance = customer.openingBalance
    return rows.map((row) => {
        balance += row.kind === 'charge' ? row.amount : -row.amount
        return { ...row, balance }
    })
}

export type CustomerInput = Pick<Customer, 'name' | 'phone' | 'type' | 'city' | 'contactPerson'> & {
    /** Udhaar from before StoneFlow; owner and partner only. */
    openingBalance?: number
    openingDate?: string
}

const digits = (phone: string) => phone.replace(/\D/g, '')

export const createCustomer = async (input: CustomerInput): Promise<Customer> => {
    await delay()
    if (customers.some((c) => digits(c.phone) === digits(input.phone))) throw new ApiError(409, { code: 'DUPLICATE_PHONE' })
    const customer: Customer = {
        ...input,
        id: crypto.randomUUID(),
        openingBalance: input.openingBalance ?? 0,
        openingDate: input.openingDate ?? new Date().toISOString().slice(0, 10),
    }
    customers = [...customers, customer]
    return customer
}

// ---------- 07a: the Customers page ----------

/** A customer with the figures the list shows, all calculated from the khata rows. */
export type CustomerSummary = Customer & {
    /** Bills and cutting charges (bounced cheques put back come with 07d). */
    totalBusiness: number
    received: number
    /** Positive: the customer owes. Negative: an advance. */
    balance: number
    /** Age in days of the oldest charge not yet covered by payments; `null` when nothing is unpaid. */
    oldestUnpaidDays: number | null
    /** Cheques received but not yet cleared (07d). */
    unclearedCheques: number
    lastActivity: string
}

export type CustomerFilters = { type?: CustomerType; balance?: 'due' | 'old30' | 'advance' }

const daysAgo = (date: string) => Math.max(0, Math.round((new Date(new Date().toISOString().slice(0, 10)).getTime() - new Date(date).getTime()) / 86_400_000))

/**
 * Payments are applied FIFO to the oldest charges, so an advance covers later bills by itself.
 * Returns the date of the oldest charge that is still not fully paid, or `null` when all are.
 */
const oldestUnpaidDate = (customer: Customer): string | null =>
    [...customerAllocation(customer.id).values()]
        .filter((a) => a.paid < a.amount)
        .sort((a, b) => a.date.localeCompare(b.date))[0]?.date ?? null

const summarise = (customer: Customer): CustomerSummary => {
    const own = entries.filter((e) => e.customerId === customer.id)
    const oldest = oldestUnpaidDate(customer)
    const totals = customerTotals(customer.id)
    return {
        ...customer,
        totalBusiness: totals.charged,
        received: totals.received,
        balance: totals.balance,
        oldestUnpaidDays: oldest ? daysAgo(oldest) : null,
        unclearedCheques: unclearedChequeTotal(customer.id),
        lastActivity: [customer.openingDate, ...own.map((e) => e.date)].sort().pop() ?? customer.openingDate,
    }
}

/** Highest balance first. */
export const listCustomerSummaries = async (filters: CustomerFilters = {}): Promise<CustomerSummary[]> => {
    await delay()
    return customers
        .map(summarise)
        .filter(
            (c) =>
                (!filters.type || c.type === filters.type) &&
                (!filters.balance ||
                    (filters.balance === 'due' && c.balance > 0) ||
                    (filters.balance === 'advance' && c.balance < 0) ||
                    (filters.balance === 'old30' && (c.oldestUnpaidDays ?? 0) >= 30 && c.balance > 0))
        )
        .sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name))
}

/** Only the owner and partner change an opening balance; the caller decides who gets to send it. */
export const updateCustomer = async (
    id: string,
    input: Partial<CustomerInput> & { openingBalance?: number; openingDate?: string }
): Promise<Customer> => {
    await delay()
    const current = customerById(id)
    if (!current) throw new ApiError(404, { code: 'notFound' })
    if (input.phone && customers.some((c) => c.id !== id && digits(c.phone) === digits(input.phone as string))) {
        throw new ApiError(409, { code: 'DUPLICATE_PHONE' })
    }
    const next = { ...current, ...input }
    customers = customers.map((c) => (c.id === id ? next : c))
    return next
}

/** A `wa.me` link with the message already typed. The server sends nothing; the person taps send. */
export const whatsappLink = (phone: string, message: string) => {
    const number = phone.replace(/\D/g, '').replace(/^0/, '92')
    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}
