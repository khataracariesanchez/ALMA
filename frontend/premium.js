/* =====================================================================
   Reqvio Premium + Theme layer. Load AFTER app.js. app.js is not edited.
   It wraps the existing ACT handlers, addFiles() and render(), adds two
   pages (Revision Comparison, Research History) and a light/dark toggle.

   Plans:
     Free           $0
     Student Pro    $1.49 / month   or $12.99 / year (save 27%)   individual researchers
     Research Team  $3.49 / month   or $31.99 / year (save 24%)   up to 5 members
     Research Pass  $2.99 one-time, 90 days: 20 AI checks, revision comparison, PDF reports

   IMPORTANT: this layer gates the interface only. Enforce the same limits
   in your Python backend, because anything in the browser can be bypassed.
   ===================================================================== */
(function(){
'use strict';

/* ---------- THEME (light / dark / follow device) ---------- */
var THEME_KEY='reqvio_theme', mq=null;
try{ mq=window.matchMedia('(prefers-color-scheme: dark)'); }catch(e){}
function savedTheme(){ try{ var v=localStorage.getItem(THEME_KEY); return (v==='light'||v==='dark')?v:null; }catch(e){ return null; } }
function applyTheme(){
  var t=savedTheme(), r=document.documentElement;
  if(t) r.setAttribute('data-theme',t); else r.removeAttribute('data-theme');
}
function effectiveTheme(){ return savedTheme()||((mq&&mq.matches)?'dark':'light'); }
function setTheme(v){
  try{ if(v==='light'||v==='dark') localStorage.setItem(THEME_KEY,v); else localStorage.removeItem(THEME_KEY); }catch(e){}
  applyTheme(); render(true);
}
applyTheme();
if(mq){ var onMq=function(){ if(!savedTheme()) render(true); }; if(mq.addEventListener) mq.addEventListener('change',onMq); else if(mq.addListener) mq.addListener(onMq); }

/* ---------- plans and limits (edit the numbers here) ---------- */
var PLAN_NAME={free:'Free',student:'Student Pro',team:'Research Team',pass:'Research Pass'};
var PLANS={
  free:   {name:'Free',          sub:'Start your first research project', m:'$0',    aud:'Always free',               icon:'file'},
  student:{name:'Student Pro',   sub:'Everything for your own research',  m:'$1.49', y:'$12.99', save:'27%', aud:'For individual researchers', icon:'crown'},
  team:   {name:'Research Team', sub:'Research together with evidence',   m:'$3.49', y:'$31.99', save:'24%', aud:'Up to 5 members',           icon:'users'},
  pass:   {name:'Research Pass', sub:'20 AI checks, revision comparison, and PDF reports.', m:'$2.99', aud:'for 90 days', icon:'spark'}
};
var COL={free:1,student:2,team:3,pass:4};
var PASS_DAYS=90;
var LIMITS={
  free:   {checks:2,  docs:2,  fileMB:5,  workspaces:1,  members:1, tasks:10,       compare:false, pdf:false, feedback:false, history:false},
  pass:   {checks:20, docs:10, fileMB:25, workspaces:1,  members:1, tasks:10,       compare:true,  pdf:true,  feedback:false, history:false},
  student:{checks:15, docs:25, fileMB:25, workspaces:3,  members:1, tasks:Infinity, compare:true,  pdf:true,  feedback:true,  history:true},
  team:   {checks:40, docs:50, fileMB:50, workspaces:10, members:5, tasks:Infinity, compare:true,  pdf:true,  feedback:true,  history:true}
};
var HISTORY_FREE=3; /* plans without full history show only this many recent checks */

/* feature lists on the plan cards: [feature, free, student, team, pass, key] */
var ROWS=[
  ['AI research checks','2 per month','15 per month','40 per month, shared','20 checks in 90 days','checker'],
  ['Research projects','1 project','3 projects','10 projects','1 project','workspaces'],
  ['AI revision comparison','Not included','Included','Included','Included','compare'],
  ['Detailed AI feedback','Basic','Full','Full','Basic','checker'],
  ['PDF reports','Not included','Included','Included','Included','reports'],
  ['Team collaboration','Not included','Not included','Up to 5 members with contribution tracking','Not included','collab'],
  ['Document uploads','2 documents, files up to 5 MB','25 documents, files up to 25 MB','50 documents, files up to 50 MB','10 documents, files up to 25 MB','uploads'],
  ['Research history','Recent checks only','Full history and detailed progress','Full history and detailed progress','Recent checks only','history']
];
var WHY={
  checks:['You have used your AI checks','Free includes 2 AI checks per month. Student Pro has 15 per month, Research Team has 40 shared, and the Research Pass gives 20 checks for 90 days.'],
  uploads:['Upload limit reached','Free includes 2 documents and files up to 5 MB. Paid plans allow larger files and more documents.'],
  compare:['Revision Comparison is a paid feature','Compare old and revised drafts to see which requirements improved. Included in the Research Pass, Student Pro, and Research Team.'],
  workspaces:['You have reached your project limit','Free includes 1 research project. Student Pro allows 3 and Research Team allows 10.'],
  collab:['Collaboration limit reached','Team collaboration is part of Research Team: up to 5 members with contribution tracking. Free, Student Pro, and the Research Pass are single-member.'],
  reports:['PDF reports are a paid feature','The Research Pass, Student Pro, and Research Team export a teacher-ready PDF report with evidence.'],
  history:['Full history and detailed progress are paid features','Student Pro and Research Team keep the full review history and detailed progress. Other plans show recent checks only.'],
  plans:['Free, Student Pro, Research Team, and Research Pass','See what each plan includes.']
};

/* ---------- storage (swap for your backend when accounts are real) ---------- */
function skey(n){ return 'reqvio_'+n+'_'+((state.user&&state.user.email)||'guest'); }
function load(n,def){ try{ var v=localStorage.getItem(skey(n)); return v?JSON.parse(v):def; }catch(e){ return def; } }
function save(n,v){ try{ localStorage.setItem(skey(n),JSON.stringify(v)); }catch(e){} }

/* ---------- plan state ---------- */
/* Your backend can set state.user.plan = 'student' | 'team' | 'pass' (and state.user.passEnd) after login.
   Until then the plan is kept in localStorage. */
function passEnd(){ return (state.user&&state.user.passEnd)||load('passEnd',null); }
function passStart(){ return load('passStart',null); }
function passDaysLeft(){ var e=passEnd(); return e?Math.max(0,Math.ceil((new Date(e)-new Date())/864e5)):0; }
function plan(){
  var p=(state.user&&state.user.plan)||load('plan','free');
  if(p==='premium') p='student';                       /* older saved value */
  if(p==='pass'){ var e=passEnd(); if(e&&new Date(e)<new Date()) p='free'; }   /* pass expired */
  return PLANS[p]?p:'free';
}
function isPremium(){ return plan()!=='free'; }         /* any paid plan */
function isTeam(){ return plan()==='team'; }
function hasSub(){ return plan()==='student'||plan()==='team'; }
function lim(){ return LIMITS[plan()]; }
function setPlan(p,cycle){
  save('plan',p); if(cycle) save('cycle',cycle);
  if(p==='pass'){ var n=new Date(); save('passStart',n.toISOString()); save('passEnd',new Date(n.getTime()+PASS_DAYS*864e5).toISOString()); }
  if(state.user&&state.user.plan) state.user.plan=p;
}
function ledCount(){ return state.ws.filter(function(w){return w.role==='leader';}).length; }
function canCreateWs(){ return ledCount()<lim().workspaces; }
function canAddMember(ws){ return ws.members.length<lim().members; }
function plural(n,w){ return n+' '+w+(n===1?'':'s'); }

/* ---------- review history (also the source of the monthly check count) ---------- */
function mk(d){ return d.getFullYear()+'-'+(d.getMonth()+1); }
function allHistory(){ return load('history',[]); }
function wsHistory(id){ return allHistory().filter(function(h){return h.ws===id;}); }
function checksUsed(){
  var h=allHistory();
  if(plan()==='pass'){ var ps=passStart(); return h.filter(function(x){return !ps||new Date(x.at)>=new Date(ps);}).length; }   /* pass checks are counted since purchase */
  var m=mk(new Date()); return h.filter(function(x){return mk(new Date(x.at))===m;}).length;
}
function fmtT(iso){ return new Date(iso).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}); }
function logCheck(ws){
  var h=allHistory(), d=ws.docs.filter(function(x){return x.type==='Draft';})[0];
  h.unshift({id:'h'+Date.now(),ws:ws.id,wsName:ws.name,at:new Date().toISOString(),by:state.user.name,draft:d?d.name:'Draft',counts:null,snap:null});
  if(h.length>200) h.length=200;
  save('history',h);
}
/* Called automatically when state.running goes back to null (see render wrapper).
   Saves the result counts and a per-requirement snapshot used by Revision Comparison. */
