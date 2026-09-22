# Where Docebo & Peakon leave manual work — and a small tool that helps

*Sarah Yuzi Sandström — a short investigation and a working prototype*

## Why I looked

Before assuming what an HR-technology admin's day looks like, I wanted to understand how the actual
platforms — Docebo (learning) and Workday Peakon (engagement) — handle the user and data lifecycle,
and where they leave gaps that a person has to close by hand. Below is what I found, and a small
tool I built to close one of those gaps.

## What the platforms already do well

Neither product is missing basic automation, and I'm not suggesting otherwise:

- **Docebo** can auto-provision users via SCIM (Enterprise tier), supports SAML/OIDC single sign-on,
  and **auto-enrols** users into courses and learning plans through enrolment rules tied to groups
  and branches.
- **Peakon** consumes employee data from an HRIS (or SCIM, or an Excel upload) to run engagement
  surveys, and can stop surveying people from their separation date.

So the *capabilities* exist. The gaps are in the seams between systems.

## The gaps that create manual work

**1. Deprovisioning falls back to manual.** Docebo's SCIM supports deactivation, but outside Okta
and Entra ID setups "manual fallback remains necessary." In practice that means leavers can retain
active LMS accounts until someone notices — a recurring offboarding and access-hygiene risk.

**2. Enrolment rules don't cover people who are already there.** Docebo enrolment rules only fire
when a user is *added* to a group or branch — "pre-existing members will not be automatically
enrolled," and deactivated users are skipped. So the moment a new mandatory course is introduced, or
a rule changes, the existing population silently isn't assigned, and compliance reporting looks fine
while people are missing.

**3. Manager hierarchy can't be auto-provisioned at all.** The Direct Manager field can't be
populated through SCIM, JIT, or connectors — so reporting lines are maintained manually and drift
away from the HR system of record.

**4. Peakon depends on a clean, current population.** It anchors people on a unique email and/or
employee number and needs correct active-status and separation data to survey the right group. When
the HR feed and Peakon disagree, the fix is a manual data-quality reconciliation.

Common thread: none of these is a missing *feature*. They're **drift between systems** that no single
platform audits, because each platform only sees its own side. That reconciliation is exactly the
work that ends up in a monthly spreadsheet.

## The prototype: HR ↔ LMS Reconciler

A small, browser-only tool that takes an HR export and an LMS export, maps the columns once, and
flags the exceptions the platforms don't catch themselves:

| Finding | The gap it addresses |
|---|---|
| Active employee with no LMS account | provisioning misses / partial integration |
| Leaver with active LMS access | gap #1 — incomplete deprovisioning |
| Orphaned LMS account (no HR match) | drift / manual account creation |
| LMS role above HR job level | no cross-system entitlement check |
| Duplicate record | messy multi-source data |
| Training-rule gap (required course missing) | gap #2 — no retroactive enrolment |

It runs a configurable training rule ("active employees in Finland must have SEC101"), then writes a
remediation report ready to paste into Confluence or a ticket. **Everything runs in the browser —
no employee data is uploaded anywhere**, which is a deliberate data-protection choice.

## Honest scope

This is a concept demo with synthetic data, not a product. It doesn't decide policy (you configure
the rule), it doesn't grant or revoke access (it flags; a human acts), and it reads CSV exports
rather than live systems. A production version would read Docebo's REST API and the Peakon/HRIS feed
on a schedule and post exceptions straight into Jira — the same checks, without the manual export.

## Sources
- Docebo SCIM provisioning capabilities and limitations — Stitchflow
- Docebo enrolment rules (Docebo Help & Support)
- Workday Peakon employee sync integrations (Workday Peakon documentation)
