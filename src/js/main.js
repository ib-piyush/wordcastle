"use strict";

const gameArea=document.getElementById("gameArea");
const scoreEl=document.getElementById("score"),bestScoreEl=document.getElementById("bestScore"),comboEl=document.getElementById("combo"),waveEl=document.getElementById("wave"),hpEl=document.getElementById("hp");
const startScreen=document.getElementById("startScreen"),gameOverScreen=document.getElementById("gameOverScreen");
const target=document.getElementById("targetIndicator"),statusEl=document.getElementById("typingStatus"),inputPreview=document.getElementById("inputPreview"),castle=document.getElementById("castle"),finalScore=document.getElementById("finalScore"),mobileInput=document.getElementById("mobileInput");
const powerButtons=[...document.querySelectorAll(".powerup-btn")];
const desktopOnly=window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints>0;

const words={
 scout:[
  "sun","red","run","zap","fox","jet","ice","arc","bit","war","ram","sky","orb","hit","dash","bolt",
  "glow","nova","rift","peak","bloom","drift","vibe","spark","pulse","phase","glade","frost","crown",
  "tide","flare","lunar","ember","drone","ghost","cinder","brisk","rune","blink","haze","sprint"
 ],
 soldier:[
  "flame","storm","sword","laser","guard","metal","power","speed","armor","enemy","tower","arrow","blaze",
  "force","shield","signal","ember","swift","vortex","helmet","rocket","cannon","mecha","terrain","impact",
  "threat","harbor","drill","sentinel","fusion","hollow","charge","signal","thunder","quartz","ranger","crystal",
  "barricade","breaker","bastion","fury","turret","voltage","bloom","horizon","cobalt","magnet"
 ],
 boss:[
  "destroy","invasion","warrior","firewall","monster","defense","guardian","commander","thunder","overload",
  "stronghold","nightmare","battlefield","protector","apocalypse","execution","catapult","rampart","fortress",
  "oblivion","vengeance","suppress","barrage","massacre","absolute","relics","onslaught","behemoth","ravager",
  "dominion","vanguard","malignant","frontier","sentinel","cyclone","aftershock","titanium","emberfall","shadowfire",
  "horizonbreak","eclipse","reclaimer","ironclad","intercept","warlord","incursion","supremacy","dreadnought"
 ],
 special:[
  "cataclysm","annihilator","thunderstrike","obliteration","electromagnetic","devastation","counterattack",
  "overwhelming","astralflare","blackout","meteorstorm","voidbreaker","starforge","supersonic","planetfall",
  "draconis","quantumflux","retribution","inferno","disruption","hurricane","punishment","magnifier","combustion",
  "resonance","paradox","severance","tempest","hollowcore","skybreaker","dreadstorm","vortexcore","crimsonwave",
  "ultima","neutron","cascade","overdrive","fusionburst","godbreaker","legendary"
 ]
};
const types={scout:{speed:52,hp:1,score:30},soldier:{speed:31,hp:2,score:65},boss:{speed:17,hp:4,score:120},special:{speed:21,hp:3,score:300}};
const keyboardEl=document.getElementById("mobileKeyboard");
const mobileInputEnabled=()=>window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints>0;

let score=0,hp=5,wave=1,running=false,monsters=[],selected=null,id=0,last=0,spawn=0,waveTime=0,spawnInterval=1400,raf;
let targetingMode="manual";
let inputBuffer="";
let combo=0, comboTimer=0, lastKillTime=0;
let bestScore=0, bestCombo=0;
let powerCooldowns={ slow:0, shield:0, burst:0 };
let powerReadyAt={ slow:0, shield:0, burst:0 };
let powerTimers={ slow:0, shield:0, burst:0 };
let shieldCharges=0;
let audioContext=null,musicTimer=null,musicStep=0;

function startAudio(){
 if(desktopOnly||audioContext)return;
 audioContext=new (window.AudioContext||window.webkitAudioContext)();
 audioContext.resume();
 musicTimer=setInterval(playMusicNote,900);
 playMusicNote();
}

