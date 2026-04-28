// ============================================================
//  BATTLEFIELD — game.js  (Full rewrite)
//  • 3 villain phases / waves
//  • Hero & villain portrait images  (images/*.png)
//  • Status effects: Burn, Freeze, Stun
//  • Combo counter + critical hits
//  • Phase-transition cinematic screen
//  • Battle animations & skill flash effects
//  BGM credit: Eric Matyas — www.soundimage.org
// ============================================================
"use strict";

// ═══════════════════════════════════════════════════════════
//  SETTINGS  (from localStorage via settings.js)
// ═══════════════════════════════════════════════════════════

const SETTING_DEFAULTS = {
  musicVol:70, sfxVol:85, muteAll:false,
  difficulty:"Normal", showDmg:true, screenShake:true,
};
function loadCFG() {
  try { const s=JSON.parse(localStorage.getItem("bf_settings")); return s?{...SETTING_DEFAULTS,...s}:{...SETTING_DEFAULTS}; }
  catch { return {...SETTING_DEFAULTS}; }
}
let CFG = loadCFG();


// ═══════════════════════════════════════════════════════════
//  AUDIO ENGINE
// ═══════════════════════════════════════════════════════════

const Audio = (() => {
  let ctx=null, bgmEl=null;
  const sfxV = () => CFG.muteAll ? 0 : CFG.sfxVol/100;
  const bgmV = () => CFG.muteAll ? 0 : CFG.musicVol/100;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext||window.webkitAudioContext)();
    if (ctx.state==="suspended") ctx.resume();
    return ctx;
  }
  function osc(type,freq,gain,t0,t1,ac) {
    const o=ac.createOscillator(), g=ac.createGain();
    o.type=type; o.frequency.setValueAtTime(freq,t0);
    g.gain.setValueAtTime(gain*sfxV(),t0);
    g.gain.exponentialRampToValueAtTime(0.001,t1);
    o.connect(g).connect(ac.destination); o.start(t0); o.stop(t1);
  }
  function slide(type,f0,f1,gain,t0,t1,ac) {
    const o=ac.createOscillator(), g=ac.createGain();
    o.type=type; o.frequency.setValueAtTime(f0,t0);
    o.frequency.exponentialRampToValueAtTime(f1,t1);
    g.gain.setValueAtTime(gain*sfxV(),t0);
    g.gain.exponentialRampToValueAtTime(0.001,t1);
    o.connect(g).connect(ac.destination); o.start(t0); o.stop(t1);
  }
  function noise(gain,t0,t1,ac) {
    const len=Math.ceil(ac.sampleRate*(t1-t0)), buf=ac.createBuffer(1,len,ac.sampleRate);
    const d=buf.getChannelData(0); for(let i=0;i<len;i++) d[i]=Math.random()*2-1;
    const src=ac.createBufferSource(); src.buffer=buf;
    const g=ac.createGain(); g.gain.setValueAtTime(gain*sfxV(),t0);
    g.gain.exponentialRampToValueAtTime(0.001,t1);
    src.connect(g).connect(ac.destination); src.start(t0);
  }

  const SFX = {
    attack()     { const ac=getCtx(),t=ac.currentTime; osc("sawtooth",340,0.4,t,t+.06,ac); osc("square",170,.25,t+.03,t+.16,ac); slide("sine",500,120,.3,t,t+.2,ac); noise(.2,t,t+.1,ac); },
    skill1()     { const ac=getCtx(),t=ac.currentTime; noise(.3,t,t+.22,ac); osc("sawtooth",240,.45,t,t+.22,ac); osc("square",480,.3,t+.04,t+.28,ac); slide("sine",180,60,.55,t+.15,t+.5,ac); },
    skill2()     { const ac=getCtx(),t=ac.currentTime; noise(.35,t,t+.55,ac); [70,90,120,155].forEach((f,i)=>osc("sawtooth",f,.32,t+i*.04,t+.5+i*.05,ac)); slide("sine",90,30,.65,t+.05,t+.65,ac); },
    heal()       { const ac=getCtx(),t=ac.currentTime; [523,659,784,1047,1319].forEach((f,i)=>{ osc("sine",f,.32,t+i*.08,t+i*.08+.28,ac); osc("triangle",f*2,.08,t+i*.08,t+i*.08+.18,ac); }); },
    enemyHit()   { const ac=getCtx(),t=ac.currentTime; slide("sine",110,45,.6,t,t+.2,ac); osc("square",200,.18,t,t+.08,ac); noise(.22,t,t+.14,ac); },
    death()      { const ac=getCtx(),t=ac.currentTime; slide("sawtooth",320,35,.5,t,t+.65,ac); noise(.18,t,t+.5,ac); osc("sine",60,.4,t+.1,t+.7,ac); },
    crit()       { const ac=getCtx(),t=ac.currentTime; slide("sawtooth",800,200,.6,t,t+.3,ac); noise(.4,t,t+.15,ac); osc("square",1600,.3,t,t+.08,ac); },
    combo()      { const ac=getCtx(),t=ac.currentTime; [660,880,1100].forEach((f,i)=>osc("sine",f,.25,t+i*.07,t+i*.07+.12,ac)); },
    burn()       { const ac=getCtx(),t=ac.currentTime; [200,300,400].forEach((f,i)=>{ osc("sawtooth",f,.2,t+i*.05,t+i*.05+.12,ac); }); noise(.15,t,t+.25,ac); },
    freeze()     { const ac=getCtx(),t=ac.currentTime; [1000,800,600].forEach((f,i)=>osc("triangle",f,.25,t+i*.06,t+i*.06+.14,ac)); },
    stun()       { const ac=getCtx(),t=ac.currentTime; slide("square",400,200,.3,t,t+.3,ac); noise(.1,t,t+.2,ac); },
    xpGain()     { const ac=getCtx(),t=ac.currentTime; osc("sine",880,.22,t,t+.09,ac); osc("sine",1320,.22,t+.08,t+.2,ac); },
    btnClick()   { const ac=getCtx(),t=ac.currentTime; osc("square",700,.14,t,t+.05,ac); },
    phaseChange(){ const ac=getCtx(),t=ac.currentTime; [200,160,120,100].forEach((f,i)=>osc("sawtooth",f,.35,t+i*.1,t+i*.1+.25,ac)); noise(.2,t,t+.5,ac); },
    victory()    { const ac=getCtx(),t=ac.currentTime; [523,659,784,1047,1319].forEach((f,i)=>{ osc("square",f,.3,t+i*.11,t+i*.11+.28,ac); osc("sine",f/2,.18,t+i*.11,t+i*.11+.35,ac); }); },
    defeat()     { const ac=getCtx(),t=ac.currentTime; [440,392,349,294,220].forEach((f,i)=>{ osc("sine",f,.38,t+i*.16,t+i*.16+.32,ac); osc("triangle",f/2,.18,t+i*.16,t+i*.16+.42,ac); }); },
  };

  const BGM = {
    battle:  "https://soundimage.org/wp-content/uploads/2016/07/Fantasy-Forest-Battle.mp3",
    phase2:  "https://soundimage.org/wp-content/uploads/2016/07/Battle-Taiko-Drums.mp3",
    phase3:  "https://soundimage.org/wp-content/uploads/2016/09/Epic-Boss-Battle.mp3",
    victory: "https://soundimage.org/wp-content/uploads/2020/06/Comrades-Always.mp3",
  };
  function startBGM(key="battle") {
    if (!bgmEl) { bgmEl=document.createElement("audio"); bgmEl.loop=true; document.body.appendChild(bgmEl); }
    bgmEl.pause(); bgmEl.volume=bgmV(); bgmEl.src=BGM[key]||BGM.battle; bgmEl.load(); bgmEl.play().catch(()=>{});
  }
  function stopBGM()       { if(bgmEl){ bgmEl.pause(); bgmEl.src=""; } }
  function syncBGMVolume() { if(bgmEl) bgmEl.volume=bgmV(); }
  return { SFX, startBGM, stopBGM, syncBGMVolume };
})();


