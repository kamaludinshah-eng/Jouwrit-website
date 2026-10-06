/* Edit prices here, or set enabled to false to withdraw the airport offer. */
window.JouwRitAirportOffers=(()=>{
 'use strict';
 const config={
  enabled:true,
  towns:['Eindhoven','Veldhoven','Best','Waalre','Geldrop','Nuenen'],
  airports:{
   'Amsterdam Airport Schiphol':{price:250,destination:'Amsterdam Airport Schiphol, Schiphol, Nederland'},
   'Brussels Airport':{price:250,destination:'Brussels Airport, Zaventem, België'},
   'Weeze Airport':{price:200,destination:'Weeze Airport, Weeze, Duitsland'},
   'Düsseldorf Airport':{price:250,destination:'Düsseldorf Airport, Düsseldorf, Duitsland'},
   'Rotterdam The Hague Airport':{price:250,destination:'Rotterdam The Hague Airport, Rotterdam, Nederland'}
  }
 };
 const normalize=text=>String(text).trim().toLocaleLowerCase('nl');
 const get=name=>config.enabled&&Object.hasOwn(config.airports,name)&&Number.isFinite(config.airports[name].price)&&config.airports[name].price>0?config.airports[name]:null;
 const area=()=>config.towns.join(', ');
 function distance(a,b){
  const rad=Math.PI/180,dlat=(b.lat-a.lat)*rad,dlon=(b.lon-a.lon)*rad;
  const v=Math.sin(dlat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlon/2)**2;
  return 6371000*2*Math.atan2(Math.sqrt(v),Math.sqrt(1-v));
 }
 async function checkPickup(route){
  const params=new URLSearchParams({q:route.pickup,rows:'5',fq:'type:adres',fl:'woonplaatsnaam,straatnaam,huisnummer,centroide_ll,weergavenaam'});
  const response=await fetch('https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?'+params,{signal:AbortSignal.timeout(12000),headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error('Het ophaaladres kan nu niet worden gecontroleerd. Probeer de prijsberekening opnieuw.');
  const data=await response.json();
  const match=(data.response?.docs||[]).find(doc=>{
   const point=/^POINT\(([-\d.]+) ([-\d.]+)\)$/.exec(doc.centroide_ll||'');
   return point&&doc.straatnaam&&doc.huisnummer!==undefined&&normalize(route.pickup).includes(normalize(doc.straatnaam))&&new RegExp('\\b'+String(doc.huisnummer)+'\\b').test(route.pickup)&&distance(route.a,{lon:Number(point[1]),lat:Number(point[2])})<100;
  });
  if(!match)throw new Error('Kies een volledig ophaaladres met huisnummer uit de suggesties om het luchthaventarief te controleren.');
  return {eligible:config.towns.some(town=>normalize(town)===normalize(match.woonplaatsnaam)),town:match.woonplaatsnaam};
 }
 // The homepage notice reads the same configuration as the booking form.
 const notice=document.getElementById('airport-offer-home');
 if(notice){
  const prices=Object.keys(config.airports).map(get).filter(Boolean).map(offer=>offer.price);
  if(!prices.length)notice.hidden=true;
  else{
   document.getElementById('airport-offer-minimum').textContent='€'+Math.min(...prices);
   document.getElementById('airport-offer-area').textContent=area();
  }
 }
 return {config,get,area,checkPickup};
})();
