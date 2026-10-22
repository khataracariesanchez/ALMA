/* ---------- helpers ---------- */
var esc = function(s){ return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
var P = {
  home:'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  file:'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5',
  spark:'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  tasks:'M9 6h11 M9 12h11 M9 18h11 M4 6l1 1 2-2 M4 12l1 1 2-2 M4 18l1 1 2-2',
  users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M22 21v-2a4 4 0 0 0-3-3.9 M16 3.1a4 4 0 0 1 0 7.8',
  report:'M5 3h14v18H5z M9 8h6 M9 12h6 M9 16h3',
  settings:'M4 6h10 M18 6h2 M4 12h4 M12 12h8 M4 18h12 M20 18h0 M14 4v4 M8 10v4 M16 16v4',
  progress:'M3 17l6-6 4 4 8-8 M15 7h6v6',
  chev:'M6 9l6 6 6-6',
  panel:'M3 4h18v16H3z M9 4v16',
  plus:'M12 5v14 M5 12h14',
  check:'M5 12l5 5 9-10',
  x:'M6 6l12 12 M18 6L6 18',
  q:'M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7 M12 17h0',
  half:'M12 4a8 8 0 1 0 0 16z',
  upload:'M12 16V4 M7 9l5-5 5 5 M4 20h16',
  copy:'M9 9h11v11H9z M5 15V5h10',
  arrow:'M5 12h14 M13 6l6 6-6 6'
};
function ic(n,c){ return '<svg class="ic '+(c||'')+'" viewBox="0 0 24 24" aria-hidden="true"><path d="'+P[n]+'"/></svg>'; }
var LOGO = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#388087"/><path d="M10 8h8l5 5v11H10z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><path d="M18 8v5h5" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><path d="M13 19l2.2 2.2L19.5 17" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
var ST = {
  met:{l:'Met',i:'check'}, partial:{l:'Partially Met',i:'half'},
  missing:{l:'Missing',i:'x'}, review:{l:'Needs Review',i:'q'}
};
function pill(s){ return '<span class="pill '+s+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+P[ST[s].i]+'"/></svg>'+ST[s].l+'</span>'; }
var TS = {todo:'To Do', doing:'In Progress', done:'Completed'};
function tpill(s){ return '<span class="pill '+(s==='done'?'met':s)+'">'+TS[s]+'</span>'; }
function initials(n){ return n.split(' ').map(function(x){return x[0];}).slice(0,2).join('').toUpperCase(); }
function fmt(iso){ if(!iso) return 'No date'; var d=new Date(iso+'T00:00:00'); return d.toLocaleDateString('en-US',{month:'short',day:'numeric'}); }
function toast(m){ var t=document.getElementById('toast'); var d=document.createElement('div'); d.textContent=m; t.appendChild(d); setTimeout(function(){ d.remove(); },3200); }

/* ---------- data shapes (filled by your Python backend) ----------
Workspace: { id, name, desc, role:'leader'|'member', code, due:'YYYY-MM-DD'|null, lastRun:'',
  perms:{run:true, view:true},
  members:[{name, role:'leader'|'member', focus}],
  docs:[{name, type:'Rubric'|'Draft'|'Reference', pages, by, date}],
  tasks:[{id, title, who, status:'todo'|'doing'|'done', due:'YYYY-MM-DD'|null, req: findingId|null}],
  findings:null | [Finding] }
Finding: { id, title, status:'met'|'partial'|'missing'|'review', score:0-1, closest?:bool,
  req, why, action,
  ev:{doc, page, text},                       // retrieved draft passage (validated by the backend)
  rub:{doc, page, paras:[...], hl:index},     // rubric page text, hl = highlighted paragraph
  ctx:{paras:[... '@EV' ...], hl:index} }     // draft page text; '@EV' is replaced by ev.text
User: state.user = { name, email }
*/

/* ---------- state ---------- */
var state = {
  view:'landing', authMode:'signin', user:{name:'',email:''}, ws:[], wsId:null, page:'overview',
  menu:false, collapsed:false, panel:null, panelMsg:null,
  sel:null, cite:'draft', filter:'all', running:null, ask:null, docType:'Draft'
};
function cur(){ return state.ws.filter(function(w){return w.id===state.wsId;})[0]; }
var NAV = {
  leader:[['overview','Overview','home'],['documents','Documents','file'],['review','AI Review','spark'],['tasks','Tasks & Progress','tasks'],['members','Members','users'],['reports','Reports','report'],['settings','Workspace Settings','settings']],
  member:[['overview','Overview','home'],['mytasks','My Tasks','tasks'],['documents','Documents','file'],['review','AI Review','spark'],['progress','Research Progress','progress'],['team','Team','users']]
};
function counts(ws){
  var c={met:0,partial:0,missing:0,review:0}; (ws.findings||[]).forEach(function(f){ c[f.status]++; }); return c;
}
function seg(c,total){
  if(!total) return '<div class="seg"></div>';
  return '<div class="seg" role="img" aria-label="'+c.met+' met, '+c.partial+' partially met, '+c.missing+' missing, '+c.review+' needs review">'+
    ['met','partial','missing','review'].map(function(k){ return c[k]?'<i class="s-'+k+'" style="width:'+(c[k]/total*100)+'%"></i>':''; }).join('')+'</div>';
}
function legend(c){
  return '<div class="legend">'+['met','partial','missing','review'].filter(function(k){return c[k];}).map(function(k){
    return '<span class="pill '+k+'">'+c[k]+' '+({met:'Met',partial:'Partial',missing:'Missing',review:'Needs Review'})[k]+'</span>'; }).join('')+'</div>';
}
function bar(n,d){ return '<div class="bar" role="img" aria-label="'+n+' of '+d+'"><i style="width:'+(d?n/d*100:0)+'%"></i></div>'; }
function daysLeft(iso){ if(!iso) return null; return Math.ceil((new Date(iso+'T00:00:00')-new Date())/864e5); }
function dueText(ws){
  var d=daysLeft(ws.due); if(d===null) return 'No deadline set';
  return 'Due '+fmt(ws.due)+' · '+(d<0?'past due':d===0?'today':d+' day'+(d===1?'':'s')+' left');
}

/* ---------- views ---------- */
function viewLanding(){
  return '<div class="wrap"><div class="nav"><span class="logo">'+LOGO+'Reqvio</span><div class="cta"><button class="btn" data-act="auth" data-mode="signin">Sign in</button></div></div>'+
  '<section class="hero"><div><p class="eyebrow" style="margin-bottom:14px">Research collaboration and review</p>'+
  '<h1>Research together. Track progress. <em>Meet every requirement.</em></h1>'+
  '<p class="lead">Reqvio gives each research team a workspace for drafts, rubrics, and tasks. Upload your rubric and your draft, and the AI review shows which requirements are met, with the passage and page it found them on.</p>'+
  '<div class="cta"><button class="btn primary" data-act="auth" data-mode="signin">Sign in</button><button class="btn" data-act="auth" data-mode="signup">Create an account</button></div></div>'+
  '<div class="card glimpse" aria-label="Example review finding"><div class="head"><span class="eyebrow">Example finding</span>'+pill('missing')+'</div>'+
  '<h3 class="reqtxt" style="font-size:17px">Address ethical considerations such as consent, privacy, and data handling.</h3>'+
  '<div><div class="lbl">Closest passage in the draft</div><div class="quote">Logs are stored on the team’s shared drive and backed up weekly.</div></div>'+
  '<div class="between"><span class="cite">Smart Campus Draft v2.pdf · p.7</span><span class="note mono">match 0.19</span></div>'+
  '<p class="note">Suggested action: add an Ethics subsection covering consent, privacy, and who can see the logs.</p></div></section>'+
  '<section class="flow"><div><h3>Upload your rubric and draft</h3><p>Each workspace keeps its own documents, so one team’s files never mix with another’s.</p></div>'+
  '<div><h3>Review against every requirement</h3><p>Findings are Met, Partially Met, Missing, or Needs Review, with the cited page beside each.</p></div>'+
  '<div><h3>Send your teacher a report</h3><p>The leader exports one PDF with progress, findings, and open tasks. Your teacher needs no account.</p></div></section>'+
  '<div class="foot">Built for SDG 4, Quality Education.</div></div>';
}
function viewAuth(){
  var up = state.authMode==='signup';
  return '<div class="authwrap"><span class="logo">'+LOGO+'Reqvio</span><div class="card authcard">'+
  '<div class="tabs" role="tablist"><button role="tab" aria-selected="'+!up+'" data-act="auth" data-mode="signin">Sign in</button><button role="tab" aria-selected="'+up+'" data-act="auth" data-mode="signup">Sign up</button></div>'+
  '<form data-form="auth" class="stack">'+
  (up?'<div class="field"><label for="a-name">Name</label><input id="a-name" autocomplete="name" required></div>':'')+
  '<div class="field"><label for="a-mail">Email</label><input id="a-mail" type="email" autocomplete="email" required></div>'+
  '<div class="field"><label for="a-pass">Password</label><div class="password-input"><input id="a-pass" type="password" autocomplete="current-password" required><button class="btn small" type="button" data-act="togglepassword" aria-controls="a-pass" aria-label="Show password" aria-pressed="false">Show</button></div></div>'+
  '<button class="btn primary" type="submit">'+(up?'Create account':'Sign in')+'</button></form>'+ '</div>'+
  '<button class="btn small" data-act="landing">Back to home</button></div>';
}
function topbar(ws){
  var sw = '';
  if(ws){
    sw = '<div class="switch"><button data-act="menu" aria-haspopup="true" aria-expanded="'+state.menu+'"><span class="nm">'+esc(ws.name)+'</span>'+ic('chev','sm')+'</button>'+
    (state.menu?'<div class="menu" role="menu">'+state.ws.map(function(w){
      return '<button class="opt" role="menuitem" data-act="openws" data-id="'+w.id+'" aria-current="'+(w.id===ws.id)+'"><span>'+esc(w.name)+'</span><span class="role '+w.role+'">'+(w.role==='leader'?'Leader':'Member')+'</span></button>'; }).join('')+
      '<hr><button class="opt" role="menuitem" data-act="home"><span>All workspaces</span></button></div>':'')+'</div>'+
    '<span class="role '+ws.role+'">'+(ws.role==='leader'?'Leader':'Member')+'</span>';
  }
  return '<header class="topbar"><div class="in"><button class="logo" data-act="home" aria-label="Reqvio home">'+LOGO+'<span>Reqvio</span></button>'+sw+
  '<span class="grow"></span>'+
  '<button class="avatar" data-act="profile" aria-label="Profile and settings">'+esc(initials(state.user.name||'?'))+'</button></div></header>';
}
function viewHome(){
  var n=state.ws.length;
  var panel='';
  if(state.panel==='create'){
    panel='<div class="card" style="margin-top:20px"><form data-form="create" class="stack"><h3>Create a research workspace</h3>'+
    '<div class="field"><label for="c-title">Project title</label><input id="c-title" placeholder="e.g. Water Quality Survey" required></div>'+
    '<div class="field"><label for="c-desc">Description</label><textarea id="c-desc" placeholder="What is this project about?"></textarea></div>'+
    '<div class="cta"><button class="btn primary" type="submit">Create as Leader</button><button class="btn" type="button" data-act="panel" data-p="">Cancel</button></div></form></div>';
  } else if(state.panel==='join'){
    panel='<div class="card" style="margin-top:20px"><form data-form="join" class="stack"><h3>Join a research workspace</h3>'+
    '<div class="field"><label for="j-code">Invite code</label><input id="j-code" placeholder="Paste the invite code" autocomplete="off" required></div>'+
    (state.panelMsg?'<p class="'+(state.panelMsg.ok?'okmsg':'err')+'">'+esc(state.panelMsg.t)+'</p>':'')+
    '<div class="cta"><button class="btn primary" type="submit">Join as Member</button><button class="btn" type="button" data-act="panel" data-p="">Cancel</button></div></form></div>';
  }
  return topbar(null)+'<main class="wrap" style="padding-block:36px 64px"><div class="between" style="align-items:flex-end;margin-bottom:22px"><div><h1 style="font-size:30px">Your Research Projects</h1><p class="muted">'+n+' project'+(n===1?'':'s')+'. Your role is set separately in each one.</p></div></div>'+
  '<div class="tiles">'+state.ws.map(function(w){
    return '<article class="card tile"><div class="between"><h3>'+esc(w.name)+'</h3><span class="role '+w.role+'">'+(w.role==='leader'?'Leader':'Member')+'</span></div>'+
    '<div class="meta"><span>'+w.members.length+' members</span><span>'+w.docs.length+' documents</span></div>'+
    '<button class="btn" data-act="openws" data-id="'+w.id+'">Open workspace '+ic('arrow','sm')+'</button></article>'; }).join('')+
  '<article class="card tile add"><span class="plus">'+ic('plus')+'</span><p class="muted" style="font-size:14px">Start a new project or join your team’s.</p><div class="cta" style="justify-content:center"><button class="btn small primary" data-act="panel" data-p="create">Create</button><button class="btn small" data-act="panel" data-p="join">Join</button></div></article></div>'+panel+'</main>';
}

/* workspace pages */
function pageOverview(ws){
  var L=ws.role==='leader', done=ws.tasks.filter(function(t){return t.status==='done';}).length;
  var c=counts(ws), tot=(ws.findings||[]).length;
  var attention=(ws.findings||[]).filter(function(f){return f.status!=='met';});
  var mine=ws.tasks.filter(function(t){return t.assignee_id===state.user.id;});
  var head='<div class="pagehead"><div><h1>'+esc(ws.name)+'</h1><p class="sub">Research workspace · '+(L?'Leader':'Member')+' · '+dueText(ws)+'</p></div></div>';
  var strip=L?'<div class="card"><div class="strip"><div><b>'+ws.members.length+'</b><span>Members</span></div><div><b>'+ws.tasks.length+'</b><span>Tasks</span></div><div><b>'+ws.docs.length+'</b><span>Documents</span></div></div></div>':'';
  var tasksCard;
  if(L){
    var next=ws.tasks.filter(function(t){return t.status!=='done';}).slice(0,3);
    tasksCard='<div class="card"><div class="between"><h3>Research Tasks</h3><span class="muted" style="font-size:13px">'+done+' of '+ws.tasks.length+' completed</span></div><div style="margin:12px 0">'+bar(done,ws.tasks.length)+'</div>'+
    (next.length?next.map(function(t){return '<div class="row"><div class="grow"><div class="t">'+esc(t.title)+'</div><div class="s">'+esc(t.who)+' · '+fmt(t.due)+'</div></div>'+tpill(t.status)+'</div>';}).join(''):'<p class="note">'+(ws.tasks.length?'All tasks are completed.':'No tasks yet.')+'</p>')+
    '<div style="margin-top:12px"><button class="btn small" data-act="page" data-p="tasks">Open Tasks & Progress</button></div></div>';
  } else {
    tasksCard='<div class="card"><div class="between"><h3>My Assigned Tasks</h3><span class="muted" style="font-size:13px">'+mine.filter(function(t){return t.status==='done';}).length+' of '+mine.length+' completed</span></div>'+
    (mine.length?mine.map(function(t){return '<div class="row"><div class="grow"><div class="t">'+esc(t.title)+'</div><div class="s">Due '+fmt(t.due)+'</div></div>'+tpill(t.status)+'</div>';}).join(''):'<p class="note">Nothing is assigned to you yet.</p>')+
    '<div style="margin-top:12px"><button class="btn small" data-act="page" data-p="mytasks">Open My Tasks</button></div></div>';
  }
  var rev;
  if(!tot){
    rev='<div class="card"><h3>'+(L?'Latest AI Review':'AI Research Feedback')+'</h3><p class="note" style="margin-top:6px">No review has been run yet. Upload a rubric and a draft, then run the review.</p><div style="margin-top:12px"><button class="btn small" data-act="page" data-p="documents">Go to Documents</button></div></div>';
  } else if(L){
    rev='<div class="card"><div class="between"><h3>Latest AI Review</h3><span class="muted" style="font-size:13px">'+esc(ws.lastRun)+'</span></div><div class="stack" style="margin-top:12px">'+seg(c,tot)+legend(c)+
    '<div>'+attention.slice(0,3).map(function(f){return '<button class="row" style="width:100%;background:none;border-left:0;border-right:0;border-bottom:0;text-align:left" data-act="gofinding" data-id="'+f.id+'"><div class="grow"><div class="t">'+esc(f.title)+'</div></div>'+pill(f.status)+'</button>';}).join('')+'</div></div></div>';
  } else {
    var f=ws.findings.filter(function(x){return x.status==='partial'||x.status==='review';})[0]||attention[0];
    rev='<div class="card"><div class="between"><h3>AI Research Feedback</h3>'+(f?pill(f.status):'')+'</div><div class="stack" style="margin-top:10px">'+
    (f?'<p>'+esc(f.why)+'</p><button class="btn small" data-act="gofinding" data-id="'+f.id+'">See the evidence</button>':'<p>All requirements are met.</p>')+'</div></div>';
  }
  var prog=(!L)?'<div class="card"><div class="between"><h3>Project progress</h3><span class="muted" style="font-size:13px">'+done+' of '+ws.tasks.length+' team tasks done</span></div><div style="margin:12px 0">'+bar(done,ws.tasks.length)+'</div>'+
    (tot?'<div class="between"><span class="muted" style="font-size:13px">Requirements</span><span style="font-size:13px;font-weight:600">'+c.met+' of '+tot+' met</span></div><div style="margin-top:8px">'+seg(c,tot)+'</div>':'')+'</div>':'';
  return head+strip+'<div class="cols">'+tasksCard+rev+'</div>'+prog;
}

function pageDocuments(ws){
  var L=ws.role==='leader';
  var types=L?['Rubric','Draft','Reference']:['Draft','Reference'];
  if(types.indexOf(state.docType)<0) state.docType=types[0];
  return '<div class="pagehead"><div><h1>Documents</h1><p class="sub">'+(L?'Upload rubrics, instructions, drafts, and references. Each workspace keeps its own files.':'Files shared in this workspace. You can upload drafts and references.')+'</p></div></div>'+
  '<div class="card"><div class="drop" data-drop><span class="fileico">'+ic('upload')+'</span><b>Drop PDF files here</b><span class="note">or choose files from your device</span>'+
  '<div class="field" style="flex-direction:row;align-items:center;gap:10px;width:auto"><label for="doctype">File is a</label><select id="doctype" style="width:auto">'+types.map(function(t){return '<option'+(t===state.docType?' selected':'')+'>'+t+'</option>';}).join('')+'</select></div>'+
  '<label class="btn small primary" for="fileinput" style="cursor:pointer">Choose files</label><input id="fileinput" class="sr" type="file" accept="application/pdf,.pdf" multiple>'+
  '</div></div>'+
  '<div class="card"><h3>Workspace files</h3>'+(ws.docs.length?ws.docs.map(function(d){
    return '<div class="row"><span class="fileico">'+ic('file')+'</span><div class="grow"><div class="t">'+esc(d.name)+'</div><div class="s">'+esc(d.by)+' · '+esc(d.date)+(d.pages?' · '+d.pages+' pages':'')+'</div></div><span class="role member">'+esc(d.type)+'</span></div>'; }).join(''):'<div class="empty"><h3>No documents yet</h3><p>Upload the rubric first, then the draft.</p></div>')+'</div>';
}

function selFinding(ws){
  var fs=(ws.findings||[]).filter(function(f){return state.filter==='all'||f.status===state.filter;});
  if(!fs.length){state.sel=null;return null;}
  var f=fs.filter(function(x){return x.id===state.sel;})[0];
  if(!f){ f=fs.filter(function(x){return x.status==='missing';})[0]||fs[0]; state.sel=f.id; }
  return f;
}
var PIPE=['Extract text from PDFs','Retrieve passages for each requirement','Gemma 4 analyzes requirement coverage','Validate citations against sources'];
function viewer(f){
  var isR=state.cite==='rubric', d=isR?f.rub:{doc:f.ev.doc,page:f.ev.page,paras:f.ctx.paras,hl:f.ctx.hl};
  var body=d.paras.map(function(p,i){
    var t=p==='@EV'?f.ev.text:p; return '<p>'+(i===d.hl?'<mark>'+esc(t)+'</mark>':esc(t))+'</p>'; }).join('');
  return '<div class="paper"><div class="hd"><span>'+esc(d.doc)+'</span><span>Page '+d.page+'</span></div><div class="pg">'+body+'</div></div>';
}
function pageReview(ws){
  var L=ws.role==='leader', fs=ws.findings||[];
  var head='<div class="pagehead"><div><h1>AI Review</h1><p class="sub">'+(fs.length?esc(ws.docs.filter(function(d){return d.type==='Draft';})[0].name)+' checked against '+esc(ws.docs.filter(function(d){return d.type==='Rubric';})[0].name)+' · last run '+esc(ws.lastRun):'Check your draft against the rubric, with evidence for every requirement.')+'</p></div>'+
   (ws.perms.run||L?'<button class="btn primary" data-act="run"'+(state.running!==null?' disabled':'')+'>'+ic('spark','sm')+(state.running!==null?'Running…':(L?'Run team-wide review':'Run review'))+'</button>':'')+'</div>';
  var note='<div class="banner">'+ic('q','sm')+'<span>AI findings are advisory. They are not an official teacher evaluation.</span></div>';
  var run='';
  if(state.running!==null){
    run='<div class="card"><h3>Reviewing your draft</h3><ol class="steps" style="list-style:none;padding:0;margin:12px 0 0">'+PIPE.map(function(s,i){
      var cls=i<state.running?'done':i===state.running?'now':'';
      return '<li class="'+cls+'"><span class="dot">'+(i<state.running?'<svg viewBox="0 0 24 24"><path d="'+P.check+'"/></svg>':'')+'</span>'+s+'</li>'; }).join('')+'</ol></div>';
  }
  if(!fs.length){
    return head+note+run+'<div class="card"><div class="empty"><h3>No review yet</h3><p>Upload a rubric and a research draft in Documents, then run the review. The checklist, evidence, and recommended actions appear here.</p><button class="btn" data-act="page" data-p="documents">Go to Documents</button></div></div>';
  }
  var f=selFinding(ws), c=counts(ws);
  var vis=fs.filter(function(x){return state.filter==='all'||x.status===state.filter;});
  var filt='<div class="filters" role="group" aria-label="Filter by status"><button data-act="filter" data-f="all" aria-pressed="'+(state.filter==='all')+'">All '+fs.length+'</button>'+
    ['met','partial','missing','review'].filter(function(k){return c[k];}).map(function(k){return '<button data-act="filter" data-f="'+k+'" aria-pressed="'+(state.filter===k)+'">'+ST[k].l+' '+c[k]+'</button>';}).join('')+'</div>';
  var list='<div class="card checklist" role="list">'+(vis.length?vis.map(function(x){
    return '<button data-act="selfinding" data-id="'+x.id+'" aria-current="'+(x.id===f.id)+'"><span class="meta"><span class="ttl">'+esc(x.title)+'</span>'+pill(x.status)+'</span><span class="note mono" style="font-size:12px">'+esc(x.ev.doc.replace('.pdf',''))+' · p.'+x.ev.page+'</span></button>'; }).join(''):'<p class="note" style="padding:14px">No requirements with this status.</p>')+'</div>';
  var ans=state.ask?'<div class="answer">'+esc(state.ask.a)+'</div>':'';
  var detail='<div class="card stack"><div class="between"><span class="eyebrow">Requirement</span>'+pill(f.status)+'</div><h2 class="reqtxt">'+esc(f.req)+'</h2>'+
   '<div><div class="lbl">Why this status</div><p>'+esc(f.why)+'</p></div>'+
   '<div><div class="lbl">Recommended action</div><p>'+esc(f.action)+'</p></div>'+
   '<div><div class="lbl">'+(f.closest?'Closest passage found (below threshold)':'Evidence from the draft')+'</div><div class="quote" style="background:var(--surface-2);border-radius:8px;padding:12px 14px;font-size:14px">'+esc(f.ev.text)+'</div>'+
   '<div class="legend" style="margin-top:10px"><button class="cite" data-act="cite" data-c="draft" aria-pressed="'+(state.cite==='draft')+'">'+esc(f.ev.doc)+' · p.'+f.ev.page+'</button><button class="cite" data-act="cite" data-c="rubric" aria-pressed="'+(state.cite==='rubric')+'">'+esc(f.rub.doc)+' · p.'+f.rub.page+' (rubric)</button><span class="note mono" style="align-self:center">match '+f.score.toFixed(2)+'</span></div></div>'+
   viewer(f)+'</div>';
  var askc='<div class="card stack"><div><h3>Ask about the requirements</h3><p class="note">Ask which requirement a finding relates to and what to change.</p></div>'+
   '<form data-form="ask" class="ask"><label class="sr" for="askq">Your question</label><input id="askq" placeholder="e.g. What does the methodology need?" autocomplete="off"><button class="btn primary" type="submit">Ask</button></form>'+
   '<div class="chips">'+fs.slice(0,3).map(function(x){return '<button data-act="askchip" data-id="'+x.id+'">What does “'+esc(x.title.toLowerCase())+'” need?</button>';}).join('')+'</div>'+ans+'</div>';
  return head+note+run+seg(c,fs.length)+filt+'<div class="rv">'+list+'<div class="stack">'+detail+askc+'</div></div>';
}

function taskRow(ws,t,canEdit){
  var f=(ws.findings||[]).filter(function(x){return x.id===t.req;})[0];
  return '<div class="row"><div class="grow"><div class="t">'+esc(t.title)+'</div><div class="s who"><span class="avatar" aria-hidden="true">'+esc(initials(t.who))+'</span>'+esc(t.who)+' · '+fmt(t.due)+(f?' · requirement: '+esc(f.title):'')+'</div></div>'+
   '<label class="sr" for="st'+t.id+'">Status of '+esc(t.title)+'</label><select class="st" id="st'+t.id+'" data-change="task" data-id="'+t.id+'"'+(canEdit?'':' disabled')+'>'+
   ['todo','doing','done'].map(function(s){return '<option value="'+s+'"'+(t.status===s?' selected':'')+'>'+TS[s]+'</option>';}).join('')+'</select></div>';
}
function taskGroups(ws,list,edit){
  return ['todo','doing','done'].map(function(s){
    var g=list.filter(function(t){return t.status===s;});
    return '<div class="grouphd">'+tpill(s)+'<span class="muted">'+g.length+'</span></div>'+(g.length?g.map(function(t){return taskRow(ws,t,edit(t));}).join(''):'<p class="note" style="padding:6px 0">Nothing here.</p>'); }).join('');
}
function progressBlock(ws){
  var done=ws.tasks.filter(function(t){return t.status==='done';}).length, c=counts(ws), tot=(ws.findings||[]).length;
  var mismatch=ws.tasks.filter(function(t){ var f=(ws.findings||[]).filter(function(x){return x.id===t.req;})[0]; return t.status==='done'&&f&&f.status!=='met'; });
  var need=(ws.findings||[]).filter(function(f){return f.status!=='met';});
  return '<div class="cols"><div class="card stack"><h3>Task completion</h3><div class="between"><span class="muted" style="font-size:13px">Work the team has marked done</span><b>'+done+' of '+ws.tasks.length+'</b></div>'+bar(done,ws.tasks.length)+'</div>'+
  '<div class="card stack"><h3>Rubric compliance</h3><div class="between"><span class="muted" style="font-size:13px">Requirements the AI review found met</span><b>'+(tot?c.met+' of '+tot:'No review yet')+'</b></div>'+(tot?seg(c,tot):'<div class="seg"></div>')+(tot?legend(c):'')+'</div></div>'+
  '<div class="card"><h3>Needs attention before submission</h3><p class="note" style="margin-bottom:8px">A completed task does not mean its requirement is met. These are tracked separately.</p>'+
  (need.length?need.map(function(f){
    var m=mismatch.filter(function(t){return t.req===f.id;})[0], tk=ws.tasks.filter(function(t){return t.req===f.id;})[0];
    return '<div class="warnrow"><span>'+pill(f.status)+'</span><div class="grow"><div style="font-weight:600">'+esc(f.title)+'</div><div class="note">'+(m?'Task “'+esc(m.title)+'” is marked done, but the requirement is not met yet.':tk?'Task “'+esc(tk.title)+'” is '+TS[tk.status]+'.':'No task is linked to this requirement.')+'</div></div><button class="btn small" data-act="gofinding" data-id="'+f.id+'">Evidence</button></div>'; }).join(''):'<p class="note">'+(tot?'Every requirement is met.':'Run an AI review to see which requirements need work.')+'</p>')+'</div>';
}
function pageTasks(ws){
  return '<div class="pagehead"><div><h1>Tasks & Progress</h1><p class="sub">Assign work, set deadlines, and watch completion next to rubric compliance.</p></div></div>'+
  '<div class="card"><form data-form="addtask" class="addtask"><div class="field"><label for="t-title">New task</label><input id="t-title" placeholder="e.g. Add ethics subsection" required></div>'+
  '<div class="field"><label for="t-who">Assign to</label><select id="t-who">'+ws.members.map(function(m){return '<option>'+esc(m.name)+'</option>';}).join('')+'</select></div>'+
  '<div class="field"><label for="t-due">Due</label><input id="t-due" type="date"></div><button class="btn primary" type="submit">Assign</button></form></div>'+
  '<div class="card">'+(ws.tasks.length?taskGroups(ws,ws.tasks,function(){return true;}):'<div class="empty"><h3>No tasks yet</h3><p>Assign the first task to a teammate above.</p></div>')+'</div>'+progressBlock(ws);
}
function pageMyTasks(ws){
  var mine=ws.tasks.filter(function(t){return t.assignee_id===state.user.id;});
  return '<div class="pagehead"><div><h1>My Tasks</h1><p class="sub">Update the status of your own tasks. Your updates are saved for the team.</p></div></div>'+
  '<div class="card">'+(mine.length?taskGroups(ws,mine,function(){return true;}):'<div class="empty"><h3>Nothing assigned to you</h3><p>When the leader assigns a task, it shows up here.</p></div>')+'</div>';
}
function pageProgress(ws){
  return '<div class="pagehead"><div><h1>Research Progress</h1><p class="sub">Completed requirements and the areas still to improve.</p></div></div>'+progressBlock(ws);
}
function pageMembers(ws){
  return '<div class="pagehead"><div><h1>Members</h1><p class="sub">Invite students and review who is in this workspace.</p></div></div>'+
  '<div class="card stack"><h3>Invite with a code</h3><p class="note">Share this code with teammates. They choose Join on their Home page.</p>'+
  '<span class="codebox">'+esc(ws.code)+'<button class="btn small" data-act="copy" data-t="'+esc(ws.code)+'">'+ic('copy','sm')+'Copy</button></span></div>'+
  '<div class="card"><h3>Team</h3>'+ws.members.map(function(m){
    return '<div class="row"><span class="avatar" aria-hidden="true">'+esc(initials(m.name))+'</span><div class="grow"><div class="t">'+esc(m.name)+'</div><div class="s">'+esc(m.focus)+'</div></div><span class="role '+m.role+'">'+(m.role==='leader'?'Leader':'Member')+'</span></div>'; }).join('')+
  '<p class="note" style="margin-top:12px">Roles are per workspace. Role changes arrive with real accounts in the full build.</p></div>';
}
function pageTeam(ws){
  return '<div class="pagehead"><div><h1>Team</h1><p class="sub">Your teammates and what each is responsible for.</p></div></div>'+
  '<div class="card">'+ws.members.map(function(m){
    var n=ws.tasks.filter(function(t){return t.assignee_id===m.id;}), d=n.filter(function(t){return t.status==='done';}).length;
    return '<div class="row"><span class="avatar" aria-hidden="true">'+esc(initials(m.name))+'</span><div class="grow"><div class="t">'+esc(m.name)+(m.id===state.user.id?' (you)':'')+'</div><div class="s">'+esc(m.focus)+' · '+d+' of '+n.length+' tasks done</div></div><span class="role '+m.role+'">'+(m.role==='leader'?'Leader':'Member')+'</span></div>'; }).join('')+'</div>';
}
function pageReports(ws){
  var fs=ws.findings||[], c=counts(ws), done=ws.tasks.filter(function(t){return t.status==='done';}).length, open=ws.tasks.filter(function(t){return t.status!=='done';});
  return '<div class="pagehead"><div><h1>Reports</h1><p class="sub">Preview the report your teacher will receive.</p></div>'+
  '<button class="btn" data-act="exportpdf">Export PDF</button></div>'+
  '<div class="doc"><div class="advisory">AI findings in this report are advisory. They are not an official teacher evaluation.</div>'+
  '<h2 style="margin-top:20px">'+esc(ws.name)+'</h2><p class="muted">'+esc(ws.desc)+'</p>'+
  '<h4>Team</h4><p>'+ws.members.map(function(m){return esc(m.name)+(m.role==='leader'?' (Leader)':'');}).join(', ')+'</p>'+
  '<h4>Progress summary</h4><p>'+done+' of '+ws.tasks.length+' tasks completed. '+(fs.length?c.met+' of '+fs.length+' rubric requirements met, '+c.partial+' partially met, '+c.missing+' missing'+(c.review?', '+c.review+' needing review':'')+'.':'No AI review has been run yet.')+'</p>'+
  (fs.length?'<h4>Requirement checklist</h4><div class="tw"><table><thead><tr><th>Requirement</th><th>Status</th><th>Source</th></tr></thead><tbody>'+fs.map(function(f){
    return '<tr><td>'+esc(f.title)+'</td><td>'+pill(f.status)+'</td><td class="mono" style="font-size:12px">'+esc(f.ev.doc)+', p.'+f.ev.page+'</td></tr>'; }).join('')+'</tbody></table></div>':'')+
  '<h4>Outstanding tasks</h4>'+(open.length?'<ul style="margin:0;padding-left:18px">'+open.map(function(t){return '<li>'+esc(t.title)+' ('+esc(t.who)+', '+fmt(t.due)+')</li>';}).join('')+'</ul>':'<p>None.</p>')+
  (fs.length?'<h4>Areas for improvement (AI-generated)</h4><ul style="margin:0;padding-left:18px">'+fs.filter(function(f){return f.status!=='met';}).map(function(f){return '<li><b>'+esc(f.title)+':</b> '+esc(f.action)+'</li>';}).join('')+'</ul>':'')+'</div>';
}
function pageSettings(ws){
  return '<div class="pagehead"><div><h1>Workspace Settings</h1><p class="sub">Edit project details and decide what members can do.</p></div></div>'+
  '<div class="card"><form data-form="settings" class="stack"><div class="field"><label for="s-title">Project title</label><input id="s-title" value="'+esc(ws.name)+'" required></div>'+
  '<div class="field"><label for="s-desc">Description</label><textarea id="s-desc">'+esc(ws.desc)+'</textarea></div>'+
  '<div class="field"><label for="s-due">Submission deadline</label><input id="s-due" type="date" value="'+esc(ws.due||'')+'"></div>'+
  '<label class="toggle"><input id="s-run" type="checkbox"'+(ws.perms.run?' checked':'')+'><span><b>Members can run AI reviews</b><br><span class="note">Everyone uses the same review engine.</span></span></label>'+
  '<label class="toggle"><input id="s-view" type="checkbox"'+(ws.perms.view?' checked':'')+'><span><b>Members can view all findings</b><br><span class="note">Turn off to show members only findings for their own sections.</span></span></label>'+
  '<div><button class="btn primary" type="submit">Save changes</button></div></form></div>';
}
var PAGES={overview:pageOverview,documents:pageDocuments,review:pageReview,tasks:pageTasks,mytasks:pageMyTasks,progress:pageProgress,members:pageMembers,team:pageTeam,reports:pageReports,settings:pageSettings};
function viewWs(){
  var ws=cur(), nav=NAV[ws.role];
  if(!nav.some(function(n){return n[0]===state.page;})) state.page='overview';
  return topbar(ws)+'<div class="shell"><nav class="side'+(state.collapsed?' collapsed':'')+'" aria-label="Workspace">'+nav.map(function(n){
    return '<button class="navbtn" data-act="page" data-p="'+n[0]+'" aria-current="'+(state.page===n[0]?'page':'false')+'" title="'+n[1]+'">'+ic(n[2])+'<span class="lb">'+n[1]+'</span></button>'; }).join('')+
    '<button class="navbtn collapse" data-act="collapse" aria-label="Collapse sidebar" aria-pressed="'+state.collapsed+'">'+ic('panel')+'<span class="lb">Collapse</span></button></nav>'+
    '<main class="main"><div class="main-in">'+PAGES[state.page](ws)+'</div></main></div>';
}
function viewProfile(){
  return topbar(null)+'<main class="wrap" style="padding-block:36px 64px;max-width:620px"><h1 style="font-size:28px;margin-bottom:6px">Profile & Settings</h1><p class="muted" style="margin-bottom:20px">Manage your name and account preferences.</p>'+
  '<div class="card"><form data-form="profile" class="stack"><div class="field"><label for="p-name">Name</label><input id="p-name" value="'+esc(state.user.name)+'"></div><div class="field"><label for="p-mail">Email</label><input id="p-mail" type="email" value="'+esc(state.user.email)+'"></div>'+
  '<p class="note">Choose a theme below. Your role is set per workspace, not here.</p>'+
  '<div class="cta"><button class="btn primary" type="submit">Save</button><button class="btn" type="button" data-act="home">Back to workspaces</button><button class="btn" type="button" data-act="landing">Sign out</button></div></form></div></main>';
}

/* ---------- render ---------- */
function render(keep){
  var y=window.scrollY, v=state.view, html='';
  if(v==='landing') html=viewLanding(); else if(v==='auth') html=viewAuth(); else if(v==='home') html=viewHome();
  else if(v==='ws') html=viewWs(); else html=viewProfile();
  document.getElementById('app').innerHTML=html;
  window.scrollTo(0, keep?y:0);
}
function go(v){ state.view=v; state.menu=false; state.panel=null; state.panelMsg=null; render(false); }

