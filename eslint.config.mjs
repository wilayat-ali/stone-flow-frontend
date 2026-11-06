import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import styles from './eslint-rules/no-hardcoded-styles.mjs'

export default defineConfig([
    ...nextVitals,
    ...nextTs,
    globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
    {
        files: ['src/**/*.{ts,tsx}'],
        plugins: { local: styles },
        rules: {
            // No hard-coded colors and no physical (non-RTL-safe) direction classes.
            'local/no-hardcoded-styles': 'error',
            'no-console': 'error',
        },
    },
    {
        // shadcn primitives: side-driven components (sidebar/sheet/drawer) are positioned
        // by their `side` prop, so physical offsets are intentional there.
        files: ['src/components/ui/**/*.tsx'],
        rules: { 'local/no-hardcoded-styles': ['error', { direction: false }] },
    },
    {
        // Recharts renders default '#ccc' / '#fff' attributes; these selectors override them.
        files: ['src/components/ui/chart.tsx'],
        rules: { 'local/no-hardcoded-styles': 'off' },
    },
])