function completeReview(ws){
  if(!ws||!ws.findings||!ws.findings.length) return;
  var h=allHistory(), e=h.filter(function(x){return x.ws===ws.id&&!x.counts;})[0];
  if(!e) return;
  e.counts=counts(ws);
  e.snap=ws.findings.map(function(f){return {id:f.id,title:f.title,status:f.status,score:f.score};});
  save('history',h);
}

/* ---------- small html helpers ---------- */
P.crown='M3 8l4 4 5-7 5 7 4-4-2 11H5z';
P.lock='M6 11h12v9H6z M8 11V8a4 4 0 0 1 8 0v3';
P.history='M3 12a9 9 0 1 0 3-6.7 M3 4v5h5 M12 8v4l3 2';
P.compare='M8 3L4 7l4 4 M4 7h12 M16 21l4-4-4-4 M20 17H8';
P.back='M19 12H5 M11 6l-6 6 6 6';
P.sun='M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4';
P.moon='M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z';
function badge(label){ return '<span class="pbadge">'+ic('crown','sm')+esc(label||'Premium')+'</span>'; }
function themeBtn(cls){
  var dark=effectiveTheme()==='dark', t=dark?'Switch to light mode':'Switch to dark mode';
  return '<button class="themebtn '+(cls||'')+'" data-act="theme" aria-label="'+t+'" title="'+t+'">'+ic(dark?'sun':'moon')+'</button>';
}
function lockCard(title,text,key,label){
  return '<div class="card pm-lock pm-gap"><span class="fileico">'+ic('lock')+'</span><div class="grow"><h3>'+esc(title)+' '+badge(label)+'</h3><p class="note">'+esc(text)+'</p></div>'+
    '<button class="btn small primary" data-act="upgrade" data-r="'+key+'">Upgrade</button></div>';
}
function upsell(text,key){
  return '<div class="banner upsell pm-gap-s">'+ic('crown','sm')+'<span>'+esc(text)+'</span><button class="btn small" data-act="upgrade" data-r="'+key+'">See plans</button></div>';
}
function afterHead(html){ var h=document.querySelector('.main-in .pagehead'); if(h) h.insertAdjacentHTML('afterend',html); }
function appendPage(html){ var m=document.querySelector('.main-in'); if(m) m.insertAdjacentHTML('beforeend',html); }

