import { expect, test } from '@playwright/test';
import { blankState, completedWorkout } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

test.use({serviceWorkers:'block'});
const origin='https://appearance-fixture.supabase.co';
const auth='81000000-0000-0000-0000-000000000001';
const account='81000000-0000-0000-0000-000000000002';
const row=(id,client_id,accent,theme='performance-dark')=>({id,account_id:account,client_id,display_name:client_id,accent,accent_version:0,theme,pet_enabled:true,created_at:'2026-08-01T00:00:00Z'});
function cloud() {
  return {rows:[row('81000000-0000-0000-0000-000000000003','jorge','ember'),row('81000000-0000-0000-0000-000000000004','alexa','rose','wellness-light')],writes:[],fail:false,hold:null,auth,account};
}
async function install(page, remote, {independent=false, fresh=false}={}) {
  const profile=remote.rows[0];
  await page.addInitScript(({origin,auth,account,profile,independent,fresh,local})=>{
    window.__BIG_GAINS_CLOUD_CONFIG__={supabaseUrl:origin,supabasePublishableKey:'sb_publishable_synthetic_appearance'};
    if(localStorage.getItem('appearance-cloud-seeded'))return;
    const encode=x=>btoa(JSON.stringify(x)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
    const exp=Math.floor(Date.now()/1000)+3600;
    localStorage.setItem('big-gains-supabase-auth-v1',JSON.stringify({access_token:`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:auth,role:'authenticated',exp})}.test`,refresh_token:'test',token_type:'bearer',expires_at:exp,user:{id:auth,aud:'authenticated',email:'fixture@example.test'}}));
    const presentation={petEnabled:profile.pet_enabled,accent:profile.accent,theme:profile.theme};
    localStorage.setItem('big-gains-runtime-accounts-v1',JSON.stringify({version:1,activeAuthUserId:auth,accounts:{[auth]:independent
      ?{kind:'independent',authUserId:auth,cloudAccountId:account,cloudProfileId:profile.id,clientId:profile.client_id,displayName:profile.display_name,presentation}
      :{kind:'managed-owner',authUserId:auth,cloudAccountId:account}}}));
    if(independent)localStorage.setItem(`big-gains-cloud-${account}-${profile.id}-v1`,JSON.stringify({...local,profileId:profile.client_id}));
    else {localStorage.setItem('big-gains-active-profile','jorge');localStorage.setItem('big-gains-v2',JSON.stringify(local));localStorage.setItem('big-gains-alexa-v1',JSON.stringify({...local,profileId:'alexa'}));}
    localStorage.setItem('appearance-cloud-seeded','1');
  },{origin,auth:remote.auth,account:remote.account,profile,independent,fresh,local:{...blankState('jorge'),workouts:[completedWorkout()]}});
  await page.route(origin+'/**',async route=>{
    const request=route.request(),url=new URL(request.url());
    const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,HEAD,POST,PATCH,OPTIONS','content-type':'application/json'};
    const send=(data,status=200)=>route.fulfill({status,headers,body:JSON.stringify(data)});
    if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
    if(url.pathname==='/auth/v1/user')return send({id:remote.auth,aud:'authenticated',email:'fixture@example.test',email_confirmed_at:'2026-08-01T00:00:00Z'});
    const table=url.pathname.split('/').pop();
    if(request.method()==='PATCH'&&table==='profiles'){
      const body=request.postDataJSON();remote.writes.push({body,query:Object.fromEntries(url.searchParams)});
      if(remote.hold)await remote.hold;
      if(remote.fail)return send({message:'Synthetic offline server'},503);
      const matched=remote.rows.filter(r=>['id','account_id','client_id','accent','accent_version'].every(k=>url.searchParams.get(k)==='eq.'+r[k]));
      matched.forEach(r=>Object.assign(r,body));return send(matched);
    }
    if(!['GET','HEAD'].includes(request.method()))return send({message:'Unexpected write'},500);
    if(table==='accounts')return send([{id:remote.account,owner_user_id:remote.auth,display_name:'Fixture'}]);
    if(table==='profiles')return send(remote.rows);
    return send([]);
  });
  await openApp(page);
  await expect.poll(()=>page.evaluate(()=>Boolean(BigGainsAppearance.current()))).toBe(true);
  await page.evaluate(()=>BigGainsAppearance.sync());
}
async function choose(page,name) {
  await page.locator('#openSettings').click();
  await page.locator(`#accentChoice label:has(input[value="${name}"])`).click();
}

test('profile-row PATCH is guarded and fresh-device recovery restores only selected profile accent',async({browser})=>{
  const remote=cloud(),one=await browser.newContext({serviceWorkers:'block'}),two=await browser.newContext({serviceWorkers:'block'});
  try{
    const p=await one.newPage();await install(p,remote);await choose(p,'violet');
    await expect.poll(()=>remote.rows[0].accent).toBe('violet');
    expect(remote.rows[1].accent).toBe('rose');
    expect(remote.writes[0].body).toEqual({accent:'violet',accent_version:1});
    expect(remote.writes[0].query).toMatchObject({id:'eq.'+remote.rows[0].id,account_id:'eq.'+account,client_id:'eq.jorge',accent:'eq.ember',accent_version:'eq.0'});
    const q=await two.newPage();await install(q,remote,{fresh:true});
    await expect(q.locator('html')).toHaveAttribute('data-accent','violet');
    await expect(q.locator('html')).toHaveAttribute('data-theme','performance-dark');
    await expect(q.locator('html')).toHaveAttribute('data-pet-enabled','true');
    await choose(q,'ember');await expect.poll(()=>remote.rows[0].accent).toBe('ember');
    await p.evaluate(()=>BigGainsAppearance.sync());await expect(p.locator('html')).toHaveAttribute('data-accent','ember');
    await expect(p.locator('html')).toHaveAttribute('data-appearance-version','1');
  }finally{await one.close();await two.close();}
});

test('failed sync persists through reload, then retries without touching theme or pet',async({page})=>{
  const remote=cloud();await install(page,remote);remote.fail=true;await choose(page,'ember');
  await expect(page.locator('#accentStatus')).toContainText('retry');
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-appearance-version','1');
  expect(remote.rows[0].accent_version).toBe(0);remote.fail=false;
  await page.evaluate(()=>BigGainsAppearance.sync());
  await expect.poll(()=>remote.rows[0].accent_version).toBe(1);
  expect(remote.rows[0]).toMatchObject({accent:'ember',theme:'performance-dark',pet_enabled:true});
});

test('a conflicting offline choice requires explicit resolution and use-cloud restores legacy rendering',async({page})=>{
  const remote=cloud();await install(page,remote);remote.fail=true;await choose(page,'violet');
  await expect(page.locator('#accentStatus')).toContainText('retry');
  remote.fail=false;remote.rows[0].accent='cobalt';remote.rows[0].accent_version=0;
  await page.evaluate(()=>BigGainsAppearance.sync());
  await expect(page.locator('#accentConflict')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-accent','violet');
  await page.locator('#accentUseCloud').click();
  await expect(page.locator('html')).toHaveAttribute('data-accent','cobalt');
  await expect(page.locator('html')).toHaveAttribute('data-appearance-version','0');
  expect(await page.evaluate(()=>document.documentElement.style.getPropertyValue('--accent'))).toBe('');
});

test('rapid selections retain the newest choice while a guarded write is in flight',async({page})=>{
  const remote=cloud();await install(page,remote);let release;remote.hold=new Promise(r=>release=r);
  await choose(page,'violet');await expect.poll(()=>remote.writes.length).toBe(1);
  await choose(page,'ember');remote.hold=null;release();
  await expect.poll(()=>remote.rows[0].accent).toBe('ember');
  await expect(page.locator('#accentStatus')).toHaveText('Color synced.');
  expect(remote.writes).toHaveLength(2);
});

test('invalid preference and changed profile mapping cannot write another profile',async({page})=>{
  const remote=cloud();await install(page,remote);
  const result=await page.evaluate(async({auth,account})=>{
    try{await BigGainsSupabase.updateProfileAccent({authUserId:auth,accountId:account,profileId:'wrong-profile',clientId:'jorge',expected:{accent:'ember',version:0},accent:'violet'});return false;}catch{return true;}
  },{auth,account});expect(result).toBe(true);expect(remote.writes).toEqual([]);
});

test('independent profiles default correctly and use distinct durable namespaces',async({browser})=>{
  const contexts=[];const keys=[];
  try{for(const [i,accent]of ['cobalt','merlot'].entries()){
    const context=await browser.newContext({serviceWorkers:'block'});contexts.push(context);const page=await context.newPage();const remote=cloud();
    remote.auth='82000000-0000-0000-0000-00000000000'+i;remote.account='83000000-0000-0000-0000-00000000000'+i;
    remote.rows=[{...row('84000000-0000-0000-0000-00000000000'+i,'independent-fixture-'+i,accent),account_id:remote.account,pet_enabled:false}];
    await install(page,remote,{independent:true});await expect(page.locator('html')).toHaveAttribute('data-accent',accent);
    await choose(page,'violet');await expect.poll(()=>remote.rows[0].accent).toBe('violet');
    keys.push(await page.evaluate(()=>BigGainsAppearance.storageKey));expect(remote.rows[0].pet_enabled).toBe(false);
  }expect(keys[0]).not.toBe(keys[1]);}finally{for(const context of contexts)await context.close();}
});
