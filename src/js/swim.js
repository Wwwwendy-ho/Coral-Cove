/*SWIM:BEGIN*/
/* swim: Shelly (Sunlit zone) and Lumi (Midnight zone), ported from Coral Calendar. One swimmer, one rAF loop,
   paused when off screen or hidden. The SWIM:BEGIN / SWIM:END markers fence the ported code (script and styles)
   so it can be replaced in one piece if Coral Calendar's version changes. */
var LUG={
 body:"M31 36C33 22 46 11.5 63 11.5C80 11.5 93 22 94.5 34.5C95.6 46 86.5 56.5 69 57.5C51 58.5 34 51 31 36Z",
 top:"M32.4 32C37 21 49 13.4 63 13.4C77.5 13.4 88.6 20.2 92.4 29.6C84 23.4 73 20.8 62 21.2C50 21.8 40 25.8 32.4 32Z",
 belly:"M36 44.5C46 53 61 56.4 74 55.6C84 55 90.6 50 93.4 43C87.6 50.6 78 53.6 66 53.6C54 53.6 44 50.6 36 44.5Z",
 tail:"M32.5 33.2C27.5 28.6 21.5 23.4 15 20.2q-2.8 3.2-1.1 6.6q-3.5 3-1.3 6.7q-3.5 3.4-1 6.8q-2.4 3.8 1.1 6.6q-1 3.4 2.7 5.3C21.6 49 27.6 44 32.5 39.6Z",
 tailR:"M31.4 34.6L16.4 23.6M31.4 35.6L13.8 30.4M31.4 36.6L13.6 37.6M31.4 37.6L14.8 44.6M31.4 38.6L17.4 50.6",
 dor:"M40.5 22.6C39.4 17 41.6 11.6 46.4 9q.2 2.6 2.4 3.1q-.6 2.5 1.6 3.5q-1 2.1.6 3.4C47 19.4 43.6 20.8 40.5 22.6Z",
 dorR:"M41.6 21.4L45.6 11.2M43.2 20.6L48.4 14M45 19.8L50.2 17.6",
 an:"M39.6 49.2C37.6 53.4 38.4 57.6 41.8 59.8q.7-2.2 2.7-2.3q.1-2 2-2.9C45.2 53 42.6 51.2 39.6 49.2Z",
 pec:"M66.6 41.4C60.6 40.8 53.6 43.2 49.8 48.2q2.4.3 3.2 2.7q2.6-.7 4.1 1.3q2.4-1.3 4.6.3C63.8 50.6 66.8 46.2 67.6 43Z",
 pecR:"M66 42.2L51.6 48.4M66.2 43L56.2 51.4M66.6 43.8L61.6 52.4",
 gill:"M70.4 24.6C67 32 67.2 41 71.4 48",
 shine:"M43 20.4C50 15 59 12.9 68 13.7",
 spk:[[50,18.6,1.1],[58.6,15.9,.8],[44.2,25.2,.9],[55.2,23.6,.7],[66.2,18.6,.8],[39.6,31.2,.7],[48.2,30.2,.6]],
 ph:[[43.4,45.8,.9],[50.8,49.6,1],[59.2,51.8,1],[67.6,52,1],[75.6,50.2,.9],[82.2,46.8,.8],[49.4,39.8,.6],[60.2,43,.6]],
 A:[77,13.2],B:[98,3.4],E:[80,27,6.8],CK:[77.6,37.4]};
var LU_LID={calm:.4,tired:.56,unwell:.22,upset:.12};
function luF(v){return (+v).toFixed(2).replace(/\.?0+$/,"");}
/* the part of an eye covered by a lid: f = how far it comes down (0..1), its lower edge bulges a little */
function luLidD(x,y,rx,ry,f,b){const yy=y-ry+2*ry*Math.min(.96,f),dx=rx*Math.sqrt(Math.max(0,1-((yy-y)/ry)**2));
  return [`M${luF(x-dx)} ${luF(yy)}A${rx} ${ry} 0 ${yy>y?1:0} 1 ${luF(x+dx)} ${luF(yy)}Q${luF(x)} ${luF(yy+b)} ${luF(x-dx)} ${luF(yy)}Z`,`M${luF(x-dx)} ${luF(yy)}Q${luF(x)} ${luF(yy+b)} ${luF(x+dx)} ${luF(yy)}`];}
function luEye(ex){const [x,y,r]=LUG.E;
  if(ex==="happy")return `<g class="l-pu"></g><path class="l-eh" d="M${luF(x-r*.78)} ${luF(y+r*.32)}Q${x} ${luF(y-r*1.02)} ${luF(x+r*.78)} ${luF(y+r*.32)}"/>`;
  let o=`<circle class="l-ew" cx="${x}" cy="${y}" r="${r}"/><g class="l-pu"><circle class="l-ei" cx="${luF(x+.5)}" cy="${luF(y+.4)}" r="${luF(r*.8)}"/><path class="l-eg" d="M${luF(x-r*.48)} ${luF(y+r*.36)}Q${luF(x+.5)} ${luF(y+r*.96)} ${luF(x+r*.6)} ${luF(y+r*.3)}"/><circle class="l-es" cx="${luF(x+r*.3)}" cy="${luF(y-r*.28)}" r="${luF(r*.3)}"/><circle class="l-es" cx="${luF(x-r*.3)}" cy="${luF(y+r*.32)}" r="${luF(r*.13)}"/></g>`;
  const f=LU_LID[ex];if(f){const [a,b]=luLidD(x,y,r+.12,r+.12,f,2.1);o+=`<path class="l-lid" d="${a}"/><path class="l-lsh" d="${b}"/>`;}
  return o;}
function luBrow(ex){const [x,y,r]=LUG.E;return ex==="upset"||ex==="unwell"?`<path class="l-brw" d="M${luF(x-r*.85)} ${luF(y-r-1.4)}Q${luF(x-r*.1)} ${luF(y-r-4.6)} ${luF(x+r*.8)} ${luF(y-r-2.8)}"/>`:"";}
function luMouth(ex,yawn){const q=(F,C,K,t)=>[(1-t)*(1-t)*F[0]+2*t*(1-t)*C[0]+t*t*K[0],(1-t)*(1-t)*F[1]+2*t*(1-t)*C[1]+t*t*K[1]],P=a=>a.map(luF).join(" ");
  const tooth=p=>`<path class="l-th" d="M${luF(p[0]-1.1)} ${luF(p[1]-.4)}Q${luF(p[0])} ${luF(p[1]+2.7)} ${luF(p[0]+1.1)} ${luF(p[1]-.4)}Z"/>`;
  const M={n:[[94.6,38.6],[90.5,46.6],[79.6,43.4]],calm:[[94.4,39.6],[90.4,44.8],[82.2,42.6]],upset:[[94.2,43.4],[89.4,38.6],[83.2,43.8]],tired:[[94.4,41.2],[89.4,42.8],[83.2,42.2]]};
  let o;
  if(ex==="happy"){const F=[94.9,37.6],C=[91,45.4],K=[78.6,42.4],C2=[88.4,56];
    o=`<path class="l-mf" d="M${P(F)}Q${P(C)} ${P(K)}Q${P(C2)} ${P(F)}Z"/><ellipse class="l-tg" cx="87.8" cy="46.7" rx="3.4" ry="1.45"/>${tooth(q(F,C,K,.26))}${tooth(q(F,C,K,.48))}`;}
  else if(ex==="unwell")o=`<path class="l-mo" d="M94.4 41.4q-1.5-1.3-3 0t-3 0t-3 0t-3 0"/>`;
  else{const m=M[ex]||M.n;o=`<path class="l-mo" d="M${P(m[0])}Q${P(m[1])} ${P(m[2])}"/>`;if(!ex||ex==="calm")o+=tooth(q(...m,.28))+tooth(q(...m,.5));}
  return `<g class="l-ml">${o}</g>`+(yawn?`<ellipse class="l-yw" cx="88.6" cy="43" rx="3" ry="3.6" transform="scale(0)"/>`:"");}