// ═══════════════════════════════════════════════════════════
//  DIFFICULTY SCALING
// ═══════════════════════════════════════════════════════════

const DIFF = { Easy:{hp:.7,dmg:.7}, Normal:{hp:1,dmg:1}, Hard:{hp:1.4,dmg:1.4} };
const scale = () => DIFF[CFG.difficulty]||DIFF.Normal;


// ═══════════════════════════════════════════════════════════
//  GAME DATA
// ═══════════════════════════════════════════════════════════

// Status effect definitions
const STATUS = {
  burn:   { icon:"🔥", label:"Burn",   color:"#f74f4f", turns:3, dmgPerTurn:12 },
  freeze: { icon:"❄",  label:"Freeze", color:"#4ff7f7", turns:2 },
  stun:   { icon:"⚡",  label:"Stun",   color:"#f7e24f", turns:1 },
};

const HEROES = [
  {
    id:"samkaith", name:"Samkaith", cls:"MP1", maxHp:320, color:"#e84040",
    img:"img/samkaith.png",
    skills:[
      { name:"Strike",        xpCost:0, dmg:[28,42], heal:0,  aoe:false, healTarget:"self", desc:"Sharp basic slash",           sfx:"attack", status:null },
      { name:"Inferno Slash", xpCost:2, dmg:[55,80], heal:0,  aoe:false, healTarget:"self", desc:"Burn chance 60%",             sfx:"skill1", status:{type:"burn",  chance:.6} },
      { name:"Quake Bash",    xpCost:3, dmg:[40,55], heal:0,  aoe:true,  healTarget:"self", desc:"AOE — stun chance 40%",       sfx:"skill2", status:{type:"stun",  chance:.4} },
      { name:"War Cry",       xpCost:2, dmg:[0,0],   heal:55, aoe:false, healTarget:"ally", desc:"Rallies a wounded ally",      sfx:"heal",   status:null },
    ]
  },
  {
    id:"dummling", name:"Dummling", cls:"MP2", maxHp:270, color:"#3a9be8",
    img:"img/dummling.png",
    skills:[
      { name:"Ice Shard",   xpCost:0, dmg:[22,36], heal:0,  aoe:false, healTarget:"self", desc:"Cold basic shot",              sfx:"attack", status:null },
      { name:"Frost Bolt",  xpCost:2, dmg:[50,70], heal:0,  aoe:false, healTarget:"self", desc:"Freeze chance 55%",            sfx:"skill1", status:{type:"freeze",chance:.55} },
      { name:"Blizzard",    xpCost:3, dmg:[35,50], heal:0,  aoe:true,  healTarget:"self", desc:"AOE — freeze all 35%",         sfx:"skill2", status:{type:"freeze",chance:.35} },
      { name:"Mend",        xpCost:2, dmg:[0,0],   heal:55, aoe:false, healTarget:"self", desc:"Restore own HP",               sfx:"heal",   status:null },
    ]
  },
  {
    id:"genji", name:"Genji", cls:"MP3", maxHp:300, color:"#4ecb6e",
    img:"img/genji.png",
    skills:[
      { name:"Vine Lash",    xpCost:0, dmg:[25,40], heal:0,  aoe:false, healTarget:"self", desc:"Tangling whip strike",        sfx:"attack", status:null },
      { name:"Thorn Strike", xpCost:2, dmg:[52,75], heal:0,  aoe:false, healTarget:"self", desc:"Burn chance 50%",             sfx:"skill1", status:{type:"burn",  chance:.5} },
      { name:"Thorn Burst",  xpCost:3, dmg:[38,54], heal:0,  aoe:true,  healTarget:"self", desc:"AOE — burn all 40%",          sfx:"skill2", status:{type:"burn",  chance:.4} },
      { name:"Rejuvenate",   xpCost:2, dmg:[0,0],   heal:60, aoe:false, healTarget:"ally", desc:"Heals an ally",               sfx:"heal",   status:null },
    ]
  },
  {
    id:"kk", name:"KK", cls:"MP4", maxHp:290, color:"#f0c040",
    img:"img/kk.png",
    skills:[
      { name:"Thunder Jab",  xpCost:0, dmg:[26,38], heal:0,  aoe:false, healTarget:"self", desc:"Quick electric jab",         sfx:"attack", status:null },
      { name:"Thunder Fist", xpCost:2, dmg:[53,78], heal:0,  aoe:false, healTarget:"self", desc:"Stun chance 50%",             sfx:"skill1", status:{type:"stun",  chance:.5} },
      { name:"Storm Surge",  xpCost:3, dmg:[42,58], heal:0,  aoe:true,  healTarget:"self", desc:"AOE — stun all 30%",          sfx:"skill2", status:{type:"stun",  chance:.3} },
      { name:"Iron Will",    xpCost:2, dmg:[0,0],   heal:45, aoe:false, healTarget:"self", desc:"Fortifies own body",          sfx:"heal",   status:null },
    ]
  },
];

