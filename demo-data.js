/* =============================================================================
   Bundled demonstration dataset — synthetic, no real people.
   These are raw CSV strings with deliberately "messy" real-world headers, so
   the column-mapping step has something to actually do. They flow through the
   exact same parse → map → reconcile pipeline as a user's own uploads.
   ========================================================================== */

const DEMO = {
  employees:
`Employee Number,Full Name,Work Email,Employment Status,Job Level,Manager ID,Country
E-1001,Aino Virtanen,aino.virtanen@demo.fi,Active,Individual Contributor,E-1002,Finland
E-1002,Mikael Korhonen,mikael.korhonen@demo.fi,Active,Manager,E-1004,Finland
E-1003,Sofia Nieminen,sofia.nieminen@demo.fi,Active,Individual Contributor,E-1002,Finland
E-1004,Elias Makinen,elias.makinen@demo.fi,Active,Director,,Finland
E-1005,Noora Laine,noora.laine@demo.se,Active,Individual Contributor,E-1002,Sweden
E-1006,Ville Heikkinen,ville.heikkinen@demo.fi,Terminated,Individual Contributor,E-1002,Finland
E-1007,Emma Salminen,emma.salminen@demo.fi,Active,Manager,E-1004,Finland
E-1008,Otto Jarvinen,otto.jarvinen@demo.de,Active,Individual Contributor,E-1007,Germany
E-1009,Laura Koskinen,laura.koskinen@demo.fi,Active,Individual Contributor,E-1007,Finland
E-1010,Daniel Aaltonen,daniel.aaltonen@demo.fi,Active,Individual Contributor,E-1004,Finland
E-1011,Helmi Rantala,helmi.rantala@demo.fi,Active,Manager,E-1004,Finland
E-1012,Jonas Lind,jonas.lind@demo.se,Terminated,Individual Contributor,E-1002,Sweden
E-1013,Aada Salo,aada.salo@demo.fi,Active,Individual Contributor,E-1007,Finland
E-1014,Onni Tuominen,onni.tuominen@demo.fi,Active,Individual Contributor,E-1007,Finland`,

  lms_users:
`User ID,Email,Linked Employee,LMS Role,Account Status
L-2001,aino.virtanen@demo.fi,E-1001,Power User,Active
L-2002,mikael.korhonen@demo.fi,E-1002,Manager,Active
L-2003,sofia.nieminen@demo.fi,E-1003,Learner,Active
L-2004,sofia.nieminen@demo.fi,E-1003,Learner,Active
L-2005,elias.makinen@demo.fi,E-1004,Admin,Active
L-2006,noora.laine@demo.se,E-1005,Learner,Active
L-2007,ville.heikkinen@demo.fi,E-1006,Learner,Active
L-2008,emma.salminen@demo.fi,E-1007,Manager,Active
L-2009,otto.jarvinen@demo.de,E-1008,Learner,Active
L-2010,laura.koskinen@demo.fi,E-1009,Learner,Active
L-2011,daniel.aaltonen@demo.fi,E-1010,Manager,Active
L-2012,helmi.rantala@demo.fi,E-1011,Manager,Active
L-2013,jonas.lind@demo.se,E-1012,Learner,Inactive
L-2014,contractor.temp@demo.fi,,Learner,Active
L-2015,onni.tuominen@demo.fi,E-1014,Learner,Active`,

  assignments:
`Email,Course Code,Assignment Status,Completion Date
aino.virtanen@demo.fi,SEC101,Completed,2026-03-14
mikael.korhonen@demo.fi,SEC101,Completed,2026-02-02
sofia.nieminen@demo.fi,SEC101,Assigned,
elias.makinen@demo.fi,SEC101,Completed,2026-01-20
emma.salminen@demo.fi,SEC101,Completed,2026-04-11
otto.jarvinen@demo.de,SEC101,Assigned,
daniel.aaltonen@demo.fi,SEC101,Completed,2026-05-30
helmi.rantala@demo.fi,SEC101,Assigned,
aada.salo@demo.fi,SEC101,Assigned,
aino.virtanen@demo.fi,ONBOARD01,Completed,2025-06-01`
};

/* Notes on what the demo data is engineered to surface (via the engine, not
   hard-coded): Aada Salo (E-1013) active but has no LMS account; Ville
   Heikkinen (E-1006) terminated but LMS still active; contractor.temp has an
   LMS account but no HR record; Sofia Nieminen appears twice in the LMS export;
   Aino (IC) holds Power User and Daniel (IC) holds Manager; and against a
   "active Finland must have SEC101" rule, Laura Koskinen and Onni Tuominen have
   no SEC101 assignment. */
