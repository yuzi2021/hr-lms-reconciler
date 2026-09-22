# HR ↔ LMS Reconciler

A small, browser-only tool that reconciles an **HR export** against an **LMS export** and surfaces
the exceptions an HR-technology administrator otherwise finds by hand with monthly VLOOKUPs. It
reads your CSVs, lets you map the columns once, runs a set of checks, and writes an investigation
report you can file.

**Everything runs client-side.** Files are parsed in the browser; nothing is uploaded to any server.
That makes it safe to point at real employee data and is a deliberate data-protection choice.

## What it checks
| Check | Severity | Finds |
|---|---|---|
| Missing LMS account | high | active employees with no LMS user |
| Leaver with active LMS access | high | terminated employees whose LMS account is still active |
| Orphaned LMS account | high | active LMS accounts with no matching HR record |
| Permission mismatch | high | LMS role more elevated than the person's HR job level |
| Duplicate record | medium | the same identity appearing twice in a source |
| Training-rule gap | medium | a configured required course missing across a population |

Matching is by email first, employee ID as fallback. Status/role values are normalised so messy
real-world values ("Terminated", "Individual Contributor", "Power User") still line up.

## The configurable control
The training rule is the one thing *you* define — the tool can't know your policy:
> population = **active** employees where `country = Finland`, required course = `SEC101`

It then reports, e.g., "10 in population · 8 have SEC101 · 2 missing" and lists the two. Toggle
"require completion" to treat an assigned-but-not-completed course as a gap.

## Run it
- **Locally:** open `index.html` in a browser and click **Load demo data → Run reconciliation**.
- **Your own data:** choose an HR CSV and an LMS CSV (assignments optional), adjust the column
  mapping if the auto-guess missed anything, set the rule, and run.
- **Deploy:** push the folder to a repo and enable GitHub Pages (deploy from `main` / root).

Expected canonical fields (map your headers onto these):
- **employees:** `employee_id, name, email, status, job_level, manager_id, country`
- **lms_users:** `lms_user_id, email, employee_id, lms_role, account_status`
- **assignments:** `email, employee_id, course_code, assignment_status, completion_date`

Use the demo as a header template — the bundled CSVs deliberately have "messy" headers
(`Employee Number`, `Work Email`, …) so the mapping step has something to do.

## Files
- `engine.js` — the reconciliation logic, pure and DOM-free, with a `selfTest()` (shown as a badge in the UI)
- `demo-data.js` — synthetic demo CSVs (no real people)
- `app.js` — CSV parsing, column mapping, and UI wiring
- `index.html` — layout and styles

## By design it does **not**
- decide your policy — you configure the rule; it checks it accurately
- grant or revoke access — it flags a mismatch; a human investigates
- send anything anywhere — no network calls, no uploads

## Next steps
- Persist saved mappings per source (started — mappings restore from `localStorage`)
- Multiple rules at once
- A live API connector feeding the same engine instead of CSV uploads
- Split the checks into individually unit-tested modules

Concept demo. Bundled data is synthetic; replace it with correctly structured real exports and the
same checks run against them.
