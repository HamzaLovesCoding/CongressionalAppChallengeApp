import manifest from '../scenario-manifest.json';
import config from './config.json';
import styles from './styles.css?inline';
import poster from '../thumbnail.png';
import type {Phase,SceneState,SceneHandle,SceneFeedback} from './types';
export interface ScenarioResult {scenarioId:string;topicId:string;success:boolean;chosenAction:string;elapsedSeconds:number}
export interface ScenarioCallbacks {onComplete(result:ScenarioResult):void;onRetry():void;onExit():void;onContinue?(result:ScenarioResult):void}
export interface ScenarioHandle {destroy():void}
const active=new WeakMap<HTMLElement,ScenarioHandle>();
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const LEAD=1800,SLOW=.08;
export function startScenario(container:HTMLElement,callbacks:ScenarioCallbacks):ScenarioHandle {
 active.get(container)?.destroy();
 const mount=document.createElement('div');container.append(mount);const root=mount.attachShadow({mode:'open'});
 root.innerHTML=`<style>${styles}</style><section class="shell" aria-label="${esc(manifest.title)}"><header><div class="speedometer" role="img" aria-label="Illustrative vehicle speed: stopped"><svg viewBox="0 0 80 48" aria-hidden="true"><path d="M8 36a32 32 0 0 1 64 0"/><path class="speed-needle" d="M40 36H13"/><circle cx="40" cy="36" r="3"/></svg><span>Speed</span></div><h1>${esc(config.short)}</h1><button data-exit aria-label="Exit practice">×</button></header><div class="scene"><div class="viewport"><div class="visual"></div><div class="loading-cover"><img src="${poster}" alt="${esc(config.intro)}"><span role="status">Loading scene…</span></div><div class="impact" hidden aria-label="Impact"><svg viewBox="0 0 180 140" aria-hidden="true"><path d="M90 4l16 22 25-15 2 28 35-2-17 26 25 18-30 10 9 29-32-6-16 23-20-23-31 17 1-29-35 1 17-25L5 62l33-9-9-29 32 8Z"/><text x="90" y="79" text-anchor="middle">BANG!</text></svg></div></div></div><section class="controls" aria-label="Decision"><p>${esc(config.intro)}</p><button class="primary" disabled>Loading…</button></section><div class="actions"></div></section>`;
 const panel=root.querySelector<HTMLElement>('.controls')!,visual=root.querySelector<HTMLElement>('.visual')!,impact=root.querySelector<HTMLElement>('.impact')!,cover=root.querySelector<HTMLElement>('.loading-cover')!,shell=root.querySelector<HTMLElement>('.shell')!;
 let phase:Phase='loading',dead=false,raf=0,previous=0,stage=0,world=0,resolveTime=0,decisionWorld=0,attempt=0,onscreen=true;
 let loadingTimeout=0;
 const actions=root.querySelector<HTMLElement>('.actions')!,gauge=root.querySelector<HTMLElement>('.speedometer')!;
 function layout(){const primary=panel.querySelector<HTMLButtonElement>('.primary');actions.replaceChildren();if(primary)actions.append(primary);shell.dataset.action=String(!!primary);shell.style.setProperty('--panel-space',Math.ceil(panel.getBoundingClientRect().height+12)+'px');}
 const panelObserver=new ResizeObserver(()=>shell.style.setProperty('--panel-space',Math.ceil(panel.getBoundingClientRect().height+12)+'px'));panelObserver.observe(panel);
 function speed(value:number|undefined){if(value===undefined)return;const v=Math.max(0,Math.min(1,value));gauge.style.setProperty('--speed-angle',(v*180)+'deg');gauge.dataset.speed=v.toFixed(3);gauge.setAttribute('aria-label','Illustrative vehicle speed: '+(v<.02?'stopped':v<.45?'slow':v<.75?'steady':'fast'));}

 let chosen:ScenarioResult|undefined,scene:SceneHandle|undefined,sent=false,timedOut=false,selectedAction='',impactShown=false;
 const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
 const state=():SceneState=>({phase,time:stage,worldTime:world,resolveTime,decisionWorld,success:chosen?.success,action:selectedAction,reduced});
 function emit(name:string,detail:object){if(!dead)mount.dispatchEvent(new CustomEvent(name,{bubbles:true,composed:true,detail}));}
 function setPhase(p:Phase){phase=p;stage=0;mount.dataset.phase=p;shell.dataset.phase=p;}
 function focus(){root.querySelector<HTMLElement>('.controls button:not(:disabled),.controls h2,.actions button')?.focus({preventScroll:true});}
 function schedule(){cancelAnimationFrame(raf);previous=performance.now();if(!dead&&onscreen&&!document.hidden)raf=requestAnimationFrame(tick);}
 function ready(){if(dead)return;clearTimeout(loadingTimeout);setPhase('intro');world=0;resolveTime=0;speed(scene?.update(state())?.speed);cover.hidden=true;panel.innerHTML=`<p class="ready-prompt">${esc(config.intro)}</p><button class="primary" data-start>Start</button>`;panel.querySelector('[data-start]')!.addEventListener('click',begin);layout();}
 function begin(){if(dead)return;chosen=undefined;sent=false;timedOut=false;impactShown=false;selectedAction='';world=0;resolveTime=0;attempt=0;impact.hidden=true;shell.classList.remove('shake');setPhase('watching');panel.innerHTML=`<p class="prompt">${esc(config.short)}</p><div class="observe-progress"><span>Watch the road</span><i></i></div>`;speed(scene?.update(state())?.speed);layout();schedule();emit(manifest.integrationEvents.start,{scenarioId:manifest.id});}
 function decide(){setPhase('deciding');panel.innerHTML=`<div class="question"><p class="prompt">${esc(manifest.learnerPrompt)}</p><span class="clock" role="timer" aria-label="Seconds remaining" data-clock>${config.timer.toFixed(1)}</span></div><div class="track" aria-hidden="true"><i></i></div><div class="choices">${manifest.choices.map(c=>`<button data-choice="${c.id}">${esc(c.label)}</button>`).join('')}</div>`;panel.querySelectorAll<HTMLButtonElement>('[data-choice]').forEach(b=>b.addEventListener('click',()=>choose(b.dataset.choice!,false)));layout();focus();}
 function choose(id:string,timeout:boolean){if(dead||phase!=='deciding')return;const c=manifest.choices.find(c=>c.id===id)!;timedOut=timeout;selectedAction=id;decisionWorld=world;chosen={scenarioId:manifest.id,topicId:manifest.topicId,success:c.isSafe&&!timeout,chosenAction:timeout?'timeout':id,elapsedSeconds:Math.round(attempt)/1000};resolveTime=0;setPhase('resolving');panel.innerHTML=`<p class="prompt">${timeout?'Time’s up — watch what happens.':esc(c.label)}</p><div class="chosen" data-selected="${id}">${chosen.success?'✓ Action selected':'Action selected'}</div>`;layout();schedule();}
 function showImpact(frame:SceneFeedback){if(!frame.impact)return;const first=!impactShown;impactShown=true;const p=frame.impact;let x=p.x,y=p.y;if(visual.dataset.renderer==='svg'){const b=visual.getBoundingClientRect(),scale=Math.min(b.width/360,b.height/500);x=((b.width-360*scale)/2+p.x/100*360*scale)/b.width*100;y=((b.height-500*scale)/2+p.y/100*500*scale)/b.height*100;}impact.style.left=x+'%';impact.style.top=y+'%';impact.querySelector('text')!.textContent=p.label;impact.hidden=false;if(first&&!reduced)shell.classList.add('shake');}
 function finish(){if(!chosen||dead)return;setPhase('outcome');const feedback=chosen.success?config.safeFeedback:(config.feedback as Record<string,string>)[selectedAction];panel.innerHTML=`<div role="status" class="result ${chosen.success?'safe':'unsafe'}"><h2 tabindex="-1">${chosen.success?'Safe choice':timedOut?'Time’s up':'Try a safer choice'}</h2><p>${esc(feedback)}</p></div><button class="primary" ${chosen.success?'data-continue':'data-retry'}>${chosen.success?'Continue':'Retry'}</button>`;panel.querySelector('[data-retry]')?.addEventListener('click',()=>{begin();callbacks.onRetry();emit(manifest.integrationEvents.retry,{scenarioId:manifest.id});});panel.querySelector('[data-continue]')?.addEventListener('click',advance);layout();if(chosen.success&&config.id!=='blind-spot-motorcycle'&&config.id!=='freeway-entrance-merge')speed(0);focus();if(!sent){sent=true;callbacks.onComplete({...chosen});emit(manifest.integrationEvents.complete,{...chosen});}}
 const visualObserver=new ResizeObserver(()=>{if(dead)return;const frame=scene?.update(state());if(frame?.impact)showImpact(frame);});visualObserver.observe(visual);
 function advance(){if(dead||phase!=='outcome'||!chosen?.success)return;setPhase('done');const result={...chosen};root.replaceChildren();callbacks.onContinue?.(result);emit('scenario_continue',result);handle.destroy();}
 function exit(){if(dead||phase==='exited'||phase==='done')return;setPhase('exited');cancelAnimationFrame(raf);root.replaceChildren();callbacks.onExit();emit(manifest.integrationEvents.exit,{scenarioId:manifest.id,topicId:manifest.topicId});handle.destroy();}
 function tick(now:number){if(dead)return;let delta=Math.max(0,now-previous);previous=now;if(document.hidden||!onscreen)return;
  // Carry real elapsed time across the lead-in boundary instead of losing frame overflow.
  if(phase==='watching'){const lead=Math.min(delta,LEAD-stage);stage+=lead;world+=lead;attempt+=lead;delta-=lead;const bar=panel.querySelector<HTMLElement>('.observe-progress i');if(bar)bar.style.transform=`scaleX(${stage/LEAD})`;if(stage>=LEAD)decide();}
  if(phase==='deciding'){const available=config.timer*1000-stage;const dt=Math.min(delta,available);stage+=dt;world+=dt*SLOW;attempt+=dt;const left=Math.max(0,config.timer-stage/1000);panel.querySelector('[data-clock]')!.textContent=left.toFixed(1);panel.querySelector<HTMLElement>('.track i')!.style.transform=`scaleX(${left/config.timer})`;if(left===0)choose(config.defaultAction,true);}
  else if(phase==='resolving'){resolveTime+=delta;world=decisionWorld+resolveTime;stage+=delta;}
  const frame=scene?.update(state());if(frame){showImpact(frame);speed(frame.impact?0:frame.speed);}
  if(phase==='resolving'&&(frame?.impact||frame?.finished||resolveTime>=5200))finish();
  if(!dead&&['watching','deciding','resolving'].includes(phase))raf=requestAnimationFrame(tick);
 }
 const visibility=()=>{cancelAnimationFrame(raf);if(!document.hidden&&onscreen&&['watching','deciding','resolving'].includes(phase))schedule();};
 document.addEventListener('visibilitychange',visibility);const observer=typeof IntersectionObserver==='undefined'?undefined:new IntersectionObserver(es=>{onscreen=es[0]?.isIntersecting??true;visibility();});observer?.observe(mount);
 root.querySelector('[data-exit]')!.addEventListener('click',exit);
 const handle:ScenarioHandle={destroy(){if(dead)return;dead=true;clearTimeout(loadingTimeout);cancelAnimationFrame(raf);observer?.disconnect();panelObserver.disconnect();visualObserver.disconnect();document.removeEventListener('visibilitychange',visibility);scene?.destroy();mount.remove();if(active.get(container)===handle)active.delete(container);}};active.set(container,handle);setPhase('loading');layout();
 function fallback(){if(dead||phase!=='loading')return;scene?.destroy();visual.innerHTML=`<div class="fallback"><img src="${poster}" alt="${esc(config.intro)}"><p>Scene unavailable. ${esc(config.intro)}</p></div>`;visual.dataset.renderer='fallback';scene={update(s){return s.phase==='resolving'?s.success?{finished:s.resolveTime>=800}:{impact:{x:50,y:50,label:'RISK'}}:undefined},destroy(){}};ready();}
 loadingTimeout=window.setTimeout(fallback,8000);
 import('./scene').then(async module=>{if(dead||phase!=='loading')return;scene=module.createScene(visual);scene.update(state());await scene.ready;if(dead||phase!=='loading')return;ready();}).catch(fallback);
 return handle;
}
export {manifest};
