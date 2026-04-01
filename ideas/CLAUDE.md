# Ideas Backlog — Instructions

## Format

Every idea file must have YAML frontmatter:

```yaml
---
date: 2026-04-01
status: idea
category: platform
---
```

- `date` — When the idea was captured (absolute date, never relative)
- `status` — One of: `idea`, `exploring`, `ready`, `parked`, `rejected`
- `category` — One of: `platform`, `integration`, `governance`, `experience`

## File Naming

Kebab-case, descriptive: `context-condensation.md`, `stuck-detection.md`. No prefixes, no numbering.

## Before Creating a New Idea

1. Read the existing files in this directory to check for duplicates or overlaps
2. If an existing idea covers the same ground, update it instead of creating a new file
3. If the new idea connects to existing ones, add `Connects to:` references in both directions

## Status Lifecycle

- New ideas start as `idea` unless research has already been done (then `exploring`)
- Never set `ready` without explicit user confirmation — that signals prioritization intent
- When rejecting, keep the file and explain why in the body (decisions are context)
- `parked` means "good idea, wrong time" — include a note on what would change the timing

## Content Guidelines

- Lead with what the idea IS, not why it matters (motivation comes second)
- Include concrete examples or prior art when available
- Note connections to other ideas, architecture decisions, or external systems
- Keep it concise — an idea file is a parking lot, not a design doc
