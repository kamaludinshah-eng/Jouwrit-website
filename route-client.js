/* Shared original-booking lookup, routing and fare calculation for both pages. */
window.JouwRit=(()=>{
 'use strict';
 const fare={start:4.31,km:3.17,minute:0.52};
 const validPoint=(lat,lon)=>Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180;
 const money=value=>'€ '+value.toFixed(2).replace('.',',');
 const summary=r=>`${r.km.toFixed(1)} km · ${Math.round(r.min)} min`;
 async function json(url,signal){
  const response=await fetch(url,{signal:signal||AbortSignal.timeout(20000),headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error('Adres of route is tijdelijk niet beschikbaar. Probeer het opnieuw.');
  return response.json();
 }
 function remember(input,point){input.dataset.lat=point.lat;input.dataset.lon=point.lon;input.dataset.address=input.value;}
 function attach(id,listId,onChange){
  const input=document.getElementById(id),list=document.getElementById(listId);
  let timer,controller,revision=0;
  function close(){list.replaceChildren();list.classList.remove('open');}
  function invalidate(){delete input.dataset.lat;delete input.dataset.lon;delete input.dataset.address;onChange();}
  input.addEventListener('input',()=>{
   revision++;const version=revision;
   invalidate();clearTimeout(timer);if(controller)controller.abort();close();
   const query=input.value.trim();if(query.length<3)return;
   timer=setTimeout(async()=>{
    controller=new AbortController();
    try{
     const data=await json('https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&countrycodes=nl&q='+encodeURIComponent(query),controller.signal);
     if(version!==revision)return;
     close();
     for(const point of data){
      if(!validPoint(Number(point.lat),Number(point.lon)))continue;
      const option=document.createElement('div');option.className='suggestion';option.tabIndex=0;option.setAttribute('role','option');
      option.textContent=point.display_name;
      function select(){revision++;clearTimeout(timer);controller?.abort();onChange();input.value=point.display_name;remember(input,point);close();input.focus();}
      option.addEventListener('click',select);
      option.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();select();}});
      list.appendChild(option);
     }
     list.classList.toggle('open',!!list.children.length);
    }catch(e){if(version===revision)close();}
   },900);
  });
  input.addEventListener('keydown',e=>{if(e.key==='Escape'){revision++;clearTimeout(timer);controller?.abort();close();}});
  document.addEventListener('click',e=>{if(!input.parentElement.contains(e.target)){revision++;clearTimeout(timer);controller?.abort();close();}});
 }
 function snapshot(id){
  const input=document.getElementById(id),address=input.value.trim();
  if(!address)throw new Error('Vul eerst de ophaallocatie en bestemming in.');
  if(input.dataset.address===input.value&&input.dataset.lat&&input.dataset.lon){
   const lat=Number(input.dataset.lat),lon=Number(input.dataset.lon);
   if(validPoint(lat,lon))return {address,point:{lat,lon,name:address}};
  }
  return {address};
 }
 async function resolve(value){
  if(value.point)return value.point;
  const data=await json('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=nl&q='+encodeURIComponent(value.address));
  if(!data.length||!validPoint(Number(data[0].lat),Number(data[0].lon)))throw new Error('Adres niet gevonden: '+value.address);
  return {lat:Number(data[0].lat),lon:Number(data[0].lon),name:data[0].display_name};
 }
 async function calculate(pickupId,destinationId){
  // Snapshot both addresses before awaiting: a later edit must never mix two requests.
  const from=snapshot(pickupId),to=snapshot(destinationId);
  const a=await resolve(from),b=await resolve(to);
  const data=await json(`https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`);
  const route=data.routes?.[0];
  if(data.code!=='Ok'||!route||!Number.isFinite(route.distance)||!Number.isFinite(route.duration)||route.distance<=0||route.duration<=0)throw new Error('Geen geldige rijroute gevonden. Controleer de adressen.');
  const km=route.distance/1000,min=route.duration/60;
  return {km,min,price:fare.start+fare.km*km+fare.minute*min,pickup:a.name,destination:b.name,a,b};
 }
 return {attach,calculate,money,summary,validPoint};
})();
