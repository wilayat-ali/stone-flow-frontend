import { z } from 'zod'
import { customerTypes } from './customers'

type Message = (key: 'required' | 'phone' | 'wholeAmount') => string

/** Pakistani mobile, with or without the dash: `0333-7812345` or `03337812345`. */
const PHONE = /^03\d{2}-?\d{7}$/

export const customerSchema = (message: Message) =>
    z.object({
        name: z.string().trim().min(1, message('required')),
        phone: z.string().trim().regex(PHONE, message('phone')),
        type: z.enum(customerTypes),
        city: z.string().trim(),
        contactPerson: z.string().trim(),
        // Udhaar from before StoneFlow; may be negative for an advance. Owner and partner only.
        openingBalance: z.string().trim().refine((v) => v === '' || Number.isInteger(Number(v)), message('wholeAmount')),
        openingDate: z.string(),
    })

export type CustomerValues = z.infer<ReturnType<typeof customerSchema>>
