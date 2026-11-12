import { z } from 'zod'
import { customerPaymentMethods } from './customer-payments'

type Message = (key: 'required' | 'amount' | 'wholeAmount') => string

export const receivePaymentSchema = (message: Message) =>
    z
        .object({
            customerId: z.string().min(1, message('required')),
            date: z.string().min(1, message('required')),
            method: z.enum(customerPaymentMethods),
            amount: z
                .string()
                .trim()
                .refine((v) => Number(v) > 0, message('amount'))
                .refine((v) => Number.isInteger(Number(v)), message('wholeAmount')),
            /** The cash or bank account the money goes into; a cheque reaches no account until it clears. */
            accountId: z.string(),
            bankName: z.string().trim(),
            chequeNo: z.string().trim(),
            chequeDate: z.string(),
            note: z.string().trim(),
        })
        .superRefine((values, ctx) => {
            if (values.method === 'cheque') {
                for (const field of ['bankName', 'chequeNo', 'chequeDate'] as const) {
                    if (!values[field]) ctx.addIssue({ code: 'custom', path: [field], message: message('required') })
                }
            } else if (!values.accountId) {
                ctx.addIssue({ code: 'custom', path: ['accountId'], message: message('required') })
            }
        })

export type ReceivePaymentValues = z.infer<ReturnType<typeof receivePaymentSchema>>
