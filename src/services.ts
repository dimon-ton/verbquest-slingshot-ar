import type { Settings, InputMode } from './types';
import { PINCH_RELEASE_RATIO, PINCH_START_RATIO, reachesBottomEdge } from './logic';

export type SoundCue='click'|'grab'|'launch'|'correct'|'wrong'|'coin'|'miss'|'victory'|'hit'|'combo';
const SOUND_URLS:Record<SoundCue,string>={
  click:new URL('./assets/audio/ui-click.mp3',import.meta.url).href,
  grab:new URL('./assets/audio/grab.mp3',import.meta.url).href,
  launch:new URL('./assets/audio/launch.mp3',import.meta.url).href,
  correct:new URL('./assets/audio/correct.mp3',import.meta.url).href,
  wrong:new URL('./assets/audio/wrong.mp3',import.meta.url).href,
  coin:new URL('./assets/audio/coin.mp3',import.meta.url).href,
  miss:new URL('./assets/audio/miss.mp3',import.meta.url).href,
  victory:new URL('./assets/audio/victory.mp3',import.meta.url).href,
  hit:new URL('./assets/audio/hit.mp3',import.meta.url).href,
  combo:new URL('./assets/audio/combo.mp3',import.meta.url).href,
};
const BGM_URL=new URL('./assets/audio/bgm.mp3',import.meta.url).href;
const SOUND_LEVEL:Record<SoundCue,number>={click:.5,grab:.45,launch:.72,correct:.85,wrong:.7,coin:.65,miss:.58,victory:.85,hit:.65,combo:.75};

export class StorageManager {
  private key='verbquest-settings-v1'; private scoreKey='verbquest-teams-v1';
  defaults:Settings={inputMode:'pointer',cameraFacing:'user',muted:false,music:true,volume:.55,reducedMotion:false,quality:'high',readingTime:1,targetSpeed:1};
  getSettings():Settings { try{return {...this.defaults,...JSON.parse(localStorage.getItem(this.key)||'{}')};}catch{return {...this.defaults};} }
  saveSettings(s:Settings){try{localStorage.setItem(this.key,JSON.stringify(s));}catch{/* storage remains optional */}}
  teams():{name:string;score:number;date:string}[]{try{const x=JSON.parse(localStorage.getItem(this.scoreKey)||'[]');return Array.isArray(x)?x:[];}catch{return [];}}
  addTeam(name:string,score:number){try{const rows=[...this.teams(),{name:name.trim().slice(0,24)||'Team Wizard',score,date:new Date().toLocaleDateString()}].sort((a,b)=>b.score-a.score).slice(0,10);localStorage.setItem(this.scoreKey,JSON.stringify(rows));}catch{/* optional */}}
}
export class AudioManager {
  private ctx?:AudioContext; private buffers=new Map<SoundCue|'bgm',AudioBuffer>(); private loading?:Promise<void>; private pending=new Set<SoundCue|'bgm'>(); private bgmNode?:AudioBufferSourceNode; private bgmGain?:GainNode; muted=false; music=true; volume=.55;
  private context(){return this.ctx||(this.ctx=new AudioContext());}
  preload(){if(this.loading)return this.loading;const c=this.context();const urls:[SoundCue|'bgm',string][]=[...(Object.entries(SOUND_URLS) as [SoundCue,string][]),['bgm',BGM_URL]];this.loading=Promise.all(urls.map(async([cue,url])=>{try{const response=await fetch(url);if(!response.ok)return;this.buffers.set(cue,await c.decodeAudioData(await response.arrayBuffer()));}catch{/* optional audio load */}})).then(()=>undefined);return this.loading;}
  unlock(){const c=this.context();if(c.state==='suspended')void c.resume();void this.preload().then(()=>{if(this.music&&!this.bgmNode&&!this.muted)this.startBgm();});}
  play(cue:SoundCue){if(this.muted)return;this.unlock();if(this.buffers.has(cue)){this.playBuffer(cue);return;}if(this.pending.has(cue))return;this.pending.add(cue);void this.preload().then(()=>{this.pending.delete(cue);if(!this.muted&&this.buffers.has(cue))this.playBuffer(cue);});}
  private playBuffer(cue:SoundCue){const c=this.context(),source=c.createBufferSource(),gain=c.createGain();source.buffer=this.buffers.get(cue)!;gain.gain.value=Math.max(0,Math.min(1,this.volume))*SOUND_LEVEL[cue];source.connect(gain).connect(c.destination);source.start();}
  startBgm(){if(this.bgmNode||!this.music||this.muted)return;const c=this.context();const buffer=this.buffers.get('bgm');if(!buffer){void this.preload().then(()=>{if(this.music&&!this.muted&&!this.bgmNode)this.startBgm();});return;}const source=c.createBufferSource();const gain=c.createGain();source.buffer=buffer;source.loop=true;gain.gain.value=Math.max(0,Math.min(1,this.volume))*.32;source.connect(gain).connect(c.destination);source.start();this.bgmNode=source;this.bgmGain=gain;}
  stopBgm(){if(this.bgmNode){try{this.bgmNode.stop();this.bgmNode.disconnect();}catch{}this.bgmNode=undefined;this.bgmGain=undefined;}}
  updateSettings(muted:boolean,music:boolean,volume:number){this.muted=muted;this.music=music;this.volume=volume;if(this.bgmGain)this.bgmGain.gain.value=(muted||!music)?0:Math.max(0,Math.min(1,volume))*.32;if(!muted&&music&&!this.bgmNode)this.startBgm();else if((muted||!music)&&this.bgmNode)this.stopBgm();}
}
export class CameraController {
  stream?:MediaStream;
  async start(video:HTMLVideoElement,facing:'user'|'environment'='user'){ if(!navigator.mediaDevices?.getUserMedia)throw Error('Camera API is not available in this browser.');this.stop();this.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facing},width:{ideal:1280},height:{ideal:720}},audio:false});video.srcObject=this.stream;video.style.transform=facing==='user'?'scaleX(-1)':'none';await video.play(); }
  stop(){this.stream?.getTracks().forEach(t=>t.stop());this.stream=undefined;}
}
export type HandPoint={x:number;y:number;pinch:boolean;seen:number;joints:{x:number;y:number}[]};
type NormalizedJoint={x:number;y:number};
type HandWorkerMessage=
  | {type:'ready'}
  | {type:'result';landmarks:NormalizedJoint[][]}
  | {type:'error';message:string};
