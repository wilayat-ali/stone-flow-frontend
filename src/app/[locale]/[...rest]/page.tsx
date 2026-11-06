import { notFound } from 'next/navigation'

// Unmatched URLs inside a locale render the localized not-found page.
export default function CatchAllPage() {
    return notFound()
}
