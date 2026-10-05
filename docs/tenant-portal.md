# Private tenant portal and calendar reconciliation

## First release

Existing `/bill/<token>` URLs retain their electricity bill view and gain **View your account**. That button does not itself grant account access. The account portal requires a separately confirmed tenancy/account relationship. There is no phone or PIN login in this release.

Use **Rent → Accounts → Tenant portal access**:

1. Confirm the account payer and attached units. Resolve duplicate/ambiguous membership first.
2. Enable private account access and confirm the private-link warning. A new random account link is generated.
3. For each electricity unit, verify the current tenant and electricity balance, select the existing bills that belong to them, then confirm the electricity link. Unselected history is excluded from the portal. Bills created and issued after approval follow the same verified tenancy automatically.
4. The existing bill link now opens the authorised account via **View your account**. The dedicated portal link can also be copied with an explicit forwarded-link warning.

Disable access to revoke both entry methods. Replace access to rotate the account token and revoke all bill-to-portal grants. To authorise a previously revoked bill link again, first regenerate that unit's bill link, then re-confirm portal scope and the bill relationship. Revoked tokens are never silently reactivated.

Unit tenant identity/contact/status changes rotate the electricity access token on save. Every portal request also checks a fingerprint of the unit identity, access token, access-enabled state and status, plus the exact authorised account membership. Old links cannot follow a unit into another rent account. Existing standalone rent portal URLs redirect through the same checked portal; old access without a confirmed scope fails closed until an administrator reconfirms it.

When a tenant leaves, archive/update their unit and remove its old account membership; create a distinct account for the new payer. Do not reuse the old payer's ledger for a new person. The application cannot detect an unrecorded real-world tenancy change. Electricity's original unit bill archive is unchanged; check its history when issuing any replacement bill link.

## Tenant experience

Overview shows rent liability, overdue rent, allocated/confirmed paid-through coverage, next rent due and separate electricity balances. Services and unallocated account credit are explicitly labelled. Rent contains dated charges, payments and allocations, rate history, a printable statement and calendar. Electricity exposes only authorised bills and their associated payments. A bill-ID URL never authorises a bill: its token's account scope is checked first.

Queries refer to an authorised electricity bill, electricity payment or rent receipt. Replies, unread counts and Open / In progress / Resolved statuses remain in Yardle. Admin dashboards link to **Tenant queries**. Mark-read acknowledges only the messages the administrator/tenant has actually loaded; a newer message arriving in the meantime stays unread. A tenant reply reopens a resolved query. Submission IDs prevent duplicate conversations/replies. Tenants cannot change statuses or accounting records. Query length/rate limits apply; there are no emails, SMS, push notifications or attachments in this workflow.

## Calendar reconciliation

Open **Calendar reconciliation** on a draft account, or **Reconcile balance and calendar** on a live account. Enter the last payment date and amount if known, explicitly confirmed paid-through date, earliest date supported by that coverage evidence, and the opening arrears/credit. The last payment date and amount are evidence only, not new cash receipts.

For first setup, choose the first date of new coverage and historical calculation start. Leave opening balance blank to populate a suggested balance where evidence is complete. Historical schedules must have their actual historical start dates and effective-dated rates. Today's rate is never applied to a missing historic interval. Known historical receipts in the interval are listed but not deducted by default because their old allocations are unknown. Only tick the deduction confirmation after checking they are not already reflected in the paid-through date. Confirmed deductions are included once.

Example: save a weekly schedule at £65 with its real historical start date, add £70 effective **2026-10-05**, confirm paid-through **2026-07-19**, calculate unpaid rent from **2026-07-20**, and start new coverage on **2026-10-05**. Eleven old weeks calculate to **£715**. In advance, the new £70 week produces **£785 outstanding**, with **£715 overdue** on 5 October. Use the earliest date you can actually verify for the historical green coverage.

Preview shows calculation lines, dated rate segments, known receipts, entered balance, resulting balances and calendar. Overrides require evidence/reason. Moving the preview calendar does not save or navigate away. Confirmation records administrator/time, inputs, calculation and adjustments. Historical reconstructed period charges have distinct stable IDs and replace that portion of the opening lump sum; the original archive remains untouched. Balancing credits are clearly non-cash reconciliation adjustments. Last-payment evidence does not create another payment. Retries are idempotent and stale previews are rejected.

Live reconciliation targets today's complete rent-account balance (including services, excluding electricity). Existing charges/receipts stay intact. Confirming complete live rent periods uses available credit first, then an audited reconciliation credit if necessary; a balancing adjustment brings the account to the confirmed total. Partial live periods must be allocated explicitly through Record payment. Review these adjustments in the preview before saving.

Calendar colours: green fully allocated or explicitly confirmed historic coverage; amber partially allocated; red overdue unpaid; grey future unpaid/due today. Unknown historical coverage is labelled unknown. The same calendar appears for administrators and tenants. A historical paid-through date does not jump across missing/unpaid periods to imply uninterrupted coverage.

## PWA and privacy

The portal has an account-specific web manifest, 192/512 PNG icons, standalone launch URL, iOS metadata and home-screen installation guidance. It uses no service worker, local storage or offline account cache. Private pages/manifests send `private, no-store`, no-referrer and noindex headers. Portal navigation makes server requests; back-forward restoration revalidates. The installed shortcut contains the bearer link, so install only on a trusted device. A revoked link stops working even from an installed shortcut. Install support varies by browser; see [MDN installation requirements](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

Access resolves to an account-scoped principal with a private-link authentication method. A future verified-phone session can resolve the same principal without changing bill/ledger/query authorisation boundaries. No unauthenticated unit or account ID lookup grants access.

## Release verification

Automated tests cover account isolation, ambiguous mappings, old/new tenancy tokens, grant revocation and replacement, approved electricity history, forged query targets, admin-only status changes, unread counts, reply idempotency, reconciliation retries, missing historical rates, rate changes, partial coverage, payment reversals and the £65/£70 cutover.

Browser verification uses an isolated in-memory demo with database and real SMS disabled. Before production rollout, verify persistence and concurrent row-lock behaviour against staging MariaDB and test home-screen installation on actual iOS/Android devices. No live tenant links or financial data should be used for test submissions.

## Manual tenant and unit setup

Rent → Accounts now starts with a tenant-name list. Add a tenant by name, expand **Assign units**, select their units and save. Contact details are optional. Open their rent account to enter rates and reconcile balances. Unit assignment never moves rent transactions or automatically approves electricity history.

New imported drafts retain source unit records in their archive but have no assigned units. On upgrade, a one-time transaction releases inferred unit links only on imported review accounts with no financial entries, approval, explicit unit-assignment audit or enabled/confirmed portal access. The before/after assignment is audited. Activated accounts and confirmed relationships remain intact. To correct those, use **Change assigned units** yourself; changing membership revokes portal entry links and requires fresh approval.
