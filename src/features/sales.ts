import { ApiError } from '@/lib/client-api'
import { advancePaymentsFor, noteReceipt } from './customer-payments'
import { createCustomer, customerAllocation, customerBalance, customerById, postCustomerEntry, type CustomerType } from './customers'
import { sqFtOfSize } from './piece-sizes'
import { itemKeyOf, postMovement, stockOnHand, type EntryLine, type StockItem } from './production-entries'

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

export const billsQueryKey = 'bills'

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

const today = () => new Date().toISOString().slice(0, 10)

// ---------- seed ----------
const zw = (soot: string, size: string, finish: 'polished' | 'unpolished' = 'unpolished'): StockItem => ({
    itemType: 'piece',
    material: 'Ziarat White',
    factoryId: 'main',
    soot,
    size,
    finish,
})

const seedLine = (lineNo: number, item: StockItem, qty: number, rate: number): BillLine => ({ lineNo, item, qty, inches: 0, tons: 0, rate, orderLineId: null })

// In-memory stand-in for the backend; replace with `request()` calls like `features/admin/members.ts`.
// B-0001's charge is already in ABC Builders' khata and its stone (G-001) already left the yard (seeded
// elsewhere); B-0002 is booked for Madina Tiles and waits to be collected.
let bills: Bill[] = [
    {
        id: 'b1',
        billNo: 'B-0001',
        date: '2026-09-28',
        customerId: 'c4',
        customerName: 'ABC Builders',
        customerPhone: '0300-2145678',
        factoryId: 'main',
        factoryName: 'Saadat Marble — Main Factory',
        lines: [seedLine(1, zw('14', '12x24'), 40, 190)],
        discount: 0,
        transport: 0,
        total: 15200,
        status: 'active',
        orderId: null,
        note: '',
        cancelReason: null,
        collections: [{ id: 'g1', collNo: 'G-001', date: '2026-09-28', vehicle: 'Suzuki KHI-2231', receivedBy: '', lines: [{ lineNo: 1, qty: 40, inches: 0 }], createdBy: 'Rashid Khan' }],
        payments: [{ id: 'bp1', date: '2026-09-28', amount: 10000, method: 'cash', accountName: '' }],
        log: [
            { date: '2026-09-28', text: 'Bill made', by: 'Rashid Khan' },
            { date: '2026-09-28', text: 'All stone collected · Suzuki KHI-2231', by: 'Rashid Khan' },
        ],
        createdBy: 'Rashid Khan',
    },
    {
        id: 'b2',
        billNo: 'B-0002',
        date: '2026-10-03',
        customerId: 'c6',
        customerName: 'Madina Tiles & Marble',
        customerPhone: '0345-7712093',
        factoryId: 'main',
        factoryName: 'Saadat Marble — Main Factory',
        lines: [seedLine(1, zw('14', '12x24'), 60, 470)],
        discount: 0,
        transport: 0,
        total: 56400,
        status: 'active',
        orderId: null,
        note: 'Delivery on Thursday',
        cancelReason: null,
        collections: [],
        payments: [],
        log: [{ date: '2026-10-03', text: 'Bill made', by: 'Rashid Khan' }],
        createdBy: 'Rashid Khan',
    },
]

let billSeq = 2
let collSeq = 1
let paySeq = 1
let version = 0

export const allBills = () => bills

const find = (id: string) => {
    const bill = bills.find((b) => b.id === id)
    if (!bill) throw new ApiError(404, { code: 'notFound' })
    return bill
}

const replace = (next: Bill) => {
    bills = bills.map((b) => (b.id === next.id ? next : b))
    return next
}

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
            if (itemKeyOf(line.item) !== key) continue
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

/** Paid / Partly paid / Udhaar, from the customer's FIFO allocation (an advance covers later bills). */
export type PaymentState = 'paid' | 'partly' | 'udhaar' | 'cancelled'

