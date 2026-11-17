import { request } from '@/lib/client-api'
import { customerBalance, type CustomerType } from './customers'
import { sqFtOfSize } from './piece-sizes'
import { itemKeyOf, stockOnHand, type StockItem } from './production-entries'
import { loadRealStock } from './stock/real-stock'

export const billsQueryKey = 'bills'

const billsBase = '/api/bills'
const ordersBase = '/api/sales-orders'

/** One item on a bill. The rate is typed every time, because the price is agreed with each customer. */
export type BillLine = {
    /** Stays the same when the bill is edited, so collections keep pointing at the right line. */
    lineNo: number
    item: StockItem
    /** Pieces, counter pieces or slabs. */
    qty: number
    /** Total inches; counters only. */
    inches: number
    /** Kanta weight in tons; slabs only. */
    tons: number
    /** PKR per sq.ft (pieces), per inch (counters) or per ton (slabs). */
    rate: number
    /** The order line this bill line fills (07c). */
    orderLineId: string | null
}

export type Collection = {
    id: string
    collNo: string
    date: string
    vehicle: string
    receivedBy: string
    lines: { lineNo: number; qty: number; inches: number }[]
    createdBy: string
}

export type BillPayment = {
    id: string
    date: string
    amount: number
    method: 'cash' | 'bank'
    accountName: string
}

export type BillLog = { date: string; text: string; by: string }

export type Bill = {
    id: string
    billNo: string
    date: string
    /** `null` for a walk-in, who has no khata and pays in full. */
    customerId: string | null
    customerName: string
    customerPhone: string
    factoryId: string
    factoryName: string
    lines: BillLine[]
    discount: number
    transport: number
    total: number
    status: 'active' | 'cancelled'
    orderId: string | null
    note: string
    cancelReason: string | null
    collections: Collection[]
    payments: BillPayment[]
    log: BillLog[]
    createdBy: string
    /** What the customer's payments have covered of this bill, oldest bill first (worked out by the backend). */
    paid: number
}

/** Pieces are priced per sq.ft, counters per inch, slabs per ton. */
export const lineUnit = (item: StockItem) => (item.itemType === 'piece' ? 'sqft' : item.itemType === 'counter' ? 'inch' : 'ton')

export const lineSqFt = (line: Pick<BillLine, 'item' | 'qty' | 'inches'>) =>
    line.item.itemType === 'piece'
        ? sqFtOfSize(line.item.size) * line.qty
        : line.item.itemType === 'counter'
          ? (line.item.width * line.inches) / 144
          : 0

export const lineAmount = (line: Pick<BillLine, 'item' | 'qty' | 'inches' | 'tons' | 'rate'>): number => {
    if (line.item.itemType === 'piece') return Math.round(sqFtOfSize(line.item.size) * line.qty * line.rate)
    if (line.item.itemType === 'counter') return Math.round(line.inches * line.rate)
    return Math.round(line.tons * line.rate)
}

export const subtotalOf = (lines: BillLine[]) => lines.reduce((s, l) => s + lineAmount(l), 0)

/** Total = Σ lines − discount + transport. */
export const totalOf = (lines: BillLine[], discount: number, transport: number) => subtotalOf(lines) - discount + transport

/** The last lists the backend gave, for the figures the screens work out at once (reserved stone, order progress). */
let bills: Bill[] = []
let orders: SalesOrder[] = []

export const allBills = () => bills

// ---------- what has left, what is booked ----------

export const collectedOf = (bill: Bill, lineNo: number) => {
    let qty = 0
    let inches = 0
    for (const c of bill.collections) {
        for (const l of c.lines) {
            if (l.lineNo === lineNo) {
                qty += l.qty
                inches += l.inches
            }
        }
    }
    return { qty, inches }
}

export const remainingOf = (bill: Bill, line: BillLine) => {
    const got = collectedOf(bill, line.lineNo)
    return { qty: Math.max(0, line.qty - got.qty), inches: line.item.itemType === 'counter' ? Math.max(0, line.inches - got.inches) : 0 }
}

