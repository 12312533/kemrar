import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

/* ===== KONFIGURASI: ganti gambar, ukuran, musik, dan waktu mulai lagu di sini ===== */
const CONFIG = {
  love:  { label:"Love ❤️",   images:["assets/love1.png","assets/love2.png"], frame:false, size:[70,150],
           music:{src:"music/love.mp3",  startAt:0, endAt:null, volume:0.8}, synth:[523,659,784,659] },
  peace: { label:"Peace ✌️",  images:["assets/peace.png"], frame:true, size:[90,160],
           music:{src:"music/peace.mp3", startAt:0, endAt:null, volume:0.8}, synth:[392,523,587,523] },
  thumb: { label:"Jempol 👍", images:["assets/thumb.png"], frame:true, size:[90,160],
           music:{src:"music/thumb.mp3", startAt:0, endAt:null, volume:0.8}, synth:[440,554,659,880] },
  palm:  { label:"Lima jari ✋", images:["assets/palm.png"], frame:true, size:[110,200],
           music:{src:"music/palm.mp3",  startAt:0, endAt:null, volume:0.8}, synth:[330,392,494,392] },
  mid:   { label:"Jari tengah", videos:["0728 (2).mp4","v0728 (2).mp4"], videoStart:[0,0], videoVolume:1 },  // dua video tampil di kiri & kanan, jalan bersamaan
};
/* ================================================================================ */

const $ = id => document.getElementById(id);
const video=$("cam"), fx=$("fx"), cvs=$("ov"), g=cvs.getContext("2d");
const rnd=(a,b)=>a+Math.random()*(b-a), pick=a=>a[Math.floor(Math.random()*a.length)];
const D=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
let VW=1280,VH=720,W=innerWidth,H=innerHeight,sc=1,offX=0,offY=0;

function layout(){
  W=innerWidth;H=innerHeight;cvs.width=W;cvs.height=H;
  VW=video.videoWidth||1280;VH=video.videoHeight||720;
  sc=Math.max(W/VW,H/VH);offX=(VW*sc-W)/2;offY=(VH*sc-H)/2;
}
addEventListener("resize",layout);
const toScreen=p=>({x:(1-p.x)*VW*sc-offX, y:p.y*VH*sc-offY});   // video dicerminkan

/* ===== DETEKSI GESTURE (jarak dihitung dalam piksel, tidak tergantung rotasi tangan) ===== */
function info(l){
  const r=(t,m)=>D(l[t],l[0])/D(l[m],l[0]);   // rasio ujung jari / pangkal jari ke pergelangan
  return {s:D(l[0],l[9]), idx:r(8,5), mid:r(12,9), ring:r(16,13), pink:r(20,17)};
}
function single(l,t){
  const f=info(l), E=1.75-0.35*t, C=1.25+0.35*t;
  const ext=v=>v>E, cur=v=>v<C;
  const thumbOut=D(l[4],l[5])>f.s*0.65;
  if(D(l[4],l[8])<f.s*(0.25+0.2*t) && cur(f.mid)&&cur(f.ring)&&cur(f.pink)) return "love";           // finger heart
  if(ext(f.mid)&&cur(f.idx)&&cur(f.ring)&&cur(f.pink)) return "mid";
  if(ext(f.idx)&&ext(f.mid)&&cur(f.ring)&&cur(f.pink)&&D(l[8],l[12])>f.s*0.3) return "peace";
  if(ext(f.idx)&&ext(f.mid)&&ext(f.ring)&&ext(f.pink)) return "palm";
  if(cur(f.idx)&&cur(f.mid)&&cur(f.ring)&&cur(f.pink)&&thumbOut&&l[4].y<l[5].y-f.s*0.1) return "thumb";
  return null;
}
function detect(hands,t){
  if(hands.length===2){                                            // love dua tangan: jempol & telunjuk saling bertemu
    const [a,b]=hands, s=(D(a[0],a[9])+D(b[0],b[9]))/2, lim=s*(0.45+0.5*t);
    if(D(a[4],b[4])<lim && D(a[8],b[8])<lim*1.3) return "love";
  }
  let res=null;
  for(const h of hands){const r=single(h,t); if(r==="love") return r; res=res||r;}
  return res;
}