export const paymentInfo = (bill: Bill): { state: PaymentState; paid: number; due: number } => {
    if (bill.status === 'cancelled') return { state: 'cancelled', paid: 0, due: 0 }
    if (bill.customerId) {
        const alloc = customerAllocation(bill.customerId).get(bill.id)
        const paid = alloc?.paid ?? 0
        const due = Math.max(0, bill.total - paid)
        return { state: due <= 0 ? 'paid' : paid <= 0 ? 'udhaar' : 'partly', paid, due }
    }
    // A walk-in has no khata: only what was paid on the bill counts.
    const paid = bill.payments.reduce((s, p) => s + p.amount, 0)
    const due = Math.max(0, bill.total - paid)
    return { state: due <= 0 ? 'paid' : paid <= 0 ? 'udhaar' : 'partly', paid, due }
}

export type BillFilters = { payment?: PaymentState; collect?: 'to' | 'done' }

export const listBills = async (filters: BillFilters = {}): Promise<Bill[]> => {
    await delay()
    return bills
        .filter(
            (b) =>
                (!filters.payment || paymentInfo(b).state === filters.payment) &&
                (!filters.collect || (filters.collect === 'to' ? toCollect(b) : b.status === 'active' && !toCollect(b)))
        )
        .sort((a, b) => b.date.localeCompare(a.date) || b.billNo.localeCompare(a.billNo))
}

// ---------- making and changing a bill ----------

export type PaymentInput = { method: 'none' | 'cash' | 'bank'; amount: number; accountName: string }

export type BillInput = {
    /** An existing customer id, `walkin`, or `new` (created with the name and phone below). */
    customerId: string
    name: string
    phone: string
    customerType: CustomerType
    date: string
    factoryId: string
    factoryName: string
    lines: BillLine[]
    discount: number
    transport: number
    note: string
    orderId: string | null
    payment: PaymentInput
    /** The customer takes all the stone now: one collection with every line. */
    takeAll: boolean
}

/** Bills only need to be valid lines with stock for what has not been collected yet. */
const validateLines = (lines: BillLine[], factoryId: string, exceptBillId?: string, bill?: Bill) => {
    if (lines.length === 0) throw new ApiError(400, { code: 'NO_LINES' })
    // A bill line that fills an order line cannot go above what remains on the order.
    for (const line of lines) {
        const target = line.orderLineId ? orders.flatMap((o) => o.lines).find((l) => l.id === line.orderLineId) : undefined
        if (target && line.qty > orderRemaining(target, exceptBillId).qty) {
            throw new ApiError(409, { code: 'MORE_THAN_ORDER_REMAINING', remaining: orderRemaining(target, exceptBillId).qty })
        }
    }
    const need = new Map<string, { item: StockItem; qty: number; inches: number }>()
    for (const line of lines) {
        if (!(line.qty > 0)) throw new ApiError(400, { code: 'QTY_REQUIRED' })
        if (!(line.rate > 0)) throw new ApiError(400, { code: 'RATE_REQUIRED' })
        if (line.item.itemType === 'counter' && !(line.inches > 0)) throw new ApiError(400, { code: 'INCHES_REQUIRED' })
        if (line.item.itemType === 'slab' && !(line.tons > 0)) throw new ApiError(400, { code: 'TONS_REQUIRED' })
        const got = bill ? collectedOf(bill, line.lineNo) : { qty: 0, inches: 0 }
        if (bill && (line.qty < got.qty || (line.item.itemType === 'counter' && line.inches < got.inches))) {
            throw new ApiError(409, { code: 'BELOW_COLLECTED', collected: got.qty })
        }
        // Stone already collected has left the yard; only the rest needs to be available.
        const key = itemKeyOf({ ...line.item, factoryId })
        const cur = need.get(key) ?? { item: { ...line.item, factoryId }, qty: 0, inches: 0 }
        cur.qty += line.qty - got.qty
        cur.inches += line.inches - got.inches
        need.set(key, cur)
    }
    for (const n of need.values()) {
        const avail = availableFor(n.item, exceptBillId)
        if (n.qty > avail.qty) throw new ApiError(409, { code: 'NOT_AVAILABLE', available: Math.max(0, avail.qty) })
        if (n.item.itemType === 'counter' && n.inches > avail.inches) throw new ApiError(409, { code: 'NOT_AVAILABLE_INCHES', available: Math.max(0, avail.inches) })
    }
}