// 3 Villain phases — each wave escalates
const VILLAIN_WAVES = [
  // Phase 1 — The Scouts
  {
    phase:1, title:"CHAPTER I", subtitle:"The Villains Arrive",
    bgmKey:"battle",
    enemies:[
      { id:"rex",      name:"Rex",      cls:"Villain",    baseHp:240, baseDmgMin:20, baseDmgMax:38, letter:"R", color:"#cc5566", img:"images/rex.png",      statusChance:.20, statusPool:["burn"] },
      { id:"dokoku",   name:"Dokoku",   cls:"Villain",    baseHp:240, baseDmgMin:22, baseDmgMax:40, letter:"D", color:"#cc5566", img:"images/dokoku.png",   statusChance:.20, statusPool:["stun"] },
      { id:"sonoshi",  name:"Sonoshi",  cls:"Villain",    baseHp:240, baseDmgMin:18, baseDmgMax:35, letter:"S", color:"#cc5566", img:"images/sonoshi.png",  statusChance:.15, statusPool:["burn","freeze"] },
      { id:"radiguet", name:"Radiguet", cls:"Villain",    baseHp:260, baseDmgMin:25, baseDmgMax:45, letter:"R", color:"#cc5566", img:"images/radiguet.png", statusChance:.25, statusPool:["freeze"] },
    ]
  },
  // Phase 2 — The Elites
  {
    phase:2, title:"CHAPTER II", subtitle:"The Elites Strike Back",
    bgmKey:"phase2",
    enemies:[
      { id:"darkblade", name:"Darkblade", cls:"Elite",      baseHp:320, baseDmgMin:30, baseDmgMax:52, letter:"D", color:"#c060ff", img:"images/darkblade.png", statusChance:.30, statusPool:["burn","stun"] },
      { id:"vexor",     name:"Vexor",     cls:"Elite",      baseHp:300, baseDmgMin:28, baseDmgMax:50, letter:"V", color:"#c060ff", img:"images/vexor.png",     statusChance:.30, statusPool:["freeze"] },
      { id:"krael",     name:"Krael",     cls:"Elite",      baseHp:340, baseDmgMin:32, baseDmgMax:55, letter:"K", color:"#c060ff", img:"images/krael.png",     statusChance:.25, statusPool:["burn","freeze","stun"] },
    ]
  },
  // Phase 3 — The Overlord
  {
    phase:3, title:"CHAPTER III", subtitle:"The Overlord Awakens",
    bgmKey:"phase3",
    enemies:[
      { id:"sentinel",  name:"Sentinel",  cls:"Warlord",    baseHp:380, baseDmgMin:35, baseDmgMax:58, letter:"S", color:"#ff6030", img:"images/sentinel.png",  statusChance:.35, statusPool:["burn","stun"] },
      { id:"necrovex",  name:"Necrovex",  cls:"Warlord",    baseHp:400, baseDmgMin:38, baseDmgMax:62, letter:"N", color:"#ff6030", img:"images/necrovex.png",  statusChance:.35, statusPool:["freeze","stun"] },
      { id:"overlord",  name:"Overlord",  cls:"★ BOSS ★",   baseHp:600, baseDmgMin:48, baseDmgMax:80, letter:"Ω", color:"#ffd700", img:"images/overlord.png",  statusChance:.45, statusPool:["burn","freeze","stun"] },
    ]
  },
];

function buildEnemies(waveIdx) {
  const { hp, dmg } = scale();
  return VILLAIN_WAVES[waveIdx].enemies.map(e => ({
    ...e,
    maxHp:  Math.round(e.baseHp      * hp),
    minDmg: Math.round(e.baseDmgMin  * dmg),
    maxDmg: Math.round(e.baseDmgMax  * dmg),
    hp:     Math.round(e.baseHp      * hp),
    alive:  true,
    status: null,   // current status effect object or null
    statusTurns: 0,
  }));
}


// ═══════════════════════════════════════════════════════════
//  GAME STATE
// ═══════════════════════════════════════════════════════════

const state = {
  heroes:[], enemies:[],
  heroIndex:0,
  phase:"hero",        // "hero"|"enemy"|"target"|"heal-target"|"cinematic"|"over"
  pendingSkill:null,
  xp:[0,0,0,0],
  maxXp:6,
  audioStarted:false,
  waveIndex:0,         // 0=phase1, 1=phase2, 2=phase3
  combo:0,             // consecutive hero hits without taking damage
  lastHitWasHero:false,
   totalDmgDealt: 0,
  totalDmgTaken: 0,
  totalCrits:    0,
};


// ═══════════════════════════════════════════════════════════
//  SETTINGS GEAR ICON
// ═══════════════════════════════════════════════════════════

function injectSettingsIcon() {
  if (document.getElementById("settings-icon-btn")) return;
  const btn = document.createElement("a");
  btn.id="settings-icon-btn"; btn.href="settings.html"; btn.title="Settings";
  btn.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
  Object.assign(btn.style,{position:"fixed",top:"14px",right:"16px",zIndex:"700",color:"var(--text-dim)",display:"flex",alignItems:"center",justifyContent:"center",width:"38px",height:"38px",background:"rgba(6,11,20,0.8)",border:"1px solid var(--border)",borderRadius:"8px",backdropFilter:"blur(8px)",textDecoration:"none",transition:"color .2s,border-color .2s,box-shadow .2s"});
  btn.onmouseenter=()=>{ btn.style.color="var(--gold)"; btn.style.borderColor="var(--gold)"; btn.style.boxShadow="0 0 12px rgba(200,168,75,0.35)"; };
  btn.onmouseleave=()=>{ btn.style.color="var(--text-dim)"; btn.style.borderColor="var(--border)"; btn.style.boxShadow=""; };
  document.body.appendChild(btn);
}


// ═══════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════

function init() {
  CFG = loadCFG();
  Audio.syncBGMVolume();

  state.heroes     = HEROES.map(h => ({ ...h, hp:h.maxHp, alive:true, status:null, statusTurns:0 }));
  state.waveIndex  = 0;
  state.enemies    = buildEnemies(0);
  state.heroIndex  = 0;
  state.phase      = "hero";
  state.xp         = [0,0,0,0];
  state.audioStarted = false;
  state.combo      = 0;

  buildHeroCards();
  buildEnemyCards();
  buildXpPanel();
  buildComboDisplay();
  injectSettingsIcon();
  updateChapterDisplay();
  refreshSkillBar();
  setTurnIndicator(`${state.heroes[0].name}'s Turn`);
  logLine(`⚔ Chapter I begins! [${CFG.difficulty}]`);
  highlightActiveHero();
}

