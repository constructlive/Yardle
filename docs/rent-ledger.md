# Account-owned rent ledger

## First live entry (5 October 2026)

Existing rent figures are unconfirmed. The first visit imports their account/unit grouping and an immutable source snapshot, but creates **no live charges or payments**. Accounts start in **Needs reconciliation**. Electricity is untouched.

For each account:

1. Check the payer, account contact and attached units. Older matching grouping names in unit notes are consolidated into the account model. The original notes and transactions remain in the archive and original tables.
2. Enter the agreed rate in the schedule's **Initial agreed rate** field and its exact start date. For today's new rate use **2026-10-05**. Choose weekly/calendar-monthly/manual, cycle day, advance/arrears and the partial-period rule. Set each service's own dates and frequency.
3. Save the schedule. If another future rate is agreed, add it under dated rate history.
4. Enter the authoritative brought-forward **rent** owed or credit through **2026-10-04**. Positive means owed; negative means credit. Do not include today's new rent again. The old calculated balance is reference material, not an additional amount to be added.
5. Preview activation. Check linked units, source evidence, opening amount, first new charge and upcoming periods. Confirm the checkbox and sign off each account separately.

Sign-off is version-checked and records the administrator, timestamp, cutover date, confirmed amount and reconciliation note. It posts an opening charge or credit and catches up only from the approved first coverage date. Original transactions are archived under the account; they are not regenerated. There is deliberately no inferred historical paid-through date. Corrections after sign-off use audited adjustments.

## Schedule rules

- Dates are civil dates; 'today' uses Europe/London. Calculation uses UTC midday to avoid daylight-saving day shifts.
- Weekly cycle day is 0 Sunday through 6 Saturday. Monthly days 29–31 clamp to the last day of each month without drifting in the following month.
- Advance charges are due at coverage start; arrears charges are due the following day after coverage ends.
- Daily partial periods use actual days in the natural weekly/monthly cycle. Full-cycle partial billing uses the actual covered days as the divisor so a clipped period is billed as a full cycle. Both split rates at exact effective dates, then round once to integer pence.
- A rate change never rewrites an existing charge. For an overlapping posted/prepaid period, an audited supplemental debit or credit records the difference. Unposted later periods use the dated rate. Historical backdating on a live account is rejected; use an explained adjustment to correct an old error.
- Every recurring source has a stable period key. Account mutations acquire a database row lock. The catch-up worker and page catch-up therefore cannot post the same source/period twice.
- Upcoming charges are projections until due, unless a payment allocates to them in advance. Allocated future charges become immutable posted snapshots but are still excluded from current debt until their due dates.
- Ending a schedule inside an already posted period is rejected; end it at its posted boundary and use an adjustment for an agreed refund. Changing live frequency/timing uses an ended old schedule plus a new schedule.
- Pausing stops posting, not contractual liability. Resuming catches up. To end rent liability, set the schedule end date.

## Payments and statements

Record payment captures account, amount, date received, method and reference. It offers oldest-unpaid suggestions, editable allocations and selected 2/6/12-week rent windows. Weekly windows select their individual charges; monthly charges remain whole charges if the chosen window overlaps them. The UI shows the actual dates and amounts before saving. Projection horizon is 90 days, covering 12 weeks from today.

Payment request IDs protect retries; optimistic account versions prevent stale allocations from winning a race. An unallocated receipt or opening/adjustment credit remains credit. The same screen can allocate that existing credit without creating a second receipt. Reversal preserves the receipt, releases allocations, and records actor/time/reason.

Outstanding is net due charges minus receipts/credits. Overdue is **unpaid allocated liability** whose due date precedes today. Credit can coexist with unpaid overdue charges until an administrator assigns it; the UI labels this explicitly. Upcoming is unpaid future liability. Rent, services, and brought-forward balances are shown separately. Paid-through is contiguous **actual allocated rent coverage** from cutover, requiring every active rent component and supplemental increase charge to be settled. Services never extend rent coverage.

Each successful receipt prepares an account-addressed SMS snapshot. Sending is a separate explicit action and does not participate in the payment transaction. Submission and provider delivery are tracked independently. Unknown/in-progress outcomes are not automatically retried. Twilio delivery callbacks use the public HTTPS app URL and signed `/api/rent/sms-status` webhook. A provider acceptance is not labelled handset delivery. No test sends are made to Twilio by the automated tests.

Tenant access is disabled until an administrator enables a random secure link. The portal includes balances, charge/payment calendar, allocations, dated rates, printable account statement and previous issued electricity bills. Unit membership controls which electricity history is visible: check it before enabling the portal. Electricity has its own balance and is never settled by rent receipts. Link replacement invalidates the previous link.

## Persistence and deployment

The account is a versioned aggregate in `rent_ledger_accounts.state_json`. Each change also appends an event to `rent_ledger_events` within the same InnoDB transaction. `rent_ledger_meta` holds the one-time migration checkpoint. Account IDs are the ownership boundary for all new transactions; no new rent transaction has a unit ID. Units are membership references only. For this single-estate app the aggregate is loaded as a whole; very large histories would warrant indexed transaction tables and paginated reads.

The new tables are created idempotently on first rent access, following the existing app's runtime schema setup pattern. Original rent and electricity tables are not modified by the migration. Back up the database before deployment. Do not roll back to the old unit-based writer after accepting new ledger payments without reconciling those new entries.

The scheduled worker source is provided but **is not installed or started by deployment**:

```sh
npm run rent:catch-up   # one controlled, repeat-safe catch-up
npm run rent:worker     # repeats every five minutes; persistent DB required
```

After reviewing the release and receiving go-live approval, an operator can register `npm run rent:worker` in the existing process manager with the same working directory and database environment as Yardle. It must restart after a server reboot. Startup is a separate approved deployment action; the deploy script has not been changed to enable it. Every rent screen also catches up approved accounts. Unsigned accounts remain inactive even if the worker is running.

## Verification

Run `npm test`, `npm run typecheck`, and `npm run build`. If Windows denies the existing incremental TypeScript cache, `node node_modules/typescript/bin/tsc --noEmit --incremental false` performs the same type validation without writing that cache.

Automated cases cover legacy grouping, opening arrears and credit, cutover approval, partial weeks, month-end/leap-year dates, service start/end dates, rate changes, combined units, allocation gaps, 2/6/12-week coverage, separate service balances, duplicate catch-up, concurrent payment retries, stale previews, reversals, adjustments and SMS failure isolation. Before production use, also verify the MariaDB transaction paths with two workers and a backup/restore on staging; local automated workflow tests use the in-memory store.
