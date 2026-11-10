const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

export type CompanySettings = {
    /**
     * When on, a munshi's purchase, payment and stock entries wait as Pending until
     * Owner/Partner/Manager approves. Owner's own entries are always auto-approved.
     */
    approvalRequired: boolean
}

export const companySettingsKey = ['company-settings'] as const

// In-memory stand-in for the backend; replace with `request()` calls like `features/admin/members.ts`.
let settings: CompanySettings = { approvalRequired: true }

export const getCompanySettings = async (): Promise<CompanySettings> => {
    await delay()
    return settings
}

export const updateCompanySettings = async (
    values: Partial<CompanySettings>
): Promise<CompanySettings> => {
    await delay()
    settings = { ...settings, ...values }
    return settings
}
