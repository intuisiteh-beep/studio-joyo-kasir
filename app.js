const KEY='sjb2_print_kasir_v1';
let db=JSON.parse(localStorage.getItem(KEY)||'null')||{
services:[
{id:1,cat:'Print',name:'Print A4 Hitam Putih',unit:'lembar',price:1000},
{id:2,cat:'Print',name:'Print A4 Warna',unit:'lembar',price:1500},
{id:3,cat:'Print',name:'Print A3 Warna',unit:'lembar',price:3500},
{id:4,cat:'Fotokopi',name:'Fotokopi A4',unit:'lembar',price:500},
{id:5,cat:'Foto',name:'Cetak Foto 4R',unit:'foto',price:5000},
{id:6,cat:'Finishing',name:'Laminating A4',unit:'lembar',price:5000},
{id:7,cat:'Finishing',name:'Jilid',unit:'pcs',price:10000},
{id:8,cat:'Finishing',name:'Spiral Besi',unit:'pcs',price:12000},
{id:9,cat:'Banner',name:'Banner',unit:'m²',price:25000},{id:16,cat:'Banner',name:'Spanduk',unit:'m²',price:25000},
{id:10,cat:'Banner',name:'X-Banner',unit:'pcs',price:75000},
{id:11,cat:'Cetak Khusus',name:'Poster A3',unit:'pcs',price:15000},
{id:12,cat:'Cetak Khusus',name:'Kartu Nama',unit:'box',price:30000},
{id:13,cat:'Cetak Khusus',name:'ID Card',unit:'pcs',price:10000},
{id:14,cat:'Cetak Khusus',name:'Sertifikat',unit:'pcs',price:5000},
{id:15,cat:'Souvenir',name:'Cetak Mug',unit:'pcs',price:25000}
],
transactions:[],settings:{name:'STUDIO JOYO BARU 2',sub:'PHOTO • PRINTING • COPY CENTER',phone:'',address:'',hours:'07.00 WIB – 22.00 WIB'}
};
let cart=[],cat='Semua';

function save(){localStorage.setItem(KEY,JSON.stringify(db))}
// Pastikan layanan banner/spanduk memakai perhitungan luas untuk database lama.
(function migrate(){const b=db.services.find(x=>x.name==='Banner');if(b)b.unit='m²';if(!db.services.some(x=>x.name==='Spanduk'))db.services.push({id:16,cat:'Banner',name:'Spanduk',unit:'m²',price:25000});save()})();
function rp(n){return new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n||0).replace('IDR','Rp')}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function today(){return new Date().toISOString().slice(0,10)}
function badge(s){return '<span class="badge '+(s==='Selesai'?'done':s==='Diproses'?'proc':'wait')+'">'+s+'</span>'}

function view(id){
 document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));
 document.getElementById(id).classList.add('active');
 document.querySelectorAll('.nav button').forEach(x=>x.classList.toggle('active',x.dataset.view===id.replace('v-','')));
 const titles={dashboard:['Dashboard','Ringkasan penjualan hari ini'],kasir:['Kasir','Input transaksi pelanggan'],pesanan:['Pesanan','Status pesanan percetakan'],arsip:['Riwayat / Arsip','Pesanan yang sudah diarsipkan'],layanan:['Layanan & Harga','Kelola layanan dan harga'],laporan:['Laporan','Laporan penjualan'],pengaturan:['Pengaturan','Identitas toko dan data']};
 const t=titles[id.replace('v-','')]||titles.dashboard;document.getElementById('title').textContent=t[0];document.getElementById('sub').textContent=t[1];
 renderAll();
}
document.querySelectorAll('.nav button').forEach(b=>b.onclick=()=>view('v-'+b.dataset.view));
document.getElementById('newTx').onclick=()=>view('v-kasir');

