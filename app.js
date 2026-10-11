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
transactions:[],settings:{name:'STUDIO JOYO BARU 2',sub:'PHOTO • PRINTING • COPY CENTER',phone:'0857 4826 5687',address:'Graha Suko Indah No. 1A, Sukolegok, Sukodono, Sidoarjo',hours:'07.00 WIB – 22.00 WIB'}
};
let cart=[],cat='Semua',customDraft=null;

// ==================== SUPABASE ONLINE ====================
const SUPABASE_URL='https://makwvkvfignunryprxkj.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_DOhmDG2qDlznNvbGQM024g_J3gb0k7M';
const supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
let cloudReady=false, cloudBusy=false, cloudTimer=null;

function localSave(){localStorage.setItem(KEY,JSON.stringify(db))}
function save(){localSave(); if(cloudReady) queueCloudSync()}
function queueCloudSync(){clearTimeout(cloudTimer);cloudTimer=setTimeout(()=>syncCloud().catch(e=>console.error(e)),500)}

function showLogin(show,msg=''){
  const g=document.getElementById('loginGate'); if(g)g.style.display=show?'flex':'none';
  const m=document.getElementById('loginMsg'); if(m)m.textContent=msg;
  const out=document.getElementById('logoutBtn'); if(out)out.style.display=show?'none':'inline-block';
}
async function loginKasir(){
  const email=document.getElementById('loginEmail').value.trim(), password=document.getElementById('loginPassword').value;
  const btn=document.getElementById('loginBtn'); if(!email||!password){showLogin(true,'Email dan password wajib diisi.');return}
  btn.disabled=true;btn.textContent='Memeriksa koneksi...';
  try{
    const test=await fetch(SUPABASE_URL+'/auth/v1/settings',{method:'GET',headers:{apikey:SUPABASE_PUBLISHABLE_KEY}});
    if(!test.ok) throw new Error('Server Supabase tidak merespons normal (HTTP '+test.status+').');
    btn.textContent='Memproses...';
    const {error}=await supabaseClient.auth.signInWithPassword({email,password});
    if(error)showLogin(true,'Login gagal: '+error.message);
  }catch(e){
    const msg=String(e?.message||e);
    if(/Failed to fetch|NetworkError|fetch/i.test(msg)){
      showLogin(true,'Tidak bisa terhubung ke server Supabase. Periksa apakah project Supabase aktif dan URL API benar. Coba buka '+SUPABASE_URL+' di browser yang sama.');
    }else showLogin(true,'Login gagal: '+msg);
  }finally{
    btn.disabled=false;btn.textContent='Masuk';
  }
}
async function logoutKasir(){await supabaseClient.auth.signOut()}
async function syncCloud(){
  if(!cloudReady||cloudBusy)return;
  cloudBusy=true;
  try{
    const now=new Date().toISOString();
    const settingsRow={id:1,store_name:db.settings.name,store_sub:db.settings.sub,phone:db.settings.phone,address:db.settings.address,hours:db.settings.hours,updated_at:now};
    const sr=await supabaseClient.from('sjb_settings').upsert(settingsRow,{onConflict:'id'}); if(sr.error)throw sr.error;

    // Reconcile deleted services: keep them in the database as inactive so they do not return after login.
    const remoteSvc=await supabaseClient.from('sjb_services').select('id,active');
    if(remoteSvc.error)throw remoteSvc.error;
    const localServiceIds=new Set(db.services.map(s=>Number(s.id)));
    const removedServiceIds=(remoteSvc.data||[]).filter(s=>s.active && !localServiceIds.has(Number(s.id))).map(s=>s.id);
    if(removedServiceIds.length){
      const dr=await supabaseClient.from('sjb_services').update({active:false,updated_at:now}).in('id',removedServiceIds);
      if(dr.error)throw dr.error;
    }
    if(db.services.length){
      const services=db.services.map(s=>({id:Number(s.id),category:s.cat,name:s.name,unit:s.unit,price:Number(s.price)||0,variants:Array.isArray(s.variants)?s.variants:[],active:true,updated_at:now}));
      const rr=await supabaseClient.from('sjb_services').upsert(services,{onConflict:'id'}); if(rr.error)throw rr.error;
    }

    // Permanently remove cloud transactions that were deleted locally.
    const remoteTx=await supabaseClient.from('sjb_transactions').select('id,invoice');
    if(remoteTx.error)throw remoteTx.error;
    const localRemoteIds=new Set(db.transactions.filter(t=>t.remoteId).map(t=>String(t.remoteId)));
    const localInvoices=new Set(db.transactions.map(t=>String(t.invoice)));
    const removedTxIds=(remoteTx.data||[]).filter(t=>!localRemoteIds.has(String(t.id))&&!localInvoices.has(String(t.invoice))).map(t=>t.id);
    if(removedTxIds.length){
      const dr=await supabaseClient.from('sjb_transactions').delete().in('id',removedTxIds);
      if(dr.error)throw dr.error;
    }

    for(const t of db.transactions){
      const row={invoice:t.invoice,transaction_date:t.date,due_date:t.dueDate||null,customer:t.customer||'',phone:t.phone||'',payment:t.payment||'Lunas',dp:Number(t.dp)||0,channel:t.channel||'Kasir',status:t.status||'Menunggu',discount:Number(t.discount)||0,total:Number(t.total)||0,items:t.items||[],archived:!!t.archived,updated_at:now};
      let q;
      if(t.remoteId){q=await supabaseClient.from('sjb_transactions').update(row).eq('id',t.remoteId).select('id').single()}
      else{q=await supabaseClient.from('sjb_transactions').insert(row).select('id').single()}
      if(q.error)throw q.error;
      if(!t.remoteId){t.remoteId=q.data.id}
    }
    localSave();
  }finally{cloudBusy=false}
}
async function loadCloud(){
  const [setR,svcR,txR]=await Promise.all([
    supabaseClient.from('sjb_settings').select('*').limit(1).maybeSingle(),
    supabaseClient.from('sjb_services').select('*').order('id'),
    supabaseClient.from('sjb_transactions').select('*').order('transaction_date',{ascending:false})
  ]);
  if(setR.error)throw setR.error;if(svcR.error)throw svcR.error;if(txR.error)throw txR.error;
  // Only migrate browser data when both cloud tables have never had records.
  if(!svcR.data?.length && !txR.data?.length){
    await syncCloud();
    return;
  }
  if(setR.data)db.settings={name:setR.data.store_name,sub:setR.data.store_sub,phone:setR.data.phone||'',address:setR.data.address||'',hours:setR.data.hours||''};
  db.services=(svcR.data||[]).filter(s=>s.active).map(s=>({id:Number(s.id),cat:s.category,name:s.name,unit:s.unit,price:Number(s.price),variants:Array.isArray(s.variants)?s.variants:[]}));
  db.transactions=(txR.data||[]).map((t,i)=>({id:Date.now()+i,remoteId:t.id,invoice:t.invoice,date:t.transaction_date,dueDate:t.due_date||'',customer:t.customer||'',phone:t.phone||'',payment:t.payment,dp:Number(t.dp)||0,channel:t.channel,status:t.status,discount:Number(t.discount)||0,total:Number(t.total)||0,items:t.items||[],archived:!!t.archived}));
  localSave();
}
async function startCloud(){
  const {data:{session}}=await supabaseClient.auth.getSession();
  if(session){
    cloudReady=true;
    try{await loadCloud();showLogin(false);renderAll()}catch(e){cloudReady=false;showLogin(true,'Database belum dapat dibaca: '+e.message);console.error(e)}
  }else showLogin(true);
}
document.getElementById('loginBtn').onclick=loginKasir;
document.getElementById('loginPassword').addEventListener('keydown',e=>{if(e.key==='Enter')loginKasir()});
document.getElementById('logoutBtn').onclick=logoutKasir;
function showPasswordRecovery() {
  showLogin(false);

  let box = document.getElementById('passwordRecoveryGate');

  if (!box) {
    box = document.createElement('div');
    box.id = 'passwordRecoveryGate';
    box.style.cssText =
      'position:fixed;inset:0;z-index:99999;background:#f3f7f4;' +
      'display:flex;align-items:center;justify-content:center;padding:20px;' +
      'font-family:Arial,sans-serif';

    box.innerHTML = `
      <div style="background:white;padding:28px;border-radius:18px;
        width:min(420px,100%);box-shadow:0 10px 35px #0002">
        <h2 style="color:#174b38">Buat Password Baru</h2>
        <p>Masukkan password baru untuk akun kasir.</p>

        <label for="recoveryPass1">Password baru</label>
        <input id="recoveryPass1" type="password"
          autocomplete="new-password"
          style="box-sizing:border-box;width:100%;padding:12px;
          margin:8px 0 16px;border:1px solid #ddd;border-radius:8px">

        <label for="recoveryPass2">Ulangi password baru</label>
        <input id="recoveryPass2" type="password"
          autocomplete="new-password"
          style="box-sizing:border-box;width:100%;padding:12px;
          margin:8px 0 12px;border:1px solid #ddd;border-radius:8px">

        <p id="recoveryMsg" style="color:#b42318"></p>

        <button id="recoverySaveBtn"
          style="width:100%;padding:13px;background:#1f6b4f;
          color:white;border:0;border-radius:8px;font-weight:bold">
          Simpan Password Baru
        </button>
      </div>`;

    document.body.appendChild(box);

    document.getElementById('recoverySaveBtn').onclick = async () => {
      const p1 = document.getElementById('recoveryPass1').value;
      const p2 = document.getElementById('recoveryPass2').value;
      const msg = document.getElementById('recoveryMsg');
      const btn = document.getElementById('recoverySaveBtn');

      if (p1.length < 8) {
        msg.textContent = 'Password minimal 8 karakter.';
        return;
      }

      if (p1 !== p2) {
        msg.textContent = 'Kedua password belum sama.';
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Menyimpan...';
      msg.textContent = '';

      try {
        const { error } =
          await supabaseClient.auth.updateUser({ password: p1 });

        if (error) throw error;

        box.remove();
        await supabaseClient.auth.signOut();
        showLogin(true,
          'Password berhasil diubah. Silakan login dengan password baru.');
      } catch (e) {
        msg.textContent = 'Gagal mengubah password: ' + e.message;
        btn.disabled = false;
        btn.textContent = 'Simpan Password Baru';
      }
    };
  }

  box.style.display = 'flex';
}

supabaseClient.auth.onAuthStateChange(async (event, session) => {
  if (event === 'PASSWORD_RECOVERY') {
    showPasswordRecovery();
    return;
  }

  if (event === 'SIGNED_OUT') {
    cloudReady = false;
    if (!document.getElementById('passwordRecoveryGate')) {
      showLogin(true);
    }
    return;
  }

  if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
    try {
      cloudReady = true;
      await loadCloud();
      showLogin(false);
      renderAll();
    } catch (e) {
      cloudReady = false;
      showLogin(true, 'Gagal memuat database: ' + e.message);
      console.error(e);
    }
  }
});


