
// ════ 조립 인증서 출력 · 사진(사번 자동 연결 / QR 업로드) · 개인 QR 라벨 (2026-11-10, 가공과 동일 양식) ════
// · ④ 결과 이력 행의 🪪 버튼 → 인증서 모달(미리보기·설정·사진·인쇄)
// · 사진: cert_photo_get(사번) — 인증서용 사진(cert_photos) → 없으면 근태관리 직원 사진 자동 연결 → 없으면 인증서에 사진 업로드 QR 표시
// · 개인 QR(cert.html?p=공장&e=사번&t=a): 작업호기 부착용 라벨 — 스캔하면 인증서 확인 + 사진 등록
// · 설정(Gerente·유효기간·Departamento·본문·QR 기본주소)은 exam_config(cert*)에 저장되어 PC 공통
var CERT=(function(){
  const PLANT=2;
  const DEF={certManager:'Park Jae Yoon',certValidMonths:'6',certDept:'PRODUCCION ENSAMBLE',certBaseUrl:'https://yuraharness-mexico.pages.dev',certBody:CERT_DOC.DEFAULT_BODY};
  const cfg=Object.assign({},DEF);
  let cur=null;            // {r, empNo, photo, photoSrc}
  let _t=null,_cfgT=null;
  const $=id=>document.getElementById(id);
  const ymd=x=>x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');   // 현지 날짜 기준
  const today=()=>ymd(new Date());
  const addMonths=(d,m)=>{if(!d)return'';const x=new Date(d+'T00:00:00');if(isNaN(x))return'';x.setMonth(x.getMonth()+(parseInt(m)||0));return ymd(x);};
  function applyCfg(o){Object.keys(DEF).forEach(k=>{if(o&&o[k]!=null&&String(o[k])!=='')cfg[k]=String(o[k]);});}
  function urlOf(empNo){const b=String(cfg.certBaseUrl||location.origin).replace(/\/+$/,'');return b+'/cert.html?p='+PLANT+'&e='+encodeURIComponent(empNo)+'&t=a';}
  function qrSvg(text){const q=qrcode(0,'M');q.addData(text);q.make();return q.createSvgTag({cellSize:4,margin:0,scalable:true});}
  async function rpc(fn,args){return sbFetch('rpc/'+fn,{method:'POST',body:JSON.stringify(args)});}
  function gradeOf(r){try{const g=gradeLabelOf(r);return g==='미달'?'-':g;}catch(e){return'-';}}
  function stuOf(empNo){return (students||[]).find(s=>s.empId===empNo)||null;}
  function procEsOf(r){const s=stuOf(r.empId);if(s&&s.processEs)return s.processEs;const p=r.process||'';const o=(students||[]).find(x=>x.process===p&&x.processEs);return (o&&o.processEs)||r.processEs||p;}   // 본인 명단의 스페인어 공정명 → 같은 공정 다른 인원의 스페인어명 → 한글
  function isEs(){try{return currentLang==='es';}catch(e){return false;}}

  // ── 모달 열기 ──
  async function open(idx){
    const r=results[idx];if(!r)return;
    if(!r.empId){alert('사번이 없는 기록은 인증서를 출력할 수 없습니다');return;}
    if(!r.passed&&!confirm('합격 기록이 아닙니다(불합격/평가중). 그래도 인증서를 출력할까요?'))return;
    cur={r,empNo:String(r.empId).trim(),photo:null,photoSrc:''};
    $('certWho').textContent=`${r.name} · ${cur.empNo}`;
    $('cName').value=r.name||'';$('cEmp').value=cur.empNo;
    $('cDept').value=cfg.certDept;$('cProc').value=procEsOf(r);
    $('cScore').value=r.totalScore!=null?r.totalScore:'';$('cGrade').value=gradeOf(r);
    $('cHire').value=(r.hireDate||lookupHireDate(r.empId)||'').slice(0,10);
    $('cEval').value=(r.date||'').slice(0,10);
    $('cMonths').value=cfg.certValidMonths;$('cValid').value=addMonths($('cEval').value,cfg.certValidMonths);
    $('cIssue').value=today();$('cManager').value=cfg.certManager;$('cBody').value=cfg.certBody;$('cBase').value=cfg.certBaseUrl;
    $('cUrl').textContent=urlOf(cur.empNo);
    $('certModal').classList.add('open');
    setPhotoUI('loading');render();
    // 서버: 사진(사번 기준) + 부서(출결근태 직원마스터 TRESS) + 공장 공통 설정
    try{let info;
      try{info=await rpc('cert_info_a',{p_plant:PLANT,p_empno:cur.empNo});}
      catch(e0){console.warn('cert_info_a 없음 → 사진만 조회 (qualification_cert_a.sql 실행 필요)',e0);cur.noRpc=true;
        const p=await rpc('cert_photo_get',{p_plant:PLANT,p_empno:cur.empNo});info={photo:p};}
      cur.photo=(info&&typeof info.photo==='string'&&info.photo.startsWith('data:'))?info.photo:null;
      if(info&&info.cfg)applyCfg(info.cfg);
      if(info&&info.dept){$('cDept').value=info.dept;cur.deptSrc='tress';}
      else{$('cDept').value=cfg.certDept;cur.deptSrc='';}
      if(!$('cManager').value||$('cManager').value===DEF.certManager)$('cManager').value=cfg.certManager;
      $('cMonths').value=cfg.certValidMonths;$('cValid').value=addMonths($('cEval').value,cfg.certValidMonths);$('cBody').value=cfg.certBody;$('cBase').value=cfg.certBaseUrl;$('cUrl').textContent=urlOf(cur.empNo);
    }catch(e){console.warn('인증서 정보 조회 실패',e);cur.photo=null;cur.photoErr=e.message;}
    $('cDeptSrc').textContent=cur.deptSrc==='tress'?'출결근태(TRESS) 부서':(cur.noRpc?'기본값 (qualification_cert_a.sql 미실행)':'출결근태 미등록 → 기본값');
    setPhotoUI(cur.photo?'ok':(cur.photoErr?'err':'none'));render();
  }
  function close(){$('certModal').classList.remove('open');cur=null;}
  function setPhotoUI(state){
    const th=$('cPhotoThumb'),st=$('cPhotoState');
    if(state==='loading'){th.innerHTML='<span style="color:var(--text2);font-size:.72rem">조회중…</span>';st.textContent='';return;}
    if(state==='ok'){th.innerHTML=`<img src="${cur.photo}" style="width:100%;height:100%;object-fit:cover;display:block">`;st.innerHTML='<span style="color:var(--green)">✅ 사진 있음</span> <span style="color:var(--text2)">(사번 기준 자동 연결)</span>';$('cPhotoDel').style.display='inline-flex';return;}
    $('cPhotoDel').style.display='none';
    if(state==='err'){th.innerHTML='<span style="color:var(--red);font-size:.7rem;text-align:center;padding:.3rem">서버 함수 없음<br>(qualification_cert_a.sql 실행 필요)</span>';st.innerHTML='<span style="color:var(--red)">⚠️ '+(cur.photoErr||'')+'</span>';return;}
    th.innerHTML='<span style="color:var(--text2);font-size:.72rem;text-align:center">사진 없음<br>→ 인증서에 업로드 QR 표시</span>';
    st.innerHTML='<span style="color:var(--orange,#e6a23c)">📷 미등록</span> <span style="color:var(--text2)">— 인증서의 QR을 핸드폰으로 스캔해 업로드하거나 여기서 등록</span>';
  }
  function data(){
    if(!cur)return null;
    return {name:$('cName').value,empNo:cur.empNo,plant:PLANT,dept:$('cDept').value,process:cur.r.process,processEs:$('cProc').value,score:$('cScore').value,grade:$('cGrade').value,
      hireDate:$('cHire').value,validDate:$('cValid').value,issueDate:$('cIssue').value,manager:$('cManager').value,body:$('cBody').value,
      photo:cur.photo,qrSvg:qrSvg(urlOf(cur.empNo)),url:urlOf(cur.empNo)};
  }
  function onChange(src){
    if(!cur)return;
    if(src==='months'||src==='eval')$('cValid').value=addMonths($('cEval').value,$('cMonths').value);
    if(src==='base'){cfg.certBaseUrl=$('cBase').value.trim()||DEF.certBaseUrl;$('cUrl').textContent=urlOf(cur.empNo);}
    // 공장 공통 설정(Gerente·유효기간·본문·QR주소)은 변경 즉시 자동 저장 → 모든 인증서에 적용
    if(src==='manager'||src==='months'||src==='body'||src==='base'){clearTimeout(_cfgT);_cfgT=setTimeout(()=>saveCfg(true),900);}
    clearTimeout(_t);_t=setTimeout(render,250);
  }
  function render(){
    const d=data();if(!d)return;
    const fr=$('certFrame');const w=fr.clientWidth||600;const zoom=Math.min(1,(w-4)/816);   // Letter 215.9mm = 816px
    fr.style.height=Math.round(1056*zoom+8)+'px';
    fr.srcdoc=CERT_DOC.build(Object.assign({zoom},d));
  }
  // ── 인쇄 (숨은 iframe) ──
  function printDoc(html){
    const old=$('certPrintFrame');if(old)old.remove();
    const f=document.createElement('iframe');f.id='certPrintFrame';f.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(f);
    f.onload=()=>{const w=f.contentWindow;const go=()=>{try{w.focus();w.print();}catch(e){alert('인쇄 실패: '+e.message);}};
      const fs=w.document.fonts;if(fs&&fs.ready)fs.ready.then(()=>setTimeout(go,150));else setTimeout(go,400);};
    f.srcdoc=html;
  }
  function print(){const d=data();if(!d)return;printDoc(CERT_DOC.build(d));}
  function printLabel(){if(!cur)return;printDoc(CERT_DOC.labels([{name:cur.r.name,empNo:cur.empNo,process:cur.r.process,processEs:$('cProc').value,qrSvg:qrSvg(urlOf(cur.empNo))}],{date:today()}));}
  // ── 선택 인원(없으면 표시된 전체) 개인 QR 라벨 일괄 인쇄 ──
  function printLabels(){
    let chk=[...document.querySelectorAll('.row-chk:checked')];
    const all=!chk.length;
    if(all){chk=[...document.querySelectorAll('.row-chk')];if(!chk.length)return;if(!confirm(`선택된 인원이 없습니다. 현재 표시된 ${chk.length}건 전체의 QR 라벨을 인쇄할까요?\n(체크박스로 선택하면 선택 인원만 인쇄됩니다)`))return;}
    const seen=new Set(),list=[];
    chk.forEach(c=>{const r=results[parseInt(c.dataset.idx)];if(!r||!r.empId)return;const e=String(r.empId).trim();if(seen.has(e))return;seen.add(e);
      list.push({name:r.name,empNo:e,process:r.process,processEs:procEsOf(r),qrSvg:qrSvg(urlOf(e))});});
    if(!list.length){alert('사번이 있는 인원이 없습니다');return;}
    list.sort((a,b)=>a.empNo.localeCompare(b.empNo,undefined,{numeric:true}));
    printDoc(CERT_DOC.labels(list,{date:today()}));
    _showSaveToast(`🔳 QR 라벨 ${list.length}명 인쇄`);
  }
  // ── 설정 저장 (PC 공통) ──
  async function saveCfg(auto){
    if(!cur)return;
    cfg.certManager=$('cManager').value.trim()||DEF.certManager;cfg.certValidMonths=String(parseInt($('cMonths').value)||6);
    cfg.certBody=$('cBody').value||DEF.certBody;cfg.certBaseUrl=$('cBase').value.trim()||DEF.certBaseUrl;
    try{await sbSaveConfig({certManager:cfg.certManager,certValidMonths:cfg.certValidMonths,certBody:cfg.certBody,certBaseUrl:cfg.certBaseUrl});
      _showSaveToast(auto?`✓ ${PLANT}공장 공통 설정 자동 저장 — Gerente: ${cfg.certManager} · 유효 ${cfg.certValidMonths}개월`:'💾 인증서 설정 저장');}
    catch(e){console.warn('인증서 설정 저장 실패',e);_showSaveToast('⚠️ 설정 저장 실패: '+e.message);}
  }
  // ── 사진 등록/삭제 (관리 화면) ──
  function pickPhoto(){$('cPhotoFile').click();}
  async function onPhotoFile(inp){
    const f=inp.files&&inp.files[0];inp.value='';if(!f||!cur)return;
    try{const dataUrl=await shrink(f,640,0.85);
      const res=await rpc('cert_photo_set',{p_plant:PLANT,p_empno:cur.empNo,p_photo:dataUrl,p_source:'admin'});
      if(res&&res.ok===false){alert(res.msg||'등록 실패');return;}
      cur.photo=dataUrl;setPhotoUI('ok');render();_showSaveToast('📷 사진 등록 완료');
    }catch(e){alert('사진 등록 실패: '+e.message);}
  }
  async function delPhoto(){
    if(!cur||!confirm('인증서용 사진을 삭제할까요?\n(근태관리 직원 사진이 있으면 그 사진이 다시 연결됩니다)'))return;
    try{await rpc('cert_photo_del',{p_plant:PLANT,p_empno:cur.empNo});
      const p=await rpc('cert_photo_get',{p_plant:PLANT,p_empno:cur.empNo});cur.photo=(typeof p==='string'&&p.startsWith('data:'))?p:null;
      setPhotoUI(cur.photo?'ok':'none');render();}catch(e){alert('삭제 실패: '+e.message);}
  }
  function shrink(file,max,q){return new Promise((ok,no)=>{const img=new Image();const u=URL.createObjectURL(file);
    img.onload=()=>{URL.revokeObjectURL(u);let w=img.naturalWidth,h=img.naturalHeight;const s=Math.min(1,max/Math.max(w,h));w=Math.round(w*s);h=Math.round(h*s);
      const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);ok(c.toDataURL('image/jpeg',q));};
    img.onerror=()=>{URL.revokeObjectURL(u);no(new Error('이미지를 읽을 수 없습니다'));};img.src=u;});}
  return {open,close,render,onChange,print,printLabel,printLabels,saveCfg,pickPhoto,onPhotoFile,delPhoto,applyCfg,urlOf,_cur:()=>cur,_printDoc:printDoc,_cfg:cfg};
})();
function showCert(idx){CERT.open(idx);}
