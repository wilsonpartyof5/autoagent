/**
 * Brain module exports.
 */

export {
  BRAIN_CONFIG,
  SHADOW_MODE,
  PUSHBACK_THRESHOLD,
  DEFAULT_OPENAI_MODEL,
  DEFAULT_OPENAI_FALLBACK_MODEL,
  DEFAULT_OPENAI_FAST_MODEL,
  shadowModeFromEnv,
} from './config';

export { estimateCost, MODEL_RATES, rateForModel } from './cost';

export { computeOtd, emptyQuote, QUOTE_FIELDS, type ExtractedQuote, type OtdComputation } from './quote';

export { routeDealerMessage, type RouteDecision } from './routing';

export {
  verifyTelnyxSignature,
  parseClientState,
  mapTelnyxEventToChannel,
  mapTelnyxEventToStatus,
  stripHtml,
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

export { TOOL_DEFINITIONS, RESPONSE_TOOLS, executeTool, type BrainToolCall } from './tools';

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

export {
  recordEmailOptout,
  isEmailOptedOut,
  getEmailOptout,
  checkEmailBeforeSend,
  endDealOnOptout,
  type EmailOptout,
  type EmailOptoutReason,
  type EmailSendCheckResult,
  type EndDealOnOptoutResult,
} from './email-optout';