function swHs(){const h=SW.H;return h>165?1.5:h>140?1.38:h>120?1.28:h>100?1.18:1;}
/* swim: Shelly's living water in the arrival check-in (one rAF loop, paused offscreen or hidden) */
var SWF={a:[],pool:[],max:6,life:20,cur:null,chip:null,n:0,q:[],rmB:0};/* feed state (see swFdDrop) */
var SW={el:null,t:null,parts:null,bubs:[],W:300,H:96,run:false,raf:0,vis:false,last:0,rm:false};
function swBuild(){
  const d=document.createElement("div");d.className="ciw";d.setAttribute("aria-hidden","true");
  const blade=(x,h,w,c)=>`<path class="bl" d="M${x} 96C${x-w} ${96-h*.5} ${x+w} ${96-h*.75} ${x+(c||2)} ${96-h}C${x+w*.6} ${96-h*.7} ${x+w*.9} ${96-h*.4} ${x+w*.8} 96Z"/>`;
  const kelp=(x,h)=>`<path class="kp" d="M${x} 110C${x-9} ${110-h*.3} ${x+10} ${110-h*.55} ${x-2} ${110-h*.8}C${x-6} ${110-h*.9} ${x+1} ${110-h} ${x+4} ${110-h}C${x+8} ${110-h*.85} ${x+4} ${110-h*.6} ${x+13} ${110-h*.35}C${x+15} ${110-h*.2} ${x+9} 105 ${x+10} 110Z"/>`;
  const S=n=>{let o="";for(let x=0;x<n;x+=60)o+=` q15 -6 30 0 q15 6 30 0`;return o;};
  let motes="";for(let i=0;i<9;i++){const x0=(i*37+11)%100,y0=20+(i*29)%60;motes+=`<i class="swmote" style="left:${x0}%;top:${y0}px;--x0:0px;--y0:0px;--x1:${i%2?22:-18}px;--y1:${-14-(i%3)*6}px;--d:${12+(i%4)*3}s;--dl:-${(i*2.3).toFixed(1)}s;--o:${(.35+(i%3)*.15).toFixed(2)}"></i>`;}
  let snow="",specks="";for(let i=0;i<16;i++){const x=(i*41+7)%100,y=-6+(i*23)%46,dx=((i%5)-2)*4,dy=70+(i%4)*14;snow+=`<i class="sn${i%4===1?" b":""}" style="left:${x}%;top:${y}px;--dx:${dx}px;--dy:${dy}px;--ry:${(i*13)%40}px;--d:${20+(i%5)*4}s;--dl:-${(i*3.1).toFixed(1)}s;--o:${(.35+(i%3)*.15).toFixed(2)}"></i>`;}
  [[9,22,9,.55],[27,58,12,.4],[46,16,8,.6],[71,40,11,.45],[88,20,10,.5],[93,64,13,.35]].forEach(([x,y,dd,o],i)=>{specks+=`<i class="sk${i%2?" f":""}" style="left:${x}%;top:${y}%;--d:${dd}s;--dl:-${(i*2.7).toFixed(1)}s;--o:${o}"></i>`;});
  d.innerHTML=`<div class="swrays"></div><div class="swcaus c1"></div><div class="swcaus c2"></div>
   <div class="swlay swfar"><svg width="100%" height="100%" viewBox="0 0 1200 110" preserveAspectRatio="xMinYMax slice">${[[30,70],[118,52],[250,78],[330,58],[372,40],[470,66],[560,48],[690,80],[780,54],[880,70],[990,46],[1080,74],[1170,56]].map(a=>kelp(...a)).join("")}</svg></div>
   <div class="swlay swmid"><svg width="100%" height="100%" viewBox="0 0 1200 96" preserveAspectRatio="xMinYMax slice">${[[8,30,6],[16,22,5,-3],[150,26,6],[158,18,4,3],[290,24,5],[298,34,7,-2],[306,20,4],[392,26,5],[520,22,5],[528,30,6,-2],[660,24,5],[800,32,6],[808,20,4,3],[950,26,5],[1090,30,6],[1098,22,4,-3]].map(a=>blade(...a)).join("")}</svg></div>
   <div class="swsand"><svg width="100%" height="22" viewBox="0 0 400 22" preserveAspectRatio="none"><path class="s2" d="M0 9C60 3 110 12 170 7S300 2 400 8V22H0Z"/><path class="s1" d="M0 13C70 8 130 17 200 12S330 7 400 13V22H0Z"/></svg></div>
   <div class="swdeep"><div class="swsnow">${snow}</div>${specks}</div>
   <i class="swglow"></i><div class="swtw"><svg class="swt" viewBox="-6 -4 112 72"><defs><clipPath id="swtC"><path d="M15 37C16 22 32 11 49 11C66 11 79 21 81.5 34C70 41 30 43.5 15 37Z"/></clipPath></defs>
    <g class="g-body">
     <g class="g-bk"><g class="y-ff"><g class="g-ff"><path class="p-fl" d="M62 31C56 36 46 44 32 49C30 50 30 52 33 52C46 50 58 43 66 36Z"/></g></g><g class="y-fr"><g class="g-fr"><path class="p-fl" d="M24 34C18 37 12 40 7 39C6 38 7 36 9 35C14 33 19 32 24 31Z"/></g></g></g>
     <g class="y-tl"><path class="p-sk" d="M17 36L9 38.5L17 40Z"/></g>
     <g class="y-hb"><g class="g-hd"><g class="y-hs"><path class="p-sk" d="M72 29C77 25 84 22 90 22C97 22 101 26 101 31.5C101 37 96 40 89 40C83 40 77 38 72 37Z"/></g>
      <g class="y-c2"><circle class="p-ck" cx="95.5" cy="34" r="2.1"/></g><g class="y-e2"><g class="g-ey2">${swShEye(null)}</g></g>
      <g class="y-c1"><circle class="p-ck" cx="95.5" cy="34" r="2.1"/></g><g class="y-e1"><g class="g-ey">${swShEye(null)}</g></g>
      <g class="y-mo"><path class="p-mo" d="M93.6 35.2q3.2 2.4 6.4-.4"/><ellipse class="p-yw" cx="97" cy="36.4" rx="1.8" ry="2.2" transform="scale(0)"/></g></g></g>
     <g class="y-sh"><path class="p-be" d="M16 37C30 44 68 43 81 34.5C78 42 66 46.5 50 46.5C34 46.5 22 44 16 37Z"/>
      <path class="p-sh" d="M15 37C16 22 32 11 49 11C66 11 79 21 81.5 34C70 41 30 43.5 15 37Z"/>
      <g clip-path="url(#swtC)"><path class="p-sc" d="M24 33.5C26 24 37 16.5 49.5 16.5C62 16.5 71.5 23 74.5 31.5C64 36.5 34 37.5 24 33.5Z"/>
      <path class="p-ln" d="M38 17.5L42.5 34.5M50 16.5V35.5M61.5 17.5L57.5 35M27 26.5C40 29 60 29 74 25"/>
      <ellipse class="p-shd" cx="19" cy="30" rx="17" ry="26"/><ellipse class="p-shn" cx="66" cy="22" rx="14" ry="9"/></g>
      <path class="p-hl" d="M27 22C34 15.5 42 13.5 50 13.5"/></g>
     <g class="g-fnt"><g class="y-nr"><g class="g-nr"><path class="p-sk" d="M26 38C20 42 13 46 8 45.5C6.8 44.8 7.5 43 9.5 42C14.5 40 20 38 25 36.5Z"/></g></g><g class="y-nf"><g class="g-nf"><path class="p-sk" d="M66 37C60 42 50 50 36 55C34 56 34 58 37 58C50 56 62 49 70 42Z"/></g></g></g>
     <g class="y-hf"></g>
    </g></svg></div>
   <div class="swlw">${swLanternSVG()}</div>
   <div class="swlay swnear">${motes}</div>
   <div class="swsurf"><svg width="100%" height="12" viewBox="0 0 1200 12" preserveAspectRatio="none"><path d="M0 0H1200V5${S(1200).replace(/^ /,"")}V0Z" transform="translate(0 0)"/><path d="M0 5${S(1200)}"/></svg></div>
   <i class="swring"></i><i class="swring"></i><i class="swring"></i>`;
  for(let i=0;i<18;i++){const b=document.createElement("i");b.className="swb";d.appendChild(b);SW.bubs.push({el:b,on:false,x:0,y:0,x0:0,vy:0,s:1,ph:0,age:0,a:0,lm:0,vx:0,vy2:0,life:1});}
  const q=s=>d.querySelector(s);
  SW.parts={t:q(".swt"),body:q(".g-body"),nf:q(".g-nf"),ff:q(".g-ff"),nr:q(".g-nr"),fr:q(".g-fr"),hd:q(".g-hd"),ey:q(".g-ey"),mo:q(".p-mo"),yw:q(".p-yw"),far:q(".swfar"),mid:q(".swmid"),near:q(".swnear"),rings:[...d.querySelectorAll(".swring")],glow:q(".swglow"),cache:new Map(),l:q(".swl"),L:{body:q(".l-body"),tail:q(".l-tail"),cau:q(".l-cau"),pec:q(".l-pec"),dor:q(".l-dor"),pu:q(".l-pu"),mo:q(".l-mo"),snow:q(".swsnow"),pc:[...d.querySelectorAll(".l-pc")],pw:[...d.querySelectorAll(".l-pw")],ha:[q(".l-ha")],hw:[q(".l-hw")]}};
  swParts3(d);
  /* turtle state */
  SW.T={x:-40,y:40,vx:30,vy:0,face:1,fv:0,faceT:1,pitch:0,pv:0,ph:0,amp:1,mode:"enter",mt:0,tx:0,ty:0,spd:1,spin:0,look:0,blink:0,nextBlink:2.5,nextAir:14+Math.random()*10,scale:1,sv:0,scaleT:1,wig:0,loop:null,cam:0,mood:null,mouth:0,pointer:null,dwell:0,rest:0};
  d.addEventListener("pointermove",e=>{if(e.pointerType!=="mouse")return;const r=SW.rect||(SW.rect=d.getBoundingClientRect());SW.T.pointer={x:e.clientX-r.left,y:e.clientY-r.top,at:performance.now()};},{passive:true});
  d.addEventListener("pointerenter",()=>{SW.rect=null;},{passive:true});
  d.addEventListener("pointerleave",()=>{SW.T.pointer=null;SW.T.dwell=0;},{passive:true});
  d.addEventListener("click",swTap);
  SW.el=d;swTheme(true);
  try{new ResizeObserver(es=>{const r=es[0].contentRect;if(r.width){SW.W=r.width;SW.H=r.height;SW.rect=null;swChipRect();if(SW.rm)swStatic();}}).observe(d);}catch(e){}
  try{new IntersectionObserver(es=>{SW.vis=es[es.length-1].isIntersecting;swGo();},{rootMargin:"40px"}).observe(d);}catch(e){SW.vis=true;}
  return d;}
/* lantern: the night swimmer. Same brain (SW.T) as Shelly; only the body and the light differ */
var SWL={g:.74,w:0,fl:0,lt:0,c:{}};
function swOp(v){SW.parts.t.style.opacity=v;if(SW.parts.l)SW.parts.l.style.opacity=v;}
function swLanternSVG(){const G=LUG,[bx,by]=G.B,[ax,ay]=G.A,[cx,cy]=G.CK;
  const Pp=(a,cls,g,core)=>`<g class="${cls}">${a.map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${(2.9*r).toFixed(2)}" fill="url(#${g})"/><circle cx="${x}" cy="${y}" r="${(.95*r).toFixed(2)}" fill="${core}"/>`).join("")}</g>`;
  const both=a=>Pp(a,"l-pc","swlfP","#D8FFFB")+Pp(a,"l-pw","swlfQ","#FFF3D1");
  const rg=(id,c,o)=>`<radialGradient id="${id}"><stop offset="0" stop-color="${c}" stop-opacity="${o}"/><stop offset=".45" stop-color="${c}" stop-opacity="${(o*.32).toFixed(2)}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;
  const fin=(d,r)=>`<path class="l-fn" d="${d}"/>`+(r?`<path class="l-ry" d="${r}"/>`:"");
  return `<svg class="swl" viewBox="-6 -4 112 72"><defs>${rg("swlfH","#43D3D4",.5)}${rg("swlfW","#F0C76A",.42)}
   <radialGradient id="swlfP"><stop offset="0" stop-color="#9FF5F0" stop-opacity=".95"/><stop offset=".38" stop-color="#43D3D4" stop-opacity=".5"/><stop offset="1" stop-color="#43D3D4" stop-opacity="0"/></radialGradient>
   <radialGradient id="swlfQ"><stop offset="0" stop-color="#FFE7A8" stop-opacity=".95"/><stop offset=".38" stop-color="#F0C76A" stop-opacity=".5"/><stop offset="1" stop-color="#F0C76A" stop-opacity="0"/></radialGradient>
   <radialGradient id="swlfL"><stop offset="0" stop-color="#E8FFFD" stop-opacity="1"/><stop offset=".3" stop-color="#43D3D4" stop-opacity=".75"/><stop offset="1" stop-color="#43D3D4" stop-opacity="0"/></radialGradient>
   <radialGradient id="swlfK"><stop offset="0" stop-color="#F6B49A" stop-opacity=".9"/><stop offset=".55" stop-color="#F0C76A" stop-opacity=".38"/><stop offset="1" stop-color="#F0C76A" stop-opacity="0"/></radialGradient>
   <linearGradient id="swlfB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#15345C"/><stop offset=".48" stop-color="#1D5676"/><stop offset="1" stop-color="#5AA5B3"/></linearGradient>
   <clipPath id="swlC"><path d="${G.body}"/></clipPath></defs>
   <g class="z-ha"><g class="l-hb" transform="translate(${bx} ${by})"><circle class="l-ha" r="36" fill="url(#swlfH)"/><circle class="l-hw" r="36" fill="url(#swlfW)"/></g></g>
   <g class="l-body">
    <g class="l-bk"><g class="z-pc2"><g class="l-pec2">${fin(G.pec,G.pecR)}</g></g></g>
    <g class="z-tl"><g class="l-tail"><g class="l-cau">${fin(G.tail,G.tailR)}</g></g></g>
    <g class="z-dor"><g class="l-dor">${fin(G.dor,G.dorR)}</g></g>
    <g class="z-an"><g class="l-an">${fin(G.an)}</g></g>
    <g class="z-bd"><path class="l-bd" d="${G.body}"/>
     <g clip-path="url(#swlC)"><ellipse class="l-shd" cx="34" cy="36" rx="24" ry="26"/><ellipse class="l-shn" cx="84" cy="28" rx="13" ry="9"/><ellipse class="l-lit" cx="90" cy="15" rx="20" ry="13" fill="url(#swlfH)"/></g>
     <path class="l-ln" d="${G.shine}"/><path class="l-gl" d="${G.gill}"/>${G.spk.map(([x,y,r])=>`<circle class="l-sp" cx="${x}" cy="${y}" r="${r}"/>`).join("")}
     ${both(G.ph)}<path class="l-pale" d="${G.body}"/>
     <g class="l-lu"><path class="l-st" d="M${ax} ${ay}C76.6 3.6 92 -5 ${bx} ${by}"/><g class="l-bu" transform="translate(${bx} ${by})"><circle class="l-bg" r="8" fill="url(#swlfL)"/><circle class="l-br" r="3.4"/><circle class="l-bc" r="2.55"/><circle class="l-bh" cx="-.85" cy="-.9" r=".95"/></g></g></g>
    <g class="z-c2"><ellipse class="l-ck" cx="${cx}" cy="${cy}" rx="4.4" ry="2.9"/></g><g class="z-e2"><g class="l-eb">${luEye(null)}</g></g>
    <g class="z-c1"><ellipse class="l-ck" cx="${cx}" cy="${cy}" rx="4.4" ry="2.9"/></g><g class="z-e1"><g class="l-eb">${luEye(null)}</g></g>
    <g class="z-mo">${luMouth(null,true)}</g>
    <g class="l-fr"><g class="z-pc"><g class="l-pec">${fin(G.pec,G.pecR)}</g></g></g>
   </g></svg>`;}
