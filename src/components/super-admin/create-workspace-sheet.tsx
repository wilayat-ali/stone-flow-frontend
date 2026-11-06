'use client'

import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { z } from 'zod'
import { toContact } from '@/components/admin/invite-user-sheet'
import { TextField } from '@/components/shared/form-fields'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import {
    createWorkspace,
    failureKey,
    platformKeys,
    SLUG_PATTERN,
    slugify,
    type CreateWorkspaceResult,
    type PlatformKey,
} from '@/features/super-admin/workspaces'
import { useDirection } from '@/hooks/use-direction'

/** New workspace with its owner and the platforms it may use. The owner gets an invite link back. */
export function CreateWorkspaceSheet({
    open,
    onOpenChange,
    onCreated,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    onCreated: (result: CreateWorkspaceResult) => void
}) {
    const t = useTranslations('superAdmin.workspaces')
    const tc = useTranslations('common')
    const tv = useTranslations('validation')
    const { isRtl } = useDirection()

    const schema = useMemo(
        () =>
            z.object({
                name: z.string().trim().min(2, tv('required')),
                slug: z.string().trim().toLowerCase().regex(SLUG_PATTERN, tv('company')),
                ownerFirstName: z.string().trim().min(1, tv('required')),
                ownerLastName: z.string().trim(),
                ownerContact: z.string().trim().min(1, tv('required')),
                platforms: z.array(z.enum(platformKeys)).min(1, t('create.platformsRequired')),
            }),
        [tv, t]
    )

    const form = useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: {
            name: '',
            slug: '',
            ownerFirstName: '',
            ownerLastName: '',
            ownerContact: '',
            platforms: [],
        },
    })

    const create = useMutation({
        mutationFn: (values: z.infer<typeof schema>) =>
            createWorkspace({
                name: values.name,
                slug: values.slug,
                platforms: values.platforms,
                owner: {
                    firstName: values.ownerFirstName,
                    ...(values.ownerLastName && { lastName: values.ownerLastName }),
                    ...toContact(values.ownerContact),
                },
            }),
        onSuccess: (result) => {
            form.reset()
            onOpenChange(false)
            onCreated(result)
        },
        onError: (error) => {
            const key = `errors.${failureKey(error)}`
            toast.error(t.has(key as never) ? t(key as never) : t('errors.generic'))
        },
    })

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side={isRtl ? 'left' : 'right'} className="overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>{t('create.title')}</SheetTitle>
                    <SheetDescription>{t('create.description')}</SheetDescription>
                </SheetHeader>
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit((values) => create.mutate(values))}
                        className="flex flex-1 flex-col gap-4 px-4"
                        noValidate
                    >
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('create.name')}</FormLabel>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            onChange={(e) => {
                                                const previous = slugify(field.value)
                                                field.onChange(e)
                                                // Keep the slug following the name until it is edited by hand.
                                                const slug = form.getValues('slug')
                                                if (!slug || slug === previous) {
                                                    form.setValue('slug', slugify(e.target.value), {
                                                        shouldValidate: form.formState.isSubmitted,
                                                    })
                                                }
                                            }}
                                            autoComplete="organization"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <TextField
                            control={form.control}
                            name="slug"
                            label={t('create.slug')}
                            placeholder="lahore-marble"
                            autoComplete="off"
                            dir="ltr"
                        />
                        <p className="text-muted-foreground -mt-2 text-xs">{t('create.slugHint')}</p>

                        <div className="flex flex-col gap-3 border-t pt-4">
                            <h3 className="text-sm font-medium">{t('create.ownerSection')}</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <TextField
                                    control={form.control}
                                    name="ownerFirstName"
                                    label={t('create.ownerFirstName')}
                                    autoComplete="off"
                                />
                                <TextField
                                    control={form.control}
                                    name="ownerLastName"
                                    label={t('create.ownerLastName')}
                                    autoComplete="off"
                                />
                            </div>
                            <TextField
                                control={form.control}
                                name="ownerContact"
                                label={t('create.ownerContact')}
                                placeholder={t('create.ownerContactPlaceholder')}
                                autoComplete="off"
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="platforms"
                            render={({ field }) => (
                                <FormItem className="border-t pt-4">
                                    <FormLabel>{t('create.platforms')}</FormLabel>
                                    <p className="text-muted-foreground text-xs">{t('create.platformsHint')}</p>
                                    <div className="flex flex-col gap-2">
                                        {platformKeys.map((key: PlatformKey) => (
                                            <label key={key} className="flex items-center gap-2 text-sm">
                                                <Checkbox
                                                    checked={field.value.includes(key)}
                                                    onCheckedChange={(checked) =>
                                                        field.onChange(
                                                            checked
                                                                ? [...field.value, key]
                                                                : field.value.filter((k) => k !== key)
                                                        )
                                                    }
                                                />
                                                {t(`platforms.${key}`)}
                                            </label>
                                        ))}
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <SheetFooter className="mt-auto px-0">
                            <Button type="submit" disabled={create.isPending}>
                                {create.isPending && <Loader2 className="animate-spin" />}
                                {t('create.submit')}
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
