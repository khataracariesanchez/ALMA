/* Additional Solo Research views. Group workspace views are delegated unchanged. */
(function(){
'use strict';
var groupOverview=PAGES.overview,groupTasks=PAGES.tasks,groupProgress=PAGES.progress;
var groupSettings=PAGES.settings,groupReports=PAGES.reports;
function personalProgress(w){return progressBlock(w).replace('Work the team has marked done','Work you have marked done');}
PAGES.overview=function(w){
  if(w.mode!=='solo')return groupOverview(w);
  var done=w.tasks.filter(function(t){return t.status==='done';}).length;
  return '<div class="pagehead"><div><p class="eyebrow" style="margin-bottom:8px">Solo Research</p><h1>My Research</h1><p class="sub">'+esc(w.name)+' · Your personal research workspace</p></div><button class="btn primary" data-act="page" data-p="review">'+ic('spark')+'AI Review</button></div>'+
    '<div class="card"><h3>'+esc(w.name)+'</h3><p class="muted">'+esc(w.desc||'Build your research one step at a time.')+'</p><div class="strip" style="margin-top:18px"><div><b>'+w.docs.length+'</b><span>Documents</span></div><div><b>'+done+' / '+w.tasks.length+'</b><span>My tasks completed</span></div><div><b>'+w.requirements.length+'</b><span>Rubric requirements</span></div></div></div>'+
    '<div class="banner">'+ic('q')+'<span>Upload your rubric and draft, add requirements, and use AI review to identify what needs work. Your adviser remains the authority on assessment.</span></div>'+personalProgress(w);
};
PAGES.tasks=function(w){
  if(w.mode!=='solo')return groupTasks(w);
  return '<div class="pagehead"><div><h1>My Tasks</h1><p class="sub">Break your research into manageable steps and set your own deadlines.</p></div></div>'+
    '<div class="card"><form data-form="addtask" class="select-row"><div class="field"><label for="t-title">New task</label><input id="t-title" required maxlength="300" placeholder="e.g. Explain the sampling method"></div><div class="field"><label for="t-due">Due</label><input id="t-due" type="date"></div><button class="btn primary" type="submit">Add task</button></form></div>'+
    '<div class="card">'+(w.tasks.length?taskGroups(w,w.tasks,function(){return true;}):'<div class="empty"><h3>Your next step starts here</h3><p>Add a task above. Every task in this workspace belongs to you.</p></div>')+'</div>'+personalProgress(w);
};
PAGES.progress=function(w){return w.mode==='solo'?'<div class="pagehead"><div><h1>My Progress</h1><p class="sub">Track your work separately from what your draft demonstrates.</p></div></div>'+personalProgress(w):groupProgress(w);};
PAGES.settings=function(w){
  if(w.mode!=='solo')return groupSettings(w);
  return '<div class="pagehead"><div><h1>Research Settings</h1><p class="sub">Manage your personal project.</p></div><span class="role leader">Solo Research</span></div><div class="card"><form data-form="settings" class="stack"><div class="field"><label for="s-title">Project title</label><input id="s-title" required maxlength="200" value="'+esc(w.name)+'"></div><div class="field"><label for="s-desc">Description</label><textarea id="s-desc" maxlength="4000">'+esc(w.desc)+'</textarea></div><button class="btn primary" type="submit">Save changes</button></form></div>'+
    '<div class="card stack"><h3>Private by default</h3><p class="note">Only you can access this workspace. AI review, documents, tasks, progress, history and plan features use the same limits as your other projects.</p><h3>Researching with others later?</h3><p class="note">Convert this project to a group workspace to invite teammates. Your existing work stays in place. This does not change your subscription.</p><button class="btn" data-act="convertgroup">Convert to group workspace</button></div>';
};
PAGES.reports=function(w){var html=groupReports(w);return w.mode==='solo'?html.replace('<h4>Research team</h4>','<h4>Researcher</h4>'):html;};
})();
