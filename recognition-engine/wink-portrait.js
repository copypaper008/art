/*
 * <wink-portrait> — a self-contained custom element that makes a portrait wink.
 *
 *   <wink-portrait src="photos/person-07.png"></wink-portrait>
 *   import './wink-portrait.js';   // registers the element, that's it
 *
 * What it does, per image, with no per-image setup:
 *   1. Auto-detects the eye with MediaPipe FaceLandmarker (model loads ONCE, shared
 *      across every instance on the page).
 *   2. Samples skin tone from the photo's own pixels so the closed lid matches it.
 *   3. Overlays an almond-shaped lid + lash + lower-lid + shadow, sized in %,
 *      and loops the wink.
 *
 * Attributes:
 *   src           image URL (required)
 *   eye           "left" (default) | "right"  — which eye winks (subject's left = viewer's right)
 *   auto-detect   "false" to skip detection (then supply eye-data)
 *   eye-data      JSON: {"left":0.54,"top":0.27,"width":0.083,"height":0.027,"angle":-7}
 *                 (normalized 0..1 box + degrees) — skips detection if present
 *   lid-tone      JSON [r,g,b] — manual lid color if pixel sampling is blocked
 *   period        seconds per wink cycle (default 4.2)
 *   delay         seconds before this instance starts (stagger a grid with this)
 *   breathe       present = subtle idle scale animation
 *   cover         present = fill container (position:absolute inset:0, objectFit:cover center top)
 *
 * Notes:
 *   - Remote images must be same-origin or send CORS headers, otherwise the canvas
 *     pixel read is blocked and the lid falls back to lid-tone / neutral gray.
 *   - Override the MediaPipe versions/URLs via window.WINK_PORTRAIT_CONFIG before import.
 */
