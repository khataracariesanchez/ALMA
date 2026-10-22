import assert from 'node:assert/strict';
import {createFrontendHarness} from './frontend-checks.mjs';

export async function checkFrontendRegressions(root){
  const results=[];
  async function test(name,run){
    try{await run();results.push({name,passed:true});}
    catch(error){results.push({name,passed:false,error:error.message});}
  }
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