function swLO(a,v){for(const el of a)swSet(el,"opacity",v);}
function swDrawL(c,s,sg){const T=SW.T,P=SW.parts,L=P.L,Q=P.LQ;if(!L||!P.l||!Q||!L.st)return;if(c==null){const yw=swYawOf(T);c=Math.cos(yw);s=Math.sin(yw);sg=c<0?-1:1;}
  const a=T.amp,ph=T.ph,now=performance.now()/1000,dt=SWL.lt?Math.min(.1,Math.max(0,now-SWL.lt)):0;SWL.lt=now;
  /* body wave: tail leads, the frilly fins lag and ripple (open and close a little) */
  const w=Math.sin(ph*6.283),w2=Math.sin(ph*6.283-1.25),w3=Math.sin(ph*6.283-2.4),tl=(3+11*a)*w+swClamp(T.pv*.05,-9,9),cf=(5+14*a)*w2;
  swSet(L.tail,"t",`rotate(${tl.toFixed(1)} 33 36)`);swSet(L.cau,"t",`translate(31 36) rotate(${cf.toFixed(1)}) scale(1 ${(1+.08*w3*(.4+a)).toFixed(3)}) translate(-31 -36)`);
  const pa=8+15*a*Math.sin(ph*12.566+.5),pr=`translate(66.6 42.4) rotate(${pa.toFixed(1)}) scale(${(1-.06*Math.sin(ph*12.566-.6)).toFixed(3)} 1) translate(-66.6 -42.4)`;swSet(L.pec,"t",pr);swSet(Q.pec2,"t",pr);
  swSet(L.dor,"t",`rotate(${(-5*a*w2).toFixed(1)} 42 21)`);swSet(L.an,"t",`rotate(${(5*a*w3).toFixed(1)} 40.5 50)`);
  const bob=-1.1*a*Math.sin(ph*12.566-.6);swSet(L.body,"t",`translate(0 ${bob.toFixed(2)}) rotate(${(-tl*.08*c).toFixed(1)} ${(52+6*c).toFixed(1)} 36)`);
  const pu=`translate(${(.6*c-.2+Math.abs(T.look)*.02*c).toFixed(2)} ${(swClamp(T.look,-16,16)*.055).toFixed(2)})`;for(const e of L.pu)swSet(e,"t",pu);
  const bl=Math.max(.08,1-T.blink),eb=bl>.98?"":`translate(0 ${(LUG.E[1]*(1-bl)).toFixed(2)}) scale(1 ${bl.toFixed(2)})`;for(const e of L.eb)swSet(e,"t",eb);
  /* mouth: today's expression; a short grin after a tap; a slow yawn when she is tired */
  const mx=T.mouth===1?"happy":T.mood||null;if(SWL.mx!==mx){SWL.mx=mx;swRegen(Q.moI,luMouth(mx,true));L.ml=Q.moI.querySelector(".l-ml");L.yw=Q.moI.querySelector(".l-yw");}
  const yn=Math.max(T.yawn||0,(T.bite||0)*1.1);swSet(L.ml,"opacity",yn>.02?Math.max(0,1-yn*2).toFixed(2):"1");swSet(L.yw,"t",yn>.02?`translate(88.6 43) scale(${(.55+.45*yn).toFixed(2)} ${yn.toFixed(2)}) translate(-88.6 -43)`:"scale(0)");
  /* light: the mood sets the level, a slow breath (< 1 Hz, low contrast) rides on top */
  const m=T.mood,up=m==="upset";let tg=m==="happy"?1:m==="calm"?.5:up?.86:m==="tired"?.45:m==="unwell"?.52:.74;if(T.mode==="rest")tg=Math.max(tg,.8);
  let pl=up||m==="unwell"||T.mode==="rest"?1:m==="tired"?1+.1*Math.sin(now*.9):1+.12*Math.sin(now*1.38);
  if(T.mode==="breathe")pl+=.32*Math.sin(Math.PI*Math.min(1,T.mt/(T.mdur||3)));
  if(SW.rm){SWL.g=tg;SWL.w=up?1:0;SWL.fl=0;pl=1;}else{const k=1-Math.exp(-dt*1.4);SWL.g+=(tg-SWL.g)*k;SWL.w+=((up?1:0)-SWL.w)*k;SWL.fl=Math.max(0,SWL.fl-dt*1.3);}
  const g=SWL.g,fl=SWL.fl*SWL.fl,lv=swClamp((.3+.7*g)*pl+fl*.45,0,1),hv=swClamp((.2+.66*g)*pl+fl*.55,0,1),wv=SWL.w;
  swLO(L.pc,(lv*(1-wv)).toFixed(2));swLO(L.pw,(lv*wv).toFixed(2));swLO(L.ha,(hv*(1-wv)).toFixed(2));swLO(L.hw,(hv*wv).toFixed(2));
  swSet(L.bg,"opacity",swClamp(.45+.6*lv,0,1).toFixed(2));swSet(L.lit,"opacity",(.55*hv).toFixed(2));
  if(SW.el){const wm=wv>.5;if(SWL.c.wm!==wm){SWL.c.wm=wm;SW.el.classList.toggle("warm",wm);}}
  /* lure: the bulb hangs on a damped spring. Water drag on the bulb (her speed plus the spin of turns and loops)
     makes it trail and swing, then settle; it stays on an arc around the stalk's root, like a pendulum */
  {const bank=swClamp(-(T.yv||0)*1.3,-9,9),rot=T.pitch*c+bank+T.wig+(T.spin||0),sc=.62*(T.scale||1)*swHs();
   /* turnfix: root and bulb are projected through the yaw like every other part (not mirrored with the body),
      and the spring lives in screen space, so the bulb never jumps sides as she turns to face you */
   const Pj=(x,y)=>[50+(x-50)*c,y+SWP.tl*(x-50)*s],[ax0,ay0]=Pj(LUG.A[0],LUG.A[1]),[bx0,by0]=Pj(LUG.B[0],LUG.B[1]);
   if(SW.rm||!dt||SWL.px==null){SWL.dx=SWL.dy=SWL.vx=SWL.vy=0;}
   else{const r=-rot*.01745,cr=Math.cos(r),sr=Math.sin(r),vx=swClamp((T.x-SWL.px)/dt,-240,240)/sc,vy=swClamp((T.y-SWL.py+(T.hop||0)-(SWL.ph0||0))/dt,-240,240)/sc;
     let lx=vx*cr-vy*sr,ly=vx*sr+vy*cr;const om=swClamp((rot-SWL.rot)/dt*.01745,-9,9),rx=bx0-50,ry=by0-32;lx+=-om*ry;ly+=om*rx;
     const sw=Math.sin(now*1.15)*1.1,sy=Math.sin(now*1.7+1)*.7+(-1.1*a*Math.cos(ph*12.566-.6))*.6,k=58,cd=5.2,gd=2.4;
     const ax=-k*(SWL.dx-sw)-cd*SWL.vx-gd*lx,ay=-k*(SWL.dy-sy)-cd*SWL.vy-gd*ly;SWL.vx+=ax*dt;SWL.vy+=ay*dt;SWL.dx+=SWL.vx*dt;SWL.dy+=SWL.vy*dt;
     SWL.dx=swClamp(SWL.dx,-9.5-2.5*c,9.5-2.5*c);SWL.dy=swClamp(SWL.dy,-7,7);}
   SWL.px=T.x;SWL.py=T.y;SWL.ph0=T.hop||0;SWL.rot=rot;
   const L0=Math.hypot(bx0-ax0,by0-ay0);let bx=bx0+SWL.dx,by=by0+SWL.dy;const d=Math.hypot(bx-ax0,by-ay0)||1,kk=.3+.7*L0/d;bx=ax0+(bx-ax0)*kk;by=ay0+(by-ay0)*kk;
   let fi=Math.atan2(by-ay0,bx-ax0)-Math.atan2(by0-ay0,bx0-ax0);fi=Math.atan2(Math.sin(fi),Math.cos(fi));
   const [p1x,p1y]=Pj(LUG.A[0]-.4,LUG.A[1]-9.6),[p2x,p2y]=Pj(92,-5),ox=p2x-bx0,oy=p2y-by0,cf2=Math.cos(fi),sf=Math.sin(fi),c2x=bx+ox*cf2-oy*sf,c2y=by+ox*sf+oy*cf2,c1x=p1x+fi*3,c1y=p1y;
   swSet(L.st,"d",`M${ax0.toFixed(1)} ${ay0.toFixed(1)}C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`);
   const bt=`translate(${bx.toFixed(1)} ${by.toFixed(1)})`;swSet(L.bu,"t",bt);swSet(L.hb,"t",bt);}
  /* 3D yaw: she is a round fish, so head-on she stays chubby; both big eyes show */
  const x0=50,kb=Math.sqrt(c*c+.3*s*s),es=v=>swClamp(v,.45,1),eo=v=>swClamp((v+.12)/.3,0,1),[oa,ob]=swMirW(c);
  swPj(Q.bd,63,35,0,kb,c,s,x0);swPj(Q.bd2,63,35,0,-kb,c,s,x0);swOpv(Q.bd,oa);swOpv(Q.bd2,ob);swSet(Q.shd,"opacity",(.5*s).toFixed(2));swSet(Q.shn,"opacity",(.3*s).toFixed(2));
  swPj(Q.tl,33,36,0,c,c,s,x0);swPj(Q.dor,44,18,0,swThin(c),c,s,x0);swPj(Q.an,42,52,0,swThin(c),c,s,x0);
  const [ex,ey]=LUG.E,v1=.55*s+c,v2=.55*s-c;swPj(Q.e1,ex,ey,6,es(v1),c,s,x0,1,6);swPj(Q.e2,ex,ey,-6,es(v2),c,s,x0,1,6);swSet(Q.e1,"opacity",eo(v1).toFixed(2));swSet(Q.e2,"opacity",eo(v2).toFixed(2));
  const u1=.7*s+c,u2=.7*s-c;swPj(Q.c1,LUG.CK[0],LUG.CK[1],6.5,es(u1),c,s,x0,1,6.5);swPj(Q.c2,LUG.CK[0],LUG.CK[1],-6.5,es(u2),c,s,x0,1,6.5);swSet(Q.c1,"opacity",eo(u1).toFixed(2));swSet(Q.c2,"opacity",eo(u2).toFixed(2));
  {const m=Math.min(1.1,Math.abs(c)+.55*s);swPj(Q.mo,89,41,0,m,c,s,x0);swPj(Q.mo2,89,41,0,-m,c,s,x0);swOpv(Q.mo,oa);swOpv(Q.mo2,ob);}
  for(const f of Q.fl){const zq=(f.px-x0)*s+f.Z*c,zp=swPj(f.w,f.px,f.py,f.Z,c+f.sd*.5*s,c,s,x0,1+.06*swClamp(zq/Math.abs(f.Z),-1.6,1.6)),u=swSs((zp+4)/8);swOpv(f.u,u);swOpv(f.k,1-u);}
  swSet(P.l,"transform",swOuter(T,c,s));
  swSet(L.snow,"transform",`translate3d(${(T.cam*.45).toFixed(1)}px,0,0)`);}