function tone(frequency,duration=.08,type="square",volume=.025){
 if(!audioContext||desktopOnly)return;
 if(audioContext.state==="suspended")audioContext.resume();
 const now=audioContext.currentTime,oscillator=audioContext.createOscillator(),gain=audioContext.createGain();
 oscillator.type=type;oscillator.frequency.setValueAtTime(frequency,now);
 gain.gain.setValueAtTime(volume,now);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
 oscillator.connect(gain).connect(audioContext.destination);oscillator.start(now);oscillator.stop(now+duration);
}

function playMusicNote(){
 const notes=[110,130.81,164.81,146.83,196,164.81,130.81,98];
 tone(notes[musicStep++%notes.length],.24,"triangle",.008);
}

function stopAudio(){
 if(musicTimer){clearInterval(musicTimer);musicTimer=null}
 if(audioContext){audioContext.close();audioContext=null}
}

function buildMobileKeyboard(){
  const rows=[["Q","W","E","R","T","Y","U","I","O","P"],["A","S","D","F","G","H","J","K","L"],["Z","X","C","V","B","N","M"],["⌫","CLEAR"]];
  keyboardEl.innerHTML="";
  rows.forEach((row,index)=>{
    const rowEl=document.createElement("div");rowEl.className="keyboard-row";
    row.forEach(key=>{
      const btn=document.createElement("button");
      btn.type="button";
      btn.className="keyboard-key" + (key==="⌫"||key==="CLEAR" ? " action" : "");
      btn.textContent=key;
      btn.addEventListener("click",()=>{
        if(key==="⌫")return handleBackspace();
        if(key==="CLEAR"){inputBuffer="";inputPreview.textContent="";clearTarget();statusEl.textContent="TARGET CLEARED";statusEl.classList.remove("active");return;}
        handleCharacterInput(key.toLowerCase());
      });
      rowEl.appendChild(btn);
    });
    keyboardEl.appendChild(rowEl);
  });
}

function syncMobileKeyboard(){
  if(keyboardEl)keyboardEl.classList.remove("visible");
  if(running && mobileInputEnabled()){
    mobileInput.value=inputBuffer;
    mobileInput.focus({preventScroll:true});
  }else{
    mobileInput.blur();
  }
}

mobileInput.addEventListener("input",()=>{
  if(!running)return;
  const rawValue=mobileInput.value.toLowerCase();
  for(const hotkey of rawValue.match(/[123]/g)||[]) activatePower({"1":"slow","2":"shield","3":"burst"}[hotkey]);
  const value=rawValue.replace(/[^a-z]/g,"");
  if(value.length < inputBuffer.length){
    handleBackspace();
  }else if(value.length > inputBuffer.length){
    for(const ch of value.slice(inputBuffer.length))handleCharacterInput(ch);
  }
  mobileInput.value=inputBuffer;
});

function handleBackspace(){
  if(!running)return;
  inputBuffer=inputBuffer.slice(0,-1);
  inputPreview.textContent=inputBuffer.toUpperCase();
  if(targetingMode==="manual"){
    const m=findManualTarget(inputBuffer);
    if(m)select(m);
    else if(inputBuffer==="")clearTarget();
  }else if(selected){
    selected.typed=inputBuffer;
    render(selected);
  }
}

function handleCharacterInput(ch){
  if(!running||!/^[a-z]$/.test(ch))return;

  if(targetingMode==="manual"){
    const next=inputBuffer+ch;
    const targetMonster=findManualTarget(next);

    if(targetMonster){
      tone(420,.035,"square",.012);
      inputBuffer=next;
      select(targetMonster);
      render(targetMonster);

      if(inputBuffer===targetMonster.word){
        inputBuffer="";
        inputPreview.textContent="";
        mobileInput.value="";
        destroy(targetMonster);
      }
    }else{
      inputPreview.textContent=(inputBuffer + ch).toUpperCase();
      statusEl.textContent="NO MATCH // TYPE A VISIBLE WORD";
      statusEl.classList.remove("active");
      gameArea.animate([{filter:"brightness(1)"},{filter:"brightness(1.35)"},{filter:"brightness(1)"}],{duration:100});
    }
    return;
  }

  if(!selected)bestTarget();
  if(!selected)return;

  if(ch===selected.word[selected.typed.length]){
    tone(420,.035,"square",.012);
    selected.typed+=ch;
    inputBuffer=selected.typed;
    render(selected);
    if(selected.typed.length===selected.word.length){
      inputBuffer="";
      mobileInput.value="";
      destroy(selected);
    }
  }else{
    selected.el.classList.remove("hit");void selected.el.offsetWidth;selected.el.classList.add("hit");
  }
}

