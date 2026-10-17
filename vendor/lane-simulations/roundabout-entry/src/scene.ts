import config from './config.json';
import {clamp,ease,mix,type SceneState,type SceneHandle,type SceneFeedback} from './types';
type Pose={x:number;y:number;a?:number};
const car=(id:string,tone='blue')=>`<g data-actor="${id}"><rect x="-16" y="-27" width="32" height="54" rx="7" fill="var(--color-${tone==='amber'?'car':tone==='gray'?'gray-car':'blue'})" stroke="var(--color-window)" stroke-width="1.4"/><path d="M-12-15H12L13-4H-13Z M-12 17H12L10 23H-10Z" fill="var(--color-window)"/><path d="M-12-23h7m10 0h7" stroke="var(--color-white)" stroke-width="3"/><path d="M-12 24h6m12 0h6" stroke="var(--color-danger)" stroke-width="3"/>${id==='you'?'<text y="11" text-anchor="middle" font-size="9" font-weight="700" fill="var(--color-ink)">YOU</text>':''}</g>`;
const human=`<g data-actor="ped"><path data-limbs d="M-5 4l-6 13M5 4l8 11M-4 18l-6 16M4 18l6 16" fill="none" stroke="var(--color-window)" stroke-width="5" stroke-linecap="round"/><rect x="-7" y="0" width="14" height="20" rx="4" fill="var(--color-danger)"/><circle cy="-7" r="7" fill="var(--color-car-light)" stroke="var(--color-window)" stroke-width="1.2"/></g>`;
const motor=`<g data-actor="rider"><rect x="-4" y="-23" width="8" height="46" rx="4" fill="var(--color-window)"/><path d="M-13-12H13" stroke="var(--color-window)" stroke-width="4"/><ellipse rx="9" ry="14" fill="var(--color-blue)"/><circle cy="0" r="7" fill="var(--color-white)"/></g>`;
const fire=`<g data-actor="fire"><rect x="-18" y="-36" width="36" height="72" rx="5" fill="var(--color-danger)" stroke="var(--color-window)"/><rect x="-14" y="-27" width="28" height="12" fill="var(--color-window)"/><rect x="-10" y="-5" width="20" height="35" fill="var(--color-white)"/><path d="M-8 0H8M-8 8H8M-8 16H8M-8 24H8" stroke="var(--color-secondary)" stroke-width="3"/><rect data-beacon x="-18" y="-12" width="36" height="5" fill="var(--color-car-light)"/></g>`;
const zebra=(x:number,y:number,rot=0)=>`<g transform="translate(${x} ${y}) rotate(${rot})" fill="var(--color-white)">${Array.from({length:6},(_,i)=>`<rect x="${i*16}" width="9" height="15"/>`).join('')}</g>`;
const stop=(x:number,y:number)=>`<g transform="translate(${x} ${y})"><path d="M-5-12h10l7 7v10l-7 7h-10l-7-7V-5Z" fill="var(--color-danger)" stroke="var(--color-white)" stroke-width="1.5"/><text y="3" text-anchor="middle" font-size="6.5" font-weight="700" fill="var(--color-white)">STOP</text></g>`;
const intersection=(shoulder=false)=>`<rect width="360" height="500" fill="var(--color-grass)"/><path d="M118 0H242V168H360V312H242V500H118V312H0V168H118Z" fill="var(--color-border)"/><path d="M130 0H230V180H360V300H230V500H130V300H0V180H130Z" fill="var(--color-road)"/>${shoulder?'<path d="M96 0H130V165H96ZM230 0H264V165H230ZM96 315H130V500H96ZM230 315H264V500H230Z" fill="var(--color-road)"/><path d="M99 0V165M261 0V165M99 315V500M261 315V500" stroke="var(--color-white)" stroke-width="2"/>':''}<path d="M177 0V147M183 0V147M177 337V500M183 337V500M0 237H93M0 243H93M269 237H360M269 243H360" stroke="var(--color-marking)" stroke-width="2"/>${zebra(134,155)}${zebra(134,314)}${zebra(121,194,90)}${zebra(254,194,90)}<path d="M185 336H226M134 147H174M262 185V229M97 251V296" stroke="var(--color-white)" stroke-width="3"/>`;
const lanes=()=>`<defs><pattern id="dashes" width="110" height="52" patternUnits="userSpaceOnUse"><path d="M0 0V27" stroke="var(--color-white)" stroke-width="4"/></pattern></defs><rect width="360" height="500" fill="var(--color-grass)"/><rect x="106" width="148" height="500" fill="var(--color-border)"/><rect x="115" width="130" height="500" fill="var(--color-road)"/><path d="M119 0V500M241 0V500" stroke="var(--color-white)" stroke-width="2"/><path d="M180 0V500" data-dashes stroke="var(--color-white)" stroke-width="3" stroke-dasharray="28 24"/>`;
export function createScene(container:HTMLElement):SceneHandle {
 const id=config.id;let markup='';
 if(id==='four-way-stop')markup=intersection()+stop(249,343)+stop(275,164)+stop(112,141)+stop(85,314)+car('other')+car('third','gray')+car('you','amber');
 if(id==='unprotected-left-turn')markup=intersection()+`<rect x="96" y="300" width="34" height="65" fill="var(--color-border)"/><path d="M204 337v-26h-17m0 0 7-7m-7 7 7 7" fill="none" stroke="var(--color-car-light)" stroke-width="4"/>`+car('other')+human+car('you','amber');
 if(id==='roundabout-entry')markup=`<rect width="360" height="500" fill="var(--color-grass)"/><path d="M130 0H230V170H360V270H230V500H130V270H0V170H130Z" fill="var(--color-road)"/><circle cx="180" cy="220" r="119" fill="var(--color-border)"/><circle cx="180" cy="220" r="113" fill="var(--color-road)"/><circle cx="180" cy="220" r="58" fill="var(--color-grass)"/><path d="M177 360V500M183 360V500M177 0V80M183 0V80M0 217H48M0 223H48M312 217H360M312 223H360" stroke="var(--color-marking)" stroke-width="2"/><path d="M190 359l7 10 7-10m8 0 7 10 7-10" fill="var(--color-white)"/>`+car('other')+car('you','amber');
 if(id==='lane-ends-merge')markup=lanes()+`<path d="M180 0H246V220L180 72Z" fill="var(--color-grass)"/><path d="M183 0V70L242 220" stroke="var(--color-white)" stroke-width="3" fill="none"/><path d="M106 0V500M110 0V500" stroke="var(--color-white)" stroke-width="2"/><rect x="83" width="8" height="500" fill="var(--color-secondary)"/><g transform="translate(290 110)"><rect x="-32" y="-26" width="64" height="52" rx="4" fill="var(--color-car-light)"/><path d="M-14 15V-15m28 30V5L0-12m-6 6 6-6 6 6" stroke="var(--color-ink)" stroke-width="4" fill="none"/></g>`+car('other')+car('you','amber');
 if(id==='blind-spot-motorcycle')markup=lanes()+`<path data-roadside d="M101 -100V600M259 -100V600" stroke="var(--color-secondary)" stroke-width="5" stroke-dasharray="7 93"/><path d="M160 294L238 307V378L160 348Z" fill="var(--color-car-light)" opacity=".5"/><rect x="263" y="110" width="72" height="64" rx="8" fill="var(--color-blue-light)" stroke="var(--color-window)" stroke-width="3"/><path data-mirror-road d="M298 115V170" stroke="var(--color-white)" stroke-width="2" stroke-dasharray="12 10"/><text x="299" y="101" text-anchor="middle" font-size="10">Right mirror</text>`+motor+car('you','amber');
 if(id==='emergency-vehicle-yield')markup=intersection(true)+`<g fill="var(--color-window)"><rect x="270" y="132" width="11" height="31" rx="3"/><rect x="78" y="314" width="11" height="31" rx="3"/></g><circle cx="275.5" cy="155" r="3" fill="var(--color-safe)"/><circle cx="83.5" cy="320" r="3" fill="var(--color-danger)"/>`+car('cross-east','gray')+car('cross-west','gray')+car('opposite','gray')+fire+car('you','amber');
 if(id==='railroad-clear-exit')markup=lanes()+`<rect y="211" width="360" height="58" fill="var(--color-border)"/>${Array.from({length:14},(_,i)=>`<path d="M${i*28} 207V273" stroke="var(--color-secondary)" stroke-width="5"/>`).join('')}<path d="M0 218H360M0 262H360" stroke="var(--color-window)" stroke-width="4"/><path d="M187 350H239" stroke="var(--color-white)" stroke-width="3"/><circle data-rail-light cx="259" cy="300" r="6" fill="var(--color-danger)"/><circle data-rail-light cx="277" cy="300" r="6" fill="var(--color-danger)"/><g data-gate><path d="M0 0H-60" stroke="var(--color-white)" stroke-width="6"/><path d="M0 0H-60" stroke="var(--color-danger)" stroke-width="6" stroke-dasharray="10 10"/></g><g data-actor="train"><rect x="-82" y="-20" width="164" height="40" rx="6" fill="var(--color-blue)" stroke="var(--color-window)" stroke-width="2"/><path d="M-65-14V14M-28-14V14M9-14V14M46-14V14" stroke="var(--color-blue-light)" stroke-width="5"/></g>`+car('queue','gray')+car('ahead','gray')+car('you','amber');
 const straight=id==='blind-spot-motorcycle'||id==='lane-ends-merge'||id==='railroad-clear-exit',shoulder=id==='emergency-vehicle-yield';
 const edgeLeft=straight?115:shoulder?96:130,edgeRight=straight?245:shoulder?264:230;
 const extension=[[-1000,1000],[500,1000]].map(([y,h])=>`<rect x="${straight?106:118}" y="${y}" width="${straight?148:124}" height="${h}" fill="var(--color-border)"/><rect x="${edgeLeft}" y="${y}" width="${edgeRight-edgeLeft}" height="${h}" fill="var(--color-road)"/>${straight||shoulder?`<path d="M${edgeLeft+4} ${y}v${h}M${edgeRight-4} ${y}v${h}" stroke="var(--color-white)" stroke-width="2"/>`:''}${!straight?`<path d="M177 ${y}v${h}M183 ${y}v${h}" stroke="var(--color-marking)" stroke-width="2"/>`:''}`).join('');
 container.innerHTML=`<svg viewBox="0 0 360 500" role="img" aria-label="${config.intro}">${extension}${markup}</svg>`;container.dataset.renderer='svg';
 const nodes=Object.fromEntries(Array.from(container.querySelectorAll<SVGGElement>('[data-actor]')).map(n=>[n.dataset.actor!,n]));
 let previousPose:Pose|undefined,previousWorld=0,previousSpeed=0;
 function update(s:SceneState):SceneFeedback {
  const resolving=s.phase==='resolving'||s.phase==='outcome';const base=resolving?s.decisionWorld:s.worldTime;const w=base/1000,p=clamp(base/1800),q=Math.max(0,w-1.8);const r=resolving?s.resolveTime:0;
  const a:Record<string,Pose>={};const put=(id:string,x:number,y:number,angle=0)=>a[id]={x,y,a:angle};let hit:SceneFeedback['impact'];let duration=3600;const contact=(x:number,y:number,at=1100,label='BANG!')=>{if(r>=at)hit={x:x/360*100,y:y/500*100,label}};
  if(id==='four-way-stop'){
   put('you',205,mix(430,367,ease(p)));put('other',mix(325,292,ease(p)),210,-90);put('third',155,30+40*p+Math.min(45,q*40),180);
   if(resolving){put('third',155,mix(70+q*40,118,clamp(r/900)),180);
    if(s.success){put('other',292-247*clamp(r/1700),210,-90);put('you',205,367-322*ease((r-1400)/1900));if(r>3100)put('third',155,118+150*ease((r-3100)/1300),180);duration=4400;}
    else{const v=ease(r/1100);put('you',205,mix(367,233,v));put('other',mix(292,224,v),210,-90);contact(213,219);}
   }
  }else if(id==='unprotected-left-turn'){
   put('you',205,367);const by=42+68*p+q*35,py=205+35*p+q*12;put('other',155,by,180);put('ped',110,py);
   if(resolving){
    const delayed=s.action==='watch-pedestrian',at=delayed?1900:1200;
    if(s.success){put('other',155,mix(by,455,clamp(r/2100)),180);put('ped',110,mix(py,321,clamp(r/1500)));const v=clamp((r-1900)/1900);if(v<.35)put('you',205,367-122*v/.35);else if(v<.7){const angle=(v-.35)/.35*Math.PI/2;put('you',170+35*Math.cos(angle),245-35*Math.sin(angle),-angle*180/Math.PI);}else put('you',170-128*(v-.7)/.3,210,-90);duration=3900;}
    else{const v=ease((r-(delayed?900:0))/(at-(delayed?900:0)));put('you',mix(205,177,v),mix(367,235,v),-55*v);put('other',155,mix(by,216,ease(r/at)),180);put('ped',110,mix(py,delayed?321:275,clamp(r/1000)));contact(166,225,at);}
   }
  }else if(id==='roundabout-entry'){
   const start=200-45*p-q*25;const circle=(id:string,angle:number)=>{const rad=angle*Math.PI/180;put(id,180+86*Math.cos(rad),220+86*Math.sin(rad),angle)};
   circle('other',start);put('you',205,mix(440,405,ease(p)));
   if(resolving){if(s.success){circle('other',start-r*.065);const v=clamp((r-1500)/1100);if(r<2600)put('you',mix(205,223,v),mix(405,294.48,v),60*v);else circle('you',60-(r-2600)*.065);duration=4300;}
    else{circle('other',mix(start,70,ease(r/1100)));put('you',mix(205,222,ease(r/1100)),mix(405,309,ease(r/1100)),60*ease(r/1100));contact(215,305);}}
  }else if(id==='lane-ends-merge'){
   const by=340-65*p-q*35,uy=mix(450,395,p)-q*35;put('you',215,uy);put('other',145,by);
   if(resolving){if(s.success){const v=ease((r-650)/1800);put('you',215-70*v,uy-r*.07,-15*Math.sin(v*Math.PI));put('other',145,mix(by,50,clamp(r/3200)));duration=3200;}
    else if(s.action==='cross-barrier'){const v=ease(r/1200);put('you',mix(215,102,v),mix(uy,290,v),-35*v);put('other',145,by-r*.035);contact(95,289,1200);}
    else{const v=ease(r/1200);put('you',mix(215,168,v),mix(uy,195,v),-24*v);put('other',145,mix(by,184,v));contact(156,188,1200);}}
  }else if(id==='blind-spot-motorcycle'){
   const by=445-105*ease(p)-10*Math.sin(q/.48*Math.PI*2);put('you',145,310);put('rider',215,by);
   const offset=-(s.worldTime*.10)%52;container.querySelector('[data-roadside]')!.setAttribute('stroke-dashoffset',String(-(s.worldTime*.10)%100));container.querySelector('[data-dashes]')!.setAttribute('stroke-dashoffset',String(offset));container.querySelector('[data-mirror-road]')!.setAttribute('stroke-dashoffset',String(offset*.4));
   if(resolving){if(s.success){put('rider',215,mix(by,80,clamp(r/2700)));duration=2700;}else{const at=s.action==='drift-right'?1500:900,v=ease(r/at);put('you',145+52*v,310,-12*Math.sin(v*Math.PI));put('rider',215,mix(by,315,v));contact(207,312,at);}}
  }else if(id==='emergency-vehicle-yield'){
   put('cross-east',296,210,-90);put('cross-west',65,270,90);put('opposite',112,87,180);const uy=mix(340,255,ease(p))-q*25;put('you',205,uy);const fy=455-55*p-q*60;put('fire',205,fy);
   if(resolving){if(s.success){const forward=ease(r/1700),pull=ease((r-1250)/900);put('you',205+42*pull,mix(uy,63,forward),22*Math.sin(pull*Math.PI));put('fire',205,mix(fy,44,ease((r-850)/2500)));duration=3450;}
    else if(s.action==='stop-intersection'){put('fire',205,mix(fy,uy+60,ease(r/1000)));contact(205,uy+29,1000);}
    else{put('you',205,mix(uy,104,ease(r/1500)));put('fire',205,mix(fy,164,ease(r/1500)));contact(205,134,1500);}}
   container.querySelector('[data-beacon]')!.setAttribute('fill',s.reduced||Math.floor(s.worldTime/350)%2===0?'var(--color-car-light)':'var(--color-white)');
  }else{
   put('queue',215,178);put('ahead',215,108);put('you',215,mix(440,394,p));put('train',88+q*15,240);
   let gate=90-q*8;
   if(resolving){if(s.success){gate=mix(gate,0,ease(r/500));put('train',mix(88+q*15,275,clamp(r/3000)),240);duration=3200;}
    else{const at=1500,v=ease(r/at);put('you',215,mix(394,244,v));put('train',mix(88+q*15,150,v),240);gate=r<1100?gate:mix(gate,0,(r-1100)/400);contact(213,242,at);}}
   container.querySelector('[data-gate]')!.setAttribute('transform',`translate(247 320) rotate(${gate})`);
   container.querySelectorAll('[data-rail-light]').forEach((n,i)=>n.setAttribute('opacity',s.reduced||Math.floor(s.worldTime/400)%2===i?'1':'.35'));
  }
  for(const [id,v] of Object.entries(a)){nodes[id]?.setAttribute('transform',`translate(${v.x} ${v.y}) rotate(${v.a||0})`);}
  if(nodes.ped){const walking=!resolving||r<(s.success?1500:1000);const step=s.reduced||!walking?0:Math.sin(s.worldTime/140)*4;nodes.ped.dataset.walking=String(walking);nodes.ped.querySelector('[data-limbs]')!.setAttribute('d',`M-5 4l-6 ${13+step}M5 4l8 ${11-step}M-4 18l-6 ${16-step}M4 18l6 ${16+step}`);}
  const dt=s.worldTime-previousWorld;let speed=dt>0&&previousPose?clamp(Math.hypot(a.you.x-previousPose.x,a.you.y-previousPose.y)/dt/.13):previousSpeed;if(id==='blind-spot-motorcycle')speed=.62;if(s.phase==='intro'||s.phase==='loading')speed=id==='blind-spot-motorcycle'?.62:0;previousPose=a.you;previousWorld=s.worldTime;previousSpeed=speed;
  container.dataset.actors=JSON.stringify(a);container.dataset.world=String(s.worldTime);return {speed,impact:hit,finished:resolving&&!!s.success&&r>=duration};
 }
 return {update,destroy(){}};
}
