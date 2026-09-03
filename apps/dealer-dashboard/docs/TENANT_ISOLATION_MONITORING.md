# Tenant Isolation Monitoring and Recovery

This document provides SQL queries and procedures for detecting and responding to cross-tenant data leakage incidents.

## Daily Detection Query

Run this query daily to detect suspicious dealership linkage for newly created users:

```sql
-- Detect new users with prelinked dealerships or MarketCheck IDs
-- Run this daily to catch potential data leakage incidents
WITH new_users AS (
  SELECT 
    p.id,
    p.email,
    p.created_at,
    p.marketcheck_dealer_id,
    p.onboarding_completed,
    p.inventory_connected,
    EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600 AS account_age_hours
  FROM profiles p
  WHERE p.created_at >= NOW() - INTERVAL '24 hours'
),
suspicious_memberships AS (
  SELECT 
    nu.id AS user_id,
    nu.email,
    nu.account_age_hours,
    nu.marketcheck_dealer_id,
    nu.onboarding_completed,
    COUNT(ud.dealership_id) AS membership_count,
    ARRAY_AGG(d.name) AS dealership_names,
    up.active_dealership_id IS NOT NULL AS has_active_preference
  FROM new_users nu
  LEFT JOIN user_dealerships ud ON ud.user_id = nu.id
  LEFT JOIN dealerships d ON d.id = ud.dealership_id
  LEFT JOIN user_preferences up ON up.user_id = nu.id
  GROUP BY 
    nu.id, 
    nu.email, 
    nu.account_age_hours, 
    nu.marketcheck_dealer_id,
    nu.onboarding_completed,
    up.active_dealership_id
)
SELECT 
  user_id,
  email,
  ROUND(account_age_hours::numeric, 2) AS account_age_hours,
  marketcheck_dealer_id,
  onboarding_completed,
  membership_count,
  dealership_names,
  has_active_preference,
  -- Flag criteria
  CASE 
    WHEN membership_count > 0 AND account_age_hours < 0.5 THEN 'CRITICAL - Prelinked memberships on brand new account'
    WHEN marketcheck_dealer_id IS NOT NULL AND onboarding_completed = false THEN 'CRITICAL - MarketCheck ID set before onboarding'
    WHEN has_active_preference AND membership_count = 0 THEN 'WARNING - Active preference without memberships'
    WHEN membership_count > 1 THEN 'WARNING - Multiple dealerships on new account'
    ELSE 'INFO - Review recommended'
  END AS severity
FROM suspicious_memberships
WHERE 
  -- Flag if any suspicious conditions exist
  membership_count > 0 
  OR marketcheck_dealer_id IS NOT NULL 
  OR has_active_preference = true
ORDER BY 
  account_age_hours ASC,
  membership_count DESC;
```

## Expected Results

**Clean state (no incidents):**
- Query returns 0 rows
- No action needed

**Suspicious state (potential incident):**
- Query returns 1+ rows with `CRITICAL` or `WARNING` severity
- Follow recovery workflow below

## Incident Response Workflow

### Step 1: Verify the Incident

For each flagged user, investigate the account details:

```sql
-- Get full account details for user
SELECT 
  p.id,
  p.email,
  p.created_at,
  p.onboarding_completed,
  p.inventory_connected,
  p.marketcheck_dealer_id,
  p.marketcheck_zip,
  p.dms_provider
FROM profiles p
WHERE p.id = '<USER_ID>';

-- Get all dealership memberships
SELECT 
  ud.user_id,
  ud.dealership_id,
  ud.role,
  ud.created_at,
  d.name AS dealership_name,
  d.marketcheck_dealer_id
FROM user_dealerships ud
JOIN dealerships d ON d.id = ud.dealership_id
WHERE ud.user_id = '<USER_ID>';

-- Get active preference
SELECT 
  up.user_id,
  up.active_dealership_id,
  up.created_at,
  d.name AS active_dealership_name
FROM user_preferences up
LEFT JOIN dealerships d ON d.id = up.active_dealership_id
WHERE up.user_id = '<USER_ID>';
```