// Pastikan layanan banner/spanduk memakai perhitungan luas untuk database lama.
(function migrate(){const b=db.services.find(x=>x.name==='Banner');if(b)b.unit='m²';if(!db.services.some(x=>x.name==='Spanduk'))db.services.push({id:16,cat:'Banner',name:'Spanduk',unit:'m²',price:25000});if(!db.settings.phone)db.settings.phone='0857 4826 5687';if(!db.settings.address)db.settings.address='Graha Suko Indah No. 1A, Sukolegok, Sukodono, Sidoarjo';save()})();
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
 document.getElementById('tabs').innerHTML=cats().map(c=>'<button class="tab '+(c===cat?'active':'')+'" onclick="selectCategory(\''+esc(c)+'\')">'+esc(c)+'</button>').join('');
 const q=(document.getElementById('findSvc').value||'').toLowerCase();
 const list=db.services.filter(s=>(cat==='Semua'||s.cat===cat)&&(!q||s.name.toLowerCase().includes(q)));
 document.getElementById('svcGrid').innerHTML=list.map(s=>'<button class="service" onclick="add('+s.id+')"><b>'+esc(s.name)+'</b><small>'+(s.variants?.length?'Pilih ukuran • '+s.variants.length+' pilihan':rp(s.price)+' / '+(s.cat==='Banner'?'m²':esc(s.unit)))+'</small>'+(s.variants?.length?'<small style="display:block;margin-top:5px;color:#1f6b4f;font-weight:700">▾ Pilihan ukuran</small>':(s.cat==='Banner'?'<small style="display:block;margin-top:5px;color:#1f6b4f;font-weight:700">📐 Ukuran Custom</small>':''))+'</button>').join('')||'<div class="empty">Tidak ditemukan.</div>';
 const sub=cart.reduce((a,x)=>a+(x.area?x.area*x.price*x.qty:x.qty*x.price),0),disc=Number(document.getElementById('disc').value||0),total=Math.max(0,sub-disc);
 const cb=document.getElementById('customSizeBox');
 if(cb){
  if(customDraft){
   cb.style.display='block';
   if(customDraft.kind==='variant'){
    const isMatrix=customDraft.variants.some(v=>v.size&&v.ply);
    const v=isMatrix?(customDraft.variants.find(x=>x.size===customDraft.size&&x.ply===customDraft.ply)||customDraft.variants[0]):(customDraft.variants[Number(customDraft.variantIndex)||0]||customDraft.variants[0]);
    if(isMatrix){
     cb.innerHTML='<h3>▾ Pilih Ukuran & Rangkap — '+esc(customDraft.name)+'</h3><div class="hint">Pilih ukuran kertas dan jumlah rangkap. Harga per rim mengikuti kombinasi pilihan.</div><div class="size-grid"><div><label>Ukuran kertas</label><select id="variantSize" onchange="updateMatrixDraft()">'+[...new Set(customDraft.variants.map(x=>x.size))].map(x=>'<option '+(x===customDraft.size?'selected':'')+'>'+esc(x)+'</option>').join('')+'</select></div><div><label>Jumlah rangkap</label><select id="variantPly" onchange="updateMatrixDraft()">'+[...new Set(customDraft.variants.map(x=>x.ply))].map(x=>'<option '+(x===customDraft.ply?'selected':'')+'>'+esc(x)+'</option>').join('')+'</select></div><div><label>Qty (rim)</label><input id="variantQty" type="number" min="1" step="1" value="'+(customDraft.qty||1)+'" oninput="customDraft.qty=this.value"></div></div><div class="area" id="customArea">Harga: '+rp(v.price)+' / '+esc(v.unit||'rim')+'</div><button class="btn primary" onclick="addVariantToCart()">+ Tambahkan ke Keranjang</button> <button class="btn light" onclick="customDraft=null;kasir()">Batal</button>';
    }else{
     cb.innerHTML='<h3>▾ Pilih Ukuran — '+esc(customDraft.name)+'</h3><div class="hint">Pilih ukuran kertas, harga otomatis mengikuti pilihan.</div><div class="size-grid"><div style="grid-column:span 2"><label>Ukuran kertas</label><select id="variantSelect" onchange="updateVariantDraft(this.value)">'+customDraft.variants.map((v,i)=>'<option value="'+i+'" '+(i===Number(customDraft.variantIndex)?'selected':'')+'>'+esc(v.label)+' — '+rp(v.price)+'</option>').join('')+'</select></div><div><label>Qty</label><input id="variantQty" type="number" min="1" step="1" value="'+(customDraft.qty||1)+'" oninput="customDraft.qty=this.value"></div></div><div class="area" id="customArea">Harga: '+rp(v.price)+' / '+esc(v.unit||customDraft.unit||'pcs')+'</div><button class="btn primary" onclick="addVariantToCart()">+ Tambahkan ke Keranjang</button> <button class="btn light" onclick="customDraft=null;kasir()">Batal</button>';
    }
   }else{
    cb.innerHTML='<h3>📐 Ukuran Custom — '+esc(customDraft.name)+'</h3><div class="hint">Masukkan ukuran sesuai pesanan. Harga dihitung berdasarkan luas (m²).</div><div class="size-grid"><div><label>Lebar (meter)</label><input id="customW" type="number" min="0.01" step="0.01" value="'+(customDraft.width||'')+'" oninput="updateCustomArea()"></div><div><label>Tinggi (meter)</label><input id="customH" type="number" min="0.01" step="0.01" value="'+(customDraft.height||'')+'" oninput="updateCustomArea()"></div><div><label>Qty</label><input id="customQty" type="number" min="1" step="1" value="'+(customDraft.qty||1)+'" oninput="updateCustomArea()"></div></div><div class="area" id="customArea">Luas: 0 m² • Total: Rp0</div><button class="btn primary" onclick="addCustomToCart()">+ Tambahkan ke Keranjang</button> <button class="btn light" onclick="customDraft=null;kasir()">Batal</button>';
   }
  }else{cb.style.display='none';cb.innerHTML='';}
 }
 document.getElementById('cart').innerHTML=cart.map((x,i)=>'<div class="cart-item"><span><b>'+esc(x.name)+'</b><br><small>'+x.qty+' '+esc(x.unit)+' × '+rp(x.price)+'</small></span><span class="qty"><button onclick="chg('+i+',-1)">−</button> '+x.qty+' <button onclick="chg('+i+',1)">+</button><br><b>'+rp(x.qty*x.price)+'</b></span></div>').join('')||'<div class="empty">Keranjang kosong.</div>';
 document.getElementById('subTotal').textContent=rp(sub);document.getElementById('discount').textContent=rp(disc);document.getElementById('total').textContent=rp(total);updateDpSummary();
}
window.selectCategory=function(c){cat=c;kasir()};
window.updateDpSummary=function(){const total=Number(document.getElementById('total')?.textContent?.replace(/[^0-9]/g,'')||0);const method=document.getElementById('pay')?.value||'Lunas';const input=document.getElementById('dpAmount');if(!input)return;let paid=method==='Lunas'?total:(method==='Belum Bayar'?0:Number(input.value||0));if(method==='Lunas'){input.value=total;input.disabled=true;}else if(method==='Belum Bayar'){input.value=0;input.disabled=true;}else{input.disabled=false;}paid=Math.max(0,Math.min(total,paid));const d=document.getElementById('dpPreview'),b=document.getElementById('balancePreview');if(d)d.textContent=rp(paid);if(b)b.textContent=rp(Math.max(0,total-paid));};
document.getElementById('findSvc').oninput=kasir;document.getElementById('disc').oninput=kasir;
window.add=function(id){
 const s=db.services.find(x=>x.id===id); if(!s)return;
 if(Array.isArray(s.variants)&&s.variants.length){
   const matrix=s.variants.filter(v=>v.size&&v.ply);
   customDraft={kind:'variant',serviceId:s.id,name:s.name,variants:s.variants,variantIndex:0,size:matrix[0]?.size||'',ply:matrix[0]?.ply||'',qty:1,unit:s.unit};kasir();return;
 }
 if(s.cat==='Banner'||s.unit==='m²'){
   customDraft={kind:'area',serviceId:s.id,name:s.name,price:s.price,width:'',height:'',qty:1};kasir();return;
 }
 if(false){
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
window.updateVariantDraft=function(i){if(!customDraft||customDraft.kind!=='variant')return;customDraft.variantIndex=Number(i)||0;kasir()};
window.updateMatrixDraft=function(){if(!customDraft||customDraft.kind!=='variant')return;customDraft.size=document.getElementById('variantSize')?.value||customDraft.size;customDraft.ply=document.getElementById('variantPly')?.value||customDraft.ply;kasir()};
window.addVariantToCart=function(){if(!customDraft||customDraft.kind!=='variant')return;const matrix=customDraft.variants.some(v=>v.size&&v.ply);const v=matrix?(customDraft.variants.find(x=>x.size===document.getElementById('variantSize')?.value&&x.ply===document.getElementById('variantPly')?.value)):customDraft.variants[Number(customDraft.variantIndex)||0]||customDraft.variants[0];if(!v)return alert('Kombinasi ukuran dan rangkap belum memiliki harga.');const q=Number(document.getElementById('variantQty')?.value||customDraft.qty||1);if(!(q>0))return alert('Qty harus lebih dari 0.');const label=matrix?(v.size+' - '+v.ply):v.label;const key=customDraft.serviceId+'-'+label;const existing=cart.find(x=>x.variantKey===key);if(existing)existing.qty+=q;else cart.push({id:Date.now()+Math.floor(Math.random()*1000),serviceId:customDraft.serviceId,variantKey:key,name:customDraft.name+' '+label,unit:v.unit||customDraft.unit||'pcs',price:Number(v.price)||0,qty:q});customDraft=null;kasir()};
window.updateCustomArea=function(){if(!customDraft||customDraft.kind==='variant')return;const w=Number(document.getElementById('customW')?.value||0),h=Number(document.getElementById('customH')?.value||0),q=Number(document.getElementById('customQty')?.value||1),a=Math.max(0,w*h);const el=document.getElementById('customArea');if(el)el.textContent='Luas: '+a.toFixed(2).replace(/\.00$/,'')+' m² • Total: '+rp(a*customDraft.price*q)};
window.addCustomToCart=function(){if(!customDraft||customDraft.kind==='variant')return;const w=Number(document.getElementById('customW').value),h=Number(document.getElementById('customH').value),q=Number(document.getElementById('customQty').value||1);if(!(w>0&&h>0&&q>0))return alert('Lebar, tinggi, dan qty harus diisi dengan benar.');const area=Math.round(w*h*10000)/10000;cart.push({id:Date.now()+Math.floor(Math.random()*1000),serviceId:customDraft.serviceId,name:customDraft.name+' ('+w+' × '+h+' m)',unit:'m²',price:customDraft.price,qty:q,width:w,height:h,area});customDraft=null;kasir()};
window.chg=function(i,n){cart[i].qty+=n;if(cart[i].qty<1)cart.splice(i,1);kasir()}
document.getElementById('clear').onclick=()=>{cart=[];document.getElementById('disc').value=0;kasir()};

document.getElementById('saveTx').onclick=()=>{
 if(!cart.length)return alert('Keranjang masih kosong.');
 const sub=cart.reduce((a,x)=>a+(x.area?x.area*x.price*x.qty:x.qty*x.price),0),disc=Number(document.getElementById('disc').value||0),total=Math.max(0,sub-disc);
 const id=Date.now(),invoice='SJB2-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+new Date().toTimeString().slice(0,8).replaceAll(':','')+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
 const dueDate=document.getElementById('dueDate').value;
 if(!dueDate)return alert('Silakan tentukan tanggal dan jam selesai / pengambilan.');
 const payment=document.getElementById('pay').value;const enteredDp=Number(document.getElementById('dpAmount').value||0);const dp=payment==='Lunas'?total:(payment==='Belum Bayar'?0:enteredDp);if(dp<0||dp>total)return alert('Nominal DP tidak boleh kurang dari 0 atau melebihi total transaksi.');const t={id,invoice,date:new Date().toISOString(),dueDate,customer:document.getElementById('cust').value.trim(),phone:document.getElementById('phone').value.trim(),payment,dp,channel:document.getElementById('channel').value,status:'Menunggu',discount:disc,total,items:cart.map(x=>({...x}))};
 db.transactions.push(t);save();alert('Transaksi '+invoice+' berhasil disimpan.');cart=[];document.getElementById('disc').value=0;document.getElementById('dpAmount').value=0;document.getElementById('cust').value='';document.getElementById('phone').value='';document.getElementById('dueDate').value='';view('v-pesanan');
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
 document.getElementById('serviceRows').innerHTML=db.services.map(s=>'<tr><td>'+esc(s.cat)+'</td><td>'+esc(s.name)+(s.variants?.length?'<br><small>'+s.variants.map(v=>esc(v.label)+' '+rp(v.price)).join(' • ')+'</small>':'')+'</td><td>'+esc(s.unit)+'</td><td>'+(s.variants?.length?'Mulai '+rp(Math.min(...s.variants.map(v=>Number(v.price)||0))):rp(s.price))+'</td><td><button class="btn light" onclick="editSvc('+s.id+')">Edit</button> <button class="btn danger" onclick="delSvc('+s.id+')">Hapus</button></td></tr>').join('');
}
window.editSvc=id=>{
 const s=db.services.find(x=>x.id===id); if(!s)return;
 const name=prompt('Nama layanan',s.name); if(name===null)return;
 const cat=prompt('Kategori',s.cat); if(cat===null)return;
 const unit=prompt('Satuan dasar (pcs / lembar / rim / m²)',s.unit); if(unit===null)return;
 if(!name.trim()||!cat.trim()||!unit.trim())return alert('Nama, kategori, dan satuan wajib diisi.');
 s.name=name.trim();s.cat=cat.trim();s.unit=unit.trim();
 if(Array.isArray(s.variants)&&s.variants.length){
   if(confirm('Layanan ini memiliki pilihan ukuran. Ubah daftar ukuran dan harga sekarang?')){
     const labels=prompt('Daftar ukuran dipisah koma',s.variants.map(v=>v.label).join(', '));if(labels===null)return;
     const names=labels.split(',').map(x=>x.trim()).filter(Boolean),next=[];
     for(const label of names){const old=s.variants.find(v=>v.label.toLowerCase()===label.toLowerCase());const raw=prompt('Harga '+s.name+' '+label,old?old.price:0);if(raw===null)return;const price=Number(raw);if(!Number.isFinite(price)||price<0)return alert('Harga tidak valid.');next.push({label,price,unit});}
     s.variants=next;s.price=Number(next[0]?.price||0);
   }
 }else{
   const p=prompt('Harga',s.price);if(p===null||!Number.isFinite(Number(p))||Number(p)<0)return alert('Harga tidak valid.');
   s.price=Number(p);
 }
 save();services();kasir()
};
window.delSvc=id=>{if(confirm('Hapus layanan ini?')){db.services=db.services.filter(s=>s.id!==id);save();services();kasir()}};
document.getElementById('addSvc').onclick=()=>{
 const name=prompt('Nama layanan baru (contoh: Brosur atau Cetak Nota)');if(!name||!name.trim())return;
 const c=prompt('Kategori layanan','CETAK OFFSET')||'Lainnya';
 const isNota=/nota/i.test(name);
 const unit=prompt('Satuan harga (untuk Cetak Nota gunakan rim)','pcs')||(isNota?'rim':'pcs');
 const makeVariants=confirm('Apakah layanan ini memiliki beberapa pilihan ukuran dengan harga berbeda?\\nPilih OK untuk mengatur pilihan ukuran.');
 let variants=[];
 if(makeVariants){
   if(isNota){
     const sizes=(prompt('Daftar ukuran, pisahkan koma','A6, A5, A4')||'').split(',').map(x=>x.trim()).filter(Boolean);
     if(!sizes.length)return alert('Ukuran belum diisi.');
     const plies=(prompt('Daftar rangkap/ply, pisahkan koma','1 Ply, 2 Ply, 3 Ply')||'').split(',').map(x=>x.trim()).filter(Boolean);
     if(!plies.length)return alert('Pilihan rangkap belum diisi.');
     for(const size of sizes)for(const ply of plies){const raw=prompt('Harga '+name.trim()+' ukuran '+size+' / '+ply+' per '+unit,'0');if(raw===null)return;const price=Number(raw);if(!Number.isFinite(price)||price<0)return alert('Harga tidak valid untuk '+size+' / '+ply);variants.push({label:size+' - '+ply,size,ply,price,unit});}
   }else{
     const labels=prompt('Masukkan pilihan ukuran, pisahkan dengan koma.\\nContoh: A6, A5, A4');if(!labels)return;
     const names=labels.split(',').map(x=>x.trim()).filter(Boolean);
     if(!names.length)return;
     for(const label of names){const raw=prompt('Harga '+name.trim()+' '+label+' (angka saja)',0);if(raw===null)return;const price=Number(raw);if(!Number.isFinite(price)||price<0)return alert('Harga untuk '+label+' tidak valid.');variants.push({label,price,unit});}
   }
 }
 const price=variants.length?Number(variants[0].price):Number(prompt('Harga layanan',0));
 db.services.push({id:Date.now(),cat:c.trim(),name:name.trim(),unit,price,variants});save();renderAll()
};

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
 const subtotal=t.items.reduce((a,i)=>a+(i.area?i.area*i.price*i.qty:i.qty*i.price),0);
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
 '<div class="line total"><span>TOTAL</span><span>'+rp(t.total)+'</span></div>'+'<div class="line"><span>Sudah Dibayar / DP</span><span>'+rp(t.dp||0)+'</span></div>'+'<div class="line"><b>SISA PEMBAYARAN</b><b>'+rp(Math.max(0,t.total-(t.dp||0)))+'</b></div>'+
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
startCloud();
