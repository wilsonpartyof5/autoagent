# offers.drevvy.com on Telnyx

Inbound dealer replies addressed to a conversation alias (`maya.ab12@offers.drevvy.com`) are received by Telnyx and posted to the existing backend webhook. The handler matches `to`, `cc`, or `bcc` to `conversation_identities.email_alias`. This runbook creates the domain with the Telnyx Email API. It does not send a message.

Telnyx documents this API at `https://api.telnyx.com/v2`. Email domain creation is supported. There is no catch-all inbox: mail arrives only at an inbox whose username is the alias local part.

Use the same `TELNYX_API_KEY` the backend already uses. Do not paste the key into shell history on a shared machine; export it for the session.

```bash
export TELNYX_API_KEY='...'
```

The webhook URL is the public origin of `apps/drevvy-backend` plus `/api/webhooks/telnyx`. If `TELNYX_WEBHOOK_URL` is already set for SMS, use that exact URL. Otherwise:

```text
https://<backend-host>/api/webhooks/telnyx
```

That route verifies `telnyx-signature-ed25519` with `TELNYX_PUBLIC_KEY` before it stores the event. Email uses the same Ed25519 scheme as messaging.

## 1. Create the domain

```bash
curl -sS -X POST https://api.telnyx.com/v2/email_domains \
  -H "Authorization: Bearer $TELNYX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "offers.drevvy.com",
    "inbound_enabled": true,
    "dmarc_policy": { "p": "none", "rua": "mailto:dmarc@telnyx.com" }
  }'
```

A `201` returns `data.id` (a UUID) and `data.status` of `pending`. Save the id as `DOMAIN_ID`. Do not send `tracking` on this call if the account already has a sending profile; Telnyx rejects that and tells you to `PATCH` the domain instead. Inbound does not need tracking.

`inbound_enabled: true` makes the MX record required. Without it, dealer replies never reach the webhook.

## 2. DNS records Dustin adds

Fetch the generated records. The DKIM public key exists only in this response.

```bash
curl -sS "https://api.telnyx.com/v2/email_domains/${DOMAIN_ID}/dns_records" \
  -H "Authorization: Bearer $TELNYX_API_KEY"
```

Publish every row. Copy `value` exactly, including the DKIM `p=` string. These are the records Telnyx generates for `offers.drevvy.com`:

| Purpose | Type | Host (fully qualified) | Value | Priority | Required |
| --- | --- | --- | --- | --- | --- |
| Ownership | TXT | `offers.drevvy.com` | `telnyx-domain-verification=<DOMAIN_ID>` | | yes |
| SPF | TXT | `offers.drevvy.com` | `v=spf1 include:spf.telnyx.com ~all` | | recommended |
| DKIM | TXT | `telnyx1._domainkey.offers.drevvy.com` | `v=DKIM1; k=rsa; p=<public key from dns_records>` | | yes |
| MX | MX | `offers.drevvy.com` | `mx.telnyx.com` | 10 | yes, because inbound is on |
| DMARC | TXT | `_dmarc.offers.drevvy.com` | `v=DMARC1; p=none; rua=mailto:dmarc@telnyx.com` | | recommended |

`<DOMAIN_ID>` is the UUID from step 1, with no extra quotes. Ownership and DKIM are required for verification. MX is required because `inbound_enabled` is true. SPF and DMARC are marked optional by Telnyx and should still be published.

Ownership and SPF are two separate TXT records on the same host. Do not join them into one string. If `offers.drevvy.com` already has an SPF TXT record, add `include:spf.telnyx.com` to that record. A second SPF record invalidates both.

At a registrar that appends `drevvy.com` itself, enter the host without the zone suffix:

| Type | Host to type | Value | Priority |
| --- | --- | --- | --- |
| TXT | `offers` | `telnyx-domain-verification=<DOMAIN_ID>` | |
| TXT | `offers` | `v=spf1 include:spf.telnyx.com ~all` | |
| TXT | `telnyx1._domainkey.offers` | `v=DKIM1; k=rsa; p=<public key from dns_records>` | |
| MX | `offers` | `mx.telnyx.com` | 10 |
| TXT | `_dmarc.offers` | `v=DMARC1; p=none; rua=mailto:dmarc@telnyx.com` | |

If DNS for `offers.drevvy.com` is its own zone, the hosts are `@`, `telnyx1._domainkey`, and `_dmarc`.

Cloudflare: DNS only (grey cloud). Do not proxy the MX or TXT records. GoDaddy and Namecheap want the short host, not the fully qualified name. After saving, look up the published name. `offers.drevvy.com.drevvy.com` means the zone suffix was added twice.

## 3. Verify

Wait until the records resolve, then:

```bash
curl -sS -X POST "https://api.telnyx.com/v2/email_domains/${DOMAIN_ID}/verify" \
  -H "Authorization: Bearer $TELNYX_API_KEY"
```

A `200` is not success by itself. Continue only when `data.status` is `verified` and `data.usable_for_inbound` is true. The `verification` map should show `ownership`, `dkim`, and `mx` as `verified`. If a row is still `pending`, compare `value` with `actual_value` from `dns_records` and check again. DNS can take more than a few minutes.

```bash
curl -sS "https://api.telnyx.com/v2/email_domains/${DOMAIN_ID}/health" \
  -H "Authorization: Bearer $TELNYX_API_KEY"
```

## 4. Point inbound mail at the webhook

Subscriptions are per domain. This allowlist is inbound only, so a test send does not need to be subscribed.

```bash
curl -sS -X POST "https://api.telnyx.com/v2/email_domains/${DOMAIN_ID}/webhooks" \
  -H "Authorization: Bearer $TELNYX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://<backend-host>/api/webhooks/telnyx",
    "events": ["email.received"]
  }'
```

A `201` returns the webhook id. Telnyx posts `email.received` to that URL for mail that arrives at an inbox on this domain. The payload is one recipient object (`to`, `cc`, or `bcc` as `{email, name, kind}`), not an array. The body may be inline `text_body` or a `text_body_url` the backend fetches. The route stores the event on `brain_vendor_events` and sets `conversation_identity_id` when the recipient matches an alias.

Confirm the subscription:

```bash
curl -sS "https://api.telnyx.com/v2/email_domains/${DOMAIN_ID}/webhooks" \
  -H "Authorization: Bearer $TELNYX_API_KEY"
```

`events` must include `email.received` and `url` must be the backend route above.

## 5. Create one inbox per alias

Telnyx does not accept mail for every local part. After a conversation identity is stored, create an inbox whose username is the alias local part. `maya.ab12@offers.drevvy.com` uses username `maya.ab12`. Usernames are 1–64 characters, start and end with a letter or digit, and contain only letters, digits, dots, hyphens, and underscores. That matches the aliases this app builds.

```bash
curl -sS -X POST https://api.telnyx.com/v2/email_inboxes \
  -H "Authorization: Bearer $TELNYX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "maya.ab12",
    "domain_id": "'"${DOMAIN_ID}"'"
  }'
```

The `201` body includes `data.address`. It must be exactly `maya.ab12@offers.drevvy.com`. Repeat for each live alias. An alias with no inbox does not produce `email.received`.

Do not send a live message from this setup until that is an explicit decision. A simulated `email.received` payload is covered by `apps/drevvy-backend/src/lib/brain/inbound-email.test.ts`.
