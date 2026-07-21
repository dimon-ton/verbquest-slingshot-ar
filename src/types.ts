export type Answer = 'am' | 'is' | 'are';
export type Mode = 'practice' | 'challenge' | 'team';
export type InputMode = 'hand' | 'pointer' | 'keyboard';
export type GameState = 'boot' | 'menu' | 'cameraPermission' | 'calibration' | 'aiming' | 'projectileFlight' | 'hitFeedback' | 'actionSection' | 'boss' | 'paused' | 'results' | 'error';
export interface Question { id: string; sentence: string; subject: string; answer: Answer; explanation: string; category: string; difficulty: number; }
export interface Settings { inputMode: InputMode; cameraFacing: 'user'|'environment'; muted: boolean; music: boolean; volume: number; reducedMotion: boolean; quality: 'low'|'medium'|'high'; readingTime: number; targetSpeed: number; }
export interface RoundStats { score:number; correct:number; attempted:number; combo:number; highestCombo:number; coins:number; stars:number; directHits:number; answerTimes:number[]; mistakes: Record<string, number>; hearts:number; shield:boolean; }