/* ---------- upgrade pages: plans, then checkout (separate full-screen pages) ---------- */
var UP={step:'plans',key:'plans',msg:'',prev:'home',plan:'student',cycle:'month'};
/* every "Upgrade" button in the app calls this and lands on the Upgrade page */
function openModal(key,msg){
  if(state.view!=='upgrade') UP.prev=state.view;
  UP.step='plans'; UP.key=key||'plans'; UP.msg=msg||'';
  state.view='upgrade'; state.menu=false; render(false);
}
function leaveUpgrade(){ UP.step='plans'; state.view=UP.prev||'home'; render(false); }
function featList(col,key){
  return '<ul>'+ROWS.map(function(r){
    var off=(r[col]==='Not included');
    return '<li class="'+(off?'off':'')+(r[5]===key?' hl':'')+'">'+ic(off?'x':'check')+
      '<span class="up-ft"><b>'+esc(r[0])+'</b><span>'+esc(r[col])+'</span></span></li>'; }).join('')+'</ul>';
}
function planCard(id){
  var p=PLANS[id], now=plan()===id, paid=id!=='free';
  var yr=paid
    ? '<div class="up-yr"><div class="up-price"><b>'+esc(p.y)+'</b><span>/year</span></div><p class="up-save">Save '+esc(p.save)+' annually</p><p class="up-aud">'+esc(p.aud)+'</p></div>'
    : '<div class="up-yr"><p class="up-aud">'+esc(p.aud)+'</p></div>';
  var cta=now?'<button class="btn up-cta'+(paid?' primary':'')+'" disabled>Your current plan</button>'
    : paid?'<button class="btn primary up-cta" data-act="pmcheckout" data-plan="'+id+'">'+(hasSub()?'Switch to ':'Get ')+esc(p.name)+'</button>'
    :'<button class="btn up-cta" data-act="pmdowngrade">Switch to Free</button>';
  var small=now?(paid?'Every '+p.name+' feature is unlocked.':'AI checks used this month: '+checksUsed()+' of '+LIMITS.free.checks+'.')
    : paid?'Choose monthly or yearly at checkout.':'Free limits apply again after you switch.';
  return '<section class="up-card'+(paid?' pro':'')+'" aria-labelledby="up-'+id+'">'+
    '<div class="up-top">'+(now?'<span class="up-tag">Current plan</span>':'')+'<span class="up-ico">'+ic(p.icon)+'</span>'+
    '<h2 class="up-name" id="up-'+id+'">'+esc(p.name)+'</h2><p class="up-sub">'+esc(p.sub)+'</p>'+
    '<div class="up-price"><b>'+esc(p.m)+'</b><span>/month</span></div>'+yr+cta+'<p class="up-small">'+esc(small)+'</p></div>'+
    '<div class="up-list"><p class="up-lh">'+(paid?'What you get':'Included')+'</p>'+featList(COL[id],UP.key)+'</div></section>';
}
function passCard(){
  var p=PLANS.pass, now=plan()==='pass';
  var cta=now?'<button class="btn primary up-cta" disabled>Active · '+plural(passDaysLeft(),'day')+' left</button>'
    : hasSub()?'<button class="btn up-cta" disabled>Included in your plan</button>'
    :'<button class="btn primary up-cta" data-act="pmcheckout" data-plan="pass">Get Research Pass</button>';
  var small=now?checksUsed()+' of '+LIMITS.pass.checks+' checks used.':hasSub()?'Your plan already covers this.':'Pay once. It does not renew.';
  return '<section class="up-card pro up-pass" aria-labelledby="up-pass"><span class="up-tag">One-time</span>'+
    '<div class="up-passinfo"><h2 class="up-name" id="up-pass">'+esc(p.name)+'</h2>'+
    '<div class="up-price"><b>'+esc(p.m)+'</b><span>'+esc(p.aud)+'</span></div>'+
    '<p class="up-aud" style="margin:0">'+esc(p.sub)+'</p></div>'+
    '<div class="up-passcta">'+cta+'<p class="up-small">'+esc(small)+'</p></div></section>';
}
function plansHTML(){
  var w=WHY[UP.key]||WHY.plans;
  var why=(UP.key!=='plans'||UP.msg)?'<div class="up-why">'+ic('crown')+'<div><b>'+esc(UP.key==='plans'?'Plans':w[0])+'</b><p>'+esc(UP.msg||w[1])+'</p></div></div>':'';
  return '<div class="up-head"><h1>Reqvio Premium Pricing (USD)</h1><p>Student-friendly subscription prices in US dollars. Pick a monthly or yearly plan, or get a one-time Research Pass.</p></div>'+
    why+'<div class="up-grid">'+planCard('free')+planCard('student')+planCard('team')+'</div>'+passCard()+
    '<p class="up-foot">Prices are in USD and are placeholders until payment is connected. Limits apply per account.</p>';
}
function checkoutHTML(){
  var p=PLANS[UP.plan], pass=UP.plan==='pass', yr=!pass&&UP.cycle==='year', price=pass?p.m:(yr?p.y:p.m), per=pass?'one-time':(yr?'USD / year':'USD / month');
  var billing=pass
    ? '<p class="note" style="margin:10px 0 4px">One payment for '+PASS_DAYS+' days of access. It does not renew.</p>'
    : '<div class="tabs up-cycle" role="tablist" aria-label="Billing period"><button role="tab" aria-selected="'+!yr+'" data-act="pmcycle" data-c="month">Monthly</button><button role="tab" aria-selected="'+yr+'" data-act="pmcycle" data-c="year">Yearly</button></div>'+
      (yr?'<p class="up-save" style="margin:8px 0 4px">You save '+esc(p.save)+' compared with paying monthly.</p>':'<p class="note" style="margin:8px 0 4px">Yearly is '+esc(p.y)+' and saves '+esc(p.save)+'.</p>');
  return '<div class="up-co"><div class="up-head"><h1>Confirm your upgrade</h1><p>'+(pass?'Review what you get before you continue.':'Choose how you want to be billed, then review what you get.')+'</p></div>'+
    '<div class="card"><div class="row"><span class="fileico">'+ic(p.icon)+'</span><div class="grow"><div class="t">Reqvio '+esc(p.name)+'</div><div class="s">'+esc(pass?'One-time · '+PASS_DAYS+' days of access':p.aud)+'</div></div></div>'+billing+
    '<div class="row"><div class="grow t">Total due today</div><b>'+esc(price)+' <span class="note" style="font-weight:400">'+per+'</span></b></div>'+
    '<p class="note" style="margin-top:8px">Payment is not connected yet, so nothing is charged. Confirming switches this account to '+esc(p.name)+' for testing.</p></div>'+
    '<div class="card up-gap"><h3>You unlock</h3><div class="up-list" style="border-top:0;padding:8px 0 0">'+featList(COL[UP.plan],null)+'</div></div>'+
    '<div class="cta up-gap"><button class="btn primary" data-act="pmupgrade">Confirm upgrade</button><button class="btn" data-act="upback">Back to plans</button></div></div>';
}
function viewUpgrade(){
  return '<header class="up-bar"><button class="up-back" data-act="upback" aria-label="'+(UP.step==='checkout'?'Back to plans':'Go back')+'">'+ic('back')+'<span>'+(UP.step==='checkout'?'Plans':'Upgrade')+'</span></button>'+themeBtn()+'</header>'+
    '<main class="up-wrap">'+(UP.step==='checkout'?checkoutHTML():plansHTML())+'</main>';
}