/** A bill with stone still to collect (cancelled bills have none). */
export const toCollect = (bill: Bill) => bill.status === 'active' && bill.lines.some((l) => { const r = remainingOf(bill, l); return r.qty > 0 || r.inches > 0 })

/**
 * What is booked on bills not yet collected, for one kind of stock. Only a bill reserves stone (an
 * order does not). The bill being edited can be left out so it does not count against itself.
 */
export const reservedFor = (item: StockItem, exceptBillId?: string) => {
    const key = itemKeyOf(item)
    let qty = 0
    let inches = 0
    for (const bill of bills) {
        if (bill.status !== 'active' || bill.id === exceptBillId) continue
        for (const line of bill.lines) {
            if (itemKeyOf({ ...line.item, factoryId: item.factoryId }) !== key) continue
            const r = remainingOf(bill, line)
            qty += r.qty
            inches += r.inches
        }
    }
    return { qty, inches }
}

/** Available = on hand − booked on other uncollected bills. */
export const availableFor = (item: StockItem, exceptBillId?: string) => {
    const have = stockOnHand(item)
    const reserved = reservedFor(item, exceptBillId)
    return { onHand: have.qty, onHandInches: have.inches, reserved: reserved.qty, qty: have.qty - reserved.qty, inches: have.inches - reserved.inches }
}

// ---------- money ----------

/** Paid / Partly paid / Udhaar, from what the customer's payments have covered (an advance covers later bills). */
export type PaymentState = 'paid' | 'partly' | 'udhaar' | 'cancelled'

export const paymentInfo = (bill: Bill): { state: PaymentState; paid: number; due: number } => {
    if (bill.status === 'cancelled') return { state: 'cancelled', paid: 0, due: 0 }
    const paid = bill.paid
    const due = Math.max(0, bill.total - paid)
    return { state: due <= 0 ? 'paid' : paid <= 0 ? 'udhaar' : 'partly', paid, due }
}

export type BillFilters = { payment?: PaymentState; collect?: 'to' | 'done' }

/** Newest first. Every bill is fetched (and remembered); the filters narrow the list. Stock is refreshed too. */
export const listBills = async (filters: BillFilters = {}): Promise<Bill[]> => {
    const [all] = await Promise.all([request<Bill[]>(billsBase), loadRealStock()])
    bills = all
    return all.filter(
        (b) =>
            (!filters.payment || paymentInfo(b).state === filters.payment) &&
            (!filters.collect || (filters.collect === 'to' ? toCollect(b) : b.status === 'active' && !toCollect(b)))
    )
}

// ---------- making and changing a bill ----------

/** `accountId` is the bank account; cash goes into the cash in hand. */
export type PaymentInput = { method: 'none' | 'cash' | 'bank'; amount: number; accountId?: string }

export type BillInput = {
    /** An existing customer id, `walkin`, or `new` (created with the name and phone below). */
    customerId: string
    name: string
    phone: string
    customerType: CustomerType
    date: string
    factoryId: string
    lines: BillLine[]
    discount: number
    transport: number
    note: string
    orderId: string | null
    payment: PaymentInput
    /** The customer takes all the stone now: one collection with every line. */
    takeAll: boolean
}

const lineBody = (l: BillLine, factoryId: string) => ({
    lineNo: l.lineNo,
    item: { ...l.item, factoryId },
    qty: l.qty,
    inches: l.item.itemType === 'counter' ? l.inches : undefined,
    tons: l.item.itemType === 'slab' ? l.tons : undefined,
    rate: l.rate,
    orderLineId: l.orderLineId ?? undefined,
})

const paymentBody = (p: PaymentInput) => (p.method === 'none' || !(p.amount > 0) ? undefined : { method: p.method, amount: p.amount, accountId: p.accountId || undefined })

