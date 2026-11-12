import { z } from 'zod'
import { payModes } from './expenses'

type Message = (key: 'required' | 'amount' | 'wholeAmount') => string

const amount = (message: Message) =>
    z
        .string()
        .trim()
        .refine((v) => Number(v) > 0, message('amount'))
        .refine((v) => Number.isInteger(Number(v)), message('wholeAmount'))

export const expenseSchema = (message: Message) =>
    z
        .object({
            date: z.string().min(1, message('required')),
            categoryId: z.string().min(1, message('required')),
            description: z.string().trim().min(1, message('required')),
            amount: amount(message),
            factoryId: z.string().min(1, message('required')),
            payMode: z.enum(payModes),
            /** Paid now: the account the money comes from (an account, or the munshi's cash). */
            accountId: z.string(),
            /** Unpaid bill: when it must be paid. */
            dueDate: z.string(),
            /** On credit: the shop that gave it. */
            shopId: z.string(),
            photoName: z.string(),
        })
        .superRefine((values, ctx) => {
            const need = values.payMode === 'paid' ? 'accountId' : values.payMode === 'unpaid' ? 'dueDate' : 'shopId'
            if (!values[need]) ctx.addIssue({ code: 'custom', path: [need], message: message('required') })
        })

export type ExpenseValues = z.infer<ReturnType<typeof expenseSchema>>

export const giveCashSchema = (message: Message) =>
    z.object({
        fromAccountId: z.string().min(1, message('required')),
        amount: amount(message),
        date: z.string().min(1, message('required')),
        note: z.string().trim(),
    })

export type GiveCashValues = z.infer<ReturnType<typeof giveCashSchema>>