const rnd=(a,b)=>Math.random()*(b-a)+a;
const W=()=>gameArea.clientWidth,H=()=>gameArea.clientHeight;

function hud(){
 scoreEl.textContent=score.toLocaleString();
 bestScoreEl.textContent=bestScore.toLocaleString();
 const comboMultiplier = combo > 0 ? (1 + combo * 0.25).toFixed(1) : "1.0";
 comboEl.textContent = `x${comboMultiplier}`;
 waveEl.textContent=wave;
 hpEl.textContent="♥".repeat(hp)+"♡".repeat(5-hp);
 hpEl.style.color=hp<=2?"#ff3b81":hp<=3?"#ffe600":"#39ff88";
 updatePowerButtons();
}

function chooseType(){
 const r=Math.random(),bossChance=Math.min(.12+wave*.015,.25);
 const specialChance=wave>=2?Math.min(.025+(wave-2)*.008,.07):.012;
 if(r<specialChance)return "special";
 return r<specialChance+bossChance?"boss":r<specialChance+bossChance+.35?"soldier":"scout";
}

function createMonster(){
 if(!running)return;
 const type=chooseType(),cfg=types[type],word=words[type][Math.floor(Math.random()*words[type].length)];
 const el=document.createElement("div");el.className=`monster ${type}`;
 const wordEl=document.createElement("div");wordEl.className="word";
 const body=document.createElement("div");body.className="monster-body";body.textContent=type==="scout"?"!":type==="soldier"?"◆":type==="boss"?"☠":"✦";
 const health=document.createElement("div");health.className="health";
 const fill=document.createElement("div");fill.className="health-fill";health.appendChild(fill);
 el.append(wordEl,body,health);
 const difficultyBoost = 1 + (wave - 1) * 0.18 + Math.min(monsters.length * 0.05, 1.1);
 const m={id:++id,type,word,typed:"",x:rnd(80,Math.max(90,W()-80)),y:-100,speed:(cfg.speed+wave*.35)*difficultyBoost,hp:cfg.hp,maxHp:cfg.hp,el,wordEl,fill};
 el.style.left=m.x+"px";el.style.top=m.y+"px";gameArea.appendChild(el);monsters.push(m);render(m);
 if(targetingMode==="auto"&&!selected)bestTarget();
}

function render(m){
 if(!m.el.isConnected)return;
 m.wordEl.innerHTML=`<span class="typed">${m.typed}</span><span class="remaining">${m.word.slice(m.typed.length)}</span>`;
 m.fill.style.width=(m.hp/m.maxHp*100)+"%";
 m.el.style.left=m.x+"px";m.el.style.top=m.y+"px";
}

function select(m){
 if(!m||!monsters.includes(m))return;
 if(selected)selected.el.classList.remove("targeted");
 selected=m;m.el.classList.add("targeted");
 target.style.left=m.x+"px";target.style.top=(m.y+35)+"px";target.style.opacity=1;
 inputPreview.textContent=inputBuffer.toUpperCase();
 statusEl.textContent=`TARGET // ${m.word.toUpperCase()}`;statusEl.classList.add("active");
}

function clearTarget(){
 if(selected)selected.el.classList.remove("targeted");
 selected=null;target.style.opacity=0;
}

function bestTarget(){
 if(!monsters.length){clearTarget();statusEl.textContent="WAITING FOR TARGETS";statusEl.classList.remove("active");return}
 select(monsters.reduce((a,b)=>a.y>b.y?a:b));
}

function findManualTarget(buffer){
 if(!buffer)return null;
 const matches=monsters.filter(m=>m.word.startsWith(buffer));
 if(!matches.length)return null;
 return matches.reduce((a,b)=>a.y>b.y?a:b);
}

