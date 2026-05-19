/**
 * Layer boundary rules for Phase 1.5 (imported by eslint.config.mjs).
 */

export const FEATURE_DOMAINS = [
  'account',
  'auth',
  'automations',
  'billing',
  'chat',
  'files',
  'integrations',
  'knowledge',
  'landing',
  'marketing',
  'notebook',
  'projects',
  'share',
  'tools',
]

/** Server domains that must not import sibling domains (infra paths are exempt). */
export const SERVER_DOMAINS = [
  'agent',
  'ai',
  'auth',
  'billing',
  'chat',
  'knowledge',
  'observability',
  'security',
  'storage',
  'tools',
  'web',
]

function otherFeatureImportPatterns(selfDomain) {
  return FEATURE_DOMAINS.filter((d) => d !== selfDomain).map(
    (d) => `@/features/${d}/*`,
  )
}

function otherServerImportPatterns(selfDomain) {
  return SERVER_DOMAINS.filter((d) => d !== selfDomain).map(
    (d) => `@/server/${d}/*`,
  )
}

function restrictedPatterns(groups, message) {
  return groups.map((group) => ({
    group: Array.isArray(group) ? group : [group],
    message,
  }))
}

/** @returns {import('eslint').Linter.Config[]} */
export function createArchitectureBoundaryConfigs() {
  const configs = []

  // src/app — thin routes; no direct asset/type barrel imports.
  configs.push({
    files: ['src/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: restrictedPatterns(
            ['@/assets', '@/assets/*', '@/types', '@/types/*'],
            'App routes may import @/features, @/components, @/server, @/shared, @/hooks, @/contexts, or @overlay packages only.',
          ),
        },
      ],
    },
  })

  // Cross-feature isolation (per domain). Flat config merges by override — split
  // components vs non-components so a later block does not drop cross-feature rules.
  for (const domain of FEATURE_DOMAINS) {
    const crossFeaturePatterns = restrictedPatterns(
      otherFeatureImportPatterns(domain),
      `features/${domain} must not import other feature folders. Use @/shared or lift shared UI to src/components.`,
    )
    const serverPatterns = restrictedPatterns(
      ['@/server', '@/server/*'],
      'Feature components must not import @/server. Use API routes, hooks, or @/shared.',
    )

    configs.push({
      files: [`src/features/${domain}/**/*.{ts,tsx}`],
      ignores: [`src/features/${domain}/**/components/**`],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: crossFeaturePatterns,
          },
        ],
      },
    })

    configs.push({
      files: [`src/features/${domain}/**/components/**/*.{ts,tsx}`],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [...crossFeaturePatterns, ...serverPatterns],
          },
        ],
      },
    })
  }

  // Shared components — no feature or server coupling.
  configs.push({
    files: ['src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: restrictedPatterns(
            ['@/features/*', '@/server/*'],
            'src/components is for shared UI only. Import from @/shared or pass feature UI via app/layout composition.',
          ),
        },
      ],
    },
  })

  // Post-migration src/lib — shared-only facade.
  configs.push({
    files: ['src/lib/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: restrictedPatterns(
            [
              '@/features',
              '@/features/*',
              '@/components',
              '@/components/*',
              '@/server',
              '@/server/*',
              '@/app',
              '@/app/*',
              '@/hooks',
              '@/hooks/*',
              '@/contexts',
              '@/contexts/*',
            ],
            'src/lib (legacy) may only re-export or import from @/shared.',
          ),
        },
      ],
    },
  })

  // Server domain isolation (infra: env + database remain importable from any domain).
  for (const domain of SERVER_DOMAINS) {
    configs.push({
      files: [`src/server/${domain}/**/*.{ts,tsx}`],
      rules: {
        'no-restricted-imports': [
          'warn',
          {
            patterns: restrictedPatterns(
              otherServerImportPatterns(domain),
              `Prefer not to import other src/server domains from server/${domain}. Use @/shared or a narrow facade.`,
            ),
          },
        ],
      },
    })
  }

  return configs
}
