import { z } from 'zod'

type Message = (key: 'required' | 'amount' | 'nonNegative' | 'last4' | 'differentAccounts') => string

const money = (message: Message) =>
    z.string().trim().refine((v) => Number(v) > 0, message('amount'))

const date = (message: Message) => z.string().min(1, message('required'))

export const accountSchema = (message: Message) =>
    z
        .object({
            kind: z.enum(['cash', 'bank']),
            name: z.string().trim().min(1, message('required')),
            last4: z.string().trim(),
            openingBalance: z
                .string()
                .trim()
                .min(1, message('required'))
                .refine((v) => Number(v) >= 0, message('nonNegative')),
            openingDate: date(message),
        })
        .superRefine((values, ctx) => {
            if (values.kind === 'bank' && !/^\d{4}$/.test(values.last4)) {
                ctx.addIssue({ code: 'custom', path: ['last4'], message: message('last4') })
            }
        })

export type AccountValues = z.infer<ReturnType<typeof accountSchema>>

export const entrySchema = (message: Message) =>
    z.object({
        accountId: z.string().min(1, message('required')),
        date: date(message),
        amount: money(message),
        note: z.string().trim(),
    })

export type EntryValues = z.infer<ReturnType<typeof entrySchema>>

export const transferSchema = (message: Message) =>
    z
        .object({
            fromId: z.string().min(1, message('required')),
            toId: z.string().min(1, message('required')),
            date: date(message),
            amount: money(message),
            note: z.string().trim(),
        })
        .superRefine((values, ctx) => {
            if (values.fromId && values.fromId === values.toId) {
                ctx.addIssue({ code: 'custom', path: ['toId'], message: message('differentAccounts') })
            }
        })

export type TransferValues = z.infer<ReturnType<typeof transferSchema>>

export const cashCountSchema = (message: Message) =>
    z.object({
        accountId: z.string().min(1, message('required')),
        date: date(message),
        counted: z
            .string()
            .trim()
            .min(1, message('required'))
            .refine((v) => Number(v) >= 0, message('nonNegative')),
        reason: z.string().trim().min(1, message('required')),
    })

export type CashCountValues = z.infer<ReturnType<typeof cashCountSchema>>
