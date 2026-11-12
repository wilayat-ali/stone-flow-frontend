import { z } from 'zod'

type Message = (key: 'required' | 'amount' | 'wholeAmount') => string

const whole = (message: Message) =>
    z
        .string()
        .trim()
        .refine((v) => Number(v) > 0, message('amount'))
        .refine((v) => Number.isInteger(Number(v)), message('wholeAmount'))

export const BEFORE = 'before'

export const loanSchema = (message: Message) =>
    z
        .object({
            workerId: z.string().min(1, message('required')),
            amount: whole(message),
            /** An account id, or `before` for a loan given before StoneFlow (no money leaves an account now). */
            source: z.string().min(1, message('required')),
            monthlyInstalment: whole(message),
            firstMonth: z.string().min(1, message('required')),
            priorRepaid: z.string().trim().refine((v) => v === '' || (Number.isInteger(Number(v)) && Number(v) >= 0), message('wholeAmount')),
            date: z.string().min(1, message('required')),
            reason: z.string().trim(),
        })
        .superRefine((values, ctx) => {
            if (Number(values.priorRepaid) >= Number(values.amount)) ctx.addIssue({ code: 'custom', path: ['priorRepaid'], message: message('amount') })
        })

export type LoanValues = z.infer<ReturnType<typeof loanSchema>>
