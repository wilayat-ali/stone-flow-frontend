import { z } from 'zod'
import { payTypes } from './workers'

type Message = (key: 'required' | 'amount' | 'wholeAmount') => string

const wholeAmount = (message: Message) =>
    z
        .string()
        .trim()
        .refine((v) => Number(v) > 0, message('amount'))
        .refine((v) => Number.isInteger(Number(v)), message('wholeAmount'))

export const workerSchema = (message: Message) =>
    z
        .object({
            name: z.string().trim().min(1, message('required')),
            phone: z.string().trim(),
            jobTitle: z.string().trim().min(1, message('required')),
            factoryId: z.string().min(1, message('required')),
            payType: z.enum(payTypes),
            /** A sq.ft worker may leave it empty and be paid by the job rate card. */
            rate: z.string().trim(),
            defaultJob: z.string(),
            /** + we owe him, − he owes us. Blank is zero. */
            openingBalance: z.string().trim().refine((v) => v === '' || (v !== '-' && Number.isInteger(Number(v))), message('wholeAmount')),
            joinedOn: z.string().min(1, message('required')),
        })
        .superRefine((values, ctx) => {
            if (values.payType === 'sqft') {
                if (!values.defaultJob && !(Number(values.rate) > 0)) ctx.addIssue({ code: 'custom', path: ['defaultJob'], message: message('required') })
                if (values.rate && !(Number(values.rate) > 0)) ctx.addIssue({ code: 'custom', path: ['rate'], message: message('amount') })
            } else if (!(Number(values.rate) > 0)) {
                ctx.addIssue({ code: 'custom', path: ['rate'], message: message('amount') })
            }
        })

export type WorkerValues = z.infer<ReturnType<typeof workerSchema>>

export const payWorkerSchema = (message: Message) =>
    z.object({
        workerId: z.string().min(1, message('required')),
        amount: wholeAmount(message),
        accountId: z.string().min(1, message('required')),
        date: z.string().min(1, message('required')),
        note: z.string().trim(),
    })

export type PayWorkerValues = z.infer<ReturnType<typeof payWorkerSchema>>