document.addEventListener("keydown",e=>{
 if(!running||e.ctrlKey||e.altKey||e.metaKey)return;
 const powerHotkeys={"1":"slow","2":"shield","3":"burst","F1":"slow","F2":"shield","F3":"burst"};
 if(powerHotkeys[e.key]){
   e.preventDefault();
   activatePower(powerHotkeys[e.key]);
   return;
 }
 if(e.key==="Backspace"){
   handleBackspace();
   return;
 }
 if(!/^[a-zA-Z]$/.test(e.key))return;
 handleCharacterInput(e.key.toLowerCase());
});

function getComboMultiplier(){
  return combo > 0 ? 1 + combo * 0.25 : 1;
}

function registerKill(baseGain,m){
  const now=performance.now();
  if(now-lastKillTime<2200) combo += 1; else combo = 1;
  lastKillTime=now;
  comboTimer=2.4;
  const multiplier=getComboMultiplier();
  const gained=Math.round(baseGain * multiplier);
  score += gained;
  if(combo > 1){
    popup(m.x,m.y,`COMBO x${multiplier.toFixed(1)}`);
  }
  hud();
  return gained;
}

function destroy(m){
 if(!monsters.includes(m))return;
 tone(m.type==="boss"?180:260,.12,"sawtooth",.035);
 const baseGain=m.word.length*15+types[m.type].score+wave*5;
 const gained=registerKill(baseGain,m);
 laser(m);
 explode(m.x,m.y+35);
 popup(m.x,m.y,`+${gained}`);

 if(m.type==="special") {
   specialBlast(m);
 }

 m.el.remove();
 monsters=monsters.filter(x=>x!==m);
 if(selected===m){clearTarget();if(targetingMode==="auto")bestTarget()}
 inputBuffer="";inputPreview.textContent="";
 hud();
}

function specialBlast(source){
 const radius=190;
 const ring=document.createElement("div");
 ring.className="blast-ring";
 ring.style.left=source.x+"px";
 ring.style.top=(source.y+35)+"px";
 gameArea.appendChild(ring);
 ring.animate([
   {width:"20px",height:"20px",opacity:1},
   {width:(radius*2)+"px",height:(radius*2)+"px",opacity:.85},
   {width:(radius*2+45)+"px",height:(radius*2+45)+"px",opacity:0}
 ],{duration:650,easing:"ease-out"}).onfinish=()=>ring.remove();

 const label=document.createElement("div");
 label.className="blast-label";
 label.textContent="AREA BLAST";
 label.style.left=source.x+"px";
 label.style.top=(source.y-12)+"px";
 gameArea.appendChild(label);
 setTimeout(()=>label.remove(),850);

 const nearby=[...monsters].filter(other=>{
   if(other===source)return false;
   return Math.hypot(other.x-source.x,(other.y+35)-(source.y+35))<=radius;
 });

 for(const enemy of nearby){
   const bonus=enemy.word.length*8+wave*2;
   score+=bonus;
   explode(enemy.x,enemy.y+35);
   popup(enemy.x,enemy.y,`+${bonus}`);
   enemy.el.remove();
 }

 monsters=monsters.filter(enemy=>!nearby.includes(enemy));
}
function laser(m){
 tone(740,.09,"sawtooth",.025);
 const x=W()/2,y=H()-60,tx=m.x,ty=m.y+35,dx=tx-x,dy=ty-y;
 const line=document.createElement("div"),dist=Math.hypot(dx,dy);
 line.className="laser";line.style.left=x+"px";line.style.top=y+"px";line.style.width=dist+"px";line.style.transform=`rotate(${Math.atan2(dy,dx)*180/Math.PI}deg)`;
 gameArea.appendChild(line);setTimeout(()=>line.remove(),200);
}