/* ---------- new pages ---------- */
var RANK={missing:0,review:1,partial:2,met:3};
var CMP={};
function pageCompare(ws){
  var head='<div class="pagehead"><div><h1>Revision Comparison</h1><p class="sub">Compare an earlier AI review with a newer one to see which requirements improved after you revised the draft.</p></div></div>';
  if(!lim().compare) return head+lockCard('Compare old and revised drafts','Pick two reviews and see every requirement that improved, slipped, or stayed the same.','compare');
  var snaps=wsHistory(ws.id).filter(function(h){return h.snap&&h.snap.length;});
  if(snaps.length<2) return head+'<div class="card pm-gap"><div class="empty"><h3>Two reviews needed</h3><p>Run the AI review on your earlier draft, then again after revising it. Each finished review is saved here for comparison.</p><button class="btn" data-act="page" data-p="review">Go to AI Review</button></div></div>';
  var st=CMP[ws.id]||{};
  var find=function(id){ return snaps.filter(function(h){return h.id===id;})[0]; };
  var b=find(st.b)||snaps[0], a=find(st.a)||snaps[1];
  var opts=function(sel){ return snaps.map(function(h){ return '<option value="'+h.id+'"'+(h.id===sel.id?' selected':'')+'>'+esc(fmtT(h.at)+' · '+h.draft)+'</option>'; }).join(''); };
  var pick='<div class="card pm-gap"><div class="cmp-pick"><div class="field"><label for="cmp-a">Earlier review</label><select id="cmp-a">'+opts(a)+'</select></div>'+
    '<div class="field"><label for="cmp-b">Later review</label><select id="cmp-b">'+opts(b)+'</select></div></div></div>';
  if(a.id===b.id) return head+pick+'<div class="card pm-gap"><p class="note">Choose two different reviews to compare.</p></div>';
  var before={}; a.snap.forEach(function(s){ before[s.id]=s; });
  var ids=[], seen={}, imp=0, reg=0, same=0;
  b.snap.concat(a.snap).forEach(function(s){ if(!seen[s.id]){ seen[s.id]=1; ids.push(s.id); } });
  var after={}; b.snap.forEach(function(s){ after[s.id]=s; });
  var trs=ids.map(function(id){
    var x=before[id], y=after[id], ch;
    if(!x) ch='<span class="pill doing">New</span>';
    else if(!y) ch='<span class="pill todo">Removed</span>';
    else if(RANK[y.status]>RANK[x.status]){ imp++; ch='<span class="pill met">Improved</span>'; }
    else if(RANK[y.status]<RANK[x.status]){ reg++; ch='<span class="pill missing">Regressed</span>'; }
    else { same++; ch='<span class="pill todo">No change</span>'; }
    return '<tr><td>'+esc((y||x).title)+'</td><td>'+(x?pill(x.status):'—')+'</td><td>'+(y?pill(y.status):'—')+'</td><td>'+ch+'</td></tr>';
  }).join('');
  var ca=a.counts||{met:0}, cb=b.counts||{met:0};
  return head+pick+'<div class="card pm-gap"><div class="between"><h3>What changed</h3><div class="legend"><span class="pill met">'+imp+' improved</span><span class="pill missing">'+reg+' regressed</span><span class="pill todo">'+same+' no change</span></div></div>'+
    '<p class="note" style="margin:6px 0 10px">Requirements met: '+ca.met+' → '+cb.met+'</p>'+
    '<div class="tw"><table class="cmp-tbl"><thead><tr><th>Requirement</th><th>Earlier</th><th>Later</th><th>Change</th></tr></thead><tbody>'+trs+'</tbody></table></div></div>';
}
function pageHistory(ws){
  var prem=lim().history, all=wsHistory(ws.id), shown=prem?all:all.slice(0,HISTORY_FREE);
  var head='<div class="pagehead"><div><h1>Research History</h1><p class="sub">'+(prem?'Every AI review run in this workspace, newest first.':'Your most recent AI checks in this workspace.')+'</p></div>'+
    (lim().compare?'<button class="btn" data-act="page" data-p="compare">'+ic('compare','sm')+'Compare reviews</button>':'')+'</div>';
  if(!shown.length) return head+'<div class="card pm-gap"><div class="empty"><h3>No checks yet</h3><p>Each time you run the AI review, it is saved here.</p><button class="btn" data-act="page" data-p="review">Go to AI Review</button></div></div>';
  var rows=shown.map(function(h){
    return '<div class="row"><span class="fileico">'+ic('spark')+'</span><div class="grow"><div class="t">'+esc(h.draft)+'</div><div class="s">'+esc(fmtT(h.at))+' · '+esc(h.by||'')+'</div></div>'+
      (h.counts?legend(h.counts):'<span class="pill todo">Result not recorded</span>')+'</div>'; }).join('');
  return head+'<div class="card pm-gap">'+rows+'</div>'+
    (!prem&&all.length>HISTORY_FREE?lockCard('Full review and revision history',(all.length-HISTORY_FREE)+' older '+((all.length-HISTORY_FREE)===1?'check is':'checks are')+' saved. Student Pro and Research Team show all of them.','history'):'');
}

