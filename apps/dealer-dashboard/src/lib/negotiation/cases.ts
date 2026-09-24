import { randomBytes, randomUUID } from 'crypto';

import {
  assertGenericStateTool,
  assertNegotiationTransition,
  buildNegotiationEvents,
  buildVehicleMarketContext,
  isNegotiationState,
  isTerminalNegotiationState,
  makeShopperAliasCode,
  NEGOTIATION_STATES,
  projectCaseForDealer,
  redactUnknown,
  selectActivePolicy,
  signalsFromListing,
  type DealerNegotiationView,
  type NegotiationActor,
  type NegotiationEventDraft,
  type NegotiationPolicyRecord,
  type NegotiationPolicyRules,
  type MarketPosition,
  type NegotiationState,
  type ShopperMandate,
  type ShopperMandateInput,
  NegotiationRuleError,
} from '@autoagent/shared';

import { createAdminClient } from '@/lib/supabase/admin';

export class NegotiationError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = 'NegotiationError';
  }
}

export type ShopperNegotiationView = {
  negotiationCaseId: string;
  consumerUserId: string;
  shopperAlias: string;
  listingId: string;
  vin: string | null;
  dealershipId: string;
  state: NegotiationState;
  outcome: string | null;
  policyVersion: number;
  mandate: ShopperMandate | null;
  market: DealerNegotiationView['market'];
  createdAt: string;
};

type AdminClient = ReturnType<typeof createAdminClient>;

type MandateRow = {
  version: number;
  timing: string | null;
  max_price: number | string | null;
  max_otd: number | string | null;
  payment_preference: string | null;
  down_payment: number | string | null;
  financing_preference: string | null;
  trade_in: string | null;
  must_haves: string[] | null;
  deal_breakers: string[] | null;
  add_on_tolerance: string | null;
  questions: string[] | null;
  travel: string | null;
  buy_now_readiness: string | null;
  approved_at: string | null;
};

type ContextRow = {
  id: string;
  asking_price: number | string | null;
  days_on_market: number | null;
  local_median: number | string | null;
  price_vs_median: number | string | null;
  market_position: MarketPosition;
  confidence: 'low' | 'medium' | 'high';
  generated_at: string;
};

type CaseRow = {
  id: string;
  consumer_user_id: string;
  listing_id: string;
  vin: string | null;
  dealership_id: string;
  state: string;
  outcome: string | null;
  policy_id: string;
  policy_version: number;
  market_context_id: string | null;
  created_at: string;
  shopper_aliases: { public_code: string } | { public_code: string }[] | null;
  shopper_mandates: MandateRow[] | null;
  vehicle_market_contexts: ContextRow[] | null;
};

const CASE_COLUMNS = `
  id,
  consumer_user_id,
  listing_id,
  vin,
  dealership_id,
  state,
  outcome,
  policy_id,
  policy_version,
  market_context_id,
  created_at,
  shopper_aliases(public_code),
  shopper_mandates(
    version,
    timing,
    max_price,
    max_otd,
    payment_preference,
    down_payment,
    financing_preference,
    trade_in,
    must_haves,
    deal_breakers,
    add_on_tolerance,
    questions,
    travel,
    buy_now_readiness,
    approved_at
  ),
  vehicle_market_contexts!vehicle_market_contexts_negotiation_case_id_fkey(
    id,
    asking_price,
    days_on_market,
    local_median,
    price_vs_median,
    market_position,
    confidence,
    generated_at
  )
`;

