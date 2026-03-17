# Onboarding Isolation Hardening - Implementation Complete

**Date:** 2025-02-23  
**Status:** ✅ Complete  
**Goal:** Prevent cross-tenant demo data leakage by enforcing strict tenant isolation at database, app, and operations layers.

## Summary

This implementation addresses the issue where new user signups were inheriting existing dealership/demo data (Rock Hill GMC) due to insufficient tenant isolation. The fix introduces multiple layers of protection:

1. **Demo script production guards** - Prevent accidental writes to production databases
2. **Tightened RLS policies** - Block client-side membership creation
3. **Signup trigger audit** - Verify minimal profile creation only
4. **First-login integrity checks** - Detect and block suspicious prelinked state
5. **Monitoring & recovery runbook** - Daily detection queries and incident response procedures

## Changes Implemented

### 1. Isolate Demo vs Production Data Paths

**Files Modified:**
- `/scripts/setup-vercel-demo.js`
- `/scripts/seed-demo-leads.js`
- `/scripts/setup-vercel-demo-account.sql`
- `/scripts/seed-demo-inventory.sql`
- `/scripts/README_VERCEL_DEMO_SETUP.md`

**Changes:**
- Added production write guard to JavaScript scripts that checks for production indicators ("prod", "production", "vercel", "live") in Supabase URL
- Scripts now fail fast with clear error message unless `ALLOW_PROD_WRITE=true` is explicitly set
- Added warning headers to SQL scripts alerting operators that these are demo/seed scripts
- Updated README with prominent production write guard section

**Example Guard Logic:**
```javascript
const PROD_INDICATORS = ['prod', 'production', 'vercel', 'live'];
function isProdUrl(url) {
  const lowerUrl = url.toLowerCase();
  return PROD_INDICATORS.some(indicator => lowerUrl.includes(indicator));
}

if (isProdUrl(SUPABASE_URL) && !ALLOW_PROD_WRITE) {
  console.error('⛔ PRODUCTION WRITE GUARD');
  console.error('This script writes DEMO DATA and should NOT run against production.');
  process.exit(1);
}
```

### 2. Tighten `user_dealerships` Insert RLS

**Files Created:**
- `/apps/dealer-dashboard/supabase/migrations/20250223_tighten_user_dealerships_rls.sql`

**Changes:**
- Dropped permissive RLS policy `"Users can insert their memberships"` that allowed client-side self-linking
- Created new restrictive policy `"Service role can insert memberships"` that only allows service role (admin) to insert
- Forces all membership creation through server-side `createDealership()` path using `createAdminClient()`

**Policy:**
```sql
drop policy if exists "Users can insert their memberships" on user_dealerships;

create policy "Service role can insert memberships"
  on user_dealerships for insert
  with check (
    auth.jwt() ->> 'role' = 'service_role'
  );
```

**Impact:**
- Authenticated clients cannot directly insert into `user_dealerships` table
- Server actions using `createAdminClient()` still work via service role
- Prevents new users from self-linking to demo dealerships

### 3. Keep Signup Trigger Minimal and Auditable

**Files Created:**
- `/apps/dealer-dashboard/supabase/migrations/20250223_verify_signup_trigger.sql`

**Changes:**
- Added documentation and verification queries for `on_auth_user_created` trigger
- Added SQL comments to trigger and function documenting expected minimal behavior
- Provided verification queries to audit trigger function definition

**Verification:**
```sql
-- Check that trigger function only touches profiles table
SELECT pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'handle_new_user' AND n.nspname = 'public';
```

**Expected Behavior:**
- Trigger ONLY inserts `(id, email)` into `profiles` table
- NO dealership memberships or preferences created
- All tenant linking happens through app onboarding flow

### 4. Add First-Login Onboarding Integrity Block

**Files Created:**
- `/apps/dealer-dashboard/src/lib/supabase/integrity-check.ts`

**Files Modified:**
- `/apps/dealer-dashboard/src/middleware.ts`
- `/apps/dealer-dashboard/src/app/auth/page.tsx`

**Changes:**