/* swap a group's drawing (an expression change) and forget the cached values of what was removed */
function swRegen(g,html){if(!g)return;const C=SW.parts.cache;g.querySelectorAll("*").forEach(e=>C.delete(e));g.innerHTML=html;}
function swSpark(x,y){if(SW.rm)return;const b=SW.bubs.find(b=>!b.on);if(!b)return;b.on=true;b.lm=1;b.age=0;b.x0=b.x=x;b.y=y;b.vx=(Math.random()-.5)*8;b.vy2=(Math.random()-.5)*8;b.s=.32+Math.random()*.3;b.ph=Math.random()*6;b.a=0;b.life=.8+Math.random()*.45;}
/* theme: follow the app's toggle and the system setting; crossfade the two scenes without touching the swimmer's state */
function swTheme(init){if(!SW.el)return;let d=false;try{d=themeNow()==="dark";}catch(e){}if(!init&&d===SW.dark)return;SW.dark=d;const el=SW.el;clearTimeout(SW.xto);
  if(init){el.classList.remove("xf");el.classList.toggle("dk",d);SW.showT=!d;SW.showL=d;return;}
  el.classList.add("xf");void el.offsetWidth;el.classList.toggle("dk",d);SW.showT=SW.showL=true;SWL.lt=0;
  if(SW.rm)swStatic();else if(!SW.run)swDraw();
  SW.xto=setTimeout(()=>{el.classList.remove("xf");SW.showT=!SW.dark;SW.showL=SW.dark;},950);}
try{new MutationObserver(()=>swTheme()).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});const mqd=matchMedia("(prefers-color-scheme: dark)"),fd=()=>swTheme();mqd.addEventListener?mqd.addEventListener("change",fd):mqd.addListener(fd);}catch(e){}
function swSet(el,k,v){const c=SW.parts.cache;if(c.get(el)===v)return;c.set(el,v);if(k==="t")el.setAttribute("transform",v);else if(k==="d")el.setAttribute("d",v);else el.style[k]=v;}
const swE={io:t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2,s:t=>-(Math.cos(Math.PI*t)-1)/2,oc:t=>1-Math.pow(1-t,3)};
function swClamp(v,a,b){return v<a?a:v>b?b:v;}
/* the label chip sits bottom-left: keep Shelly's targets out of it */
function swSafe(x,y){const T=SW.T,W=SW.W,H=SW.H,sz=34*T.scale;x=swClamp(x,sz,W-sz);y=swClamp(y,20,H-30);if(!SW.lbR)return [x,y];const lr=SW.lbR,lt=(SW.lbT||H-38)-15*T.scale;if(x<lr&&y>lt)y=Math.max(20,lt);return [x,y];}
function swPick(){const T=SW.T,W=SW.W,H=SW.H;T.tap=null;let dir=Math.sign(T.face||1);if(Math.random()<.25)dir=-dir;if(T.x<W*.22)dir=1;else if(T.x>W*.78)dir=-1;
  let x=T.x+dir*(.22+Math.random()*.3)*Math.max(W,240);x=swClamp(x,36,W-36);let y=swClamp(T.y+(Math.random()-.5)*H*.7,24,H-34);
  const m=T.mood;if(m==="upset"||m==="unwell"){x=W*.56+(x-W*.56)*.3;y=H*.48+(y-H*.48)*.4;}else if(m==="tired")y=y*.45+H*.62*.55;
  [T.tx,T.ty]=swSafe(x,y);T.spd=m==="happy"?.9+Math.random()*.4:.7+Math.random()*.45;}
function swMode(m,dur){const T=SW.T;T.mode=m;T.mt=0;T.mdur=dur||0;}
function swBubble(x,y,n,spread){let k=0;for(const b of SW.bubs){if(k>=n)break;if(b.on)continue;b.on=true;
  b.lm=SW.dark?1:0;if(SW.rm){const bx=x+(k%2?7:-5)+(Math.random()-.5)*4,by=y-8-k*10,s=.6+Math.random()*.5;b.el.style.transition="opacity .6s ease";b.el.style.transform=`translate3d(${(bx-4.5).toFixed(1)}px,${(by-4.5).toFixed(1)}px,0) scale(${s.toFixed(2)})`;b.el.style.opacity=".85";
    setTimeout(()=>{b.el.style.opacity="0";setTimeout(()=>{b.on=false;b.el.style.transition="";},650);},1600+k*120);k++;continue;}b.age=-k*.11;b.x0=x+(Math.random()-.5)*(spread||8);b.x=b.x0;b.y=y;b.vy=16+Math.random()*12;b.s=.55+Math.random()*.6;b.ph=Math.random()*6;b.a=0;if(SW.dark){const an=Math.random()*6.283,sp=12+Math.random()*24;b.vx=Math.cos(an)*sp;b.vy2=Math.sin(an)*sp*.8-4;b.age=-k*.03;b.life=1.1+Math.random()*.7;b.x0=b.x=x;b.y=y;b.s=.45+Math.random()*.5;}k++;}if(SW.dark&&n>=3&&!SW.rm)SWL.fl=1;}
function swRing(x,y){if(SW.rm)return;const r=SW.parts.rings.find(r=>!r._busy)||SW.parts.rings[0];r._busy=true;try{r.animate([{transform:`translate3d(${x}px,${y}px,0) scale(.3)`,opacity:.8},{transform:`translate3d(${x}px,${y}px,0) scale(1.6)`,opacity:0}],{duration:1400,easing:"cubic-bezier(.2,.6,.3,1)"}).onfinish=()=>{r._busy=false;};}catch(e){r._busy=false;}}
function swSound(n){try{if(!navigator.userActivation||navigator.userActivation.hasBeenActive)Sound.bubbles(n);}catch(e){}}
function swTap(e){const T=SW.T,r=SW.el.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;SW.rect=r;
  const k=.62*T.scale*swHs(),hx=(x-T.x)/(44*k),hy=(y-T.y)/(24*k),hit=hx*hx+hy*hy<1;
  if(SW.rm){if(hit){swGlow(T.x,T.y);swMouth(1,2600);swBubble(T.x+22*T.face,T.y-10,3);swStatic();swSound(3);}else swFdRM(x,y);return;}
  if(hit){if(T.mode!=="spin"&&T.mode!=="loop"){swMode("spin",1.5);T.spin=0;swBubble(T.x+20*T.face,T.y-8,5,12);swMouth(1,2600);swSound(3);}}
  else{T.pend=null;swFdDrop(x,y);}
  swGo();}
function swMouth(v,ms){const T=SW.T;T.mouth=v;clearTimeout(SW.mto);if(ms)SW.mto=setTimeout(()=>{T.mouth=0;if(SW.rm||!SW.run)swStatic();},ms);}
function swGlow(x,y,ms){const g=SW.parts.glow;g.style.transform=`translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;g.style.opacity="1";clearTimeout(SW.gto);SW.gto=setTimeout(()=>{g.style.opacity="0";},ms||1600);}
/* reduced motion: she fades out and back in at the new spot instead of swimming there */
/* a happy loop-the-loop */
function swJoy(ms){const T=SW.T;swMode("loop",2.6);const f=T.faceT<0?-1:1,r=15,cx=swClamp(T.x,Math.min(SW.W*.5,250),SW.W-40),cy=swClamp(T.y-r,36,Math.max(36,SW.H-44-r));T.loop={cx,cy,r,f,sx:T.x,sy:T.y};T.faceT=f;swMouth(1,ms||2600);}
var SWX_SP={happy:31,calm:15,upset:15,tired:12,unwell:14};
var SWM={n:"M93.6 35.2q3.2 2.4 6.4-.4",happy:"M93 34.3q3.8 4.6 7.6-.3q-3.8 1.2-7.6.3z",calm:"M94 35.3q2.9 1.7 5.8-.3",upset:"M94.2 36.9q2.9-2.1 5.8-.1",tired:"M94.2 35.9q2.9.7 5.8-.2",unwell:"M93.8 35.6q1.6-1 3.2 0t3.2 0"};
function swShEye(ex){const x=92,y=28.6,rx=3.3,ry=3.7;
  if(ex==="happy")return `<g class="y-pu"></g><path class="p-eh" d="M88.9 30Q92 24.5 95.1 30"/>`;
  let o=`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff"/><g class="y-pu"><circle class="p-ey" cx="92.8" cy="29" r="2"/><circle cx="93.5" cy="28.1" r=".72" fill="#fff"/></g>`;
  const f=LU_LID[ex];if(f){const [a,b]=luLidD(x,y,rx+.35,ry+.35,f,1.5);o+=`<path class="p-lid" d="${a}"/><path class="p-lsh" d="${b}"/>`;}
  return o;}
function swShBrow(ex){return ex==="upset"||ex==="unwell"?`<path class="p-brw" d="M89.2 23.6Q91.4 21.4 94.4 22.2"/>`:"";}
function swExSet(ex){const T=SW.T,P=SW.parts,d=SW.el;if(!T||!P||!d)return;const prev=SW.ex;SW.ex=ex;T.mood=ex;d.dataset.ex=ex||"none";
  swRegen(P.Q.e1,`<g class="g-ey">${swShEye(ex)}</g>${swShBrow(ex)}`);swRegen(P.Q.e2,`<g class="g-ey2">${swShEye(ex)}</g>${swShBrow(ex)}`);
  P.ey=P.Q.e1.querySelector(".g-ey");P.Q.ey2=P.Q.e2.querySelector(".g-ey2");P.Q.pu1=P.Q.e1.querySelector(".y-pu");P.Q.pu2=P.Q.e2.querySelector(".y-pu");
  if(P.L&&P.LQ){d.querySelectorAll(".swl .z-e1,.swl .z-e2").forEach(g=>swRegen(g,`<g class="l-eb">${luEye(ex)}</g>${luBrow(ex)}`));P.L.eb=[...d.querySelectorAll(".swl .l-eb")];P.L.pu=[...d.querySelectorAll(".swl .l-pu")];}
  if(prev==="upset"&&ex!=="upset"){clearTimeout(SW.gto);P.glow.style.opacity="0";}
  T.yawnT=-1;T.yawn=0;T.nextYawn=ex==="tired"?4:9;T.nextJoy=ex==="happy"?14:0;
  if(SW.rm)swStatic();else if(!SW.run)swDraw();}
function swExStep(T,dt,sp){
  if(T.mood==="tired"&&!SW.rm){if(T.yawnT>=0){T.yawnT+=dt;const k=T.yawnT/2.8;T.yawn=k>=1?0:k<.35?swE.s(k/.35):k<.68?1:1-swE.s((k-.68)/.32);if(k>=1){T.yawnT=-1;T.nextYawn=10+Math.random()*8;}}
    else{T.nextYawn=(T.nextYawn==null?6:T.nextYawn)-dt;if(T.nextYawn<=0&&/wander|glide|hover|rest/.test(T.mode))T.yawnT=0;}
    if(T.yawn>0)T.blink=Math.max(T.blink,Math.min(.82,T.yawn*1.1));}
  else T.yawn=0;
  const ht=T.mood==="happy"&&!SW.rm&&!/loop|spin|rest|settle|breathe/.test(T.mode)?-2.6*Math.abs(Math.sin(T.ph*Math.PI))*Math.min(1,.4+sp/26):0;T.hop=(T.hop||0)+(ht-(T.hop||0))*Math.min(1,dt*12);
  if(T.mood==="happy"&&!SW.rm){T.nextJoy=(T.nextJoy||16)-dt;if(T.nextJoy<=0&&T.mode==="wander"&&!T.pointer&&SW.W>200){T.nextJoy=18+Math.random()*12;swJoy();}}}