export async function createNegotiationCase(input: {
  consumerUserId: string;
  listingId: string;
  idempotencyKey?: string | null;
}): Promise<ShopperNegotiationView> {
  const listingId = requiredText(input.listingId, 'listingId', 200);
  const idempotencyKey = optionalKey(input.idempotencyKey) ?? randomUUID();
  const admin = createAdminClient();
  const existing = await findActionCase(admin, input.consumerUserId, 'create_negotiation_case', idempotencyKey);
  if (existing) return getNegotiationCase(input.consumerUserId, existing);

  const listing = await loadListing(admin, listingId);
  if (!listing.dealership_id) {
    throw new NegotiationError(
      'This vehicle is not assigned to a Drevvy dealer yet.',
      422,
      'listing_unassigned',
    );
  }
  const policy = await loadActivePolicy(admin);
  const alias = await ensureAlias(admin, input.consumerUserId);
  const previous = await latestAskingPrice(admin, listing.id);
  const history = Array.isArray(listing.uvs_data?.pricing?.priceChangeHistory)
    ? listing.uvs_data.pricing.priceChangeHistory.length
    : 0;
  const market = buildVehicleMarketContext(signalsFromListing({
    id: listing.id,
    price: asNumber(listing.price),
    daysOnMarket: listing.days_on_market,
    mileage: asNumber(listing.miles),
    availability: listing.availability_status,
    priceChangeCount: history,
    marketAveragePrice: asNumber(listing.uvs_data?.marketData?.marketAveragePrice),
    similarListings: listing.uvs_data?.marketData?.similarListings ?? null,
    previousAskingPrice: previous,
  }));

  const { data: created, error: createError } = await admin
    .from('negotiation_cases')
    .insert({
      consumer_user_id: input.consumerUserId,
      shopper_alias_id: alias.id,
      listing_id: listing.id,
      vin: listing.vin ? String(listing.vin).toUpperCase() : null,
      dealership_id: listing.dealership_id,
      policy_id: policy.id,
      policy_version: policy.version,
      state: 'draft',
    })
    .select('id')
    .single();
  if (createError) {
    if (createError.code === '23505') {
      const open = await findOpenCase(admin, input.consumerUserId, listing.id);
      if (open) return getNegotiationCase(input.consumerUserId, open);
    }
    throw storageError(createError.message);
  }

  const { data: context, error: contextError } = await admin
    .from('vehicle_market_contexts')
    .insert({
      listing_id: listing.id,
      negotiation_case_id: created.id,
      asking_price: market.askingPrice,
      days_on_market: market.daysOnMarket,
      price_change_count: market.priceChangeCount,
      local_comp_count: market.localCompCount,
      local_median: market.localMedian,
      price_vs_median: market.priceVsMedian,
      mileage_vs_median: market.mileageVsMedian,
      market_position: market.marketPosition,
      confidence: market.confidence,
      feature_version: market.featureVersion,
    })
    .select('id')
    .single();
  if (contextError) throw storageError(contextError.message);

  const { error: pointerError } = await admin
    .from('negotiation_cases')
    .update({ market_context_id: context.id })
    .eq('id', created.id);
  if (pointerError) throw storageError(pointerError.message);

  await insertStateEvent(admin, {
    caseId: created.id,
    consumerUserId: input.consumerUserId,
    from: null,
    to: 'draft',
    actor: 'system',
    reason: 'case_opened',
    policyVersion: policy.version,
  });
  await insertAction(admin, {
    caseId: created.id,
    consumerUserId: input.consumerUserId,
    toolName: 'create_negotiation_case',
    idempotencyKey,
    policy,
    marketContextId: context.id,
    input: { listingId: listing.id },
    output: { state: 'draft' },
  });
  await recordNegotiationEvents(buildNegotiationEvents({
    negotiationCaseId: created.id,
    consumerUserId: input.consumerUserId,
    listingId: listing.id,
    vin: listing.vin ? String(listing.vin).toUpperCase() : null,
    dealershipId: listing.dealership_id,
    policyVersion: policy.version,
    from: null,
    to: 'draft',
    includeCreated: true,
    includeMandateApproved: false,
    market,
  }));
  return getNegotiationCase(input.consumerUserId, created.id);
}

export async function listNegotiationCases(consumerUserId: string): Promise<ShopperNegotiationView[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('negotiation_cases')
    .select(CASE_COLUMNS)
    .eq('consumer_user_id', consumerUserId)
    .order('created_at', { ascending: false });
  if (error) throw storageError(error.message);
  return (data ?? []).map((row) => toShopperView(row as unknown as CaseRow));
}

export async function getNegotiationCase(
  consumerUserId: string,
  caseId: string,
): Promise<ShopperNegotiationView> {
  const admin = createAdminClient();
  const row = await loadOwnedCase(admin, consumerUserId, caseId);
  return toShopperView(row);
}

