/**
 * Shared technical spec content for all sandbox scenarios.
 *
 * The same technical spec is ingested with different methodology profiles.
 * This demonstrates methodology-agnosticism: same project, different governance.
 * The spec is loaded at build time from the ido4-demo repository.
 *
 * If the demo codebase is not available, this inline content serves as the
 * deterministic fallback. It matches the format expected by spec-parser.ts:
 * ## Capability: headings with ### PREFIX-NN: task headings.
 */

export const TECHNICAL_SPEC_CONTENT = `# Notification Platform — Technical Spec

> Technical decomposition of the notification platform API. Derived from the strategic
> spec and grounded in the existing codebase. The auth module, event model, event bus,
> template engine, template store, and channel registry are complete. This spec covers
> the remaining implementation work.

**Constraints:**
- No external infrastructure dependencies — use in-memory stores
- Must maintain existing auth API contract
- TypeScript strict mode — all strict compiler flags enabled
- All channel providers must implement IChannelProvider from src/channels/channel-registry.ts
- Follow the service pattern established in src/auth/auth-service.ts

**Non-goals:**
- Frontend UI or dashboard
- Real-time WebSocket delivery
- Message queue infrastructure

---

## Capability: Notification Core
> size: L | risk: medium

The backbone of the delivery pipeline. The event model and event bus are complete.
The delivery engine, retry policy, and status tracking need implementation.
This is the critical path — downstream tasks depend on this capability.

### NCO-01: Delivery Engine Core
> effort: L | risk: medium | type: feature | ai: assisted
> depends_on: -

Complete the delivery engine at src/notifications/delivery-engine.ts. The IDeliveryEngine
interface and class skeleton exist. The deliver() method must orchestrate multi-channel
delivery: validate incoming events, resolve target channels from the ChannelRegistry,
dispatch to each channel provider, and handle failures through the retry policy.

**Success conditions:**
- deliver() processes a NotificationEvent and returns DeliveryResult[] per channel
- Channel resolution uses ChannelRegistry to find supporting providers
- Failed deliveries are passed to RetryPolicy before marking as failed
- Delivery status events are emitted on the notification event bus
- Error handling follows AppError/DeliveryError patterns

### NCO-02: Retry Policy Implementation
> effort: M | risk: low | type: feature | ai: full
> depends_on: NCO-01

Implement the retry policy at src/notifications/retry-policy.ts. Exponential backoff
with configurable parameters from RetryConfig. The execute() method wraps async
functions with retry logic.

**Success conditions:**
- shouldRetry() checks attempt count and error retryability
- getDelay() implements exponential backoff capped at maxDelayMs
- execute() retries failed operations with computed delays
- Non-retryable errors thrown immediately
- DEFAULT_RETRY_CONFIG used when no custom config provided

### NCO-03: Delivery Status Tracking
> effort: M | risk: low | type: feature | ai: full
> depends_on: NCO-01

Add delivery status persistence to the delivery engine using in-memory Map storage.
Track each delivery attempt with result, expose via getDeliveryStatus(), and
update getStats() with accurate aggregate counts.

**Success conditions:**
- Every delivery attempt recorded with timestamp, channel, status
- getDeliveryStatus() returns full history for a notification ID
- getStats() returns accurate counts
- Channel health derived from recent delivery results

### NCO-04: Idempotency Guard
> effort: S | risk: low | type: feature | ai: full
> depends_on: NCO-01

Add idempotency checking to the delivery engine. Check idempotencyKey against
previously processed keys before dispatching. Return cached results for duplicates.

**Success conditions:**
- Duplicate events return cached results without re-delivery
- First delivery proceeds normally and caches result
- Cache is bounded with configurable max size

---

## Capability: Channel Providers
> size: L | risk: low

Four channel providers implementing IChannelProvider. Each has a stub class
in src/channels/providers/. All four are parallelizable once NCO-01 is complete.

### CHP-01: Email Provider
> effort: M | risk: low | type: feature | ai: full
> depends_on: NCO-01

Implement email provider at src/channels/providers/email.ts. Format notifications
as HTML email with subject lines. Handle bounce/rejection/timeout as DeliveryError.

**Success conditions:**
- send() formats notification as email with subject and HTML body
- supports() returns true for email-relevant event types
- healthCheck() returns ChannelHealth with latency
- Permanent bounces produce non-retryable DeliveryError
- Transient failures produce retryable DeliveryError

### CHP-02: SMS Provider
> effort: M | risk: medium | type: feature | ai: full
> depends_on: NCO-01

Implement SMS provider at src/channels/providers/sms.ts. Format as plain text
within 160-character limits with truncation indicator.

**Success conditions:**
- send() formats notification within 160-character limit
- Long messages truncated with ellipsis
- supports() returns true for SMS-relevant types
- healthCheck() validates connectivity
- Per-recipient rate limiting prevents abuse

### CHP-03: Push Notification Provider
> effort: M | risk: medium | type: feature | ai: full
> depends_on: NCO-01

Implement push provider at src/channels/providers/push.ts. Format as JSON
payload with title, body, data following FCM conventions. Respect 4KB limit.

**Success conditions:**
- send() formats as push payload with title, body, data
- Payload respects 4KB size limit
- supports() checks against push-enabled types
- healthCheck() validates push service connectivity
- Invalid device tokens produce non-retryable error

### CHP-04: Webhook Provider
> effort: M | risk: low | type: feature | ai: full
> depends_on: NCO-01

Implement webhook provider at src/channels/providers/webhook.ts. Deliver as
HTTP POST with configurable headers. Map response codes to delivery status.

**Success conditions:**
- send() delivers as JSON POST to configured URL
- Configurable HTTP headers for authentication
- Timeout handling for slow endpoints
- 2xx = delivered, 4xx = failed permanent, 5xx = failed retryable
- supports() returns true for all event types

---

## Capability: Template System
> size: M | risk: low

Template engine and store are complete. Renderer needs implementation to
connect templates to the delivery pipeline with channel-specific formatting.

### TMP-01: Template Renderer
> effort: M | risk: low | type: feature | ai: assisted
> depends_on: NCO-01

Complete renderer at src/templates/renderer.ts. Retrieve template from store,
compile with engine, format output for target channel (HTML/text/JSON).

**Success conditions:**
- render() retrieves, compiles, and formats for channel
- Channel-specific: HTML for email, text for SMS, JSON for push
- Subject line rendering for email
- Render timing tracked in RenderResult
- Missing variables produce ValidationError

### TMP-02: Template Preview API
> effort: S | risk: low | type: feature | ai: full
> depends_on: TMP-01

Implement renderPreview() to render across all channel formats simultaneously.
Local rendering only — no channel providers required.

**Success conditions:**
- renderPreview() renders for all channel types
- Returns partial record with applicable channels
- No channel providers required
- Includes timing per channel

---

## Capability: Analytics
> size: M | risk: low

Delivery analytics module at src/analytics/. Subscribes to event bus
for real-time tracking and metric computation.

### ANL-01: Delivery Event Tracking
> effort: M | risk: low | type: feature | ai: full
> depends_on: NCO-01

Create analytics service subscribing to delivery events on the notification
event bus. Track per-channel and per-event-type delivery counts and latency.

**Success conditions:**
- Subscribes to delivery events on notification event bus
- Tracks per-channel delivery counts
- Tracks per-event-type counts
- Records delivery latency
- In-memory storage with configurable retention

### ANL-02: Delivery Metrics Aggregation
> effort: M | risk: low | type: feature | ai: full
> depends_on: ANL-01

Add metric computation: success rates, average latency, channel health
scores, and time-windowed metrics.

**Success conditions:**
- Computes delivery success rate per channel
- Computes average latency per channel
- Identifies degraded channels
- Time-windowed metrics (hour, day)
- Queryable interface

---

## Capability: API Layer
> size: M | risk: low

Complete the HTTP API. Auth routes done. Notification sending, rate
limiting, and template rendering endpoints need implementation.

### API-01: Notification Send Endpoint
> effort: S | risk: low | type: feature | ai: full
> depends_on: NCO-01

Complete POST /notifications/send at src/api/routes/notifications.ts.
Validate, create event, call deliveryEngine.deliver(), return results.

**Success conditions:**
- POST /notifications/send accepts event payload
- Body validated using event-model schemas
- Calls deliveryEngine.deliver()
- Returns 400 for validation, 500 for delivery failures
- Success includes per-channel delivery status

### API-02: Rate Limiting Middleware
> effort: M | risk: low | type: infrastructure | ai: full
> depends_on: -

Implement rate limiter at src/api/middleware/rate-limiter.ts. Sliding window
with per-user limits and X-RateLimit-* response headers.

**Success conditions:**
- Enforces per-user request limits
- Returns 429 with Retry-After when exceeded
- X-RateLimit headers on every response
- Sliding window algorithm
- In-memory state

### API-03: Template Rendering Endpoint
> effort: S | risk: low | type: feature | ai: full
> depends_on: TMP-01

Add POST /templates/:id/render endpoint. Accept channel and variables,
call renderer.render(), return rendered output with timing.

**Success conditions:**
- POST /templates/:id/render accepts channel and variables
- Validates template exists and variables provided
- Returns rendered output with timing
- 400 for missing variables, 404 for unknown template

---

## Capability: External Integrations
> size: M | risk: medium

Third-party integration support at src/integrations/. Longest dependency
chain: INT-02 depends on INT-01 which depends on NCO-01 + CHP-04.

### INT-01: Webhook Delivery System
> effort: L | risk: medium | type: feature | ai: assisted
> depends_on: NCO-01, CHP-04

Build webhook delivery system at src/integrations/. Register endpoints,
deliver via webhook provider, retry failures, track confirmations.

**Success conditions:**
- Register webhook endpoints with URL and auth config
- Deliver events via webhook provider
- Retry failed deliveries with backoff
- Track delivery confirmations per endpoint
- Enable/disable endpoints without deletion

### INT-02: Integration Registry
> effort: M | risk: low | type: feature | ai: full
> depends_on: INT-01

Create integration registry for third-party configs. CRUD, auth management,
event type filtering, health monitoring.

**Success conditions:**
- CRUD for integration configurations
- Event type filtering per integration
- Auth support (API key, bearer token, headers)
- Health monitoring from delivery success
- List integrations with health status
`;