const postCharge = (bill: Bill, amount: number, note: string) => {
    if (!bill.customerId) return
    version += 1
    postCustomerEntry({
        customerId: bill.customerId,
        date: bill.date,
        kind: 'charge',
        amount,
        detail: `Bill ${bill.billNo}${note}`,
        sourceId: `bill-${bill.id}-c${version}`,
        ref: bill.id,
    })
}

const postReversal = (bill: Bill, amount: number, what: string) => {
    if (!bill.customerId) return
    version += 1
    postCustomerEntry({
        customerId: bill.customerId,
        date: today(),
        kind: 'credit',
        amount,
        detail: `Bill ${bill.billNo} ${what}`,
        sourceId: `bill-${bill.id}-r${version}`,
        ref: bill.id,
        reversal: true,
    })
}

const postPayment = (bill: Bill, payment: BillPayment) => {
    noteReceipt({
        id: payment.id,
        date: payment.date,
        customerId: bill.customerId,
        customerName: bill.customerName,
        amount: payment.amount,
        method: payment.method,
        accountName: payment.accountName,
        billId: bill.id,
        billNo: bill.billNo,
        by: bill.createdBy,
    })
    if (!bill.customerId) return
    postCustomerEntry({
        customerId: bill.customerId,
        date: payment.date,
        kind: 'credit',
        amount: payment.amount,
        detail: `Payment received · ${payment.method === 'cash' ? 'cash' : `bank${payment.accountName ? ` · ${payment.accountName}` : ''}`} · ${bill.billNo}`,
        sourceId: payment.id,
    })
}

const toMovement = (bill: Bill, c: Collection): void => {
    const lines: EntryLine[] = c.lines.map((l) => {
        const line = bill.lines.find((x) => x.lineNo === l.lineNo)!
        return { direction: 'in', item: { ...line.item, factoryId: bill.factoryId }, qty: l.qty, inches: l.inches }
    })
    postMovement({ id: c.id, date: c.date, entryNo: c.collNo, lines, source: 'sale' })
}

export const createBill = async (input: BillInput, by: string): Promise<Bill> => {
    await delay()
    if (input.date > today()) throw new ApiError(400, { code: 'DATE_IN_FUTURE' })
    const lines = input.lines.map((l, i) => ({ ...l, lineNo: i + 1, item: { ...l.item, factoryId: input.factoryId } }))
    validateLines(lines, input.factoryId)
    const total = totalOf(lines, input.discount, input.transport)
    if (!(total > 0)) throw new ApiError(400, { code: 'TOTAL_REQUIRED' })

    const walkin = input.customerId === 'walkin'
    const paid = input.payment.method === 'none' ? 0 : input.payment.amount
    if (input.payment.method !== 'none' && !(paid > 0)) throw new ApiError(400, { code: 'PAYMENT_AMOUNT' })
    // A walk-in has no khata to owe into, so the whole bill is paid now.
    if (walkin && paid < total) throw new ApiError(400, { code: 'WALKIN_FULL_PAYMENT' })

    let customerId: string | null = null
    let customerName = input.name
    let customerPhone = input.phone
    if (!walkin) {
        const customer = input.customerId === 'new' ? await createCustomer({ name: input.name, phone: input.phone, type: input.customerType, city: '', contactPerson: '' }) : customerById(input.customerId)
        if (!customer) throw new ApiError(404, { code: 'notFound' })
        customerId = customer.id
        customerName = customer.name
        customerPhone = customer.phone
    }

    billSeq += 1
    const bill: Bill = {
        id: crypto.randomUUID(),
        billNo: `B-${String(billSeq).padStart(4, '0')}`,
        date: input.date,
        customerId,
        customerName,
        customerPhone,
        factoryId: input.factoryId,
        factoryName: input.factoryName,
        lines,
        discount: input.discount,
        transport: input.transport,
        total,
        status: 'active',
        orderId: input.orderId,
        note: input.note,
        cancelReason: null,
        collections: [],
        payments: [],
        log: [{ date: input.date, text: 'Bill made', by }],
        createdBy: by,
    }
    bills = [...bills, bill]
    postCharge(bill, total, '')

    let saved = bill
    if (paid > 0) {
        paySeq += 1
        const payment: BillPayment = { id: `bp${paySeq}`, date: input.date, amount: paid, method: input.payment.method as 'cash' | 'bank', accountName: input.payment.accountName }
        saved = replace({ ...saved, payments: [payment] })
        postPayment(saved, payment)
    }
    if (input.takeAll) {
        saved = (await giveStoneNow(saved.id, { date: input.date, vehicle: '', receivedBy: '', lines: saved.lines.map((l) => ({ lineNo: l.lineNo, qty: l.qty, inches: l.inches })) }, by)).bill
    }
    return saved
}