export async function saveShopperMandate(input: {
  consumerUserId: string;
  caseId: string;
  mandate: unknown;
  idempotencyKey?: string | null;
}): Promise<ShopperNegotiationView> {
  const idempotencyKey = requiredKey(input.idempotencyKey);
  const mandate = parseMandate(input.mandate);
  const admin = createAdminClient();
  const existing = await findActionCase(admin, input.consumerUserId, 'save_shopper_mandate', idempotencyKey);
  if (existing) return getNegotiationCase(input.consumerUserId, existing);

  const row = await loadOwnedCase(admin, input.consumerUserId, input.caseId);
  const state = asState(row.state);
  if (isTerminalNegotiationState(state)) {
    throw new NegotiationError('This deal is already finished.', 409, 'case_closed');
  }
  const policy = await loadPolicyById(admin, row.policy_id, row.policy_version);
  const version = currentMandate(row)?.version ?? 0;
  const { error } = await admin.from('shopper_mandates').insert({
    negotiation_case_id: row.id,
    version: version + 1,
    ...mandateColumns(mandate),
    approved_at: null,
  });
  if (error) throw storageError(error.message);

  if (state !== 'draft') {
    guard(() => assertNegotiationTransition({
      from: state,
      to: 'draft',
      mandateApproved: false,
      policy: policy.rules,
    }));
    await writeTransition(admin, {
      row,
      to: 'draft',
      actor: 'shopper',
      reason: 'mandate_revised',
      policy,
      toolName: 'save_shopper_mandate',
      idempotencyKey,
      actionInput: mandate,
    });
  } else {
    await insertAction(admin, {
      caseId: row.id,
      consumerUserId: row.consumer_user_id,
      toolName: 'save_shopper_mandate',
      idempotencyKey,
      policy,
      marketContextId: row.market_context_id,
      input: mandate,
      output: { state: 'draft', version: version + 1 },
    });
  }
  return getNegotiationCase(input.consumerUserId, row.id);
}

export async function approveShopperMandate(input: {
  consumerUserId: string;
  caseId: string;
  idempotencyKey?: string | null;
}): Promise<ShopperNegotiationView> {
  const idempotencyKey = requiredKey(input.idempotencyKey);
  const admin = createAdminClient();
  const existing = await findActionCase(admin, input.consumerUserId, 'approve_shopper_mandate', idempotencyKey);
  if (existing) return getNegotiationCase(input.consumerUserId, existing);

  const row = await loadOwnedCase(admin, input.consumerUserId, input.caseId);
  const state = asState(row.state);
  const latest = currentMandate(row);
  if (!latest) throw new NegotiationError('Add shopper rules before approving them.', 409, 'mandate_missing');
  if (latest.approvedAt && state !== 'draft') return toShopperView(row);
  if (isTerminalNegotiationState(state)) {
    throw new NegotiationError('This deal is already finished.', 409, 'case_closed');
  }

  const policy = await loadPolicyById(admin, row.policy_id, row.policy_version);
  if (!latest.approvedAt) {
    const { error } = await admin.from('shopper_mandates').insert({
      negotiation_case_id: row.id,
      version: latest.version + 1,
      ...mandateColumns(latest),
      approved_at: new Date().toISOString(),
    });
    if (error) throw storageError(error.message);
  }

  if (state === 'draft') {
    guard(() => assertNegotiationTransition({
      from: 'draft',
      to: 'mandate_approved',
      mandateApproved: true,
      policy: policy.rules,
    }));
    await writeTransition(admin, {
      row,
      to: 'mandate_approved',
      actor: 'shopper',
      reason: 'mandate_approved',
      policy,
      toolName: 'approve_shopper_mandate',
      idempotencyKey,
      actionInput: { version: latest.version + (latest.approvedAt ? 0 : 1) },
      mandateApproved: true,
    });
  } else {
    await insertAction(admin, {
      caseId: row.id,
      consumerUserId: row.consumer_user_id,
      toolName: 'approve_shopper_mandate',
      idempotencyKey,
      policy,
      marketContextId: row.market_context_id,
      input: {},
      output: { state },
    });
  }
  return getNegotiationCase(input.consumerUserId, row.id);
}