function ensureAudio() {
  if (!state.audioStarted) {
    state.audioStarted = true;
    Audio.startBGM(VILLAIN_WAVES[state.waveIndex].bgmKey);
  }
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) { CFG=loadCFG(); Audio.syncBGMVolume(); }
});


// ═══════════════════════════════════════════════════════════
//  DOM BUILDERS
// ═══════════════════════════════════════════════════════════

function buildHeroCards() {
  const col = document.getElementById("hero-team");
  col.innerHTML = "";
  state.heroes.forEach((h, i) => {
    const card = document.createElement("div");
    card.className = "static-hero-card";
    card.id = `hero-card-${i}`;
    card.style.borderColor = hexA(h.color, 0.3);
    card.style.position = "relative";
   card.innerHTML = `
  <div class="unit-info-row">
    <div class="static-portrait" id="hero-portrait-${i}" style="
      background:radial-gradient(circle at 40% 40%,${hexA(h.color,.25)},${hexA(h.color,.04)});
      border-color:${hexA(h.color,.55)};overflow:hidden;padding:5px;">
      <img src="${h.img}" alt="${h.name}"
        style="width:100%;height:100%;object-fit:cover;border-radius:4px;"
        onerror="this.style.display='none';this.parentNode.innerHTML='<span style=font-size:1.5rem;color:${h.color}>${h.name[0]}</span>'">
    </div>
        <div style="flex:1;min-width:0;">
          <div class="unit-name" style="color:${h.color}">${h.name}</div>
          <div class="unit-class">${h.cls}</div>
          <div id="hero-status-${i}" style="margin-top:3px;min-height:16px;font-size:.65rem;"></div>
        </div>
      </div>
      <div class="hp-bar-wrap">
        <div class="static-hp-bar" id="hero-hpbar-${i}"
          style="width:100%;height:100%;border-radius:4px;
          background:linear-gradient(90deg,${h.color}bb,${h.color});
          transition:width .5s cubic-bezier(.4,0,.2,1);"></div>
      </div>
      <div class="hp-text" id="hero-hptext-${i}">${h.hp} / ${h.maxHp} HP</div>`;
    col.appendChild(card);
  });
}

function buildEnemyCards() {
  const col = document.getElementById("enemy-team");
  col.innerHTML = "";
  const wave = VILLAIN_WAVES[state.waveIndex];
  state.enemies.forEach((e, i) => {
    const card = document.createElement("div");
    card.className = "static-enemy-card";
    card.id = `enemy-card-${i}`;
    card.style.cssText = `border-color:${hexA(e.color,.35)};cursor:default;position:relative;margin-left:auto;width:100%;max-width:220px;`;
    card.innerHTML = `
      <div class="unit-info-row">
        <div class="static-portrait" id="enemy-portrait-${i}" style="
          color:${e.color};border-color:${hexA(e.color,.5)};overflow:hidden;padding:0;">
          <img src="${e.img}" alt="${e.name}"
            style="width:100%;height:100%;object-fit:cover;border-radius:6px;"
            onerror="this.style.display='none';this.parentNode.innerHTML='<span style=font-size:1.5rem;font-weight:700;color:${e.color}>${e.letter}</span>'">
        </div>
        <div style="flex:1;min-width:0;">
          <div class="unit-name" style="color:${e.color}">${e.name}</div>
          <div class="unit-class" style="color:${e.color}88">${e.cls}</div>
          <div id="enemy-status-${i}" style="margin-top:3px;min-height:16px;font-size:.65rem;"></div>
        </div>
      </div>
      <div class="hp-bar-wrap">
        <div class="static-hp-bar" id="enemy-hpbar-${i}"
          style="width:100%;height:100%;border-radius:4px;
          background:linear-gradient(90deg,${e.color},${e.color}bb);
          transition:width .5s cubic-bezier(.4,0,.2,1);"></div>
      </div>
      <div class="hp-text" id="enemy-hptext-${i}">${e.hp} / ${e.maxHp} HP</div>`;
    card.addEventListener("click", () => onEnemyClick(i));
    col.appendChild(card);
  });
}

function buildXpPanel() {
  const panel = document.getElementById("xp-panel");
  panel.innerHTML = "";
  state.heroes.forEach((h, i) => {
    panel.innerHTML += `
      <div class="hero-xp-wrap">
        <div class="hero-xp-label" style="color:${h.color}">${h.name}</div>
        <div class="xp-bar-wrap"><div class="xp-bar" id="xpbar-${i}" style="width:0%"></div></div>
        <div class="xp-count" id="xpcount-${i}">0 XP</div>
      </div>`;
  });
}

function buildComboDisplay() {
  if (document.getElementById("combo-display")) return;
  const el = document.createElement("div");
  el.id = "combo-display";
  el.style.cssText = `
    position:fixed;top:14px;left:50%;transform:translateX(-50%);
    font-family:'Orbitron',sans-serif;font-size:.75rem;letter-spacing:.15em;
    color:var(--gold);background:rgba(6,11,20,.8);
    border:1px solid var(--border);border-radius:6px;
    padding:5px 14px;z-index:500;opacity:0;transition:opacity .3s;
    pointer-events:none;`;
  document.body.appendChild(el);
}

function updateChapterDisplay() {
  const wave = VILLAIN_WAVES[state.waveIndex];
  const el = document.getElementById("level-display");
  if (el) el.textContent = wave.title;
}


// ═══════════════════════════════════════════════════════════
//  SKILL BAR
// ═══════════════════════════════════════════════════════════

const ICONS = [
  '<i class="fa-solid fa-khanda"></i>',
  '<i class="bi bi-fire"></i>',
  '<i class="fa-solid fa-hand-fist"></i>',
  '<i class="fa-solid fa-heart"></i>',
];

