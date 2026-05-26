---
title: "/refine-spec"
description: "Edit an existing strategic spec using natural-language instructions. Surfaces ripple effects before applying, re-validates after every edit pass."
---

`/refine-spec` applies edits to an existing strategic spec from natural-language instructions. It's the post-synthesis editing skill — for adding capabilities, splitting groups, changing dependencies, integrating new stakeholder input, or fixing issues surfaced by `/validate-spec` or `/review-spec`.

The skill surfaces ripple effects before making changes, validates after every edit, and explains what was changed.

## When to use

- **After validation surfaced format or content issues** — A1 to A12 findings that you want addressed in-place rather than by re-synthesis
- **After review surfaced specific recommendations** — applying the dependency auditor's suggestions, integrating the technical reviewer's feasibility notes
- **When a stakeholder brings new input mid-project** — "the architect says...", "per the security review...", "QA flagged that..."
- **For structural changes** — splitting a group that's grown too large, merging overlapping groups, renaming for clarity
- **For dependency adjustments** — when conversation reveals that NCO-03 should depend on NCO-02, not NCO-01

For **large structural rewrites** (e.g., re-thinking 60% of the capability structure), re-running `/synthesize-spec` against an updated canvas is cleaner than refining. Refine is for surgical edits.

## Invocation

In Cowork:
```
/refine-spec my-project-spec.md
```

In Claude Code:
```
/ido4shape:refine-spec my-project-spec.md
```

The argument is the spec file path. Then you tell the skill what to change in natural language:

```
> /refine-spec notification-system-spec.md
> Add a capability under Channels for delivery retry logic — the architect
> flagged that we need exponential backoff on transient failures.
```

The skill applies the edit and re-validates.

## Refinement types

The skill recognizes (and handles correctly) several common edit patterns:

**Adding a capability.** Determines the right group from context, uses the group's prefix with the next available number, writes a substantive description (≥200 chars with stakeholder context), adds success conditions, sets priority and strategic risk, sets `depends_on`. Updates any existing capabilities that should depend on the new one.

**Removing a capability.** Checks if anything depends on it. Warns about orphaned dependencies and asks how to resolve them (move to a different target, or drop the dependency entirely).

**Splitting a group.** Creates two groups with new names and prefixes, reassigns capabilities, updates all `depends_on` references. Surfaces that the three capabilities sharing the old prefix need new prefixes, and that previously-internal dependencies are now cross-group.

**Merging groups.** Chooses the surviving prefix, reassigns capabilities, updates references.

**Changing dependencies.** Verifies the new target exists. Checks for circular dependencies *after* the change. If the edit would introduce a cycle, the skill rolls back and explains why.

**Adding stakeholder context.** When you say *"per the architect: ..."* or *"the security review found ..."*, the skill integrates the input into the relevant capability description, cross-cutting concerns, or constraints. Attribution stays in the file — *"Per the architect: ..."* — so downstream readers can see whose judgment is reflected where.

**Adding cross-cutting concerns.** New NFRs, security requirements, or performance targets go into the Cross-Cutting Concerns section at the project level, not on individual capabilities (unless genuinely specific to one).

## Ripple effects

Before applying any edit, the skill surfaces what else will change:

```
> If we split the Notifications group, three capabilities sharing prefix NCO-
> will need new prefixes. NCO-03's dependency on NCO-01 becomes a cross-group
> dependency. Is that what you want?
```

This is the heart of the skill — it's easy to make a surface edit that breaks invariants elsewhere. Confirming ripple effects first prevents corruption.

## Auto-revalidation

After every edit pass, the skill runs the bundled `@ido4/spec-format` parser. If the edit broke something structurally:

- It tells you immediately (not at the next `validate-spec` run)
- It surfaces what specifically broke (a dependency ref no longer resolves, a duplicate ID was introduced, a circular dependency)
- It typically rolls back and asks how to proceed

This is the same parser-as-seam pattern used by `/synthesize-spec`'s post-composition validation — structural drift is caught at edit time, not later.

## Format compliance

The skill knows the strategic-spec format rules:

- Capability IDs must use zero-padded 2-digit numbers (`PREFIX-01`, not `PREFIX-1`)
- Group headings must use `## Group:` prefix
- All metadata uses blockquote syntax (`> priority: ...`)
- Only `## Group:` and `## Cross-Cutting Concerns` are allowed as H2 sections at the body level

When fixing format issues, it identifies the pattern (e.g., all IDs missing zero-padding) and fixes ALL instances in one pass — not one at a time. That's both cheaper and safer (less risk of partial edits creating internal inconsistency).

## What refine-spec does NOT do

- **Doesn't edit technical specs.** This skill is strategic-spec-only. The technical spec format has different rules. The companion `ido4specs` plugin has its own `/refine-spec` for technical specs — they share the name but operate on different artifacts.
- **Doesn't add downstream metadata.** No `effort`, `type`, `ai`, or `size` fields. Those belong in the technical spec.
- **Doesn't restructure the entire spec.** For wholesale rewrites, re-synthesizing from an updated canvas is cleaner.

## Common failures

- **Refine introduced a cycle.** The skill catches it and rolls back. Look at the data/control flow described in the affected capabilities — the cycle usually means a dependency direction is wrong.
- **Refine references a capability that doesn't exist.** Typo or wrong target. The skill suggests the closest match.
- **Skill won't apply an edit because the canvas still has it differently.** Strategic refinements that contradict the canvas create downstream drift. The skill may suggest updating the canvas first via `/create-spec` and then re-synthesizing, rather than diverging the spec.

## Related

- [`/validate-spec`](../validate-spec/) — find what to fix
- [`/review-spec`](../review-spec/) — get recommendations to apply
- [`/synthesize-spec`](../synthesize-spec/) — for large rewrites, re-synthesize from the canvas
- [`/create-spec`](../create-spec/) — for canvas-level edits that should propagate forward
