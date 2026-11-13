'use client'

import { useEffect, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { z } from 'zod'
import { FormSheet } from '@/components/shared/form-sheet'
import { PermissionMatrix } from '@/components/shared/permission-matrix'
import { TextareaField, TextField } from '@/components/shared/form-fields'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { modulePermissions, permissionModules, type Permission } from '@/features/admin/permissions'
import { createRole, myAccessKey, OWNER_ROLE, rolesQueryKey, updateRole, type Role } from '@/features/admin/role-store'
import { useRoleDescription, useRoleLabel, useRoles } from '@/features/admin/use-roles'
import { errorCode } from '@/lib/client-api'

type Values = { name: string; description: string; permissions: Permission[] }

/**
 * Create a role, edit one, or (for Owner, or when `readOnly`) just look at what it can do.
 * `role` is null when creating.
 */
export function RoleSheet({
    open,
    onOpenChange,
    role,
    readOnly,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    role: Role | null
    readOnly?: boolean
}) {
    const t = useTranslations('admin.roles')
    const tc = useTranslations('common')
    const tv = useTranslations('validation')
    const queryClient = useQueryClient()
    const roles = useRoles()
    const roleLabel = useRoleLabel()
    const roleDescription = useRoleDescription()
    const locked = readOnly || role?.key === OWNER_ROLE

    const schema = useMemo(
        () =>
            z.object({
                name: z.string().trim().min(1, tv('required')),
                description: z.string().trim(),
                permissions: z.array(z.string()).min(1, t('form.permissionsRequired')),
            }),
        [tv, t]
    )

    const defaults = (): Values => ({
        name: role ? roleLabel(role.key) : '',
        description: role ? roleDescription(role.key) : '',
        permissions: role?.permissions ?? [],
    })

    const form = useForm<Values>({ resolver: zodResolver(schema) as never, defaultValues: defaults() })

    // Start from the role being edited (or empty) each time the sheet opens.
    useEffect(() => {
        if (open) form.reset(defaults())
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, role?.key])

    const save = useMutation({
        mutationFn: (values: Values) => (role ? updateRole(role.key, values) : createRole(values)),
        onSuccess: () => {
            toast.success(role ? t('updated') : t('created'))
            queryClient.invalidateQueries({ queryKey: rolesQueryKey })
            // The person editing may be changing their own permissions.
            queryClient.invalidateQueries({ queryKey: myAccessKey })
            onOpenChange(false)
        },
        onError: (error) => {
            const code = errorCode(error)
            const key = `errors.${code}`
            toast.error(code && t.has(key as never) ? t(key as never) : t('errors.generic'))
        },
    })

    const groups = useMemo(
        () =>
            permissionModules.map((module) => ({
                id: module,
                title: t(`permissions.${module}.title` as never),
                items: modulePermissions(module).map((permission) => ({
                    id: permission,
                    label: t(`permissions.${module}.${permission.split('.')[1]}` as never),
                })),
            })),
        [t]
    )

    const permissions = useWatch({ control: form.control, name: 'permissions' })
    const copyable = (roles.data ?? []).filter((r) => r.key !== role?.key)

    const title = role ? (locked ? t('form.viewTitle', { name: roleLabel(role.key) }) : t('form.editTitle')) : t('form.createTitle')

    return (
        <FormSheet
            open={open}
            onOpenChange={onOpenChange}
            className="sm:max-w-3xl"
            title={title}
            description={t('form.description')}
            form={form}
            onSubmit={(values) => save.mutate(values)}
            submitLabel={role ? t('form.save') : t('form.create')}
            cancelLabel={tc('cancel')}
            pending={save.isPending}
            submitDisabled={locked}
            summary={t('form.summary', { count: permissions.length })}
        >
            {role?.key === OWNER_ROLE && <p className="text-muted-foreground text-sm">{t('form.ownerNote')}</p>}
            <TextField control={form.control} name="name" label={t('form.name')} placeholder={t('form.namePlaceholder')} disabled={locked} autoComplete="off" />
            <TextareaField
                control={form.control}
                name="description"
                label={t('form.descriptionLabel')}
                placeholder={t('form.descriptionPlaceholder')}
                disabled={locked}
            />
            {!role && (
                <div className="flex flex-col gap-2">
                    <Label>{t('form.copyFrom')}</Label>
                    <Select
                        onValueChange={(key) => {
                            const source = copyable.find((r) => r.key === key)
                            if (source) form.setValue('permissions', source.permissions, { shouldValidate: true })
                        }}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder={t('form.copyPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                            {copyable.map((r) => (
                                <SelectItem key={r.key} value={r.key}>
                                    {roleLabel(r.key)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}
            <div className="flex flex-col gap-2 pb-2">
                <Label>{t('form.permissions')}</Label>
                <PermissionMatrix
                    groups={groups}
                    value={permissions}
                    disabled={locked}
                    selectAllLabel={t('form.selectAll')}
                    onChange={(value) => form.setValue('permissions', value as Permission[], { shouldValidate: true, shouldDirty: true })}
                />
                {form.formState.errors.permissions?.message && (
                    <p className="text-destructive text-sm">{String(form.formState.errors.permissions.message)}</p>
                )}
            </div>
        </FormSheet>
    )
}
