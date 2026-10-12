/**
 * Brain module exports.
 */

export { BRAIN_CONFIG, SHADOW_MODE, PUSHBACK_THRESHOLD } from './config';

export {
  verifyTelnyxSignature,
  parseClientState,
  mapTelnyxEventToChannel,
  mapTelnyxEventToStatus,
  type TelnyxSignatureResult,
  type TelnyxPayload,
  type TelnyxEventType,
} from './telnyx';

export {
  verifyElevenLabsSignature,
  parseElevenLabsDynamicVariables,
  formatTranscript,
  type ElevenLabsSignatureResult,
  type ElevenLabsPostCallPayload,
} from './elevenlabs';

export {
  insertBrainVendorEvent,
  upsertVendorIncident,
  markResolvedIncidents,
  insertBrainRun,
  updateBrainRun,
  insertBrainLesson,
  getApprovedLessons,
  getRecentFailedEvents,
  getOpenIncidents,
  getEventTranscript,
  getEventStats,
  type BrainVendorEvent,
  type VendorIncident,
  type BrainRun,
  type BrainLesson,
} from './repository';

export { fetchVendorStatus, fetchAllVendorStatuses, type VendorStatusResult } from './vendor-status';

export { runHealthCheck, type HealthCheckResult } from './health-check';

export { TOOL_DEFINITIONS, executeTool, type BrainToolCall } from './tools';

export { runDailyDigest, type DigestResult } from './digest';

export {
  runGuardrails,
  checkOtdThreshold,
  computeOtdThreshold,
  applyPlaybookRules,
  getAiDisclosure,
  getPriceFirstResponse,
  type GuardrailInput,
  type GuardrailResult,
  type PlaybookDecision,
} from './guardrails';

export {
  type TelnyxEmailPayload,
} from './telnyx';

export { runReplyDecision, type ReplyDecisionInput, type ReplyDecisionResult } from './reply-decision';
