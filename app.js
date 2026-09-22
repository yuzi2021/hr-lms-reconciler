/* =============================================================================
   HR ↔ LMS Reconciler — UI wiring (DOM only; reconciliation lives in engine.js)
   ========================================================================== */

// canonical fields per source + keyword hints for auto-mapping
const CANON = {
  employees:   ['employee_id','name','email','status','job_level','manager_id','country'],
  lms_users:   ['lms_user_id','email','employee_id','lms_role','account_status'],
  assignments: ['email','employee_id','course_code','assignment_status','completion_date'],
};
const HINTS = {
  employee_id:['employee number','employee id','emp id','staff id','personnel','emp no','id'],
  name:['full name','name','employee name'],
  email:['work email','email','e-mail','mail'],
  status:['employment status','status','employment','state'],
  job_level:['job level','level','role','title','position'],
  manager_id:['manager id','manager','supervisor','reports to'],
  country:['country','location','region'],
  lms_user_id:['user id','lms id','account id','id'],
  lms_role:['lms role','role','permission','profile'],
  account_status:['account status','status','state','enabled'],
  course_code:['course code','course','code','learning'],
  assignment_status:['assignment status','status','state'],
  completion_date:['completion date','completed','completion','date'],
};
const LABELS = {employees:'HR export', lms_users:'LMS users', assignments:'Assignments'};

const state = { raw:{}, headers:{}, mapping:{} };   // raw[src]=rows(obj by header), headers[src]=[], mapping[src]={canon:header}

// --- minimal CSV parser (handles quoted fields with commas) ----------------
function parseCSV(text){
  const rows = []; let row = [], cur = '', q = false;
  for (let i=0;i<text.length;i++){
    const c = text[i];
    if (q){
      if (c === '"' && text[i+1] === '"'){ cur+='"'; i++; }
      else if (c === '"'){ q = false; }
      else cur += c;
    } else {
      if (c === '"') q = true;
      else if (c === ','){ row.push(cur); cur=''; }
      else if (c === '\n'){ row.push(cur); rows.push(row); row=[]; cur=''; }
      else if (c === '\r'){ /* skip */ }
      else cur += c;
    }
  }
  if (cur.length || row.length){ row.push(cur); rows.push(row); }
  const header = (rows.shift()||[]).map(h=>h.trim());
  const objs = rows.filter(r=>r.some(c=>c.trim()!=='')).map(r=>{
    const o={}; header.forEach((h,i)=> o[h]=(r[i]||'').trim()); return o;
  });
  return {header, objs};
}

// --- auto-map headers -> canonical fields -----------------------------------
function autoMap(src, headers){
  const m = {}; const used = new Set();
  for (const field of CANON[src]){
    const hints = HINTS[field] || [field];
    let best = '';
    for (const h of hints){
      const hit = headers.find(H => !used.has(H) && H.toLowerCase() === h);
      if (hit){ best = hit; break; }
    }
    if (!best){                                   // loose contains match
      for (const h of hints){
        const hit = headers.find(H => !used.has(H) && H.toLowerCase().includes(h));
        if (hit){ best = hit; break; }
      }
    }
    if (best){ m[field] = best; used.add(best); }
  }
  return m;
}

// --- ingest one source ------------------------------------------------------
function ingest(src, text){
  const {header, objs} = parseCSV(text);
  state.raw[src] = objs; state.headers[src] = header;
  state.mapping[src] = restoreMapping(src, header) || autoMap(src, header);
  // reflect in UI
  const box = document.getElementById('src-'+src);
  box.classList.add('loaded');
  box.querySelector('.st').textContent = objs.length + ' rows loaded';
  renderMaps(); renderRuleFields(); refreshRunState();
}

// --- mapping UI -------------------------------------------------------------
function renderMaps(){
  const loaded = Object.keys(state.raw);
  if (!loaded.length){ document.getElementById('mapStep').classList.add('hidden'); return; }
  document.getElementById('mapStep').classList.remove('hidden');
  document.getElementById('ruleStep').classList.remove('hidden');
  const host = document.getElementById('maps'); host.innerHTML='';
  for (const src of loaded){
    const headers = state.headers[src];
    const card = document.createElement('div'); card.className='map';
    card.innerHTML = `<h3>${LABELS[src]}</h3>` + CANON[src].map(field=>{
      const sel = state.mapping[src][field] || '';
      const opts = ['<option value="">— none —</option>']
        .concat(headers.map(h=>`<option ${h===sel?'selected':''}>${h}</option>`)).join('');
      return `<div class="row"><label>${field}</label>
        <select data-src="${src}" data-field="${field}">${opts}</select></div>`;
    }).join('');
    host.appendChild(card);
  }
  host.querySelectorAll('select').forEach(s=> s.onchange = e=>{
    state.mapping[e.target.dataset.src][e.target.dataset.field] = e.target.value;
    saveMapping(e.target.dataset.src);
  });
}

