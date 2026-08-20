import Phaser from 'phaser';
import type { Answer, Question, Settings } from './types';
import { ANSWERS, MIN_PULL_DISTANCE, isValidLaunch, launchVelocity, pullLimit, shuffleTargets } from './logic';

export interface SceneEvents { hit:(answer:Answer)=>void; miss:()=>void; aim:(power:number)=>void; launch:()=>void; }
type Target={answer:Answer; body:Phaser.Physics.Matter.Sprite; label:Phaser.GameObjects.Text; halo:Phaser.GameObjects.Arc; baseY:number; falling?:boolean; vx?:number; vy?:number; rotSpeed?:number;};
export class VerbQuestScene extends Phaser.Scene {
  eventsOut!:SceneEvents; settings!:Settings; private rest={x:0,y:0}; private maxPull=180; private pouch!:Phaser.GameObjects.Arc; private grabRing!:Phaser.GameObjects.Arc; private bands!:Phaser.GameObjects.Graphics; private orbit!:Phaser.GameObjects.Graphics; private projectile?:Phaser.Physics.Matter.Sprite; private targets:Target[]=[]; private aiming=false; private pull={x:0,y:0,d:0}; private flight=false; private particles?:Phaser.GameObjects.Particles.ParticleEmitter; private cursor?:Phaser.GameObjects.Arc; private activeQuestion?:Question;
  constructor(){super('verbquest');}
  create(){
    this.makeTextures(); this.matter.world.setGravity(0,1.35); this.scale.on('resize',()=>this.layout()); this.drawSky();
    this.grabRing=this.add.circle(0,0,46,0x6effe8,0).setStrokeStyle(2,0x6effe8,.45).setDepth(12);
    this.tweens.add({targets:this.grabRing,scale:1.15,alpha:.15,duration:1300,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});
    this.bands=this.add.graphics().setDepth(14);this.orbit=this.add.graphics().setDepth(13);this.pouch=this.add.circle(0,0,22,0xffd75e).setStrokeStyle(4,0xffffff,.85).setDepth(16);this.cursor=this.add.circle(0,0,10,0x6effe8,.7).setStrokeStyle(2,0xffffff).setDepth(30).setVisible(false);this.layout();
    this.particles=this.add.particles(0,0,'spark',{speed:{min:30,max:140},scale:{start:.8,end:0},lifespan:600,quantity:0,blendMode:'ADD'}).setDepth(25);
    this.matter.world.on('collisionstart',(event:Phaser.Physics.Matter.Events.CollisionStartEvent)=>this.collide(event));
  }
  private makeTextures(){
    const g=this.make.graphics({x:0,y:0});
    g.clear().fillStyle(0xffffff).fillCircle(54,54,50).lineStyle(4,0xffffff,.8).strokeCircle(54,54,47).generateTexture('bubble',108,108);
    g.clear().fillStyle(0xffffff).fillCircle(28,28,26).fillStyle(0xffffff,.5).fillCircle(19,18,8).generateTexture('orb',56,56);
    g.clear().fillStyle(0xffffff).fillCircle(5,5,5).generateTexture('spark',10,10);g.destroy();
  }
  private drawSky(){const g=this.add.graphics().setDepth(-1);g.fillStyle(0x0d0630,.72).fillRect(0,0,3000,2000);for(let i=0;i<65;i++){g.fillStyle(i%3?0x70f8ff:0xffdc69,.75);g.fillCircle(20+(i*97)%1600,20+(i*47)%760,(i%4)+1);}this.add.text(22,200,'✦  ✦    📖      ✧      ☁', {fontFamily:'system-ui',fontSize:'26px',color:'#dbfaff'}).setDepth(0).setAlpha(.65);}
  private layout(){const w=this.scale.width,h=this.scale.height;const clearance=Math.min(210,Math.max(120,h*.28));this.rest={x:w/2,y:h-clearance};this.maxPull=Math.min(180,Math.max(90,h-this.rest.y-20));if(this.grabRing)this.grabRing.setPosition(this.rest.x,this.rest.y);this.resetPouch();}
  setup(events:SceneEvents,settings:Settings){this.eventsOut=events;this.settings=settings;}
  get restPoint(){return {...this.rest};}
  reload(){if(!this.flight)this.resetProjectile();}
  question(q:Question){this.clearTargets();this.activeQuestion=q;this.resetProjectile();const w=this.scale.width,h=this.scale.height;const slots=shuffleTargets([{x:w*.22,y:h*.38},{x:w*.5,y:h*.3},{x:w*.78,y:h*.39}]);ANSWERS.forEach((answer,i)=>this.addTarget(answer,slots[i].x,slots[i].y));}
  private addTarget(answer:Answer,x:number,y:number){const color:Record<Answer,number>={am:0xff6ca8,is:0x57e5ff,are:0xaef05b};const halo=this.add.circle(x,y,54,color[answer],.23).setDepth(4);const body=this.matter.add.sprite(x,y,'bubble',undefined,{isStatic:true,isSensor:true,shape:{type:'circle',radius:47}}).setDisplaySize(105,105).setTint(color[answer]).setDepth(6);const label=this.add.text(x,y,answer,{fontFamily:'Arial Rounded MT Bold,Arial',fontSize:'30px',color:'#fff',stroke:'#1c1248',strokeThickness:6}).setOrigin(.5).setDepth(7);this.targets.push({answer,body,label,halo,baseY:y,falling:false});}
  private clearTargets(){this.targets.forEach(t=>{this.tweens.killTweensOf([t.body,t.label,t.halo]);t.body.destroy();t.label.destroy();t.halo.destroy();});this.targets=[];}
  private resetPouch(){if(!this.pouch)return;this.pouch.setPosition(this.rest.x,this.rest.y);this.drawBands(this.rest.x,this.rest.y);}
  private resetProjectile(){if(this.projectile)this.projectile.destroy();this.flight=false;this.aiming=false;this.pull={x:0,y:0,d:0};this.resetPouch();if(this.orbit)this.orbit.clear();this.projectile=this.matter.add.sprite(this.rest.x,this.rest.y,'orb',undefined,{frictionAir:.012,restitution:.55,density:.002}).setCircle(19).setDisplaySize(44,44).setTint(0xffe55d).setDepth(15);this.projectile.setStatic(true);}
  pointer(x:number,y:number,down:boolean,release=false,hand=false){
    if(!this.projectile||this.flight)return;
    if(hand&&this.cursor){
      const nearRest=Phaser.Math.Distance.Between(x,y,this.rest.x,this.rest.y)<75;
      this.cursor.setPosition(x,y).setVisible(true);
      if(this.aiming){
        const valid=isValidLaunch(this.pull,MIN_PULL_DISTANCE);
        this.cursor.setFillStyle(valid?0x6effe8:0xff9472,.85);
      }else{
        this.cursor.setFillStyle(nearRest?0xffe264:0x6effe8,nearRest?.9:.6);
      }
    }
    if(down){
      if(!this.aiming&&Phaser.Math.Distance.Between(x,y,this.rest.x,this.rest.y)<75&&y>=this.rest.y-45)this.aiming=true;
      if(this.aiming){
        const dx=x-this.rest.x;
        const dy=Math.max(-15,y-this.rest.y);
        const p=pullLimit(dx,dy,this.maxPull);
        this.pull=p;
        this.projectile.setPosition(this.rest.x+p.x,this.rest.y+p.y);
        this.pouch.setPosition(this.rest.x+p.x,this.rest.y+p.y);
        this.drawBands(this.pouch.x,this.pouch.y);
        if(isValidLaunch(p,MIN_PULL_DISTANCE)){
          this.eventsOut.aim(p.d/this.maxPull);
          this.drawTrajectory();
        }else{
          this.orbit.clear();
          this.eventsOut.aim(0);
        }
      }
    }else if(release&&this.aiming){
      if(isValidLaunch(this.pull,MIN_PULL_DISTANCE))this.launch();
      else this.cancelAim();
    }
  }
  cancelAim(){
    if(!this.aiming)return;
    this.aiming=false;
    this.pull={x:0,y:0,d:0};
    this.orbit.clear();
    this.resetPouch();
    if(this.projectile&&!this.flight)this.projectile.setPosition(this.rest.x,this.rest.y);
    this.eventsOut.aim(0);
  }
  hideCursor(){this.cursor?.setVisible(false);}
  private drawBands(x:number,y:number){const r=this.rest;this.bands.clear();this.bands.lineStyle(10,0xff8c55,.95);this.bands.beginPath().moveTo(r.x-52,r.y+23).lineTo(x,y).lineTo(r.x+52,r.y+23).strokePath();this.bands.lineStyle(3,0xfff4aa,.9);this.bands.beginPath().moveTo(r.x-52,r.y+23).lineTo(x,y).lineTo(r.x+52,r.y+23).strokePath();}
  private launchPull(){const scale=180/this.maxPull;return {x:this.pull.x*scale,y:this.pull.y*scale,d:this.pull.d*scale};}
  private drawTrajectory(){this.orbit.clear();const v=launchVelocity(this.launchPull()),start=this.projectile!;this.orbit.fillStyle(0xa9fff8,.85);for(let t=.08;t<1.15;t+=.08){const x=start.x+v.x*60*t;const y=start.y+v.y*60*t+.5*1.35*60*t*t;if(y>this.scale.height-15)break;this.orbit.fillCircle(x,y,3);}}
  private launch(){const p=this.projectile;if(!p)return;this.aiming=false;this.flight=true;this.orbit.clear();this.pouch.setPosition(this.rest.x,this.rest.y);this.drawBands(this.rest.x,this.rest.y);p.setStatic(false);const v=launchVelocity(this.launchPull());p.setVelocity(v.x,v.y);this.eventsOut.aim(0);this.eventsOut.launch();}
  private collide(e:Phaser.Physics.Matter.Events.CollisionStartEvent){
    if(!this.flight||!this.projectile)return;
    for(const pair of e.pairs){
      const a=pair.bodyA.gameObject,b=pair.bodyB.gameObject;
      const target=this.targets.find(t=>t.body===a||t.body===b);
      if(target&&(a===this.projectile||b===this.projectile)){
        this.flight=false;
        const bv=this.projectile.body?this.projectile.body.velocity:{x:0,y:-8};
        this.projectile.setStatic(true);
        this.projectile.setVisible(false);
        target.falling=true;
        target.vx=Phaser.Math.Clamp(bv.x*.25,-4,4)+Phaser.Math.FloatBetween(-1,1);
        target.vy=Math.max(2.5,Math.abs(bv.y*.15)+2);
        target.rotSpeed=Phaser.Math.FloatBetween(-.05,.05);
        this.tweens.add({targets:target.halo,alpha:0,duration:200});
        this.tweens.add({targets:[target.body,target.label],scaleX:1.15,scaleY:.85,duration:70,yoyo:true});
        this.eventsOut.hit(target.answer);
        this.burst(target.body.x,target.body.y,target.answer===this.activeQuestion?.answer);
        return;
      }
    }
  }
  feedback(answer:Answer,correct:boolean,points=100,combo=1){
    const t=this.targets.find(x=>x.answer===answer);
    if(!t)return;
    const x=t.body.x,y=t.body.y;
    if(correct){
      const txt=this.add.text(x,y-15,`+${points}`,{fontFamily:'Arial Rounded MT Bold,system-ui',fontSize:'34px',color:'#ffea47',stroke:'#0d382c',strokeThickness:6}).setOrigin(.5).setDepth(28);
      this.tweens.add({targets:txt,y:y-85,alpha:0,scale:1.25,duration:850,ease:'Cubic.easeOut',onComplete:()=>txt.destroy()});
      if(combo>=2){
        const comboTxt=this.add.text(x,y-55,`✦ x${combo} COMBO!`,{fontFamily:'Arial Rounded MT Bold,system-ui',fontSize:'22px',color:'#6effe8',stroke:'#1c1248',strokeThickness:5}).setOrigin(.5).setDepth(28);
        this.tweens.add({targets:comboTxt,y:y-115,alpha:0,scale:1.15,duration:950,ease:'Cubic.easeOut',onComplete:()=>comboTxt.destroy()});
      }
      this.targets.filter(x=>x.answer!==answer).forEach(other=>{
        this.tweens.add({targets:[other.body,other.label,other.halo],alpha:.2,duration:350});
      });
    }else{
      const txt=this.add.text(x,y-15,'✕ TRY AGAIN',{fontFamily:'Arial Rounded MT Bold,system-ui',fontSize:'24px',color:'#ff7272',stroke:'#3a0c10',strokeThickness:5}).setOrigin(.5).setDepth(28);
      this.tweens.add({targets:txt,y:y-65,alpha:0,duration:800,ease:'Cubic.easeOut',onComplete:()=>txt.destroy()});
      this.tweens.add({targets:[t.body,t.label],x:'+=10',duration:65,yoyo:true,repeat:3});
      const right=this.targets.find(x=>x.answer===this.activeQuestion?.answer);
      if(right){
        right.halo.setFillStyle(0xaef05b,.75);
        this.tweens.add({targets:[right.halo,right.body],scale:1.15,duration:220,yoyo:true,repeat:2});
      }
    }
  }
  private burst(x:number,y:number,correct:boolean){this.particles?.setParticleTint(correct?[0xb7ff5e,0xffdf5b,0x6effe8,0xffffff]:[0xff785b,0xffd35d,0x888888]).explode(correct?32:16,x,y);this.cameras.main.shake(correct?130:70,correct?.012:.005);}
  update(){
    if(this.flight&&this.projectile){
      const p=this.projectile;
      if(p.x<-80||p.x>this.scale.width+80||p.y>this.scale.height+120){
        this.flight=false;
        this.eventsOut.miss();
      }
    }
    this.targets.forEach((t,i)=>{
      if(t.falling){
        t.vy=(t.vy??2.5)+.75;
        const nextX=t.body.x+(t.vx??0);
        const nextY=t.body.y+t.vy;
        const nextRot=t.body.rotation+(t.rotSpeed??.03);
        t.body.setPosition(nextX,nextY);
        t.body.setRotation(nextRot);
        t.label.setPosition(nextX,nextY);
        t.label.setRotation(nextRot);
        t.halo.setPosition(nextX,nextY);
        if(nextY>this.scale.height+140){
          t.body.setVisible(false);
          t.label.setVisible(false);
          t.halo.setVisible(false);
        }
      }else if(this.settings?.targetSpeed&&this.activeQuestion&&this.settings.targetSpeed>0&&!this.settings.reducedMotion){
        const drift=this.settings.targetSpeed*(this.settings.inputMode==='keyboard'?0:1)*(this.settings.targetSpeed>1?1:0.22);
        const y=t.baseY+Math.sin(this.time.now/700+i)*8*drift;
        t.body.setY(y);
        t.label.setY(y);
        t.halo.setY(y);
      }
    });
    if(this.flight&&this.projectile?.body){
      const v=this.projectile.body.velocity;
      this.projectile.setRotation(Math.atan2(v.y,v.x));
    }
  }
}

