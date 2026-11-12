'use client'

import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Renders what is to be printed beside the page, hidden on screen. The print stylesheet hides
 * everything else, so the browser prints just the slip, black on white.
 */
export function PrintArea({ children }: { children: ReactNode }) {
    // Only used inside a dialog that is opened by a click, so the document always exists by then.
    if (typeof document === 'undefined') return null
    return createPortal(
        <div id="print-root" className="hidden print:block">
            {children}
        </div>,
        document.body
    )
}