/* ---------- paid blocks injected into existing pages ---------- */
function contribCard(ws){
  if(!isTeam()) return lockCard('Contribution tracking','See assigned, completed, and overdue tasks for each member. Included with Research Team.','collab','Research Team');
  var trs=ws.members.map(function(m){
    var t=ws.tasks.filter(function(x){return x.who===m.name;}), d=t.filter(function(x){return x.status==='done';}).length,
        od=t.filter(function(x){return x.status!=='done'&&x.due&&daysLeft(x.due)<0;}).length;
    return '<tr><td>'+esc(m.name)+'</td><td>'+t.length+'</td><td>'+d+'</td><td>'+od+'</td><td>'+bar(d,t.length)+'</td></tr>'; }).join('');
  return '<div class="card pm-gap"><div class="between"><h3>Contribution tracking</h3>'+badge('Research Team')+'</div>'+
    '<div class="tw"><table class="cmp-tbl"><thead><tr><th>Member</th><th>Assigned</th><th>Completed</th><th>Overdue</th><th>Completion</th></tr></thead><tbody>'+trs+'</tbody></table></div></div>';
}
function detailCard(ws){
  if(!lim().history) return lockCard('Detailed progress and revision history','See overdue work, upcoming deadlines, and how your requirements improved from one review to the next.','history','Student Pro');
  var open=ws.tasks.filter(function(t){return t.status!=='done';}),
      overdue=open.filter(function(t){return t.due&&daysLeft(t.due)<0;}).length,
      soon=open.filter(function(t){var d=daysLeft(t.due); return t.due&&d>=0&&d<=7;}).length,
      hist=wsHistory(ws.id), rec=hist.filter(function(h){return h.counts;}).slice(0,5);
  return '<div class="card pm-gap"><div class="between"><h3>Detailed progress</h3>'+badge(PLAN_NAME[plan()])+'</div>'+
    '<div class="strip" style="margin:12px 0"><div><b>'+open.length+'</b><span>Open tasks</span></div><div><b>'+overdue+'</b><span>Overdue</span></div><div><b>'+soon+'</b><span>Due in 7 days</span></div><div><b>'+hist.length+'</b><span>Reviews run</span></div></div>'+
    '<div class="lbl">Revision history</div>'+
    (rec.length?rec.map(function(h){ return '<div class="row"><div class="grow"><div class="t">'+esc(fmtT(h.at))+'</div><div class="s">'+esc(h.draft)+'</div></div>'+legend(h.counts)+'</div>'; }).join(''):'<p class="note">Finished reviews appear here so you can see progress over time.</p>')+'</div>';
}

