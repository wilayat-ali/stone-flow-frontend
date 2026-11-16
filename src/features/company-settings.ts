import { request } from '@/lib/client-api'

export type CompanySettings = {
    /**
     * When on, a munshi's purchase, payment and stock entries wait as Pending until
     * Owner/Partner/Manager approves. Owner's own entries are always auto-approved.
     */
    approvalRequired: boolean
}

export const companySettingsKey = ['company-settings'] as const

const base = '/api/company/settings'

export const getCompanySettings = () => request<CompanySettings>(base)

export const updateCompanySettings = (values: Partial<CompanySettings>) =>
    request<CompanySettings>(base, { method: 'PATCH', body: values })