function refreshSkillBar() {
  const hero = state.heroes[state.heroIndex];
  const xp   = state.xp[state.heroIndex];
  hero.skills.forEach((sk, i) => {
    const btn = document.getElementById(`btn${i}`);
    if (!btn) return;
    const canAfford = sk.xpCost <= xp;
    const statusTag = sk.status
      ? `<span style="font-size:.55rem;color:${STATUS[sk.status.type].color};margin-left:4px;">${STATUS[sk.status.type].icon} ${Math.round(sk.status.chance*100)}%</span>`
      : "";
    btn.innerHTML = `
      <span class="skill-icon">${ICONS[i]}</span>
      <span class="skill-name">${sk.name}${statusTag}</span>
      <span class="xp-cost">${sk.xpCost===0?"FREE":sk.xpCost+" XP"}</span>
      <span class="skill-desc">${sk.desc}</span>`;
    btn.disabled = !canAfford;
    btn.style.opacity = canAfford ? "1" : "0.45";
    btn.onclick = () => { ensureAudio(); Audio.SFX.btnClick(); onSkillClick(i); };
  });
}


// ═══════════════════════════════════════════════════════════
//  TURN FLOW
// ═══════════════════════════════════════════════════════════

function onSkillClick(skillIdx) {
  if (state.phase !== "hero") return;
  const hero  = state.heroes[state.heroIndex];
  const skill = hero.skills[skillIdx];
  if (skill.xpCost > state.xp[state.heroIndex]) return;

  // Stunned? Skip turn
  if (hero.status === "stun") {
    logLine(`⚡ ${hero.name} is stunned and cannot act!`);
    Audio.SFX.stun();
    endHeroTurn(); return;
  }

  state.xp[state.heroIndex] -= skill.xpCost;
  updateXpDisplay(state.heroIndex);
  if (Audio.SFX[skill.sfx]) Audio.SFX[skill.sfx]();

  // Flash screen
  triggerSkillFlash(skill.sfx === "heal" ? "#4ecb6e" : "#e84040");

  if (skill.heal > 0) {
    if (skill.healTarget === "self") {
      applyHeal(state.heroIndex, skill.heal);
      if (CFG.showDmg) spawnDmgFloat(`hero-card-${state.heroIndex}`, `+${skill.heal}`, "heal");
      logLine(`💚 ${hero.name} uses ${skill.name} → healed ${skill.heal} HP!`);
      endHeroTurn();
    } else {
      state.pendingSkill = skill;
      state.phase = "heal-target";
      setHint("Choose an ally to heal");
      highlightAllyTargets();
    }
    return;
  }

  state.pendingSkill = skill;

  if (skill.aoe) {
    const alive = state.enemies.filter(e => e.alive);
    let total = 0;
    alive.forEach(enemy => {
      const idx = state.enemies.indexOf(enemy);
      const { dmg, isCrit } = calcDamage(skill.dmg[0], skill.dmg[1]);
      total += dmg;
      applyDamageToEnemy(idx, dmg, isCrit);
      if (skill.status) maybeApplyStatus(enemy, skill.status.type, skill.status.chance, `enemy-status-${idx}`);
    });
    logLine(`⚡ ${hero.name} uses ${skill.name} → hits ALL for ${total} total dmg!`);
    incrementCombo();
    checkEnemyDeaths();
    if (checkVictory()) return;
    endHeroTurn(); return;
  }

  state.phase = "target";
  setHint(`Choose a target for ${skill.name}`);
  highlightEnemyTargets();
}

function onEnemyClick(idx) {
  if (state.phase !== "target") return;
  const enemy = state.enemies[idx];
  if (!enemy.alive) return;

  const hero  = state.heroes[state.heroIndex];
  const skill = state.pendingSkill;
  const { dmg, isCrit } = calcDamage(skill.dmg[0], skill.dmg[1]);

  applyDamageToEnemy(idx, dmg, isCrit);
  if (skill.status) maybeApplyStatus(enemy, skill.status.type, skill.status.chance, `enemy-status-${idx}`);
  logLine(`${isCrit?"💥 CRIT! ":"🗡"} ${hero.name} → ${enemy.name}: ${dmg}${isCrit?" (Critical!)":""}`);

  earnXp(state.heroIndex, 1);
  incrementCombo();
  clearTargetHighlights();
  clearHint();
  state.phase = "hero";
  state.pendingSkill = null;

  checkEnemyDeaths();
  if (checkVictory()) return;
  endHeroTurn();
}

function onAllyClick(idx) {
  if (state.phase !== "heal-target") return;
  const hero  = state.heroes[state.heroIndex];
  const skill = state.pendingSkill;

  applyHeal(idx, skill.heal);
  if (CFG.showDmg) spawnDmgFloat(`hero-card-${idx}`, `+${skill.heal}`, "heal");
  logLine(`💚 ${hero.name} uses ${skill.name} on ${state.heroes[idx].name} → +${skill.heal} HP!`);
  clearAllyHighlights(); clearHint();
  state.phase = "hero"; state.pendingSkill = null;
  endHeroTurn();
}

// ── Critical hit: 15% base, higher with combos ──
function calcDamage(min, max) {
  const critChance = 0.15 + Math.min(state.combo * 0.04, 0.35);
  const isCrit = Math.random() < critChance;
  const base   = rand(min, max);
  const dmg    = isCrit ? Math.round(base * 1.75) : base;
  if (isCrit) state.totalCrits++;
  return { dmg, isCrit };
}

function incrementCombo() {
  state.combo++;
  const el = document.getElementById("combo-display");
  if (!el) return;
  if (state.combo >= 2) {
    el.textContent = `🔥 ${state.combo}x COMBO!`;
    el.style.opacity = "1";
    el.style.color = state.combo >= 5 ? "#ff4444" : "var(--gold)";
    if (state.combo % 3 === 0) Audio.SFX.combo();
  }
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => { el.style.opacity = "0"; }, 1800);
}

function resetCombo() {
  state.combo = 0;
  const el = document.getElementById("combo-display");
  if (el) el.style.opacity = "0";
}

function endHeroTurn() {
  tickStatusEffects("heroes");
  if (checkDefeat()) return;

  let next = (state.heroIndex + 1) % state.heroes.length;
  let tries = 0;
  while (!state.heroes[next].alive && tries < state.heroes.length) {
    next = (next+1) % state.heroes.length; tries++;
  }
  const wrapped = next < state.heroIndex || (next===0 && state.heroIndex!==0);
  if (wrapped) { setTimeout(enemyTurn, 600); return; }
  state.heroIndex = next;
  highlightActiveHero();
  refreshSkillBar();
  setTurnIndicator(`${state.heroes[state.heroIndex].name}'s Turn`);
}

