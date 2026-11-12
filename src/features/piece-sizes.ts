/**
 * The size grid each soot type is counted against, in inches (`widthxlength`). Settings → Sizes & Soot
 * only keeps the soot type names so far, so these stand in for its size list until that grows one.
 */
export const sootTypes = ['14', '6', '4'] as const

export type SootType = (typeof sootTypes)[number]

export const pieceSizes: Record<SootType, string[]> = {
    '14': ['12x61', '12x55', '12x49', '12x43', '12x37', '12x24', '12x12', '10x12', '6x12', '4x12'],
    '6': ['24x24', '12x24', '12x12', '6x12'],
    '4': ['12x24', '12x12', '10x12', '6x12', '6x24', '4x24'],
}

const dims = (size: string) => size.split('x').map(Number) as [number, number]

/** Width × length ÷ 144 for one piece, in sq.ft. */
export const sqFtOfSize = (size: string) => {
    const [width, length] = dims(size)
    return (width * length) / 144
}

/** `12x24` shown as `12×24`. */
export const sizeLabel = (size: string) => size.replace('x', '×')

/** Counter widths are kept in Settings as names such as "2 inch"; the number is the width in inches. */
export const widthInches = (name: string) => parseFloat(name) || 0
