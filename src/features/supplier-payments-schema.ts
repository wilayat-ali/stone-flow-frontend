import { z } from 'zod'
import { paymentMethods } from './supplier-payments'

type Message = (key: 'required' | 'amount' | 'wholeAmount') => string

export const paymentSchema = (message: Message) =>
    z
        .object({
            supplierId: z.string().min(1, message('required')),
            date: z.string().min(1, message('required')),
            method: z.enum(paymentMethods),
            amount: z
                .string()
                .trim()
                .refine((v) => Number(v) > 0, message('amount'))
                .refine((v) => Number.isInteger(Number(v)), message('wholeAmount')),
            accountId: z.string().min(1, message('required')),
            reference: z.string().trim(),
            chequeNo: z.string().trim(),
            chequeDate: z.string(),
            /** `fifo`: oldest unpaid trucks first. `pick`: the trucks ticked below. */
            applyTo: z.enum(['fifo', 'pick']),
            note: z.string().trim(),
            /** Trucks ticked when applying to chosen trucks. */
            picked: z.array(z.string()),
        })
        .superRefine((values, ctx) => {
            if (values.method !== 'cheque') return
            if (!values.chequeNo) ctx.addIssue({ code: 'custom', path: ['chequeNo'], message: message('required') })
            if (!values.chequeDate) ctx.addIssue({ code: 'custom', path: ['chequeDate'], message: message('required') })
        })

export type PaymentValues = z.infer<ReturnType<typeof paymentSchema>>
