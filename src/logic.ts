import type { Answer, GameState, Mode, Question, RoundStats } from './types';
export const ANSWERS:Answer[]=['am','is','are'];
export function shuffleTargets<T>(items:T[], random=Math.random):T[] { const a=[...items]; for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
export const MIN_PULL_DISTANCE = 35;
export const PINCH_START_RATIO = 0.065;
export const PINCH_RELEASE_RATIO = 0.085;
export function isValidLaunch(pull: { x: number; y: number; d: number }, minDistance = MIN_PULL_DISTANCE): boolean {
  return pull.d >= minDistance && pull.y >= -15;
}
export function pullLimit(dx:number,dy:number,max=180){ const d=Math.hypot(dx,dy); return d>max?{x:dx/d*max,y:dy/d*max,d:max}:{x:dx,y:dy,d}; }
export function reachesBottomEdge(y:number,bottom:number,tolerance=1){return y>=bottom-tolerance;}
export function launchVelocity(pull:{x:number;y:number;d:number}) { const strength=.055 + (pull.d/180)*.09; return { x:-pull.x*strength, y:-pull.y*strength }; }
export function scoreHit(correct:boolean, elapsed:number, combo:number, direct=false, fever=false){ if(!correct)return 0; return Math.round((100+Math.max(0,50-Math.min(50,elapsed/100))+ (direct?25:0))*(combo>=5?2:1)*(fever?2:1)); }
export function hitResult(question:Question, answer:Answer){ return { correct:question.answer===answer, correctAnswer:question.answer }; }
export function heartsAfter(mode:Mode, hearts:number, correct:boolean, shield=false){ if(mode==='practice'||correct)return { hearts, shield }; if(shield)return { hearts, shield:false }; return { hearts:Math.max(0,hearts-1), shield }; }
const allowed:Record<GameState,GameState[]>={boot:['menu','error'],menu:['cameraPermission','calibration','aiming','error'],cameraPermission:['calibration','aiming','menu','error'],calibration:['aiming','menu','error'],aiming:['projectileFlight','paused','results'],projectileFlight:['hitFeedback','aiming','paused'],hitFeedback:['aiming','boss','results'],actionSection:['aiming'],boss:['aiming','results'],paused:['aiming','menu'],results:['menu','aiming'],error:['menu']};
export function validTransition(from:GameState,to:GameState){return allowed[from].includes(to);}
export function emptyStats(mode:Mode):RoundStats{return {score:0,correct:0,attempted:0,combo:0,highestCombo:0,coins:0,stars:0,directHits:0,answerTimes:[],mistakes:{},hearts:mode==='challenge'?3:99,shield:false};}