export class HandTrackingController {
  private worker?:Worker; private directLandmarker?:any; private running=false; private busy=false; private frameRequest=0; private lastVideoTime=-1; private lastInference=0; private isPinching=false; private pinchFrames=0; private smoothX?:number; private smoothY?:number; point?:HandPoint;
  async start(video:HTMLVideoElement,onPoint:(p:HandPoint|undefined)=>void,mirror=true,onError?:(message:string)=>void){
    this.stop();
    this.running=true;
    if(typeof Worker!=='undefined'&&typeof createImageBitmap!=='undefined'){
      try {
        const worker=new Worker(new URL('./handTracking.worker.ts',import.meta.url),{type:'module'});
        this.worker=worker;
        await new Promise<void>((resolve,reject)=>{
          let ready=false;
          const timeout=window.setTimeout(()=>reject(Error('Hand tracking worker timed out.')),12000);
          const fail=(message:string)=>{
            if(!ready){clearTimeout(timeout);reject(Error(message));return;}
            void this.startDirect(video,onPoint,mirror,onError);
          };
          worker.onerror=event=>{event.preventDefault();fail(event.message||'Worker error');};
          worker.onmessage=(event:MessageEvent<HandWorkerMessage>)=>{
            const message=event.data;
            if(message.type==='ready'){ready=true;clearTimeout(timeout);resolve();return;}
            if(message.type==='error'){fail(message.message);return;}
            this.busy=false;
            this.processLandmarks(message.landmarks[0],onPoint,mirror);
          };
          worker.postMessage({type:'init'});
        });
        const tick=()=>{
          if(!this.running||!this.worker)return;
          this.frameRequest=requestAnimationFrame(tick);
          const now=performance.now();
          if(this.busy||video.readyState<2||video.currentTime===this.lastVideoTime||now-this.lastInference<66)return;
          this.busy=true;this.lastVideoTime=video.currentTime;this.lastInference=now;
          createImageBitmap(video).then(frame=>{
            if(!this.running||!this.worker){frame.close();this.busy=false;return;}
            this.worker.postMessage({type:'frame',frame,timestamp:now},[frame]);
          }).catch(()=>{this.busy=false;});
        };
        tick();
        return;
      }catch(e){
        if(this.worker){this.worker.terminate();this.worker=undefined;}
      }
    }
    await this.startDirect(video,onPoint,mirror,onError);
  }