function enemyTurn() {
  setTurnIndicator("⚠ Enemy Turn");
  state.phase = "enemy";
  resetCombo();

  const alive = state.enemies.filter(e => e.alive);
  const liveH = state.heroes.filter(h => h.alive);
  if (!alive.length || !liveH.length) { startNextHeroTurn(); return; }

  let delay = 400;
  alive.forEach(enemy => {
    setTimeout(() => {
      if (state.phase !== "enemy") return;

      // Frozen enemy skips
      if (enemy.status === "freeze") {
        logLine(`${enemy.name} is frozen and cannot attack!`);
        Audio.SFX.freeze(); return;
      }

      const target = liveH[Math.floor(Math.random() * liveH.length)];
      const hi     = state.heroes.indexOf(target);
      const dmg    = rand(enemy.minDmg, enemy.maxDmg);
      applyDamageToHero(hi, dmg);
      Audio.SFX.enemyHit();
      if (CFG.showDmg)     spawnDmgFloat(`hero-card-${hi}`, `-${dmg}`, "damage");
      if (CFG.screenShake) shakeCard(`hero-card-${hi}`);
      logLine(`${enemy.name} → ${target.name}: ${dmg} dmg!`);

      // Enemy may apply status to hero
      if (Math.random() < enemy.statusChance) {
        const st = enemy.statusPool[Math.floor(Math.random()*enemy.statusPool.length)];
        maybeApplyStatus(target, st, 1.0, `hero-status-${hi}`, true);
      }
    }, delay);
    delay += 500;
  });

  setTimeout(() => {
    tickStatusEffects("enemies");
    checkEnemyDeaths();
    if (checkVictory()) return;
    checkHeroDeaths();
    if (checkDefeat()) return;
    startNextHeroTurn();
  }, delay + 200);
}

function startNextHeroTurn() {
  let first = 0;
  while (!state.heroes[first].alive && first < state.heroes.length) first++;
  state.heroIndex = first;
  state.phase = "hero";
  highlightActiveHero();
  refreshSkillBar();
  setTurnIndicator(`${state.heroes[state.heroIndex].name}'s Turn`);
}


// ═══════════════════════════════════════════════════════════
//  STATUS EFFECTS
// ═══════════════════════════════════════════════════════════

// Apply to hero (isHero=true) or enemy (isHero=false)
function maybeApplyStatus(unit, type, chance, badgeId, isHero=false) {
  if (unit.status === type) return;       // already affected
  if (Math.random() > chance) return;     // didn't proc

  unit.status = type;
  unit.statusTurns = STATUS[type].turns;

  const def = STATUS[type];
  const badge = document.getElementById(badgeId);
  if (badge) badge.innerHTML = `<span style="color:${def.color}">${def.icon} ${def.label} (${def.turns}t)</span>`;

  Audio.SFX[type] && Audio.SFX[type]();
  logLine(`${def.icon} ${unit.name} is afflicted with ${def.label}!`);
}

function tickStatusEffects(side) {
  const units  = side === "heroes" ? state.heroes : state.enemies;
  const prefix = side === "heroes" ? "hero-status" : "enemy-status";

  units.forEach((unit, i) => {
    if (!unit.status || !unit.alive) return;
    const def = STATUS[unit.status];

    // Burn deals damage each tick
    if (unit.status === "burn" && def.dmgPerTurn) {
      const dmg = def.dmgPerTurn;
      unit.hp = Math.max(0, unit.hp - dmg);
      if (side === "heroes") updateHeroBar(i);
      else                   updateEnemyBar(i);
      Audio.SFX.burn();
      if (CFG.showDmg) spawnDmgFloat(`${side==="heroes"?"hero":"enemy"}-card-${i}`, `-${dmg}🔥`, "damage");
      logLine(`🔥 ${unit.name} takes ${dmg} burn damage!`);
    }

    unit.statusTurns--;
    if (unit.statusTurns <= 0) {
      logLine(`✨ ${unit.name} recovered from ${def.label}!`);
      unit.status = null; unit.statusTurns = 0;
      const badge = document.getElementById(`${prefix}-${i}`);
      if (badge) badge.innerHTML = "";
    } else {
      const badge = document.getElementById(`${prefix}-${i}`);
      if (badge) badge.innerHTML = `<span style="color:${def.color}">${def.icon} ${def.label} (${unit.statusTurns}t)</span>`;
    }
  });
}


// ═══════════════════════════════════════════════════════════
//  PHASE TRANSITION CINEMATIC
// ═══════════════════════════════════════════════════════════

function showPhaseTransition(waveIdx, callback) {
  state.phase = "cinematic";
  Audio.SFX.phaseChange();

  const wave = VILLAIN_WAVES[waveIdx];
  const screen = document.createElement("div");
  screen.id = "phase-screen";
  screen.style.cssText = `
    position:fixed;inset:0;z-index:900;
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;
    background:rgba(6,11,20,.97);
    animation:fadeIn .4s ease;`;

  screen.innerHTML = `
    <div style="font-family:'Orbitron',sans-serif;font-size:.7rem;letter-spacing:.5em;
      color:var(--text-muted);text-transform:uppercase;margin-bottom:4px;">
      ⚠ Enemies Defeated ⚠
    </div>
    <div style="font-family:'Orbitron',sans-serif;font-size:clamp(1.8rem,5vw,3rem);
      font-weight:900;letter-spacing:.12em;
      color:${waveIdx===2?"#ffd700":"var(--hp-red)"};
      text-shadow:0 0 40px currentColor;
      animation:titlePulse 1s infinite alternate;">
      ${wave.title}
    </div>
    <div style="font-family:'Rajdhani',sans-serif;font-size:1.1rem;color:var(--text-dim);
      letter-spacing:.1em;">${wave.subtitle}</div>
    <div style="margin-top:18px;display:flex;gap:12px;flex-wrap:wrap;justify-content:center;">
      ${wave.enemies.map(e=>`
        <div style="background:rgba(${waveIdx===2?"255,96,48":"204,85,102"},.12);
          border:1px solid ${hexA(e.color,.4)};border-radius:8px;
          padding:10px 16px;text-align:center;animation:fadeUp .5s ease;">
          <div style="font-family:'Orbitron',sans-serif;font-size:1.6rem;
            color:${e.color};text-shadow:0 0 14px ${e.color};">${e.letter}</div>
          <div style="font-family:'Orbitron',sans-serif;font-size:.65rem;
            color:${e.color};letter-spacing:.1em;">${e.name}</div>
          <div style="font-size:.6rem;color:var(--text-muted)">${e.cls}</div>
        </div>`).join("")}
    </div>
    <div style="margin-top:24px;font-family:'Orbitron',sans-serif;font-size:.65rem;
      color:var(--text-muted);letter-spacing:.2em;animation:blinkAnim .7s infinite alternate;">
      PREPARE FOR BATTLE…
    </div>`;

  document.body.appendChild(screen);

  // Auto-dismiss after 3 seconds, then start the wave
  setTimeout(() => {
    screen.style.animation = "none";
    screen.style.opacity   = "0";
    screen.style.transition = "opacity .4s";
    setTimeout(() => {
      screen.remove();
      callback();
    }, 400);
  }, 3000);
}

