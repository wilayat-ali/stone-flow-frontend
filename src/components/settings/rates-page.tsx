import { ExpenseCategoriesPage } from './expense-categories-page'
import { WorkerRatesPage } from './worker-rates-page'

/** Settings → Rates & Categories: worker job rates, and the categories expenses are recorded against. */
export function RatesPage() {
    return (
        <div className="flex flex-col gap-8">
            <WorkerRatesPage />
            <ExpenseCategoriesPage />
        </div>
    )
}
