'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { listRoles, roleByKey, rolesQueryKey, rolesReady, rolesVersion, subscribeRoles } from './role-store'

/** Re-renders when a role is saved, so sidebars and guards pick up the new permissions at once. */
export function useRolesVersion() {
    return useSyncExternalStore(subscribeRoles, rolesVersion, rolesVersion)
}

/** False on the server and the first client render; true once the saved roles are loaded. */
export function useRolesReady() {
    return useSyncExternalStore(subscribeRoles, rolesReady, () => false)
}

export const useRoles = () => {
    useRolesVersion()
    return useQuery({ queryKey: rolesQueryKey, queryFn: listRoles })
}

const builtinNames: Record<string, string> = { owner: 'Owner', partner: 'Partner', manager: 'Manager', munshi: 'Munshi', viewer: 'Viewer' }

/** A role's display name: what it was renamed to, else the translated name of the five starting roles. */
export function useRoleLabel() {
    const t = useTranslations('admin.users')
    useRolesVersion()
    return useCallback(
        (key: string | undefined) => {
            const role = roleByKey(key)
            if (!role) return key ?? ''
            // The five starting roles arrive with English names: show them translated until someone renames one.
            if (role.builtin && role.name === builtinNames[role.key]) return t(`roles.${role.key}` as never)
            return role.name || role.key
        },
        [t]
    )
}

export function useRoleDescription() {
    const t = useTranslations('admin.roles')
    useRolesVersion()
    return useCallback(
        (key: string) => {
            const role = roleByKey(key)
            if (role?.description) return role.description
            return role?.builtin ? t(`descriptions.${key}` as never) : ''
        },
        [t]
    )
}
