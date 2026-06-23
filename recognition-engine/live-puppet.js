/*
 * <live-puppet> — a portrait that mirrors a visitor's face in real time, fully
 * in the browser. No Python, no heavy model: it reuses the MediaPipe
 * FaceLandmarker already loaded for <wink-portrait> and drives the portrait
 * with lightweight CSS transforms + overlays.
 *
 *   <live-puppet src="assets/warhol-portrait.jpeg" cover></live-puppet>
 *   import './live-puppet.js';
 *   const el = document.querySelector('live-puppet');
 *   el.drive({ roll, yaw, pitch, jawOpen, blinkL, blinkR }); // each video frame
 *   el.rest();                                               // relax to neutral
 *
 * This is a STYLIZED puppet, not photoreal reenactment: it blinks, opens the
 * mouth, and tilts / turns the head to match the visitor. It is the real-time
 * effect that actually runs on weak hardware (Intel HD integrated graphics),
 * where server-side LivePortrait cannot keep up.
 *
 * Design split:
 *   - The DRIVING LOOP (in the app) does perception: visitor landmarks/blendshapes
 *     → a normalized signal object. It calls drive() with that signal.
 *   - This ELEMENT does rendering: signal → portrait deformation. It eases
 *     toward the latest signal on its own rAF, so a low/irregular driving rate
 *     still looks smooth.
 *
 * Signal fields (all optional; absent = neutral):
 *   roll    head tilt,  ~[-1..1]  (visitor's, normalized; +1 ≈ 25° tilt)
 *   yaw     head turn,  ~[-1..1]  (+1 ≈ turn to their left)
 *   pitch   head nod,   ~[-1..1]  (+1 ≈ chin up)
 *   jawOpen mouth open, [0..1]    (MediaPipe jawOpen blendshape)
 *   blinkL  left eye closed, [0..1]   (subject's left = viewer's right)
 *   blinkR  right eye closed,[0..1]
 *
 * Falls back to a still image (drive() is a no-op) when no face is detected in
 * the portrait — e.g. the cartoon subjects (Bugs, Ernie, Ursula).
 *
 * Tuning gains live in GAINS below.
 */