/* ===== MUSIK: mulai dari detik tertentu, fade in/out, fallback nada sintetis ===== */
const A={cur:null,els:{},ctx:null,timer:null};
function fade(a,to,ms,done){clearInterval(a._f);const st=(to-a.volume)/(ms/30);
  a._f=setInterval(()=>{const v=a.volume+st;if((st>0&&v>=to)||(st<=0&&v<=to)){a.volume=Math.max(0,Math.min(1,to));clearInterval(a._f);done&&done();}else a.volume=Math.max(0,Math.min(1,v));},30);}
function audioFor(k){
  if(!A.els[k]){const m=CONFIG[k].music,a=new Audio(m.src);a.preload="auto";a.volume=0;
    a.onerror=()=>a.bad=true;
    a.onended=()=>{a.currentTime=m.startAt||0;a.play().catch(()=>{});};
    A.els[k]=a;}
  return A.els[k];
}
function synthStart(k){
  A.ctx=A.ctx||new (window.AudioContext||window.webkitAudioContext)();
  const notes=CONFIG[k].synth;let i=0;
  A.timer=setInterval(()=>{const o=A.ctx.createOscillator(),gn=A.ctx.createGain(),n=A.ctx.currentTime;
    o.type="triangle";o.frequency.value=notes[i++%notes.length];
    gn.gain.setValueAtTime(0.0001,n);gn.gain.exponentialRampToValueAtTime(0.25,n+0.02);gn.gain.exponentialRampToValueAtTime(0.0001,n+0.35);
    o.connect(gn).connect(A.ctx.destination);o.start(n);o.stop(n+0.4);},230);
}
function playMusic(k){
  stopMusic();A.cur=k;const m=CONFIG[k].music,a=audioFor(k);
  if(a.bad||a.error){synthStart(k);return;}
  a.currentTime=m.startAt||0;a.volume=0;
  a.play().then(()=>fade(a,m.volume,350)).catch(()=>{if(A.cur===k)synthStart(k);});
}
function stopMusic(){
  clearInterval(A.timer);
  if(A.cur){const a=A.els[A.cur];if(a&&!a.paused)fade(a,0,350,()=>a.pause());}
  A.cur=null;
}
function loopCheck(){const m=A.cur&&CONFIG[A.cur].music,a=A.cur&&A.els[A.cur];
  if(m&&m.endAt&&a&&a.currentTime>=m.endAt)a.currentTime=m.startAt||0;}

/* ===== DUA VIDEO BERSAMAAN ===== */
function showVideos(){
  const mc=CONFIG.mid,vs=[$("vidL"),$("vidR")];
  vs.forEach((v,i)=>{v.currentTime=mc.videoStart[i]||0;});
  Promise.all(vs.map(v=>v.play())).catch(()=>{});
  $("vids").classList.add("on");
}
function hideVideos(){
  $("vids").classList.remove("on");
  setTimeout(()=>{if(!$("vids").classList.contains("on"))[$("vidL"),$("vidR")].forEach(v=>v.pause());},600);
}

/* ===== EFEK 3D ===== */
function spawn(k){
  if(fx.childElementCount>90)return;
  const c=CONFIG[k],el=document.createElement("img");
  el.src=pick(c.images);el.className="s"+(c.frame?" f":"");
  const sz=rnd(...c.size),z=rnd(-350,260),x0=rnd(-20,W-sz*0.5),dir=Math.random()<.5?-1:1,tilt=rnd(-40,40);
  el.style.width=sz+"px";
  if(z<-180)el.style.filter+=" blur(1.2px)";
  fx.appendChild(el);
  el.animate([
    {transform:`translate3d(${x0}px,${-sz*1.6}px,${z}px) rotateX(${tilt}deg) rotateY(0deg) rotateZ(${rnd(-25,25)}deg)`,opacity:0},
    {opacity:1,offset:.08},
    {transform:`translate3d(${x0+rnd(-180,180)}px,${H+sz}px,${z}px) rotateX(${tilt+rnd(-90,90)}deg) rotateY(${dir*rnd(360,1080)}deg) rotateZ(${rnd(-90,90)}deg)`,opacity:1}
  ],{duration:rnd(3200,6200),easing:"cubic-bezier(.35,.1,.75,1)"}).onfinish=()=>el.remove();
}
function pop(k,pt){                                                // sticker besar muncul di posisi tangan, berputar 3D
  const c=CONFIG[k],el=document.createElement("img");
  el.src=pick(c.images);el.className="s"+(c.frame?" f":"");
  const sz=Math.min(W,H)*0.32,x=pt.x-sz/2,y=pt.y-sz/2-60;
  el.style.width=sz+"px";fx.appendChild(el);
  el.animate([
    {transform:`translate3d(${x}px,${y+80}px,-300px) rotateY(-180deg) scale(.2)`,opacity:0},
    {transform:`translate3d(${x}px,${y}px,120px) rotateY(20deg) scale(1.15)`,opacity:1,offset:.45},
    {transform:`translate3d(${x}px,${y}px,60px) rotateY(0deg) scale(1)`,opacity:1,offset:.75},
    {transform:`translate3d(${x}px,${y-120}px,200px) rotateY(0deg) scale(1.1)`,opacity:0}
  ],{duration:1500,easing:"ease-out"}).onfinish=()=>el.remove();
}

