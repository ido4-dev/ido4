---
date: 2026-03-20
status: idea
category: integration
---

# Signal Provider Abstraction

An interface for external tools to feed quality signals into ido4. A signal provider conforms to: "given this task/PR/context, what signals can you provide?" GitHub CI is one provider. CodeRabbit is another. SonarQube is another. A webhook payload is another.

Quality gates and auditors consume signals without knowing where they came from. The provider is the integration layer.

This is the natural open-core boundary: core ships with GitHub-native signal providers. Marketplace/enterprise offers pre-built integrations (CodeRabbit, SonarQube, Snyk, Datadog).

**Connects to:** pluggable-quality-gates, external-auditors