/* ---------- wire pages into the sidebar ---------- */
PAGES.compare=pageCompare; PAGES.history=pageHistory;
(function(){
  var L=NAV.leader, i=0; for(i=0;i<L.length;i++){ if(L[i][0]==='settings') break; }
  L.splice(i,0,['compare','Revision Comparison','compare'],['history','Research History','history']);
  NAV.member.push(['compare','Revision Comparison','compare'],['history','Research History','history']);
})();

/* ---------- gate the existing actions ---------- */
var _run=ACT.run;
ACT.run=function(t,e){
  var ws=cur(); if(!ws) return;
  var has=function(ty){ return ws.docs.some(function(d){return d.type===ty;}); };
  if(!has('Rubric')||!has('Draft')) return _run(t,e);          /* original handler shows its own message */
  if(checksUsed()>=lim().checks){
    var pl=plan();
    if(pl==='free') openModal('checks');
    else if(pl==='pass') openModal('checks','You have used all '+lim().checks+' checks in your Research Pass. Student Pro and Research Team include checks every month.');
    else toast('You have used all '+lim().checks+' checks for this month.');
    return;
  }
  logCheck(ws);
  return _run(t,e);
};
var _export=ACT.exportpdf;
ACT.exportpdf=function(t,e){ if(!lim().pdf){ openModal('reports'); return; } return _export(t,e); };
var _panel=ACT.panel;
ACT.panel=function(t,e){ if(t.dataset.p==='create'&&!canCreateWs()){ openModal('workspaces'); return; } return _panel(t,e); };

