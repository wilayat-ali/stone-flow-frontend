import { CounterWidthsPage } from './counter-widths-page'
import { SootSizesPage } from './soot-sizes-page'

/** Settings → Sizes & Soot: vertical-cutting soot sizes, and counter widths. */
export function SizesPage() {
    return (
        <div className="flex flex-col gap-8">
            <SootSizesPage />
            <CounterWidthsPage />
        </div>
    )
}
