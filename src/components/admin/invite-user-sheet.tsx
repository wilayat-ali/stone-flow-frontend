'use client'

import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import { SelectField, TextField } from '@/components/shared/form-fields'
import { inviteMember, type InviteResult } from '@/features/admin/members'
import { useDirection } from '@/hooks/use-direction'
import { errorCode } from '@/lib/client-api'

/** A phone number or an email: anything with "@" is an email. */
export const toContact = (identifier: string) =>
    identifier.includes('@') ? { email: identifier.trim() } : { phone: identifier.trim() }

export function InviteUserSheet({
    open,
    onOpenChange,
    assignable,
    roleLabel,
    onInvited,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    assignable: string[]
    roleLabel: (key: string) => string
    onInvited: (result: InviteResult) => void
}) {
    const t = useTranslations('admin.users')
    const tc = useTranslations('common')
    const tv = useTranslations('validation')
    const { isRtl } = useDirection()

    const schema = useMemo(
        () =>
            z.object({
                identifier: z.string().trim().min(1, tv('required')),
                roleKey: z.string().min(1, tv('required')),
            }),
        [tv]
    )

    const form = useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: { identifier: '', roleKey: assignable.at(-1) ?? '' },
    })

    const invite = useMutation({
        mutationFn: (values: z.infer<typeof schema>) =>
            inviteMember({ ...toContact(values.identifier), roleKey: values.roleKey }),
        onSuccess: (result) => {
            form.reset()
            onOpenChange(false)
            onInvited(result)
        },
        onError: (error) => {
            const code = errorCode(error)
            const key = `errors.${code}`
            toast.error(code && t.has(key as never) ? t(key as never) : t('errors.generic'))
        },
    })

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side={isRtl ? 'left' : 'right'}>
                <SheetHeader>
                    <SheetTitle>{t('invite.title')}</SheetTitle>
                    <SheetDescription>{t('invite.description')}</SheetDescription>
                </SheetHeader>
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit((values) => invite.mutate(values))}
                        className="flex flex-1 flex-col gap-4 px-4"
                        noValidate
                    >
                        <TextField
                            control={form.control}
                            name="identifier"
                            label={t('invite.identifier')}
                            placeholder={t('invite.identifierPlaceholder')}
                            autoComplete="off"
                        />
                        <SelectField
                            control={form.control}
                            name="roleKey"
                            label={t('invite.role')}
                            options={assignable.map((key) => ({ value: key, label: roleLabel(key) }))}
                        />
                        <p className="text-muted-foreground text-xs">{t('invite.hint')}</p>
                        <SheetFooter className="mt-auto px-0">
                            <Button type="submit" disabled={invite.isPending}>
                                {invite.isPending && <Loader2 className="animate-spin" />}
                                {t('invite.submit')}
                            </Button>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                {tc('cancel')}
                            </Button>
                        </SheetFooter>
                    </form>
                </Form>
            </SheetContent>
        </Sheet>
    )
}