var _addFiles=window.addFiles;
window.addFiles=function(files){
  var ws=cur(), L=lim(), room=L.docs-ws.docs.length, blocked=null, ok=[];
  Array.prototype.slice.call(files).forEach(function(f){
    if(!/\.pdf$/i.test(f.name)){ ok.push(f); return; }              /* original handler rejects non-PDFs */
    if(f.size>L.fileMB*1048576){ blocked=blocked||'size'; return; }
    if(room<=0){ blocked=blocked||'docs'; return; }
    room--; ok.push(f);
  });
  if(ok.length) _addFiles(ok);
  if(blocked){
    var m=blocked==='size'?'That file is over the '+L.fileMB+' MB limit for your plan.':'This workspace already has the maximum of '+L.docs+' documents for your plan.';
    if(plan()==='team') toast(m); else openModal('uploads',m+(blocked==='size'?' Higher plans allow larger files.':' Higher plans allow more documents.'));
  }
};

/* forms that app.js handles inline: stop them before app.js sees them */
document.addEventListener('submit',function(e){
  var f=e.target.closest&&e.target.closest('form[data-form]'); if(!f) return;
  var k=f.dataset.form, ws=cur();
  if(k==='create'&&!canCreateWs()){ e.preventDefault(); e.stopImmediatePropagation(); openModal('workspaces'); }
  else if(k==='addtask'&&ws&&ws.tasks.length>=lim().tasks){ e.preventDefault(); e.stopImmediatePropagation(); openModal('collab','This workspace has reached the limit of '+lim().tasks+' tasks for your plan. Student Pro and Research Team add more tasks.'); }
},true);

/* ---------- upgrade, theme + comparison events ---------- */
ACT.plans=function(){ openModal('plans'); };
ACT.upgrade=function(t){ openModal(t.dataset.r||'plans'); };
ACT.upback=function(){ if(UP.step==='checkout'){ UP.step='plans'; render(false); } else leaveUpgrade(); };
ACT.pmcheckout=function(t){ UP.plan=(t&&t.dataset.plan)||'student'; UP.step='checkout'; render(false); };
ACT.pmcycle=function(t){ UP.cycle=t.dataset.c==='year'?'year':'month'; render(true); };
ACT.pmupgrade=function(){
  /* TODO: send the user to your payment provider here (plan: UP.plan, billing: UP.cycle).
     Call ReqvioPlan.setPlan('student' | 'team' | 'pass', 'month' | 'year') once payment succeeds. */
  setPlan(UP.plan,UP.cycle); UP.step='plans'; state.view=UP.prev||'home'; render(false); toast(UP.plan==='pass'?'Research Pass active for '+PASS_DAYS+' days.':'You are now on '+PLAN_NAME[UP.plan]+'. Features are unlocked.');
};
ACT.pmdowngrade=function(){
  /* TODO: replace with your cancel-subscription route. */
  setPlan('free'); render(true); toast('Switched to the Free plan.');
};
ACT.theme=function(){ setTheme(effectiveTheme()==='dark'?'light':'dark'); };
ACT.settheme=function(t){ setTheme(t.dataset.t); };
document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&state.view==='upgrade') ACT.upback(); });
document.addEventListener('change',function(e){
  var el=e.target; if(el.id!=='cmp-a'&&el.id!=='cmp-b') return;
  var ws=cur(); CMP[ws.id]=CMP[ws.id]||{}; CMP[ws.id][el.id==='cmp-a'?'a':'b']=el.value; render(true);
});

