export const SESSION_COOKIE = 'sf_session'
export const TOKEN_COOKIE = 'sf_token'
export const REFRESH_COOKIE = 'sf_refresh'
export const COMPANY_COOKIE = 'sf_company'
export const WORKSPACE_COOKIE = 'sf_workspace'
export const ADMIN_SESSION_COOKIE = 'sf_admin_session'
export const ADMIN_TOKEN_COOKIE = 'sf_admin_token'
export const THEME_COOKIE = 'sf_theme'
export const COMPANY_THEME_COOKIE = 'sf_company_theme'

export const ROUTES = {
    login: '/login',
    forgotPassword: '/forgot-password',
    selectWorkspace: '/select-workspace',
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
    ROUTES.selectWorkspace,
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