### Step 2: Determine Root Cause

Check which path created the suspicious linkage:

1. **Demo/seed script run on production?**
   - Check script execution logs
   - Verify `ALLOW_PROD_WRITE` was not set
   - Review Supabase project URL configuration

2. **Migration script backfill?**
   - Check if `20250223_backfill_dealerships.sql` ran on production
   - Review migration history in `supabase_migrations` table

3. **RLS policy bypass?**
   - Verify current RLS policies on `user_dealerships`
   - Check for any admin client usage in logs

4. **Trigger malfunction?**
   - Verify `on_auth_user_created` trigger only creates profiles
   - Check for unexpected trigger modifications

### Step 3: Clean Up Affected User

For confirmed incidents, clean up the user's data:

```sql
-- TRANSACTION - Run all or none
BEGIN;

-- 1. Remove dealership memberships
DELETE FROM user_dealerships
WHERE user_id = '<USER_ID>';

-- 2. Clear active preference
DELETE FROM user_preferences
WHERE user_id = '<USER_ID>';

-- 3. Reset profile to clean state
UPDATE profiles
SET 
  marketcheck_dealer_id = NULL,
  marketcheck_zip = NULL,
  dms_provider = NULL,
  onboarding_completed = false,
  inventory_connected = false,
  updated_at = NOW()
WHERE id = '<USER_ID>';

-- Verify cleanup
SELECT 
  (SELECT COUNT(*) FROM user_dealerships WHERE user_id = '<USER_ID>') AS memberships,
  (SELECT COUNT(*) FROM user_preferences WHERE user_id = '<USER_ID>') AS preferences,
  (SELECT marketcheck_dealer_id FROM profiles WHERE id = '<USER_ID>') AS marketcheck_id;

-- Expected result: memberships=0, preferences=0, marketcheck_id=NULL

COMMIT;
-- Or ROLLBACK if something looks wrong
```

### Step 4: Notify User

Send email to affected user:

**Subject:** Drevvy Account Setup - Action Required

**Body:**
```
Hi there,

We detected an issue with your Drevvy account setup and have reset your account to ensure data integrity.

Please log back in at https://autoagent-dealer-dashboard.vercel.app/auth and complete the onboarding process to connect your dealership.

If you continue to experience issues or have questions, please contact support at support@drevvy.com.

Thank you,
Drevvy Support Team
```

### Step 5: Post-Incident Review

1. **Document the incident:**
   - User ID and email
   - Root cause (demo script, migration, RLS bypass, trigger)
   - Recovery actions taken
   - User notification sent

2. **Update preventive measures:**
   - If demo script: Verify production write guards are active
   - If migration: Review and fix migration scripts
   - If RLS: Verify policies match expected state
   - If trigger: Audit and fix trigger logic

3. **Monitor for recurrence:**
   - Run detection query daily for next 7 days
   - Set up automated alerting if possible

## Thresholds and Alerting

**Normal operation:**
- 0-1 flagged users per week (INFO severity only)
- Review during weekly ops check-in

**Elevated alerting:**
- 2+ flagged users in 24 hours
- Any CRITICAL severity flags
- Immediate investigation required

**Critical incident:**
- 5+ flagged users in 24 hours
- Multiple CRITICAL flags
- Escalate to engineering team immediately
- Review all recent deployments and migrations

## Prevention Checklist

Run this checklist quarterly or after major deployments:

- [ ] Production write guards active in all demo/seed scripts
- [ ] RLS policies on `user_dealerships` block client-side inserts
- [ ] `on_auth_user_created` trigger only creates profiles
- [ ] Integrity check active in middleware for new users
- [ ] Daily detection query scheduled in ops runbook
- [ ] Support team trained on recovery workflow
- [ ] Demo/staging Supabase projects separate from production

## Contact

**Ops Questions:** ops@autoagent.com  
**Support Escalation:** support@drevvy.com  
**Engineering Escalation:** dev@autoagent.com

---

*Last updated: 2025-02-23*  
*Owner: Platform Team*
