import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export const generateInitials = (fullName: unknown): string => {
    if (typeof fullName !== 'string') return ''

    const trimmed = fullName.trim()
    if (!trimmed) return ''

    const parts = trimmed.split(/\s+/) // split by any whitespace

    const firstInitial = parts[0]?.[0]?.toUpperCase() || ''
    const secondInitial = parts[1]?.[0]?.toUpperCase() || ''

    return `${firstInitial}${secondInitial}`
}