**New Integrity Check Function:**
- Created `checkOnboardingIntegrity()` function that detects suspicious prelinked state
- Checks for:
  - Dealership memberships on accounts < 10 minutes old
  - MarketCheck dealer ID set in profile before onboarding
  - Active dealership preference before setup completion
- Only checks accounts < 10 minutes old to avoid false positives
- Fails open (returns valid) on query errors for better UX

**Middleware Integration:**
- Calls integrity check for all `/app/**` route access
- Blocks access and signs out user if suspicious state detected
- Redirects to `/auth` with error message
- Logs structured event for ops review

**Auth Page Enhancement:**
- Added `useSearchParams` to detect integrity check failure
- Displays user-friendly error message with support contact
- Preserves error state during page render

**Flow:**
```
NewUser → Middleware → IntegrityCheck → 
  ├─ Valid: Allow access to /app
  └─ Invalid: SignOut → Redirect to /auth with error → Show support message
```

### 5. Add Daily Detection + Runbook

**Files Created:**
- `/apps/dealer-dashboard/docs/TENANT_ISOLATION_MONITORING.md`

**Changes:**
- Created comprehensive operations runbook with daily detection query
- Provides SQL query to find new users with suspicious prelinked state
- Includes severity levels (CRITICAL, WARNING, INFO)
- Documents full incident response workflow:
  1. Verify the incident
  2. Determine root cause
  3. Clean up affected user
  4. Notify user
  5. Post-incident review
- Provides recovery SQL scripts to clean up affected accounts
- Defines thresholds and alerting criteria
- Includes prevention checklist for quarterly reviews

**Detection Query:**
```sql
-- Detect new users with prelinked dealerships or MarketCheck IDs
WITH new_users AS (
  SELECT ... FROM profiles WHERE created_at >= NOW() - INTERVAL '24 hours'
),
suspicious_memberships AS (
  SELECT ... GROUP BY ...
)
SELECT 
  user_id, email, account_age_hours, membership_count, 
  dealership_names, severity
FROM suspicious_memberships
WHERE membership_count > 0 OR marketcheck_dealer_id IS NOT NULL ...
```

## Validation Plan

### DB Policy Test
- [ ] Authenticated non-admin client cannot insert into `user_dealerships` directly
- [ ] Server admin path still can create membership during `createDealership()`

### Onboarding Integrity Test
- [ ] New clean user passes setup
- [ ] Injected suspicious linkage triggers block + support message

### Script Guard Test
- [ ] Demo/seed scripts fail on production URL unless `ALLOW_PROD_WRITE=true`

### Monitoring Test
- [ ] Daily detection query returns expected records
- [ ] Query documented and accessible for ops team

## Rollout Plan

1. **Ship DB migrations first** (Steps 2 & 3)
   - Apply `20250223_tighten_user_dealerships_rls.sql`
   - Apply `20250223_verify_signup_trigger.sql`
   - Verify service role still works in `createDealership()`

2. **Deploy app integrity block** (Step 4)
   - Deploy middleware changes with integrity check
   - Deploy auth page error handling
   - Monitor for false positives in first 24 hours

3. **Update demo scripts** (Step 1)
   - Scripts already updated with guards
   - Communicate to team: never run demo scripts on production
   - Verify all team members understand `ALLOW_PROD_WRITE` requirement

4. **Operationalize monitoring** (Step 5)
   - Share `TENANT_ISOLATION_MONITORING.md` with ops team
   - Schedule daily detection query
   - Train support on recovery workflow

## Expected Behavior After Implementation

### New User Signup (Clean State)
1. User signs up at `/auth`
2. Trigger creates minimal profile with `(id, email)`
3. User redirected to `/app/setup`
4. Middleware runs integrity check → passes (no prelinked state)
5. User completes onboarding, connects dealership
6. `createDealership()` uses admin client to create membership

### New User Signup (Prelinked State - Blocked)
1. User signs up at `/auth`
2. Trigger creates minimal profile
3. (Somehow) user has prelinked dealership membership
4. User attempts to access `/app/setup`
5. Middleware runs integrity check → fails (membership detected on new account)
6. User signed out and redirected to `/auth?error=integrity_check_failed`
7. Auth page displays: "Your account setup appears incomplete. Please contact support..."
8. Ops team notified via structured log
9. Daily detection query flags user for manual review