function explode(x,y){
 for(let i=0;i<18;i++){
  const p=document.createElement("div");p.className="particle";p.style.left=x+"px";p.style.top=y+"px";gameArea.appendChild(p);
  const a=Math.random()*Math.PI*2,s=rnd(40,130),dx=Math.cos(a)*s,dy=Math.sin(a)*s;
  p.animate([{transform:"translate(-50%,-50%) scale(1)",opacity:1},{transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(0)`,opacity:0}],{duration:rnd(400,750),easing:"ease-out"}).onfinish=()=>p.remove();
 }
}

function popup(x,y,text){
 const p=document.createElement("div");p.className="popup";p.textContent=text;p.style.left=x+"px";p.style.top=y+"px";gameArea.appendChild(p);setTimeout(()=>p.remove(),850);
}

function reached(m){
 if(!monsters.includes(m))return;
 let damage = 1;
 if (shieldCharges > 0) {
   shieldCharges--; damage = 0; tone(180,.16,"triangle",.035); popup(m.x,m.y,"BLOCKED");
   statusEl.textContent = "SHIELD ABSORBED THE HIT";
 }
 if (damage > 0) {
   tone(82,.28,"sawtooth",.06);
   hp--;hud();castle.classList.remove("hit");void castle.offsetWidth;castle.classList.add("hit");explode(W()/2,H()-60);
 }
 m.el.remove();monsters=monsters.filter(x=>x!==m);
 if(selected===m){clearTarget();if(targetingMode==="auto")bestTarget()}
 if(hp<=0)endGame();
}

function waveUpdate(dt){
 waveTime+=dt;
 comboTimer = Math.max(0, comboTimer - dt);
 if(comboTimer === 0 && combo > 0){ combo = 0; }
 if(waveTime>=20000){waveTime=0;wave++;spawnInterval=Math.max(620,1400-(wave-1)*60);hud();announceWave()}

 for (const key of Object.keys(powerTimers)) {
   powerTimers[key] = Math.max(0, powerTimers[key] - dt);
   powerCooldowns[key] = Math.max(0, (powerReadyAt[key] - performance.now()) / 1000);
   if (powerTimers[key] === 0 && key === "slow") {
     statusEl.textContent = "SLOW MODE EXPIRED";
   }
 }
 if (powerTimers.shield === 0) shieldCharges = 0;
 hud();
}

function announceWave(){
 const n=document.createElement("div");n.textContent=`WAVE ${wave}`;
 n.style.cssText="position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);z-index:30;color:#00f5ff;font-size:44px;font-weight:bold;text-shadow:0 0 12px #00f5ff,0 0 35px #00f5ff;pointer-events:none";
 gameArea.appendChild(n);
 n.animate([{opacity:0,transform:"translate(-50%,-50%) scale(.6)"},{opacity:1,transform:"translate(-50%,-50%) scale(1)"},{opacity:0,transform:"translate(-50%,-50%) scale(1.25)"}],{duration:1200}).onfinish=()=>n.remove();
}

function loop(t){
 if(!running)return;
 if(!last)last=t;
 const dt=Math.min((t-last)/1000,.05);last=t;spawn+=dt*1000;
 const slowFactor = powerTimers.slow > 0 ? 0.58 : 1;
 const dynamicSpawn = Math.max(520, spawnInterval - wave * 18 - Math.min(score / 180, 180));
 if(spawn>=dynamicSpawn){
  spawn=0;createMonster();
  if(wave>=3&&Math.random()<0.12+wave*0.02) setTimeout(()=>running&&createMonster(),180);
 }
 for(const m of [...monsters]){
  m.y += m.speed * dt * slowFactor;
  render(m);
  if(m.y>=H()-105)reached(m);
 }
 if(selected&&monsters.includes(selected)){
  target.style.left=selected.x+"px";target.style.top=(selected.y+35)+"px";
 }else if(targetingMode==="auto"&&monsters.length)bestTarget();
 waveUpdate(dt);raf=requestAnimationFrame(loop);
}

function updatePowerButtons(){
  powerButtons.forEach(button => {
    const key = button.dataset.power;
    const active = powerTimers[key] > 0;
    const cooldown = performance.now() < powerReadyAt[key];
    button.classList.toggle("ready", !cooldown && !active);
    button.classList.toggle("cooldown", cooldown || active);
    button.disabled = cooldown || active;
    const hotkey=button.dataset.hotkey;
    button.textContent = active ? `${hotkey} ${key.toUpperCase()} ON` : cooldown ? `${hotkey} ${powerCooldowns[key].toFixed(1)}s` : `${hotkey} ${key.toUpperCase()}`;
  });
}

function activatePower(power){
  if (!running) return;
  if (performance.now() < powerReadyAt[power] || powerTimers[power] > 0) return;
  if (power === "slow") {
    tone(220,.18,"triangle",.04);
    powerTimers.slow = 4.8;
    powerCooldowns.slow = 12;
    powerReadyAt.slow = performance.now() + 12000;
    statusEl.textContent = "SLOW MODE // ENEMY SPEED CUT";
  }
  if (power === "shield") {
    tone(330,.18,"triangle",.04);
    powerTimers.shield = 6;
    powerCooldowns.shield = 15;
    powerReadyAt.shield = performance.now() + 15000;
    shieldCharges = 2;
    statusEl.textContent = "SHIELD UP // 2 BLOCKS READY";
  }
  if (power === "burst") {
    tone(90,.28,"sawtooth",.05);
    powerTimers.burst = 1.2;
    powerCooldowns.burst = 18;
    powerReadyAt.burst = performance.now() + 18000;
    const chain = monsters.slice();
    chain.forEach(enemy => {
      if (enemy && enemy.el && enemy.el.isConnected) {
        score += Math.round((enemy.word.length * 18) + wave * 6);
        enemy.el.remove();
        explode(enemy.x, enemy.y + 35);
      }
    });
    monsters = [];
    selected = null;
    inputBuffer = "";
    inputPreview.textContent = "";
    statusEl.textContent = "BURST // FIELD CLEARED";
    hud();
  }
  hud();
}

powerButtons.forEach(button => {
  button.addEventListener("click", () => activatePower(button.dataset.power));
});

function start(){
 if(desktopOnly)return;
 startAudio();
 score=0;hp=5;wave=1;monsters=[];selected=null;id=0;last=0;spawn=0;waveTime=0;spawnInterval=1400;inputBuffer="";combo=0;comboTimer=0;lastKillTime=0;bestCombo=0;powerCooldowns={ slow:0, shield:0, burst:0 };powerReadyAt={ slow:0, shield:0, burst:0 };powerTimers={ slow:0, shield:0, burst:0 };shieldCharges=0;hud();
 gameArea.querySelectorAll(".monster,.laser,.particle,.popup").forEach(x=>x.remove());
 startScreen.classList.add("hidden");gameOverScreen.classList.add("hidden");running=true;
 inputPreview.textContent="";
 statusEl.textContent=targetingMode==="manual"?"TYPE ANY VISIBLE WORD TO TARGET IT":"AUTO TARGET ENABLED // TYPE THE HIGHLIGHTED WORD";
 statusEl.classList.add("active");
 syncMobileKeyboard();
 setTimeout(()=>running&&createMonster(),500);raf=requestAnimationFrame(loop);
}

function endGame(){
 running=false;cancelAnimationFrame(raf);clearTarget();inputBuffer="";inputPreview.textContent="";
 tone(196,.18,"square",.04);
 setTimeout(()=>tone(146.83,.22,"square",.035),150);
 setTimeout(()=>tone(110,.4,"triangle",.03),330);
 const endedAudio=audioContext;
 setTimeout(()=>{if(audioContext===endedAudio)stopAudio()},850);
 bestScore = Math.max(bestScore, score);
 bestCombo = Math.max(bestCombo, combo);
 syncMobileKeyboard();
 statusEl.textContent="SYSTEM OFFLINE";finalScore.textContent=score.toLocaleString();gameOverScreen.classList.remove("hidden");
 hud();
}

document.querySelectorAll(".mode").forEach(btn=>{
 btn.addEventListener("click",()=>{
  document.querySelectorAll(".mode").forEach(x=>x.classList.remove("selected"));
  btn.classList.add("selected");targetingMode=btn.dataset.mode;
 });
});

document.getElementById("startButton").onclick=start;
document.getElementById("restartButton").onclick=start;

gameArea.addEventListener("click",e=>{
 if(!running||targetingMode!=="manual")return;
 const el=e.target.closest(".monster");if(!el)return;
 const m=monsters.find(x=>x.el===el);
 if(m){inputBuffer=m.typed;select(m);inputPreview.textContent=inputBuffer.toUpperCase()}
});

window.addEventListener("resize",()=>{
 for(const m of monsters){m.x=Math.max(70,Math.min(W()-70,m.x));render(m)}
 syncMobileKeyboard();
});

buildMobileKeyboard();
syncMobileKeyboard();
hud();
