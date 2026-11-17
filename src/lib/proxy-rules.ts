// What the browser may ask the backend for through /api/*. Anything not listed here is a 404 before it reaches
// the backend. The backend still decides who may do what; this only keeps the browser to the calls the
// screens actually make.

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SLUG = /^[A-Za-z0-9_-]{1,80}$/

// A path pattern is segments joined by "/": a word, `:id` (a uuid), `:key` (a short slug), or words
// separated by "|" for alternatives. An empty pattern is the area itself.
const segmentMatches = (pattern: string, value: string): boolean => {
    if (pattern === ':id') return UUID.test(value)
    if (pattern === ':key') return SLUG.test(value)
    return pattern.split('|').includes(value)
}

type Rule = { method: Method; segments: string[] }

const rule = (method: Method, pattern = ''): Rule => ({ method, segments: pattern.split('/').filter(Boolean) })

const LISTS = 'factories|machines|worker-rates|soot-sizes|counter-widths|expense-categories|materials|piece-sizes'

const AREAS: Record<string, Rule[]> = {
    suppliers: [rule('GET'), rule('POST'), rule('GET', ':id'), rule('GET', ':id/khata'), rule('PATCH', ':id')],
    purchases: [rule('GET'), rule('POST'), rule('GET', ':id'), rule('PATCH', ':id'), rule('POST', ':id/approve|reject|cancel')],
    'supplier-payments': [rule('GET'), rule('POST'), rule('GET', ':id'), rule('POST', ':id/confirm|reject')],
    'supplier-cheques': [rule('GET'), rule('POST', ':id/clear|bounce|cancel')],
    approvals: [rule('GET'), rule('POST', ':id/approve|reject')],
    loans: [rule('GET'), rule('POST'), rule('PUT', ':id/months/:key'), rule('DELETE', ':id/months/:key')],
    months: [rule('GET', 'log'), rule('GET', ':key/sheet'), rule('GET', ':key/preview'), rule('POST', ':key/close|reopen')],
    workers: [
        rule('GET'),
        rule('POST'),
        rule('GET', 'attendance'),
        rule('PUT', 'attendance'),
        rule('GET', 'attendance/summary'),
        rule('GET', 'register'),
        rule('PUT', 'register'),
        rule('GET', 'payments'),
        rule('POST', 'payments'),
        rule('POST', 'payments/:id/confirm|reject'),
        rule('GET', ':id'),
        rule('PATCH', ':id'),
        rule('GET', ':id/khata'),
    ],
    expenses: [
        rule('GET'),
        rule('POST'),
        rule('GET', 'munshi-cash'),
        rule('POST', 'munshi-cash/gives'),
        rule('GET', ':id'),
        rule('POST', ':id/approve|reject|cancel|pay'),
    ],
    bills: [rule('GET'), rule('POST'), rule('GET', ':id'), rule('PATCH', ':id'), rule('POST', ':id/cancel|collections')],
    'sales-orders': [rule('GET'), rule('POST'), rule('POST', ':id/cancel')],
    'customer-payments': [rule('GET'), rule('POST'), rule('POST', ':id/reverse')],
    'customer-cheques': [rule('GET'), rule('POST', ':id/clear|bounce')],
    customers: [rule('GET'), rule('POST'), rule('GET', ':id'), rule('GET', ':id/khata'), rule('PATCH', ':id')],
    'cutting-jobs': [rule('GET'), rule('POST'), rule('POST', ':id/send|finish|deliver|cancel')],
    production: [
        rule('GET', 'workers'),
        rule('GET', 'entries'),
        rule('POST', 'entries'),
        rule('GET', 'entries/:id'),
        rule('POST', 'entries/:id/reverse'),
        rule('POST', 'trucks/:id/send|start|finish'),
    ],
    // Stock only changes through production, stock entries and sales: the browser reads it and sets alert levels.
    stock: [rule('GET'), rule('GET', 'history'), rule('PUT', 'alerts')],
    'stock-entries': [rule('GET'), rule('POST'), rule('GET', ':id'), rule('POST', ':id/approve|reject')],
    settings: [rule('GET', LISTS), rule('POST', LISTS), rule('PATCH', `${LISTS}/:id`)],
    notifications: [rule('GET'), rule('POST', 'read-all'), rule('POST', ':key/read')],
    company: [
        rule('GET', 'me'),
        rule('GET', 'members'),
        rule('POST', 'members/:id/deactivate|activate|reset-link'),
        rule('PATCH', 'members/:id/role'),
        rule('GET', 'invitations'),
        rule('POST', 'invitations'),
        rule('DELETE', 'invitations/:id'),
        rule('GET', 'roles'),
        rule('POST', 'roles'),
        rule('PATCH', 'roles/:key'),
        rule('DELETE', 'roles/:key'),
        rule('GET', 'settings'),
        rule('PATCH', 'settings'),
    ],
    'cash-bank': [
        rule('GET', 'accounts'),
        rule('POST', 'accounts'),
        rule('PATCH', 'accounts/:id'),
        rule('GET', 'accounts/:id/statement'),
        rule('POST', 'transfers'),
        rule('POST', 'deposits'),
        rule('POST', 'other-payments'),
        rule('POST', 'other-receipts'),
        rule('POST', 'cash-count'),
        rule('POST', 'entries/:id/reverse'),
        rule('GET', 'approvals'),
        rule('POST', 'approvals/:id/approve|reject'),
    ],
}

/** Whether `method` on `/<area>/<rest...>` is one the screens use. */
export function isAllowedCall(area: string | undefined, rest: string[], method: string): boolean {
    const rules = area ? AREAS[area] : undefined
    if (!rules) return false

    return rules.some(
        (r) => r.method === method && r.segments.length === rest.length && r.segments.every((segment, index) => segmentMatches(segment, rest[index]))
    )
}