/** Changes lines, rates, discount and transport. The old charge is reversed and the new one posted. */
export const updateBill = async (id: string, input: Pick<BillInput, 'lines' | 'discount' | 'transport' | 'note' | 'date'>, by: string): Promise<Bill> => {
    await delay()
    const current = find(id)
    if (current.status !== 'active') throw new ApiError(409, { code: 'BILL_CANCELLED' })
    if (input.date > today()) throw new ApiError(400, { code: 'DATE_IN_FUTURE' })
    const lines = input.lines.map((l) => ({ ...l, item: { ...l.item, factoryId: current.factoryId } }))
    // A collected line cannot be removed.
    for (const old of current.lines) {
        if (!lines.some((l) => l.lineNo === old.lineNo) && collectedOf(current, old.lineNo).qty > 0) throw new ApiError(409, { code: 'BELOW_COLLECTED', collected: collectedOf(current, old.lineNo).qty })
    }
    validateLines(lines, current.factoryId, id, current)
    const total = totalOf(lines, input.discount, input.transport)
    if (!(total > 0)) throw new ApiError(400, { code: 'TOTAL_REQUIRED' })

    const next: Bill = {
        ...current,
        date: input.date,
        lines,
        discount: input.discount,
        transport: input.transport,
        note: input.note,
        total,
        log: [...current.log, { date: today(), text: `Edited · new total ${total}`, by }],
    }
    postReversal(current, current.total, 'edited · old charge taken back')
    replace(next)
    postCharge(next, total, ' · edited')
    return next
}

/** Only if nothing was collected. Payments stay as the customer's advance. */
export const cancelBill = async (id: string, reason: string, by: string): Promise<Bill> => {
    await delay()
    const current = find(id)
    if (current.status !== 'active') throw new ApiError(409, { code: 'BILL_CANCELLED' })
    if (current.collections.length > 0) throw new ApiError(409, { code: 'HAS_COLLECTIONS' })
    postReversal(current, current.total, 'cancelled')
    return replace({ ...current, status: 'cancelled', cancelReason: reason, log: [...current.log, { date: today(), text: `Cancelled · ${reason}`, by }] })
}

export type GiveInput = { date: string; vehicle: string; receivedBy: string; lines: { lineNo: number; qty: number; inches: number }[] }