  private async startDirect(video:HTMLVideoElement,onPoint:(p:HandPoint|undefined)=>void,mirror=true,onError?:(message:string)=>void){
    try {
      const {FilesetResolver,HandLandmarker}=await import('@mediapipe/tasks-vision');
      const vision=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm');
      const options={baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',delegate:'GPU' as const},runningMode:'VIDEO' as const,numHands:1};
      try{this.directLandmarker=await HandLandmarker.createFromOptions(vision,options);}
      catch{this.directLandmarker=await HandLandmarker.createFromOptions(vision,{...options,baseOptions:{...options.baseOptions,delegate:'CPU'}});}
      const tick=()=>{
        if(!this.running||!this.directLandmarker)return;
        this.frameRequest=requestAnimationFrame(tick);
        const now=performance.now();
        if(video.readyState>=2&&now-this.lastInference>50){
          this.lastInference=now;
          const r=this.directLandmarker.detectForVideo(video,now);
          this.processLandmarks(r.landmarks[0],onPoint,mirror);
        }
      };
      tick();
    }catch(e){
      this.stop();
      onError?.(e instanceof Error?e.message:'Failed to initialize hand tracking.');
      throw e;
    }
  }

  private processLandmarks(landmarks:NormalizedJoint[]|undefined,onPoint:(p:HandPoint|undefined)=>void,mirror:boolean){
    if(!landmarks||landmarks.length<21){
      this.smoothX=undefined;this.smoothY=undefined;this.isPinching=false;this.pinchFrames=0;
      this.point=undefined;onPoint(undefined);return;
    }
    const index=landmarks[8],thumb=landmarks[4];
    const rawX=(mirror?1-index.x:index.x)*innerWidth;
    const rawY=index.y*innerHeight;
    if(this.smoothX===undefined||this.smoothY===undefined){this.smoothX=rawX;this.smoothY=rawY;}
    else{this.smoothX=.7*rawX+.3*this.smoothX;this.smoothY=.7*rawY+.3*this.smoothY;}
    const dist=Math.hypot(index.x-thumb.x,index.y-thumb.y);
    const threshold=this.isPinching?PINCH_RELEASE_RATIO:PINCH_START_RATIO;
    const rawPinch=dist<threshold;
    if(rawPinch)this.pinchFrames++;else this.pinchFrames=0;
    if(this.isPinching)this.isPinching=rawPinch;
    else this.isPinching=this.pinchFrames>=2;
    const joints=landmarks.map(j=>({x:(mirror?1-j.x:j.x)*innerWidth,y:j.y*innerHeight}));
    const point={x:this.smoothX,y:this.smoothY,pinch:this.isPinching,seen:performance.now(),joints};
    this.point=point;onPoint(point);
  }

  stop(){
    this.running=false;this.busy=false;this.lastVideoTime=-1;this.lastInference=0;this.smoothX=undefined;this.smoothY=undefined;this.isPinching=false;this.pinchFrames=0;
    if(this.frameRequest)cancelAnimationFrame(this.frameRequest);
    this.frameRequest=0;this.worker?.terminate();this.worker=undefined;
    this.directLandmarker?.close();this.directLandmarker=undefined;
    this.point=undefined;
  }
}
export class InputController {
  mode:InputMode='pointer'; private keys=new Set<string>(); private move?:{x:number;y:number}; private down=false; private pointerId?:number; private keyboardPoint?:{x:number;y:number};
  constructor(private element:HTMLElement, private on:(p:{x:number;y:number;down:boolean;release?:boolean;reset?:boolean})=>void){
    element.addEventListener('pointerdown',e=>{if(this.mode!=='pointer')return;this.down=true;this.pointerId=e.pointerId;this.element.setPointerCapture?.(e.pointerId);this.send(e.clientX,e.clientY);});
    element.addEventListener('pointermove',e=>{if(!this.down||e.pointerId!==this.pointerId)return;this.send(e.clientX,e.clientY);if(reachesBottomEdge(e.clientY,this.element.getBoundingClientRect().bottom))this.release(e.clientX,e.clientY);});
    element.addEventListener('pointerup',e=>{if(!this.down||e.pointerId!==this.pointerId)return;this.release(e.clientX,e.clientY);});
    addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','Enter','r','R'].includes(e.key)){e.preventDefault();this.keys.add(e.key);}});addEventListener('keyup',e=>this.keys.delete(e.key));
  }
  private send(x:number,y:number){this.move={x,y};this.on({x,y,down:this.down});}
  private release(x:number,y:number){const pointerId=this.pointerId;this.down=false;this.pointerId=undefined;if(pointerId!==undefined&&this.element.hasPointerCapture?.(pointerId))this.element.releasePointerCapture?.(pointerId);this.on({x,y,down:false,release:true});}
  keyboard(rest:{x:number;y:number}){if(this.mode!=='keyboard')return;const p=this.keyboardPoint||{...rest};if(this.keys.has('ArrowLeft'))p.x-=5;if(this.keys.has('ArrowRight'))p.x+=5;if(this.keys.has('ArrowUp'))p.y-=5;if(this.keys.has('ArrowDown'))p.y+=5;this.keyboardPoint=p;const launch=this.keys.has(' ')||this.keys.has('Enter');if(launch){this.keys.delete(' ');this.keys.delete('Enter');this.on({x:p.x,y:p.y,down:false,release:true});this.keyboardPoint=undefined;}else this.on({x:p.x,y:p.y,down:true});if(this.keys.has('r')||this.keys.has('R')){this.keys.delete('r');this.keys.delete('R');this.keyboardPoint=undefined;this.on({x:rest.x,y:rest.y,down:false,reset:true});}}
}
