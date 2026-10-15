// Real profile links are supplied from the booking service; no invented stars or reviews.
(async function(){
 const panel=document.getElementById('google-review-links');if(!panel)return;
 try{
 const r=await fetch('https://jouwrit-booking.kamaludinshah.workers.dev/public-config');if(!r.ok)return;const c=await r.json();
 const links=[];
 for(const [label,value] of [['Schrijf een Google-review',c.googleReviewUrl||'https://g.page/r/CaSQFnvq3IYZECE/review'],['Bekijk ons Google-profiel',c.googleProfileUrl]]){
 if(!value)continue;const url=new URL(value);
 if(url.protocol!=='https:'||!['g.page','google.com','www.google.com','maps.google.com','maps.app.goo.gl','search.google.com'].includes(url.hostname))continue;
 const a=document.createElement('a');a.href=url.href;a.textContent=label;a.target='_blank';a.rel='noopener noreferrer';a.style.cssText='color:var(--yellow);display:inline-block;margin-right:22px;margin-top:6px';links.push(a);
 }
 if(links.length)panel.replaceChildren(...links);
 }catch{/* Keep the supplied review link available even when the service is unavailable. */}
})();