const giveStoneNow = async (billId: string, input: GiveInput, by: string): Promise<{ bill: Bill; collection: Collection }> => {
    const bill = find(billId)
    const lines = input.lines.filter((l) => l.qty > 0 || l.inches > 0)
    if (lines.length === 0) throw new ApiError(400, { code: 'NOTHING_TO_GIVE' })
    for (const l of lines) {
        const line = bill.lines.find((x) => x.lineNo === l.lineNo)
        if (!line) throw new ApiError(404, { code: 'notFound' })
        const rem = remainingOf(bill, line)
        if (l.qty > rem.qty || l.inches > rem.inches) throw new ApiError(409, { code: 'MORE_THAN_REMAINING', remaining: rem.qty })
        const have = stockOnHand({ ...line.item, factoryId: bill.factoryId })
        if (l.qty > have.qty) throw new ApiError(409, { code: 'INSUFFICIENT_STOCK', available: have.qty })
        if (line.item.itemType === 'counter' && l.inches > have.inches) throw new ApiError(409, { code: 'INSUFFICIENT_INCHES', available: have.inches })
    }
    collSeq += 1
    const collection: Collection = { id: crypto.randomUUID(), collNo: `G-${String(collSeq).padStart(3, '0')}`, date: input.date, vehicle: input.vehicle, receivedBy: input.receivedBy, lines, createdBy: by }
    const next: Bill = {
        ...bill,
        collections: [...bill.collections, collection],
    }
    const after = toCollect(next)
    next.log = [...bill.log, { date: input.date, text: `${after ? 'Part collected' : 'All stone collected'}${input.vehicle ? ` · ${input.vehicle}` : ''}`, by }]
    // Stone leaves the yard only now, as one stock movement per collection.
    toMovement(next, collection)
    return { bill: replace(next), collection }
}

/** Gives stone now: the date, the vehicle, and how much of each line leaves the yard. */
export const giveStone = async (billId: string, input: GiveInput, by: string): Promise<{ bill: Bill; collection: Collection }> => {
    await delay()
    const bill = find(billId)
    if (bill.status !== 'active') throw new ApiError(409, { code: 'BILL_CANCELLED' })
    if (input.date > today()) throw new ApiError(400, { code: 'DATE_IN_FUTURE' })
    if (input.date < bill.date) throw new ApiError(400, { code: 'DATE_BEFORE_BILL' })
    return giveStoneNow(billId, input, by)
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
    advances: OrderAdvance[]
    createdBy: string
}

export type OrderStatus = 'open' | 'completed' | 'cancelled'

const orderLine = (orderNo: string, lineNo: number, item: StockItem, qty: number, rate: number): OrderLine => ({
    id: `${orderNo}:${lineNo}`,
    lineNo,
    item,
    qty,
    inches: 0,
    tons: 0,
    rate,
    orderLineId: null,
})

// Seed: OR-001 for polished 4 soot stone nobody has made yet (all short, with an advance); OR-002 is in stock.
let orders: SalesOrder[] = [
    {
        id: 'o1',
        orderNo: 'OR-001',
        date: '2026-10-07',
        customerId: 'c5',
        customerName: 'Al-Noor Developers',
        factoryId: 'main',
        factoryName: 'Saadat Marble — Main Factory',
        neededBy: '2026-10-20',
        cancelled: false,
        note: 'Phase 2 lobby flooring',
        lines: [orderLine('OR-001', 1, zw('4', '12x24', 'polished'), 300, 315)],
        advances: [{ id: 'oa1', date: '2026-10-07', amount: 50000, method: 'cash', accountName: '' }],
        createdBy: 'Wilayat Ali',
    },
    {
        id: 'o2',
        orderNo: 'OR-002',
        date: '2026-10-09',
        customerId: 'c4',
        customerName: 'ABC Builders',
        factoryId: 'main',
        factoryName: 'Saadat Marble — Main Factory',
        neededBy: '2026-10-14',
        cancelled: false,
        note: '',
        lines: [orderLine('OR-002', 1, zw('14', '12x12'), 100, 210)],
        advances: [],
        createdBy: 'Rashid Khan',
    },
]

let orderSeq = 2

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
export const advanceOf = (order: SalesOrder) =>
    order.advances.reduce((s, a) => s + a.amount, 0) + advancePaymentsFor(order.id, order.advances.map((a) => a.id))
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