/* ===== LOOP UTAMA ===== */
const HAND_LINES=[[0,1,2,3,4],[0,5,6,7,8],[9,10,11,12],[13,14,15,16],[0,17,18,19,20],[5,9,13,17]];
function drawHands(hs){
  g.clearRect(0,0,W,H);if(!$("dbgOn").checked)return;
  g.strokeStyle="#00ffd0aa";g.fillStyle="#ff4d79";g.lineWidth=2;
  for(const h of hs){const p=h.map(toScreen);
    for(const ln of HAND_LINES){g.beginPath();ln.forEach((i,j)=>j?g.lineTo(p[i].x,p[i].y):g.moveTo(p[i].x,p[i].y));g.stroke();}
    p.forEach(q=>{g.beginPath();g.arc(q.x,q.y,3,0,7);g.fill();});}
}

async function start(){
  $("msg").textContent="Memuat model AI...";
  const files=await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
  const opt=d=>({baseOptions:{modelAssetPath:"https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",delegate:d},
    runningMode:"VIDEO",numHands:2,minHandDetectionConfidence:0.5,minHandPresenceConfidence:0.5,minTrackingConfidence:0.5});
  let lm;try{lm=await HandLandmarker.createFromOptions(files,opt("GPU"));}catch(e){lm=await HandLandmarker.createFromOptions(files,opt("CPU"));}

  video.srcObject=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:1280,height:720}});
  await video.play();layout();
  Object.keys(CONFIG).forEach(k=>{if(CONFIG[k].music)audioFor(k).load();});
  [$("vidL"),$("vidR")].forEach((v,i)=>{const mc=CONFIG.mid;v.src=mc.videos[i];v.preload="auto";v.volume=mc.videoVolume??1;
    v.onerror=()=>$("lbl").textContent="Video tidak ditemukan: "+mc.videos[i];});
  $("start").style.display="none";

  const hist=[];let active=null,lastTs=-1,lastSpawn=0;
  (function loop(){
    if(video.readyState>=2&&video.currentTime!==lastTs){
      lastTs=video.currentTime;
      const res=lm.detectForVideo(video,performance.now());
      const t=+$("tol").value, raw=res.landmarks;
      const hands=raw.map(h=>h.map(p=>({x:p.x*VW,y:p.y*VH})));          // koordinat piksel
      drawHands(raw);
      hist.push(detect(hands,t));if(hist.length>10)hist.shift();         // voting 10 frame terakhir
      const cnt={};hist.forEach(v=>v&&(cnt[v]=(cnt[v]||0)+1));
      let best=null,bc=0;for(const k in cnt)if(cnt[k]>bc){best=k;bc=cnt[k];}
      let next=active;
      if(active&&(cnt[active]||0)>=3) next=active;                       // histeresis: tetap aktif selama masih ada 3 suara
      else next=bc>=5?best:null;                                         // gesture baru butuh 5 dari 10 frame
      if(next!==active){
        const prev=active;active=next;
        if(prev&&CONFIG[prev].videos)hideVideos();
        stopMusic();
        if(active){if(CONFIG[active].videos)showVideos();else{playMusic(active);const c=raw[0].map(toScreen);pop(active,c[9]);}}
        $("lbl").textContent="Gesture: "+(active?CONFIG[active].label:"-");
      }
    }
    if(active&&CONFIG[active].images){const n=performance.now();if(n-lastSpawn>85){spawn(active);if(Math.random()<.5)spawn(active);lastSpawn=n;}loopCheck();}
    requestAnimationFrame(loop);
  })();
}
$("btn").onclick=()=>start().catch(e=>$("msg").textContent="Gagal: "+e.message);