/* draw: the only place that writes to the DOM each frame */
function swDraw(){const T=SW.T,P=SW.parts,a=T.amp,ph=T.ph,yw=swYawOf(T),c=Math.cos(yw),s=Math.sin(yw),sg=c<0?-1:1;
  /* front flippers: slow recovery (up), firmer power stroke (down and back) */
  if(SW.showT!==false){const p=ph%1;let st;if(p<.56)st=38-70*swE.s(p/.56);else st=-32+70*swE.io((p-.56)/.44);
  const glide=6,nf=glide+(st-glide)*a;const p2=(ph+.94)%1;let st2;if(p2<.56)st2=38-70*swE.s(p2/.56);else st2=-32+70*swE.io((p2-.56)/.44);const ff=glide+(st2-glide)*a*.85;
  const rud=swClamp(T.pv*.08,-14,14),rr=Math.sin((ph+.3)*6.283)*10*a+rud;
  const bob=-1.4*a*Math.sin(ph*6.283-.6);
  const hd=swClamp(T.look,-16,16)+2.5*a*Math.sin(ph*6.283+1.2);
  swSet(P.nf,"t",`rotate(${nf.toFixed(1)} 66 40)`);swSet(P.ff,"t",`rotate(${ff.toFixed(1)} 62 34)`);
  swSet(P.nr,"t",`rotate(${rr.toFixed(1)} 25 38)`);swSet(P.fr,"t",`rotate(${(rr*.8).toFixed(1)} 23 33)`);
  swSet(P.body,"t",`translate(0 ${bob.toFixed(2)})`);
  const bl=Math.max(.08,1-T.blink),eb=bl>.98?"":`translate(0 ${(28.6*(1-bl)).toFixed(2)}) scale(1 ${bl.toFixed(2)})`;swSet(P.ey,"t",eb);swSet(P.Q.ey2,"t",eb);
  const mq=T.mouth===1?"happy":T.mouth===2?"unwell":T.mood;swSet(P.mo,"d",SWM[mq]||SWM.n);const mf=mq==="happy"?"var(--sw-eye)":"none";if(SW._mf!==mf){SW._mf=mf;P.mo.style.fill=mf;}
  const yn=Math.max(T.yawn||0,(T.bite||0)*1.25),mop=yn>.02?Math.max(0,1-yn*2).toFixed(2):"1";if(SW._mop!==mop){SW._mop=mop;P.mo.style.opacity=mop;}swSet(P.yw,"t",yn>.02?`translate(97 36.4) scale(${(.55+.45*yn).toFixed(2)} ${yn.toFixed(2)}) translate(-97 -36.4)`:"scale(0)");
  swT3(T,P.Q,c,s,sg,hd);
  swSet(P.t,"transform",swOuter(T,c,s));}if(SW.showL)swDrawL(c,s,sg);
  if(T.mood==="upset"&&!SW.rm){const g=P.glow,v=`translate3d(${T.x.toFixed(0)}px,${T.y.toFixed(0)}px,0)`;if(g._v!==v){g._v=v;g.style.transform=v;}if(g.style.opacity!==".75"&&g.style.opacity!=="0.75"){clearTimeout(SW.gto);g.style.opacity=".75";}}
  const cam=T.cam;swSet(P.far,"transform",`translate3d(${(cam*.3).toFixed(1)}px,0,0)`);swSet(P.mid,"transform",`translate3d(${(cam*.6).toFixed(1)}px,0,0)`);swSet(P.near,"transform",`translate3d(${(cam*1.1).toFixed(1)}px,0,0)`);
  if(SWF.a.length&&!SW.rm)swFdDraw();
  for(const b of SW.bubs){if(!b.on&&!b.vis)continue;if(!b.on){b.el.style.opacity="0";b.el.style.visibility="hidden";b.vis=false;continue;}if(b.age<0)continue;if(!b.vis)b.el.style.visibility="";b.vis=true;
    b.el.style.transform=`translate3d(${(b.x-4.5).toFixed(1)}px,${(b.y-4.5).toFixed(1)}px,0) scale(${(b.s*(1+Math.min(.25,b.age*.08))).toFixed(2)})`;b.el.style.opacity=b.a.toFixed(2);}}
/* lumi: 3D turning. Each part sits at a depth (Z, toward the viewer when she faces right) and is projected
   through a yaw angle: x' = x0 + (x-x0)cos - Z sin, z' = (x-x0)sin + Z cos; nearer parts sit a little lower
   (the camera looks slightly down). Parts swap draw layers as they pass behind or in front of the body. */
const SWP={tl:.14};
function swYawOf(T){return T.yaw==null?(T.face<0?Math.PI:0):T.yaw;}
function swPj(el,px,py,Z,a,c,s,x0,d,zr){const zp=(px-x0)*s+Z*c,X=x0+(px-x0)*c-Z*s,Y=py+SWP.tl*(zp-(zr==null?Z:zr));d=d||1;
  swSet(el,"t",`matrix(${a.toFixed(3)} 0 0 ${d.toFixed(3)} ${(X-a*px).toFixed(2)} ${(Y-d*py).toFixed(2)})`);return zp;}
function swOuter(T,c,s){const sc=.62*T.scale*swHs(),pf=1-.12*Math.min(1,Math.abs(T.pitch)/46),bank=swClamp(-(T.yv||0)*1.3,-9,9),rot=T.pitch*c+bank+T.wig+(T.spin||0);
  return `translate3d(${(T.x-56).toFixed(1)}px,${(T.y-36+(T.hop||0)).toFixed(1)}px,0) rotate(${rot.toFixed(1)}deg) scale(${(sc*pf).toFixed(3)},${(sc*(1-.05*s)).toFixed(3)})`;}
function swT3(T,Q,c,s,sg,hd){const x0=50,kb=Math.sqrt(c*c+.36*s*s),es=v=>swClamp(v,.42,1),eo=v=>swClamp((v+.12)/.3,0,1),[oa,ob]=swMirW(c);
  /* shell: an ellipsoid, so head-on it keeps about 60% of its length as width; the side turning away darkens, the front catches light */
  swPj(Q.sh,48.25,30,0,kb,c,s,x0);swPj(Q.sh2,48.25,30,0,-kb,c,s,x0);swOpv(Q.sh,oa);swOpv(Q.sh2,ob);swSet(Q.shd,"opacity",(.4*s).toFixed(2));swSet(Q.shn,"opacity",(.22*s).toFixed(2));
  swPj(Q.tl,17,38,0,c,c,s,x0);
  for(const f of Q.fl){const zq=(f.px-x0)*s+f.Z*c,zp=swPj(f.w,f.px,f.py,f.Z,c+f.sd*.55*s,c,s,x0,1+.07*swClamp(zq/Math.abs(f.Z),-1.6,1.6));swOpv(f.u,swSs((zp+5)/10));}
  /* head: comes round toward the viewer mid-turn; both eyes show, pupils look where she is heading */
  const kh=Math.sqrt(c*c+.3*s*s),hx=x0+(76-x0)*c,dyH=(T.pitch*.13+hd*.12)*s;
  swSet(Q.hd,"t",`translate(0 ${dyH.toFixed(2)}) rotate(${(hd*c).toFixed(1)} ${hx.toFixed(1)} 33)`);swOpv(Q.hdU,swSs((s-.35)/.3));
  swPj(Q.hs,86.5,31,0,kh*(1+.1*s),c,s,x0,1+.1*s);swPj(Q.hs2,86.5,31,0,-kh*(1+.1*s),c,s,x0,1+.1*s);swOpv(Q.hs,oa);swOpv(Q.hs2,ob);
  const v1=.55*s+c,v2=.55*s-c;swPj(Q.e1,92,28.6,5.5,es(v1),c,s,x0,1,5.5);swPj(Q.e2,92,28.6,-5.5,es(v2),c,s,x0,1,5.5);swSet(Q.e1,"opacity",eo(v1).toFixed(2));swSet(Q.e2,"opacity",eo(v2).toFixed(2));
  const pu=`translate(${(.8*c-.8).toFixed(2)} ${(swClamp(hd,-16,16)*.04).toFixed(2)})`;swSet(Q.pu1,"t",pu);swSet(Q.pu2,"t",pu);
  const w1=.7*s+c,w2=.7*s-c;swPj(Q.c1,95.5,34,5,es(w1),c,s,x0,1,5);swPj(Q.c2,95.5,34,-5,es(w2),c,s,x0,1,5);swSet(Q.c1,"opacity",eo(w1).toFixed(2));swSet(Q.c2,"opacity",eo(w2).toFixed(2));
  {const m=Math.min(1.15,Math.abs(c)+.8*s);swPj(Q.mo,96.8,35,0,m,c,s,x0);swPj(Q.mo2,96.8,35,0,-m,c,s,x0);swOpv(Q.mo,oa);swOpv(Q.mo2,ob);}}
/* turnfix: continuous turning. A side-view drawing mirrored at head-on (scale +k to -k) pops, so near head-on the part
   cross-fades with a mirrored <use> twin; a part that changes layer has a back copy and a front <use> copy and fades
   between them. Weights depend only on the yaw, so the turn is continuous both ways and costs nothing when settled. */
const SWNS="http://www.w3.org/2000/svg";
function swSs(t){t=t<0?0:t>1?1:t;return t*t*(3-2*t);}
function swMirW(c){const w=swSs((c+.25)/.5);return [Math.min(1,2*w),Math.min(1,2*(1-w))];}
function swThin(c){const m=.14;return Math.abs(c)>=m?c:m*Math.sin(c/m*Math.PI/2);}
function swOpv(el,o){if(!el)return;const v=o.toFixed(2),dp=o>.004?"":"none";if(el._ov!==v){el._ov=v;el.style.opacity=v;}if(el._dp!==dp){el._dp=dp;el.style.display=dp;if(!dp&&el._to)swTwShow(el);}}
/* useblack: the twins are real DOM clones, not <use>. Safari matches the page's class rules (.swt .p-fl{fill:..}) against a
   <use> tree's clones and they fail, so the copies drew black mid-turn. A real clone keeps its classes, so the same CSS applies.
   One MutationObserver writes every change of an original (transform, d, style, class, swapped eyes/mouth) through to its
   clones in the same microtask, i.e. before the frame paints. The draw code still writes only the originals. */
var SWTW={mo:null,q:[]};
function swTw(o,w){SWTW.q.push([o,w]);return w;}
function swTwLink(o,c,w){c.removeAttribute("id");c._src=o;c._w=w;(o._tw||(o._tw=[])).push(c);for(let a=o.firstElementChild,b=c.firstElementChild;a&&b;a=a.nextElementSibling,b=b.nextElementSibling)swTwLink(a,b,w);}
function swTwDrop(c){const o=c._src,t=o&&o._tw;if(t){const i=t.indexOf(c);if(i>=0)t.splice(i,1);}for(let k=c.firstElementChild;k;k=k.nextElementSibling)swTwDrop(k);}
function swTwSync(recs){let rb=null;
  for(const r of recs){const o=r.target,tw=o._tw;if(!tw||!tw.length)continue;
    if(r.type==="childList"){(rb||(rb=new Set())).add(o);continue;}
    const n=r.attributeName;if(n==="id")continue;const v=o.getAttribute(n);
    for(const c of tw){if(c._w&&c._w._dp==="none")continue;if(v==null)c.removeAttribute(n);else if(c.getAttribute(n)!==v)c.setAttribute(n,v);}}
  if(rb)for(const o of rb)for(const c of o._tw.slice()){for(let k=c.firstElementChild;k;k=k.nextElementSibling)swTwDrop(k);c.textContent="";
    for(let k=o.firstChild;k;k=k.nextSibling){const n=k.cloneNode(true);c.appendChild(n);if(k.nodeType===1)swTwLink(k,n,c._w);}}}
/* a hidden twin is not kept in step (no cost while settled); it is copied fresh the moment it is shown */
function swTwShow(w){const o=w._to,old=w._tc;if(!o)return;if(old){swTwDrop(old);old.remove();}const c=o.cloneNode(true);c.setAttribute("data-tw","");w.appendChild(c);w._tc=c;swTwLink(o,c,w);}
/* clone in reverse order of creation, so a twin that sits inside another original (Shelly's mouth inside her head) is already there when the outer one is copied */
function swTwFill(){if(!SWTW.mo)SWTW.mo=new MutationObserver(swTwSync);
  for(let i=SWTW.q.length-1;i>=0;i--){const [o,w]=SWTW.q[i];w._to=o;swTwShow(w);SWTW.mo.observe(o,{attributes:true,childList:true,subtree:true});}
  SWTW.q.length=0;}
