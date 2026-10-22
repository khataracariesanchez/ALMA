/* Live API adapter for the supplied Reqvio interface. No simulated account or document data. */
var token = sessionStorage.getItem('reqvio_session') || '';
var subscription = null, planCatalog = null, aiReady = false, busy = false;
var rawRender = render;
var statusKey = {'Met':'met','Partially Met':'partial','Missing':'missing','Needs Review':'review'};
var taskAPI = {todo:'todo',doing:'in_progress',done:'completed'};
var taskUI = {todo:'todo',in_progress:'doing',completed:'done'};
fmt = function(iso){ return iso ? new Date(iso.length===10 ? iso+'T00:00:00' : iso).toLocaleDateString(undefined,{month:'short',day:'numeric'}) : 'No date'; };
function timeText(iso){return iso?new Date(iso).toLocaleString():'';}
function route(w, suffix){return '/workspaces/'+encodeURIComponent(w.id || w)+suffix;}
async function api(path, options){
  options = options || {};
  var headers = new Headers(options.headers || {});
  if(token) headers.set('Authorization','Bearer '+token);
  if(options.body && !(options.body instanceof FormData)){headers.set('Content-Type','application/json');options.body=JSON.stringify(options.body);}
  var response;
  try {response = await fetch(path, Object.assign({},options,{headers:headers}));}
  catch(e){throw new Error('Cannot reach Reqvio. Check your connection and try again.');}
  if(!response.ok){
    var data = await response.json().catch(function(){return {};});
    var detail = data.detail || 'Request failed ('+response.status+').';
    if(response.status===401 && path!=='/auth/login'){token='';sessionStorage.removeItem('reqvio_session');state.user={name:'',email:''};state.ws=[];go('auth');}
    if(typeof detail==='object' && detail.code){
      detail = detail.code==='premium_required'?'This feature requires the workspace owner’s Premium plan.':'Your plan limit for '+detail.feature.replaceAll('_',' ')+' has been reached ('+detail.limit+').';
    } else if(Array.isArray(detail)){detail=detail.map(function(d){return d.loc.slice(-1)[0]+': '+d.msg;}).join(' ');}
    else if(typeof detail!=='string') detail='Please check your entries and try again.';
    throw new Error(detail);
  }
  if(options.blob) return response.blob();
  return response.status===204?null:response.json();
}
function showError(error, form){
  document.querySelectorAll('.app-error').forEach(function(el){el.remove();});
  var box=document.createElement('div'); box.className='app-error';box.setAttribute('role','alert');box.textContent=error.message || String(error);
  var target=form && form.isConnected?form:document.querySelector('.main-in, .wrap main, main, .authcard, .up-wrap');
  if(target) target.prepend(box); else toast(box.textContent);
  box.scrollIntoView({block:'nearest',behavior:'smooth'});
}
async function perform(work, form){
  if(busy) return;
  busy=true;
  var bar=document.createElement('div');bar.className='busybar';bar.setAttribute('role','progressbar');bar.setAttribute('aria-label','Saving or loading');document.body.append(bar);
  var buttons=form?Array.from(form.querySelectorAll('button[type="submit"]')):[];
  buttons.forEach(function(b){b.disabled=true;});
  document.getElementById('app').setAttribute('aria-busy','true');
  try{await work();}catch(error){showError(error,form);}
  finally{busy=false;bar.remove();buttons.forEach(function(b){b.disabled=false;});document.getElementById('app').removeAttribute('aria-busy');}
}
function field(id){var el=document.getElementById(id);return el?el.value.trim():'';}
function documentOptions(w,kind){return w.docs.filter(function(d){return !kind || d.kind===kind;}).map(function(d){return '<option value="'+esc(d.id)+'">'+esc(d.name)+' · v'+d.version+'</option>';}).join('');}
function selectedDraft(w){return w.docs.find(function(d){return d.id===state.draftId && d.kind==='draft';}) || w.docs.find(function(d){return d.kind==='draft';});}
function mapFindings(w, review){
  return (review?review.findings:[]).map(function(f){
    var evidence=f.citations[0], requirement=w.requirements.find(function(r){return r.id===f.requirement_id;});
    return {id:f.requirement_id,title:f.requirement,req:f.requirement,status:statusKey[f.status]||'review',why:f.explanation,
      action:f.recommendation || 'Detailed recommendations are available with Premium.', citations:f.citations,
      sourceId:requirement && requirement.passage_id,
      ev:evidence?{doc:evidence.filename,page:evidence.page,text:evidence.quote,document_id:evidence.document_id}:null};
  });
}
async function hydrate(wid){
  var paths=['','/members','/documents','/tasks','/requirements','/reviews','/dashboard'];
  var results=await Promise.all(paths.map(function(p){return api(route(wid,p));}));
  var meta=results[0], members=results[1];
  var w={id:meta.id,name:meta.title,desc:meta.description,role:meta.role,code:meta.invite,due:null,limits:meta.limits,
    perms:{run:meta.role==='leader',view:true},members:members,requirements:results[4],reviews:results[5],dashboard:results[6],
    docs:results[2].map(function(d){return Object.assign({},d,{name:d.filename,type:{rubric:'Rubric',instructions:'Instructions',draft:'Draft',reference:'Reference'}[d.kind],
      by:(members.find(function(m){return m.id===d.user_id;})||{name:'Former member'}).name,date:fmt(d.created)});}),
    tasks:results[3].map(function(t){return Object.assign({},t,{status:taskUI[t.status],who:(members.find(function(m){return m.id===t.assignee_id;})||{name:'Unassigned'}).name,due:t.deadline,req:null});})};
  w.members.forEach(function(m){m.focus=m.role==='leader'?'Project leader':'Research contributor';});
  w.lastRun=w.reviews.length?timeText(w.reviews[0].created):'';
  w.findings=mapFindings(w,w.reviews[0]);
  return w;
}
async function reloadAccount(){
  var result=await Promise.all([api('/auth/me'),api('/subscription'),api('/workspaces')]);
  state.user=result[0];subscription=result[1];
  state.ws=await Promise.all(result[2].map(function(w){return hydrate(w.id);}));
}
async function refreshWorkspace(wid){
  var w=await hydrate(wid), index=state.ws.findIndex(function(x){return x.id===wid;});
  if(index<0) state.ws.push(w); else state.ws[index]=w;
  subscription=await api('/subscription');
  return w;
}
async function fileBlob(wid,did,page){
  var blob=await api(route(wid,'/documents/'+encodeURIComponent(did)+'/file'),{blob:true});
  var url=URL.createObjectURL(blob), link=document.createElement('a');link.href=url+(page?'#page='+page:'');link.target='_blank';link.rel='noopener';document.body.append(link);link.click();link.remove();
  setTimeout(function(){URL.revokeObjectURL(url);},60000);
}
function drawEvidence(f){
  if(!f.citations.length) return '<div class="banner">No draft quotation was verified for this finding. Inspect the draft before drawing a conclusion.</div>';
  return f.citations.map(function(c){return '<div class="paper"><div class="hd"><span>'+esc(c.filename)+'</span><span>Page '+c.page+'</span></div><div class="pg"><p><mark>'+esc(c.quote)+'</mark></p><button class="cite evidence-link" data-act="viewdoc" data-id="'+esc(c.document_id)+'" data-page="'+c.page+'">Open source PDF '+ic('arrow','sm')+'</button></div></div>';}).join('');
}
PAGES.review=function(w){
  if(state.reviewId){var saved=w.reviews.find(function(r){return r.id===state.reviewId;});if(saved)w=Object.assign({},w,{findings:mapFindings(w,saved),lastRun:timeText(saved.created)});}
  var fs=w.findings||[], selected=selFinding(w), draft=selectedDraft(w);
  var header='<div class="pagehead"><div><h1>AI Review</h1><p class="sub">Every finding beside the evidence that supports it.</p></div>'+
    (w.role==='leader'?'<button class="btn primary" data-act="run" '+(!aiReady||state.running!==null?'disabled':'')+'>'+ic('spark')+(state.running!==null?'Reviewing…':'Run review')+'</button>':'')+'</div>';
  var settings='<div class="card select-row"><div class="field"><label for="review-draft">Draft to review</label><select id="review-draft">'+(documentOptions(w,'draft')||'<option value="">Upload a draft first</option>')+'</select></div><div><span class="note">'+w.requirements.length+' rubric requirements · '+(w.reviews.length?'Last reviewed '+esc(w.lastRun):'No review yet')+'</span></div></div>';
  var note='<div class="banner">'+ic('q')+'<span>AI findings are advisory, not an official teacher evaluation.'+(!aiReady?' AI setup is pending. You can upload documents, define requirements, and assign tasks now.':'')+'</span></div>';
  if(state.running!==null) note+='<div class="card"><h3>Review in progress</h3><p class="note">Retrieving document evidence, checking requirements and validating quotations. This can take several minutes.</p></div>';
  if(!fs.length) return header+note+settings+'<div class="card empty"><span class="fileico">'+ic('spark')+'</span><h3>Make the next draft your strongest</h3><p>Add a rubric, define its requirements, and upload a draft. Your review will bring the checklist and document evidence together here.</p><button class="btn" data-act="page" data-p="documents">Prepare documents '+ic('arrow','sm')+'</button></div>';
  var c=counts(w), visible=fs.filter(function(f){return state.filter==='all'||f.status===state.filter;});
  var filter='<div class="filters">'+['all','met','partial','missing','review'].map(function(k){return '<button data-act="filter" data-f="'+k+'" aria-pressed="'+(state.filter===k)+'">'+(k==='all'?'All '+fs.length:ST[k].l+' '+c[k])+'</button>';}).join('')+'</div>';
  if(!selected)return header+note+settings+seg(c,fs.length)+filter+'<div class="card empty"><h3>No findings in this category</h3><p>Choose another status to view a requirement and its evidence.</p></div>';
  var detail='<div class="card stack"><div class="between"><span class="eyebrow">Requirement</span>'+pill(selected.status)+'</div><h2 class="reqtxt">'+esc(selected.req)+'</h2><div><div class="lbl">Why this status</div><p>'+esc(selected.why)+'</p></div><div><div class="lbl">Recommended action</div><p>'+esc(selected.action)+'</p></div><div class="lbl">Verified draft evidence</div>'+drawEvidence(selected)+
    (selected.sourceId?'<button class="btn small" data-act="rubricsource" data-id="'+esc(selected.sourceId)+'">Read rubric source</button>':'')+'</div>';
  var ask='<div class="card stack"><h3>Ask about this draft</h3><form data-form="ask" class="ask"><label class="sr" for="askq">Question</label><input id="askq" required placeholder="What does the methodology need?"><button type="submit" class="btn primary" '+(!aiReady?'disabled':'')+'>Ask</button></form>'+(state.ask?'<div class="answer">'+esc(state.ask.a)+'</div>':'')+'</div>';
  return header+note+settings+seg(c,fs.length)+filter+'<div class="rv"><div class="card checklist">'+visible.map(function(f){return '<button data-act="selfinding" data-id="'+esc(f.id)+'" aria-current="'+(f.id===selected.id)+'"><span class="ttl">'+esc(f.title)+'</span>'+pill(f.status)+'<span class="note">'+(f.citations.length?f.citations.length+' verified source'+(f.citations.length===1?'':'s'):'Needs evidence review')+'</span></button>';}).join('')+(visible.length?'':'<p class="note">No findings in this category.</p>')+'</div><div class="stack">'+detail+ask+'</div></div>';
};
PAGES.documents=function(w){
  var leader=w.role==='leader', kinds=leader?['Rubric','Instructions','Draft','Reference']:['Draft','Reference'];
  return '<div class="pagehead"><div><h1>Documents</h1><p class="sub">One project. All your source material, in the right place.</p></div><span class="role member">'+w.docs.length+' / '+w.limits.documents+' documents</span></div>'+
    '<div class="card"><div class="drop" data-drop><span class="fileico">'+ic('upload')+'</span><b>Drop PDF files here</b><p class="note">Selectable text · up to '+w.limits.file_mb+' MB per file</p><div class="select-row"><div class="field"><label for="doctype">Document type</label><select id="doctype">'+kinds.map(function(k){return '<option '+(k===state.docType?'selected':'')+'>'+k+'</option>';}).join('')+'</select></div><div class="field"><label for="revision-parent">Revision of</label><select id="revision-parent"><option value="">New document</option>'+documentOptions(w,'draft')+'</select></div></div><label class="btn primary small" for="fileinput">Choose PDFs</label><input class="sr" id="fileinput" type="file" accept="application/pdf,.pdf" multiple></div></div>'+
    '<div class="card"><h3>Workspace files</h3>'+w.docs.map(function(d){return '<div class="row"><span class="fileico">'+ic('file')+'</span><div class="grow"><div class="t">'+esc(d.name)+'</div><div class="s">'+esc(d.by)+' · '+esc(d.date)+' · Version '+d.version+'</div></div><span class="role member">'+esc(d.type)+'</span><div class="doc-actions"><button class="btn small" data-act="viewdoc" data-id="'+esc(d.id)+'">Open</button>'+(leader?'<button class="btn small" data-act="deletedoc" data-id="'+esc(d.id)+'">Remove</button>':'')+'</div></div>';}).join('')+(w.docs.length?'':'<div class="empty"><h3>A fresh start for your research</h3><p>Upload your rubric first, then your research draft.</p></div>')+'</div>'+
    '<div class="card"><div class="between"><div><h3>Rubric requirements</h3><p class="note">Turn your rubric into a checklist for the review.</p></div>'+(leader?'<button class="btn small" data-act="extract" '+(!aiReady?'disabled':'')+'>Extract with AI</button>':'')+'</div>'+
    (leader?'<form data-form="requirement" class="select-row" style="margin-top:14px"><div class="field"><label for="req-text">Add a requirement</label><textarea id="req-text" required maxlength="3000" placeholder="e.g. Explain participant selection and sampling."></textarea></div><button class="btn primary" type="submit">Add requirement</button></form><p class="note" style="margin-top:10px">You can enter requirements manually while AI setup is pending.</p>':'')+
    '<div class="req-list">'+w.requirements.map(function(r){return '<div class="row"><div class="grow">'+esc(r.description)+'</div>'+(leader?'<button class="btn small" data-act="deletereq" data-id="'+esc(r.id)+'">Remove</button>':'')+'</div>';}).join('')+(w.requirements.length?'':'<p class="note">No requirements added yet.</p>')+'</div></div>';
};
PAGES.settings=function(w){return '<div class="pagehead"><div><h1>Workspace Settings</h1><p class="sub">Keep the project’s purpose clear for your team.</p></div></div><div class="card"><form data-form="settings" class="stack"><div class="field"><label for="s-title">Project title</label><input id="s-title" required maxlength="200" value="'+esc(w.name)+'"></div><div class="field"><label for="s-desc">Description</label><textarea id="s-desc" maxlength="4000">'+esc(w.desc)+'</textarea></div><button class="btn primary" type="submit">Save changes</button></form></div><div class="card stack"><h3>Workspace permissions</h3><p class="note">The leader manages invitations, rubric requirements, team reviews and reports. Members can read shared findings, upload contributions, and update their own tasks. Set deadlines on individual tasks.</p></div>';};
var originalMembers=PAGES.members;
PAGES.members=function(w){return originalMembers(w).replace('<p class="note" style="margin-top:12px">Roles are per workspace. Role changes arrive with real accounts in the full build.</p>','<p class="note" style="margin-top:12px">One owner leads this workspace. Members can belong to other projects with different roles.</p>')+
  '<div class="card stack"><div class="between"><h3>Manage access</h3><button class="btn small" data-act="rotateinvite">Reset invite code</button></div>'+w.members.filter(function(m){return m.role!=='leader';}).map(function(m){return '<div class="row"><span class="grow">'+esc(m.name)+'</span><button class="btn small" data-act="removemember" data-id="'+esc(m.id)+'">Remove member</button></div>';}).join('')+'<p class="note">'+w.members.length+' of '+w.limits.members+' member seats used.</p></div>';};
