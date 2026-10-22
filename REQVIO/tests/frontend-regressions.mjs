import assert from 'node:assert/strict';
import {createFrontendHarness} from './frontend-checks.mjs';

export async function checkFrontendRegressions(root){
  const results=[];
  async function test(name,run){
    try{await run();results.push({name,passed:true});}
    catch(error){results.push({name,passed:false,error:error.message});}
  }
  await test('Solo Research is an additional create option with personal navigation and tasks',async()=>{
    const {context}=await createFrontendHarness(root);
    context.state.user={id:'u',name:'Student'};
    context.state.ws=[];
    assert.match(context.viewHome(),/data-p="solo"/);
    context.state.panel='solo';assert.match(context.viewHome(),/Create personal workspace/);
    const w={id:'solo',mode:'solo',role:'leader',name:'My thesis',desc:'',due:null,limits:{},
      members:[{id:'u',name:'Student',role:'leader'}],tasks:[],docs:[],findings:[],reviews:[],requirements:[],dashboard:{}};
    context.state.ws=[w];context.state.wsId='solo';context.state.page='overview';
    let html=context.viewWs();assert.match(html,/My Research/);assert.doesNotMatch(html,/data-p="members"/);
    html=context.PAGES.tasks(w);assert.match(html,/Add task/);assert.doesNotMatch(html,/Assign to/);
    assert.match(context.PAGES.settings(w),/convertgroup/);
    w.mode='group';assert.match(context.viewWs(),/data-p="members"/);
  });
  await test('AI checked indication belongs to the selected draft and keeps Needs Review distinct from completion',async()=>{
    const {context,handlers}=await createFrontendHarness(root);
    const w={id:'w',role:'leader',limits:{documents:30,file_mb:5},requirements:[],members:[],tasks:[],
      docs:[{id:'checked',kind:'draft',name:'Checked.pdf',version:1,last_reviewed_at:'2026-10-22T06:00:00Z',review_count:1},
            {id:'new',kind:'draft',name:'New.pdf',version:2,last_reviewed_at:null,review_count:0}],
      reviews:[{id:'r',document_id:'checked',created:'2026-10-22T06:00:00Z',findings:[{
        requirement_id:'req',requirement:'Check sampling',status:'Needs Review',explanation:'Human assessment needed',citations:[]}]}],findings:[]};
    context.state.ws=[w];context.state.wsId='w';context.state.draftId='checked';
    let html=context.PAGES.review(w);
    assert.match(html,/AI checked/);assert.match(html,/Checked\.pdf/);assert.match(html,/Needs Review/);
    context.state.draftId='new';html=context.PAGES.review(w);
    assert.match(html,/Not checked yet/);assert.doesNotMatch(html,/Human assessment needed/);
    let renders=0;context.render=()=>{renders++;};
    for(const handler of handlers.change)handler({target:{id:'review-draft',value:'checked',dataset:{}}});
    assert.equal(renders,1,'Changing draft must immediately refresh its review indication');
  });
  await test('keep renders suppress page entrance motion and normal navigation restores it',async()=>{
    const {context,elements}=await createFrontendHarness(root);
    context.state.view='landing';context.render(true);assert.equal(elements.app.classList.contains('keep'),true);
    context.render(false);assert.equal(elements.app.classList.contains('keep'),false);
    context.state.view='plans';context.render(true);assert.equal(elements.app.classList.contains('keep'),true);
  });
  await test('Research Team offer requires four members in an owned workspace',async()=>{
    const {context,elements}=await createFrontendHarness(root);
    context.state.user={name:'Student',plan:'free'};
    const owned={id:'owned',role:'leader',members:[{},{},{}],limits:{members:5}};
    context.state.ws=[owned,{id:'joined',role:'member',members:[{},{},{},{}]}];
    context.state.view='plans';context.render(false);
    assert.match(elements.app.innerHTML,/disabled>Needs 4 members/);
    let message='';context.toast=text=>{message=text;};
    context.ACT.offer({dataset:{plan:'Research Team'}});
    assert.match(message,/at least 4/);
    owned.members.push({});context.render(false);
    assert.doesNotMatch(elements.app.innerHTML,/disabled>Needs 4 members/);
    assert.equal(context.ReqvioPlan.canAddMember(owned),true);
    owned.members.push({});assert.equal(context.ReqvioPlan.canAddMember(owned),false);
  });
  await test('password visibility toggles without clearing the typed password or submitting the form',async()=>{
    const {context,elements}=await createFrontendHarness(root);
    elements['a-pass']={type:'password',value:'My typed password!'};
    const button={textContent:'Show',setAttribute(name,value){this[name]=value;}};
    context.ACT.togglepassword(button);
    assert.equal(elements['a-pass'].type,'text');
    assert.equal(elements['a-pass'].value,'My typed password!');
    assert.equal(button.textContent,'Hide');
    assert.equal(button['aria-pressed'],'true');
    context.ACT.togglepassword(button);
    assert.equal(elements['a-pass'].type,'password');
    assert.equal(elements['a-pass'].value,'My typed password!');
    assert.equal(button.textContent,'Show');
    for(const mode of ['signin','signup']){
      context.state.authMode=mode;
      assert.match(context.viewAuth(),/type="button"[^>]*data-act="togglepassword"/);
    }
  });
  await test('failed sign-in preserves the form instead of treating wrong credentials as an expired session',async()=>{
    const {context}=await createFrontendHarness(root);
    context.state.view='auth';let renders=0;context.render=()=>{renders++;};
    context.fetch=async()=>({ok:false,status:401,json:async()=>({detail:'Invalid email or password'})});
    await assert.rejects(()=>context.api('/auth/login',{method:'POST',body:{email:'student@example.com',password:'wrong'}}),/Invalid email or password/);
    assert.equal(renders,0,'Wrong credentials must not recreate the sign-in form and erase typed values');
  });
  await test('an expired authenticated session still clears account data and returns to sign-in',async()=>{
    const {context}=await createFrontendHarness(root);
    context.token='expired';context.state.view='home';context.state.user={name:'Student'};context.state.ws=[{id:'private'}];
    context.render=()=>{};
    context.fetch=async()=>({ok:false,status:401,json:async()=>({detail:'Session expired or invalid'})});
    await assert.rejects(()=>context.api('/auth/me'),/Session expired/);
    assert.equal(context.token,'');assert.equal(context.state.view,'auth');assert.equal(context.state.ws.length,0);
  });
  await test('review filtering selects a finding inside the chosen status',async()=>{
    const {context}=await createFrontendHarness(root);
    const w={id:'w',findings:[{id:'met-finding',status:'met'},{id:'missing-finding',status:'missing'}]};
    context.state.ws=[w];context.state.wsId='w';context.state.sel='met-finding';context.render=()=>{};
    context.ACT.filter({dataset:{f:'missing'}});
    assert.equal(context.selFinding(w).id,'missing-finding','Detail must belong to the filtered checklist');
  });
  await test('a filter with no findings does not show an excluded requirement',async()=>{
    const {context}=await createFrontendHarness(root);
    const w={id:'w',findings:[{id:'met-finding',status:'met'}]};
    context.state.ws=[w];context.state.wsId='w';context.state.sel='met-finding';context.render=()=>{};
    context.ACT.filter({dataset:{f:'missing'}});
    assert.equal(context.selFinding(w),null,'Empty category must not show a finding from another category');
  });
  await test('comparison draft selections survive rerendering',async()=>{
    const {context,elements,handlers}=await createFrontendHarness(root);
    const select=(ids)=>{let index=0;return {options:ids.map(id=>({value:id})),get selectedIndex(){return index;},set selectedIndex(v){index=v;},get value(){return ids[index];},set value(v){index=ids.indexOf(v);}};};
    elements['compare-old']=select(['d3','d2','d1']);elements['compare-new']=select(['d3','d2','d1']);
    const w={id:'w',name:'Study',role:'leader',limits:{comparison:true},members:[],tasks:[],findings:[],requirements:[],dashboard:{},
      docs:['d3','d2','d1'].map((id,i)=>({id,name:id+'.pdf',kind:'draft',version:3-i}))};
    context.state.ws=[w];context.state.wsId='w';context.state.view='ws';context.state.page='comparison';
    context.render(false);
    elements['compare-old'].value='d1';elements['compare-new'].value='d2';
    for(const id of ['compare-old','compare-new'])for(const handler of handlers.change){handler({target:Object.assign(elements[id],{id,dataset:{}})});}
    context.render(true);
    assert.equal(elements['compare-old'].value,'d1','Original draft selection was reset');
    assert.equal(elements['compare-new'].value,'d2','Revised draft selection was reset');
  });
  return results;
}