function swMir(el){const g=document.createElementNS(SWNS,"g");while(el.firstChild)g.appendChild(el.firstChild);el.appendChild(g);
  const t=document.createElementNS(SWNS,"g");t.setAttribute("class",(el.getAttribute("class")||"")+"-mir");t.style.display="none";t._dp="none";swTw(g,t);el.after(t);return t;}
function swFinTw(f,F,B,style){const k=document.createElementNS(SWNS,"g");B.appendChild(k);k.appendChild(f.w);f.k=k;const u=document.createElementNS(SWNS,"g");if(style)u.setAttribute("style",style);
  f.u=swTw(f.w,u);u.style.display=u._dp="none";F.appendChild(u);}
function swParts3(d){const q=x=>d.querySelector(x),P=SW.parts,fl=(w,px,py,Z)=>({w:q(w),p:q(w+" path"),px,py,Z,sd:Z>0?1:-1});
  P.Q={sh:q(".y-sh"),shd:q(".p-shd"),shn:q(".p-shn"),tl:q(".y-tl"),F:q(".g-fnt"),B:q(".g-bk"),hd:q(".g-hd"),HF:q(".y-hf"),HB:q(".y-hb"),hs:q(".y-hs"),e1:q(".y-e1"),e2:q(".y-e2"),c1:q(".y-c1"),c2:q(".y-c2"),mo:q(".y-mo"),ey2:q(".g-ey2"),pu1:q(".y-e1 .y-pu"),pu2:q(".y-e2 .y-pu"),
    fl:[fl(".y-nr",25,38,12),fl(".y-nf",66,40,14),fl(".y-ff",62,34,-14),fl(".y-fr",23,33,-12)]};
  P.Q.fl.forEach(f=>{swFinTw(f,P.Q.F,P.Q.B,"--lmf:var(--sw-skin);--lms:var(--sw-skin-d)");if(f.p)f.p.setAttribute("class","p-lm");});
  P.Q.HB.appendChild(P.Q.hd);P.Q.hdU=swTw(P.Q.hd,document.createElementNS(SWNS,"g"));P.Q.hdU.style.display=P.Q.hdU._dp="none";P.Q.HF.appendChild(P.Q.hdU);
  P.Q.sh2=swMir(P.Q.sh);P.Q.hs2=swMir(P.Q.hs);P.Q.mo2=swMir(P.Q.mo);
  const l=x=>d.querySelector(".swl "+x),la=x=>[...d.querySelectorAll(".swl "+x)];
  P.LQ={bd:l(".z-bd"),shd:l(".l-shd"),shn:l(".l-shn"),tl:l(".z-tl"),dor:l(".z-dor"),an:l(".z-an"),e1:l(".z-e1"),e2:l(".z-e2"),c1:l(".z-c1"),c2:l(".z-c2"),mo:l(".z-mo"),pec2:l(".l-pec2"),ha:l(".z-ha"),F:l(".l-fr"),B:l(".l-bk"),
    fl:[{w:l(".z-pc"),px:66,py:42.4,Z:8,sd:1},{w:l(".z-pc2"),px:66,py:42.4,Z:-8,sd:-1}]};
  {const lu=l(".l-lu"),zl=document.createElementNS(SWNS,"g");zl.setAttribute("class","z-lu");if(lu){zl.appendChild(lu);P.LQ.F.before(zl);}}
  P.LQ.fl.forEach(f=>swFinTw(f,P.LQ.F,P.LQ.B));
  P.LQ.bd2=swMir(P.LQ.bd);P.LQ.mo2=swMir(P.LQ.mo);P.LQ.moI=P.LQ.mo.firstElementChild;
  P.L={body:l(".l-body"),tail:l(".l-tail"),cau:l(".l-cau"),pec:l(".l-pec"),dor:l(".l-dor"),an:l(".l-an"),eb:la(".l-eb"),pu:la(".l-pu"),ml:l(".l-ml"),yw:l(".l-yw"),st:l(".l-st"),bu:l(".l-bu"),hb:l(".l-hb"),bg:l(".l-bg"),lit:l(".l-lit"),
    snow:d.querySelector(".swsnow"),pc:la(".l-pc"),pw:la(".l-pw"),ha:[l(".l-ha")],hw:[l(".l-hw")]};
  swTwFill();}
/* the whole swimmer box in px around (T.x,T.y), so a target keeps her fully in view */
function swBox(){const T=SW.T,W=SW.W,H=SW.H,k=.62*(T.scale||1)*swHs(),hw=Math.min(54*k,W/2-1),t=Math.min(25*k,H/2-1),b=Math.min(31*k,H/2-1);return {x0:hw,x1:W-hw,y0:t,y1:H-b,hw,t,b};}
/* a tap goes exactly where it lands, unless that would put her under the title chip: then the nearest clear spot */
function swPf(T,now){return !!(T.pointer&&now-T.pointer.at<4000&&(!T.tap||Math.hypot(T.pointer.x-T.tap.px,T.pointer.y-T.tap.py)>24));}
function swStatic(){const T=SW.T;if(!SW.el)return;if(T.mode==="enter"||T.x<0){T.mode="wander";[T.x,T.y]=swSafe(SW.W*.68,SW.H*.42);T.face=-1;}T.face=T.face<0?-1:1;T.faceT=T.face;T.yaw=T.face<0?Math.PI:0;T.yv=0;T.pv=0;T.amp=.35;T.ph=.3;T.vx=T.vy=0;T.pitch=0;T.spin=0;T.wig=0;T.blink=0;T.look=0;T.cam=0;
  const bubs=SW.bubs;SW.bubs=[];swDraw();SW.bubs=bubs;}
