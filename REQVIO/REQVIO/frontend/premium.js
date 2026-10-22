/* Premium UI and theme layer. The server remains the authority for every entitlement. */
(function(){
'use strict';
P.crown='M3 8l4 4 5-7 5 7 4-4-2 11H5z';
P.history='M3 12a9 9 0 1 0 3-6.7 M3 4v5h5 M12 8v4l3 2';
P.compare='M8 3L4 7l4 4 M4 7h12 M16 21l4-4-4-4 M20 17H8';
P.sun='M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v2 M12 20v2 M2 12h2 M20 12h2';
P.moon='M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z';
function theme(){try{return localStorage.getItem('reqvio_theme')||'system';}catch(e){return 'system';}}
function setTheme(value){try{if(value==='system')localStorage.removeItem('reqvio_theme');else localStorage.setItem('reqvio_theme',value);}catch(e){}applyTheme();render(true);}
function applyTheme(){var t=theme();if(t==='system')document.documentElement.removeAttribute('data-theme');else document.documentElement.dataset.theme=t;}
applyTheme();
function badge(){return '<span class="pbadge">'+ic('crown','sm')+'Premium</span>';}
function locked(title,description){return '<div class="card pm-lock"><span class="fileico">'+ic('crown')+'</span><div class="grow"><h3>'+title+'</h3><p class="note">'+description+'</p></div><button class="btn primary" data-act="plans">Explore plans</button></div>';}
['leader','member'].forEach(function(role){NAV[role].splice(NAV[role].length-1,0,['comparison','Revision Comparison','compare'],['history','Research History','history']);});
PAGES.comparison=function(w){
  var head='<div class="pagehead"><div><h1>Revision Comparison</h1><p class="sub">See how your thinking evolves from one draft to the next.</p></div>'+badge()+'</div>';
  if(!w.limits.comparison)return head+locked('Make every revision count','Compare drafts with an AI summary and a complete text diff. Available when the workspace owner has Premium.');
  var drafts=w.docs.filter(function(d){return d.kind==='draft';});
  if(drafts.length<2)return head+'<div class="card empty"><h3>Your next draft tells a story</h3><p>Upload at least two drafts to compare. Choose “Revision of” when uploading a revised file.</p><button class="btn" data-act="page" data-p="documents">Upload a revision</button></div>';
  var result=state.comparison;
  return head+(!aiReady?'<div class="banner">AI setup is pending. Your draft versions are saved and ready to compare later.</div>':'')+
    '<div class="card stack"><form data-form="compare" class="stack"><div class="cmp-pick"><div class="field"><label for="compare-old">Original draft</label><select id="compare-old">'+documentOptions(w,'draft')+'</select></div><div class="field"><label for="compare-new">Revised draft</label><select id="compare-new">'+documentOptions(w,'draft')+'</select></div></div><button type="submit" class="btn primary" '+(!aiReady?'disabled':'')+'>'+ic('compare')+'Compare drafts</button></form></div>'+
    (result?'<div class="card stack"><h3>What changed</h3><p>'+esc(result.comparison.summary||'')+'</p><p class="note">'+esc(result.ai_scope)+'</p>'+['improvements','remaining_issues'].map(function(k){return Array.isArray(result.comparison[k])?'<h3>'+(k==='improvements'?'Improvements':'Still to consider')+'</h3><ul>'+result.comparison[k].map(function(s){return '<li>'+esc(s)+'</li>';}).join('')+'</ul>':'';}).join('')+'<details><summary>View full text diff</summary><pre class="diff">'+esc(result.diff)+'</pre></details><div class="banner">AI comparisons are advisory.</div></div>':'');
};
PAGES.history=function(w){return '<div class="pagehead"><div><h1>Research History</h1><p class="sub">Your team’s reviews and revisions, all in one place.</p></div><span class="role member">'+(w.limits.history?'Recent '+w.limits.history+' reviews':'Full review history')+'</span></div>'+
  (w.limits.history?'<div class="banner upsell"><span>Your latest '+w.limits.history+' reviews are available on Free. Premium includes the full history.</span><button class="btn small" data-act="plans">Explore plans</button></div>':'')+
  '<div class="card"><h3>Review timeline</h3>'+w.reviews.map(function(r){var d=w.docs.find(function(d){return d.id===r.document_id;});return '<button class="history-entry" data-act="openreview" data-id="'+esc(r.id)+'"><div><b>'+esc(d?d.name:'Research draft')+'</b><p class="note">'+esc(timeText(r.created))+' · '+r.findings.length+' findings</p></div>'+ic('arrow','sm')+'</button>';}).join('')+(w.reviews.length?'':'<div class="empty"><h3>The beginning of your research story</h3><p>Completed AI reviews will appear here with their saved evidence.</p></div>')+'</div>'+
  (w.limits.detailed_dashboard?'<div class="card"><h3>Document revisions</h3>'+w.docs.filter(function(d){return d.kind==='draft';}).map(function(d){return '<div class="row"><span class="fileico">'+ic('file')+'</span><div class="grow"><b>'+esc(d.name)+'</b><p class="note">Version '+d.version+' · '+esc(d.date)+' · '+esc(d.by)+'</p></div><button class="btn small" data-act="viewdoc" data-id="'+esc(d.id)+'">Open</button></div>';}).join('')+'</div>':'');};
ACT.openreview=function(t){var w=cur(), r=w.reviews.find(function(r){return r.id===t.dataset.id;});if(!r)return;state.reviewId=r.id;state.draftId=r.document_id;state.sel=null;state.filter='all';state.page='review';state.ask=null;render(false);};
ACT.plans=function(){state.planReturn=state.view==='plans'?(state.planReturn||'landing'):state.view;state.view='plans';render(false);};
ACT.planback=function(){state.view=state.planReturn||'landing';render(false);};
ACT.theme=function(){var t=theme(), dark=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);setTheme(dark?'light':'dark');};
ACT.themesystem=function(){setTheme('system');toast('Theme follows your device');};
ACT.offer=function(t){
  var dialog=document.createElement('dialog');dialog.className='modal';dialog.setAttribute('aria-labelledby','offer-title');
  dialog.innerHTML='<h2 id="offer-title">'+esc(t.dataset.plan)+' is a planned offer</h2><p>Checkout is not connected yet, and this offer is not active. No payment will be taken and your plan will stay unchanged.</p><p class="note" style="margin-top:14px">The current backend supports Free and administrator-provisioned Premium access. Subscription limits shown in your workspace are the active limits.</p><form method="dialog" class="cta"><button class="btn primary">Got it</button></form>';
  document.body.append(dialog);dialog.addEventListener('close',function(){dialog.remove();});dialog.showModal();
};
var offers=[
  {id:'free',name:'Free',price:'$0',period:'always',sub:'Start your first research project',features:['2 AI reviews per month','2 documents · up to 5 MB','1 owned workspace','Up to 3 team members','Basic progress and recent reviews']},
  {id:'student',name:'Student Pro',price:'$1.49',period:'/ month',year:'$12.99 / year · save 27%',sub:'For individual researchers',features:['15 checks per month','25 documents · up to 25 MB','3 research projects','Revision comparison and PDF reports','Full feedback and history']},
  {id:'team',name:'Research Team',price:'$3.49',period:'/ month',year:'$31.99 / year · save 24%',sub:'Research together with evidence',features:['40 shared checks per month','50 documents · up to 50 MB','10 research projects','Up to 5 members','Contribution tracking and full history']}
];
function planPage(){return '<header class="up-bar"><button class="up-back" data-act="planback">'+ic('arrow','sm')+'Back</button><span class="logo">'+LOGO+'Reqvio</span><button class="themebtn" data-act="theme" aria-label="Toggle color theme">'+ic('sun')+'</button></header><main class="up-wrap"><div class="up-head"><p class="eyebrow" style="margin-bottom:12px">Room for your next big idea</p><h1>Good research grows together.</h1><p>Start with Free. Explore the planned offers for more drafts, deeper feedback, and a team that stays in sync.</p></div>'+
  '<div class="up-why"><span class="fileico">'+ic('q')+'</span><div><b>Pricing preview · checkout coming later</b><p>Student Pro, Research Team, and Research Pass are proposed offers from your supplied design. They cannot be purchased or activated here yet.</p></div></div>'+
  (subscription?'<div class="banner" style="max-width:800px;margin:0 auto 24px">Current account: '+esc(subscription.plan==='premium'?'Premium':'Free')+' · '+subscription.checks_used+' / '+subscription.limits.checks_per_month+' monthly reviews used. Active team limits follow each workspace owner’s subscription.</div>':'')+
  '<div class="up-grid">'+offers.map(function(o){return '<article class="up-card '+(o.id==='student'?'pro':'')+'"><div class="up-top"><div class="up-ico">'+ic(o.id==='free'?'file':o.id==='team'?'users':'crown')+'</div><h2 class="up-name">'+o.name+'</h2><p class="up-sub">'+o.sub+'</p><div class="up-price"><b>'+o.price+'</b><span>'+o.period+'</span></div><div class="up-yr">'+(o.year?'<p class="up-save">'+o.year+'</p><p class="note">Proposed annual pricing</p>':'<p class="up-aud">A practical place to begin.</p>')+'</div><button class="btn '+(o.id==='student'?'primary':'')+' up-cta" data-act="'+(o.id==='free'?(token?'planback':'auth'):'offer')+'" data-mode="signup" data-plan="'+o.name+'">'+(o.id==='free'?(token?'Continue researching':'Get started free'):'View planned offer')+'</button><p class="up-small">'+(o.id==='free'?'No payment required':'Not available for purchase yet')+'</p></div><div class="up-list"><ul>'+o.features.map(function(f){return '<li>'+ic('check','sm')+'<span>'+esc(f)+'</span></li>';}).join('')+'</ul></div></article>';}).join('')+'</div>'+
  '<article class="up-card up-pass"><div class="up-passinfo"><span class="eyebrow">For your next deadline · planned offer</span><h2 class="up-name" style="margin-top:10px">Research Pass</h2><div class="up-price"><b>$2.99</b><span>one time · 90 days</span></div><p class="muted">20 AI checks, revision comparison, and PDF reports.</p></div><div class="up-passcta"><button class="btn primary up-cta" data-act="offer" data-plan="Research Pass">View planned offer</button></div></article><p class="plan-note">Free and Premium are the currently implemented backend plans. The proposed paid offers above will need matching backend entitlements and billing before launch.</p></main>';}
var baseRender=render;
render=function(keep){
  if(state.view==='plans'){var y=scrollY;document.getElementById('app').innerHTML=planPage();scrollTo(0,keep?y:0);document.title='Plans · Reqvio';return;}
  baseRender(keep);
  var top=document.querySelector('.topbar .avatar');
  if(top){top.insertAdjacentHTML('beforebegin','<button class="planchip '+(state.user.plan==='premium'?'on':'')+'" data-act="plans">'+ic('crown','sm')+(state.user.plan==='premium'?'Premium':'Free · View plans')+'</button><button class="themebtn" data-act="theme" aria-label="Toggle color theme">'+ic('sun')+'</button>');}
  var nav=document.querySelector('.nav .cta');if(nav)nav.insertAdjacentHTML('afterbegin','<button class="btn" data-act="plans">Plans</button>');
  document.querySelectorAll('.themefab').forEach(function(el){el.remove();});
  if(!top)document.getElementById('app').insertAdjacentHTML('beforeend','<button class="themebtn themefab" data-act="theme" aria-label="Toggle color theme">'+ic('sun')+'</button>');
  var profile=document.querySelector('[data-form="profile"]');if(profile)profile.insertAdjacentHTML('beforeend','<div class="between"><span class="note">Theme: '+esc(theme())+'</span><button class="btn small" type="button" data-act="themesystem">Follow device theme</button><button class="btn small" type="button" data-act="plans">Manage plan</button></div>');
  var w=cur();if(state.view==='ws'&&w){
    if(state.page==='comparison'){
      var old=document.getElementById('compare-old'), newer=document.getElementById('compare-new');
      if(old){old.value=state.compareOldId||((old.options[1]||old.options[0]||{}).value||'');}
      if(newer){newer.value=state.compareNewId||((newer.options[0]||{}).value||'');}
    }
    if(w.limits.detailed_dashboard&&['overview','tasks','progress'].includes(state.page)){
      var list=w.dashboard.contributions||[], html='<div class="card"><h3>Recorded contributions</h3><p class="note">Uploads, review runs, and task updates recorded by the workspace.</p>'+list.map(function(c){var m=w.members.find(function(m){return m.id===c.user_id;});return '<div class="row"><span class="avatar">'+esc(initials(m?m.name:'Former member'))+'</span><span class="grow">'+esc(m?m.name:'Former member')+' · '+esc(c.action)+'</span><b>'+c.count+'</b></div>';}).join('')+(list.length?'':'<p class="note">Your team’s activity will appear here.</p>')+'</div>';
      document.querySelector('.main-in').insertAdjacentHTML('beforeend',html);
    }
    var runs=document.querySelector('[data-act="run"]');if(runs&&!w.limits.detailed_feedback)runs.insertAdjacentHTML('afterend','<button class="btn" data-act="plans">Detailed feedback '+badge()+'</button>');
  }
};
window.ReqvioPlan={isPremium:function(){return state.user.plan==='premium';},limits:function(){return cur()?cur().limits:subscription&&subscription.limits;},openUpgrade:ACT.plans,setTheme:setTheme};
})();
