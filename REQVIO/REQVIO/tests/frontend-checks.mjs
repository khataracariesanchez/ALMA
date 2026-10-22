// Template and API-adapter checks. This is not a browser/layout test.
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';

export async function createFrontendHarness(root){
  const handlers={};
  const elements={app:{innerHTML:'',insertAdjacentHTML(position,html){this.innerHTML+=html;},setAttribute(){},removeAttribute(){}},toast:{appendChild(){}}};
  const document={
    title:'',documentElement:{dataset:{},setAttribute(){},removeAttribute(){}},
    getElementById(id){return elements[id]||null;},
    querySelector(selector){return selector==='.main-in'?elements.app:null;},
    querySelectorAll(){return [];},addEventListener(name,handler){(handlers[name] ||= []).push(handler);},
    createElement(){return {setAttribute(){},remove(){},append(){},appendChild(){},click(){},scrollIntoView(){},showModal(){},addEventListener(){},classList:{}};},
    body:{append(){}}
  };
  const storage=new Map();
  const store={getItem(k){return storage.get(k)||null;},setItem(k,v){storage.set(k,v);},removeItem(k){storage.delete(k);}};
  class TestFormData { append(){} }
  const context=vm.createContext({document,console,Headers,FormData:TestFormData,URL,Date,Promise,Error,sessionStorage:store,localStorage:store,
    setTimeout(){},scrollY:0,scrollTo(){},confirm(){return true;},navigator:{clipboard:{writeText:async()=>{}}},
    matchMedia(){return {matches:false};},fetch:async()=>{throw Error('Unexpected request');}});
  context.window=context;context.addEventListener=()=>{};
  for(const name of ['app.js','integration.js','premium.js']){
    new vm.Script(await readFile(root+'/frontend/'+name,'utf8'),{filename:name}).runInContext(context);
  }
  return {context,elements,handlers,storage};
}

export async function checkFrontend(root){
  const {context,elements,storage}=await createFrontendHarness(root);
  const free={checks_per_month:2,documents:2,file_mb:5,workspaces:1,members:3,tasks:20,history:3,
    detailed_feedback:false,comparison:false,pdf_reports:false,detailed_dashboard:false};
  const paid={...free,history:null,detailed_feedback:true,comparison:true,pdf_reports:true,detailed_dashboard:true};
  context.state.user={id:'u1',name:'Student',email:'student@example.com',plan:'free'};
  const make=(role,limits,populated)=>({id:'w1',name:'Study <script>bad()</script>',desc:'Research & evidence',role,code:'InviteCode',due:null,
    limits,perms:{run:role==='leader',view:true},lastRun:'Oct 22',
    members:[{id:'u1',name:'Student',role,focus:'Research'}],requirements:[{id:'r1',description:'Describe methodology',passage_id:'p1'}],
    docs:populated?[{id:'d1',name:'draft.pdf',kind:'draft',type:'Draft',filename:'draft.pdf',date:'Oct 22',version:2,by:'Student'},
      {id:'d2',name:'rubric.pdf',kind:'rubric',type:'Rubric',filename:'rubric.pdf',date:'Oct 21',version:1,by:'Student'}]:[],
    tasks:populated?[{id:'t1',title:'Methodology',assignee_id:'u1',who:'Student',status:'todo',due:null}]:[],
    findings:populated?[{id:'r1',title:'Describe methodology',req:'Describe methodology',status:'partial',why:'Sampling needs work',action:'Add sampling',
      citations:[{passage_id:'p1',document_id:'d1',filename:'draft.pdf',page:1,quote:'A student survey'}],ev:{doc:'draft.pdf',page:1,text:'A student survey'},sourceId:'p1'}]:[],
    reviews:[],dashboard:{contributions:[],revisions:[]}});
  let rendered=0;
  for(const role of ['leader','member'])for(const limits of [free,paid])for(const populated of [false,true]){
    const workspace=make(role,limits,populated);context.state.ws=[workspace];context.state.wsId=workspace.id;
    context.state.view='ws';context.state.sel=null;
    for(const [page] of context.NAV[role]){
      context.state.page=page;context.render(false);assert.ok(elements.app.innerHTML.includes('Reqvio'));rendered++;
      assert.ok(!elements.app.innerHTML.includes('<script>bad()</script>'),'Workspace title must be escaped');
    }
    context.state.page='review';workspace.findings.forEach(f=>{f.citations=[];f.ev=null;});context.render(false);rendered++;
  }
  for(const view of ['landing','auth','home','profile','plans']){context.state.view=view;context.render(false);assert.ok(elements.app.innerHTML);rendered++;}
  assert.equal(context.ReqvioPlan.isPremium(),false,'local storage must not grant premium');
  storage.set('reqvio_plan_student@example.com','team');assert.equal(context.ReqvioPlan.isPremium(),false);
  context.token='session';let sent;
  context.fetch=async(path,options)=>{sent={path,options};return {ok:true,status:200,json:async()=>({saved:true})};};
  await context.api('/workspaces',{method:'POST',body:{title:'Evidence'}});
  assert.equal(sent.options.headers.get('Authorization'),'Bearer session');
  assert.equal(JSON.parse(sent.options.body).title,'Evidence');
  context.fetch=async()=>({ok:false,status:403,json:async()=>({detail:{code:'plan_limit',feature:'documents',limit:2}})});
  await assert.rejects(()=>context.api('/example'),/documents.*2/);
  context.fetch=async()=>({ok:false,status:503,json:async()=>({detail:'ALMA is not configured'})});
  await assert.rejects(()=>context.api('/example'),/ALMA is not configured/);
  return `${rendered} page/role/plan scenarios passed; request serialization, quota errors and server-only entitlements passed.`;
}