/* ---------- decorate pages after every render ---------- */
var lastRunning=null, _render=window.render;
window.render=function(keep){
  if(lastRunning!==null&&state.running===null) completeReview(cur());   /* a review just finished */
  lastRunning=state.running;
  if(state.view==='upgrade'){                      /* the Upgrade pages are drawn here, not by app.js */
    var y=window.scrollY;
    document.getElementById('app').innerHTML=viewUpgrade();
    window.scrollTo(0,keep?y:0);
    return;
  }
  _render(keep);
  enhance();
};
function enhance(){
  var prem=isPremium(), L=lim(), pn=PLAN_NAME[plan()], pl=plan();
  var top=document.querySelector('.topbar .in');
  if(top&&!top.querySelector('.planchip')){
    var b=document.createElement('button');
    b.className='planchip'+(prem?' on':''); b.setAttribute('data-act','plans');
    b.setAttribute('aria-label',prem?pn+' plan':'Free plan. See plans');
    b.innerHTML=ic('crown','sm')+(prem?pn:'Free plan');
    var av=top.querySelector('.avatar');
    top.insertBefore(b,av);
    var tmp=document.createElement('div'); tmp.innerHTML=themeBtn(); top.insertBefore(tmp.firstChild,av);
  }
  if(state.view==='landing'||state.view==='auth'){
    document.getElementById('app').insertAdjacentHTML('beforeend',themeBtn('themefab'));
  }
  if(state.view==='home'){
    var add=document.querySelector('.tile.add .muted');
    if(add&&!canCreateWs()) add.insertAdjacentHTML('afterend','<p class="note">'+esc(pn)+' plan: '+plural(L.workspaces,'project')+' you lead. <button class="btn small" data-act="upgrade" data-r="workspaces">See plans</button></p>');
  } else if(state.view==='profile'){
    var m=document.querySelector('main.wrap');
    if(m){
      Array.prototype.forEach.call(m.querySelectorAll('.note'),function(n){ if(/^Theme follows/.test(n.textContent)) n.textContent='Your role is set per workspace, not here.'; });
      var cur_=savedTheme()||'system';
      var ptxt=pl==='team'?'You have every Research Team feature, with room for up to 5 members.'
        :pl==='student'?'You have every Student Pro feature.'
        :pl==='pass'?'Your Research Pass is active for '+plural(passDaysLeft(),'more day')+'. '+checksUsed()+' of '+LIMITS.pass.checks+' checks used.'
        :'Free includes 2 AI checks per month, 2 documents, and 1 project.';
      m.insertAdjacentHTML('beforeend','<div class="card pm-gap"><h3>Appearance</h3><p class="note" style="margin:6px 0 12px">Choose light or dark mode, or follow your device setting.</p>'+
        '<div class="tabs" role="tablist" aria-label="Theme">'+[['system','Device'],['light','Light'],['dark','Dark']].map(function(o){
          return '<button role="tab" aria-selected="'+(cur_===o[0])+'" data-act="settheme" data-t="'+o[0]+'">'+o[1]+'</button>'; }).join('')+'</div></div>');
      m.insertAdjacentHTML('beforeend','<div class="card pm-gap"><div class="between"><h3>Plan</h3>'+(prem?badge(pn):'<span class="role member">Free</span>')+'</div>'+
        '<p class="note" style="margin:6px 0 12px">'+esc(ptxt)+'</p>'+
        '<button class="btn small '+(prem?'':'primary')+'" data-act="plans">'+(prem?'View plans':'See plans')+'</button></div>');
    }
  } else if(state.view==='ws'){
    var ws=cur(); if(!ws) return;
    if(!L.compare){
      var nb=document.querySelector('.navbtn[data-p="compare"] .lb'); if(nb) nb.insertAdjacentHTML('beforeend',badge());
    }
    var pg=state.page;
    var usage=(pl==='pass'?'Research Pass: '+checksUsed()+' of '+L.checks+' AI checks used, '+plural(passDaysLeft(),'day')+' left.':'Free plan: '+checksUsed()+' of '+L.checks+' AI checks used this month.');
    if(pg==='review'){
      if(pl==='free'||pl==='pass') afterHead(upsell(usage,'checker'));
      if(!L.feedback){
        var lbs=document.querySelectorAll('.rv .lbl');
        Array.prototype.forEach.call(lbs,function(l){
          if(l.textContent==='Recommended action'){
            var p=l.parentNode.querySelector('p');
            if(p) p.outerHTML='<p class="note">Detailed recommended actions are part of Student Pro and Research Team. <button class="btn small" data-act="upgrade" data-r="checker">Unlock</button></p>';
          }
        });
      }
    } else if(pg==='documents'&&(pl==='free'||pl==='pass')){
      afterHead(upsell(pn+': '+ws.docs.length+' of '+L.docs+' documents used, PDFs up to '+L.fileMB+' MB.','uploads'));
    } else if(pg==='members'){
      if(!isTeam()) afterHead(upsell(pn+': '+ws.members.length+' of '+plural(L.members,'member')+'. Research Team allows up to 5.','collab'));
      if(!canAddMember(ws)){
        var cb=document.querySelector('.codebox');
        if(cb) cb.outerHTML='<span class="pill missing">Member limit reached</span>'+(isTeam()?'':' <button class="btn small primary" data-act="upgrade" data-r="collab">Upgrade to invite more</button>');
      }
      appendPage(contribCard(ws));
    } else if(pg==='team'){
      appendPage(contribCard(ws));
    } else if(pg==='tasks'){
      if(L.tasks!==Infinity) afterHead(upsell(pn+': '+ws.tasks.length+' of '+L.tasks+' tasks in this workspace.','collab'));
      appendPage(detailCard(ws));
    } else if(pg==='progress'){
      appendPage(detailCard(ws));
    } else if(pg==='reports'&&!L.pdf){
      afterHead(upsell('Free plan: the report below is a basic summary. PDF export with evidence is part of the paid plans.','reports'));
      var ex=document.querySelector('[data-act="exportpdf"]'); if(ex) ex.insertAdjacentHTML('beforeend',badge());
    }
  }
}

/* small API for your backend code */
window.ReqvioPlan={isPremium:isPremium,passDaysLeft:passDaysLeft,isTeam:isTeam,plan:plan,setPlan:setPlan,limits:lim,canAddMember:canAddMember,completeReview:completeReview,openUpgrade:openModal,setTheme:setTheme};

enhance();
})();