(() => {
  if (customElements.get('live-puppet')) return;

  const CFG = Object.assign({
    visionVersion: '0.10.18',
    modelUrl: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
  }, window.WINK_PORTRAIT_CONFIG || {});

  const ALMOND = 'polygon(0% 50%, 8% 32%, 22% 19%, 38% 12%, 50% 10%, 62% 12%, 78% 19%, 92% 32%, 100% 50%, 92% 68%, 78% 81%, 62% 88%, 50% 90%, 38% 88%, 22% 81%, 8% 68%)';

  // FaceLandmarker eye rings + corners (same indices as <wink-portrait>).
  const EYES = {
    left:  { ring:[263,249,390,373,374,380,381,382,362,398,384,385,386,387,388,466], outer:263, inner:362 },
    right: { ring:[33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246],   outer:33,  inner:133 }
  };
  // Lip landmarks for the mouth box.
  const LIPS = { left:61, right:291, top:0, bottom:17, cupid:13, chin:14 };

  // How strongly the visitor's signal drives the portrait. Tune on real hardware.
  const GAINS = {
    roll: 14,    // deg of head tilt at signal=1
    yaw: 16,     // deg of head turn (rotateY) at signal=1
    pitch: 10,   // deg of head nod (rotateX) at signal=1
    mouth: 1.0,  // multiplier on jawOpen → mouth gap height
    ease: 0.35,  // per-frame easing toward target (higher = snappier, lower = smoother)
  };

  function loadLandmarker(){
    // Reuse the shared IMAGE-mode landmarker created by <wink-portrait>.
    if (window.__wpLandmarker) return window.__wpLandmarker;
    window.__wpLandmarker = (async () => {
      const V = CFG.visionVersion;
      const vision = await import(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${V}/vision_bundle.mjs`);
      const { FaceLandmarker, FilesetResolver } = vision;
      const fileset = await FilesetResolver.forVisionTasks(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${V}/wasm`);
      return FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: CFG.modelUrl },
        runningMode: 'IMAGE', numFaces: 1
      });
    })();
    return window.__wpLandmarker;
  }

  function boxFromRing(lm, ring, padX, padY){
    let minx=1,miny=1,maxx=0,maxy=0;
    for (const i of ring){ const p=lm[i]; if(p.x<minx)minx=p.x; if(p.x>maxx)maxx=p.x; if(p.y<miny)miny=p.y; if(p.y>maxy)maxy=p.y; }
    const w=(maxx-minx)*(padX||1), h=(maxy-miny)*(padY||1);
    const cx=(minx+maxx)/2, cy=(miny+maxy)/2;
    return { left:cx-w/2, top:cy-h/2, width:w, height:h, cx, cy };
  }

  async function detectPortrait(img){
    const land = await loadLandmarker();
    const res = land.detect(img);
    const lm = res && res.faceLandmarks && res.faceLandmarks[0];
    if (!lm) return null;
    const le = boxFromRing(lm, EYES.left.ring, 1.25, 1.6);
    const re = boxFromRing(lm, EYES.right.ring, 1.25, 1.6);
    const lc=lm[EYES.left.outer], li=lm[EYES.left.inner];
    le.angle = Math.atan2(li.y-lc.y, li.x-lc.x) * 180/Math.PI;
    const rc=lm[EYES.right.outer], ri=lm[EYES.right.inner];
    re.angle = Math.atan2(rc.y-ri.y, rc.x-ri.x) * -180/Math.PI;
    const ml=lm[LIPS.left], mr=lm[LIPS.right], mt=lm[LIPS.top], mb=lm[LIPS.bottom];
    const mouth = {
      cx:(ml.x+mr.x)/2, cy:(mt.y+mb.y)/2,
      width: Math.hypot(mr.x-ml.x, mr.y-ml.y),
      height: Math.max(0.02, Math.abs(mb.y-mt.y)),
      angle: Math.atan2(mr.y-ml.y, mr.x-ml.x) * 180/Math.PI,
    };
    // Pivot for head rotation: between the eyes.
    const pivot = { x:(le.cx+re.cx)/2, y:(le.cy+re.cy)/2 };
    return { le, re, mouth, pivot };
  }

  const pct = v => (v*100)+'%';
  const clamp = (v,a,b) => Math.max(a, Math.min(b, v));

  class LivePuppet extends HTMLElement {
    static get observedAttributes(){ return ['src','cover']; }

    connectedCallback(){ this._build(); this._detectAndRun(); }
    disconnectedCallback(){ this._running=false; if(this._raf) cancelAnimationFrame(this._raf); }
    attributeChangedCallback(n){ if(this.isConnected && this._frame && n==='src') this._detectAndRun(); }

    _build(){
      const cover = this.hasAttribute('cover');
      this.style.display = this.style.display || 'block';
      this.style.position = cover ? 'absolute' : (this.style.position || 'relative');
      if (cover) this.style.inset = '0';
      this.style.overflow = 'hidden';
      this.style.lineHeight = '0';

      this._frame = document.createElement('div');
      Object.assign(this._frame.style, {
        position:'relative', width:'100%', height: cover ? '100%' : 'auto',
        transformStyle:'preserve-3d', willChange:'transform',
      });
      // perspective wrapper for believable head turn/nod
      this.style.perspective = this.style.perspective || '1200px';

      this._img = document.createElement('img');
      this._img.draggable = false;
      const imgStyle = { display:'block', width:'100%', height: cover ? '100%' : 'auto', userSelect:'none' };
      if (cover){ imgStyle.objectFit='cover'; imgStyle.objectPosition='center top'; }
      Object.assign(this._img.style, imgStyle);

      this._leftLid = mk(); this._rightLid = mk(); this._mouth = mk();
      this._frame.appendChild(this._img);
      this._frame.appendChild(this._leftLid);
      this._frame.appendChild(this._rightLid);
      this._frame.appendChild(this._mouth);
      this.innerHTML=''; this.appendChild(this._frame);

      // current + target signal (eased each frame)
      this._cur = { roll:0, yaw:0, pitch:0, jawOpen:0, blinkL:0, blinkR:0 };
      this._target = Object.assign({}, this._cur);
      this._have = false; // portrait face detected?

      function mk(){ const d=document.createElement('div'); d.style.pointerEvents='none'; d.style.position='absolute'; d.style.display='none'; return d; }
    }

    async _detectAndRun(){
      const src = this.getAttribute('src');
      if (!src) return;
      this._img.src = src;
      const token = (this._token = (this._token||0)+1);
      const img = new Image(); img.crossOrigin='anonymous';
      img.onload = async () => {
        if (token !== this._token) return;
        let info = null;
        try { info = await detectPortrait(img); } catch(e){ console.warn('<live-puppet> detect failed', e); }
        if (token !== this._token) return;
        this._info = info;
        this._have = !!info;
        if (info) this._placeOverlays(info);
        this._start();
      };
      img.onerror = () => { console.warn('<live-puppet> image failed', src); this._start(); };
      img.src = src;
    }

    _placeOverlays(info){
      // Eyelids: a tone-neutral dark lid that descends to close the eye. Kept
      // dark rather than skin-matched because the portraits are B&W-ish; tune
      // if a lighter lid reads better.
      const lid = (el, box) => {
        Object.assign(el.style, {
          left:pct(box.left), top:pct(box.top), width:pct(box.width), height:pct(box.height),
          transform:`rotate(${(box.angle||0).toFixed(1)}deg)`, clipPath:ALMOND, overflow:'hidden', display:'block',
        });
        el.innerHTML='';
        const fill=document.createElement('div');
        Object.assign(fill.style,{ position:'absolute', left:'-6%', top:'0', width:'112%', height:'0',
          background:'linear-gradient(to bottom,#2a2724,#100e0c)', boxShadow:'inset 0 2px 3px rgba(255,255,255,.10)' });
        el.appendChild(fill); el._fill=fill;
      };
      lid(this._leftLid, info.le);
      lid(this._rightLid, info.re);

      const m=info.mouth;
      Object.assign(this._mouth.style, {
        left:pct(m.cx - m.width*0.5), top:pct(m.cy - m.height*0.5),
        width:pct(m.width), height:pct(Math.max(m.height, 0.06)),
        transform:`rotate(${m.angle.toFixed(1)}deg)`, display:'block',
        borderRadius:'50%', overflow:'hidden',
      });
      this._mouth.innerHTML='';
      const gap=document.createElement('div');
      Object.assign(gap.style,{ position:'absolute', left:'8%', right:'8%', top:'50%', height:'0',
        transform:'translateY(-50%)', borderRadius:'50%',
        background:'radial-gradient(ellipse at center, #140f0c 0%, #140f0c 60%, rgba(20,15,12,0) 100%)' });
      this._mouth.appendChild(gap); this._mouth._gap=gap;
    }

    // Called by the app's driving loop, ~per video frame.
    drive(sig){
      if (!this._have || !sig) return;
      const t=this._target;
      if (sig.roll!=null)    t.roll = clamp(sig.roll, -1.5, 1.5);
      if (sig.yaw!=null)     t.yaw = clamp(sig.yaw, -1.5, 1.5);
      if (sig.pitch!=null)   t.pitch = clamp(sig.pitch, -1.5, 1.5);
      if (sig.jawOpen!=null) t.jawOpen = clamp(sig.jawOpen, 0, 1);
      if (sig.blinkL!=null)  t.blinkL = clamp(sig.blinkL, 0, 1);
      if (sig.blinkR!=null)  t.blinkR = clamp(sig.blinkR, 0, 1);
    }

    rest(){ this._target = { roll:0, yaw:0, pitch:0, jawOpen:0, blinkL:0, blinkR:0 }; }

    _start(){
      if (this._running) return;
      this._running = true;
      const tick = () => {
        if (!this._running) return;
        const c=this._cur, t=this._target, e=GAINS.ease;
        for (const k in c) c[k] += (t[k]-c[k])*e;
        this._apply(c);
        this._raf = requestAnimationFrame(tick);
      };
      this._raf = requestAnimationFrame(tick);
    }

    _apply(c){
      // Head pose on the whole portrait (no per-pixel alignment needed → robust).
      this._frame.style.transformOrigin = this._info
        ? `${pct(this._info.pivot.x)} ${pct(this._info.pivot.y)}`
        : '50% 35%';
      const rz=(c.roll*GAINS.roll).toFixed(2), ry=(c.yaw*GAINS.yaw).toFixed(2), rx=(c.pitch*GAINS.pitch).toFixed(2);
      this._frame.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`;

      if (!this._have) return;
      if (this._leftLid._fill)  this._leftLid._fill.style.height  = pct(clamp(c.blinkL,0,1));
      if (this._rightLid._fill) this._rightLid._fill.style.height = pct(clamp(c.blinkR,0,1));
      if (this._mouth._gap){
        const open = clamp(c.jawOpen*GAINS.mouth, 0, 1);
        this._mouth._gap.style.height = pct(open);
      }
    }
  }

  customElements.define('live-puppet', LivePuppet);
})();
