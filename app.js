/* Haadthip Content Studio: no network requests, no persistence. */
'use strict';
const $=id=>document.getElementById(id);
const S={input:[],imageFiles:[],wordFile:null,blocks:[],images:[],match:[],outputs:[],urls:[],stamp:'',busy:false};
const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main', A='http://schemas.openxmlformats.org/drawingml/2006/main', R='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const months=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const today=new Date();
for(let y=2020;y<=2040;y++)$('year').add(new Option(String(y),String(y),false,y===today.getFullYear()));
months.forEach((m,i)=>$('month').add(new Option(`${String(i+1).padStart(2,'0')} — ${m}`,String(i+1).padStart(2,'0'),false,i===today.getMonth())));
function basePath(){return `/storage/newsroom/haadthip-journey/${$('year').value}/${$('month').value}/`}
function pathUpdate(){$('pathLabel').textContent=basePath()+'YYYYMMDD-HHMMSS-1.webp';if(S.blocks.length)renderHTML()}
$('year').onchange=pathUpdate;$('month').onchange=pathUpdate;pathUpdate();
$('quality').oninput=()=>{$('qualityValue').textContent=$('quality').value+'%'};
function notify(s){const t=$('toast');t.textContent=s;t.classList.add('show');clearTimeout(t._hide);t._hide=setTimeout(()=>t.classList.remove('show'),3600)}
function busy(on){S.busy=on;$('parseBtn').disabled=on||!S.input.length;$('parseBtn').textContent=on?'กำลังประมวลผล...':'อ่านไฟล์และสร้างเนื้อหา →'}
function formatSize(n){return n<1048576?(n/1024).toFixed(0)+' KB':(n/1048576).toFixed(1)+' MB'}
function setFiles(files){S.input=[...files];$('fileInfo').textContent=S.input.length?`เลือก ${S.input.length} ไฟล์ • ${S.input.map(f=>f.name).join(', ').slice(0,160)}`:'ยังไม่มีไฟล์ที่เลือก';busy(false)}
$('files').onchange=e=>setFiles(e.target.files);const drop=$('drop');
for(const ev of ['dragenter','dragover'])drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('drag')});
for(const ev of ['dragleave','drop'])drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('drag')});
drop.addEventListener('drop',e=>setFiles(e.dataTransfer.files));
$('clearBtn').onclick=()=>{S.urls.forEach(URL.revokeObjectURL);S.urls=[];S.input=[];S.blocks=[];S.images=[];S.match=[];S.outputs=[];S.wordFile=null;$('files').value='';$('fileInfo').textContent='ยังไม่มีไฟล์ที่เลือก';$('imageList').innerHTML='<div class="empty">เมื่ออ่านไฟล์แล้ว รายการรูปจะปรากฏตรงนี้</div>';$('preview').innerHTML='<div class="empty-state"><div class="emptysymbol">&lt;/&gt;</div><strong>พร้อมแปลงเนื้อหาของคุณ</strong></div>';$('code').value='';$('warn').innerHTML='';$('plainText').textContent='';$('resultStats').textContent='ยังไม่สร้าง HTML';enableExport(false);busy(false)};
function enableExport(on){for(const id of ['copyBtn','htmlBtn','zipBtn'])$(id).disabled=!on}
function u16(v,p){return v[p]|v[p+1]<<8}function u32(v,p){return (v[p]|v[p+1]<<8|v[p+2]<<16|v[p+3]<<24)>>>0}
function txt(b){return new TextDecoder('utf-8').decode(b)}
async function unzip(data){const a=new Uint8Array(data),out=[];let e=-1;for(let i=a.length-22;i>=Math.max(0,a.length-65557);i--){if(u32(a,i)===0x06054b50){e=i;break}}if(e<0)throw Error('ไฟล์ ZIP ไม่สมบูรณ์');const count=u16(a,e+10);let at=u32(a,e+16);for(let i=0;i<count;i++){if(u32(a,at)!==0x02014b50)throw Error('ZIP มีโครงสร้างไม่รองรับ');const method=u16(a,at+10),size=u32(a,at+20),nameLen=u16(a,at+28),extra=u16(a,at+30),comment=u16(a,at+32);const name=txt(a.slice(at+46,at+46+nameLen));const offset=u32(a,at+42);at+=46+nameLen+extra+comment;if(name.endsWith('/')||name.startsWith('__MACOSX/')||name.split('/').some(x=>x.startsWith('._')))continue;
  const ext=name.toLowerCase();if(!/\.(docx|jpe?g|png|webp|bmp|gif)$/.test(ext))continue;
  if(size>150*1024*1024)throw Error('ไฟล์ ZIP รายการหนึ่งมีขนาดใหญ่เกิน 150 MB');
  if(u32(a,offset)!==0x04034b50)throw Error('ZIP Local Header ไม่ถูกต้อง');const start=offset+30+u16(a,offset+26)+u16(a,offset+28);
  out.push({name,method,bytes:a.subarray(start,start+size),uncompressed:u32(a,at-(46+nameLen+extra+comment)+24)});
}return out}
async function inflate(entry){if(entry.method===0)return entry.bytes.slice();if(entry.method!==8)throw Error('ZIP ใช้รูปแบบบีบอัดที่ยังไม่รองรับ');if(!('DecompressionStream'in window))throw Error('Browser ไม่รองรับ ZIP Decompression กรุณาใช้ Chrome หรือ Edge รุ่นใหม่');const stream=new Blob([entry.bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));const bytes=new Uint8Array(await new Response(stream).arrayBuffer());return bytes}
function fileObj(name,bytes){const ext=name.split('.').pop().toLowerCase();return{name,bytes,mime:({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',bmp:'image/bmp',gif:'image/gif',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})[ext]||'application/octet-stream'}}
async function importInput(){const files=[];for(const f of S.input){if(/\.zip$/i.test(f.name)){const entries=await unzip(await f.arrayBuffer());for(const z of entries)files.push(fileObj(z.name,await inflate(z)))}else if(/\.(docx|jpe?g|png|webp|bmp|gif)$/i.test(f.name)){files.push(fileObj(f.name,new Uint8Array(await f.arrayBuffer())))} }return files}
function children(n){return Array.from(n?.children||[])}
function elements(n,name,ns){return Array.from(n?.getElementsByTagNameNS(ns,name)||[])}
function escapeHTML(str){return String(str||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function paragraphData(p){let plain='',markup='',images=[];const runs=elements(p,'r',W);
 for(const r of runs){const drawings=elements(r,'drawing',W);for(const dr of drawings){const blips=elements(dr,'blip',A);if(blips.length){const id=blips[0].getAttributeNS(R,'embed');if(id)images.push(id)}}
  let s='';for(const n of r.getElementsByTagName('*')){if(n.namespaceURI===W&&n.localName==='t')s+=n.textContent||'';if(n.namespaceURI===W&&n.localName==='tab')s+='\t';if(n.namespaceURI===W&&n.localName==='br')s+='\n'}
  if(!s)continue;plain+=s;let frag=escapeHTML(s).replace(/\n/g,'<br>');const pr=elements(r,'rPr',W)[0];if(pr){if(elements(pr,'b',W).some(x=>x.getAttributeNS(W,'val')!=='0'))frag='<strong>'+frag+'</strong>';if(elements(pr,'u',W).length)frag='<u>'+frag+'</u>'}markup+=frag;
 }return{plain,markup,images}}
function normalizeName(n){return n.split('/').pop().toLowerCase()}
async function readDocx(doc){const zip=await unzip(doc.bytes),files=new Map();for(const e of zip)files.set(e.name,e);
 // unzip() selects only media extensions; document XML needs the complete archive directory listing.
 const all=await unzipAny(doc.bytes);const xml=txt(await inflate(all.get('word/document.xml')));const relEntry=all.get('word/_rels/document.xml.rels');const relations={};if(relEntry){const relXML=new DOMParser().parseFromString(txt(await inflate(relEntry)),'application/xml');for(const r of relXML.getElementsByTagName('Relationship'))relations[r.getAttribute('Id')]=r.getAttribute('Target')}
 const docXML=new DOMParser().parseFromString(xml,'application/xml');if(docXML.querySelector('parsererror'))throw Error('ไม่สามารถอ่านโครงสร้าง Word ได้');const body=elements(docXML,'body',W)[0];if(!body)throw Error('ไม่พบเนื้อหาใน Word');const blocks=[];let imgIndex=0;
 for(const elem of children(body)){
   if(elem.localName==='p'){const data=paragraphData(elem);if(data.plain.trim()){const pPr=elements(elem,'pPr',W)[0];const style=elements(pPr,'pStyle',W)[0]?.getAttributeNS(W,'val')||'';blocks.push({kind:'text',text:data.plain,html:data.markup,style});}for(const id of data.images){blocks.push({kind:'image',wordImage:imgIndex++,rel:id})}}
   else if(elem.localName==='tbl'){
     // Preserve table cell text in the correct document position.
     let rows=[];for(const tr of elements(elem,'tr',W)){const cols=[];for(const td of children(tr).filter(x=>x.localName==='tc'))cols.push(elements(td,'t',W).map(x=>x.textContent).join(''));rows.push(cols)}if(rows.length)blocks.push({kind:'table',rows});
   }
 }
 const embedded=[];for(const b of blocks.filter(b=>b.kind==='image')){let target=relations[b.rel];if(target){target=target.replace(/^\.\.\//,'').replace(/^\//,'');const key=target.startsWith('word/')?target:'word/'+target;const entry=all.get(key);if(entry){const data=await inflate(entry);embedded.push(fileObj(key,data));b.embedded=embedded.length-1}}}
 return{blocks,embedded};}
async function unzipAny(data){const a=new Uint8Array(data);let e=-1;for(let i=a.length-22;i>=Math.max(0,a.length-65557);i--)if(u32(a,i)===0x06054b50){e=i;break}if(e<0)throw Error('Word ไม่ถูกต้อง');const count=u16(a,e+10);let at=u32(a,e+16);const map=new Map();for(let i=0;i<count;i++){if(u32(a,at)!==0x02014b50)throw Error('ไฟล์ Word ไม่ถูกต้อง');const method=u16(a,at+10),size=u32(a,at+20),n=u16(a,at+28),x=u16(a,at+30),c=u16(a,at+32),name=txt(a.slice(at+46,at+46+n)),offset=u32(a,at+42);at+=46+n+x+c;if(!/^(word\/(document\.xml|_rels\/document\.xml\.rels|media\/)|\[Content_Types\])/.test(name))continue;const start=offset+30+u16(a,offset+26)+u16(a,offset+28);map.set(name,{method,bytes:a.subarray(start,start+size)})}return map}
function fileSort(a,b){const stem=n=>n.split('/').pop().match(/^(\d+)/)?.[1];const x=stem(a.name),y=stem(b.name);if(x&&y&&x!==y)return Number(x)-Number(y);return a.name.localeCompare(b.name,'th',{numeric:true})}
function previewURL(f){const url=URL.createObjectURL(new Blob([f.bytes],{type:f.mime}));S.urls.push(url);return url}
function thaiStamp(){const t=new Date();const bits=[t.getFullYear(),String(t.getMonth()+1).padStart(2,'0'),String(t.getDate()).padStart(2,'0')].join('')+'-'+[t.getHours(),t.getMinutes(),t.getSeconds()].map(n=>String(n).padStart(2,'0')).join('');return bits}
function filterIntro(blocks){if(!$('skipIntro').checked)return blocks;let first=-1;for(let i=0;i<blocks.length;i++){if(blocks[i].kind==='text'&&/^(ประเภท\s*:|แผนโพสต์\s*:|content\s*\d+\s*:)/i.test(blocks[i].text.trim()))first=i}
 return first>=0?blocks.slice(first+1):blocks}
function getBlocks(){let blocks=filterIntro(S.blocks);if(!$('includeTitle').checked){const idx=blocks.findIndex(b=>b.kind==='text');if(idx>=0)blocks=blocks.filter((_,i)=>i!==idx)}return blocks}
function imageNumber(b){return S.blocks.filter(x=>x.kind==='image').indexOf(b)}
function assignedFile(b){const n=imageNumber(b),index=S.match[n];return S.images[index]}
// A section starts with one or more consecutive pictures, then owns all text until the next picture sequence.
// Text preceding the first picture is kept with the first section, after its figures.
function contentSections(bs){
 const groups=[];let current=null;let leading=[];let afterText=false;
 const newGroup=()=>{current={images:[],content:[]};groups.push(current);afterText=false};
 for(const b of bs){
  if(b.kind==='image'){
   if(!current){newGroup();if(leading.length){current.content.push(...leading);leading=[]}}
   else if(afterText)newGroup();
   current.images.push(b);
  }else if(!current){leading.push(b)}
  else{current.content.push(b);afterText=true}
 }
 if(leading.length){if(!current)newGroup();current.content.push(...leading)}
 return groups;
}
function contentMarkup(b,isLast,isFirstText){
 if(b.kind==='table')return '<table>\n'+b.rows.map(r=>'\t<tr>'+r.map(c=>'<td>'+escapeHTML(c)+'</td>').join('')+'</tr>').join('\n')+'\n</table>';
 const val=b.html||'';const style=(b.style||'').toLowerCase();
 const heading=/^heading[1-6]$/.test(style)||/^title$/.test(style)||(isFirstText&&b.text.trim().length<=115&&!/[.!?。]$/.test(b.text.trim()));
 const tag=heading?(isFirstText?'h5':'h6'):'p';
 const klass=tag==='p'&&isLast?' class="mb-0"':tag==='h5'?' class="mb-3"':'';
 return `<${tag}${klass}>${val}</${tag}>`;
}
function renderHTML(){
 if(!S.blocks.length)return;
 const bs=getBlocks(),sections=contentSections(bs);
 const paths=new Map();for(const b of S.blocks.filter(x=>x.kind==='image')){
  const idx=imageNumber(b);paths.set(b,basePath()+S.stamp+'-'+idx+'.webp');
 }
 const html=sections.map(section=>{
  const lines=['<div class="mb-5">'];const imgs=section.images;
  if(imgs.length===1){
   const b=imgs[0];
   if(assignedFile(b))lines.push(`\t<figure class="text-center mb-4"><img alt="" class="img-fluid" src="${paths.get(b)}" /></figure>`);
   else lines.push(`\t<!-- ไม่พบไฟล์รูปภาพลำดับ ${imageNumber(b)+1} -->`);
  }else if(imgs.length>1){
   lines.push('\t<div class="row justify-content-center no-gutters mb-4">');
   for(const [localIndex,b] of imgs.entries()){
    const width=imgs.length===2?'col-md-'+(localIndex===0?'5':'6'):imgs.length===3?'col-md-4':'col-md-6';
    lines.push(`\t\t<div class="${width}">`);
    if(assignedFile(b))lines.push(`\t\t\t<figure class="text-center mb-md-0"><img class="img-fluid" src="${paths.get(b)}" /></figure>`);
    else lines.push(`\t\t\t<!-- ไม่พบไฟล์รูปภาพลำดับ ${imageNumber(b)+1} -->`);
    lines.push('\t\t</div>');
   }
   lines.push('\t</div>');
  }
  const contents=section.content;
  contents.forEach((b,i)=>lines.push('\t'+contentMarkup(b,i===contents.length-1,i===0)));
  lines.push('</div>');return lines.join('\n');
 }).join('\n\n');
 $('code').value=html;renderPreview();
 $('plainText').textContent=bs.map(b=>b.kind==='text'?b.text:b.kind==='image'?`[รูปภาพ ${imageNumber(b)+1}]`:'[ตาราง]').join('\n\n');
 $('resultStats').textContent=`${sections.length} กลุ่ม mb-5 • ${bs.filter(x=>x.kind==='text').length} ย่อหน้า • ${bs.filter(x=>x.kind==='image').length} รูป • ${bs.filter(x=>x.kind==='table').length} ตาราง`;
 enableExport(true);
}
function renderPreview(){const html=$('code').value;const doc=new DOMParser().parseFromString(html,'text/html');for(const el of [...doc.body.querySelectorAll('*')]){if(!['DIV','FIGURE','H5','H6','P','IMG','BR','STRONG','U','A','UL','OL','LI','H2','H3','H4','TABLE','TBODY','THEAD','TR','TD','TH'].includes(el.tagName)){el.replaceWith(...el.childNodes);continue}for(const a of [...el.attributes]){if(el.tagName==='IMG'&&a.name==='src'){const key=a.value.split('/').pop();const n=Number(key.match(/-(\d+)\.webp$/)?.[1]||0);const f=assignedFile(S.blocks.filter(x=>x.kind==='image')[n]||{});if(f&&f.preview)el.setAttribute('src',f.preview);else el.removeAttribute('src')}else if(el.tagName==='A'&&a.name==='href'&&/^https?:\/\//i.test(a.value))el.setAttribute('rel','noopener');else if(a.name==='class'&&/^(mb-5|mb-4|mb-3|mb-0|text-center|img-fluid|mb-md-0|row justify-content-center no-gutters mb-4|col-md-[456])$/.test(a.value)){}else if(a.name==='alt'){}else if(a.name==='href'&&/^(https?:|\/|#)/.test(a.value)){}else el.removeAttribute(a.name)}}$('preview').replaceChildren(...Array.from(doc.body.childNodes).map(n=>document.importNode(n,true)))}
$('code').addEventListener('input',renderPreview);$('skipIntro').onchange=renderHTML;$('includeTitle').onchange=renderHTML;
function renderImages(){const rows=S.blocks.filter(b=>b.kind==='image');const container=$('imageList');container.innerHTML='';if(!rows.length){container.innerHTML='<div class="empty">ไม่พบรูปภาพใน Word</div>';return}rows.forEach((b,i)=>{const f=S.images[S.match[i]],row=document.createElement('div');row.className='image-row';const thumb=document.createElement('img');if(f?.preview)thumb.src=f.preview;const right=document.createElement('div');const title=document.createElement('b');title.textContent=`ภาพที่ ${i+1} — ตำแหน่งใน Word`;const sel=document.createElement('select');sel.add(new Option('— ไม่มีภาพที่จับคู่ —',''));S.images.forEach((f,j)=>sel.add(new Option(f.name.split('/').pop().slice(0,80),String(j))));sel.value=S.match[i]===undefined?'':String(S.match[i]);sel.onchange=()=>{S.match[i]=sel.value===''?undefined:Number(sel.value);renderImages();renderHTML()};const label=document.createElement('small');label.textContent=f?f.name.split('/').pop()+' • '+formatSize(f.bytes.length):'ยังไม่มีรูป';right.append(title,sel,label);row.append(thumb,right);container.append(row)})}
function warnings(){const n=S.blocks.filter(b=>b.kind==='image').length,m=S.images.length;let arr=[];if(!m)arr.push('ไม่พบไฟล์รูปภาพที่แยกมา กรุณาอัปโหลด JPG/PNG ก่อนส่งออก');if(n!==m)arr.push(`Word มีตำแหน่งรูป ${n} จุด แต่พบรูปแยก ${m} ไฟล์ ต้องตรวจลำดับรูป`);if(S.match.some(x=>x===undefined))arr.push('มีบางตำแหน่งที่ยังไม่ได้จับคู่รูป');if(new Set(S.match.filter(x=>x!==undefined)).size!==S.match.filter(x=>x!==undefined).length)arr.push('พบรูปที่ถูกเลือกซ้ำหลายตำแหน่ง');arr.push('การจับคู่จากชื่อไฟล์เป็นค่าเริ่มต้น โปรดตรวจภาพทุกภาพก่อนนำไปใช้งาน');$('warn').innerHTML=arr.map(x=>`<p>⚠ ${escapeHTML(x)}</p>`).join('')}
async function bitmap(f){const blob=new Blob([f.bytes],{type:f.mime});return createImageBitmap(blob)}
async function signature(f){const b=await bitmap(f);const can=document.createElement('canvas');can.width=16;can.height=16;const c=can.getContext('2d',{willReadFrequently:true});c.drawImage(b,0,0,16,16);b.close();const a=c.getImageData(0,0,16,16).data;const sig=[];for(let i=0;i<a.length;i+=4)sig.push([a[i],a[i+1],a[i+2]]);return sig}
function distance(a,b){let s=0;for(let i=0;i<a.length;i++)for(let j=0;j<3;j++){const v=a[i][j]-b[i][j];s+=v*v}return s}
$('autoMatch').onclick=async()=>{if(!S.embedded?.length)return notify('ไม่พบรูปต้นฉบับใน Word สำหรับเปรียบเทียบ');$('autoMatch').disabled=true;notify('กำลังวิเคราะห์ความคล้ายของภาพ อาจใช้เวลาสักครู่');try{const refs=[],cands=[];for(const f of S.embedded)refs.push(await signature(f).catch(()=>null));for(const f of S.images)cands.push(await signature(f).catch(()=>null));const used=new Set();for(const [i,b] of S.blocks.filter(x=>x.kind==='image').entries()){const ref=refs[b.embedded];if(!ref)continue;let best=-1,d=Infinity;for(let j=0;j<cands.length;j++){if(used.has(j)||!cands[j])continue;const cost=distance(ref,cands[j]);if(cost<d){best=j;d=cost}}if(best>=0){S.match[i]=best;used.add(best)}}renderImages();renderHTML();warnings();notify('จับคู่ภาพจากความคล้ายกันแล้ว กรุณาตรวจสอบผลทุกภาพ')}catch(err){notify('จับคู่ภาพอัตโนมัติไม่สำเร็จ: '+err.message)}finally{$('autoMatch').disabled=false}};
$('orderMatch').onclick=()=>{S.match=S.blocks.filter(x=>x.kind==='image').map((_,i)=>i<S.images.length?i:undefined);renderImages();renderHTML();warnings();notify('จัดลำดับจากชื่อไฟล์แล้ว')};
$('parseBtn').onclick=async()=>{if(S.busy)return;busy(true);S.urls.forEach(URL.revokeObjectURL);S.urls=[];try{const items=await importInput();const word=items.filter(x=>/\.docx$/i.test(x.name));if(!word.length)throw Error('ไม่พบไฟล์ .docx ในไฟล์ที่อัปโหลด');S.wordFile=word[0];S.images=items.filter(x=>/\.(jpg|jpeg|png|webp|bmp|gif)$/i.test(x.name)).sort(fileSort);const parsed=await readDocx(S.wordFile);S.blocks=parsed.blocks;S.embedded=parsed.embedded;S.match=S.blocks.filter(b=>b.kind==='image').map((_,i)=>i<S.images.length?i:undefined);S.stamp=thaiStamp();for(const f of S.images)f.preview=previewURL(f);renderImages();renderHTML();warnings();$('fileInfo').textContent=`Word: ${S.wordFile.name.split('/').pop()} | รูป: ${S.images.length} ไฟล์ | รายการเนื้อหา: ${S.blocks.length} บล็อก`; $('autoMatch').disabled=!S.embedded.length||!S.images.length;$('orderMatch').disabled=!S.images.length;notify('อ่านไฟล์สำเร็จ กรุณาตรวจรูปภาพก่อนส่งออก')}catch(e){console.error(e);notify('เกิดข้อผิดพลาด: '+e.message);$('warn').innerHTML='<p>'+escapeHTML(e.message)+'</p>'}finally{busy(false)}};
for(const b of document.querySelectorAll('[data-tab]'))b.onclick=()=>{for(const a of document.querySelectorAll('[data-tab]'))a.classList.toggle('selected',a===b);$('preview').classList.toggle('hidden',b.dataset.tab!=='preview');$('codeTab').classList.toggle('hidden',b.dataset.tab!=='code');$('textTab').classList.toggle('hidden',b.dataset.tab!=='text');if(b.dataset.tab==='preview')renderPreview()};
$('copyBtn').onclick=async()=>{try{await navigator.clipboard.writeText($('code').value);notify('คัดลอก HTML แล้ว')}catch{const el=$('code');el.select();document.execCommand('copy');notify('คัดลอก HTML แล้ว')}};
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),20000)}
$('htmlBtn').onclick=()=>downloadBlob(new Blob([$('code').value],{type:'text/html;charset=utf-8'}),'haadthip-journey.html');
async function toWebP(file,quality,maxSize){const img=await bitmap(file);let w=img.width,h=img.height;if(maxSize&&w>maxSize){const s=maxSize/w;w=Math.max(1,Math.round(w*s));h=Math.max(1,Math.round(h*s))}const can=document.createElement('canvas');can.width=w;can.height=h;can.getContext('2d').drawImage(img,0,0,w,h);img.close();const blob=await new Promise((resolve,reject)=>can.toBlob(b=>b?resolve(b):reject(Error('แปลง WebP ไม่สำเร็จ')),'image/webp',quality));can.width=can.height=0;return new Uint8Array(await blob.arrayBuffer())}
const crcTable=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc(bytes){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0}
function put16(v,o,n){v[o]=n&255;v[o+1]=n>>>8&255}function put32(v,o,n){put16(v,o,n);put16(v,o+2,n>>>16)}
function makeZip(entries){const encoder=new TextEncoder(),parts=[],dir=[];let offset=0;for(const entry of entries){const name=encoder.encode(entry.name),data=entry.data,C=crc(data),local=new Uint8Array(30+name.length);put32(local,0,0x04034b50);put16(local,4,20);put16(local,6,0x0800);put16(local,8,0);put32(local,14,C);put32(local,18,data.length);put32(local,22,data.length);put16(local,26,name.length);local.set(name,30);parts.push(local,data);const central=new Uint8Array(46+name.length);put32(central,0,0x02014b50);put16(central,4,20);put16(central,6,20);put16(central,8,0x0800);put32(central,16,C);put32(central,20,data.length);put32(central,24,data.length);put16(central,28,name.length);put32(central,42,offset);central.set(name,46);dir.push(central);offset+=local.length+data.length}const directorySize=dir.reduce((s,p)=>s+p.length,0),end=new Uint8Array(22);put32(end,0,0x06054b50);put16(end,8,entries.length);put16(end,10,entries.length);put32(end,12,directorySize);put32(end,16,offset);return new Blob([...parts,...dir,end],{type:'application/zip'})}
$('zipBtn').onclick=async()=>{if(S.busy)return;S.busy=true;$('zipBtn').disabled=true;$('zipBtn').textContent='กำลังแปลงรูปภาพ...';try{const bs=getBlocks(),seen=new Set(),entries=[{name:'haadthip-journey.html',data:new TextEncoder().encode($('code').value)}],folder=`storage/newsroom/haadthip-journey/${$('year').value}/${$('month').value}/`,manifest=[];for(const b of bs.filter(b=>b.kind==='image')){const i=imageNumber(b),f=assignedFile(b);if(!f)throw Error(`ภาพลำดับที่ ${i+1} ยังไม่ได้จับคู่`);if(seen.has(S.match[i]))throw Error('มีภาพถูกจับคู่ซ้ำ กรุณาตรวจสอบก่อนส่งออก');seen.add(S.match[i]);$('zipBtn').textContent=`กำลังแปลงรูป ${seen.size}/${bs.filter(b=>b.kind==='image').length}`;await new Promise(r=>setTimeout(r,0));const filename=`${S.stamp}-${i}.webp`;const data=await toWebP(f,Number($('quality').value)/100,Number($('size').value));entries.push({name:folder+filename,data});manifest.push({source:f.name,output:filename,path:'/'+folder+filename})}entries.push({name:'image-manifest.json',data:new TextEncoder().encode(JSON.stringify({generatedAt:new Date().toISOString(),folder:'/'+folder,images:manifest},null,2))});const zip=makeZip(entries);downloadBlob(zip,`haadthip-journey-${S.stamp}.zip`);notify('ดาวน์โหลด ZIP พร้อม HTML และรูป WebP สำเร็จ')}catch(err){console.error(err);notify('ส่งออกไม่สำเร็จ: '+err.message)}finally{S.busy=false;$('zipBtn').disabled=false;$('zipBtn').innerHTML='ดาวน์โหลด ZIP <span>↓</span>'}};
