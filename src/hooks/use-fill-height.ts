import { useLayoutEffect, useRef, useState } from 'react'

const MIN_HEIGHT = 240
/** Breathing room under the pager, so it never touches the screen edge. */
const SAFETY = 24

const scrollParentOf = (el: HTMLElement) => {
    for (let node = el.parentElement; node; node = node.parentElement) {
        const overflowY = getComputedStyle(node).overflowY
        if (overflowY === 'auto' || overflowY === 'scroll') return node
    }
    return null
}

/**
 * Height left for a block inside its nearest scrolling ancestor, so the block can scroll
 * internally while whatever sits below it (`footerRef`) stays in view and the page does not scroll.
 * Re-measured when the window or the scroll ancestor resizes.
 */
export function useFillHeight(enabled: boolean, gap = 16) {
    const blockRef = useRef<HTMLDivElement>(null)
    const footerRef = useRef<HTMLDivElement>(null)
    const [height, setHeight] = useState<number>()

    useLayoutEffect(() => {
        const block = blockRef.current
        if (!enabled || !block) return

        const scroller = scrollParentOf(block)
        const measure = () => {
            const scrollerTop = scroller
                ? scroller.getBoundingClientRect().top
                : 0
            // Never taller than what is actually on screen, even if the scrolling ancestor is not bounded.
            const onScreen = window.innerHeight - Math.max(scrollerTop, 0)
            const viewport = scroller
                ? Math.min(scroller.clientHeight, onScreen)
                : window.innerHeight
            const scrolled = scroller ? scroller.scrollTop : 0
            const top =
                block.getBoundingClientRect().top - scrollerTop + scrolled
            const padding = scroller
                ? parseFloat(getComputedStyle(scroller).paddingBottom) || 0
                : 0
            const footer = footerRef.current
                ? footerRef.current.offsetHeight + gap
                : 0
            setHeight(
                Math.max(
                    MIN_HEIGHT,
                    Math.floor(viewport - top - footer - padding - SAFETY)
                )
            )
        }

        measure()
        const observer = new ResizeObserver(measure)
        if (scroller) observer.observe(scroller)
        window.addEventListener('resize', measure)
        return () => {
            observer.disconnect()
            window.removeEventListener('resize', measure)
        }
    }, [enabled, gap])

    return { blockRef, footerRef, height }
}