function renderAll(){dash();kasir();orders();renderArchive();services();report();settings()}
function dash(){
 const tx=db.transactions.filter(t=>t.date.slice(0,10)===today());
 document.getElementById('omzet').textContent=rp(tx.reduce((a,t)=>a+t.total,0));
 document.getElementById('jumlahTx').textContent=tx.length;
 document.getElementById('diproses').textContent=db.transactions.filter(t=>t.status==='Menunggu'||t.status==='Diproses').length;
 document.getElementById('piutang').textContent=rp(db.transactions.filter(t=>t.payment!=='Lunas').reduce((a,t)=>a+t.total,0));
 document.getElementById('recent').innerHTML=db.transactions.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6).map(t=>'<div class="row" style="padding:9px 0;border-bottom:1px solid #eee"><span><b>'+esc(t.invoice)+'</b><br><small>'+esc(t.customer||'Umum')+'</small></span><span>'+rp(t.total)+'<br>'+badge(t.status)+'</span></div>').join('')||'<div class="empty">Belum ada transaksi.</div>';
}
function cats(){return ['Semua',...new Set(db.services.map(s=>s.cat))]}
function kasir(){
 document.getElementById('tabs').innerHTML=cats().map(c=>'<button class="tab '+(c===cat?'active':'')+'" onclick="cat=\''+c.replace(/'/g,"\\'")+'\';kasir()">'+esc(c)+'</button>').join('');
 const q=(document.getElementById('findSvc').value||'').toLowerCase();
 const list=db.services.filter(s=>(cat==='Semua'||s.cat===cat)&&(!q||s.name.toLowerCase().includes(q)));
 document.getElementById('svcGrid').innerHTML=list.map(s=>'<button class="service" onclick="add('+s.id+')"><b>'+esc(s.name)+'</b><small>'+rp(s.price)+' / '+esc(s.unit)+'</small></button>').join('')||'<div class="empty">Tidak ditemukan.</div>';
 const sub=cart.reduce((a,x)=>a+(x.area?x.area*x.price*x.qty:x.qty*x.price),0),disc=Number(document.getElementById('disc').value||0),total=Math.max(0,sub-disc);
 document.getElementById('cart').innerHTML=cart.map((x,i)=>'<div class="cart-item"><span><b>'+esc(x.name)+'</b><br><small>'+x.qty+' '+esc(x.unit)+' × '+rp(x.price)+'</small></span><span class="qty"><button onclick="chg('+i+',-1)">−</button> '+x.qty+' <button onclick="chg('+i+',1)">+</button><br><b>'+rp(x.qty*x.price)+'</b></span></div>').join('')||'<div class="empty">Keranjang kosong.</div>';
 document.getElementById('subTotal').textContent=rp(sub);document.getElementById('discount').textContent=rp(disc);document.getElementById('total').textContent=rp(total);
}
document.getElementById('findSvc').oninput=kasir;document.getElementById('disc').oninput=kasir;
window.add=function(id){
 const s=db.services.find(x=>x.id===id); if(!s)return;
 if(s.unit==='m²'){
   const w=prompt('Lebar ('+'meter'+')\nContoh: 3 untuk 3 meter','3'); if(w===null)return;
   const h=prompt('Tinggi ('+'meter'+')\nContoh: 1 untuk 1 meter','1'); if(h===null)return;
   const width=Number(String(w).replace(',','.')),height=Number(String(h).replace(',','.'));
   if(!(width>0&&height>0))return alert('Ukuran tidak valid. Masukkan angka lebih dari 0.');
   const area=Math.round(width*height*10000)/10000;
   const customId=Date.now()+Math.floor(Math.random()*1000);
   cart.push({id:customId,serviceId:s.id,name:s.name+' ('+width+' × '+height+' m)',unit:'m²',price:s.price,qty:1,width,height,area});
 }else{
   const x=cart.find(x=>x.id===id);if(x)x.qty++;else cart.push({id:s.id,serviceId:s.id,name:s.name,unit:s.unit,price:s.price,qty:1});
 }
 kasir()
}
window.chg=function(i,n){cart[i].qty+=n;if(cart[i].qty<1)cart.splice(i,1);kasir()}
document.getElementById('clear').onclick=()=>{cart=[];document.getElementById('disc').value=0;kasir()};

document.getElementById('saveTx').onclick=()=>{
 if(!cart.length)return alert('Keranjang masih kosong.');
 const sub=cart.reduce((a,x)=>a+(x.area?x.area*x.price*x.qty:x.qty*x.price),0),disc=Number(document.getElementById('disc').value||0),total=Math.max(0,sub-disc);
 const id=Date.now(),invoice='SJB2-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+String(db.transactions.length+1).padStart(4,'0');
 const dueDate=document.getElementById('dueDate').value;
 if(!dueDate)return alert('Silakan tentukan tanggal dan jam selesai / pengambilan.');
 const t={id,invoice,date:new Date().toISOString(),dueDate,customer:document.getElementById('cust').value.trim(),phone:document.getElementById('phone').value.trim(),payment:document.getElementById('pay').value,channel:document.getElementById('channel').value,status:'Menunggu',discount:disc,total,items:cart.map(x=>({...x}))};
 db.transactions.push(t);save();alert('Transaksi '+invoice+' berhasil disimpan.');cart=[];document.getElementById('disc').value=0;document.getElementById('cust').value='';document.getElementById('phone').value='';document.getElementById('dueDate').value='';view('v-pesanan');
};

function orders(){
 const q=(document.getElementById('findOrder').value||'').toLowerCase(),f=document.getElementById('filterOrder').value;
 const rows=db.transactions.slice().sort((a,b)=>b.date.localeCompare(a.date)).filter(t=>!t.archived&&(f==='Semua'||t.status===f)&&((t.invoice+' '+t.customer).toLowerCase().includes(q)));
 document.getElementById('orderRows').innerHTML=rows.map(t=>'<tr><td><b>'+t.invoice+'</b></td><td>'+new Date(t.date).toLocaleDateString('id-ID')+'</td><td>'+esc(t.customer||'Umum')+'</td><td>'+t.items.map(i=>esc(i.name)+' × '+i.qty).join('<br>')+'</td><td><b>'+ (t.dueDate?new Date(t.dueDate).toLocaleString('id-ID',{weekday:'long',day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}):'Belum ditentukan') +'</b></td><td>'+rp(t.total)+'</td><td>'+t.payment+'</td><td>'+badge(t.status)+'</td><td><select onchange="setStatus('+t.id+',this.value)"><option '+(t.status==='Menunggu'?'selected':'')+'>Menunggu</option><option '+(t.status==='Diproses'?'selected':'')+'>Diproses</option><option '+(t.status==='Selesai'?'selected':'')+'>Selesai</option><option '+(t.status==='Dibatalkan'?'selected':'')+'>Dibatalkan</option></select><br><button class="btn light" style="margin-top:5px" onclick="openReceipt('+t.id+')">🧾 Nota</button><br><button class="btn secondary" style="margin-top:5px" onclick="archiveOrder('+t.id+')">🗄️ Arsipkan</button></td></tr>').join('')||'<tr><td colspan="8" class="empty">Belum ada pesanan.</td></tr>';
}
window.setStatus=(id,s)=>{const t=db.transactions.find(x=>x.id===id);if(t){t.status=s;save();orders();dash()}}
document.getElementById('findOrder').oninput=orders;document.getElementById('filterOrder').onchange=orders;
function renderArchive(){
 const q=(document.getElementById('findArchive')?.value||'').toLowerCase();
 const rows=db.transactions.filter(t=>t.archived).slice().sort((a,b)=>b.date.localeCompare(a.date)).filter(t=>(t.invoice+' '+(t.customer||'')).toLowerCase().includes(q));
 const el=document.getElementById('archiveRows'); if(!el)return;
 el.innerHTML=rows.map(t=>'<tr><td><b>'+esc(t.invoice)+'</b></td><td>'+new Date(t.date).toLocaleDateString('id-ID')+'</td><td>'+esc(t.customer||'Umum')+'</td><td>'+(t.dueDate?new Date(t.dueDate).toLocaleString('id-ID',{weekday:'long',day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}):'-')+'</td><td>'+rp(t.total)+'</td><td>'+badge(t.status)+'</td><td><button class="btn light" onclick="openReceipt('+t.id+')">🧾 Nota</button> <button class="btn danger" onclick="deleteOrder('+t.id+')">Hapus</button></td></tr>').join('')||'<tr><td colspan="7" class="empty">Belum ada arsip.</td></tr>';
}
window.archiveOrder=function(id){
 const t=db.transactions.find(x=>x.id===id); if(!t)return;
 if(t.status!=='Selesai')return alert('Pesanan harus berstatus Selesai sebelum diarsipkan.');
 t.archived=true;save();orders();renderArchive();dash();
}
window.restoreOrder=function(id){const t=db.transactions.find(x=>x.id===id);if(t){t.archived=false;save();orders();renderArchive();dash()}}
window.deleteOrder=function(id){if(!confirm('Hapus pesanan ini secara permanen? Data transaksi juga akan hilang dari laporan.'))return;db.transactions=db.transactions.filter(x=>x.id!==id);save();orders();renderArchive();dash();report();}
document.getElementById('findArchive').oninput=renderArchive;

function services(){
 document.getElementById('serviceRows').innerHTML=db.services.map(s=>'<tr><td>'+esc(s.cat)+'</td><td>'+esc(s.name)+'</td><td>'+esc(s.unit)+'</td><td>'+rp(s.price)+'</td><td><button class="btn light" onclick="editSvc('+s.id+')">Edit</button> <button class="btn danger" onclick="delSvc('+s.id+')">Hapus</button></td></tr>').join('');
}
window.editSvc=id=>{const s=db.services.find(x=>x.id===id),p=prompt('Harga untuk '+s.name,s.price);if(p!==null&&!isNaN(p)){s.price=Number(p);save();services();kasir()}};
window.delSvc=id=>{if(confirm('Hapus layanan ini?')){db.services=db.services.filter(s=>s.id!==id);save();services();kasir()}};
document.getElementById('addSvc').onclick=()=>{const name=prompt('Nama layanan baru');if(!name)return;const price=Number(prompt('Harga',0));const unit=prompt('Satuan','pcs')||'pcs';const c=prompt('Kategori','Lainnya')||'Lainnya';db.services.push({id:Date.now(),cat:c,name,unit,price});save();renderAll()};

function report(){
 const from=document.getElementById('from').value,to=document.getElementById('to').value;
 const rows=db.transactions.filter(t=>(!from||t.date.slice(0,10)>=from)&&(!to||t.date.slice(0,10)<=to));
 const sum=rows.reduce((a,t)=>a+t.total,0);
 document.getElementById('rSum').textContent=rp(sum);document.getElementById('rCount').textContent=rows.length;
 document.getElementById('rAvg').textContent=rp(rows.length?sum/rows.length:0);
 document.getElementById('reportRows').innerHTML=rows.sort((a,b)=>b.date.localeCompare(a.date)).map(t=>'<tr><td>'+new Date(t.date).toLocaleDateString('id-ID')+'</td><td>'+t.invoice+'</td><td>'+esc(t.customer||'Umum')+'</td><td>'+t.channel+'</td><td>'+rp(t.total)+'</td></tr>').join('')||'<tr><td colspan="5" class="empty">Tidak ada data.</td></tr>';
}

function settings(){
 document.getElementById('storeName').value=db.settings.name;document.getElementById('storeSub').value=db.settings.sub;document.getElementById('storePhone').value=db.settings.phone;document.getElementById('storeAddress').value=db.settings.address;document.getElementById('storeHours').value=db.settings.hours;
}
document.getElementById('saveSet').onclick=()=>{db.settings={name:storeName.value,sub:storeSub.value,phone:storePhone.value,address:storeAddress.value,hours:storeHours.value};save();alert('Pengaturan tersimpan.')};
document.getElementById('backup').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(db,null,2)],{type:'application/json'}));a.download='backup-studio-joyo.json';a.click()};
document.getElementById('reset').onclick=()=>{if(confirm('Hapus semua transaksi?')){db.transactions=[];save();renderAll()}};
function openReceipt(id){
 const t=db.transactions.find(x=>x.id===id); if(!t)return;
 const subtotal=t.items.reduce((a,i)=>a+i.qty*i.price,0);
 document.getElementById('receiptPaper').innerHTML='<div class="receipt-paper">'+
 '<h2>'+esc(db.settings.name)+'</h2><div class="center small">'+esc(db.settings.sub)+'</div>'+
 (db.settings.address?'<div class="center small">'+esc(db.settings.address)+'</div>':'')+
 (db.settings.phone?'<div class="center small">'+esc(db.settings.phone)+'</div>':'')+
 '<hr><div class="line"><span>Nota</span><b>'+esc(t.invoice)+'</b></div>'+
 '<div class="line"><span>Tanggal</span><span>'+new Date(t.date).toLocaleString('id-ID')+'</span></div>'+
 '<div class="line"><span>Pelanggan</span><span>'+esc(t.customer||'Umum')+'</span></div>'+
 '<div class="line"><b>SELESAI / DIAMBIL</b><b>'+ (t.dueDate?new Date(t.dueDate).toLocaleString('id-ID',{weekday:'long',day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}):'Belum ditentukan') +'</b></div>'+
 (t.phone?'<div class="line"><span>No. HP</span><span>'+esc(t.phone)+'</span></div>':'')+
 '<hr>'+t.items.map(i=>'<div class="item"><div><b>'+esc(i.name)+'</b></div><div class="line"><span>'+i.qty+' '+esc(i.unit)+' × '+rp(i.price)+'</span><span>'+rp(i.qty*i.price)+'</span></div></div>').join('')+
 '<hr><div class="line"><span>Subtotal</span><b>'+rp(subtotal)+'</b></div>'+
 '<div class="line"><span>Diskon</span><span>- '+rp(t.discount||0)+'</span></div>'+
 '<div class="line total"><span>TOTAL</span><span>'+rp(t.total)+'</span></div>'+
 '<div class="line"><span>Pembayaran</span><span>'+esc(t.payment)+'</span></div>'+
 '<div class="line"><span>Status</span><span>'+esc(t.status)+'</span></div>'+
 '<hr><div class="center small">Terima kasih telah menggunakan layanan kami.</div>'+
 '</div>';
 document.getElementById('receiptModal').classList.add('show');
}
function closeReceipt(){document.getElementById('receiptModal').classList.remove('show')}
function printReceipt(){window.print()}
window.openReceipt=openReceipt;window.closeReceipt=closeReceipt;window.printReceipt=printReceipt;

view('v-dashboard');