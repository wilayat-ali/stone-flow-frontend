import { z } from 'zod'
import { paymentMethods } from './supplier-payments'

type Message = (key: 'required' | 'amount' | 'wholeAmount' | 'nonNegative' | 'stones') => string

const positive = (message: Message) => z.string().trim().refine((v) => Number(v) > 0, message('amount'))

export const purchaseSchema = (message: Message) =>
    z
        .object({
            purchiNo: z.string().trim().min(1, message('required')),
            truckNo: z.string().trim().min(1, message('required')),
            supplierId: z.string().min(1, message('required')),
            date: z.string().min(1, message('required')),
            material: z.string().min(1, message('required')),
            factoryId: z.string().min(1, message('required')),
            tons: positive(message),
            ratePerTon: positive(message),
            stones: z
                .string()
                .trim()
                .refine((v) => Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 12, message('stones')),
            discount: z
                .string()
                .trim()
                .refine((v) => v === '' || (Number.isInteger(Number(v)) && Number(v) >= 0), message('nonNegative')),
            note: z.string().trim(),
            // Optional: money paid at the yard, which becomes a supplier payment linked to this truck.
            paidMethod: z.enum(['none', ...paymentMethods]),
            paidAmount: z.string().trim(),
            paidAccountId: z.string(),
            chequeNo: z.string().trim(),
            chequeDate: z.string(),
        })
        .superRefine((values, ctx) => {
            if (values.paidMethod !== 'none') {
                const required = (path: string) =>
                    ctx.addIssue({ code: 'custom', path: [path], message: message('required') })
                if (!(Number(values.paidAmount) > 0) || !Number.isInteger(Number(values.paidAmount))) {
                    ctx.addIssue({ code: 'custom', path: ['paidAmount'], message: message('amount') })
                }
                if (!values.paidAccountId) required('paidAccountId')
                if (values.paidMethod === 'cheque') {
                    if (!values.chequeNo) required('chequeNo')
                    if (!values.chequeDate) required('chequeDate')
                }
            }
            const gross = Number(values.tons) * Number(values.ratePerTon)
            if (Number(values.discount || 0) > gross) {
                ctx.addIssue({ code: 'custom', path: ['discount'], message: message('nonNegative') })
            }
        })

export type PurchaseValues = z.infer<ReturnType<typeof purchaseSchema>>
