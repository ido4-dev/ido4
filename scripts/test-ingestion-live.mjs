#!/usr/bin/env node
/**
 * Live ingestion test — creates a sandbox, runs ingest_spec, verifies, cleans up.
 *
 * Usage: GITHUB_TOKEN=$(gh auth token) node scripts/test-ingestion-live.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Dynamic import of built packages
const core = await import(path.join(projectRoot, 'packages/core/dist/index.js'));

const REPOSITORY = 'b-coman/ido4-test';
const SCENARIO = 'hydro-governance';

// Technical spec fixture for live ingestion testing. Reads the canonical CI
// smoke-test fixture at tests/fixtures/technical-spec-sample.md — the same
// file @ido4/tech-spec-format's CI uses. Previously sourced from
// architecture/spec-artifact-format.md, which was moved to
// ido4specs/references/technical-spec-format.md during Phase 9 of the
// ido4specs extraction (2026-04-14).
const SPEC_CONTENT = fs.readFileSync(
  path.join(projectRoot, 'tests/fixtures/technical-spec-sample.md'),
  'utf-8'
);

const logger = new core.ConsoleLogger({ component: 'live-test' });

async function main() {
  console.log('=== Live Ingestion Test ===\n');
  console.log(`Repository: ${REPOSITORY}`);
  console.log(`Project root: ${projectRoot}\n`);

  // Step 1: Create sandbox (initializes project with fields)
  console.log('--- Step 1: Creating sandbox ---');
  const credentialManager = new core.CredentialManager(logger);
  const graphqlClient = new core.GitHubGraphQLClient(credentialManager, logger);
  const sandboxService = new core.SandboxService(graphqlClient, logger);

  let sandboxResult;
  try {
    sandboxResult = await sandboxService.createSandbox({
      repository: REPOSITORY,
      projectRoot,
      scenarioId: SCENARIO,
    });
    console.log(`Sandbox created: ${sandboxResult.project.url}`);
    console.log(`  Tasks: ${sandboxResult.created.tasks}, Capabilities: ${sandboxResult.created.capabilities}\n`);
  } catch (err) {
    console.error('Failed to create sandbox:', err.message);
    process.exit(1);
  }

  // Step 2: Initialize ServiceContainer from the sandbox config
  console.log('--- Step 2: Initializing container ---');
  let container;
  try {
    container = await core.ServiceContainer.create({ projectRoot, logger });
    console.log(`Container ready. Profile: ${container.profile.id}\n`);
  } catch (err) {
    console.error('Failed to init container:', err.message);
    await cleanup(sandboxService, projectRoot);
    process.exit(1);
  }

  // Step 3: Dry run first
  console.log('--- Step 3: Dry run ---');
  const ingestionService = new core.IngestionService(
    container.taskService,
    container.issueRepository,
    container.projectRepository,
    container.profile,
    logger,
  );

  let dryResult;
  try {
    dryResult = await ingestionService.ingestSpec({
      specContent: SPEC_CONTENT,
      dryRun: true,
      profile: container.profile,
    });
    console.log(`Parsed: ${dryResult.parsed.projectName}`);
    console.log(`  Groups: ${dryResult.parsed.groupCount}`);
    console.log(`  Tasks: ${dryResult.parsed.taskCount}`);
    console.log(`  Parse errors: ${dryResult.parsed.parseErrors.length}`);
    console.log(`  Would create: ${dryResult.created.totalIssues} issues`);
    console.log(`  Mapping warnings: ${dryResult.warnings.length}`);
    if (dryResult.warnings.length > 0) {
      for (const w of dryResult.warnings) console.log(`    - ${w}`);
    }
    console.log(`  Suggestions:`);
    for (const s of dryResult.suggestions) console.log(`    - ${s}`);
    console.log();
  } catch (err) {
    console.error('Dry run failed:', err.message);
    await cleanup(sandboxService, projectRoot);
    process.exit(1);
  }

  // Step 4: Live ingestion
  console.log('--- Step 4: Live ingestion ---');
  let liveResult;
  try {
    liveResult = await ingestionService.ingestSpec({
      specContent: SPEC_CONTENT,
      dryRun: false,
      profile: container.profile,
    });
    console.log(`Success: ${liveResult.success}`);
    console.log(`Created:`);
    console.log(`  Group issues: ${liveResult.created.groupIssues.length}`);
    for (const g of liveResult.created.groupIssues) {
      console.log(`    #${g.issueNumber}: ${g.title} — ${g.url}`);
    }
    console.log(`  Tasks: ${liveResult.created.tasks.length}`);
    for (const t of liveResult.created.tasks) {
      console.log(`    #${t.issueNumber}: ${t.ref} ${t.title} [deps: ${t.dependsOn.join(', ') || 'none'}] — ${t.url}`);
    }
    console.log(`  Sub-issue relationships: ${liveResult.created.subIssueRelationships}`);
    console.log(`  Total issues: ${liveResult.created.totalIssues}`);
    if (liveResult.failed.length > 0) {
      console.log(`  FAILED: ${liveResult.failed.length}`);
      for (const f of liveResult.failed) console.log(`    ${f.ref}: ${f.error}`);
    }
    console.log(`  Warnings: ${liveResult.warnings.length}`);
    console.log(`  Suggestions:`);
    for (const s of liveResult.suggestions) console.log(`    - ${s}`);
    console.log();
  } catch (err) {
    console.error('Live ingestion failed:', err.message, err.stack);
    await cleanup(sandboxService, projectRoot);
    process.exit(1);
  }

  // Step 5: Verification — read back a couple of created tasks
  console.log('--- Step 5: Verification ---');
  try {
    if (liveResult.created.tasks.length > 0) {
      const firstTask = liveResult.created.tasks[0];
      const taskData = await container.taskService.getTask({ issueNumber: firstTask.issueNumber });
      console.log(`Verified ${firstTask.ref} (#${firstTask.issueNumber}):`);
      console.log(`  Title: ${taskData.title}`);
      console.log(`  Status: ${taskData.status}`);
      console.log(`  Effort: ${taskData.effort || 'not set'}`);
      console.log(`  Risk: ${taskData.riskLevel || 'not set'}`);
      console.log(`  AI Suitability: ${taskData.aiSuitability || 'not set'}`);
      console.log(`  Epic: ${taskData.epic || 'not set'}`);
      console.log(`  Dependencies: ${taskData.dependencies || 'none'}`);
      console.log(`  Body length: ${taskData.body?.length ?? 0} chars`);
    }
    console.log();
  } catch (err) {
    console.error('Verification failed:', err.message);
  }

  // Step 6: Cleanup
  console.log('--- Step 6: Cleanup ---');
  await cleanup(sandboxService, projectRoot);

  console.log('\n=== Live Ingestion Test Complete ===');
  console.log(`Result: ${liveResult.success ? 'SUCCESS' : 'PARTIAL FAILURE'}`);
  console.log(`Created ${liveResult.created.totalIssues} issues, ${liveResult.failed.length} failed`);
}

async function cleanup(sandboxService, projectRoot) {
  try {
    const result = await sandboxService.destroySandbox(projectRoot);
    console.log(`Sandbox destroyed: ${result.issuesClosed} issues closed, project deleted: ${result.projectDeleted}`);
  } catch (err) {
    console.error('Cleanup failed:', err.message);
    console.error('You may need to manually clean up the project on GitHub.');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
