/* Glints follow the actual jewelry; respect the device's motion preference. */
(() => {
  // The assistant dock belongs to the same page frame and scrolls with it.
  const shell = document.querySelector('.desktop-shell');
  const dock = document.querySelector('.talk-dock');
  const desktop = matchMedia('(min-width:768px) and (orientation:landscape),(min-width:1101px)');
  function placeDock() {
    if (!shell || !dock) return;
    (desktop.matches ? shell : document.body).append(dock);
  }
  placeDock();
  desktop.addEventListener('change', placeDock);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const hero = document.querySelector('.desktop-hero');
  if (!hero) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'jewelry-fx';
  canvas.setAttribute('aria-hidden', 'true');
  hero.append(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  // Normalized crown, diamond frame, necklaces, rings, and watch locations.
  const gems = [[.50,.057],[.475,.09],[.53,.10],[.12,.123],[.826,.123],[.023,.119],[.98,.119],[.122,.94],[.824,.94],[.50,.953],[.013,.32],[.831,.32],[.013,.55],[.83,.55],[.013,.79],[.83,.79],[.47,.62],[.49,.66],[.51,.70],[.50,.735],[.455,.68],[.545,.67],[.574,.628],[.585,.61],[.45,.823],[.428,.817],[.55,.813],[.605,.439],[.578,.425],[.36,.526],[.70,.644],[.722,.624],[.773,.519],[.165,.605],[.202,.646]];
  let w = 0, h = 0, frame = 0, pointer = null;
  const resize = new ResizeObserver(() => {
    const r = hero.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    w = r.width; h = r.height; canvas.width = Math.round(w*dpr); canvas.height = Math.round(h*dpr); ctx.setTransform(dpr,0,0,dpr,0,0);
  });
  resize.observe(hero);
  hero.addEventListener('pointermove', e => {const r=hero.getBoundingClientRect();pointer=[e.clientX-r.left,e.clientY-r.top];});
  hero.addEventListener('pointerleave', () => {pointer=null;});
  function draw(t) {
    ctx.clearRect(0,0,w,h);
    if (w && h) gems.forEach(([nx,ny],i) => {
      const x=nx*w,y=ny*h, near=pointer?Math.max(0,1-Math.hypot(pointer[0]-x,pointer[1]-y)/100):0;
      const pulse=Math.pow(Math.max(0,Math.sin(t/1100+i*2.37)),16);
      const opacity=Math.min(1,pulse*.65+near*.95);
      if(opacity<.08)return;
      const size=(3+pulse*4+near*6)*Math.max(.65,w/1200);
      ctx.save();ctx.translate(x,y);ctx.globalAlpha=opacity;ctx.shadowColor='#a9eaff';ctx.shadowBlur=10;ctx.fillStyle='#effcff';
      ctx.beginPath();ctx.moveTo(0,-size);ctx.lineTo(size*.2,-size*.2);ctx.lineTo(size,0);ctx.lineTo(size*.2,size*.2);ctx.lineTo(0,size);ctx.lineTo(-size*.2,size*.2);ctx.lineTo(-size,0);ctx.lineTo(-size*.2,-size*.2);ctx.closePath();ctx.fill();ctx.restore();
    });
    frame=requestAnimationFrame(draw);
  }
  const visibility=new IntersectionObserver(([entry])=>{cancelAnimationFrame(frame);if(entry.isIntersecting&&!document.hidden)frame=requestAnimationFrame(draw);});
  visibility.observe(hero);
  document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(frame);if(!document.hidden)frame=requestAnimationFrame(draw);});
})();
