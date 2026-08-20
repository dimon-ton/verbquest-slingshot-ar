import { describe, expect, it } from 'vitest';
import { QUESTIONS } from './questions';
import { ANSWERS, MIN_PULL_DISTANCE, emptyStats, heartsAfter, hitResult, isValidLaunch, launchVelocity, pullLimit, reachesBottomEdge, scoreHit, shuffleTargets, validTransition } from './logic';

describe('question bank',()=>{it('has valid unique, explained answers',()=>{expect(QUESTIONS.length).toBeGreaterThanOrEqual(60);expect(new Set(QUESTIONS.map(q=>q.id)).size).toBe(QUESTIONS.length);for(const q of QUESTIONS){expect(ANSWERS).toContain(q.answer);expect(q.explanation.length).toBeGreaterThan(3);expect(q.sentence).toContain('___');}});});

describe('game logic',()=>{
  it('shuffles without duplicates',()=>{const a=shuffleTargets(['am','is','are'],()=>.01);expect(new Set(a).size).toBe(3);expect(a.sort()).toEqual(['am','are','is']);});
  it('limits pull and calculates opposite launch',()=>{const p=pullLimit(300,0);expect(p.d).toBe(180);expect(launchVelocity(p).x).toBeLessThan(0);});
  it('validates minimum pull and pull direction to prevent accidental shots',()=>{
    expect(isValidLaunch({ x: 0, y: 10, d: 10 })).toBe(false); // micro-pull
    expect(isValidLaunch({ x: 0, y: 0, d: 0 })).toBe(false);   // zero-pull
    expect(isValidLaunch({ x: 0, y: -40, d: 40 })).toBe(false); // upward pull
    expect(isValidLaunch({ x: 0, y: 40, d: 40 })).toBe(true);  // downward pull >= MIN_PULL_DISTANCE
    expect(isValidLaunch({ x: 30, y: 30, d: Math.hypot(30,30) })).toBe(true);
  });
  it('scores correct hits and evaluates answers',()=>{expect(scoreHit(true,1000,1,true)).toBeGreaterThan(100);expect(scoreHit(false,0,0)).toBe(0);expect(hitResult(QUESTIONS[0],'am').correct).toBe(true);expect(hitResult(QUESTIONS[0],'is').correct).toBe(false);});
  it('uses hearts only in challenge and spends shield',()=>{expect(heartsAfter('practice',3,false).hearts).toBe(3);expect(heartsAfter('challenge',3,false).hearts).toBe(2);expect(heartsAfter('challenge',3,false,true)).toEqual({hearts:3,shield:false});expect(emptyStats('challenge').hearts).toBe(3);});
  it('allows defined state transitions',()=>{expect(validTransition('aiming','projectileFlight')).toBe(true);expect(validTransition('results','projectileFlight')).toBe(false);});
});

describe('bottom-edge launch gesture',()=>{
  it('fires at the bottom edge but not above its tolerance',()=>{
    expect(reachesBottomEdge(799,800)).toBe(true);
    expect(reachesBottomEdge(798,800)).toBe(false);
    expect(reachesBottomEdge(797,800,3)).toBe(true);
  });
});