function renderRuleFields(){
  const sel = document.getElementById('ruleField');
  const cur = sel.value || 'country';
  sel.innerHTML = CANON.employees.map(f=>`<option ${f===cur?'selected':''}>${f}</option>`).join('');
}

// --- apply mapping: raw rows -> canonical rows ------------------------------
function canonical(src){
  const map = state.mapping[src] || {};
  return (state.raw[src]||[]).map(r=>{
    const o={}; for (const field of CANON[src]) o[field] = map[field] ? r[map[field]] : '';
    return o;
  });
}

// --- run --------------------------------------------------------------------
let lastIssues = [];
function run(){
  const datasets = {
    employees:   canonical('employees'),
    lms_users:   canonical('lms_users'),
    assignments: state.raw.assignments ? canonical('assignments') : [],
  };
  const rule = {
    population_field: document.getElementById('ruleField').value,
    population_value: document.getElementById('ruleValue').value,
    course_code:      document.getElementById('ruleCourse').value.trim(),
    require_completion: document.getElementById('ruleComplete').checked,
  };
  const {issues, stats} = Engine.reconcile(datasets, rule);
  lastIssues = issues.map(i=>({...i, checked:true}));
  renderKPIs(stats); renderGroups(); buildReport();
  document.getElementById('resultStep').classList.remove('hidden');
  document.getElementById('reportStep').classList.remove('hidden');
  document.getElementById('resultStep').scrollIntoView({behavior:'smooth', block:'start'});
}

function renderKPIs(stats){
  const k = [
    {n:stats.employees, l:'HR records'},
    {n:stats.lms_users, l:'LMS accounts'},
    {n:lastIssues.length, l:'Findings'},
    {n:stats.high, l:'High severity', alert:stats.high>0},
    {n:stats.rule ? stats.rule.gap : '—', l:'Training-rule gaps', alert:stats.rule && stats.rule.gap>0},
  ];
  document.getElementById('kpis').innerHTML = k.map(x=>
    `<div class="kpi ${x.alert?'alert':''}"><div class="n">${x.n}</div><div class="l">${x.l}</div></div>`).join('');
  const rb = document.getElementById('rulebar');
  if (stats.rule){
    const c = document.getElementById('ruleCourse').value.trim();
    rb.classList.remove('hidden');
    rb.innerHTML = `<b>Rule:</b> ${stats.rule.population} active employees match the population · `+
      `<b>${stats.rule.satisfied}</b> have ${c} · <b>${stats.rule.gap}</b> missing`;
  } else rb.classList.add('hidden');
}

const SEV = {high:'high', medium:'medium', low:'low'};
function renderGroups(){
  const host = document.getElementById('groups');
  if (!lastIssues.length){ host.innerHTML = `<div class="empty">No exceptions found. 🎉</div>`; return; }
  const cats = [...new Set(lastIssues.map(i=>i.category))];
  host.innerHTML = cats.map(cat=>{
    const list = lastIssues.filter(i=>i.category===cat);
    const sev = list[0].severity;
    return `<div class="group">
      <h3><span class="sev ${SEV[sev]}">${sev.toUpperCase()}</span> ${cat} <span class="sub">· ${list.length}</span></h3>
      <table><thead><tr><th>Subject</th><th class="hide-sm">Detail</th><th class="hide-sm">Recommended action</th><th>Report</th></tr></thead>
      <tbody>${list.map(i=>{
        const idx = lastIssues.indexOf(i);
        return `<tr>
          <td><b>${esc(i.subject)}</b></td>
          <td class="hide-sm sub">${esc(i.detail)}</td>
          <td class="hide-sm fix">${esc(i.fix)}</td>
          <td class="pick"><input type="checkbox" data-i="${idx}" ${i.checked?'checked':''}></td>
        </tr>`;
      }).join('')}</tbody></table></div>`;
  }).join('');
  host.querySelectorAll('input[type=checkbox]').forEach(cb=>
    cb.onchange = e=>{ lastIssues[+e.target.dataset.i].checked = e.target.checked; buildReport(); });
}
const esc = s => String(s==null?'':s).replace(/[&<>]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));