PAGES.reports=function(w){var done=w.tasks.filter(function(t){return t.status==='done';}).length;return '<div class="pagehead"><div><h1>Teacher-ready report</h1><p class="sub">A clear picture of your research, ready to share.</p></div><button class="btn primary" data-act="exportpdf">'+ic('report')+'Export PDF'+(!w.limits.pdf_reports?' · Premium':'')+'</button></div><div class="doc"><div class="advisory">AI findings are advisory, not an official teacher evaluation.</div><h2 style="margin-top:20px">'+esc(w.name)+'</h2><p class="muted">'+esc(w.desc)+'</p><h4>Research team</h4><p>'+w.members.map(function(m){return esc(m.name)+' ('+m.role+')';}).join(', ')+'</p><h4>Progress</h4><p>'+done+' of '+w.tasks.length+' tasks completed. '+w.requirements.length+' rubric requirements.</p><h4>Latest review</h4>'+(w.findings.length?w.findings.map(function(f){return '<div class="stack-s" style="margin-bottom:20px"><div class="between"><b>'+esc(f.title)+'</b>'+pill(f.status)+'</div><p>'+esc(f.why)+'</p>'+f.citations.map(function(c){return '<p class="note">'+esc(c.filename)+', page '+c.page+': '+esc(c.quote)+'</p>';}).join('')+'</div>';}).join(''):'<p>No review completed yet.</p>')+'<h4>Open tasks</h4>'+w.tasks.filter(function(t){return t.status!=='done';}).map(function(t){return '<p>'+esc(t.title)+' · '+esc(t.who)+' · '+fmt(t.due)+'</p>';}).join('')+'</div>';};

