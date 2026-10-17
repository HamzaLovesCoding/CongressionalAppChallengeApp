import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Viewport } from '@babylonjs/core/Maths/math.viewport';
import { Matrix } from '@babylonjs/core/Maths/math.vector';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3,Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { CreateLines } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import '@babylonjs/core/Rendering/edgesRenderer';
import config from './config.json';
import {clamp,ease,mix,type SceneFeedback,type SceneHandle,type SceneState} from './types';
export function createScene(container:HTMLElement):SceneHandle {
 container.innerHTML=`<div class="driver-view"><canvas aria-label="${config.intro}" role="img"></canvas><div class="scene-note" data-note></div><div class="mirror-strip" aria-label="Scan cues"><span data-mirror></span><span data-side></span></div><div class="dashboard"><span class="steering" aria-hidden="true">◯</span><span data-drive>Steady approach</span><span class="signal-indicator" data-signal>●</span></div><div class="conflict-overlay" hidden></div></div>`;
 const canvas=container.querySelector('canvas')!;
 const note=container.querySelector<HTMLElement>('[data-note]')!;
 const mirror=container.querySelector<HTMLElement>('[data-mirror]')!;
 const side=container.querySelector<HTMLElement>('[data-side]')!;
 const drive=container.querySelector<HTMLElement>('[data-drive]')!;
 const indicator=container.querySelector<HTMLElement>('[data-signal]')!;
 const conflict=container.querySelector<HTMLElement>('.conflict-overlay')!;
 const kind=config.id;
 const isMerge=kind==='freeway-entrance-merge',isTurn=kind==='right-turn-scan';
 if(isMerge)container.querySelector('.driver-view')!.insertAdjacentHTML('beforeend','<div class="mirror-frame"><span>Left mirror</span></div>');
 let engine:Engine|undefined,scene:Scene|undefined,disposed=false;
 let resize:ResizeObserver|undefined;let contextLost=false;
 function fallback(){container.dataset.renderer='fallback';canvas.hidden=true;note.textContent='Scene unavailable. '+config.intro;mirror.textContent='';side.textContent='';drive.textContent='Text practice';}
 try {
  if(!Engine.isSupported())throw new Error('WebGL unavailable');
  engine=new Engine(canvas,true,{preserveDrawingBuffer:true,stencil:false,antialias:true},true);
  engine.setHardwareScalingLevel(1/Math.min(1.5,devicePixelRatio));
  scene=new Scene(engine);scene.clearColor=new Color4(.84,.89,.92,1);
  const camera=new FreeCamera('driver',new Vector3(isMerge?5:1.8,1.75,0),scene);
  camera.minZ=.15;camera.maxZ=160;camera.fov=.87;camera.inputs.clear();
  new HemisphericLight('daylight',new Vector3(.2,1,.4),scene).intensity=1.05;
  const rearCamera=isMerge?new FreeCamera('left mirror',new Vector3(4,1.7,8),scene):undefined;
  if(rearCamera){rearCamera.minZ=.2;rearCamera.maxZ=100;rearCamera.fov=.6;rearCamera.inputs.clear();rearCamera.viewport=new Viewport(.03,.61,.30,.23);scene.activeCameras=[camera,rearCamera];}
  const material=(name:string,hex:string)=>{const m=new StandardMaterial(name,scene);m.diffuseColor=Color3.FromHexString(hex);m.specularColor=Color3.Black();return m;};
  const asphalt=material('asphalt','#60676A'),line=material('line','#F8F4EE'),grass=material('grass','#B7C9AD'),curb=material('curb','#DFD7C7'),glass=material('glass','#344C53'),blue=material('blue','#467888'),red=material('red','#B43D2E'),amber=material('amber','#D6A229'),leaf=material('leaf','#7F996B'),building=material('building','#E1DDD1');
  const box=(name:string,x:number,y:number,z:number,w:number,h:number,d:number,mat:StandardMaterial,parent?:TransformNode)=>{const b=CreateBox(name,{width:w,height:h,depth:d},scene);b.position.set(x,y,z);b.material=mat;if(parent)b.parent=parent;return b;};
  box('ground',0,-.18,48,160,.2,180,grass);
  box('road',isMerge?-1.75:0,-.04,45,isMerge?10.5:7.2,.12,180,asphalt);
  if(!isMerge){
   box('cross street',0,-.025,32,100,.13,11,asphalt);
   for(const x of [-4.6,4.6]){
    box('near sidewalk',x,.02,5,2,.2,41,curb);
    box('far sidewalk',x,.02,78,2,.2,80,curb);
   }
   for(const z of [25.8,38.2])for(const x of [-27,27])box('cross street sidewalk',x,.02,z,46.8,.2,1.3,curb);
   // Openings in the sidewalks leave the intersection navigable.
   box('intersection paving',0,.035,32,7.2,.1,14,asphalt);
   for(let z=-30;z<130;z+=9){if(z>21&&z<42)continue;for(const x of [-.12,.12])box('center line',x,.10,z,.08,.02,9,amber);}
   box('limit line',1.85,.105,25,3.3,.03,.45,line);
   for(let x=-3.2;x<3.6;x+=.85)box('crosswalk',x,.11,28,.45,.03,1.8,line);
   for(const z of [31.85,32.15]){box('cross center left',-30,.105,z,49,.02,.08,amber);box('cross center right',30,.105,z,49,.02,.08,amber);}
  }else{
   const ramp=new Mesh('entrance ramp',scene);const vertices=new VertexData();
   vertices.positions=[3.4,.02,-40,7,.02,-40,7,.02,30,3.4,.02,80];vertices.indices=[0,2,1,0,3,2];vertices.normals=[0,1,0,0,1,0,0,1,0,0,1,0];vertices.applyToMesh(ramp);ramp.material=asphalt;asphalt.backFaceCulling=false;
   for(let z=-35;z<125;z+=9){box('far lane dash',-3.5,.08,z,.10,.02,4,line);box('lane dash',0,.08,z,.10,.02,4,line);if(z<70)box('merge dash',3.5,.08,z,.12,.02,3,line);}
   box('left edge',-6.85,.08,45,.12,.02,180,line);
   const edge=CreateLines('ramp outer edge',{points:[new Vector3(6.9,.08,-40),new Vector3(6.9,.08,30),new Vector3(3.5,.08,80),new Vector3(3.5,.08,130)]},scene);edge.color=Color3.FromHexString('#F8F4EE');
   for(let z=25;z<80;z+=10)box('reflector',7.3-(z-25)*.065,.28,z,.15,.5,.15,amber);
  }
  for(let i=0;i<10;i++){
   const z=8+i*11;if(isMerge)continue;if(z>21&&z<43)continue;for(const x of [-13,13]){
    box('trunk',x,1,z,.3,2,.3,building);const crown=CreateSphere('tree',{diameter:3,segments:4},scene);crown.position.set(x,3,z);crown.material=leaf;
    if(i%2===0)box('building',x*1.8,2.7,z,7,5.4,7,building);
   }
  }
  if(isMerge){box('concrete median',-7.3,.5,50,.7,1,180,curb);box('outer guardrail',9,.65,50,.13,.25,180,trimPlaceholder());for(let z=-20;z<140;z+=7)box('guardrail post',9,.33,z,.15,.65,.15,glass);box('gantry left',-6.6,3.7,78,.3,7.4,.3,glass);box('gantry right',7.6,3.7,78,.3,7.4,.3,glass);box('gantry beam',.5,7.3,78,14.4,.3,.3,glass);box('freeway sign',-.8,6.6,78,5.8,1.7,.18,material('sign green','#32604A'));}
  function trimPlaceholder(){return curb;}
  const tire=material('rubber','#293238'),trim=material('trim','#D1D9D8');
  const vehicle=(name:string,mat:StandardMaterial)=>{
   const group=new TransformNode(name,scene);
   box(name+' chassis',0,.48,0,1.75,.55,4.15,mat,group);
   box(name+' cabin',0,.99,-.16,1.48,.58,2.05,glass,group);
   box(name+' roof',0,1.31,-.25,1.48,.08,1.48,mat,group);
   box(name+' hood',0,.76,1.5,1.68,.10,.9,mat,group);
   box(name+' rear bumper',0,.31,-2.09,1.55,.12,.08,trim,group);
   for(const x of [-.63,.63]){box('rear light',x,.59,-2.09,.30,.16,.06,red,group);box('headlight',x,.59,2.09,.30,.16,.06,line,group);}
   for(const x of [-.87,.87])for(const z of [-1.25,1.25]){const w=CreateCylinder('wheel',{diameter:.62,height:.2,tessellation:12},scene);w.rotation.z=Math.PI/2;w.position.set(x,.31,z);w.material=tire;w.parent=group;}
   return group;
  };
  const traffic=vehicle('blue freeway car',blue),trailing=vehicle('trailing car',building);
  traffic.position.set(isMerge?-.5:-12,.03,isMerge?14:34);trailing.position.set(isMerge?-.5:-24,.03,isMerge?-19:34);
  if(!isMerge){traffic.rotation.y=Math.PI/2;trailing.rotation.y=Math.PI/2;}
  const tube=(name:string,a:Vector3,b:Vector3,r:number,mat:StandardMaterial,parent:TransformNode)=>{
   const d=b.subtract(a);const mesh=CreateCylinder(name,{height:d.length(),diameter:r*2,tessellation:8},scene);
   mesh.position.copyFrom(a.add(b).scale(.5));mesh.material=mat;mesh.parent=parent;
   // Cylinders start along Y; rotate to the segment direction.
   mesh.rotation.z=-Math.atan2(d.x,d.y);mesh.rotation.x=Math.atan2(d.z,Math.hypot(d.x,d.y));return mesh;
  };
  const skin=material('skin','#B8896B');
  const person=new TransformNode('pedestrian',scene);
  box('pedestrian jacket',0,1.02,0,.43,.64,.29,red,person);
  tube('left arm',new Vector3(-.23,1.2,0),new Vector3(-.30,.66,.10),.065,skin,person);
  tube('right arm',new Vector3(.23,1.2,0),new Vector3(.30,.66,-.10),.065,skin,person);
  const leftLeg=box('left leg',-.12,.36,0,.15,.72,.18,glass,person),rightLeg=box('right leg',.12,.36,0,.15,.72,.18,glass,person);
  const head=CreateSphere('head',{diameter:.32,segments:10},scene);head.position.set(0,1.53,0);head.material=skin;head.parent=person;
  const cyclist=new TransformNode('bicyclist',scene);
  for(const z of [-.62,.62]){
   const wheel=CreateCylinder('bicycle tire',{diameter:.66,height:.045,tessellation:24},scene);wheel.rotation.z=Math.PI/2;wheel.position.set(0,.35,z);wheel.parent=cyclist;wheel.material=tire;
   const center=CreateCylinder('bicycle wheel center',{diameter:.53,height:.05,tessellation:16},scene);center.rotation.z=Math.PI/2;center.position.set(0,.35,z);center.parent=cyclist;center.material=trim;
  }
  const rear=new Vector3(0,.35,-.62),front=new Vector3(0,.35,.62),pedal=new Vector3(0,.35,0),seat=new Vector3(0,.85,-.22),bar=new Vector3(0,.91,.37);
  for(const [a,b] of [[rear,seat],[seat,pedal],[rear,pedal],[pedal,bar],[seat,bar],[bar,front]])tube('bicycle frame',a,b,.025,blue,cyclist);
  box('saddle',0,.88,-.22,.22,.05,.20,tire,cyclist);box('handlebar',0,.97,.40,.50,.035,.04,glass,cyclist);
  tube('rider torso',new Vector3(0,1.05,-.20),new Vector3(0,1.42,.08),.14,amber,cyclist);
  for(const x of [-.13,.13]){tube('rider thigh',new Vector3(x,1.02,-.2),new Vector3(x,.69,.14),.065,glass,cyclist);tube('rider shin',new Vector3(x,.69,.14),new Vector3(x,.37,-.04),.055,glass,cyclist);tube('rider arm',new Vector3(x,1.35,.1),new Vector3(x,.98,.4),.05,skin,cyclist);}
  const helmet=CreateSphere('helmet',{diameter:.33,segments:12},scene);helmet.position.set(0,1.59,.14);helmet.material=line;helmet.parent=cyclist;
  person.setEnabled(isTurn);cyclist.setEnabled(isTurn);
  let lamps:Array<{material:StandardMaterial}> = [];
  if(!isMerge){box('signal pole',4.7,2.6,30,.18,5.2,.18,glass);box('signal arm',2.6,5.1,30,4.4,.15,.15,glass);box('signal housing',1.8,4.25,29,.62,1.6,.38,glass);
   lamps=[0,1,2].map((i)=>{const mat=material('lamp '+i,['#C32F23','#F6B929','#329661'][i]);mat.emissiveColor=mat.diffuseColor;const lamp=CreateSphere('light '+i,{diameter:.35,segments:8},scene);lamp.position.set(1.8,4.75-i*.5,28.77);lamp.material=mat;return {material:mat};});
  }
  const lights=(color:number)=>lamps.forEach((l,i)=>{l.material.emissiveColor=i===color?l.material.diffuseColor:new Color3(.025,.025,.025);l.material.alpha=i===color?1:.3;});
  const skidMarks=[box('left skid',1.05,.115,24.8,.14,.02,3.4,glass),box('right skid',2.45,.115,24.8,.14,.02,3.4,glass)];skidMarks.forEach(m=>m.setEnabled(false));
  const ego=vehicle('your car',amber),rampFollower=vehicle('ramp follower',red),farTraffic=vehicle('far freeway car',blue);
  const wheels=scene.meshes.filter(m=>m.name==='bicycle tire'||m.name==='bicycle wheel center');
  const peds=[leftLeg,rightLeg];
  let lastState:SceneState={phase:'intro',time:0,worldTime:0,resolveTime:0,decisionWorld:0,reduced:false};
  let renderKey='';let lastFeedback:SceneFeedback={};let previousPosition:Vector3|undefined,previousWorld=0,previousSpeed=0;
  function update(s:SceneState):SceneFeedback {
   if(disposed)return {};
   if(contextLost)return s.phase==='resolving'?(s.success?{finished:s.resolveTime>=2000}:{impact:s.resolveTime>=1100?{x:50,y:55,label:'RISK'}:undefined}):{};
   lastState=s;const key=s.phase+Math.floor(s.worldTime/33)+String(s.success)+s.action;
   if(key===renderKey)return lastFeedback;renderKey=key;
   const resolving=s.phase==='resolving'||s.phase==='outcome';const base=resolving?s.decisionWorld:s.worldTime;const p=clamp(base/1800),extra=Math.max(0,base-1800),r=resolving?s.resolveTime:0;
   let x=isMerge?5.2:1.75,z=isMerge?24*p+extra*.012:isTurn?11+4*p+extra*.0018:3+9*p+extra*.005,yaw=0;
   const startZ=z;let impactPoint:Vector3|undefined;let label='BANG!',end=4000;
   const pan=resolving&&!s.success&&!s.reduced?ease(r/750):resolving&&!s.success?1:0;
   skidMarks.forEach(m=>m.setEnabled(!isMerge&&!isTurn&&resolving&&s.action==='late-brake'&&r>=900));
   ego.setEnabled(pan>.04);rampFollower.setEnabled(isMerge);farTraffic.setEnabled(isMerge);
   const frame=container.querySelector<HTMLElement>('.mirror-frame');if(frame)frame.hidden=pan>0;
   scene!.activeCameras=rearCamera&&pan===0?[camera,rearCamera]:[camera];
   if(isMerge){
    const front=20+24*p+extra*.013,rear=-26+24*p+extra*.012;
    traffic.position.set(1.75,0,front);trailing.position.set(1.75,0,rear);
    rampFollower.position.set(5.2,0,startZ-32);farTraffic.position.set(-1.75,0,front+20+s.resolveTime*.018);
    note.textContent='Entrance ramp · traffic on your left';indicator.textContent='←';drive.textContent=s.phase==='deciding'?'Slow motion':'Match traffic speed';
    if(resolving){
     if(s.success){z=startZ+r*.018;x=5.2-3.45*ease((r-600)/1600);traffic.position.z=front+r*.018;trailing.position.z=rear+r*.018;rampFollower.position.z=startZ-32+r*.018;drive.textContent=r<600?'Signal · mirrors · shoulder check':'Merge behind blue';end=3000;}
     else if(s.action==='stop-ramp'){
      const v=ease(r/1500);z=startZ+8*ease(r/850);rampFollower.position.z=mix(startZ-32,startZ+4,v);traffic.position.z=front+r*.018;trailing.position.z=rear+r*.018;drive.textContent='Stopped in the entrance lane';
      if(r>=1500)impactPoint=new Vector3(5.2,.6,z-2);
     }else{
      const v=ease(r/1500);traffic.position.z=front+18*v;trailing.position.z=rear+18*v;z=mix(startZ,front+18,v);x=mix(5.2,3.25,v);drive.textContent='Moving beside the blue car';if(r>=1500)impactPoint=new Vector3(2.5,.7,z);
     }
    }
   }else if(isTurn){
    const personX=-2+1.5*p+extra*.001,bikeZ=20+5*p+extra*.004;
    person.position.set(personX,0,28);person.rotation.y=Math.PI/2;cyclist.position.set(3.05,0,bikeZ);
    traffic.position.set(-18,0,29.5);trailing.position.set(-30,0,29.5);
    note.textContent='Green light · crossing occupied';indicator.textContent='→';drive.textContent=s.phase==='deciding'?'Slow motion':'Right turn intended';lights(2);
    if(resolving){
     if(s.success){person.position.x=mix(personX,5.0,clamp(r/1900));cyclist.position.z=bikeZ+26*clamp(r/2200);const v=clamp((r-2300)/2100);if(v<.4)z=mix(startZ,24,v/.4);else if(v<.8){yaw=(v-.4)/.4*Math.PI/2;x=7.25-5.5*Math.cos(yaw);z=24+5.5*Math.sin(yaw);}else{yaw=Math.PI/2;x=mix(7.25,13,(v-.8)/.2);z=29.5;}drive.textContent=r<2300?'Yield to both':'Both clear · turn right';if(r>2300)note.textContent='Person and bicyclist clear';end=4500;}
     else{
      const onlyPerson=s.action==='watch-cars-only',delay=onlyPerson?1300:0,at=onlyPerson?2400:1300,v=ease((r-delay)/(at-delay));
      person.position.x=mix(personX,onlyPerson?5.0:1.8,clamp(r/(onlyPerson?1200:1300)));cyclist.position.z=mix(bikeZ,29,clamp(r/at));
      z=mix(startZ,27.2,v);x=mix(1.75,2.5,v);yaw=.4*v;drive.textContent=onlyPerson?'Person clear · cyclist still beside you':'Turning across the crossing';
      if(r>=at)impactPoint=new Vector3(onlyPerson?3.05:1.8,.8,28);
     }
    }
   }else{
    const yellow=base>=1600;let color=yellow?1:2;
    traffic.position.set(-18,0,29.5);trailing.position.set(-31,0,29.5);
    note.textContent=yellow?'Yellow light · room to stop':'Green light ahead';drive.textContent=s.phase==='deciding'?'Slow motion':'Approaching the signal';indicator.textContent='●';
    if(resolving){
     if(s.success){z=mix(startZ,22.5,1-(1-clamp(r/1800))**2);if(r>2100)color=0;note.textContent=r>2100?'Red light · stopped before the line':'Braking smoothly';drive.textContent=r>=1800?'Stopped at the limit line':'Braking';end=2400;}
     else{const late=s.action==='late-brake',at=late?1900:1700,v=clamp(r/at);z=mix(startZ,late?26.4:28,late?(v<.55?v*1.25:.6875+.3125*(1-((1-v)/.45)**2)):ease(v));
      if(r>=450)color=0;traffic.position.x=mix(-18,1.75,ease((r-450)/(at-450)));drive.textContent=late?'Braking after using the gap':'Continuing into the intersection';note.textContent=color===0?'Red light · cross traffic moving':'Yellow light';
      if(r>=at){impactPoint=new Vector3(1.75,.6,late?28.4:29.5);if(late)label='SKID!';}
     }
    }lights(color);
   }
   ego.position.set(x,0,z);ego.rotation.y=yaw;
   if(isTurn&&person.position.x>3.5)person.position.z=28-2.2*ease((person.position.x-3.5)/1.5);
   const walking=isTurn&&(!resolving||r<(s.success?1900:s.action==='watch-cars-only'?1200:1300));container.dataset.walking=String(walking);const stride=walking&&!s.reduced?Math.sin(s.worldTime/135)*.55:0;
   leftLeg.rotation.x=stride;rightLeg.rotation.x=-stride;person.position.y=walking&&!s.reduced?Math.abs(Math.sin(s.worldTime/135))*.025:0;
   // Wheel axles remain aligned with the bicycle; translation carries the rolling motion.
   camera.position.set(x,1.65,z);let target=new Vector3(x+Math.sin(yaw)*28,.9,z+Math.cos(yaw)*28);
   if(pan>0){const destination=new Vector3(x-7,7.7,z-9);camera.position=Vector3.Lerp(camera.position,destination,pan);target=Vector3.Lerp(target,new Vector3(x,.5,z+1),pan);}
   camera.setTarget(target);
   if(rearCamera){rearCamera.position.set(x-.8,1.7,z);rearCamera.setTarget(new Vector3(trailing.position.x,1,trailing.position.z));}
   scene!.render();
   container.dataset.world=String(s.worldTime);container.dataset.actors=JSON.stringify({you:{x,z,yaw},other:{x:traffic.position.x,z:traffic.position.z},rider:{x:cyclist.position.x,z:cyclist.position.z},ped:{x:person.position.x,z:person.position.z,stride:leftLeg.rotation.x},follower:{x:rampFollower.position.x,z:rampFollower.position.z}});
   let impact:SceneFeedback['impact'];if(impactPoint){const screen=Vector3.Project(impactPoint,Matrix.Identity(),scene!.getTransformMatrix(),camera.viewport.toGlobal(engine!.getRenderWidth(),engine!.getRenderHeight()));impact={x:Math.max(22,Math.min(78,screen.x/engine!.getRenderWidth()*100)),y:Math.max(22,Math.min(78,screen.y/engine!.getRenderHeight()*100)),label};}
   const dt=s.worldTime-previousWorld;const position=new Vector3(x,0,z);let speed=dt>0&&previousPosition?clamp(Vector3.Distance(position,previousPosition)/dt/.025):previousSpeed;if(s.phase==='intro'||s.phase==='loading')speed=isMerge?.7:isTurn?.15:.45;previousPosition=position;previousWorld=s.worldTime;previousSpeed=speed;
   return lastFeedback={speed,impact,finished:resolving&&!!s.success&&r>=end};
  }
  const redraw=()=>{if(!disposed){engine!.resize();renderKey='';update(lastState);}};
  resize=new ResizeObserver(redraw);resize.observe(container);
  const lost=(event:Event)=>{event.preventDefault();contextLost=true;fallback();};canvas.addEventListener('webglcontextlost',lost);
  container.dataset.renderer='webgl';engine.resize();
  const ready=new Promise<void>(resolve=>scene!.executeWhenReady(()=>{if(!disposed){renderKey='';update(lastState);}resolve();}));
  return {update,ready,destroy(){if(disposed)return;disposed=true;resize?.disconnect();canvas.removeEventListener('webglcontextlost',lost);scene?.dispose();engine?.dispose();}};
 }catch{resize?.disconnect();scene?.dispose();engine?.dispose();fallback();return {update(s){if(s.phase!=='resolving')return {};return s.success?{finished:s.resolveTime>=2000}:s.resolveTime>=1100?{impact:{x:50,y:55,label:'RISK'}}:{};},destroy(){disposed=true;}};}
}
