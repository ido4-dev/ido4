# Roadmap Process

How internal ideas flow to the public roadmap on ido4.dev/roadmap.

## Architecture

```
ideas/ (ido4-MCP repo)           →  roadmap-themes.json (ido4-website repo)  →  /roadmap page
  11 idea files                       5 curated themes                            Public-facing
  Internal language                   Customer-facing language                    React component
  All statuses                        Only: shipped / in-progress / exploring     Status badges
```

Two repos, one pipeline. Ideas are the raw material. Themes are the curated output.

## Current Process (Manual)

1. **When an idea changes status** (e.g., moves from `exploring` to `ready`, or gets implemented and shipped):
   - Decide if the change affects a public theme
   - If yes, update `src/data/roadmap-themes.json` in the ido4-website repo
   - Update the theme's `status`, `description`, or `signals` as needed
   - Commit and deploy (auto-deploys on push to main via Firebase)

2. **When a new idea is captured** that maps to an existing theme:
   - No website update needed unless it changes the theme's status or signals

3. **When a new idea warrants a new theme** (rare — themes are strategic directions, not features):
   - Add a new entry to `roadmap-themes.json`
   - Update the Roadmap page if the grid layout needs adjustment

## Mapping: Internal Ideas → Public Themes

| Public Theme | Internal Ideas | Status Trigger |
|---|---|---|
| **Adaptive Governance** | governance-maturity-levels | Any level beyond L1 ships |
| **Enterprise Integrations** | signal-provider-abstraction, pluggable-quality-gates, external-auditors | Any gate or provider ships |
| **Multi-Agent Intelligence** | openhands-patterns (#3 stuck detection, #4 agent profiles, #5 context views) | Any detection or profile feature ships |
| **Institutional Memory** | context-comment-schema, execution-prompt | Schema or prompt ships |
| **Real-Time Governance** | event-driven-state-sync | Polling (step 1) ships |

## Public Status Definitions

- **Shipped** — In the current release, usable today
- **In Progress** — Actively being built, committed to
- **Exploring** — Research done, direction clear, not yet committed

Never show `idea` or `parked` publicly. Everything on the roadmap should feel intentional.

## What NOT to Put on the Public Roadmap

- Internal positioning decisions (governance-not-execution)
- Technical infrastructure (tool annotations, context compression internals)
- Host platform optimizations (claude-code-leak-analysis items)
- The roadmap process itself (public-roadmap-build-in-public)

## Future: Automated Pipeline

When update frequency justifies it, automate with a GitHub Action:

1. CI in ido4-MCP detects idea status change (frontmatter diff in `ideas/`)
2. Action triggers an LLM to:
   - Read the updated idea file
   - Read current `roadmap-themes.json`
   - Propose an update (status change, description refinement)
3. Action opens a PR on the ido4-website repo with the proposed change
4. Human reviews and merges

This preserves editorial control (PR review) while automating the translation from internal language to public messaging. Not needed until shipping monthly or faster.

## Files

| File | Repo | Purpose |
|---|---|---|
| `ideas/*.md` | ido4-MCP | Internal idea backlog (source of truth for direction) |
| `ideas/ROADMAP-PROCESS.md` | ido4-MCP | This document (process definition) |
| `src/data/roadmap-themes.json` | ido4-website | Public theme data (source of truth for website) |
| `src/pages/Roadmap.tsx` | ido4-website | Page component (reads from JSON) |
