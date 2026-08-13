# VerbQuest: Slingshot AR

An educational WebAR-style slingshot game for Thai primary-school learners reviewing **am / is / are**. The live camera sits behind a transparent Phaser 3 + Matter Physics game layer; camera frames stay on the device.

## Features

- Magical procedural art, wizard mascot, elastic slingshot, ballistic Matter projectile, floating answer crystals, impact effects, Web Audio and supported haptics.
- Event-specific sound effects for UI actions, orb grabbing, launch, hits, misses, rewards, and victory.
- 60 verified grammar questions in `src/questions.ts`, organised by pronouns, singular nouns, plurals, and mixed review.
- Practice (10 questions, unlimited retries), Challenge (15 questions, hearts/combo/shield), and local Team mode with a LocalStorage leaderboard.
- Hand tracking through MediaPipe Tasks Vision, plus complete touch/mouse and keyboard fallback. Camera is optional.
- Results with accuracy, combo, average time, coins, missed categories, and a Practice Mistakes round.
- Settings for input mode, sound volume, reduced motion, and quality. The layout is landscape-first with a rotation prompt.

## Install and run

```bash
npm install
npm run dev
```

Other commands: `npm run typecheck`, `npm run test`, `npm run build`, and `npm run preview`.

Camera access requires **HTTPS or localhost**. Press “เปิดกล้องและเริ่ม” before any permission request, then choose **กล้องหน้า (Front camera)**—the default and recommended option for hand tracking—or **กล้องหลัง (Rear camera)**. If permission is denied, select “เล่นโดยไม่ใช้กล้อง”; all gameplay works with fallback controls.

## Controls

- Hand: pinch index finger and thumb near the orb, pull, then open fingers or move to the bottom edge to fire.
- Touch/mouse: drag the orb backwards and release, or reach the bottom edge to fire immediately.
- Keyboard: arrows pull the orb; Space/Enter launch; R releases/resets.

## Content and tuning

Add questions to `src/questions.ts` using `{ id, sentence, subject, answer, explanation, category, difficulty }`. Answers must be `am`, `is`, or `are` and sentence blanks use `___`.

Slingshot pull cap and launch conversion are in `src/logic.ts` (`pullLimit`, `launchVelocity`). Target placement/shuffling and float speed are in `src/GameScene.ts`; `Settings.readingTime` and `targetSpeed` provide the user tuning surface.

## Deployment and support

Build with `npm run build` and deploy the `dist/` folder to GitHub Pages. The Vite base is relative so it works under a repository path. Current Chrome/Edge, Android Chrome, iOS Safari, and desktop webcams are supported; MediaPipe can fall back to touch/mouse if its model or WebGL cannot load.

No accounts, ads, analytics, backend, or camera uploads are used. If LocalStorage is blocked/corrupt, the game silently continues without saved settings or scores. For camera trouble, use HTTPS/localhost, check browser permissions, or select the fallback control option.

## Audio credits

Sound effects are selected from Kenney's [UI Audio](https://kenney.nl/assets/ui-audio) and [Digital Audio](https://kenney.nl/assets/digital-audio) packs, released under Creative Commons Zero (CC0). The bundled MP3 files are transcoded from the original OGG files for broad browser support.