export async function transitionNegotiationCase(input: {
  consumerUserId: string;
  caseId: string;
  to: string;
  reason: string;
  idempotencyKey?: string | null;
}): Promise<ShopperNegotiationView> {
  const to = input.to;
  if (!isNegotiationState(to)) {
    throw new NegotiationError('That deal step is not recognized.', 400, 'invalid_request');
  }
  guard(() => assertGenericStateTool(to));
  const reason = requiredText(input.reason, 'reason', 500);
  const idempotencyKey = requiredKey(input.idempotencyKey);
  const admin = createAdminClient();
  const existing = await findActionCase(admin, input.consumerUserId, 'update_negotiation_state', idempotencyKey);
  if (existing) return getNegotiationCase(input.consumerUserId, existing);

  const row = await loadOwnedCase(admin, input.consumerUserId, input.caseId);
  const state = asState(row.state);
  const policy = await loadPolicyById(admin, row.policy_id, row.policy_version);
  const approved = Boolean(currentMandate(row)?.approvedAt);
  guard(() => assertNegotiationTransition({
    from: state,
    to,
    mandateApproved: approved,
    policy: policy.rules,
  }));
  await writeTransition(admin, {
    row,
    to,
    actor: 'shopper',
    reason,
    policy,
    toolName: 'update_negotiation_state',
    idempotencyKey,
    actionInput: { to: input.to, reason },
    mandateApproved: approved,
  });
  return getNegotiationCase(input.consumerUserId, row.id);
}

export async function listDealerNegotiations(dealershipId: string): Promise<DealerNegotiationView[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('negotiation_cases')
    .select(CASE_COLUMNS)
    .eq('dealership_id', dealershipId)
    .order('created_at', { ascending: false });
  if (error) throw storageError(error.message);
  return (data ?? []).flatMap((entry) => {
    const view = toShopperView(entry as unknown as CaseRow);
    const projected = projectCaseForDealer({
      negotiationCaseId: view.negotiationCaseId,
      shopperAlias: view.shopperAlias,
      listingId: view.listingId,
      vin: view.vin,
      dealershipId: view.dealershipId,
      state: view.state,
      outcome: view.outcome,
      policyVersion: view.policyVersion,
      mandate: view.mandate,
      market: view.market,
    });
    return projected ? [projected] : [];
  });
}

async function writeTransition(admin: AdminClient, input: {
  row: CaseRow;
  to: NegotiationState;
  actor: NegotiationActor;
  reason: string;
  policy: NegotiationPolicyRecord & { id: string };
  toolName: string;
  idempotencyKey: string;
  actionInput: unknown;
  mandateApproved?: boolean;
}): Promise<void> {
  const from = asState(input.row.state);
  const outcome = input.to === 'closed_won' || input.to === 'closed_lost' || input.to === 'expired'
    ? input.to
    : null;
  const { error } = await admin
    .from('negotiation_cases')
    .update({ state: input.to, outcome })
    .eq('id', input.row.id);
  if (error) throw storageError(error.message);
  await insertStateEvent(admin, {
    caseId: input.row.id,
    consumerUserId: input.row.consumer_user_id,
    from,
    to: input.to,
    actor: input.actor,
    reason: input.reason,
    policyVersion: input.policy.version,
  });
  await insertAction(admin, {
    caseId: input.row.id,
    consumerUserId: input.row.consumer_user_id,
    toolName: input.toolName,
    idempotencyKey: input.idempotencyKey,
    policy: input.policy,
    marketContextId: input.row.market_context_id,
    input: input.actionInput,
    output: { from, to: input.to },
  });
  await recordNegotiationEvents(buildNegotiationEvents({
    negotiationCaseId: input.row.id,
    consumerUserId: input.row.consumer_user_id,
    listingId: input.row.listing_id,
    vin: input.row.vin,
    dealershipId: input.row.dealership_id,
    policyVersion: input.policy.version,
    from,
    to: input.to,
    includeCreated: false,
    includeMandateApproved: input.mandateApproved === true && input.to === 'mandate_approved',
    market: null,
  }));
}

async function loadOwnedCase(admin: AdminClient, consumerUserId: string, caseId: string): Promise<CaseRow> {
  const { data, error } = await admin
    .from('negotiation_cases')
    .select(CASE_COLUMNS)
    .eq('id', caseId)
    .eq('consumer_user_id', consumerUserId)
    .maybeSingle();
  if (error) throw storageError(error.message);
  if (!data) throw new NegotiationError('That deal could not be found.', 404, 'not_found');
  return data as unknown as CaseRow;
}