### Demo Script on Production (Blocked)
1. Operator runs `node scripts/setup-vercel-demo.js`
2. Script checks `NEXT_PUBLIC_SUPABASE_URL` contains "prod"/"vercel"/"live"
3. Script checks `ALLOW_PROD_WRITE` is not set
4. Script exits with clear error:
   ```
   ⛔ PRODUCTION WRITE GUARD
   This script writes DEMO DATA and should NOT run against production.
   To proceed anyway (not recommended):
     ALLOW_PROD_WRITE=true node scripts/setup-vercel-demo.js
   ```

## Testing Recommendations

### Manual Testing
1. **Clean signup test:**
   - Create new test account
   - Verify no prelinked dealerships
   - Complete onboarding successfully

2. **Demo script guard test:**
   - Point `.env.local` to production-like URL
   - Run `node scripts/setup-vercel-demo.js` without override
   - Verify script blocks with error message
   - Run with `ALLOW_PROD_WRITE=true` and verify override works

3. **Integrity check test:**
   - Create test account
   - Manually insert membership using admin client
   - Attempt to access `/app/setup`
   - Verify redirect to `/auth` with error

### Automated Testing (Future)
- Unit tests for `checkOnboardingIntegrity()` function
- Integration tests for middleware integrity check flow
- E2E tests for clean signup → onboarding flow

## Metrics to Monitor

**Short-term (first 7 days):**
- Number of integrity check failures per day (expect 0)
- Number of new signups per day (baseline)
- Support tickets related to "account setup incomplete" error

**Long-term (ongoing):**
- Daily detection query results (expect 0 suspicious users)
- Demo script execution attempts on production (should be 0)
- User feedback on onboarding flow

## Rollback Plan

If issues arise, rollback in reverse order:

1. **Disable integrity check in middleware:**
   - Comment out integrity check logic
   - Redeploy app
   - Users can access dashboard again

2. **Restore permissive RLS policy:**
   ```sql
   drop policy if exists "Service role can insert memberships" on user_dealerships;
   create policy "Users can insert their memberships"
     on user_dealerships for insert
     with check (auth.uid() = user_id);
   ```

3. **Keep demo script guards** (no rollback needed, they're defensive)

## Next Steps

1. **Deploy migrations to production Supabase**
2. **Deploy app changes to Vercel**
3. **Share monitoring runbook with ops team**
4. **Schedule daily detection query**
5. **Monitor for 7 days and adjust thresholds as needed**

## Files Changed

### New Files
- `apps/dealer-dashboard/supabase/migrations/20250223_tighten_user_dealerships_rls.sql`
- `apps/dealer-dashboard/supabase/migrations/20250223_verify_signup_trigger.sql`
- `apps/dealer-dashboard/src/lib/supabase/integrity-check.ts`
- `apps/dealer-dashboard/docs/TENANT_ISOLATION_MONITORING.md`

### Modified Files
- `scripts/setup-vercel-demo.js` - Added production write guard
- `scripts/seed-demo-leads.js` - Added production write guard
- `scripts/setup-vercel-demo-account.sql` - Added warning header
- `scripts/seed-demo-inventory.sql` - Added warning header
- `scripts/README_VERCEL_DEMO_SETUP.md` - Added guard documentation
- `apps/dealer-dashboard/src/middleware.ts` - Added integrity check
- `apps/dealer-dashboard/src/app/auth/page.tsx` - Added error display

## Documentation References

- [Tenant Isolation Monitoring Runbook](apps/dealer-dashboard/docs/TENANT_ISOLATION_MONITORING.md)
- [Vercel Demo Setup Guide](scripts/README_VERCEL_DEMO_SETUP.md)
- [Supabase Setup Documentation](apps/dealer-dashboard/docs/SUPABASE_SETUP.md)

---

**Implementation Complete:** All 5 steps of the Onboarding Isolation Hardening plan have been successfully implemented.

**Ready for deployment:** Yes, pending migration application and app redeployment.

**Owner:** Platform Team  
**Reviewer:** Operations Team  
**Support Contact:** support@autoagent.com