function startNextWave() {
  state.waveIndex++;
  state.enemies = buildEnemies(state.waveIndex);
  buildEnemyCards();
  updateChapterDisplay();
  Audio.startBGM(VILLAIN_WAVES[state.waveIndex].bgmKey);
  state.phase = "hero";
  highlightActiveHero();
  refreshSkillBar();
  setTurnIndicator(`${state.heroes[state.heroIndex].name}'s Turn`);
  logLine(`⚔ ${VILLAIN_WAVES[state.waveIndex].subtitle}!`);
}


// ═══════════════════════════════════════════════════════════
//  DAMAGE / HEAL
// ═══════════════════════════════════════════════════════════

function applyDamageToEnemy(idx, dmg, isCrit=false) {
  state.enemies[idx].hp = Math.max(0, state.enemies[idx].hp - dmg);
  state.totalDmgDealt += dmg; 
  updateEnemyBar(idx);
  if (isCrit) { Audio.SFX.crit(); flashCard(`enemy-card-${idx}`, "#ffd700"); }
  else          flashCard(`enemy-card-${idx}`, "#e84040");
  if (CFG.showDmg) spawnDmgFloat(`enemy-card-${idx}`, isCrit?`💥${dmg}`:`-${dmg}`, isCrit?"crit":"damage");
}

function applyDamageToHero(idx, dmg) {
  state.heroes[idx].hp = Math.max(0, state.heroes[idx].hp - dmg);
  state.totalDmgTaken += dmg; 
  updateHeroBar(idx);
}

function applyHeal(idx, amount) {
  const h = state.heroes[idx];
  h.hp = Math.min(h.maxHp, h.hp + amount);
  updateHeroBar(idx);
  flashCard(`hero-card-${idx}`, "#4ecb6e");
}


// ═══════════════════════════════════════════════════════════
//  HP BARS
// ═══════════════════════════════════════════════════════════

function updateHeroBar(idx) {
  const h=state.heroes[idx], pct=(h.hp/h.maxHp)*100;
  const color = pct>50 ? h.color : pct>25 ? "#f0c040" : "#e84040";
  const bar=document.getElementById(`hero-hpbar-${idx}`);
  const txt=document.getElementById(`hero-hptext-${idx}`);
  if(bar){ bar.style.width=pct+"%"; bar.style.background=`linear-gradient(90deg,${color}bb,${color})`; }
  if(txt) txt.textContent=`${h.hp} / ${h.maxHp} HP`;
}

function updateEnemyBar(idx) {
  const e=state.enemies[idx], pct=(e.hp/e.maxHp)*100;
  const color = pct>50 ? e.color : pct>25 ? "#f0c040" : "#e84040";
  const bar=document.getElementById(`enemy-hpbar-${idx}`);
  const txt=document.getElementById(`enemy-hptext-${idx}`);
  if(bar){ bar.style.width=pct+"%"; bar.style.background=`linear-gradient(90deg,${color},${color}bb)`; }
  if(txt) txt.textContent=`${e.hp} / ${e.maxHp} HP`;
}


// ═══════════════════════════════════════════════════════════
//  DEATHS / WAVE CLEAR / WIN / LOSE
// ═══════════════════════════════════════════════════════════

function checkEnemyDeaths() {
  state.enemies.forEach((e, i) => {
    if (e.alive && e.hp <= 0) {
      e.alive = false;
      Audio.SFX.death();
      const card = document.getElementById(`enemy-card-${i}`);
      if (card) { card.style.opacity=".25"; card.style.filter="grayscale(1)"; card.style.pointerEvents="none"; }
      logLine(`☠ ${e.name} has been defeated!`);
    }
  });
}

function checkHeroDeaths() {
  state.heroes.forEach((h, i) => {
    if (h.alive && h.hp <= 0) {
      h.alive = false;
      Audio.SFX.death();
      const card = document.getElementById(`hero-card-${i}`);
      if (card) { card.style.opacity=".25"; card.style.filter="grayscale(1)"; }
      logLine(`💔 ${h.name} has fallen!`);
    }
  });
}

function checkVictory() {
  if (!state.enemies.every(e => !e.alive)) return false;

  // More waves remain → phase transition
  if (state.waveIndex < VILLAIN_WAVES.length - 1) {
    const nextIdx = state.waveIndex + 1;
    logLine(`✅ Phase ${state.waveIndex+1} cleared! Brace for Phase ${nextIdx+1}…`);
    showPhaseTransition(nextIdx, startNextWave);
    return true;  // pause hero turn flow during cinematic
  }

  // All 3 phases done → true victory
  state.phase = "over";
  setTurnIndicator("VICTORY!");
  logLine("All villains defeated! The heroes triumph!");
  Audio.SFX.victory();
  setTimeout(() => Audio.startBGM("victory"), 900);
  showEndOverlay("victory");
  return true;
}

// Victory section 
if (typeof window.recordBattleResult === "function") {
  window.recordBattleResult({
    dmgDealt: state.totalDmgDealt || 0,
    dmgTaken: state.totalDmgTaken || 0,
    crits:    state.totalCrits    || 0,
  });
}

function checkDefeat() {
  if (!state.heroes.every(h => !h.alive)) return false;
  state.phase = "over";
  setTurnIndicator(" DEFEAT");
  logLine(" All heroes have fallen…");
  Audio.SFX.defeat();
  Audio.stopBGM();
  showEndOverlay("defeat");
  return true;
}


// ═══════════════════════════════════════════════════════════
//  XP
// ═══════════════════════════════════════════════════════════

function earnXp(idx, amount) {
  state.xp[idx] = Math.min(state.maxXp, state.xp[idx] + amount);
  updateXpDisplay(idx);
  Audio.SFX.xpGain();
  spawnXpToast(`+${amount} XP`);
}

