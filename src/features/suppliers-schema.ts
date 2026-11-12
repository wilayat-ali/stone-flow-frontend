import { z } from 'zod'
import { supplierTypes } from './suppliers'

type Message = (key: 'required' | 'phone' | 'wholeAmount' | 'amount') => string

const whole = (message: Message) =>
    z
        .string()
        .trim()
        .refine((v) => v === '' || Number.isInteger(Number(v)), message('wholeAmount'))

/** Pakistani mobile, with or without the dash: `0333-7812345` or `03337812345`. */
const PHONE = /^03\d{2}-?\d{7}$/

export const supplierSchema = (message: Message) =>
    z
        .object({
            type: z.enum(supplierTypes),
            name: z.string().trim().min(1, message('required')),
            business: z.string().trim(),
            phone: z.string().trim().regex(PHONE, message('phone')),
            city: z.string().trim().min(1, message('required')),
            cuttingRatePerTon: whole(message),
            // May be negative: an advance we had paid before StoneFlow.
            openingBalance: z
                .string()
                .trim()
                .refine((v) => v === '' || Number.isInteger(Number(v)), message('wholeAmount')),
            openingDate: z.string().min(1, message('required')),
        })
        .superRefine((values, ctx) => {
            if (values.type === 'cutting_factory' && !(Number(values.cuttingRatePerTon) > 0)) {
                ctx.addIssue({ code: 'custom', path: ['cuttingRatePerTon'], message: message('amount') })
            }
        })

export type SupplierValues = z.infer<ReturnType<typeof supplierSchema>>