(() => {
  if (customElements.get('wink-portrait')) return;

  const CFG = Object.assign({
    visionVersion: '0.10.18',
    modelUrl: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
  }, window.WINK_PORTRAIT_CONFIG || {});

  const ALMOND = 'polygon(0% 50%, 8% 32%, 22% 19%, 38% 12%, 50% 10%, 62% 12%, 78% 19%, 92% 32%, 100% 50%, 92% 68%, 78% 81%, 62% 88%, 50% 90%, 38% 88%, 22% 81%, 8% 68%)';

  // MediaPipe FaceLandmarker eye rings + corner indices
  const EYES = {
    left:  { ring:[263,249,390,373,374,380,381,382,362,398,384,385,386,387,388,466], outer:263, inner:362 },
    right: { ring:[33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246],   outer:33,  inner:133 }
  };

  // keyframes injected once into the document
  const STYLE_ID = 'wink-portrait-keyframes';
  function ensureStyle(){
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      @keyframes wp-lid{0%{height:0}40%{height:0}45%{height:100%}54%{height:100%}62%{height:0}100%{height:0}}
      @keyframes wp-lash{0%{opacity:0}40%{opacity:0}45%{opacity:1}54%{opacity:1}61%{opacity:0}100%{opacity:0}}
      @keyframes wp-lower{0%{height:0}43%{height:0}47%{height:22%}54%{height:22%}60%{height:0}100%{height:0}}
      @keyframes wp-shadow{0%{opacity:0}44%{opacity:0}48%{opacity:.5}54%{opacity:.5}61%{opacity:0}100%{opacity:0}}
      @keyframes wp-breathe{0%{transform:scale(1) translateY(0)}100%{transform:scale(1.008) translateY(-.4%)}}
    `;
    document.head.appendChild(s);
  }

  // model loaded once for the whole page
  function loadLandmarker(){
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

  async function detectEye(img, which){
    const land = await loadLandmarker();
    const res = land.detect(img);
    const lm = res && res.faceLandmarks && res.faceLandmarks[0];
    if (!lm) return null;
    const set = EYES[which === 'right' ? 'right' : 'left'];
    let minx=1,miny=1,maxx=0,maxy=0;
    for (const i of set.ring){ const p=lm[i]; if(p.x<minx)minx=p.x; if(p.x>maxx)maxx=p.x; if(p.y<miny)miny=p.y; if(p.y>maxy)maxy=p.y; }
    const c1=lm[set.outer], c2=lm[set.inner];
    const angle = Math.atan2(c2.y-c1.y, c2.x-c1.x) * 180/Math.PI;
    const cx=(minx+maxx)/2, cy=(miny+maxy)/2;
    const w=(maxx-minx)*1.22, h=(maxy-miny)*1.55;   // lids extend beyond the lash ring
    return { left:cx-w/2, top:cy-h/2, width:w, height:h, angle:+angle.toFixed(2) };
  }

  function sampleTone(img, b, fallback){
    try{
      const cv = document.createElement('canvas');
      cv.width = img.naturalWidth; cv.height = img.naturalHeight;
      const ctx = cv.getContext('2d', { willReadFrequently:true });
      ctx.drawImage(img, 0, 0);
      const cx=(b.left+b.width/2), cy=(b.top+b.height/2);
      const s = Math.max(4, Math.round(cv.width*0.008));
      const pts = [
        [cx, b.top - b.height*0.9],
        [b.left - b.width*0.45, cy],
        [b.left + b.width*1.45, cy],
        [cx, b.top + b.height*2.2]
      ];
      let r=0,g=0,bl=0,n=0;
      for (const [px,py] of pts){
        const x=Math.max(0,Math.min(cv.width-s, Math.round(px*cv.width - s/2)));
        const y=Math.max(0,Math.min(cv.height-s, Math.round(py*cv.height - s/2)));
        const d=ctx.getImageData(x,y,s,s).data;
        for (let i=0;i<d.length;i+=4){ r+=d[i]; g+=d[i+1]; bl+=d[i+2]; n++; }
      }
      return [r/n, g/n, bl/n];
    }catch(e){
      console.warn('<wink-portrait>: tone sample blocked (cross-origin?), using fallback', e);
      return fallback || [186,186,187];
    }
  }

  const pct = v => (v*100)+'%';

  class WinkPortrait extends HTMLElement {
    static get observedAttributes(){ return ['src','eye','auto-detect','eye-data','lid-tone','period','delay','breathe','cover']; }

    connectedCallback(){
      ensureStyle();
      this._build();
      this._run();
    }
    attributeChangedCallback(){ if (this.isConnected && this._frame) this._run(); }

    _build(){
      const cover = this.hasAttribute('cover');
      this.style.display = this.style.display || (cover ? 'block' : 'inline-block');
      this.style.position = cover ? 'absolute' : (this.style.position || 'relative');
      if (cover) this.style.inset = '0';
      this.style.overflow = 'hidden';
      this.style.lineHeight = '0';

      this._frame = document.createElement('div');
      Object.assign(this._frame.style, { position:'relative', width:'100%', height: cover ? '100%' : 'auto', transformOrigin:'50% 30%' });

      this._img = document.createElement('img');
      this._img.draggable = false;
      const imgStyle = { display:'block', width:'100%', height: cover ? '100%' : 'auto', userSelect:'none', webkitUserDrag:'none' };
      if (cover) { imgStyle.objectFit = 'cover'; imgStyle.objectPosition = 'center top'; }
      Object.assign(this._img.style, imgStyle);

      this._shadow = mk(); this._eye = mk();
      this._lower = mk(); this._top = mk(); this._lash = mk();
      this._top.appendChild(this._lash);
      this._eye.appendChild(this._lower);
      this._eye.appendChild(this._top);

      this._frame.appendChild(this._img);
      this._frame.appendChild(this._shadow);
      this._frame.appendChild(this._eye);
      this.innerHTML = '';
      this.appendChild(this._frame);
      this._hideOverlay();

      function mk(){ const d=document.createElement('div'); d.style.pointerEvents='none'; return d; }
    }

    _hideOverlay(){ [this._shadow,this._eye].forEach(el => el.style.display='none'); }
    _showOverlay(){ [this._shadow,this._eye].forEach(el => el.style.display='block'); }

    _attrJSON(name){ const v=this.getAttribute(name); if(!v) return null; try{ return JSON.parse(v); }catch{ return null; } }

    async _run(){
      const src = this.getAttribute('src');
      if (!src){ this._hideOverlay(); return; }

      // breathe
      const breathe = this.hasAttribute('breathe');
      this._frame.style.animation = breathe ? 'wp-breathe 6s ease-in-out infinite alternate' : '';

      const token = (this._token = (this._token||0) + 1);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = async () => {
        if (token !== this._token) return;            // a newer _run() superseded us
        this._img.src = src;

        const which = this.getAttribute('eye') || 'left';
        const fallbackTone = this._attrJSON('lid-tone');
        let box = this._attrJSON('eye-data');

        if (box){
          this._apply(box, sampleTone(img, box, fallbackTone));
        }
        if (this.getAttribute('auto-detect') !== 'false' && !box){
          try{
            const d = await detectEye(img, which);
            if (token !== this._token) return;
            if (d) this._apply(d, sampleTone(img, d, fallbackTone));
            else console.warn('<wink-portrait>: no face detected and no eye-data for', src);
          }catch(e){ console.warn('<wink-portrait>: detection failed', e); }
        }
      };
      img.onerror = () => console.warn('<wink-portrait>: image failed to load', src);
      img.src = src;
    }

    _apply(box, tone){
      const base = tone || [186,186,187];
      const cl = v => Math.max(0, Math.min(255, Math.round(v)));
      const sc = f => `rgb(${cl(base[0]*f)},${cl(base[1]*f)},${cl(base[2]*f)})`;
      const clear = `rgba(${cl(base[0])},${cl(base[1])},${cl(base[2])},0)`;
      const period = parseFloat(this.getAttribute('period')) || 4.2;
      const delay = parseFloat(this.getAttribute('delay')) || 0;
      const A = name => `${name} ${period}s ${delay}s ease-in-out infinite`;

      Object.assign(this._eye.style, {
        position:'absolute', left:pct(box.left), top:pct(box.top), width:pct(box.width), height:pct(box.height),
        transform:`rotate(${box.angle}deg)`, clipPath:ALMOND, overflow:'hidden'
      });
      Object.assign(this._top.style, {
        position:'absolute', left:'-6%', top:'0', width:'112%', height:'0',
        background:`linear-gradient(to bottom, ${sc(1.04)} 0%, ${sc(1.0)} 34%, ${sc(.92)} 66%, ${sc(.84)} 88%, ${sc(.79)} 100%)`,
        boxShadow:'inset 0 2px 3px rgba(255,255,255,.12)', animation:A('wp-lid')
      });
      Object.assign(this._lash.style, {
        position:'absolute', left:'4%', bottom:'-1px', width:'92%', height:'16%',
        borderRadius:'0 0 60% 60% / 0 0 100% 100%',
        background:`linear-gradient(to bottom, rgba(0,0,0,0), ${sc(.24)})`, filter:'blur(.6px)', animation:A('wp-lash')
      });
      Object.assign(this._lower.style, {
        position:'absolute', left:'-10%', bottom:'0', width:'120%', height:'0',
        background:`linear-gradient(to top, ${sc(.93)}, ${sc(1.0)} 60%, ${clear})`, animation:A('wp-lower')
      });
      Object.assign(this._shadow.style, {
        position:'absolute', left:pct(box.left-0.006), top:pct(box.top + box.height*0.82),
        width:pct(box.width*1.08), height:pct(box.height*0.55), borderRadius:'50%',
        background:'radial-gradient(ellipse at center, rgba(20,18,16,.5), rgba(20,18,16,0) 70%)',
        transform:`rotate(${box.angle}deg)`, animation:A('wp-shadow')
      });
      this._showOverlay();
    }
  }

  customElements.define('wink-portrait', WinkPortrait);

  // Pre-warm the model so it's available for face-dot tracking at scan start
  loadLandmarker();
})();