async function loadListing(admin: AdminClient, listingId: string) {
  const { data, error } = await admin
    .from('uvs_vehicles')
    .select('id, vin, price, days_on_market, miles, dealership_id, availability_status, uvs_data')
    .eq('id', listingId)
    .maybeSingle();
  if (error) throw storageError(error.message);
  if (!data) throw new NegotiationError('That vehicle could not be found.', 404, 'listing_not_found');
  return data as {
    id: string;
    vin: string | null;
    price: number | string | null;
    days_on_market: number | null;
    miles: number | string | null;
    dealership_id: string | null;
    availability_status: string | null;
    uvs_data: {
      pricing?: { priceChangeHistory?: unknown[] };
      marketData?: { marketAveragePrice?: number; similarListings?: number };
    } | null;
  };
}

async function loadActivePolicy(admin: AdminClient): Promise<NegotiationPolicyRecord & { id: string }> {
  const { data, error } = await admin
    .from('negotiation_policies')
    .select('id, version, effective_from, effective_to, rules');
  if (error) throw storageError(error.message);
  const policies = (data ?? []).map(mapPolicy);
  const active = selectActivePolicy(policies, new Date());
  if (!active?.id) {
    throw new NegotiationError('Negotiation rules are not configured.', 503, 'policy_unavailable');
  }
  return active as NegotiationPolicyRecord & { id: string };
}

async function loadPolicyById(
  admin: AdminClient,
  policyId: string,
  version: number,
): Promise<NegotiationPolicyRecord & { id: string }> {
  const { data, error } = await admin
    .from('negotiation_policies')
    .select('id, version, effective_from, effective_to, rules')
    .eq('id', policyId)
    .maybeSingle();
  if (error) throw storageError(error.message);
  if (!data) throw new NegotiationError('Negotiation rules are not configured.', 503, 'policy_unavailable');
  const policy = mapPolicy(data);
  if (policy.version !== version) {
    throw new NegotiationError('The deal is pinned to a missing policy version.', 409, 'policy_mismatch');
  }
  return policy as NegotiationPolicyRecord & { id: string };
}

async function ensureAlias(admin: AdminClient, consumerUserId: string): Promise<{ id: string }> {
  const { data, error } = await admin
    .from('shopper_aliases')
    .select('id')
    .eq('consumer_user_id', consumerUserId)
    .maybeSingle();
  if (error) throw storageError(error.message);
  if (data?.id) return { id: data.id };
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data: inserted, error: insertError } = await admin
      .from('shopper_aliases')
      .insert({
        consumer_user_id: consumerUserId,
        public_code: makeShopperAliasCode(() => randomBytes(1)[0] ?? 0),
      })
      .select('id')
      .single();
    if (!insertError && inserted) return { id: inserted.id };
    if (insertError?.code !== '23505') throw storageError(insertError?.message ?? 'alias');
  }
  throw new NegotiationError('A shopper alias could not be created.', 500, 'alias_unavailable');
}

