export type Phase='loading'|'intro'|'watching'|'deciding'|'resolving'|'outcome'|'done'|'exited';
export interface SceneState {phase:Phase;time:number;worldTime:number;resolveTime:number;decisionWorld:number;success?:boolean;action?:string;reduced:boolean}
export interface SceneFeedback {impact?:{x:number;y:number;label:string};finished?:boolean;speed?:number}
export interface SceneHandle {update(state:SceneState):SceneFeedback|void;destroy():void;ready?:Promise<void>}
export const clamp=(v:number)=>Math.min(1,Math.max(0,v));
export const ease=(v:number)=>{const p=clamp(v);return p*p*(3-2*p)};
export const mix=(a:number,b:number,t:number)=>a+(b-a)*clamp(t);
