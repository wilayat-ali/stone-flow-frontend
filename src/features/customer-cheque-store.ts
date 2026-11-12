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

/**
 * Kept apart from `customer-payments.ts` so the customers list can total the cheques still in hand
 * without importing the payments module (which imports customers).
 */
export const customerCheques: CustomerCheque[] = [
    {
        id: 'cc1',
        paymentId: 'seed-pay6',
        customerId: 'c7',
        customerName: 'Royal Interiors',
        bankName: 'Meezan Bank',
        chequeNo: '0044871',
        chequeDate: '2026-09-25',
        receivedOn: '2026-09-25',
        amount: 50000,
        status: 'cleared',
        depositAccountId: null,
        depositAccountName: 'HBL · Current A/C',
        clearedOn: '2026-09-27',
        bouncedOn: null,
        bounceReason: null,
    },
    {
        id: 'cc2',
        paymentId: 'seed-pay7',
        customerId: 'c4',
        customerName: 'ABC Builders',
        bankName: 'UBL',
        chequeNo: '0091822',
        chequeDate: '2026-11-10',
        receivedOn: '2026-11-01',
        amount: 5200,
        status: 'pending',
        depositAccountId: null,
        depositAccountName: null,
        clearedOn: null,
        bouncedOn: null,
        bounceReason: null,
    },
    {
        id: 'cc3',
        paymentId: 'seed-pay8',
        customerId: 'c5',
        customerName: 'Al-Noor Developers',
        bankName: 'Bank Alfalah',
        chequeNo: '0310457',
        chequeDate: '2026-12-10',
        receivedOn: '2026-11-05',
        amount: 60000,
        status: 'pending',
        depositAccountId: null,
        depositAccountName: null,
        clearedOn: null,
        bouncedOn: null,
        bounceReason: null,
    },
]

/** Cheques received but not yet cleared: they already lowered the khata, but no money is in the bank. */
export const unclearedChequeTotal = (customerId?: string) =>
    customerCheques
        .filter((c) => c.status === 'pending' && (!customerId || c.customerId === customerId))
        .reduce((s, c) => s + c.amount, 0)

export const today = () => new Date().toISOString().slice(0, 10)

export type CustomerChequeState = 'post_dated' | 'due' | 'cleared' | 'bounced'

/** A pending cheque is post-dated until its date arrives, then due: deposit it. */
export const customerChequeState = (cheque: Pick<CustomerCheque, 'status' | 'chequeDate'>): CustomerChequeState =>
    cheque.status !== 'pending' ? cheque.status : cheque.chequeDate > today() ? 'post_dated' : 'due'
