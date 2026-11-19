export const SESSION_COOKIE = 'sf_session'
export const TOKEN_COOKIE = 'sf_token'
export const REFRESH_COOKIE = 'sf_refresh'
export const COMPANY_COOKIE = 'sf_company'
export const WORKSPACE_COOKIE = 'sf_workspace'
export const ADMIN_SESSION_COOKIE = 'sf_admin_session'
export const ADMIN_TOKEN_COOKIE = 'sf_admin_token'
export const THEME_COOKIE = 'sf_theme'
/** Set for a few seconds after the session was renewed, so a page is not renewed twice in a row. */
export const RENEWED_COOKIE = 'sf_renewed'

/**
 * How long the login cookies live: as long as the backend's refresh token (30 days). The access token inside
 * lasts 15 minutes and is renewed from the refresh token, so its cookie has to outlive it.
 */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30

export const SESSION_COOKIE_OPTIONS = {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
}
export const COMPANY_THEME_COOKIE = 'sf_company_theme'

export const ROUTES = {
    login: '/login',
    forgotPassword: '/forgot-password',
    dashboard: '/dashboard',
    adminCenter: '/admin-center/users',
    superAdminLogin: '/s-admin/auth/login',
    superAdminHome: '/s-admin/home',
} as const

/** Company (workspace slug) as the backend accepts it. */
export const COMPANY_SLUG_PATTERN = /^[a-z0-9-]{3,40}$/

export const companyLoginRoute = (slug: string) => `/${slug}/login`

export const PUBLIC_AUTH_PATHS: string[] = [
    ROUTES.login,
    ROUTES.forgotPassword,
]

/** First URL segments that are app pages. Any other first segment is a company name. */
const APP_ROOTS = [
    ROUTES.login,
    ROUTES.forgotPassword,
    ROUTES.dashboard,
    '/admin-center',
    '/settings',
    '/s-admin',
].map((route) => route.split('/')[1])

/**
 * A path that starts with a company name, such as `/lahore-marble` or `/lahore-marble/login`.
 * Like AuditVare, the first segment is a company until the API says otherwise; the page checks it.
 */
export const isCompanyFirstPath = (path: string) => {
    const first = path.split('/')[1]
    return !!first && !APP_ROOTS.includes(first)
}

const companyPage = (path: string, name: string) => {
    const [, slug, page, ...rest] = path.split('/')
    return page === name && rest.length === 0 && COMPANY_SLUG_PATTERN.test(slug)
}

/** `/{company}/login` is public. */
export const isCompanyLoginPath = (path: string) => companyPage(path, 'login')

/** Invite and password-reset links are public, and usable while signed in to another company. */
export const isCompanyLinkPath = (path: string) =>
    companyPage(path, 'accept-invite') || companyPage(path, 'reset-password')