function swStep(dt,now){const T=SW.T,W=SW.W,H=SW.H;T.mt+=dt;if(SWF.a.length)swFdStep(dt);T.yx=/feed|bite/.test(T.mode)?9:Math.max(0,(T.yx||0)-dt*10);
  let spd=26,tx=T.tx,ty=T.ty,thr=1,arrive=14,lookT=0;
  if(SWX_SP[T.mood])spd=SWX_SP[T.mood];if(T.yawn>.2)spd*=.5;
  switch(T.mode){
   case "enter":{const ex=Math.min(W*.55,220);if(T.mt<.02){T.x=-40;T.y=H*.45;T.vx=30;}tx=ex;ty=H*.42;spd=34;if(T.x>ex-30){swMode("wander");swPick();}if(T.pointer&&now-T.pointer.at<4000){T.dwell+=dt;if(T.dwell>.45)swMode("seek");}}break;
   case "wander":spd*=T.spd;arrive=28;if(Math.hypot(T.tx-T.x,T.ty-T.y)<arrive)swPick();T.nextAir-=dt;if(T.nextAir<=0&&SW.noAir)T.nextAir=30;if(T.nextAir<=0){swMode("surface");T.tx=swClamp(T.x+T.face*W*.18,50,W-50);T.ty=SW.dark?Math.max(22,H*.27):11;}
     if(T.pointer&&now-T.pointer.at<4000){T.dwell+=dt;if(T.dwell>.45){swMode("seek");}}break;
   case "seek":spd=Math.min(70+W*.08,spd*1.3+Math.hypot(T.tx-T.x,T.ty-T.y)*.3);if(swPf(T,now)){T.tap=null;[T.tx,T.ty]=swSafe(T.pointer.x-T.face*24,T.pointer.y);}tx=T.tx;ty=T.ty;if(Math.hypot(tx-T.x,ty-T.y)<(T.tap?3:26)){swMode("hover",T.pointer?4:2.4);}break;
   case "hover":spd=T.tap?20:8;arrive=40;if(swPf(T,now)){const dx=T.pointer.x-T.x;if(Math.abs(dx)>8)T.faceT=Math.sign(dx);if(Math.hypot(T.pointer.x-T.x,T.pointer.y-T.y)>70){swMode("seek");}}if(T.mt>T.mdur&&!T.pointer){swMode("wander");swPick();}break;
   case "surface":spd*=.85;T.ty=SW.dark?Math.max(22,H*.27):11;tx=T.tx;ty=T.ty;if(T.y<(SW.dark?T.ty+4:15)){swMode("breathe",SW.dark?3:2);if(!SW.dark)swRing(T.x+T.face*22,5);}break;
   case "breathe":spd=4;tx=T.x+T.face*6;ty=SW.dark?T.ty:11;lookT=-14;if(T.mt>T.mdur){T.nextAir=22+Math.random()*16;swMode("wander");T.tx=swClamp(T.x+T.face*W*.25,30,W-30);T.ty=H*.62;T.spd=.8;swBubble(T.x+T.face*14,T.y+4,1);}break;
   case "glide":spd=12;thr=.35;if(Math.hypot(T.tx-T.x,T.ty-T.y)<arrive)swPick();if(T.mt>T.mdur){swMode("wander");swPick();}break;
   case "wiggle":{spd=5;thr=.5;const k=T.mt/T.mdur;T.wig=7*Math.sin(T.mt*6.283*.9)*(1-k)*Math.min(1,T.mt*2);lookT=10*Math.sin(T.mt*3.1);if(T.mt>T.mdur){T.wig=0;swMode("wander");swPick();T.spd=.7;}}break;
   case "settle":spd=24;tx=T.tx;ty=T.ty;if(Math.hypot(tx-T.x,ty-T.y)<10){swMode("rest",8);swGlow(T.x,T.y,8000);T.faceT=T.x>W/2?-1:1;swBubble(T.x+T.face*20,T.y-8,1);}break;
   case "rest":spd=2;thr=.22;tx=T.x;ty=T.ty+Math.sin(T.mt*.9)*2;if(Math.abs(T.mt-3.5)<dt)swBubble(T.x+T.face*20,T.y-8,1);if(T.mt>T.mdur){T.scaleT=1;swMode("glide",5);swPick();}break;
   case "spin":{const k=Math.min(1,T.mt/T.mdur);T.spin=-(T.face<0?-1:1)*360*swE.io(k);spd=6;thr=1.4;if(k>=1){T.spin=0;swMode(T.pointer?"hover":"wander",2);swPick();}}break;
   case "feed":{const f=SWF.cur,M=swFdMood(T);tx=T.x;ty=T.y;spd=6;
     if(!f||!SWF.a.includes(f)||f.die||f.eat||f.skip||T.mt>14||swFdChip(f.x,f.y-6)){if(f&&!f.eat)f.skip=1;swFdNext();break;}
     T.fdR=(T.fdR||0)-dt;if(T.fdR<=0){T.fdR=.2;swFdPlan(f,M);}
     const [mx,my]=swMouthXY(),d=Math.hypot(f.x-mx,f.y-my),dT=Math.hypot(T.tx-T.x,T.ty-T.y),go=T.mt>=M[0];
     lookT=swClamp(Math.atan2(f.y-T.y,(f.x-T.x)*(T.face<0?-1:1))*57.3,-16,16);
     if(!go){spd=5;thr=.5;tx=T.x+T.vx*.1;if(Math.abs(f.x-T.x)>10)T.faceT=Math.sign(f.x-T.x);}
     else{spd=Math.min(M[1]*(1+Math.min(W,1200)/1000),14+dT*1.6);tx=T.tx;ty=T.ty;thr=M[2];T.faceT=dT>36&&Math.abs(T.vx)>6?Math.sign(T.vx):(T.fdFace||T.faceT);}
     T.bite=(T.bite||0)+((go&&d<26?1:0)-(T.bite||0))*Math.min(1,dt*9);
     T.fdStuck=dT<5?(T.fdStuck||0)+dt:0;
     if(go&&(d<9||(d<14&&T.fdStuck>1.2)||(d<28&&T.fdStuck>3)))swFdBite(f);}break;
   case "bite":{spd=4;thr=.5;tx=T.x+T.vx*.05;ty=T.y;const k=Math.min(1,T.mt/T.mdur);let b;
     if(k<.15)b=T.bite0+(1-T.bite0)*swE.s(k/.15);else if(k<.3)b=1-swE.s((k-.15)/.15);else if(k<.45)b=0;else if(k<.6)b=.35*swE.s((k-.45)/.15);else if(k<.75)b=.35*(1-swE.s((k-.6)/.15));else b=0;T.bite=b;
     if(k>=.3&&!T.fdHap){T.fdHap=1;swFdYum();}
     if(k>=1){T.bite=0;swFdNext();}}break;
   case "loop":{const L=T.loop,k=Math.min(1,T.mt/T.mdur),th=6.283*swE.io(k),m=Math.min(1,T.mt/.5),mm=swE.s(m);T.x=(L.cx+L.f*L.r*Math.sin(th))*mm+L.sx*(1-mm);T.y=(L.cy+L.r*Math.cos(th))*mm+L.sy*(1-mm);T.spin=-L.f*th*57.3;T.vx=L.f*30;T.vy=0;thr=1.5;T.faceT=L.f;
     if(SW.dark){L.tr=(L.tr||0)+dt;if(L.tr>.11){L.tr=0;const r=(T.spin+T.pitch)/57.3,f=T.face<0?-1:1;swSpark(T.x-Math.cos(r)*24*f,T.y-Math.sin(r)*24*f);}}if(k>.45&&!L.b){L.b=1;swBubble(T.x,T.y-6,4,14);}if(k>=1){T.spin=0;swBubble(T.x+L.f*16,T.y-10,6,16);swMode("wander");swPick();T.spd=1.1;}}break;}
  /* steering: ease toward the target with a gentle force limit (no sudden fast moves) */
  if(T.mode!=="loop"){const dx=tx-T.x,dy=ty-T.y,dist=Math.hypot(dx,dy)||1,ramp=Math.min(1,dist/(T.mode==="wander"||T.mode==="glide"?22:T.mode==="feed"?16:T.tap?(T.mode==="hover"?10:30):60));
    const pulse=1+.22*T.amp*(T.ph%1>.56?Math.sin(Math.PI*((T.ph%1)-.56)/.44):-.18);
    const sk=T.mode==="seek"||T.mode==="feed"||T.mode==="bite"||!!T.tap,dvx=dx/dist*spd*ramp*pulse,dvy=dy/dist*spd*ramp*pulse*(sk?1:.85),k=1-Math.exp(-dt*(sk?4:1.6));T.vx+=(dvx-T.vx)*k;T.vy+=(dvy-T.vy)*k;
    T.x+=T.vx*dt;T.y+=T.vy*dt;if(T.mode!=="enter"){const bx=swBox();T.x=swClamp(T.x,bx.x0,bx.x1);T.y=swClamp(T.y,/surface|breathe/.test(T.mode)?Math.min(9,bx.y0):bx.y0,bx.y1+(T.yx||0));}
    if(!/hover|rest|feed|bite/.test(T.mode)&&Math.abs(T.vx)>5)T.faceT=Math.sign(T.vx);}
  /* turning: a damped spring on facing, so she rolls through the turn instead of flipping */
  {const yt=T.faceT<0?Math.PI:0;if(T.yaw==null){T.yaw=T.face<0?Math.PI:0;T.yv=0;}const w=6.4,f=yt-T.yaw;T.yv+=(w*w*f-2*w*T.yv)*dt;T.yaw+=T.yv*dt;if(T.yaw<0){T.yaw=0;T.yv=0;}else if(T.yaw>Math.PI){T.yaw=Math.PI;T.yv=0;}if(Math.abs(yt-T.yaw)<.002&&Math.abs(T.yv)<.02){T.yaw=yt;T.yv=0;}T.face=Math.cos(T.yaw);}
  const sp=Math.hypot(T.vx,T.vy);
  {const pt=T.mode==="loop"||T.mode==="spin"?0:swClamp(Math.atan2(T.vy,Math.abs(T.vx)+5)*57.3,-46,46)*Math.min(1,Math.hypot(T.vx,T.vy)/12)+(T.mode==="breathe"?-12:0),w=4.6,f=pt-T.pitch;T.pv+=(w*w*f-2*w*T.pv)*dt;T.pitch+=T.pv*dt;}
  {const w=3,f=T.scaleT-T.scale;T.sv+=(w*w*f-2*w*T.sv)*dt;T.scale+=T.sv*dt;}
  /* strokes: frequency follows effort; amplitude eases so glides feel natural */
  const effort=swClamp(sp/30,0,1.3)*thr,ampT=swClamp(.25+effort*.8,.15,1);T.amp+=(ampT-T.amp)*(1-Math.exp(-dt*2));
  T.ph+=dt*(.28+.62*Math.min(1.2,effort));
  if(T.pointer&&now-T.pointer.at<4000&&/wander|hover|seek/.test(T.mode)){const ang=Math.atan2(T.pointer.y-T.y,(T.pointer.x-T.x)*Math.sign(T.face||1))*57.3;lookT=swClamp(ang,-16,16);}
  if(lookT===0)lookT=swClamp(T.pitch*.35,-12,12);
  T.look+=(lookT-T.look)*(1-Math.exp(-dt*3));
  T.nextBlink-=dt;if(T.nextBlink<=0){T.blink=Math.min(1,T.blink+dt*9);if(T.blink>=1)T.nextBlink=T.mode==="rest"?-0.0001:2.8+Math.random()*3.5;}else T.blink=Math.max(0,T.blink-dt*(T.mode==="rest"?2.5:8));
  if(T.mode==="rest"&&T.blink>=1)T.nextBlink=3.2;
  T.cam+=((W/2-T.x)*.05-T.cam)*(1-Math.exp(-dt*1.2));
  for(const b of SW.bubs){if(!b.on)continue;b.age+=dt;if(b.age<0){if(!b.lm)b.y=T.y-6;continue;}if(b.lm){const q=Math.exp(-dt*2.1);b.vx*=q;b.vy2*=q;b.x0+=b.vx*dt;b.y+=(b.vy2-3)*dt;b.x=b.x0+Math.sin(b.age*2.2+b.ph)*1.2;b.a=Math.min(1,b.age*6)*Math.max(0,1-b.age/b.life)*.95;if(b.age>b.life)b.on=false;continue;}b.vy=Math.min(b.vy+dt*14,46);b.y-=b.vy*dt;b.x=b.x0+Math.sin(b.age*5+b.ph)*2.4*b.s;b.a=Math.min(1,b.age*5)*(b.y<14?Math.max(0,(b.y-4)/10):1)*.9;if(b.y<4){b.on=false;}}
  if(T.pend&&!/spin|loop/.test(T.mode)){const p=T.pend;T.pend=null;T.tap=p;T.tx=p.x;T.ty=p.y;T.spd=1.25;swMode("seek");if(Math.abs(p.x-T.x)>14)T.faceT=Math.sign(p.x-T.x);}
  if(Math.random()<dt*.05&&/wander|glide/.test(T.mode))swBubble(T.x+T.face*22,T.y-6,1);
  if(SWF.a.length&&!/spin|loop|feed|bite|enter/.test(T.mode)&&swFdPick())swFdNext();
  swExStep(T,dt,sp);}
/* feed: tap the water and a bit of food drops in from above at that spot (a splash ring at the surface), then sinks:
   quick at first, slowing in the water, swaying and tipping, down to the tapped depth and then slowly on to the sand,
   where it rests and fades after about 20 s. She notices (head turns), swims to where it WILL be, and eats it with a
   gentle bite. Several drops (up to 6) are eaten nearest-first. Light: kelp flake / gold treat for Shelly;
   dark: a glowing plankton speck for Lumi. Reduced motion: food fades in, she fades over to it, it fades out. */
function swFdMood(T){return ({happy:[.16,76,1.1],calm:[.32,52,.85],upset:[.5,38,.7],tired:[.95,30,.6],unwell:[.6,36,.75]})[T.mood]||[.22,64,1];}
/* where her mouth is on screen, through the same transform as swOuter + the 3D yaw projection */
function swMouthXY(){const T=SW.T,yw=swYawOf(T),c=Math.cos(yw),s=Math.sin(yw),sc=.62*T.scale*swHs(),pf=1-.12*Math.min(1,Math.abs(T.pitch)/46),bank=swClamp(-(T.yv||0)*1.3,-9,9),r=(T.pitch*c+bank+T.wig+(T.spin||0))*.01745;
  const d=SW.dark,mx=d?39:46.8,X=mx*c*sc*pf,Y=((d?9:3)+SWP.tl*mx*s)*sc*(1-.05*s),cr=Math.cos(r),sr=Math.sin(r);return [T.x+X*cr-Y*sr,T.y+(T.hop||0)+X*sr+Y*cr];}
function swFdOff(){const T=SW.T,sc=.62*T.scale*swHs();return [(SW.dark?39:46.8)*sc,(SW.dark?9:3)*sc];}
function swFdChipRect(){SWF.chip=null;try{const lb=SW.el.parentNode&&SW.el.parentNode.querySelector(".cihtxt");if(lb&&lb.offsetWidth){const r0=SW.el.getBoundingClientRect(),q=lb.getBoundingClientRect();SWF.chip={L:q.left-r0.left-4,R:q.right-r0.left+4,T:q.top-r0.top-5};}}catch(e){}}
function swFdChip(x,y){const c=SWF.chip;return !!c&&x>c.L&&x<c.R&&y>c.T;}
/* sinking: drag toward a slow terminal speed (faster above the tapped depth), sway and tip, settle on the sand */
function swFdPhys(o,dt){o.age+=dt;if(!o.rest){const vt=o.y<o.ty?13:4.5;o.vy+=(vt-o.vy)*(1-Math.exp(-dt*2.4));o.y+=o.vy*dt;if(o.y>=o.sy){o.y=o.sy;o.rest=1;o.vy=0;}}
  o.sw+=((o.rest?0:1)-o.sw)*(1-Math.exp(-dt*(o.rest?2.2:.9)));o.x0=swClamp(o.x0+o.dr*o.sw*dt,8,SW.W-8);
  const w=o.age*1.8+o.ph;o.x=o.x0+3.4*o.sw*Math.sin(w);o.rot=o.sw*22*Math.sin(w+1.1)+(1-o.sw)*o.rr;}
function swFdNew(x){let el=SWF.pool.pop();if(!el){el=document.createElement("i");el.className="swfd";el.innerHTML='<b class="fdl"></b><b class="fdk"></b>';SW.el.insertBefore(el,SW.el.querySelector(".swtw"));}
  SWF.n++;el.classList.toggle("v2",SWF.n%3===0);el.style.transition="";el.style.display="";el.style.opacity="0";el._t=el._o=null;
  const H=SW.H,f={el,x0:x,x,y:3,vy:42,ty:H*.5,sy:H-11,age:0,rest:0,sw:0,ph:Math.random()*6.283,dr:(Math.random()-.5)*5,rr:(Math.random()-.5)*50,sc:.4,op:0,rot:0,eat:0,die:0,skip:0};SWF.a.push(f);return f;}
function swFdFree(i){const f=SWF.a[i];SWF.a.splice(i,1);f.el.style.display="none";f.el.style.transition="";SWF.pool.push(f.el);if(SWF.cur===f)SWF.cur=null;}
function swFdSnd(k){try{if(navigator.userActivation&&!navigator.userActivation.hasBeenActive)return;if(k==="drop")Sound.bloop(820,0,.07);else{Sound.bloop(360,0,.1);Sound.bloop(980,.07,.05);}}catch(e){}}
function swFdDrop(x,y){coveFed();const T=SW.T,H=SW.H;x=swClamp(x,8,SW.W-8);swFdChipRect();
  const live=SWF.a.filter(f=>!f.die&&!f.eat);if(live.length>=SWF.max){const o=live.find(f=>f!==SWF.cur)||live[0];o.die=1e-4;}
  const f=swFdNew(x);f.ty=swClamp(y,16,H-11);
  swRing(x,5);swBubble(x,15,2,5);swFdSnd("drop");
  if(!/spin|loop|feed|bite|enter/.test(T.mode))swFdNext();}