export const createBill = async (input: BillInput): Promise<Bill> => {
    const walkin = input.customerId === 'walkin'
    const isNew = input.customerId === 'new'
    return request<Bill>(billsBase, {
        body: {
            customerId: walkin || isNew ? undefined : input.customerId,
            walkin: walkin || undefined,
            name: walkin || isNew ? input.name : undefined,
            phone: walkin || isNew ? input.phone : undefined,
            customerType: isNew ? input.customerType : undefined,
            date: input.date,
            factoryId: input.factoryId,
            lines: input.lines.map((l) => lineBody(l, input.factoryId)),
            discount: input.discount,
            transport: input.transport,
            note: input.note,
            orderId: input.orderId ?? undefined,
            payment: paymentBody(input.payment),
            takeAll: input.takeAll,
        },
    })
}

/** Changes lines, rates, discount and transport. The old charge is reversed and the new one posted. */
export const updateBill = async (id: string, input: Pick<BillInput, 'lines' | 'discount' | 'transport' | 'note' | 'date'>, factoryId: string): Promise<Bill> =>
    request<Bill>(`${billsBase}/${id}`, {
        method: 'PATCH',
        body: {
            date: input.date,
            lines: input.lines.map((l) => lineBody(l, factoryId)),
            discount: input.discount,
            transport: input.transport,
            note: input.note,
        },
    })

/** Only if nothing was collected. Payments stay as the customer's advance. */
export const cancelBill = (id: string, reason: string): Promise<Bill> => request<Bill>(`${billsBase}/${id}/cancel`, { body: { reason } })

export type GiveInput = { date: string; vehicle: string; receivedBy: string; lines: { lineNo: number; qty: number; inches: number }[] }

/** Gives stone now: the date, the vehicle, and how much of each line leaves the yard. */
export const giveStone = async (billId: string, input: GiveInput): Promise<{ bill: Bill; collection: Collection }> => {
    const bill = await request<Bill>(`${billsBase}/${billId}/collections`, {
        body: {
            date: input.date,
            vehicle: input.vehicle,
            receivedBy: input.receivedBy,
            lines: input.lines.filter((l) => l.qty > 0 || l.inches > 0).map((l) => ({ lineNo: l.lineNo, qty: l.qty, inches: l.inches > 0 ? l.inches : undefined })),
        },
    })
    await loadRealStock()
    // The collection just made is the last one.
    return { bill, collection: bill.collections[bill.collections.length - 1] }
}

/** The customer's balance after this bill: owed, or an advance (negative). */
export const khataBalanceOf = (bill: Bill) => (bill.customerId ? customerBalance(bill.customerId) : 0)

// ---------- 07c: orders (stone that is not ready yet) ----------

export const ordersQueryKey = 'orders'

export type OrderLine = BillLine & {
    /** What a bill line points back to (`BillLine.orderLineId`). */
    id: string
}

export type OrderAdvance = { id: string; date: string; amount: number; method: 'cash' | 'bank'; accountName: string }

/**
 * A customer's order for stone that is not in stock yet. No stone is reserved by an order (only a bill
 * reserves); it records the need and the advance, shows Production what is short, and turns into bills
 * as stone becomes ready. Walk-ins cannot order.
 */
export type SalesOrder = {
    id: string
    orderNo: string
    date: string
    customerId: string
    customerName: string
    factoryId: string
    factoryName: string
    neededBy: string
    cancelled: boolean
    note: string
    lines: OrderLine[]
    /** Every payment received for the order, the first advance and any later ones. */
    advances: OrderAdvance[]
    createdBy: string
}

export type OrderStatus = 'open' | 'completed' | 'cancelled'

export const allOrders = () => orders

/** What active bills have billed against one order line. */
export const billedOf = (orderLineId: string, exceptBillId?: string) => {
    let qty = 0
    let inches = 0
    let tons = 0
    for (const bill of bills) {
        if (bill.status !== 'active' || bill.id === exceptBillId) continue
        for (const l of bill.lines) {
            if (l.orderLineId !== orderLineId) continue
            qty += l.qty
            inches += l.inches
            tons += l.tons
        }
    }
    return { qty, inches, tons }
}

