import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://docs.ido4.dev',
  integrations: [
    starlight({
      title: 'ido4',
      description: 'AI-hybrid software development at scale. Context intelligence, institutional memory, and deterministic governance.',
      favicon: '/favicon.svg',
      logo: {
        src: './src/assets/logo.svg',
        alt: 'ido4',
      },
      customCss: ['./src/styles/custom.css'],
      lastUpdated: true,
      social: [
        { icon: 'external', label: 'ido4.dev', href: 'https://ido4.dev' },
        { icon: 'github', label: 'GitHub', href: 'https://github.com/ido4-dev/ido4' },
      ],
      editLink: {
        baseUrl: 'https://github.com/ido4-dev/ido4/edit/main/docs/src/content/docs/',
      },
      head: [
        { tag: 'meta', attrs: { property: 'og:image', content: 'https://docs.ido4.dev/og-image.png' } },
      ],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Introduction', link: '/' },
            { label: 'Installation', slug: 'getting-started/installation' },
            { label: 'Quick Start', slug: 'getting-started/quick-start' },
            { label: 'Sandbox Demo', slug: 'getting-started/sandbox' },
          ],
        },
        {
          label: 'Core Concepts',
          items: [
            { label: 'Methodologies', slug: 'concepts/methodologies' },
            { label: 'Containers', slug: 'concepts/containers' },
            { label: 'Governance Principles', slug: 'concepts/governance-principles' },
            { label: 'Business Rule Engine', slug: 'concepts/business-rule-engine' },
            { label: 'Multi-Agent Coordination', slug: 'concepts/multi-agent' },
            { label: 'Audit Trail & Compliance', slug: 'concepts/audit-compliance' },
            { label: 'Glossary', slug: 'concepts/glossary' },
          ],
        },
        {
          label: 'Architecture',
          items: [
            { label: 'System Overview', slug: 'architecture/overview' },
          ],
        },
        {
          label: 'Tool Reference',
          items: [
            { label: 'All Tools', slug: 'reference/tools' },
          ],
        },
        {
          label: 'Skills & Intelligence',
          items: [
            { label: 'Skills Overview', slug: 'skills/overview' },
            { label: '/standup', slug: 'skills/standup' },
            { label: '/plan-wave, /plan-sprint, /plan-cycle', slug: 'skills/planning' },
            { label: '/board', slug: 'skills/board' },
            { label: '/compliance', slug: 'skills/compliance' },
            { label: '/retro, /retro-sprint, /retro-cycle', slug: 'skills/retro' },
            { label: '/health', slug: 'skills/health' },
            { label: '/sandbox', slug: 'skills/sandbox' },
            { label: '/decompose', slug: 'skills/decompose' },
            { label: '/spec-validate', slug: 'skills/spec-validate' },
            { label: '/pilot-test', slug: 'skills/pilot-test' },
            { label: 'MCP Prompts', slug: 'skills/prompts' },
            { label: 'PM Agent', slug: 'skills/pm-agent' },
          ],
        },
        {
          label: 'Enterprise',
          items: [
            { label: 'Overview', slug: 'enterprise/overview' },
            { label: 'Compliance Reporting', slug: 'enterprise/compliance' },
            { label: 'Configurable Methodology', slug: 'enterprise/methodology' },
            { label: 'Quality Gates', slug: 'enterprise/quality-gates' },
            { label: 'Audit Trail', slug: 'enterprise/audit-trail' },
          ],
        },
      ],
    }),
  ],
});