function swFdStep(dt){for(let i=SWF.a.length-1;i>=0;i--){const f=SWF.a[i];
  if(f.eat){f.age+=dt;f.eat=Math.min(1,f.eat+dt/(f.ed||.16));const [mx,my]=swMouthXY(),k=swE.s(f.eat);f.x=f.ex+(mx-f.ex)*k;f.y=f.ey+(my-f.ey)*k;f.sc=1-.8*k;f.op=1-k*k;if(f.eat>=1)swFdFree(i);continue;}
  swFdPhys(f,dt);if(!f.die&&swFdChip(f.x,f.y-6))f.die=1e-4;/* sank behind the title chip: let it go */let o=Math.min(1,f.age/.25);
  if(f.die){f.die+=dt;o*=Math.max(0,1-f.die/.4);if(f.die>=.4){swFdFree(i);continue;}}
  else if(f.age>SWF.life){const k=(f.age-SWF.life)/1.5;o*=Math.max(0,1-k);if(k>=1){swFdFree(i);continue;}}
  f.sc=Math.min(1,.4+f.age*3);f.op=o;}}
function swFdDraw(){const dk=SW.dark;for(const f of SWF.a){const e=f.el,t=`translate3d(${f.x.toFixed(1)}px,${f.y.toFixed(1)}px,0) rotate(${f.rot.toFixed(0)}deg) scale(${f.sc.toFixed(2)})`;if(e._t!==t){e._t=t;e.style.transform=t;}
  let o=f.op;if(dk&&!f.eat)o*=.8+.2*Math.sin(f.age*2.4+f.ph);const v=o.toFixed(2);if(e._o!==v){e._o=v;e.style.opacity=v;}}}
/* nearest first (from her mouth, with a nudge for food about to sink behind the title chip); food that has sunk behind the title chip or is about to fade is left alone */
function swFdPick(){const [mx,my]=swMouthXY();let b=null,bd=1e9;for(const f of SWF.a){if(f.eat||f.die||f.skip||f.age>SWF.life-1.5||swFdChip(f.x,f.y-6))continue;let d=Math.hypot(f.x-mx,f.y-my);const c=SWF.chip;if(c&&f.x>c.L&&f.x<c.R){const tc=(c.T+6-f.y)/Math.max(f.vy,4);d-=Math.max(0,4-tc)*25;}/* about to sink behind the chip: a little sooner */if(d<bd){bd=d;b=f;}}return b;}
function swFdNext(){const T=SW.T,f=swFdPick(),was=/feed|bite/.test(T.mode);SWF.cur=f;T.fdFace=0;T.fdStuck=0;
  if(f){swMode("feed");T.fdR=0;T.tap=null;if(was)T.mt=Math.max(0,swFdMood(T)[0]-.12);return true;}
  T.bite=0;if(!was)return false;
  if(T.mood==="upset"){swMode("settle");[T.tx,T.ty]=swSafe(SW.W*(SW.W>500?.55:.62),SW.H*.5);T.spd=.8;}else{swMode("hover",1.4);T.tx=T.x;T.ty=Math.min(T.y,swBox().y1);}return false;}
/* intercept: step a copy of the food forward and take the first point she can reach in time (mouth on the food) */
function swFdPlan(f,M){const T=SW.T,b=swBox(),[ox,oy]=swFdOff(),v=.62*M[1]*(1+Math.min(SW.W,1200)/1000),wait=Math.max(0,M[0]-T.mt);
  let fc=T.fdFace||(f.x>=T.x?1:-1);if((f.x-T.x)*fc<-ox*.4)fc=-fc;
  const o={x0:f.x0,x:f.x,y:f.y,vy:f.vy,age:f.age,rest:f.rest,sw:f.sw,ty:f.ty,sy:f.sy,ph:f.ph,dr:f.dr,rr:f.rr,rot:0};let best=null;
  for(let i=0;i<=50;i++){if(i)swFdPhys(o,.12);if(best&&swFdChip(o.x,o.y-2))break;
    let c=fc,x=o.x-ox*c;if(x<b.x0||x>b.x1){c=-c;x=o.x-ox*c;}x=swClamp(x,b.x0,b.x1);const y=swClamp(o.y-oy,b.y0,b.y1+9);
    best={x,y,c};if(Math.hypot(x-T.x,y-T.y)/v+wait<=i*.12)break;}
  if(best){T.tx=best.x;T.ty=best.y;T.fdFace=best.c;}}
function swFdBite(f){const T=SW.T,slow=/upset|tired|unwell/.test(T.mood||"");f.eat=1e-4;f.ex=f.x;f.ey=f.y;f.ed=slow?.2:.15;T.bite0=T.bite||0;T.fdHap=0;swMode("bite",slow?.85:.66);}
function swFdYum(){const T=SW.T,[mx,my]=swMouthXY(),f=T.face<0?-1:1,calm=/upset|tired|unwell/.test(T.mood||"");
  swBubble(mx+f*3,my-3,2,6);if(SW.dark)SWL.fl=Math.max(SWL.fl||0,calm?.35:.6);swMouth(1,calm?750:1150);T.sv+=calm?.18:.32;swFdSnd("eat");}
/* reduced motion: no swimming. The food fades in where tapped; she fades out and back in beside it; it fades as she eats */
function swFdRM(x,y){coveFed();const H=SW.H;x=swClamp(x,8,SW.W-8);y=swClamp(y,14,H-11);if(SWF.a.length>=SWF.max)return;swFdChipRect();
  const f=swFdNew(x);Object.assign(f,{x,y,ty:y,vy:0,sc:1,op:1,rot:f.rr*.5});const e=f.el;e.style.transform=`translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) rotate(${f.rot.toFixed(0)}deg)`;
  void e.offsetWidth;e.style.transition="opacity .5s ease";e.style.opacity=".95";swFdSnd("drop");SWF.q.push(f);if(!SWF.rmB)swFdRMNext();}
function swFdRMNext(){const f=SWF.q.shift();if(!f){SWF.rmB=0;return;}if(!SWF.a.includes(f)){swFdRMNext();return;}SWF.rmB=1;const T=SW.T,tm=T.mood==="tired"?1.6:1;
  clearTimeout(SW.fdto);SW.fdto=setTimeout(()=>{swOp("0");SW.fdto=setTimeout(()=>{
    const b=swBox(),[ox,oy]=swFdOff();let c=f.x>=T.x?1:-1,x=f.x-ox*c;if(x<b.x0||x>b.x1){c=-c;x=f.x-ox*c;}
    if(T.mode==="enter"||T.x<0)T.mode="wander";T.x=swClamp(x,b.x0,b.x1);T.y=swClamp(f.y-oy,b.y0,b.y1+9);T.face=c;swStatic();swOp("1");
    SW.fdto=setTimeout(()=>{f.el.style.opacity="0";swMouth(1,1600);const [mx,my]=swMouthXY();swBubble(mx,my-4,2);swFdSnd("eat");swStatic();
      SW.fdto=setTimeout(()=>{const i=SWF.a.indexOf(f);if(i>=0)swFdFree(i);swFdRMNext();},650);},650*tm);},480);},450*tm);}
function swFrame(now){SW.raf=0;if(!SW.run)return;if(!SW.el.isConnected){swGo();return;}const dt=Math.min(.08,Math.max(0,(now-(SW.last||now))/1000));SW.last=now;swStep(dt,now);if(now-(SW.scT||0)>180||(SW.fc=(SW.fc||0)+1)%2)swDraw();SW.raf=requestAnimationFrame(swFrame);}
addEventListener("scroll",()=>{SW.scT=performance.now();},{passive:true,capture:true});
function swGo(){const on=!!(SW.el&&SW.el.isConnected&&SW.vis&&!document.hidden&&!SW.rm);if(SW.el)SW.el.classList.toggle("off",!on);
  if(on&&!SW.run){SW.run=true;SW.last=0;if(!SW.raf)SW.raf=requestAnimationFrame(swFrame);}else if(!on&&SW.run){SW.run=false;if(SW.raf){cancelAnimationFrame(SW.raf);SW.raf=0;}}}
document.addEventListener("visibilitychange",swGo);
try{const mq=matchMedia("(prefers-reduced-motion: reduce)");SW.rm=mq.matches;const f=()=>{SW.rm=mq.matches;if(SW.rm){SW.run&&(SW.run=false);if(SW.raf){cancelAnimationFrame(SW.raf);SW.raf=0;}SW.bubs.forEach(b=>{b.on=false;b.el.style.opacity="0";});swStatic();}swGo();};mq.addEventListener?mq.addEventListener("change",f):mq.addListener(f);}catch(e){}

/* ---------- Coral Cove glue: connects the swim module above to the app (theme, where the swimmer sits, the feeding tip) ---------- */
function themeNow(){var t=document.documentElement.dataset.theme;if(t==="dark"||t==="light")return t;try{return matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}catch(e){return "light";}}
function swChipRect(){const d=SW.el,lb=d&&d.parentNode&&d.parentNode.querySelector(".cihtxt");if(lb&&lb.offsetWidth){SW.lbR=lb.offsetLeft+lb.offsetWidth+30;SW.lbT=lb.offsetTop;}else{SW.lbR=0;SW.lbT=0;}}
var COVE_FED_K="cc-fed";
function coveFedYet(){try{return localStorage.getItem(COVE_FED_K)==="1";}catch(e){return false;}}
/* the "tap the water" tip stays until she has been fed once on this device, then fades away */
function coveFed(){if(coveFedYet())return;try{localStorage.setItem(COVE_FED_K,"1");}catch(e){}
  const c=SW.el&&SW.el.parentNode&&SW.el.parentNode.querySelector(".cihtxt");if(c){c.classList.add("bye");setTimeout(()=>{if(c.parentNode)c.remove();swChipRect();},450);}}
function coveSwimName(){return themeNow()==="dark"?"Lumi":"Shelly";}
/* hosts: <div class="cove-water" data-cw="home|frame"> in any screen; the one swimmer moves into whichever is on screen */
function coveWaterHTML(kind,label){const tip=!coveFedYet()?`<div class="cihtxt"><b>${label||("Tap the water to feed "+coveSwimName())}</b></div>`:"";
  return `<div class="cove-water cw-${kind}" data-cw="${kind}" role="img" aria-label="${coveSwimName()} swimming. Tap ${coveSwimName()} or the water to play.">${tip}</div>`;}
function coveWaterMount(){const host=document.querySelector(".cove-water");if(!host){if(SW.el&&SW.el.isConnected)SW.el.remove();swGo();return;}
  if(!SW.el){swBuild();}
  SW.noAir=host.dataset.cw==="home";
  if(SW.el.parentNode!==host){host.prepend(SW.el);SW.rect=null;clearTimeout(SW.cto);SW.cto=setTimeout(swChipRect,80);/* measured after the screen has drawn, never forcing a layout mid-render */if(SW.rm)swStatic();}
  swTheme();swGo();}
/* a happy loop-the-loop, used at the end of a round */
function coveSwimJoy(happy){if(!SW.el||!SW.T)return;try{swExSet(happy?"happy":null);if(SW.rm){swMouth(1,3000);swBubble(SW.T.x+20*SW.T.face,SW.T.y-8,4);swGlow(SW.T.x,SW.T.y);swStatic();return;}
  const go=()=>{if(SW.el&&SW.el.isConnected&&SW.T.mode!=="enter"){swJoy(3200);swGo();}else setTimeout(go,400);};setTimeout(go,700);}catch(e){}}
function coveSwimCalm(){if(SW.el&&SW.T&&SW.ex){try{swExSet(null);}catch(e){}}}
/*SWIM:END*/