export const orderRemaining = (line: OrderLine, exceptBillId?: string) => {
    const done = billedOf(line.id, exceptBillId)
    return {
        qty: Math.max(0, line.qty - done.qty),
        inches: line.item.itemType === 'counter' ? Math.max(0, line.inches - done.inches) : 0,
        tons: line.item.itemType === 'slab' ? Math.max(0, line.tons - done.tons) : 0,
    }
}

/**
 * Per line: remaining = ordered − billed; ready = min(remaining, available stock); short = remaining −
 * ready. Counters are counted in inches, everything else in pieces or slabs.
 */
export const orderReady = (order: SalesOrder, line: OrderLine) => {
    const rem = orderRemaining(line)
    const avail = availableFor({ ...line.item, factoryId: order.factoryId })
    const counter = line.item.itemType === 'counter'
    const need = counter ? rem.inches : rem.qty
    const have = Math.max(0, counter ? avail.inches : avail.qty)
    const ready = Math.min(need, have)
    return { need, ready, short: need - ready, counter }
}

export const orderStatus = (order: SalesOrder): OrderStatus =>
    order.cancelled
        ? 'cancelled'
        : order.lines.some((l) => {
                const r = orderRemaining(l)
                return r.qty > 0 || r.inches > 0
            })
          ? 'open'
          : 'completed'

export const orderTotal = (order: SalesOrder) => order.lines.reduce((s, l) => s + lineAmount(l), 0)
/** The advance paid with the order, plus any received later through Receive Payment. */
export const advanceOf = (order: SalesOrder) => order.advances.reduce((s, a) => s + a.amount, 0)
export const billsOfOrder = (order: SalesOrder) => bills.filter((b) => b.status === 'active' && b.orderId === order.id)

/** How much of the order has been billed, as a percentage of what was ordered. */
export const orderBilledPercent = (order: SalesOrder) => {
    const asked = order.lines.reduce((s, l) => s + (l.item.itemType === 'counter' ? l.inches : l.qty), 0)
    const done = order.lines.reduce((s, l) => {
        const b = billedOf(l.id)
        return s + (l.item.itemType === 'counter' ? b.inches : b.qty)
    }, 0)
    return asked > 0 ? Math.min(100, Math.round((done / asked) * 100)) : 0
}

export type OrderFilters = { status?: OrderStatus }

/** Sorted by the date it is needed. Bills are loaded too, because progress is worked out from them. */
export const listOrders = async (filters: OrderFilters = {}): Promise<SalesOrder[]> => {
    const [all] = await Promise.all([request<SalesOrder[]>(ordersBase), listBills()])
    orders = all
    return all.filter((o) => !filters.status || orderStatus(o) === filters.status)
}

export type OrderInput = {
    customerId: string
    date: string
    neededBy: string
    factoryId: string
    lines: BillLine[]
    note: string
    advance: PaymentInput
}

export const createOrder = async (input: OrderInput): Promise<SalesOrder> =>
    request<SalesOrder>(ordersBase, {
        body: {
            customerId: input.customerId,
            date: input.date,
            neededBy: input.neededBy,
            factoryId: input.factoryId,
            lines: input.lines.map((l) => lineBody(l, input.factoryId)),
            note: input.note,
            advance: paymentBody(input.advance),
        },
    })

/** Lines already billed stay on their bills and the advance stays in the khata. */
export const cancelOrder = (id: string): Promise<SalesOrder> => request<SalesOrder>(`${ordersBase}/${id}/cancel`, { body: {} })

/** Open orders with stone short, for Production's "Needs attention". */
export type ShortLine = { orderNo: string; customerName: string; item: StockItem; short: number; counter: boolean }

export const shortOrderLines = (): ShortLine[] =>
    orders
        .filter((o) => orderStatus(o) === 'open')
        .flatMap((o) =>
            o.lines.flatMap((l) => {
                const r = orderReady(o, l)
                return r.short > 0 ? [{ orderNo: o.orderNo, customerName: o.customerName, item: l.item, short: r.short, counter: r.counter }] : []
            })
        )
