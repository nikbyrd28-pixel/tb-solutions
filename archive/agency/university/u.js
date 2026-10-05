/* TB University — shared ambient effects (starfield, conic ring, scroll reveal) */
(function(){
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches;
  /* animated conic ring angle */
  if(!RM){ var a=0; (function tick(){ a=(a+0.4)%360; document.documentElement.style.setProperty('--a',a+'deg'); requestAnimationFrame(tick); })(); }
  /* starfield (only if a #stars canvas exists) */
  var c=document.getElementById('stars');
  if(c && !RM){
    var x=c.getContext('2d'), W,H, st=[];
    function size(){ W=c.width=innerWidth; H=c.height=innerHeight; st=[]; var n=Math.min(110,Math.round(W*H/15000));
      for(var i=0;i<n;i++) st.push({x:Math.random(),y:Math.random(),r:Math.random()*1.3+0.3,s:Math.random()*0.02+0.004,t:Math.random()*6.28}); }
    size(); addEventListener('resize',size);
    (function loop(){ x.clearRect(0,0,W,H);
      for(var i=0;i<st.length;i++){ var p=st[i]; p.y-=p.s/H; if(p.y<-0.02)p.y=1.02; p.t+=0.03;
        var tw=0.5+0.5*Math.sin(p.t), col=i%7===0?'255,212,90':'190,205,255';
        x.beginPath(); x.fillStyle='rgba('+col+','+(0.15+tw*0.5)+')'; x.arc(p.x*W,p.y*H,p.r*(1+tw*0.5),0,6.28); x.fill(); }
      requestAnimationFrame(loop); })();
  }
  /* scroll reveal */
  var els=[].slice.call(document.querySelectorAll('.reveal'));
  if(!('IntersectionObserver' in window)){ els.forEach(function(e){e.classList.add('in')}); return; }
  var io=new IntersectionObserver(function(en){ en.forEach(function(t){ if(t.isIntersecting){ t.target.classList.add('in'); io.unobserve(t.target); } }); },{threshold:.12,rootMargin:'0px 0px -6% 0px'});
  els.forEach(function(e){ io.observe(e); });
})();