async function latestAskingPrice(admin: AdminClient, listingId: string): Promise<number | null> {
  const { data, error } = await admin
    .from('vehicle_market_contexts')
    .select('asking_price')
    .eq('listing_id', listingId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw storageError(error.message);
  return asNumber(data?.asking_price);
}

async function findOpenCase(admin: AdminClient, consumerUserId: string, listingId: string): Promise<string | null> {
  const { data, error } = await admin
    .from('negotiation_cases')
    .select('id')
    .eq('consumer_user_id', consumerUserId)
    .eq('listing_id', listingId)
    .in('state', NEGOTIATION_STATES.filter((state) => !isTerminalNegotiationState(state)))
    .limit(1)
    .maybeSingle();
  if (error) throw storageError(error.message);
  return data?.id ?? null;
}

async function findActionCase(
  admin: AdminClient,
  consumerUserId: string,
  toolName: string,
  idempotencyKey: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from('agent_actions')
    .select('negotiation_case_id')
    .eq('consumer_user_id', consumerUserId)
    .eq('tool_name', toolName)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();
  if (error) throw storageError(error.message);
  return data?.negotiation_case_id ?? null;
}

async function insertStateEvent(admin: AdminClient, input: {
  caseId: string;
  consumerUserId: string;
  from: NegotiationState | null;
  to: NegotiationState;
  actor: NegotiationActor;
  reason: string;
  policyVersion: number;
}): Promise<void> {
  const { error } = await admin.from('negotiation_state_events').insert({
    negotiation_case_id: input.caseId,
    consumer_user_id: input.consumerUserId,
    from_state: input.from,
    to_state: input.to,
    actor: input.actor,
    reason: input.reason,
    policy_version: input.policyVersion,
  });
  if (error) throw storageError(error.message);
}

async function insertAction(admin: AdminClient, input: {
  caseId: string;
  consumerUserId: string;
  toolName: string;
  idempotencyKey: string;
  policy: { id?: string; version: number };
  marketContextId: string | null;
  input: unknown;
  output: unknown;
}): Promise<void> {
  const { error } = await admin.from('agent_actions').insert({
    negotiation_case_id: input.caseId,
    consumer_user_id: input.consumerUserId,
    tool_name: input.toolName,
    idempotency_key: input.idempotencyKey,
    policy_id: input.policy.id,
    policy_version: input.policy.version,
    market_context_id: input.marketContextId,
    input: redactUnknown(input.input),
    output: redactUnknown(input.output),
  });
  if (error) throw storageError(error.message);
}

async function recordNegotiationEvents(events: NegotiationEventDraft[]): Promise<void> {
  if (events.length === 0) return;
  try {
    const admin = createAdminClient();
    const sessionId = randomUUID();
    const occurredAt = new Date().toISOString();
    const { error: sessionError } = await admin.from('app_sessions').upsert(
      { id: sessionId, provider: 'negotiation', last_activity_at: occurredAt },
      { onConflict: 'id' },
    );
    if (sessionError) throw sessionError;
    const { error } = await admin.from('app_events').insert(events.map((event) => ({
      flow_id: sessionId,
      event_name: event.eventName,
      source: 'dashboard',
      provider: 'negotiation',
      payload: { event_source: 'backend', ...event.properties },
      occurred_at: occurredAt,
    })));
    if (error) throw error;
  } catch (error) {
    console.warn(JSON.stringify({
      event: 'negotiation_event_failed',
      message: error instanceof Error ? error.message : 'unknown',
    }));
  }
}

function toShopperView(row: CaseRow): ShopperNegotiationView {
  const alias = Array.isArray(row.shopper_aliases) ? row.shopper_aliases[0] : row.shopper_aliases;
  const mandate = currentMandate(row);
  const context = currentContext(row);
  return {
    negotiationCaseId: row.id,
    consumerUserId: row.consumer_user_id,
    shopperAlias: alias?.public_code ?? '',
    listingId: row.listing_id,
    vin: row.vin,
    dealershipId: row.dealership_id,
    state: asState(row.state),
    outcome: row.outcome,
    policyVersion: row.policy_version,
    mandate,
    market: context
      ? {
          askingPrice: asNumber(context.asking_price),
          daysOnMarket: context.days_on_market,
          localMedian: asNumber(context.local_median),
          priceVsMedian: asNumber(context.price_vs_median),
          marketPosition: context.market_position,
          confidence: context.confidence,
        }
      : null,
    createdAt: row.created_at,
  };
}

function currentMandate(row: CaseRow): ShopperMandate | null {
  const latest = [...(row.shopper_mandates ?? [])].sort((left, right) => right.version - left.version)[0];
  if (!latest) return null;
  return {
    version: latest.version,
    timing: latest.timing,
    maxPrice: asNumber(latest.max_price),
    maxOtd: asNumber(latest.max_otd),
    paymentPreference: latest.payment_preference,
    downPayment: asNumber(latest.down_payment),
    financingPreference: latest.financing_preference,
    tradeIn: latest.trade_in,
    mustHaves: latest.must_haves ?? [],
    dealBreakers: latest.deal_breakers ?? [],
    addOnTolerance: latest.add_on_tolerance,
    questions: latest.questions ?? [],
    travel: latest.travel,
    buyNowReadiness: latest.buy_now_readiness,
    approvedAt: latest.approved_at,
  };
}

function currentContext(row: CaseRow): ContextRow | null {
  const contexts = [...(row.vehicle_market_contexts ?? [])];
  if (row.market_context_id) {
    return contexts.find((context) => context.id === row.market_context_id) ?? contexts[0] ?? null;
  }
  contexts.sort((left, right) => right.generated_at.localeCompare(left.generated_at));
  return contexts[0] ?? null;
}

function mandateColumns(mandate: ShopperMandateInput) {
  return {
    timing: mandate.timing ?? null,
    max_price: mandate.maxPrice ?? null,
    max_otd: mandate.maxOtd ?? null,
    payment_preference: mandate.paymentPreference ?? null,
    down_payment: mandate.downPayment ?? null,
    financing_preference: mandate.financingPreference ?? null,
    trade_in: mandate.tradeIn ?? null,
    must_haves: mandate.mustHaves ?? [],
    deal_breakers: mandate.dealBreakers ?? [],
    add_on_tolerance: mandate.addOnTolerance ?? null,
    questions: mandate.questions ?? [],
    travel: mandate.travel ?? null,
    buy_now_readiness: mandate.buyNowReadiness ?? null,
  };
}

function parseMandate(value: unknown): ShopperMandateInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new NegotiationError('Shopper rules are required.', 400, 'invalid_request');
  }
  const record = value as Record<string, unknown>;
  if (['email', 'phone', 'phoneNumber', 'address'].some((key) => key in record)) {
    throw new NegotiationError('Shopper rules cannot include contact details.', 400, 'contact_not_allowed');
  }
  return {
    timing: cleanText(record.timing),
    maxPrice: cleanMoney(record.maxPrice),
    maxOtd: cleanMoney(record.maxOtd),
    paymentPreference: cleanText(record.paymentPreference),
    downPayment: cleanMoney(record.downPayment),
    financingPreference: cleanText(record.financingPreference),
    tradeIn: cleanText(record.tradeIn),
    mustHaves: cleanList(record.mustHaves),
    dealBreakers: cleanList(record.dealBreakers),
    addOnTolerance: cleanText(record.addOnTolerance),
    questions: cleanList(record.questions),
    travel: cleanText(record.travel),
    buyNowReadiness: cleanText(record.buyNowReadiness),
  };
}

