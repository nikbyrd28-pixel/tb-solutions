/* ============================================================================
   TB Solutions — shared ad & conversion tracking.
   Edit the 4 IDs below ONCE. Loaded on every page via <script src="/track.js">.
   Blank = off (nothing loads, no console errors).

   What it does:
     • loads Meta Pixel + Google (GA4 / Google Ads) only when an ID is set
     • fires PageView on load
     • window.trackLead(source)  -> fires a Lead / conversion on a real signup
     • window.adSrc()            -> " · utm_source=… · gclid=…" for attribution
     • captures utm_* / gclid / fbclid on landing, kept 45 days

   Where to find the IDs:
     META  → Events Manager → Pixel ID
     GA4   → Admin → Data Streams → Measurement ID (G-…)
     GADS  → Google Ads → your AW-… id + the Lead conversion's label
   ========================================================================== */
var META_PIXEL_ID   = '';   // e.g. '1234567890123456'
var GA4_ID          = '';   // e.g. 'G-XXXXXXXXXX'
var GADS_ID         = '';   // e.g. 'AW-XXXXXXXXXX'
var GADS_LEAD_LABEL = '';   // e.g. 'AbC-D_efGh'

(function(){
  try{
    if(META_PIXEL_ID){
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
      fbq('init',META_PIXEL_ID); fbq('track','PageView');
    }
    var gid=GA4_ID||GADS_ID;
    if(gid){
      var sc=document.createElement('script'); sc.async=true; sc.src='https://www.googletagmanager.com/gtag/js?id='+gid; document.head.appendChild(sc);
      window.dataLayer=window.dataLayer||[]; window.gtag=function(){dataLayer.push(arguments);};
      gtag('js',new Date()); if(GA4_ID)gtag('config',GA4_ID); if(GADS_ID)gtag('config',GADS_ID);
    }
  }catch(e){}
})();

/* Call on a real conversion (successful lead / signup). */
window.trackLead=function(src){
  try{ if(window.fbq) fbq('track','Lead',{content_name:src||'site'}); }catch(e){}
  try{ if(window.gtag){
    if(GA4_ID) gtag('event','generate_lead',{source:src||'site'});
    if(GADS_ID&&GADS_LEAD_LABEL) gtag('event','conversion',{send_to:GADS_ID+'/'+GADS_LEAD_LABEL});
  } }catch(e){}
};

/* Capture the ad click that brought them here; keep 45 days. */
(function(){
  try{
    var u=new URLSearchParams(location.search), utm={};
    ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','fbclid'].forEach(function(k){ var v=u.get(k); if(v) utm[k]=v.slice(0,120); });
    if(Object.keys(utm).length) localStorage.setItem('tb_utm',JSON.stringify({d:utm,t:Date.now()}));
  }catch(e){}
})();

/* " · utm_source=… · gclid=…" to stamp onto every lead for attribution. */
window.adSrc=function(){
  try{
    var x=JSON.parse(localStorage.getItem('tb_utm')||'null');
    if(x&&x.d&&(Date.now()-x.t)<3888000000){
      var p=[]; for(var k in x.d){ if(x.d.hasOwnProperty(k)) p.push(k+'='+x.d[k]); }
      return p.length?(' · '+p.join(' · ')):'';
    }
  }catch(e){}
  return '';
};
