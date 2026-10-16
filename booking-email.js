(function(){
 let widget=null, token='', busy=false, sent=false, requestId=crypto.randomUUID(), lastData='';
 const status=message=>{document.getElementById('result').textContent=message;};
 const config=window.JouwRitEmailConfig||{};
 window.jouwritOnlineEnabled=false;
 if(config.endpoint)fetch(config.endpoint.replace(/\/booking$/, '/public-config')).then(r=>{if(!r.ok)throw Error();return r.json();}).then(c=>{window.jouwritOnlineEnabled=c.onlinePaymentsEnabled===true;const option=document.querySelector('#onlinePayment input');option.disabled=!window.jouwritOnlineEnabled;document.querySelector('#onlinePayment small').textContent=window.jouwritOnlineEnabled?'Betaallink per e-mail na acceptatie':'Binnenkort beschikbaar';if(typeof togglePrice==='function')togglePrice();}).catch(()=>{});
 window.initJouwRitEmail=function(){
  if(!config.endpoint||!config.turnstileSiteKey)return;
  widget=turnstile.render('#bookingSpamCheck',{sitekey:config.turnstileSiteKey,action:'booking',appearance:'interaction-only',callback:value=>{token=value;},'expired-callback':()=>{token='';},'error-callback':()=>{token='';status('De spamcontrole kon niet laden. Vernieuw de pagina of neem contact op met info@jouwrit.nl.');}});
 };
 if(config.endpoint&&config.turnstileSiteKey){const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?onload=initJouwRitEmail&render=explicit';script.async=true;script.onerror=()=>status('De spamcontrole kon niet laden. Neem contact op met info@jouwrit.nl.');document.head.append(script);}
 window.sendJouwRitBooking=async function(data){
  if(busy||sent)return;
  if(!config.endpoint||!config.turnstileSiteKey){status('Boeken per e-mail is tijdelijk niet beschikbaar. Neem contact op met info@jouwrit.nl.');return;}
  if(!token){status('De beveiligingscontrole is nog bezig. Wacht even en probeer opnieuw.');return;}
  const serialized=JSON.stringify(data);if(lastData&&lastData!==serialized)requestId=crypto.randomUUID();lastData=serialized;
  busy=true;const button=document.getElementById('sendBooking');button.disabled=true;status('Uw aanvraag wordt verzonden…');
  try{
   const response=await fetch(config.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,token,requestId}),signal:AbortSignal.timeout(35000)});
   const result=await response.json();
   if(!response.ok||!result.ok)throw new Error(result.error||'Verzenden is niet bevestigd. Probeer opnieuw of neem contact op met info@jouwrit.nl.');
   sent=true;
   document.getElementById('successReference').textContent=result.reference;
   document.getElementById('bookingFields').hidden=true;
   const success=document.getElementById('bookingSuccess');success.hidden=false;success.focus();
   document.querySelector('.booking-banner .sub').textContent='Bedankt voor uw aanvraag.';
   success.scrollIntoView({behavior:'smooth',block:'center'});
   button.textContent='Aanvraag ontvangen';
  }catch(error){status(error.name==='TimeoutError'||error instanceof TypeError?'Verzenden is niet bevestigd. Probeer opnieuw met dezelfde gegevens of neem contact op met info@jouwrit.nl.':error.message);button.disabled=false;}
  finally{busy=false;token='';if(!sent&&widget!==null&&window.turnstile)turnstile.reset(widget);}
 };
})();