function updateXpDisplay(idx) {
  const pct=(state.xp[idx]/state.maxXp)*100;
  const bar=document.getElementById(`xpbar-${idx}`);
  const cnt=document.getElementById(`xpcount-${idx}`);
  if(bar) bar.style.width=pct+"%";
  if(cnt) cnt.textContent=`${state.xp[idx]} XP`;
}


// ═══════════════════════════════════════════════════════════
//  HIGHLIGHTS
// ═══════════════════════════════════════════════════════════

function highlightActiveHero() {
  state.heroes.forEach((h, i) => {
    const card=document.getElementById(`hero-card-${i}`);
    if (!card) return;
    if (i===state.heroIndex && h.alive) {
      card.style.boxShadow=`0 0 22px ${h.color}99`; card.style.borderColor=hexA(h.color,.9);
    } else {
      card.style.boxShadow=""; card.style.borderColor=hexA(h.color,.3);
    }
  });
}

function highlightEnemyTargets() {
  state.enemies.forEach((e, i) => {
    const card=document.getElementById(`enemy-card-${i}`);
    if (!card||!e.alive) return;
    card.style.cursor="crosshair";
    card.style.boxShadow="0 0 20px rgba(232,64,64,.7)";
    card.style.borderColor="rgba(232,64,64,.9)";
  });
}

function clearTargetHighlights() {
  state.enemies.forEach((e, i) => {
    const card=document.getElementById(`enemy-card-${i}`);
    if (!card) return;
    card.style.cursor="default"; card.style.boxShadow=""; card.style.borderColor=hexA(e.color,.35);
  });
}

function highlightAllyTargets() {
  state.heroes.forEach((h, i) => {
    const card=document.getElementById(`hero-card-${i}`);
    if (!card||!h.alive) return;
    card.style.cursor="crosshair";
    card.style.boxShadow="0 0 18px rgba(78,203,110,.65)";
    card.style.borderColor="rgba(78,203,110,.9)";
    card.onclick=()=>onAllyClick(i);
  });
}

function clearAllyHighlights() {
  state.heroes.forEach((h, i) => {
    const card=document.getElementById(`hero-card-${i}`);
    if (!card) return;
    card.style.cursor=""; card.style.boxShadow=""; card.style.borderColor=hexA(h.color,.3);
    card.onclick=null;
  });
  highlightActiveHero();
}


// ═══════════════════════════════════════════════════════════
//  VISUAL FX
// ═══════════════════════════════════════════════════════════

function spawnDmgFloat(cardId, text, type) {
  const card=document.getElementById(cardId);
  if (!card || !CFG.showDmg) return;
  card.style.position="relative";
  const el=document.createElement("div");
  el.className=`dmg-float ${type}`; el.textContent=text;
  card.appendChild(el);
  setTimeout(()=>el.remove(), 1300);
}

function spawnXpToast(text) {
  const el=document.createElement("div");
  el.className="xp-toast"; el.textContent=text;
  document.body.appendChild(el);
  setTimeout(()=>el.remove(), 1600);
}

function flashCard(cardId, color) {
  const card=document.getElementById(cardId);
  if (!card) return;
  const prev=card.style.background;
  card.style.transition="background .08s";
  card.style.background=color+"28";
  setTimeout(()=>{ card.style.background=prev; }, 260);
}

function shakeCard(cardId) {
  const card=document.getElementById(cardId);
  if (!card) return;
  card.classList.add("hit-shake");
  setTimeout(()=>card.classList.remove("hit-shake"), 450);
}

function triggerSkillFlash(color="#e84040") {
  const el=document.createElement("div");
  el.className="skill-flash";
  el.style.background=color;
  document.body.appendChild(el);
  setTimeout(()=>el.remove(), 450);
}

function showEndOverlay(type) {
  const isVic=type==="victory";
  let ov=document.getElementById("overlay");
  if (ov) {
    ov.classList.add("show");
    const t=document.getElementById("overlay-title"),b=document.getElementById("overlay-btn");
    if(t){ t.textContent=isVic?"⚔ VICTORY ⚔":" DEFEAT "; t.style.color=isVic?"var(--gold)":"var(--hp-red)"; }
    if(b) b.onclick=()=>location.reload();
    return;
  }
  ov=document.createElement("div"); ov.id="overlay";
  ov.style.cssText=`position:fixed;inset:0;background:rgba(6,11,20,.9);z-index:800;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;animation:fadeIn .5s ease;`;
  const t=document.createElement("div");
  t.style.cssText=`font-family:'Orbitron',sans-serif;font-size:clamp(2rem,6vw,3.5rem);font-weight:900;letter-spacing:.15em;text-align:center;color:${isVic?"var(--gold)":"var(--hp-red)"};text-shadow:0 0 40px currentColor;animation:titlePulse 1.5s infinite alternate;`;
  t.textContent=isVic?" VICTORY ":" DEFEAT";
  const sub=document.createElement("div");
  sub.style.cssText=`color:var(--text-dim);font-family:'Rajdhani',sans-serif;font-size:1rem;letter-spacing:.08em;`;
  sub.textContent=isVic?"All 3 villain phases conquered!":"The darkness prevails…";
  const btn=document.createElement("button"); btn.id="overlay-btn"; btn.textContent="PLAY AGAIN"; btn.onclick=()=>location.reload();
  ov.append(t,sub,btn); document.body.appendChild(ov);
}


// ═══════════════════════════════════════════════════════════
//  UI HELPERS
// ═══════════════════════════════════════════════════════════

function setTurnIndicator(txt) { const e=document.getElementById("turn-indicator"); if(e) e.textContent=txt; }
function setHint(txt)           { const e=document.getElementById("target-hint");    if(e) e.textContent=txt; }
function clearHint()            { setHint(""); }

function logLine(msg) {
  const box=document.getElementById("log-box");
  if (!box) return;
  const div=document.createElement("div"); div.className="log-line"; div.textContent=msg;
  box.appendChild(div);
  while(box.children.length>40) box.removeChild(box.firstChild);
  box.scrollTop=box.scrollHeight;
}


// ═══════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════

function rand(min,max) { return Math.floor(Math.random()*(max-min+1))+min; }
function hexA(hex,a)   { const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16); return `rgba(${r},${g},${b},${a})`; }


// ═══════════════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════════════

document.addEventListener("DOMContentLoaded", init);