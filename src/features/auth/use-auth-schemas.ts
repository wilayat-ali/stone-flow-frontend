'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { z } from 'zod'
import { COMPANY_SLUG_PATTERN } from '@/config/auth'

export const PASSWORD_MIN = 8

/** Zod schemas with localized messages. Re-created only when the locale changes. */
export function useAuthSchemas() {
    const t = useTranslations('validation')

    return useMemo(() => {
        const required = t('required')
        const email = z.string().min(1, required).pipe(z.email(t('email')))
        const password = z
            .string()
            .min(1, required)
            .min(PASSWORD_MIN, t('passwordMin', { count: PASSWORD_MIN }))
        const matchPasswords = (data: { password: string; confirmPassword: string }) =>
            data.password === data.confirmPassword
        const mismatch = { message: t('passwordMatch'), path: ['confirmPassword'] }

        return {
            login: z.object({
                identifier: z.string().trim().min(1, required),
                password: z.string().min(1, required),
            }),
            acceptInvite: z
                .object({
                    firstName: z.string().trim().min(1, required),
                    lastName: z.string().trim(),
                    password,
                    confirmPassword: z.string().min(1, required),
                })
                .refine(matchPasswords, mismatch),
            adminLogin: z.object({ email, password: z.string().min(1, required) }),
            company: z.object({
                company: z
                    .string()
                    .trim()
                    .toLowerCase()
                    .pipe(z.string().min(1, required).regex(COMPANY_SLUG_PATTERN, t('company'))),
            }),
            forgot: z.object({ email }),
            setPassword: z
                .object({ password, confirmPassword: z.string().min(1, required) })
                .refine(matchPasswords, mismatch),
        }
    }, [t])
}

