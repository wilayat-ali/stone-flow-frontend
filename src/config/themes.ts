/**
 * Colour themes people can choose. The colours live in src/app/themes.css; the ids here must match
 * the `data-theme` selectors there and the backend's THEME_KEYS. Names are in the `theme.names` messages.
 */
export const THEME_IDS = [
    'tangerine',
    'twitter',
    'amber-minimal',
    'violet-bloom',
    'northern-lights',
    'darkmatter',
    'candyland',
    'vercel',
] as const

export type ThemeId = (typeof THEME_IDS)[number]

export const DEFAULT_THEME: ThemeId = 'tangerine'

export const isThemeId = (value: string | undefined | null): value is ThemeId =>
    THEME_IDS.includes(value as ThemeId)
