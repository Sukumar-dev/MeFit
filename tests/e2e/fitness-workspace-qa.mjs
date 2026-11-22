import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
// Run against a local Vite build configured with the loopback Supabase fixture.
const frontend = 'http://127.0.0.1:55911'
const browser = await chromium.launch()
try {
 const page = await browser.newPage({ viewport:{width:360,height:844}, colorScheme:'light' })
 const user = { id:'00000000-0000-4000-8000-000000000001', email:'local@example.test', user_metadata:{} }
 const token = 'e30.'+Buffer.from(JSON.stringify({sub:user.id,aal:'aal2',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.sig'
 const session={access_token:token,refresh_token:'fixture',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user}
 await page.addInitScript(({session,user,token})=>{
  if(sessionStorage.getItem('redesign-signed-out')) return
  localStorage.setItem('sb-127-auth-token',JSON.stringify(session))
  if (!sessionStorage.getItem('mefit.session')) sessionStorage.setItem('mefit.session',JSON.stringify({authProvider:'supabase',accessToken:token,expiresAt:Date.now()+3600000,user:{id:user.id,email:user.email,displayName:'Local',roles:[],hasProfile:true}}))
 },{session,user,token})
 let workouts=[], logs=[], settings=null
 let profile={id:user.id,display_name:'Local',timezone:'UTC',days_available:3,minutes_per_workout:30,current_activity:'light',experience:'beginner'}
 const measurements=[{id:'new',measured_on:'2026-11-22',weight_kg:71},{id:'old',measured_on:'2026-11-19',weight_kg:72}]
 let counter=0
 let measurementWrites=0
 await page.route('http://127.0.0.1:55910/**',async route=>{
  const req=route.request(), url=new URL(req.url())
  const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,DELETE,OPTIONS,PATCH'}
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers})
  if(url.pathname.includes('/logout'))return route.fulfill({status:204,headers})
  let json=[]
  if(url.pathname.endsWith('/profiles')){
   if(req.method()==='POST'){profile={...profile,...req.postDataJSON()};return route.fulfill({status:201,headers})}
   json=profile
  }
  if(url.pathname.endsWith('/exercise_library'))json=[{id:'squat',slug:'squat',name:'Squat',body_area:'Legs & Glutes',movement_type:'Squat',level:'Beginner',equipment:['Bodyweight'],primary_muscles:['quadriceps'],secondary_muscles:[],instructions:['Bend knees'],image_paths:[],is_active:true,legacy_names:[]}]
  if(url.pathname.endsWith('/fitness_exercises'))json=[{name:'Squat'}]
  if(url.pathname.endsWith('/fitness_progress')){
   if(req.method()==='POST'){
    measurementWrites++
    await new Promise(resolve=>setTimeout(resolve,150))
    return route.fulfill({status:201,headers})
   }
   json=measurements
  }
  if(url.pathname.endsWith('/fitness_settings')){
   if(req.method()==='POST'){settings=req.postDataJSON();return route.fulfill({status:201,headers})}
   json=settings
  }
  if(url.pathname.endsWith('/weekly_workouts')){
   if(req.method()==='POST'){
    const input=req.postDataJSON()
    workouts.push(...[input].flat().map(value=>({id:String(++counter),completed:false,...value})))
    return route.fulfill({status:201,headers})
   }
   if(req.method()==='PATCH'){
    const id=url.searchParams.get('id').slice(3)
    workouts=workouts.map(value=>value.id===id?{...value,...req.postDataJSON()}:value)
    return route.fulfill({status:204,headers})
   }
   json=workouts
  }
  if(url.pathname.endsWith('/workout_logs')){
   if(req.method()==='POST'){logs=[{id:String(++counter),...req.postDataJSON()},...logs];return route.fulfill({status:201,headers})}
   json=logs
  }
  await route.fulfill({json,headers})
 })

 await page.goto(frontend + '/#planner')
 await page.getByRole('button',{name:'Next week',exact:true}).click()
 await page.waitForURL(url => url.searchParams.get('week') === '1')
 await page.reload()
 assert.equal(new URL(page.url()).searchParams.get('week'),'1')
 await page.getByRole('button',{name:'Previous week',exact:true}).click()
 await page.waitForURL(url => !url.searchParams.has('week'))
 console.log('Planner selection survives reload and Today resets it.')
 await page.goto(frontend+'/#progress')
 await page.getByLabel(/Body weight/).fill('25')
 await page.getByRole('button',{name:'Save measurement'}).evaluate(button=>{
   button.form.requestSubmit()
   button.form.requestSubmit()
 })
 await page.waitForResponse(response=>response.request().method()==='POST'&&response.url().includes('/fitness_progress'))
 assert.equal(measurementWrites,1)
 await page.goto(frontend+'/#settings')
 await Promise.all([
   page.waitForResponse(response=>response.request().method()==='POST' && response.url().includes('/fitness_settings')),
   (async () => { await page.getByLabel('Weight units').selectOption('lb'); await page.getByRole('button',{name:'Save settings'}).click() })(),
 ])
 await page.goto(frontend+'/#progress')
 const poundWeight=page.getByLabel('Body weight (lb)')
 assert.equal(Number(await poundWeight.getAttribute('min')),25*2.2046226218)
 assert.equal(Number(await poundWeight.getAttribute('max')),350*2.2046226218)
 console.log('Rapid submits produce one write and pound bounds match database limits.')
 await page.goto(frontend+'/catalog?q=squat')
 await page.getByText('1 exercise',{exact:true}).waitFor()
 await page.getByRole('button',{name:'Legs & Glutes',exact:true}).click()
 await page.waitForURL(url=>url.searchParams.get('area')==='Legs & Glutes')
 await page.getByRole('searchbox').press('ControlOrMeta+a')
 await page.getByRole('searchbox').pressSequentially('quadriceps')
 await page.waitForURL(url=>url.searchParams.get('q')==='quadriceps')
 await page.goBack()
 await new Promise(resolve=>setTimeout(resolve,350))
 assert.equal(new URL(page.url()).searchParams.get('q'),'squat')
 assert.equal(await page.getByRole('searchbox').inputValue(),'squat')
 console.log('Browser Back restores exercise search without rewriting the URL.')
 for (const [width,height] of [[390,844],[768,1024],[1280,800]]) {
   await page.setViewportSize({width,height})
   await page.goto(frontend)
   for (const title of ['Weekly planner','Workout log','Progress and measurements','Settings']) {
     await page.getByRole('heading',{name:title,exact:true}).waitFor()
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width)
   console.log('Passed single-page layout at '+width+'×'+height)
 }
 await page.goto(frontend + '/programs')
 await page.getByRole('heading',{name:'Beginner',exact:true}).waitFor()
 await page.getByRole('link',{name:/Getting started/i}).click()
 await page.getByRole('heading',{name:'Getting started',exact:true}).waitFor()
 await page.getByRole('link',{name:'Easy movement circuit'}).click()
 await page.getByRole('heading',{name:'Easy movement circuit'}).waitFor()
 await page.getByRole('heading',{name:'March in place'}).waitFor()
 assert.equal(await page.getByRole('img',{name:'March in place'}).getAttribute('src'),'/images/exercises/march-in-place.webp')
 await page.getByRole('link',{name:'Workouts',exact:true}).click()
 await page.getByRole('heading',{name:'Low impact',exact:true}).waitFor()
 await page.getByRole('link',{name:'Exercises',exact:true}).click()
 await page.getByRole('heading',{name:'Exercise library',exact:true}).waitFor()
 console.log('FE-05 through FE-07 program groups, workout details and exercise navigation passed with isolated fixture data.')
} finally { await browser.close() }