/* Shared handlers retain the supplied navigation, layout and appearance. */
var ACT={
  togglepassword:function(button){var input=document.getElementById('a-pass'),show=input.type==='password';input.type=show?'text':'password';button.textContent=show?'Hide':'Show';button.setAttribute('aria-label',show?'Hide password':'Show password');button.setAttribute('aria-pressed',String(show));},
  landing:function(){go('landing');},auth:function(t){state.authMode=t.dataset.mode;go('auth');},home:function(){go('home');},
  profile:function(){go('profile');},menu:function(){state.menu=!state.menu;render(true);},
  openws:async function(t){await refreshWorkspace(t.dataset.id);state.wsId=t.dataset.id;state.page='overview';state.sel=null;state.filter='all';state.ask=null;state.draftId=null;state.reviewId=null;state.comparison=null;state.compareOldId=null;state.compareNewId=null;go('ws');},
  page:function(t){state.page=t.dataset.p;state.menu=false;render(false);},collapse:function(){state.collapsed=!state.collapsed;render(true);},
  panel:function(t){state.panel=t.dataset.p||null;state.panelMsg=null;render(true);},
  selfinding:function(t){state.sel=t.dataset.id;state.ask=null;render(true);},
  gofinding:function(t){state.reviewId=null;state.sel=t.dataset.id;state.filter='all';state.page='review';render(false);},
  filter:function(t){state.filter=t.dataset.f;render(true);},
  copy:async function(t){await navigator.clipboard.writeText(t.dataset.t);toast('Invite code copied');},
  logout:async function(){await api('/auth/logout',{method:'POST'});token='';sessionStorage.removeItem('reqvio_session');state.ws=[];state.user={name:'',email:''};subscription=null;go('landing');},
  viewdoc:async function(t){await fileBlob(cur().id,t.dataset.id,Number(t.dataset.page)||null);},
  deletedoc:async function(t){if(!confirm('Remove this document? Reviewed drafts and source documents used in history are protected.'))return;await api(route(cur(),'/documents/'+t.dataset.id),{method:'DELETE'});await refreshWorkspace(cur().id);render(true);toast('Document removed');},
  deletereq:async function(t){if(!confirm('Remove this rubric requirement? Saved reviews are retained.'))return;await api(route(cur(),'/requirements/'+t.dataset.id),{method:'DELETE'});await refreshWorkspace(cur().id);render(true);},
  rotateinvite:async function(){await api(route(cur(),'/invite'),{method:'POST'});await refreshWorkspace(cur().id);render(true);toast('New invite code created');},
  removemember:async function(t){if(!confirm('Remove this member from the workspace? Their assigned tasks will become unassigned.'))return;await api(route(cur(),'/members/'+t.dataset.id),{method:'DELETE'});await refreshWorkspace(cur().id);render(true);},
  extract:async function(){var w=cur(), doc=w.docs.find(function(d){return d.kind==='rubric'||d.kind==='instructions';});if(!doc)throw new Error('Upload a rubric or instruction PDF first.');await api(route(w,'/requirements/extract'),{method:'POST',body:{document_id:doc.id}});await refreshWorkspace(w.id);render(true);toast('Requirements extracted');},
  run:async function(){var w=cur(), d=selectedDraft(w);if(!d||!w.requirements.length)throw new Error('Upload a draft and add rubric requirements first.');state.reviewId=null;state.running=0;render(true);try{await api(route(w,'/reviews'),{method:'POST',body:{document_id:d.id}});await refreshWorkspace(w.id);toast('Review complete');}finally{state.running=null;render(true);}},
  exportpdf:async function(){var w=cur();if(!w.limits.pdf_reports){ACT.plans();return;}var blob=await api(route(w,'/reports/pdf'),{blob:true}), url=URL.createObjectURL(blob), a=document.createElement('a');a.href=url;a.download='reqvio-report.pdf';a.click();setTimeout(function(){URL.revokeObjectURL(url);},10000);},
  rubricsource:async function(t){var w=cur(), sources=w.docs.filter(function(d){return d.kind==='rubric'||d.kind==='instructions';});for(var d of sources){var passages=await api(route(w,'/documents/'+d.id+'/passages'));var source=passages.find(function(p){return p.id===t.dataset.id;});if(source){await fileBlob(w.id,d.id,source.page);return;}}throw new Error('The rubric source is no longer available.');}
};
async function addFiles(files){
  var w=cur(), kind=field('doctype').toLowerCase()||state.docType.toLowerCase(), parent=field('revision-parent'), done=0;
  if(parent && kind!=='draft') throw new Error('Only a draft can be uploaded as a revision.');
  if(parent && files.length!==1) throw new Error('Choose one file when uploading a revision.');
  try{for(var file of Array.from(files)){
    if(!/\.pdf$/i.test(file.name)) throw new Error(file.name+': choose a PDF file.');
    if(file.size>w.limits.file_mb*1024*1024) throw new Error(file.name+' exceeds your '+w.limits.file_mb+' MB file limit.');
    var form=new FormData();form.append('file',file);form.append('kind',kind);if(parent)form.append('parent_id',parent);
    await api(route(w,'/documents'),{method:'POST',body:form});done++;
  }}finally{await refreshWorkspace(w.id);render(true);if(done)toast(done+' document'+(done===1?'':'s')+' uploaded');}
}
document.addEventListener('click',function(e){
  var t=e.target.closest('[data-act]');
  if(t && ACT[t.dataset.act]){e.preventDefault();perform(function(){return ACT[t.dataset.act](t,e);});return;}
  if(state.menu&&!e.target.closest('.switch')){state.menu=false;render(true);}
});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&state.menu){state.menu=false;render(true);}});
document.addEventListener('change',function(e){var el=e.target;
  if(el.id==='doctype'){state.docType=el.value;return;}
  if(el.id==='review-draft'){state.draftId=el.value;return;}
  if(el.id==='compare-old'||el.id==='compare-new'){state[el.id==='compare-old'?'compareOldId':'compareNewId']=el.value;state.comparison=null;return;}
  if(el.id==='fileinput'){var files=Array.from(el.files);perform(function(){return addFiles(files);});return;}
  if(el.dataset.change==='task')perform(async function(){try{await api(route(cur(),'/tasks/'+el.dataset.id),{method:'PATCH',body:{status:taskAPI[el.value]}});}finally{await refreshWorkspace(cur().id);render(true);}toast('Task updated');});
});
['dragover','dragleave','drop'].forEach(function(name){document.addEventListener(name,function(e){var zone=e.target.closest&&e.target.closest('[data-drop]');if(!zone)return;e.preventDefault();zone.classList.toggle('over',name==='dragover');if(name==='drop'){var files=Array.from(e.dataTransfer.files);perform(function(){return addFiles(files);});}});});
document.addEventListener('submit',function(e){var form=e.target.closest('form[data-form]');if(!form)return;e.preventDefault();perform(async function(){
  var k=form.dataset.form;
  if(k==='auth'){
    var body={email:field('a-mail'),password:document.getElementById('a-pass').value};if(state.authMode==='signup')body.name=field('a-name');
    var result=await api('/auth/'+(state.authMode==='signup'?'signup':'login'),{method:'POST',body:body});
    token=result.access_token;sessionStorage.setItem('reqvio_session',token);await reloadAccount();go('home');
  }else if(k==='create'){
    var w=await api('/workspaces',{method:'POST',body:{title:field('c-title'),description:field('c-desc')}});await refreshWorkspace(w.id);state.panel=null;render(false);toast('Workspace created. You are the leader.');
  }else if(k==='join'){
    var joined=await api('/workspaces/join',{method:'POST',body:{code:field('j-code')}});await refreshWorkspace(joined.workspace_id);state.panel=null;render(false);toast(joined.joined?'You joined the workspace':'You are already a member');
  }else if(k==='addtask'){
    await api(route(cur(),'/tasks'),{method:'POST',body:{title:field('t-title'),assignee_id:field('t-who')||null,deadline:field('t-due')?new Date(field('t-due')+'T23:59:00').toISOString():null}});await refreshWorkspace(cur().id);render(true);toast('Task assigned');
  }else if(k==='requirement'){
    await api(route(cur(),'/requirements'),{method:'POST',body:{description:field('req-text')}});await refreshWorkspace(cur().id);render(true);toast('Requirement added');
  }else if(k==='settings'){
    await api(route(cur(),''),{method:'PATCH',body:{title:field('s-title'),description:field('s-desc')}});await refreshWorkspace(cur().id);render(true);toast('Workspace saved');
  }else if(k==='profile'){
    state.user=await api('/auth/me',{method:'PATCH',body:{name:field('p-name'),email:field('p-mail')}});await reloadAccount();render(true);toast('Profile saved');
  }else if(k==='ask'){
    var draft=selectedDraft(cur());if(!draft)throw new Error('Select a draft first.');
    var result=await api(route(cur(),'/questions'),{method:'POST',body:{question:field('askq'),document_id:draft.id}});state.ask={a:result.answer};render(true);
  }else if(k==='compare'){
    state.comparison=await api(route(cur(),'/comparisons'),{method:'POST',body:{old_document_id:field('compare-old'),new_document_id:field('compare-new')}});render(true);
  }
},form);});
render=function(keep){
  rawRender(keep);
  var signout=document.querySelector('[data-form="profile"] [data-act="landing"]');if(signout)signout.dataset.act='logout';
  var pass=document.getElementById('a-pass');if(pass){pass.minLength=state.authMode==='signup'?10:1;pass.maxLength=128;pass.autocomplete=state.authMode==='signup'?'new-password':'current-password';if(state.authMode==='signup')pass.placeholder='At least 10 characters';}
  var assignees=document.getElementById('t-who');if(assignees&&cur())Array.from(assignees.options).forEach(function(option,i){option.value=cur().members[i].id;});
  var draft=document.getElementById('review-draft');if(draft&&cur()){var selected=selectedDraft(cur());if(selected)draft.value=selected.id;}
  document.title=(state.view==='ws'&&cur()?cur().name+' · ':'')+'Reqvio';
};
window.addEventListener('DOMContentLoaded',async function(){
  document.getElementById('app').innerHTML='<div class="app-loading"><span class="logo">'+LOGO+'Reqvio</span><p class="muted">Preparing your research space…</p></div>';
  try{var result=await Promise.all([api('/health'),api('/plans')]);aiReady=result[0].ai_configured;planCatalog=result[1].plans;
    if(token){await reloadAccount();state.view='home';}render(false);
  }catch(e){render(false);showError(e);}
});
