/* =============================================================================
   HR ↔ LMS Reconciler — reconciliation engine (pure, no DOM)
   -----------------------------------------------------------------------------
   Operates ONLY on data passed in. It has no knowledge of the demo dataset,
   no hard-coded people, and no hard-coded scenarios. Feed it correctly mapped
   rows from any HR + LMS export and it produces real findings.

   Canonical fields the UI maps arbitrary CSV columns onto:
     employees:   employee_id, name, email, status, job_level, manager_id, country
     lms_users:   lms_user_id, email, employee_id, lms_role, account_status
     assignments: email, employee_id, course_code, assignment_status, completion_date
   ========================================================================== */

const Engine = (() => {

  // --- normalisation helpers (tolerant of messy real-world values) ----------
  const norm = s => (s == null ? '' : String(s)).trim();
  const lc   = s => norm(s).toLowerCase();

  function normStatus(v){
    const s = lc(v);
    if (['active','a','employed','current','enabled','yes','true'].includes(s)) return 'active';
    if (['inactive','terminated','left','leaver','disabled','ended','no','false'].includes(s)) return 'inactive';
    return s || 'unknown';
  }
  function normLevel(v){
    const s = lc(v);
    if (/admin|director|head|vp|chief/.test(s)) return 'admin';
    if (/manager|lead|supervisor/.test(s))      return 'manager';
    if (/ic|individual|contributor|employee|staff|specialist|associate/.test(s)) return 'ic';
    return s || 'unknown';
  }
  // returns elevation rank so we can compare LMS role vs HR job level
  function roleRank(v){
    const s = lc(v);
    if (/admin|super/.test(s))              return 3;
    if (/power|manager|editor/.test(s))     return 2;
    if (/learner|user|viewer|member/.test(s)) return 1;
    return 0;
  }
  function levelRank(v){
    const s = normLevel(v);
    return {admin:3, manager:2, ic:1}[s] || 0;
  }

  // build a lookup key for identity matching: email first, else employee_id
  const idKey = r => lc(r.email) || lc(r.employee_id);

  // group an array by a key function -> Map
  function groupBy(arr, keyFn){
    const m = new Map();
    for (const x of arr){ const k = keyFn(x); if(!k) continue; (m.get(k) || m.set(k,[]).get(k)).push(x); }
    return m;
  }

  // --- the checks -----------------------------------------------------------
  // each pushes issue objects: {category, severity, subject, detail, fix, source}
  function reconcile({employees = [], lms_users = [], assignments = []}, rule){
    const issues = [];
    const add = (category, severity, subject, detail, fix) =>
      issues.push({category, severity, subject, detail, fix});

    const empByKey  = groupBy(employees, idKey);
    const lmsByKey  = groupBy(lms_users, idKey);
    const lmsByEmail = groupBy(lms_users, r => lc(r.email));

    // 1 — active employees with no LMS account
    for (const e of employees){
      if (normStatus(e.status) !== 'active') continue;
      if (!lmsByKey.has(idKey(e))){
        add('Missing LMS account','high',
          `${e.name || e.employee_id || e.email}`,
          `Active employee (${e.employee_id||'—'}, ${e.country||'—'}) has no matching LMS user`,
          'Provision an LMS account and assign onboarding/mandatory learning.');
      }
    }

    // 2 — LMS accounts that are active but shouldn't be (orphan or leaver)
    for (const u of lms_users){
      if (normStatus(u.account_status) === 'inactive') continue;
      const match = empByKey.get(idKey(u));
      if (!match){
        add('Orphaned LMS account','high',
          `${u.email || u.lms_user_id}`,
          `Active LMS account with no matching HR record`,
          'Verify the person; deactivate the account if they are not an employee.');
      } else if (match.every(e => normStatus(e.status) === 'inactive')){
        add('Leaver with active LMS access','high',
          `${u.email || u.lms_user_id}`,
          `LMS account is active but the matched employee is inactive/terminated`,
          'Deactivate the LMS account as part of offboarding.');
      }
    }

    // 3 — duplicates within a source (same identity key more than once)
    for (const [label, byKey] of [['HR', empByKey], ['LMS', lmsByEmail]]){
      for (const [key, list] of byKey){
        if (list.length > 1){
          add('Duplicate record','medium',
            key,
            `${list.length} ${label} records share the identity key "${key}"`,
            'Merge or de-duplicate; confirm which record is authoritative.');
        }
      }
    }

    // 4 — permission mismatch: LMS role more elevated than HR job level
    for (const u of lms_users){
      if (normStatus(u.account_status) === 'inactive') continue;
      const match = empByKey.get(idKey(u));
      if (!match) continue;                       // covered by check 2
      const e = match[0];
      if (roleRank(u.lms_role) >= 2 && levelRank(e.job_level) < roleRank(u.lms_role)){
        add('Permission mismatch','high',
          `${e.name || u.email}`,
          `LMS role "${u.lms_role}" exceeds HR job level "${e.job_level||'—'}"`,
          'Review with the system owner; downgrade unless a documented exception exists.');
      }
    }

    // 5 — rule-based assignment gap (the configurable control)
    if (rule && rule.course_code){
      const popField = rule.population_field || 'status';
      const popValue = lc(rule.population_value || 'active');
      const wantCompleted = !!rule.require_completion;
      const course = lc(rule.course_code);

      // index assignments by identity key for this course
      const assignForKey = groupBy(
        assignments.filter(a => lc(a.course_code) === course),
        idKey
      );

      let inPop = 0, ok = 0;
      for (const e of employees){
        // rules apply to active staff; the population filter narrows further
        if (normStatus(e.status) !== 'active') continue;
        if (popField !== 'status' && lc(e[popField]) !== popValue) continue;
        inPop++;
        const recs = assignForKey.get(idKey(e)) || [];
        const has = wantCompleted
          ? recs.some(a => lc(a.assignment_status) === 'completed' || norm(a.completion_date))
          : recs.length > 0;
        if (has){ ok++; continue; }
        add('Training rule gap','medium',
          `${e.name || e.employee_id}`,
          wantCompleted
            ? `In rule population but has not completed ${rule.course_code}`
            : `In rule population but has no ${rule.course_code} assignment`,
          wantCompleted ? 'Chase completion; send reminder.' : 'Create the assignment.');
      }
      rule._result = {population: inPop, satisfied: ok, gap: inPop - ok};
    }

    const order = {high:3, medium:2, low:1};
    issues.sort((a,b) => (order[b.severity]||0) - (order[a.severity]||0));

    return {
      issues,
      stats: {
        employees: employees.length,
        lms_users: lms_users.length,
        assignments: assignments.length,
        high: issues.filter(i => i.severity==='high').length,
        rule: rule && rule._result ? rule._result : null,
      }
    };
  }

  // --- tiny self-test so the core logic is verifiable (portfolio hygiene) ----
  function selfTest(){
    const employees = [
      {employee_id:'1', name:'A', email:'a@x', status:'active',   job_level:'ic',      country:'Finland'},
      {employee_id:'2', name:'B', email:'b@x', status:'inactive', job_level:'ic',      country:'Finland'},
      {employee_id:'3', name:'C', email:'c@x', status:'active',   job_level:'ic',      country:'Finland'},
    ];
    const lms_users = [
      {lms_user_id:'L1', email:'a@x', lms_role:'Power User', account_status:'active'}, // mismatch (ic)
      {lms_user_id:'L2', email:'b@x', lms_role:'Learner',    account_status:'active'}, // leaver active
      {lms_user_id:'L9', email:'z@x', lms_role:'Learner',    account_status:'active'}, // orphan
      // c@x has no LMS account -> missing
    ];
    const assignments = [{email:'a@x', course_code:'SEC101', assignment_status:'assigned'}];
    const rule = {population_field:'status', population_value:'active', course_code:'SEC101'};
    const {issues, stats} = reconcile({employees, lms_users, assignments}, rule);
    const has = c => issues.some(i => i.category === c);
    const results = {
      missing:  has('Missing LMS account'),
      orphan:   has('Orphaned LMS account'),
      leaver:   has('Leaver with active LMS access'),
      mismatch: has('Permission mismatch'),
      ruleGap:  has('Training rule gap'),           // c@x active, no SEC101 assignment
      ruleCount: stats.rule && stats.rule.gap === 1,
    };
    const pass = Object.values(results).every(Boolean);
    return {pass, results};
  }

  return {reconcile, selfTest, _internals:{normStatus, normLevel, roleRank, levelRank}};
})();

if (typeof module !== 'undefined') module.exports = Engine;