function cleanText(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') {
    throw new NegotiationError('A shopper rule was not text.', 400, 'invalid_request');
  }
  const trimmed = value.trim();
  if (trimmed.length > 500) {
    throw new NegotiationError('A shopper rule is too long.', 400, 'invalid_request');
  }
  return trimmed;
}

function cleanMoney(value: unknown): number | null {
  if (value == null || value === '') return null;
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new NegotiationError('A price in the shopper rules is not valid.', 400, 'invalid_request');
  }
  return number;
}

function cleanList(value: unknown): string[] {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 20) {
    throw new NegotiationError('A shopper rule list is not valid.', 400, 'invalid_request');
  }
  return value.map((item) => {
    const text = cleanText(item);
    if (!text) throw new NegotiationError('A shopper rule list is not valid.', 400, 'invalid_request');
    return text;
  });
}

function mapPolicy(row: {
  id: string;
  version: number;
  effective_from: string;
  effective_to: string | null;
  rules: unknown;
}): NegotiationPolicyRecord & { id: string } {
  const rules = row.rules as NegotiationPolicyRules;
  if (!rules || !Array.isArray(rules.allowedTransitions)) {
    throw new NegotiationError('Negotiation rules are not configured.', 503, 'policy_unavailable');
  }
  return {
    id: row.id,
    version: row.version,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    rules,
  };
}

function asState(value: string): NegotiationState {
  if (!isNegotiationState(value)) {
    throw new NegotiationError('That deal step is not recognized.', 500, 'invalid_state');
  }
  return value;
}

function asNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function requiredText(value: string, field: string, max: number): string {
  const trimmed = value?.trim?.() ?? '';
  if (!trimmed || trimmed.length > max) {
    throw new NegotiationError(`${field} is required.`, 400, 'invalid_request');
  }
  return trimmed;
}

function optionalKey(value?: string | null): string | null {
  if (value == null || value.trim() === '') return null;
  if (value.trim().length > 200) {
    throw new NegotiationError('The idempotency key is too long.', 400, 'invalid_request');
  }
  return value.trim();
}

function requiredKey(value?: string | null): string {
  const key = optionalKey(value);
  if (!key) throw new NegotiationError('An idempotency key is required.', 400, 'invalid_request');
  return key;
}

function guard(run: () => void): void {
  try {
    run();
  } catch (error) {
    if (error instanceof NegotiationRuleError) {
      throw new NegotiationError(error.message, 409, error.code);
    }
    throw error;
  }
}

function storageError(message: string): NegotiationError {
  console.error(JSON.stringify({ event: 'negotiation_storage_failed', message }));
  return new NegotiationError('Drevvy could not save this deal.', 500, 'storage_error');
}