/** Sorted by the date it is needed. */
export const listOrders = async (filters: OrderFilters = {}): Promise<SalesOrder[]> => {
    await delay()
    return orders
        .filter((o) => !filters.status || orderStatus(o) === filters.status)
        .sort((a, b) => a.neededBy.localeCompare(b.neededBy) || a.orderNo.localeCompare(b.orderNo))
}

export type OrderInput = {
    customerId: string
    date: string
    neededBy: string
    factoryId: string
    factoryName: string
    lines: BillLine[]
    note: string
    advance: PaymentInput
}

export const createOrder = async (input: OrderInput, by: string): Promise<SalesOrder> => {
    await delay()
    if (input.customerId === 'walkin') throw new ApiError(400, { code: 'WALKIN_NO_ORDER' })
    const customer = customerById(input.customerId)
    if (!customer) throw new ApiError(404, { code: 'notFound' })
    if (input.date > today()) throw new ApiError(400, { code: 'DATE_IN_FUTURE' })
    if (input.neededBy < input.date) throw new ApiError(400, { code: 'NEEDED_BEFORE_ORDER' })
    if (input.lines.length === 0) throw new ApiError(400, { code: 'NO_LINES' })
    for (const l of input.lines) {
        if (!(l.qty > 0)) throw new ApiError(400, { code: 'QTY_REQUIRED' })
        if (!(l.rate > 0)) throw new ApiError(400, { code: 'RATE_REQUIRED' })
        if (l.item.itemType === 'counter' && !(l.inches > 0)) throw new ApiError(400, { code: 'INCHES_REQUIRED' })
        if (l.item.itemType === 'slab' && !(l.tons > 0)) throw new ApiError(400, { code: 'TONS_REQUIRED' })
    }
    const advance = input.advance.method === 'none' ? 0 : input.advance.amount
    if (input.advance.method !== 'none' && !(advance > 0)) throw new ApiError(400, { code: 'PAYMENT_AMOUNT' })

    orderSeq += 1
    const orderNo = `OR-${String(orderSeq).padStart(3, '0')}`
    const order: SalesOrder = {
        id: crypto.randomUUID(),
        orderNo,
        date: input.date,
        customerId: customer.id,
        customerName: customer.name,
        factoryId: input.factoryId,
        factoryName: input.factoryName,
        neededBy: input.neededBy,
        cancelled: false,
        note: input.note,
        lines: input.lines.map((l, i) => ({ ...l, lineNo: i + 1, id: `${orderNo}:${i + 1}`, item: { ...l.item, factoryId: input.factoryId } })),
        advances: [],
        createdBy: by,
    }
    if (advance > 0) {
        paySeq += 1
        const adv: OrderAdvance = {
            id: `oa${paySeq}`,
            date: input.date,
            amount: advance,
            method: input.advance.method as 'cash' | 'bank',
            accountName: input.advance.accountName,
        }
        order.advances = [adv]
        noteReceipt({
            id: adv.id,
            date: adv.date,
            customerId: customer.id,
            customerName: customer.name,
            amount: adv.amount,
            method: adv.method,
            accountName: adv.accountName,
            orderId: order.id,
            orderNo,
            by,
        })
        // The advance is a credit on the customer's khata; FIFO applies it to their bills as they are made.
        postCustomerEntry({
            customerId: customer.id,
            date: adv.date,
            kind: 'credit',
            amount: adv.amount,
            detail: `Advance received · ${adv.method === 'cash' ? 'cash' : 'bank'} · ${orderNo}`,
            sourceId: adv.id,
        })
    }
    orders = [...orders, order]
    return order
}

/** Lines already billed stay on their bills and the advance stays in the khata. */
export const cancelOrder = async (id: string): Promise<SalesOrder> => {
    await delay()
    const current = orders.find((o) => o.id === id)
    if (!current) throw new ApiError(404, { code: 'notFound' })
    const next = { ...current, cancelled: true }
    orders = orders.map((o) => (o.id === id ? next : o))
    return next
}

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
