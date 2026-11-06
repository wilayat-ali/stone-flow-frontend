const PALETTE =
    'white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
const BOUNDARY = '(?:^|[\\s:!"\'`])'

const colorChecks = [
    {
        re: /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/i,
        message: 'Hard-coded hex color. Use a theme token (see globals.css).',
    },
    {
        re: /\b(?:oklch|oklab|lab|lch|hsla?|rgba?|color-mix)\(/i,
        message: 'Hard-coded color function. Use a theme token (see globals.css).',
    },
    {
        re: new RegExp(
            `${BOUNDARY}-?(?:bg|text|border|ring|fill|stroke|from|via|to|outline|divide|shadow|decoration|accent|caret)-(?:${PALETTE})\\b`
        ),
        message:
            'Tailwind palette color. Use a semantic token such as bg-primary, text-muted-foreground, border-border.',
    },
]

const directionChecks = [
    {
        re: new RegExp(`${BOUNDARY}-?(?:ml|mr|pl|pr)-(?:\\d|\\[|px|auto)`),
        message: 'Physical spacing breaks RTL. Use ms-/me-/ps-/pe-.',
    },
    {
        re: new RegExp(`${BOUNDARY}text-(?:left|right)\\b`),
        message: 'Physical alignment breaks RTL. Use text-start / text-end.',
    },
    {
        re: new RegExp(
            `${BOUNDARY}-?(?:left|right)-(?:\\d|\\[|px|full|auto)`
        ),
        message: 'Physical offset breaks RTL. Use start-* / end-*.',
    },
    {
        re: new RegExp(
            `${BOUNDARY}(?:rounded|border)-(?:l|r|tl|tr|bl|br)(?:-|\\b)`
        ),
        message: 'Physical corner/border breaks RTL. Use the s/e/ss/se/es/ee variants.',
    },
]

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
    meta: {
        type: 'problem',
        schema: [
            {
                type: 'object',
                properties: {
                    colors: { type: 'boolean' },
                    direction: { type: 'boolean' },
                },
                additionalProperties: false,
            },
        ],
    },
    create(context) {
        const { colors = true, direction = true } = context.options[0] ?? {}
        const checks = [
            ...(colors ? colorChecks : []),
            ...(direction ? directionChecks : []),
        ]

        const check = (node, text) => {
            if (typeof text !== 'string') return
            for (const { re, message } of checks) {
                if (re.test(text)) context.report({ node, message })
            }
        }

        return {
            Literal: (node) => check(node, node.value),
            TemplateElement: (node) => check(node, node.value.cooked),
        }
    },
}

const plugin = { rules: { 'no-hardcoded-styles': rule } }

export default plugin