// --- report -----------------------------------------------------------------
function buildReport(){
  const picked = lastIssues.filter(i=>i.checked);
  const cats = [...new Set(picked.map(i=>i.category))];
  const body = cats.map(cat=>{
    const list = picked.filter(i=>i.category===cat);
    return `\n## ${cat} (${list.length})\n` + list.map(i=>
      `- ${i.subject} — ${i.detail}\n    → ${i.fix}`).join('\n');
  }).join('\n');
  const txt =
`# HR ↔ LMS reconciliation report
Generated: ${new Date().toISOString().slice(0,10)}
HR records: ${(state.raw.employees||[]).length} · LMS accounts: ${(state.raw.lms_users||[]).length} · Findings included: ${picked.length}/${lastIssues.length}

## Summary
- High: ${picked.filter(i=>i.severity==='high').length}
- Medium: ${picked.filter(i=>i.severity==='medium').length}
- Low: ${picked.filter(i=>i.severity==='low').length}
${body}

---
Generated locally by HR ↔ LMS Reconciler (concept demo). Review before acting.`;
  document.getElementById('reportText').textContent = txt;
  return txt;
}
function issuesCSV(){
  const rows = [['category','severity','subject','detail','recommended_action']]
    .concat(lastIssues.filter(i=>i.checked).map(i=>[i.category,i.severity,i.subject,i.detail,i.fix]));
  return rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
}

// --- persistence (best-effort; may be blocked on file://) -------------------
function saveMapping(src){ try{ localStorage.setItem('map:'+src, JSON.stringify(state.mapping[src])); }catch(e){} }
function restoreMapping(src, header){
  try{ const m = JSON.parse(localStorage.getItem('map:'+src)||'null');
    if (m && Object.values(m).every(h=>!h || header.includes(h))) return m; }catch(e){}
  return null;
}

// --- helpers ----------------------------------------------------------------
function download(name, text, type='text/plain'){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([text],{type})); a.download=name; a.click(); URL.revokeObjectURL(a.href);
}
function refreshRunState(){
  const ready = state.raw.employees && state.raw.lms_users;
  document.getElementById('runBtn').disabled = !ready;
}

// --- wiring -----------------------------------------------------------------
let pendingSrc = null;
document.querySelectorAll('[data-load]').forEach(b=> b.onclick = ()=>{
  pendingSrc = b.dataset.load; document.getElementById('fileInput').click();
});
document.getElementById('fileInput').onchange = e=>{
  const f=e.target.files[0]; if(!f||!pendingSrc) return;
  const rd=new FileReader(); rd.onload=()=>ingest(pendingSrc, rd.result); rd.readAsText(f);
  e.target.value='';
};
document.getElementById('demoBtn').onclick = ()=>{
  ingest('employees', DEMO.employees);
  ingest('lms_users', DEMO.lms_users);
  ingest('assignments', DEMO.assignments);
};
document.getElementById('clearBtn').onclick = ()=>{
  state.raw={}; state.headers={}; state.mapping={};
  ['employees','lms_users','assignments'].forEach(s=>{
    const b=document.getElementById('src-'+s); b.classList.remove('loaded'); b.querySelector('.st').textContent='no file';
  });
  ['mapStep','ruleStep','resultStep','reportStep'].forEach(id=>document.getElementById(id).classList.add('hidden'));
  refreshRunState();
};
document.getElementById('runBtn').onclick = run;
document.getElementById('copyBtn').onclick = ()=>{
  navigator.clipboard.writeText(document.getElementById('reportText').textContent)
    .then(()=>{const b=document.getElementById('copyBtn');b.textContent='Copied';setTimeout(()=>b.textContent='Copy',1200);});
};
document.getElementById('dlMdBtn').onclick  = ()=> download('hr_lms_report.md', buildReport());
document.getElementById('dlCsvBtn').onclick = ()=> download('hr_lms_findings.csv', issuesCSV(), 'text/csv');

// engine self-test badge on load
(function(){
  renderRuleFields();
  try{
    const t = Engine.selfTest();
    const b = document.getElementById('testBadge');
    b.textContent = 'engine self-test: ' + (t.pass ? 'passing' : 'FAILING');
    b.classList.toggle('pass', t.pass);
  }catch(e){ document.getElementById('testBadge').textContent='engine self-test: error'; }
})();
