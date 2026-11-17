import { ApiError, request } from '@/lib/client-api'

export const customerTypes = ['builder', 'dealer', 'cutting'] as const
export type CustomerType = (typeof customerTypes)[number]

/** A customer: one khata that holds cutting charges, sales bills, cheques and advances. */
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

const base = '/api/customers'

/** A customer with the figures the list shows, all calculated from the khata rows. */
export type CustomerSummary = Customer & {
    isActive?: boolean
    /** Bills and cutting charges (bounced cheques put back are taken off). */
    totalBusiness: number
    received: number
    /** Positive: the customer owes. Negative: an advance. */
    balance: number
    /** Age in days of the oldest charge not yet covered by payments; `null` when nothing is unpaid. */
    oldestUnpaidDays: number | null
    /** Cheques received but not yet cleared. */
    unclearedCheques: number
    lastActivity: string
}

export type CustomerFilters = { type?: CustomerType; balance?: 'due' | 'old30' | 'advance' }

/** What the backend gave last, for the screens that need a customer's figures at once. */
let known: CustomerSummary[] = []

/** Owed (positive) or paid ahead (negative): opening + charges − payments (from the last list loaded). */
export const customerBalance = (customerId: string): number => known.find((c) => c.id === customerId)?.balance ?? 0

export const customerTotals = (customerId: string) => {
    const customer = known.find((c) => c.id === customerId)
    return { charged: customer?.totalBusiness ?? 0, received: customer?.received ?? 0, balance: customer?.balance ?? 0 }
}

/** A customer from the last list loaded. */
export const customerById = (id: string): Customer | undefined => known.find((c) => c.id === id)

const loadKnown = async (): Promise<CustomerSummary[]> => {
    known = await request<CustomerSummary[]>(base)
    return known
}

export const listCustomers = async (): Promise<Customer[]> => {
    await loadKnown()
    return [...known].sort((a, b) => a.name.localeCompare(b.name))
}

/** Highest balance first. */
export const listCustomerSummaries = async (filters: CustomerFilters = {}): Promise<CustomerSummary[]> => {
    await loadKnown()
    return known
        .filter((c) => !filters.type || c.type === filters.type)
        .filter(
            (c) =>
                !filters.balance ||
                (filters.balance === 'due' && c.balance > 0) ||
                (filters.balance === 'advance' && c.balance < 0) ||
                (filters.balance === 'old30' && (c.oldestUnpaidDays ?? 0) >= 30 && c.balance > 0)
        )
        .sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name))
}

/** The khata, oldest first, with the running balance. */
export const customerKhata = async (customerId: string) => {
    const customer = customerById(customerId) ?? (await loadKnown().then(() => customerById(customerId)))
    if (!customer) throw new ApiError(404, { code: 'notFound' })
    const rows = await request<(CustomerEntry & { balance: number })[]>(`${base}/${customerId}/khata`)
    // The opening balance is the start of the running balance, not a row.
    let balance = customer.openingBalance
    return rows
        .filter((r) => r.ref !== 'opening')
        .map((row) => {
            balance += row.kind === 'charge' ? row.amount : -row.amount
            return { ...row, balance }
        })
}

export type CustomerInput = Pick<Customer, 'name' | 'phone' | 'type' | 'city' | 'contactPerson'> & {
    /** Udhaar from before StoneFlow; owner and partner only. */
    openingBalance?: number
    openingDate?: string
}

export const createCustomer = (input: CustomerInput) => request<CustomerSummary>(base, { body: input })

/** Only the owner and partner change an opening balance; the backend refuses anyone else. */
export const updateCustomer = (id: string, input: Partial<CustomerInput>) =>
    request<Customer>(`${base}/${id}`, { method: 'PATCH', body: input })

/** A `wa.me` link with the message already typed. The server sends nothing; the person taps send. */
export const whatsappLink = (phone: string, message: string) => {
    const number = phone.replace(/\D/g, '').replace(/^0/, '92')
    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}
