import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import type { Settings, InputMode } from './types';

export class StorageManager {
  private key='verbquest-settings-v1'; private scoreKey='verbquest-teams-v1';
  defaults:Settings={inputMode:'pointer',cameraFacing:'user',muted:false,music:true,volume:.55,reducedMotion:false,quality:'high',readingTime:1,targetSpeed:1};
  getSettings():Settings { try{return {...this.defaults,...JSON.parse(localStorage.getItem(this.key)||'{}')};}catch{return {...this.defaults};} }
  saveSettings(s:Settings){try{localStorage.setItem(this.key,JSON.stringify(s));}catch{/* storage remains optional */}}
  teams():{name:string;score:number;date:string}[]{try{const x=JSON.parse(localStorage.getItem(this.scoreKey)||'[]');return Array.isArray(x)?x:[];}catch{return [];}}
  addTeam(name:string,score:number){try{const rows=[...this.teams(),{name:name.trim().slice(0,24)||'Team Wizard',score,date:new Date().toLocaleDateString()}].sort((a,b)=>b.score-a.score).slice(0,10);localStorage.setItem(this.scoreKey,JSON.stringify(rows));}catch{/* optional */}}
}
export class AudioManager {
  private ctx?:AudioContext; muted=false; volume=.55;
  unlock(){if(!this.ctx)this.ctx=new AudioContext(); if(this.ctx.state==='suspended')void this.ctx.resume();}
  tone(kind:'pull'|'launch'|'correct'|'wrong'|'coin'|'victory', pitch=440){if(this.muted)return;this.unlock();const c=this.ctx!;const o=c.createOscillator(),g=c.createGain();const now=c.currentTime;const map={pull:'sine',launch:'triangle',correct:'sine',wrong:'sawtooth',coin:'square',victory:'triangle'} as const;o.type=map[kind];o.frequency.setValueAtTime(pitch,now);o.frequency.exponentialRampToValueAtTime(kind==='wrong'?110:pitch*1.5,now+.16);g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(.08*this.volume,now+.015);g.gain.exponentialRampToValueAtTime(.0001,now+.24);o.connect(g).connect(c.destination);o.start();o.stop(now+.25);}
}
export class CameraController {
  stream?:MediaStream;
  async start(video:HTMLVideoElement,facing:'user'|'environment'='user'){ if(!navigator.mediaDevices?.getUserMedia)throw Error('Camera API is not available in this browser.');this.stop();this.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facing},width:{ideal:1280},height:{ideal:720}},audio:false});video.srcObject=this.stream;video.style.transform=facing==='user'?'scaleX(-1)':'none';await video.play(); }
  stop(){this.stream?.getTracks().forEach(t=>t.stop());this.stream=undefined;}
}
export type HandPoint={x:number;y:number;pinch:boolean;seen:number;joints:{x:number;y:number}[]};
export class HandTrackingController {
  private landmarker?:HandLandmarker; private running=false; private last=0; point?:HandPoint;
  async start(video:HTMLVideoElement, onPoint:(p:HandPoint|undefined)=>void, mirror=true){
    try { const vision=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm');this.landmarker=await HandLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',delegate:'GPU'},runningMode:'VIDEO',numHands:1});this.running=true;const tick=()=>{if(!this.running)return;const now=performance.now();if(video.readyState>=2&&now-this.last>30){this.last=now;const r=this.landmarker!.detectForVideo(video,now);const l=r.landmarks[0];if(l){const i=l[8],t=l[4];const joints=l.map(j=>({x:(mirror?1-j.x:j.x)*innerWidth,y:j.y*innerHeight}));const p={x:(mirror?1-i.x:i.x)*innerWidth,y:i.y*innerHeight,pinch:Math.hypot(i.x-t.x,i.y-t.y)<.075,seen:now,joints};this.point=p;onPoint(p);}else onPoint(undefined);}requestAnimationFrame(tick);};tick();
    } catch (e) { this.stop(); throw e; }
  }
  stop(){this.running=false;this.landmarker?.close();this.landmarker=undefined;}
}
export class InputController {
  mode:InputMode='pointer'; private keys=new Set<string>(); private move?:{x:number;y:number}; private down=false; private keyboardPoint?:{x:number;y:number};
  constructor(private element:HTMLElement, private on:(p:{x:number;y:number;down:boolean;release?:boolean;reset?:boolean})=>void){
    element.addEventListener('pointerdown',e=>{this.down=true;this.send(e.clientX,e.clientY);});element.addEventListener('pointermove',e=>this.down&&this.send(e.clientX,e.clientY));element.addEventListener('pointerup',e=>{this.down=false;this.on({x:e.clientX,y:e.clientY,down:false,release:true});});
    addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','Enter','r','R'].includes(e.key)){e.preventDefault();this.keys.add(e.key);}});addEventListener('keyup',e=>this.keys.delete(e.key));
  }
  private send(x:number,y:number){this.move={x,y};this.on({x,y,down:this.down});}
  keyboard(rest:{x:number;y:number}){if(this.mode!=='keyboard')return;const p=this.keyboardPoint||{...rest};if(this.keys.has('ArrowLeft'))p.x-=5;if(this.keys.has('ArrowRight'))p.x+=5;if(this.keys.has('ArrowUp'))p.y-=5;if(this.keys.has('ArrowDown'))p.y+=5;this.keyboardPoint=p;const launch=this.keys.has(' ')||this.keys.has('Enter');if(launch){this.keys.delete(' ');this.keys.delete('Enter');this.on({x:p.x,y:p.y,down:false,release:true});this.keyboardPoint=undefined;}else this.on({x:p.x,y:p.y,down:true});if(this.keys.has('r')||this.keys.has('R')){this.keys.delete('r');this.keys.delete('R');this.keyboardPoint=undefined;this.on({x:rest.x,y:rest.y,down:false,reset:true});}}
}
