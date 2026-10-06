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
 function remember(input,point){
  delete input.dataset.lat;delete input.dataset.lon;delete input.dataset.pdokId;
  if(validPoint(point.lat,point.lon)){input.dataset.lat=point.lat;input.dataset.lon=point.lon;}
  if(point.pdokId)input.dataset.pdokId=point.pdokId;
  input.dataset.address=input.value;
 }
 const addressService='https://api.pdok.nl/bzk/locatieserver/search/v3_1/suggest';
 const suggestionsCache=new Map();
 const normalize=text=>text.toLowerCase().replace(/ue/g,'u').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 const eindhovenTerminalLabel='Eindhoven Airport, Luchthavenweg 25, 5657 EA Eindhoven';
 function isEindhovenTerminal(address){
  const text=normalize(address).trim();
  const name=text.split(',')[0].trim();
  return /^(?:eindhoven airport(?: \(ein\))?|luchthaven eindhoven|vliegveld eindhoven|ein)$/.test(name)||/^luchthavenweg\s+25(?:\s*,?\s*(?:5657\s*ea\s*)?eindhoven(?:\s*,\s*(?:nederland|netherlands))?)?$/.test(text);
 }
 let terminalPoint=null;
 async function resolveEindhovenTerminal(){
  if(terminalPoint)return {...terminalPoint};
  const params=new URLSearchParams({q:'Luchthavenweg 25 Eindhoven',fq:'type:adres AND straatnaam:"Luchthavenweg" AND huisnummer:25 AND woonplaatsnaam:"Eindhoven"',rows:'50',fl:'straatnaam,huisnummer,huisletter,huisnummertoevoeging,woonplaatsnaam,centroide_ll'});
  const data=await json('https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?'+params);
  const doc=(data.response?.docs||[]).find(item=>item.straatnaam==='Luchthavenweg'&&Number(item.huisnummer)===25&&item.woonplaatsnaam==='Eindhoven'&&!item.huisletter&&!item.huisnummertoevoeging);
  const point=/^POINT\(([-\d.]+) ([-\d.]+)\)$/.exec(doc?.centroide_ll||'');
  if(!point||!validPoint(Number(point[2]),Number(point[1])))throw new Error('Het terminaladres van Eindhoven Airport kan nu niet worden gevonden. Probeer het opnieuw.');
  terminalPoint={lat:Number(point[2]),lon:Number(point[1]),name:eindhovenTerminalLabel};
  return {...terminalPoint};
 }
 // Named places remain selectable even when the external suggestion service is slow.
 // Coordinates are looked up only when the customer calculates the route.
 const namedPlaces=[
  ['Düsseldorf Airport (DUS), Düsseldorf, Duitsland','dusseldorf dusseldorf airport flughafen dus'],
  ['Düsseldorf, Duitsland','dusseldorf dusseldorf centrum'],
  ['Weeze Airport (NRN), Weeze, Duitsland','weeze airport flughafen niederrhein nrn'],
  ['Brussels Airport (BRU), Zaventem, België','brussels brussel zaventem airport bru'],
  ['Amsterdam Airport Schiphol, Nederland','amsterdam schiphol airport ams'],
  [eindhovenTerminalLabel,'eindhoven airport luchthaven ein'],
  ['Rotterdam The Hague Airport, Nederland','rotterdam den haag the hague airport rtm']
 ];
 function namedSuggestions(query){
  const words=normalize(query).trim().split(/\s+/);
  return namedPlaces.filter(([label,aliases])=>words.every(word=>normalize(label+' '+aliases).includes(word))).map(([display_name])=>({display_name}));
 }
 async function dutchSuggestions(query,signal){
  const params=new URLSearchParams({q:query,rows:'5',fq:'type:(adres OR weg OR woonplaats)',lat:'51.4416',lon:'5.4697',fl:'id,weergavenaam,type,straatnaam,huisnummer,huisletter,huisnummertoevoeging,woonplaatsnaam,centroide_ll'});
  let data=await json(addressService+'?'+params,signal);
  // Use the service's spelling correction only when the original query has no hits.
  if(!data.response?.docs?.length){
   const correction=data.spellcheck?.collations?.find(item=>item&&typeof item==='object'&&item.collationQuery)?.collationQuery;
   if(correction&&correction.toLowerCase()!==query.toLowerCase()){
    params.set('q',correction);data=await json(addressService+'?'+params,signal);
   }
  }
  const points=(data.response?.docs||[]).flatMap(doc=>{
   const coordinates=/^POINT\(([-\d.]+) ([-\d.]+)\)$/.exec(doc.centroide_ll||'');
   const lon=coordinates?Number(coordinates[1]):NaN,lat=coordinates?Number(coordinates[2]):NaN;
   const number=String(doc.huisnummer??'')+(doc.huisletter||'')+(doc.huisnummertoevoeging?'-'+doc.huisnummertoevoeging:'');
   const street=[doc.straatnaam,number].filter(Boolean).join(' ');
   const label=street?[street,doc.woonplaatsnaam].filter(Boolean).join(', '):doc.woonplaatsnaam||doc.weergavenaam;
   if(!label)return [];
   if(validPoint(lat,lon))return [{lat,lon,display_name:label}];
   // PDOK suggest may return only an ID and label; lookup supplies the geometry.
   return doc.id?[{pdokId:doc.id,display_name:label}]:[];
  });
  return points;
 }
 async function internationalSuggestions(query,signal){
  const params=new URLSearchParams({q:query,limit:'5',lat:'51.4416',lon:'5.4697'});
  const data=await json('https://photon.komoot.io/api/?'+params,signal);
  return (data.features||[]).flatMap(feature=>{
   if(feature.geometry?.type!=='Point')return [];
   const [lon,lat]=feature.geometry.coordinates||[];
   if(!validPoint(lat,lon))return [];
   const p=feature.properties||{};
   const street=[p.street,p.housenumber].filter(Boolean).join(' ');
   const parts=[p.name,street,p.city||p.town||p.village||p.district,p.country].filter(Boolean);
   const label=[...new Set(parts)].join(', ');
   return label?[{lat,lon,display_name:label}]:[];
  });
 }
 async function suggest(query,signal,onUpdate=()=>{}){
  if(signal?.aborted)throw new DOMException('Search cancelled','AbortError');
  const key=query.toLocaleLowerCase('nl');
  if(suggestionsCache.has(key)){const cached=suggestionsCache.get(key);onUpdate(cached);return cached;}
  const named=namedSuggestions(query),groups=[[],[]];
  function merge(){
   const points=[],seen=new Set();
   for(let point of [...named,...groups[0].slice(0,3),...groups[1],...groups[0].slice(3)]){
    if(isEindhovenTerminal(point.display_name))point={display_name:eindhovenTerminalLabel};
    const id=normalize(point.display_name);
    if(!seen.has(id)){seen.add(id);points.push(point);}
   }
   return points;
  }
  onUpdate(merge());
  const deadline=()=>signal?AbortSignal.any([signal,AbortSignal.timeout(12000)]):AbortSignal.timeout(12000);
  const results=await Promise.allSettled([dutchSuggestions,internationalSuggestions].map(async(provider,index)=>{
   groups[index]=await provider(query,deadline());
   if(!signal?.aborted)onUpdate(merge());
   return groups[index];
  }));
  if(signal?.aborted)throw new DOMException('Search cancelled','AbortError');
  if(!named.length&&results.every(result=>result.status==='rejected'))throw results[0].reason;
  const points=merge();
  // Do not cache a temporary provider failure as a complete result.
  if(results.every(result=>result.status==='fulfilled')){
   if(suggestionsCache.size>=60)suggestionsCache.delete(suggestionsCache.keys().next().value);
   suggestionsCache.set(key,points);
  }
  return points;
 }
 function attach(id,listId,onChange){
  const input=document.getElementById(id),list=document.getElementById(listId);
  let timer,controller,revision=0,active=-1;
  input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');
  input.setAttribute('aria-controls',listId);input.setAttribute('aria-expanded','false');
  const status=document.createElement('span');status.className='address-status';status.setAttribute('role','status');
  input.parentElement.appendChild(status);
  function close(){list.replaceChildren();list.classList.remove('open');input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1;}
  function cancel(){revision++;clearTimeout(timer);controller?.abort();close();status.textContent='';}
  function invalidate(){delete input.dataset.lat;delete input.dataset.lon;delete input.dataset.pdokId;delete input.dataset.address;onChange();}
  input.addEventListener('input',()=>{
   cancel();const version=revision;invalidate();
   const query=input.value.trim();if(query.length<2)return;
   timer=setTimeout(async()=>{
    controller=new AbortController();
    function render(data,finished=false){
     if(version!==revision)return;
     const selected=list.children[active]?.textContent;
     close();
     for(const point of data){
      const option=document.createElement('div');option.className='suggestion';option.id=listId+'-'+list.children.length;
      option.tabIndex=0;option.setAttribute('role','option');option.setAttribute('aria-selected','false');option.textContent=point.display_name;
      function select(){cancel();onChange();input.value=point.display_name;remember(input,point);input.focus();}
      option.addEventListener('click',select);
      option.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select();}});
      list.appendChild(option);
      if(point.display_name===selected){active=list.children.length-1;option.setAttribute('aria-selected','true');input.setAttribute('aria-activedescendant',option.id);}
     }
     const open=!!list.children.length;list.classList.toggle('open',open);input.setAttribute('aria-expanded',String(open));
     status.textContent=open?'':finished?'Geen suggesties. Vul het volledige adres in, inclusief huisnummer en plaats.':'Adressen zoeken…';
    }
    try{
     const data=await suggest(query,controller.signal,data=>render(data));
     render(data,true);
    }catch(e){if(version===revision){close();status.textContent='Adresvoorstellen tijdelijk niet beschikbaar. Vul het volledige adres in.';}}
   },250);
  });
  input.addEventListener('keydown',e=>{
   if(e.key==='Escape'){cancel();return;}
   const options=[...list.children];
   if((e.key==='ArrowDown'||e.key==='ArrowUp')&&options.length){
    e.preventDefault();active=(active+(e.key==='ArrowDown'?1:-1)+options.length)%options.length;
    options.forEach((option,i)=>option.setAttribute('aria-selected',String(i===active)));
    input.setAttribute('aria-activedescendant',options[active].id);
   }else if(e.key==='Enter'&&active>=0&&options[active]){e.preventDefault();options[active].click();}
   else if(e.key==='Tab'){cancel();}
  });
  document.addEventListener('click',e=>{if(!input.parentElement.contains(e.target))cancel();});
 }

 function snapshot(id){
  const input=document.getElementById(id),address=input.value.trim();
  if(!address)throw new Error('Vul eerst de ophaallocatie en bestemming in.');
  if(input.dataset.address===input.value&&input.dataset.pdokId)return {address,pdokId:input.dataset.pdokId};
  if(input.dataset.address===input.value&&input.dataset.lat&&input.dataset.lon){
   const lat=Number(input.dataset.lat),lon=Number(input.dataset.lon);
   if(validPoint(lat,lon))return {address,point:{lat,lon,name:address}};
  }
  return {address};
 }
 async function resolve(value){
  // Ignore a generic airfield centroid, including one carried over from an old URL.
  if(isEindhovenTerminal(value.address))return resolveEindhovenTerminal();
  if(value.point)return value.point;
  if(value.pdokId){
   const data=await json('https://api.pdok.nl/bzk/locatieserver/search/v3_1/lookup?id='+encodeURIComponent(value.pdokId)+'&fl=centroide_ll,weergavenaam');
   const doc=data.response?.docs?.[0],coordinates=/^POINT\(([-\d.]+) ([-\d.]+)\)$/.exec(doc?.centroide_ll||'');
   if(coordinates&&validPoint(Number(coordinates[2]),Number(coordinates[1])))return {lat:Number(coordinates[2]),lon:Number(coordinates[1]),name:value.address};
   throw new Error('Adres niet gevonden: '+value.address);
  }
  const data=await json('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q='+encodeURIComponent(value.address));
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
