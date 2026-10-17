// Deterministic samples of actual 3D renderers, including late decisions and branch midpoints.
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const out=`${process.env.AUDIT_DIR??'artifacts/simulation-audit'}/3d`;await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
await page.goto(process.env.BASE??'http://127.0.0.1:5173/');
const report=[];
for(const id of ['yellow-light-stop','freeway-entrance-merge','right-turn-scan']){
  const manifest=JSON.parse(await readFile(new URL(`../vendor/lane-simulations/${id}/scenario-manifest.json`,import.meta.url),'utf8'));
  const config=JSON.parse(await readFile(new URL(`../vendor/lane-simulations/${id}/src/config.json`,import.meta.url),'utf8'));
  await page.evaluate(async id=>{
    document.body.innerHTML='<div id="sample" style="position:fixed;inset:0;background:#d6deca"><div class="visual" style="width:390px;height:600px;margin-top:52px"></div></div>';
    const style=document.createElement('style');style.textContent='.driver-view,canvas{width:100%;height:100%;display:block}.driver-view{position:relative}.scene-note,.dashboard{position:absolute;left:0;right:0;background:#fff;padding:5px}.scene-note{top:0}.dashboard{bottom:0}.mirror-strip,.conflict-overlay{display:none}.mirror-frame{position:absolute;left:3%;top:16%;width:30%;height:23%;border:3px solid #344C53}';document.head.append(style);
    const module=await import(`/vendor/lane-simulations/${id}/src/scene.ts`);window.sampleScene=module.createScene(document.querySelector('.visual'));await window.sampleScene.ready;
  },id);
  const rows=[];
  for(const decisionWorld of [1800,1800+(config.timer*1000-100)*.08])for(const choice of manifest.choices){
    const row=await page.evaluate(({decisionWorld,choice,id})=>{
      const div=document.querySelector('.visual'),handle=window.sampleScene;
      const state={phase:'deciding',worldTime:decisionWorld,decisionWorld,time:0,resolveTime:0,reduced:false};
      handle.update(state);const before=JSON.parse(div.dataset.actors);
      handle.update({...state,phase:'resolving',success:choice.isSafe,action:choice.id});const after=JSON.parse(div.dataset.actors);
      const rectangle=(p,w,d,yaw=0)=>[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([x,z])=>({x:p.x+x*Math.cos(yaw)+z*Math.sin(yaw),z:p.z-x*Math.sin(yaw)+z*Math.cos(yaw)}));
      const overlap=(a,b)=>{for(const p of [a,b])for(let i=0;i<4;i++){const q=p[(i+1)%4],n={x:-(q.z-p[i].z),z:q.x-p[i].x};const pa=a.map(v=>v.x*n.x+v.z*n.z),pb=b.map(v=>v.x*n.x+v.z*n.z);if(Math.max(...pa)<=Math.min(...pb)||Math.max(...pb)<=Math.min(...pa))return false;}return true;};
      const row={action:choice.id,safe:choice.isSafe,decisionWorld,continuity:Math.hypot(after.you.x-before.you.x,after.you.z-before.you.z),collisions:[],samples:0};
      for(let r=0;r<=5200;r+=50){
        const feedback=handle.update({...state,phase:'resolving',worldTime:decisionWorld+r,resolveTime:r,success:choice.isSafe,action:choice.id}),a=JSON.parse(div.dataset.actors);row.samples++;
        if(Object.values(a).some(p=>Object.values(p).some(v=>!Number.isFinite(v))))throw new Error('Non-finite actor transform');
        const you=rectangle(a.you,1.75,4.3,a.you.yaw),others=[['other',1.75,4.3,id==='freeway-entrance-merge'?0:Math.PI/2]];
        if(id==='freeway-entrance-merge')others.push(['follower',1.75,4.3,0]);
        if(id==='right-turn-scan')others.push(['ped',.6,.4,Math.PI/2],['rider',.55,2,0]);
        const contacts=others.filter(([key,w,d,yaw])=>overlap(you,rectangle(a[key],w,d,yaw))).map(x=>x[0]);
        if(choice.isSafe&&contacts.length)row.collisions.push({r,contacts,actors:a});
        if(feedback?.impact||feedback?.finished){row.end=r;row.feedback=feedback;break;}
      }
      return row;
    },{decisionWorld,choice,id});
    rows.push(row);
    for(const [label,r] of [['selected',0],['midpoint',Math.min(1000,row.end/2)],['end',row.end]]){
      await page.evaluate(({r,decisionWorld,choice})=>window.sampleScene.update({phase:'resolving',time:r,worldTime:decisionWorld+r,decisionWorld,resolveTime:r,reduced:false,action:choice.id,success:choice.isSafe}),{r,decisionWorld,choice});
      await page.screenshot({path:`${out}/${id}-${decisionWorld===1800?'early':'late'}-${choice.id}-${label}.png`});
    }
  }
  report.push({id,rows});
  await page.evaluate(()=>window.sampleScene.destroy());
  await writeFile(`${out}/results.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify({id,samples:rows.reduce((n,r)=>n+r.samples,0),problems:rows.filter(r=>r.continuity>.01||r.collisions.length)}));
}
await browser.close();
