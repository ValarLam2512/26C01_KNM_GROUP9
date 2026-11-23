/* TOKEN – GROUP 09 | Trình chỉnh sửa trực tiếp – bản sửa lỗi v3
   Sửa: hộp thoại không hiện (cắt ảnh, thiết kế chữ, quản lý mục, kho file, chỉnh từng ô),
   định dạng vùng chọn, tệp đính kèm không tải được, kéo thả, bản nháp, xuất website. */
(() => {
  'use strict';
  const STORE_KEY = 'token_group09_editor_v1';
  const root = document.documentElement;
  const $ = (s, r = document) => r.querySelector(s);
  const BASE_FONTS = ['Be Vietnam Pro', 'Roboto'];
  const FONT_LIST = ['Be Vietnam Pro', 'Roboto', 'Inter', 'Montserrat', 'Open Sans', 'Nunito', 'Source Sans 3', 'Lora', 'Merriweather', 'Playfair Display'];
  const TEXT_SEL = 'h1,h2,h3,h4,h5,h6,p,li,small,strong,b,em,u,span,a,button,figcaption,blockquote,td,th,label,dt,dd,i';
  const UI_SEL = '#token-editor-toolbar,.te-modal-backdrop,.te-toast';
  const DRAG_SEL = 'main section[id],.team-member-item,.directory-card';
  let editing = false, picking = false, lastRange = null, activeEditable = null, dragged = null, unsaved = false;

  const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const readJSON = k => { try { return JSON.parse(root.dataset[k] || '{}') || {}; } catch (e) { return {}; } };
  const writeJSON = (k, v) => { root.dataset[k] = JSON.stringify(v); };
  const touch = () => { unsaved = true; };
  const slug = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'te-toast'; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3600);
  }

  /* ---------- Chế độ người xem (/xem): không có thanh công cụ, không sửa được ---------- */
  const VIEW_MODE = /^\/xem\/?$/.test(location.pathname) || new URLSearchParams(location.search).has('xem');
  if (VIEW_MODE) {
    document.documentElement.classList.add('te-viewer');
    const vs = document.createElement('style');
    vs.textContent = '.te-toast{position:fixed;z-index:20010;left:20px;bottom:20px;background:#123f35;color:#fff;padding:12px 16px;border-radius:10px;font:500 13px Roboto,Arial;max-width:min(420px,calc(100vw - 40px))}';
    document.head.appendChild(vs);
    applyFonts();
    applyDesign();
    // Tệp đính kèm nhúng dạng data: được tải về bằng Blob (trình duyệt chặn điều hướng tới data:)
    document.addEventListener('click', e => {
      const dl = e.target.closest('a.file-link[href^="data:"]');
      if (!dl) return;
      e.preventDefault();
      try { saveBlob(dataURLToBlob(dl.href), dl.download || dl.dataset.filename || 'tai-lieu'); } catch (err) { toast('Không tải được tệp: ' + err.message); }
    }, true);
    return;
  }

  /* ---------- Thanh công cụ + CSS của editor ---------- */
  const toolbar = document.createElement('div');
  toolbar.id = 'token-editor-toolbar';
  toolbar.innerHTML = `
    <div class="te-brand"><span class="te-dot"></span><span><b>TOKEN EDITOR</b><small>Chỉnh sửa website trực tiếp</small></span></div>
    <div class="te-actions">
      <button type="button" id="te-toggle" class="te-btn te-primary"><i class="bi bi-pencil-square"></i> Bật chỉnh sửa</button>
      <button type="button" id="te-font" class="te-btn"><i class="bi bi-fonts"></i> Font chữ</button>
      <button type="button" id="te-design" class="te-btn"><i class="bi bi-palette"></i> Thiết kế chữ</button>
      <button type="button" id="te-element" class="te-btn"><i class="bi bi-cursor-text"></i> Chỉnh từng ô</button>
      <button type="button" id="te-structure" class="te-btn"><i class="bi bi-diagram-3"></i> Quản lý mục</button>
      <button type="button" id="te-files" class="te-btn"><i class="bi bi-folder2-open"></i> Quản lý file</button>
      <button type="button" id="te-layout" class="te-btn"><i class="bi bi-arrows-move"></i> Sắp xếp</button>
      <button type="button" id="te-save" class="te-btn"><i class="bi bi-save"></i> Lưu bản nháp</button>
      <button type="button" id="te-export" class="te-btn te-export"><i class="bi bi-download"></i> Xuất website</button>
      <button type="button" id="te-viewer" class="te-btn" title="Sao chép link dành cho người xem"><i class="bi bi-eye"></i> Link người xem</button>
      <button type="button" id="te-help" class="te-icon" aria-label="Hướng dẫn"><i class="bi bi-question-circle"></i></button>
    </div>`;
  document.body.appendChild(toolbar);

  const style = document.createElement('style');
  style.id = 'token-editor-style';
  style.textContent = `
    body{padding-bottom:70px!important}
    #token-editor-toolbar{position:fixed;z-index:20000;left:16px;right:250px;bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:10px 14px;background:rgba(8,39,36,.96);color:#fff;border:1px solid rgba(255,255,255,.16);border-radius:16px;box-shadow:0 12px 40px #001b1880;backdrop-filter:blur(14px);font-family:Roboto,Arial,sans-serif}
    .te-brand{display:flex;align-items:center;gap:10px;min-width:150px}.te-brand b{display:block;font:800 12px 'Be Vietnam Pro',sans-serif;letter-spacing:.12em}.te-brand small{display:block;color:#b6ccc5;font-size:10px;margin-top:2px}.te-dot{width:10px;height:10px;border-radius:50%;background:#b8e85b;box-shadow:0 0 0 5px #b8e85220}
    .te-actions{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.te-btn,.te-icon{border:1px solid #ffffff35;background:#ffffff10;color:white;border-radius:9px;padding:9px 12px;font:600 12px Roboto,Arial;cursor:pointer}.te-btn:hover,.te-icon:hover{background:#ffffff25}.te-btn.te-primary,.te-btn.te-active{background:#b8e85b;color:#153b2b;border-color:#b8e85b}.te-btn.te-export{background:#167d68;border-color:#167d68}.te-icon{width:36px;height:36px;padding:0;font-size:15px}
    body.te-editing [data-te-editable="1"]{outline:1px dashed #27a78a;outline-offset:3px;cursor:text;border-radius:3px}
    body.te-editing :is(h1,h2,h3,h4,h5,h6,p,li,small,span,a,button,figcaption,blockquote,label):not(#token-editor-toolbar *):not(.te-modal-backdrop *):hover{outline:1px dashed #27a78a;outline-offset:2px;cursor:text}
    body.te-editing img[data-te-image="1"]{outline:3px solid #b8e85b;outline-offset:3px;cursor:pointer}
    body.te-editing .member-photo{cursor:pointer}
    body.te-editing .file-link{outline:1px dashed #b8e85b;outline-offset:3px;cursor:pointer}
    body.te-pick-element,body.te-pick-element *{cursor:crosshair!important}
    body.te-pick-element *:hover:not(#token-editor-toolbar):not(#token-editor-toolbar *){outline:2px solid #b8e85b!important;outline-offset:2px}
    body.te-layout-mode [draggable="true"]{outline:2px dashed #b8e85b;outline-offset:-3px;cursor:grab}
    body.te-layout-mode .te-drop-before{box-shadow:0 -6px 0 #167d68}
    body.te-layout-mode .te-drop-after{box-shadow:0 6px 0 #167d68}
    .te-toast{position:fixed;z-index:20010;right:20px;bottom:88px;background:#123f35;color:#fff;padding:12px 16px;border-radius:10px;box-shadow:0 8px 25px #0003;font:500 13px Roboto,Arial;max-width:min(420px,calc(100vw - 40px))}
    .te-modal-backdrop{position:fixed;inset:0;z-index:20002;background:#061c19dd;display:flex;align-items:flex-start;justify-content:center;padding:clamp(8px,2vh,20px);overflow-y:auto;overscroll-behavior:contain}
    .te-modal{width:min(760px,100%);max-height:calc(100dvh - 2*clamp(8px,2vh,20px));overflow-y:auto;overscroll-behavior:contain;background:#fff;color:#193c35;border-radius:18px;padding:clamp(14px,2.5vw,24px);font:14px/1.6 Roboto,Arial;box-shadow:0 20px 80px #0005;box-sizing:border-box}
    .te-modal h3{font:800 21px 'Be Vietnam Pro',sans-serif;margin:0 0 10px}
    .te-modal button{margin-top:10px;background:#123f35;color:white;border:0;border-radius:9px;padding:10px 18px;cursor:pointer;max-width:100%;white-space:normal}
    .te-modal input,.te-modal select,.te-modal textarea{font:14px Roboto,Arial}
    .te-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    @media(max-width:520px){.te-form-grid{grid-template-columns:1fr}.te-modal{padding:14px}}
    .te-field{display:flex;flex-direction:column;gap:5px;margin:9px 0}.te-field label{font-weight:700;font-size:12px}
    .te-field input,.te-field select,.te-field textarea{width:100%;padding:9px;border:1px solid #ccd9d0;border-radius:8px}
    .te-field input[type=color]{padding:2px;height:40px}
    .te-list{max-height:180px;overflow:auto;border:1px solid #e1e9e3;border-radius:9px;padding:8px}
    .te-list-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px;border-bottom:1px solid #edf1ed;font-size:12px}.te-list-row:last-child{border:0}
    .te-list-row button{margin:0 0 0 4px;padding:5px 8px;background:#a93232}
    .te-modal .te-secondary{background:#e9f0eb;color:#214b3b}
    .te-element-actions{display:flex;flex-wrap:wrap;gap:6px}
    .te-crop-canvas{display:block;width:auto;height:auto;max-width:100%;max-height:44vh;margin:0 auto;border-radius:12px;background:#102a25;touch-action:none;cursor:grab}
    .te-sel-status{font-size:12px;padding:8px 10px;border-radius:8px;background:#eef4ef;margin:6px 0}
    .te-file-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px;margin:10px 0}
    .te-file-item{border:1px solid #dce7df;border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:4px;background:#f8faf6}
    .te-file-item>i{font-size:26px;color:#167d68}.te-file-item b{font-size:13px;word-break:break-word}.te-file-item small{color:#66766c}
    .te-file-actions{display:flex;gap:5px;flex-wrap:wrap}.te-file-actions button{margin-top:6px;padding:6px 9px;font-size:12px}
    @media(max-width:900px){body{padding-bottom:170px!important}#token-editor-toolbar{left:8px;right:8px;bottom:72px}.te-toast{bottom:auto;top:84px;right:12px}}
    @media(max-width:650px){#token-editor-toolbar{left:8px;right:8px;bottom:72px;padding:9px;align-items:flex-start}.te-brand{display:none}.te-actions{width:100%;justify-content:center}.te-btn{padding:8px 9px;font-size:11px}}
  `;
  document.head.appendChild(style);

  /* ---------- Hộp thoại (SỬA LỖI GỐC: trước đây hộp thoại không được gắn vào trang) ---------- */
  function modal(content) {
    const wrap = document.createElement('div');
    wrap.className = 'te-modal-backdrop';
    wrap.innerHTML = `<div class="te-modal" role="dialog" aria-modal="true">${content}</div>`;
    const panel = wrap.querySelector('.te-modal');
    if (!panel.querySelector('[data-te-close]')) {
      const f = document.createElement('div');
      f.className = 'te-modal-footer';
      f.innerHTML = '<button type="button" class="te-secondary" data-te-close>Hủy / Đóng</button>';
      panel.appendChild(f);
    }
    wrap.addEventListener('click', e => {
      if (e.target === wrap || e.target.closest('[data-te-close]')) wrap.remove();
    });
    document.body.appendChild(wrap);
    return wrap;
  }

  /* ---------- Tiện ích chung ---------- */
  function chooseFile(accept, callback) {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = accept; input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', () => { const f = input.files && input.files[0]; input.remove(); if (f) callback(f); });
    input.addEventListener('cancel', () => input.remove());
    input.click();
  }
  const fileAsDataURL = (file, cb) => { const r = new FileReader(); r.onload = () => cb(r.result); r.onerror = () => toast('Không đọc được tệp ' + file.name); r.readAsDataURL(file); };
  function dataURLToBlob(u) {
    const i = u.indexOf(','), meta = u.slice(5, i), b64 = /;base64$/.test(meta);
    const type = meta.replace(/;base64$/, '') || 'application/octet-stream';
    const bin = b64 ? atob(u.slice(i + 1)) : decodeURIComponent(u.slice(i + 1));
    const arr = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) arr[k] = bin.charCodeAt(k);
    return new Blob([arr], { type });
  }
  function saveBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.style.display = 'none'; a.dataset.teIgnore = '1';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  function rgbToHex(rgb) {
    const m = String(rgb).match(/[\d.]+/g);
    if (!m || m.length < 3) return null;
    if (m.length >= 4 && Number(m[3]) === 0) return null;
    return '#' + m.slice(0, 3).map(x => Math.round(Number(x)).toString(16).padStart(2, '0')).join('');
  }

  /* ---------- Font ---------- */
  function ensureFont(name) {
    if (BASE_FONTS.includes(name)) return;
    const id = 'token-gf-' + slug(name);
    if (document.getElementById(id)) return;
    const l = document.createElement('link');
    l.id = id; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(name).replace(/%20/g, '+') + ':wght@400;500;600;700;800&display=swap';
    document.head.appendChild(l);
  }
  function applyFonts() {
    const f = readJSON('tokenFonts');
    let st = document.getElementById('token-user-font-style');
    if (!f.h && !f.b && !f.n) { if (st) st.remove(); return; }
    const h = f.h || 'Be Vietnam Pro', b = f.b || 'Roboto';
    [h, b, f.n].filter(Boolean).forEach(ensureFont);
    if (!st) { st = document.createElement('style'); st.id = 'token-user-font-style'; document.head.appendChild(st); }
    st.textContent = `:root{--heading:'${h}',sans-serif;--body:'${b}',sans-serif}` +
      (f.n ? `.navbar,.navbar *,.token-nav{font-family:'${f.n}',sans-serif!important}` : '');
  }
  function openFontPanel() {
    const f = readJSON('tokenFonts');
    const opts = FONT_LIST.map(n => `<option>${esc(n)}</option>`).join('');
    const wrap = modal(`<h3>Thiết lập font chữ</h3><p>Chọn font riêng cho tiêu đề, nội dung và thanh điều hướng. Font được áp dụng ngay trên website.</p>
      <div class="te-field"><label>Font tiêu đề</label><select id="te-heading-font">${opts}</select></div>
      <div class="te-field"><label>Font nội dung</label><select id="te-body-font">${opts}</select></div>
      <div class="te-field"><label>Font thanh điều hướng</label><select id="te-nav-font">${opts}</select></div>
      <div class="te-element-actions"><button type="button" id="te-font-apply">Áp dụng font</button><button type="button" id="te-font-reset" class="te-secondary">Về font mặc định</button><button type="button" class="te-secondary" data-te-close>Đóng</button></div>
      <p style="font-size:12px;color:#6b7c72;margin-top:12px">Các font cần Internet để tải từ Google Fonts. Sau khi áp dụng, nhấn “Xuất website” để lưu lâu dài.</p>`);
    wrap.querySelector('#te-heading-font').value = f.h || 'Be Vietnam Pro';
    wrap.querySelector('#te-body-font').value = f.b || 'Roboto';
    wrap.querySelector('#te-nav-font').value = f.n || 'Be Vietnam Pro';
    wrap.querySelector('#te-font-apply').onclick = () => {
      const h = wrap.querySelector('#te-heading-font').value, b = wrap.querySelector('#te-body-font').value, n = wrap.querySelector('#te-nav-font').value;
      writeJSON('tokenFonts', { h, b, n }); applyFonts(); touch();
      toast(`Đã áp dụng font: tiêu đề ${h}, nội dung ${b}, điều hướng ${n}.`); wrap.remove();
    };
    wrap.querySelector('#te-font-reset').onclick = () => { delete root.dataset.tokenFonts; applyFonts(); touch(); toast('Đã trả về font mặc định.'); wrap.remove(); };
  }

  /* ---------- Thiết kế giao diện toàn site ---------- */
  function applyDesign() {
    const d = readJSON('tokenDesign');
    let st = document.getElementById('token-global-design');
    if (!Object.keys(d).length) { if (st) st.remove(); return; }
    if (!st) { st = document.createElement('style'); st.id = 'token-global-design'; document.head.appendChild(st); }
    const LIGHT = ':is(.section-light,.section-mist,.contents-section,.documents-section)';
    const DARK = '.hero-section *,.project-section *,.comm-section *,.contact-section *,.site-footer *,.token-nav *';
    let css = '', vars = [], body = [];
    if (d.text) vars.push('--ink:' + d.text);
    if (d.accent) vars.push('--green:' + d.accent);
    if (d.bg) vars.push('--paper:' + d.bg, '--mist:' + d.bg);
    if (vars.length) css += `:root{${vars.join(';')}}`;
    if (d.size) body.push(`font-size:${d.size}px`);
    if (d.text) body.push(`color:${d.text}`);
    if (d.bg) body.push(`background-color:${d.bg}`);
    if (body.length) css += `body{${body.join(';')}}`;
    if (d.text) css += `${LIGHT} :is(p,li,small,.lead-copy){color:${d.text}!important}`;
    if (d.heading) css += `:is(h1,h2,h3,h4,h5,h6,.section-title):not(${DARK}){color:${d.heading}!important}`;
    st.textContent = css;
  }

  /* ---------- Vùng chọn & định dạng văn bản ---------- */
  document.addEventListener('selectionchange', () => {
    const s = getSelection();
    if (!s || !s.rangeCount || s.isCollapsed) return;
    const r = s.getRangeAt(0), n = r.commonAncestorContainer, el = n.nodeType === 1 ? n : n.parentElement;
    if (!el || el.closest(UI_SEL)) return;
    lastRange = r.cloneRange();
  });
  function getTargetRange() {
    const s = getSelection();
    if (s && s.rangeCount && !s.isCollapsed) {
      const r = s.getRangeAt(0), n = r.commonAncestorContainer, el = n.nodeType === 1 ? n : n.parentElement;
      if (el && !el.closest(UI_SEL)) return r;
    }
    if (lastRange && !lastRange.collapsed && lastRange.commonAncestorContainer.isConnected) return lastRange;
    return null;
  }
  function textPieces(range) {
    const out = [], c = range.commonAncestorContainer;
    const consider = n => {
      if (!/\S/.test(n.nodeValue) || !range.intersectsNode(n)) return;
      const p = n.parentElement;
      if (!p || p.closest('script,style,#token-editor-toolbar,.te-modal-backdrop')) return;
      const start = n === range.startContainer ? range.startOffset : 0;
      const end = n === range.endContainer ? range.endOffset : n.nodeValue.length;
      if (start < end) out.push({ node: n, start, end });
    };
    if (c.nodeType === 3) consider(c);
    else { const w = document.createTreeWalker(c, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) consider(n); }
    return out;
  }
  function formatRange(range, styler) {
    const pieces = textPieces(range), spans = [];
    pieces.forEach(({ node, start, end }) => {
      if (end < node.nodeValue.length) node.splitText(end);
      const mid = start > 0 ? node.splitText(start) : node;
      let span;
      if (mid.parentNode.matches && mid.parentNode.matches('span[data-te-fmt]') && mid.parentNode.childNodes.length === 1) span = mid.parentNode; // dùng lại, không lồng span
      else {
        span = document.createElement('span');
        span.dataset.teFmt = '1';
        mid.parentNode.insertBefore(span, mid); span.appendChild(mid);
      }
      styler(span, mid); spans.push(span);
    });
    if (spans.length) {
      const r = document.createRange(); r.setStartBefore(spans[0]); r.setEndAfter(spans[spans.length - 1]);
      lastRange = r; touch();
    }
    return spans.length;
  }
  function toggleStyle(kind) {
    const r = getTargetRange();
    if (!r) { toast('Hãy bôi đen một đoạn chữ trên trang trước, rồi mở lại “Thiết kế chữ”.'); return; }
    const first = textPieces(r)[0];
    if (!first) { toast('Vùng chọn không có chữ để định dạng.'); return; }
    const cs = getComputedStyle(first.node.parentElement);
    const on = kind === 'bold' ? Number(cs.fontWeight) < 600 : kind === 'italic' ? cs.fontStyle !== 'italic' : !cs.textDecorationLine.includes('underline');
    const n = formatRange(r, sp => {
      if (kind === 'bold') sp.style.fontWeight = on ? '700' : '400';
      if (kind === 'italic') sp.style.fontStyle = on ? 'italic' : 'normal';
      if (kind === 'underline') sp.style.textDecoration = on ? 'underline' : 'none';
    });
    toast(n ? 'Đã định dạng vùng chọn.' : 'Không áp dụng được cho vùng chọn này.');
  }
  function alignRange(dir) {
    const r = getTargetRange();
    if (!r) { toast('Hãy bôi đen hoặc đặt con trỏ vào đoạn cần căn lề trước, rồi mở lại “Thiết kế chữ”.'); return; }
    const blocks = new Set();
    const pieces = textPieces(r);
    pieces.forEach(p => { const b = p.node.parentElement.closest('p,h1,h2,h3,h4,h5,h6,li,blockquote,div,td,th,figcaption'); if (b) blocks.add(b); });
    blocks.forEach(b => { b.style.textAlign = dir; });
    if (blocks.size) { touch(); toast('Đã căn lề ' + ({ left: 'trái', center: 'giữa', right: 'phải' }[dir]) + '.'); } else toast('Không tìm thấy đoạn để căn lề.');
  }
  function clearFormat() {
    const r = getTargetRange();
    if (!r) { toast('Hãy bôi đen đoạn chữ cần xóa định dạng.'); return; }
    let n = 0;
    document.querySelectorAll('span[data-te-fmt]').forEach(sp => {
      if (!r.intersectsNode(sp)) return;
      const p = sp.parentNode; while (sp.firstChild) p.insertBefore(sp.firstChild, sp); sp.remove(); p.normalize(); n++;
    });
    lastRange = null; if (n) touch();
    toast(n ? 'Đã xóa định dạng riêng của vùng chọn.' : 'Vùng chọn không có định dạng riêng để xóa.');
  }
  function openDesignPanel() {
    const d = readJSON('tokenDesign'), fonts = readJSON('tokenFonts');
    const cs = getComputedStyle(document.body);
    const init = {
      font: fonts.b || 'Roboto',
      size: d.size || Math.round(parseFloat(cs.fontSize)) || 16,
      text: d.text || rgbToHex(cs.color) || '#142a28',
      bg: d.bg || '#f8faf6', heading: d.heading || '#123f35', accent: d.accent || '#b9ed65'
    };
    const sel = getTargetRange();
    const status = sel ? `Đang có vùng chọn: “${esc(sel.toString().trim().slice(0, 50))}${sel.toString().trim().length > 50 ? '…' : ''}”` : 'Chưa có vùng chọn. Muốn định dạng một đoạn: đóng bảng này, bôi đen chữ trên trang rồi mở lại.';
    const wrap = modal(`<h3>Thiết kế văn bản & giao diện</h3><p>Thiết lập chung cho toàn website, hoặc định dạng phần văn bản đang bôi đen.</p>
      <div class="te-form-grid">
        <div class="te-field"><label>Font nội dung</label><select id="td-font">${FONT_LIST.map(n => `<option>${esc(n)}</option>`).join('')}</select></div>
        <div class="te-field"><label>Cỡ chữ cơ bản (px)</label><input id="td-size" type="number" min="12" max="24"></div>
        <div class="te-field"><label>Màu chữ nội dung</label><input id="td-text" type="color"></div>
        <div class="te-field"><label>Màu nền trang</label><input id="td-bg" type="color"></div>
        <div class="te-field"><label>Màu tiêu đề</label><input id="td-heading" type="color"></div>
        <div class="te-field"><label>Màu nhấn (nút, điểm nhấn)</label><input id="td-accent" type="color"></div>
      </div>
      <div class="te-element-actions"><button id="td-apply" type="button">Áp dụng toàn website</button><button id="td-reset" type="button" class="te-secondary">Đặt lại mặc định</button></div>
      <hr><b>Định dạng văn bản đang chọn</b><div class="te-sel-status">${status}</div>
      <div class="te-form-grid">
        <div class="te-field"><label>Màu chữ vùng chọn</label><input id="td-selected-color" type="color" value="#123f35"></div>
        <div class="te-field"><label>Cỡ chữ vùng chọn</label><select id="td-selected-size"><option value="">Giữ nguyên</option><option>12px</option><option>14px</option><option>16px</option><option>18px</option><option>20px</option><option>24px</option><option>30px</option><option>36px</option><option>48px</option></select></div>
      </div>
      <div class="te-element-actions"><button id="td-bold" type="button"><b>B</b> Đậm</button><button id="td-italic" type="button"><i>I</i> Nghiêng</button><button id="td-underline" type="button"><u>U</u> Gạch chân</button><button id="td-left" type="button">Trái</button><button id="td-center" type="button">Giữa</button><button id="td-right" type="button">Phải</button></div>
      <div class="te-element-actions"><button id="td-selection" type="button">Áp dụng màu / cỡ chữ cho vùng chọn</button><button id="td-clear" type="button" class="te-secondary">Xóa định dạng vùng chọn</button><button type="button" class="te-secondary" data-te-close>Đóng</button></div>
      <p style="font-size:12px;color:#6b7c72">Sau khi chỉnh, chọn “Xuất website” để lưu thành file.</p>`);
    const g = id => wrap.querySelector('#' + id);
    g('td-font').value = init.font; g('td-size').value = init.size; g('td-text').value = init.text;
    g('td-bg').value = init.bg; g('td-heading').value = init.heading; g('td-accent').value = init.accent;
    const dirty = new Set();
    ['td-font', 'td-size', 'td-text', 'td-bg', 'td-heading', 'td-accent'].forEach(id => ['input', 'change'].forEach(ev => g(id).addEventListener(ev, () => dirty.add(id))));
    const selDirty = new Set();
    ['td-selected-color', 'td-selected-size'].forEach(id => ['input', 'change'].forEach(ev => g(id).addEventListener(ev, () => selDirty.add(id))));
    g('td-apply').onclick = () => {
      if (!dirty.size) { toast('Bạn chưa thay đổi giá trị nào.'); return; }
      const next = { ...readJSON('tokenDesign') };
      if (dirty.has('td-size')) next.size = g('td-size').value;
      if (dirty.has('td-text')) next.text = g('td-text').value;
      if (dirty.has('td-bg')) next.bg = g('td-bg').value;
      if (dirty.has('td-heading')) next.heading = g('td-heading').value;
      if (dirty.has('td-accent')) next.accent = g('td-accent').value;
      writeJSON('tokenDesign', next); applyDesign();
      if (dirty.has('td-font')) { writeJSON('tokenFonts', { ...readJSON('tokenFonts'), b: g('td-font').value }); applyFonts(); }
      touch(); toast('Đã áp dụng thiết kế cho toàn website. Hãy xuất website để lưu.'); wrap.remove();
    };
    g('td-reset').onclick = () => {
      if (!confirm('Đặt lại màu, cỡ chữ và font về mặc định của website?')) return;
      delete root.dataset.tokenDesign; delete root.dataset.tokenFonts; applyDesign(); applyFonts(); touch(); toast('Đã đặt lại giao diện mặc định.'); wrap.remove();
    };
    g('td-bold').onclick = () => toggleStyle('bold');
    g('td-italic').onclick = () => toggleStyle('italic');
    g('td-underline').onclick = () => toggleStyle('underline');
    g('td-left').onclick = () => alignRange('left');
    g('td-center').onclick = () => alignRange('center');
    g('td-right').onclick = () => alignRange('right');
    g('td-clear').onclick = clearFormat;
    g('td-selection').onclick = () => {
      const r = getTargetRange();
      if (!r) { toast('Hãy bôi đen một đoạn văn bản trước khi áp dụng.'); return; }
      if (!selDirty.size) { toast('Hãy chọn màu chữ hoặc cỡ chữ mới trước.'); return; }
      const color = selDirty.has('td-selected-color') ? g('td-selected-color').value : '', size = g('td-selected-size').value;
      const n = formatRange(r, sp => { if (color) sp.style.color = color; if (size) sp.style.fontSize = size; });
      toast(n ? 'Đã định dạng vùng văn bản được chọn.' : 'Không áp dụng được cho vùng chọn này.');
    };
  }

  /* ---------- Chỉnh từng ô ---------- */
  function getOwnText(el) {
    let s = '';
    el.childNodes.forEach(n => { if (n.nodeType === 3) s += n.nodeValue; else if (n.nodeName === 'BR') s += '\n'; });
    return s.replace(/\u00a0/g, ' ');
  }
  function openElementPanel(el) {
    if (!el || !el.isConnected || el.closest(UI_SEL)) return;
    const tag = el.tagName.toLowerCase();
    const tags = ['h1', 'h2', 'h3', 'h4', 'h5', 'p', 'span', 'div', 'li', 'blockquote', 'small', 'strong', 'em', 'a', 'button', 'label'];
    if (!tags.includes(tag)) tags.push(tag);
    const cs = getComputedStyle(el);
    const hasRich = [...el.children].some(c => c.tagName !== 'BR');
    const wrap = modal(`<h3>Chỉnh sửa ô nội dung <small style="font-weight:500;color:#738078">&lt;${tag}&gt;</small></h3><p>Chỉ những mục bạn thay đổi mới được áp dụng; các thuộc tính còn lại giữ nguyên.</p>
      <div class="te-field"><label>Nội dung ô ${hasRich ? '(ô này chứa nhiều ô con — hãy chọn từng ô con để sửa chữ)' : ''}</label><textarea id="te-box-text" rows="4" ${hasRich ? 'disabled' : ''}></textarea></div>
      <div class="te-form-grid">
        <div class="te-field"><label>Kiểu ô</label><select id="te-box-tag">${tags.map(t => `<option value="${t}">${t.toUpperCase()}</option>`).join('')}</select></div>
        <div class="te-field"><label>Cỡ chữ</label><select id="te-box-size"><option value="">Giữ nguyên</option><option>12px</option><option>14px</option><option>16px</option><option>18px</option><option>20px</option><option>24px</option><option>30px</option><option>36px</option></select></div>
        <div class="te-field"><label>Màu chữ</label><input id="te-box-color" type="color"></div>
        <div class="te-field"><label>Màu nền ô</label><input id="te-box-bg" type="color"></div>
        <div class="te-field"><label>Căn chữ</label><select id="te-box-align"><option value="">Giữ nguyên</option><option value="left">Trái</option><option value="center">Giữa</option><option value="right">Phải</option><option value="justify">Đều</option></select></div>
        <div class="te-field"><label>Bo góc</label><select id="te-box-radius"><option value="">Giữ nguyên</option><option value="0">Vuông</option><option value="8px">8px</option><option value="16px">16px</option><option value="24px">24px</option><option value="50%">Tròn</option></select></div>
        <div class="te-field"><label>Khoảng đệm</label><select id="te-box-padding"><option value="">Giữ nguyên</option><option value="0">0</option><option value="8px">8px</option><option value="12px">12px</option><option value="16px">16px</option><option value="24px">24px</option></select></div>
        <div class="te-field"><label>Liên kết (nếu là nút/link)</label><input id="te-box-link" placeholder="https://... hoặc #section"></div>
        <div class="te-field"><label>Icon Bootstrap (nếu là biểu tượng)</label><input id="te-box-icon" placeholder="Ví dụ: bi bi-leaf"></div>
      </div>
      <div class="te-element-actions"><button id="te-box-apply" type="button">Áp dụng</button><button id="te-box-before" class="te-secondary" type="button">+ Thêm ô phía trên</button><button id="te-box-after" class="te-secondary" type="button">+ Thêm ô phía dưới</button><button id="te-box-duplicate" class="te-secondary" type="button">Nhân đôi</button></div>
      <div class="te-element-actions"><button id="te-box-up" class="te-secondary" type="button">Di chuyển lên</button><button id="te-box-down" class="te-secondary" type="button">Di chuyển xuống</button><button id="te-box-resetstyle" class="te-secondary" type="button">Xóa định dạng riêng</button><button id="te-box-delete" class="te-danger" type="button">Xóa ô</button><button type="button" class="te-secondary" data-te-close>Hủy / Đóng</button></div>`);
    const g = id => wrap.querySelector('#' + id);
    g('te-box-text').value = hasRich ? '' : getOwnText(el);
    g('te-box-tag').value = tag;
    g('te-box-color').value = rgbToHex(cs.color) || '#24443b';
    g('te-box-bg').value = rgbToHex(cs.backgroundColor) || '#ffffff';
    g('te-box-link').value = el.matches('a') ? (el.getAttribute('href') || '') : '';
    g('te-box-link').disabled = !el.matches('a');
    g('te-box-icon').value = el.matches('i') ? el.className : '';
    g('te-box-icon').disabled = !el.matches('i');
    const dirty = new Set();
    wrap.querySelectorAll('input,select,textarea').forEach(i => ['input', 'change'].forEach(ev => i.addEventListener(ev, () => dirty.add(i.id))));
    const closeWith = msg => { wrap.remove(); touch(); toast(msg); };
    g('te-box-apply').onclick = () => {
      let t = el;
      const newTag = g('te-box-tag').value;
      if (dirty.has('te-box-tag') && newTag !== tag) {
        const r = document.createElement(newTag);
        [...t.attributes].forEach(a => { try { r.setAttribute(a.name, a.value); } catch (e) { } });
        while (t.firstChild) r.appendChild(t.firstChild);
        t.replaceWith(r); t = r;
      }
      if (dirty.has('te-box-text') && !hasRich) t.innerHTML = esc(g('te-box-text').value).replace(/\n/g, '<br>');
      if (g('te-box-size').value) t.style.fontSize = g('te-box-size').value;
      if (dirty.has('te-box-color')) t.style.color = g('te-box-color').value;
      if (dirty.has('te-box-bg')) t.style.backgroundColor = g('te-box-bg').value;
      if (g('te-box-align').value) t.style.textAlign = g('te-box-align').value;
      if (g('te-box-radius').value) t.style.borderRadius = g('te-box-radius').value;
      if (g('te-box-padding').value) t.style.padding = g('te-box-padding').value;
      if (t.matches('a') && dirty.has('te-box-link')) t.setAttribute('href', g('te-box-link').value || '#');
      if (t.matches('i') && dirty.has('te-box-icon')) t.className = g('te-box-icon').value.trim() || 'bi';
      closeWith(dirty.size ? 'Đã cập nhật ô nội dung.' : 'Không có thay đổi nào để áp dụng.');
    };
    const insert = where => {
      const n = document.createElement(tag === 'li' ? 'li' : 'p');
      n.className = 'te-user-content'; n.textContent = 'Nhập nội dung mới tại đây';
      el.parentNode.insertBefore(n, where === 'before' ? el : el.nextSibling);
      closeWith('Đã thêm ô nội dung mới. Bật chỉnh sửa và nhấn vào ô để nhập chữ.');
    };
    g('te-box-before').onclick = () => insert('before');
    g('te-box-after').onclick = () => insert('after');
    g('te-box-duplicate').onclick = () => {
      const c = el.cloneNode(true);
      c.removeAttribute('id'); c.querySelectorAll('[id]').forEach(x => x.removeAttribute('id'));
      el.after(c); closeWith('Đã nhân đôi ô nội dung.');
    };
    g('te-box-up').onclick = () => { if (el.previousElementSibling) el.parentNode.insertBefore(el, el.previousElementSibling); closeWith('Đã di chuyển ô lên trên.'); };
    g('te-box-down').onclick = () => { if (el.nextElementSibling) el.parentNode.insertBefore(el.nextElementSibling, el); closeWith('Đã di chuyển ô xuống dưới.'); };
    g('te-box-resetstyle').onclick = () => { el.removeAttribute('style'); closeWith('Đã xóa định dạng riêng của ô.'); };
    g('te-box-delete').onclick = () => { if (confirm('Xóa ô nội dung này?')) { el.remove(); closeWith('Đã xóa ô nội dung.'); } };
  }
  function setPicking(on) {
    picking = on;
    document.body.classList.toggle('te-pick-element', on);
    $('#te-element').classList.toggle('te-active', on);
    toast(on ? 'Hãy nhấn vào một ô trên website để mở bảng chỉnh sửa (Esc để hủy).' : 'Đã tắt chọn ô nội dung.');
  }

  /* ---------- Cắt & thay ảnh (xem trước = kết quả cuối, vì dùng cùng một hàm vẽ) ---------- */
  function openCropper(img, file) {
    const reader = new FileReader();
    reader.onerror = () => toast('Không đọc được tệp ảnh.');
    reader.onload = () => {
      const src = new Image();
      src.onerror = () => toast('Tệp này không phải ảnh hợp lệ (nên dùng JPG, PNG hoặc WEBP).');
      src.onload = () => {
        const rect = img.getBoundingClientRect();
        const aspect = rect.width > 20 && rect.height > 20 ? rect.width / rect.height : 1.5;
        const wrap = modal(`<h3>Thay ảnh & cắt theo khung</h3><p>Kéo trực tiếp trên ảnh hoặc dùng thanh trượt để căn vị trí. Khung xem trước đúng bằng kết quả sẽ áp dụng.</p>
          <canvas id="crop-canvas" class="te-crop-canvas"></canvas>
          <div class="te-field"><label>Phóng to</label><input id="crop-zoom" type="range" min="1" max="3" step="0.05" value="1"></div>
          <div class="te-form-grid"><div class="te-field"><label>Vị trí ngang</label><input id="crop-x" type="range" min="0" max="100" value="50"></div><div class="te-field"><label>Vị trí dọc</label><input id="crop-y" type="range" min="0" max="100" value="50"></div></div>
          <div class="te-element-actions"><button id="crop-apply" type="button">Áp dụng ảnh</button><button type="button" class="te-secondary" data-te-close>Hủy</button></div>`);
        const cv = wrap.querySelector('#crop-canvas'), zoom = wrap.querySelector('#crop-zoom'), xs = wrap.querySelector('#crop-x'), ys = wrap.querySelector('#crop-y');
        const geom = () => {
          const z = Number(zoom.value);
          let cw, ch;
          if (src.width / src.height > aspect) { ch = src.height; cw = ch * aspect; } else { cw = src.width; ch = cw / aspect; }
          cw /= z; ch /= z;
          return { cw, ch, sx: (src.width - cw) * Number(xs.value) / 100, sy: (src.height - ch) * Number(ys.value) / 100 };
        };
        const draw = (c, w) => {
          c.width = w; c.height = Math.max(1, Math.round(w / aspect));
          const ctx = c.getContext('2d'), k = geom();
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(src, k.sx, k.sy, k.cw, k.ch, 0, 0, c.width, c.height);
        };
        const redraw = () => draw(cv, 640);
        [zoom, xs, ys].forEach(el => el.addEventListener('input', redraw));
        redraw();
        let drag = null;
        cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; });
        cv.addEventListener('pointerup', () => { drag = null; cv.style.cursor = 'grab'; });
        cv.addEventListener('pointermove', e => {
          if (!drag) return;
          const k = geom(), dx = (e.clientX - drag.x) / cv.clientWidth, dy = (e.clientY - drag.y) / cv.clientHeight;
          drag = { x: e.clientX, y: e.clientY };
          const rx = src.width - k.cw, ry = src.height - k.ch;
          if (rx > 1) xs.value = Math.min(100, Math.max(0, Number(xs.value) - (dx * k.cw / rx) * 100));
          if (ry > 1) ys.value = Math.min(100, Math.max(0, Number(ys.value) - (dy * k.ch / ry) * 100));
          redraw();
        });
        wrap.querySelector('#crop-apply').onclick = () => {
          try {
            const out = document.createElement('canvas'); draw(out, 1200);
            img.removeAttribute('srcset'); img.removeAttribute('data-src');
            img.src = out.toDataURL('image/jpeg', 0.9);
            touch(); wrap.remove(); toast('Đã thay ảnh và cắt theo đúng khung hiển thị. Hãy xuất website để lưu.');
          } catch (err) { toast('Không áp dụng được ảnh: ' + err.message); }
        };
      };
      src.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  /* ---------- Tệp đính kèm vào thẻ tài liệu ---------- */
  function attachToLink(link, f) {
    fileAsDataURL(f, data => {
      link.href = data; link.download = f.name; link.title = f.name; link.dataset.filename = f.name;
      link.classList.remove('pending');
      link.innerHTML = 'Tải tài liệu <i class="bi bi-download"></i>';
      touch(); toast('Đã gắn “' + f.name + '”. Tệp sẽ được đóng gói vào HTML khi xuất.');
    });
  }
  const FILE_ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.rar,.7z,.png,.jpg,.jpeg,.svg,.txt';
  function openFileLinkPanel(link) {
    if (link.classList.contains('pending') || !link.href.startsWith('data:')) { chooseFile(FILE_ACCEPT, f => attachToLink(link, f)); return; }
    const wrap = modal(`<h3>Tài liệu đã đính kèm</h3><p><b>${esc(link.dataset.filename || 'Tệp')}</b></p>
      <div class="te-element-actions"><button id="fl-replace" type="button">Thay bằng tệp khác</button><button id="fl-remove" type="button" class="te-danger">Gỡ tệp</button><button type="button" class="te-secondary" data-te-close>Đóng</button></div>`);
    wrap.querySelector('#fl-replace').onclick = () => { wrap.remove(); chooseFile(FILE_ACCEPT, f => attachToLink(link, f)); };
    wrap.querySelector('#fl-remove').onclick = () => {
      link.href = '#docs-upload'; link.removeAttribute('download'); link.removeAttribute('title'); delete link.dataset.filename;
      link.classList.add('pending'); link.innerHTML = 'Chưa đính kèm <i class="bi bi-paperclip"></i>';
      wrap.remove(); touch(); toast('Đã gỡ tệp khỏi thẻ tài liệu.');
    };
  }

  /* ---------- Quản lý mục & điều hướng ---------- */
  function cleanupEmptyMenus() {
    document.querySelectorAll('.token-nav .dropdown-menu').forEach(menu => {
      if (menu.querySelector('li')) return;
      const li = menu.closest('li'); menu.remove();
      if (li) { li.classList.remove('dropdown'); const a = li.querySelector(':scope > a'); if (a) { a.classList.remove('dropdown-toggle'); a.removeAttribute('data-bs-toggle'); a.removeAttribute('role'); } }
    });
  }
  function openStructurePanel() {
    const topLinks = () => [...document.querySelectorAll('.token-nav .navbar-nav > li > a')];
    const wrap = modal(`<h3>Quản lý mục & thanh điều hướng</h3><p>Thêm section mới, tạo mục điều hướng đến section, sắp xếp hoặc xóa mục không còn dùng.</p>
      <h4 style="font-size:15px;margin-top:15px">Tạo section mới</h4>
      <div class="te-field"><label>Tên mục / tiêu đề</label><input id="ts-title" placeholder="Ví dụ: Tài nguyên học tập"></div>
      <div class="te-form-grid"><div class="te-field"><label>Tên trên thanh điều hướng</label><input id="ts-nav" placeholder="Tài nguyên"></div>
      <div class="te-field"><label>Nhóm menu</label><select id="ts-nav-parent"><option value="top">Mục cấp chính</option>${topLinks().map(a => `<option value="${esc(a.textContent.trim())}">${esc(a.textContent.trim())}</option>`).join('')}</select></div>
      <div class="te-field"><label>Vị trí</label><select id="ts-position"><option value="before-contact">Trước Liên hệ</option><option value="end">Cuối nội dung</option></select></div></div>
      <div class="te-field"><label>Nội dung mở đầu</label><textarea id="ts-content" rows="3" placeholder="Nhập nội dung cho section mới..."></textarea></div>
      <button id="ts-create" type="button">+ Tạo section và mục điều hướng</button>
      <hr><h4 style="font-size:15px">Các section hiện có</h4><div class="te-list" id="ts-sections"></div>
      <hr><h4 style="font-size:15px">Các mục trên thanh điều hướng</h4><div class="te-list" id="ts-links"></div>
      <button id="ts-close" class="te-secondary" type="button" data-te-close>Đóng</button>`);
    const secBox = wrap.querySelector('#ts-sections'), linkBox = wrap.querySelector('#ts-links');
    let navItems = [];
    const refresh = () => {
      const secs = [...document.querySelectorAll('main section[id]')];
      secBox.innerHTML = secs.map((sec, i) => `<div class="te-list-row"><span>${esc((sec.querySelector('h1,h2,h3')?.textContent || sec.id).trim().slice(0, 60))} <small style="color:#738078">#${esc(sec.id)}</small></span><span><button data-sec-up="${i}" type="button" class="te-secondary">↑</button><button data-sec-down="${i}" type="button" class="te-secondary">↓</button><button data-remove-section="${i}" type="button">Xóa</button></span></div>`).join('') || 'Chưa có section';
      secBox._secs = secs;
      navItems = [...document.querySelectorAll('.token-nav .navbar-nav a[href^="#"]')].filter(a => a.closest('li') && a.textContent.trim());
      linkBox.innerHTML = navItems.map((a, i) => `<div class="te-list-row"><span>${a.classList.contains('dropdown-item') ? '&nbsp;&nbsp;↳ ' : ''}${esc(a.textContent.trim().slice(0, 50))} <small style="color:#738078">${esc(a.getAttribute('href'))}</small></span><span><button data-nav-up="${i}" type="button" class="te-secondary">↑</button><button data-nav-down="${i}" type="button" class="te-secondary">↓</button><button data-remove-link="${i}" type="button">Bỏ</button></span></div>`).join('') || 'Chưa có mục điều hướng';
    };
    refresh();
    wrap.querySelector('#ts-create').onclick = () => {
      const g = id => wrap.querySelector('#' + id);
      const title = g('ts-title').value.trim(), nav = g('ts-nav').value.trim() || title, content = g('ts-content').value.trim();
      if (!title) { toast('Hãy nhập tên section.'); return; }
      let id = 'section-' + (slug(title) || 'moi'), base = id, n = 2;
      while (document.getElementById(id)) id = base + '-' + n++;
      const section = document.createElement('section');
      section.id = id; section.className = 'section-pad section-light';
      section.innerHTML = '<div class="container"><div class="eyebrow"><span></span> TOKEN · NỘI DUNG BỔ SUNG</div><h2 class="section-title"></h2><div class="row"><div class="col-lg-9"><p class="lead-copy"></p></div></div></div>';
      section.querySelector('h2').textContent = title;
      section.querySelector('p').textContent = content || 'Bật chỉnh sửa, sau đó nhấn vào đoạn văn bản này để bổ sung nội dung.';
      const main = document.querySelector('main'), contact = document.querySelector('#contact');
      if (g('ts-position').value === 'before-contact' && contact && contact.parentElement === main) main.insertBefore(section, contact); else main.appendChild(section);
      const ul = document.querySelector('.token-nav .navbar-nav');
      if (ul) {
        const parent = g('ts-nav-parent').value;
        if (parent === 'top') {
          const li = document.createElement('li'); li.className = 'nav-item';
          const a = document.createElement('a'); a.className = 'nav-link'; a.href = '#' + id; a.textContent = nav;
          li.appendChild(a); ul.appendChild(li);
        } else {
          const top = [...ul.querySelectorAll(':scope > li')].find(li => li.querySelector(':scope > a')?.textContent.trim() === parent);
          if (top) {
            let menu = top.querySelector('.dropdown-menu');
            if (!menu) {
              menu = document.createElement('ul'); menu.className = 'dropdown-menu'; top.appendChild(menu); top.classList.add('dropdown');
              const t = top.querySelector(':scope > a'); t.classList.add('dropdown-toggle'); t.setAttribute('role', 'button'); t.setAttribute('data-bs-toggle', 'dropdown');
            }
            const li = document.createElement('li'); const a = document.createElement('a'); a.className = 'dropdown-item'; a.href = '#' + id; a.textContent = nav;
            li.appendChild(a); menu.appendChild(li);
          } else toast('Không tìm thấy nhóm menu đã chọn; section vẫn được tạo.');
        }
      }
      touch(); refresh(); toast('Đã tạo section “' + title + '” và liên kết trên thanh điều hướng.');
    };
    secBox.addEventListener('click', e => {
      const up = e.target.closest('[data-sec-up]'), down = e.target.closest('[data-sec-down]'), del = e.target.closest('[data-remove-section]');
      const idx = Number((up || down || del)?.dataset.secUp ?? (up || down || del)?.dataset.secDown ?? (up || down || del)?.dataset.removeSection);
      const sec = secBox._secs?.[idx]; if (!sec) return;
      if (up && sec.previousElementSibling?.tagName === 'SECTION') sec.parentNode.insertBefore(sec, sec.previousElementSibling);
      else if (down && sec.nextElementSibling?.tagName === 'SECTION') sec.parentNode.insertBefore(sec.nextElementSibling, sec);
      else if (del) {
        if (!confirm('Xóa section #' + sec.id + '? Nội dung section sẽ bị xóa khỏi website.')) return;
        const id = sec.id; sec.remove();
        document.querySelectorAll(`.token-nav a[href="#${CSS.escape(id)}"]`).forEach(a => a.closest('li')?.remove());
        document.querySelectorAll(`.directory-card a[href="#${CSS.escape(id)}"]`).forEach(a => a.remove());
        cleanupEmptyMenus(); toast('Đã xóa section và các liên kết tương ứng.');
      }
      touch(); refresh();
    });
    linkBox.addEventListener('click', e => {
      const up = e.target.closest('[data-nav-up]'), down = e.target.closest('[data-nav-down]'), del = e.target.closest('[data-remove-link]');
      const idx = Number((up || down || del)?.dataset.navUp ?? (up || down || del)?.dataset.navDown ?? (up || down || del)?.dataset.removeLink);
      const a = navItems[idx]; if (!a) return;
      const li = a.closest('li');
      if (up && li.previousElementSibling) li.parentNode.insertBefore(li, li.previousElementSibling);
      else if (down && li.nextElementSibling) li.parentNode.insertBefore(li.nextElementSibling, li);
      else if (del) {
        const hasKids = li.querySelector('.dropdown-menu li');
        if (!confirm('Bỏ mục “' + a.textContent.trim() + '” khỏi thanh điều hướng?' + (hasKids ? ' Các mục con của nó cũng bị bỏ.' : '') + ' Nội dung section vẫn được giữ.')) return;
        li.remove(); cleanupEmptyMenus(); toast('Đã bỏ mục khỏi thanh điều hướng. Nội dung vẫn còn trên trang.');
      }
      touch(); refresh();
    });
  }

  /* ---------- Kho tệp ---------- */
  function openFileManager() {
    const wrap = modal(`<h3>Kho tệp TOKEN · dạng thư mục</h3><p>Thêm tệp vào thư viện của website. Preview để xem nhanh (PDF, ảnh, văn bản) hoặc Tải xuống để lưu về máy.</p>
      <div class="te-form-grid"><div class="te-field"><label>Thư mục</label><select id="fm-folder"><option>Hồ sơ nhóm</option><option>Biên bản họp</option><option>Hồ sơ thành viên</option><option>Hồ sơ dự án</option><option>Báo cáo & bài nộp</option><option>Tệp nén & bổ sung</option></select></div><div class="te-field"><label>Thêm file</label><input id="fm-upload" type="file" multiple></div></div>
      <div class="te-field"><label>Tìm file</label><input id="fm-search" placeholder="Nhập tên tài liệu..."></div><div class="te-file-grid" id="fm-grid"></div>
      <button type="button" class="te-secondary" data-te-close>Đóng</button>
      <p style="font-size:12px;color:#66766c">Các file được nhúng trong HTML khi xuất website. File lớn làm HTML rất nặng; mỗi file tối đa 18 MB.</p>`);
    const store = window.__tokenFiles || (window.__tokenFiles = []), grid = wrap.querySelector('#fm-grid');
    const fileIcon = t => t.includes('pdf') ? 'bi-file-earmark-pdf' : t.startsWith('image/') ? 'bi-file-earmark-image' : t.includes('zip') ? 'bi-file-earmark-zip' : t.includes('word') ? 'bi-file-earmark-word' : t.includes('presentation') ? 'bi-file-earmark-ppt' : t.includes('sheet') || t.includes('excel') ? 'bi-file-earmark-excel' : 'bi-file-earmark';
    const render = () => {
      const q = wrap.querySelector('#fm-search').value.toLowerCase(), folder = wrap.querySelector('#fm-folder').value;
      const arr = store.filter(x => x.folder === folder && x.name.toLowerCase().includes(q));
      grid.innerHTML = arr.map(f => { const i = store.indexOf(f); return `<article class="te-file-item"><i class="bi ${fileIcon(f.type)}"></i><b>${esc(f.name)}</b><small>${esc(f.folder)} · ${Math.max(1, Math.round(f.size / 1024))} KB</small><div class="te-file-actions"><button type="button" data-preview="${i}">Preview</button><button type="button" data-download="${i}">Tải xuống</button><button type="button" data-delete="${i}" class="te-secondary">Xóa</button></div></article>`; }).join('') || '<p>Thư mục này chưa có tệp.</p>';
    };
    wrap.querySelector('#fm-upload').onchange = async e => {
      const folder = wrap.querySelector('#fm-folder').value; let added = 0;
      for (const f of e.target.files) {
        if (f.size > 18 * 1024 * 1024) { toast(f.name + ' lớn hơn 18 MB, bỏ qua để tránh website quá nặng.'); continue; }
        const data = await new Promise(res => fileAsDataURL(f, res));
        store.push({ name: f.name, type: f.type || 'application/octet-stream', size: f.size, data, folder }); added++;
      }
      e.target.value = ''; render();
      if (added) { touch(); toast('Đã thêm ' + added + ' tệp vào thư mục. Hãy xuất website để lưu.'); }
    };
    wrap.querySelector('#fm-search').oninput = render;
    wrap.querySelector('#fm-folder').onchange = render;
    grid.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      const idx = Number(b.dataset.preview ?? b.dataset.download ?? b.dataset.delete), f = store[idx]; if (!f) return;
      if (b.dataset.delete !== undefined) { if (confirm('Xóa ' + f.name + ' khỏi kho tài liệu?')) { store.splice(idx, 1); touch(); render(); } return; }
      const blob = dataURLToBlob(f.data);
      if (b.dataset.download !== undefined) { saveBlob(blob, f.name); return; }
      if (f.type.startsWith('image/') || f.type === 'application/pdf' || f.type.startsWith('text/')) {
        const url = URL.createObjectURL(blob);
        if (!window.open(url, '_blank')) toast('Trình duyệt chặn cửa sổ mới. Hãy cho phép popup hoặc dùng Tải xuống.');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else toast('Định dạng này không xem trực tiếp được trong trình duyệt. Hãy dùng Tải xuống.');
    };
    render();
  }

  /* ---------- Sắp xếp bằng kéo thả ---------- */
  function clearDropMarks() { document.querySelectorAll('.te-drop-before,.te-drop-after').forEach(n => n.classList.remove('te-drop-before', 'te-drop-after')); }
  function compatible(a, b) {
    if (!a || !b || a === b || a.parentElement !== b.parentElement) return false;
    return (a.tagName === 'SECTION' && b.tagName === 'SECTION') ||
      (a.classList.contains('team-member-item') && b.classList.contains('team-member-item')) ||
      (a.classList.contains('directory-card') && b.classList.contains('directory-card'));
  }
  function onDragStart(e) { e.stopPropagation(); dragged = e.currentTarget; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', 'token-reorder'); } catch (x) { } }
  function onDragOver(e) {
    e.stopPropagation();
    if (!compatible(dragged, e.currentTarget)) return;
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    clearDropMarks();
    const r = e.currentTarget.getBoundingClientRect();
    const before = e.currentTarget.tagName === 'SECTION' ? e.clientY < r.top + r.height / 2 : (e.clientX < r.left + r.width / 2 || e.clientY < r.top + r.height / 2 && Math.abs(e.clientX - (r.left + r.width / 2)) < 5);
    e.currentTarget.classList.add(before ? 'te-drop-before' : 'te-drop-after');
  }
  function onDrop(e) {
    e.stopPropagation(); e.preventDefault();
    const t = e.currentTarget;
    if (compatible(dragged, t)) {
      const r = t.getBoundingClientRect();
      const before = t.tagName === 'SECTION' ? e.clientY < r.top + r.height / 2 : e.clientX < r.left + r.width / 2;
      t.parentElement.insertBefore(dragged, before ? t : t.nextSibling); touch();
    }
    clearDropMarks(); dragged = null;
  }
  function onDragEnd() { clearDropMarks(); dragged = null; }
  function setLayoutMode(on) {
    document.body.classList.toggle('te-layout-mode', on);
    const btn = $('#te-layout'); btn.classList.toggle('te-active', on);
    btn.innerHTML = on ? '<i class="bi bi-check2-circle"></i> Hoàn tất sắp xếp' : '<i class="bi bi-arrows-move"></i> Sắp xếp';
    document.querySelectorAll(DRAG_SEL).forEach(el => {
      el.draggable = on;
      ['dragstart', 'dragover', 'drop', 'dragend'].forEach((ev, i) => { const fn = [onDragStart, onDragOver, onDrop, onDragEnd][i]; el.removeEventListener(ev, fn); if (on) el.addEventListener(ev, fn); });
      if (!on) el.removeAttribute('draggable');
    });
    toast(on ? 'Kéo thả section, thẻ thành viên hoặc thẻ mục lục để đổi thứ tự.' : 'Đã kết thúc sắp xếp. Hãy xuất website để lưu.');
  }

  /* ---------- Lưu nháp / xuất ---------- */
  function serializableHTML() {
    const clone = root.cloneNode(true);
    clone.querySelector('#token-editor-toolbar')?.remove();
    clone.querySelector('#token-file-store')?.remove();
    clone.querySelector('#token-editor-style')?.remove();
    clone.querySelectorAll('.te-toast,.te-modal-backdrop').forEach(el => el.remove());
    clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
    clone.querySelectorAll('[draggable]').forEach(el => el.removeAttribute('draggable'));
    clone.querySelectorAll('[data-te-editable],[data-te-image]').forEach(el => { el.removeAttribute('data-te-editable'); el.removeAttribute('data-te-image'); });
    clone.querySelectorAll('.te-drop-before,.te-drop-after').forEach(el => el.classList.remove('te-drop-before', 'te-drop-after'));
    ['te-editing', 'te-layout-mode', 'te-pick-element'].forEach(c => clone.querySelector('body').classList.remove(c));
    if (!clone.querySelector('body').getAttribute('class')) clone.querySelector('body').removeAttribute('class');
    if (window.__tokenFiles?.length) {
      const fs = document.createElement('script');
      fs.id = 'token-file-store'; fs.type = 'application/json';
      fs.textContent = JSON.stringify(window.__tokenFiles).replace(/</g, '\\u003c');
      const cb = clone.querySelector('body'); cb.insertBefore(fs, cb.firstChild); // đặt TRƯỚC các script để editor đọc được khi tải lại
    }
    return '<!doctype html>\n' + clone.outerHTML;
  }
  function saveDraft() {
    try { localStorage.setItem(STORE_KEY, serializableHTML()); unsaved = false; toast('Đã lưu bản nháp trên trình duyệt này. Hãy chọn “Xuất website” để có file dùng lâu dài.'); }
    catch (e) { toast('Không lưu được bản nháp (có thể do tệp đính kèm quá lớn). Hãy chọn “Xuất website”.'); }
  }
  function downloadHTML() {
    saveBlob(new Blob([serializableHTML()], { type: 'text/html;charset=utf-8' }), 'index.html');
    unsaved = false; toast('Đã xuất index.html. Hãy thay file index.html cũ trong thư mục website, giữ nguyên thư mục assets.');
  }
  function loadFileStore() {
    const el = document.getElementById('token-file-store');
    if (!el) { window.__tokenFiles = window.__tokenFiles || []; return; }
    try { window.__tokenFiles = JSON.parse(el.textContent); } catch (e) { window.__tokenFiles = []; }
  }
  function loadDraft() {
    try {
      const saved = localStorage.getItem(STORE_KEY);
      if (!saved || saved === serializableHTML()) return;
      if (!confirm('Tìm thấy bản nháp TOKEN đã lưu trong trình duyệt. Bạn có muốn khôi phục bản nháp không?')) return;
      const doc = new DOMParser().parseFromString(saved, 'text/html');
      document.body.innerHTML = doc.body.innerHTML;
      document.body.appendChild(toolbar);
      ['token-global-design', 'token-user-font-style'].forEach(id => { document.getElementById(id)?.remove(); const n = doc.getElementById(id); if (n) document.head.appendChild(document.importNode(n, true)); });
      document.head.querySelectorAll('link[id^="token-gf-"]').forEach(n => n.remove());
      doc.head.querySelectorAll('link[id^="token-gf-"]').forEach(n => document.head.appendChild(document.importNode(n, true)));
      ['tokenFonts', 'tokenDesign'].forEach(k => { const v = doc.documentElement.dataset[k]; if (v) root.dataset[k] = v; else delete root.dataset[k]; });
      if (doc.title) document.title = doc.title;
      loadFileStore();
      toast('Đã khôi phục bản nháp.');
    } catch (e) { console.error(e); }
  }

  /* ---------- Chế độ chỉnh sửa ---------- */
  function setEditing(on) {
    editing = on;
    document.body.classList.toggle('te-editing', on);
    document.querySelectorAll('img').forEach(img => { if (on) img.dataset.teImage = '1'; else img.removeAttribute('data-te-image'); });
    $('#te-toggle').innerHTML = on ? '<i class="bi bi-check2-circle"></i> Hoàn tất chỉnh sửa' : '<i class="bi bi-pencil-square"></i> Bật chỉnh sửa';
    if (!on && activeEditable) activeEditable.blur();
    toast(on ? 'Chế độ chỉnh sửa đã bật. Nhấn vào chữ để sửa, nhấn vào ảnh để thay ảnh, nhấn “Chưa đính kèm” để gắn tệp.' : 'Đã tắt chế độ chỉnh sửa. Hãy lưu hoặc xuất website để giữ thay đổi.');
  }
  function editableFrom(t) {
    let el = t.nodeType === 1 ? t : t.parentElement;
    while (el && el !== document.body && el !== root) {
      if (el.closest(UI_SEL)) return null;
      if (el.matches(TEXT_SEL)) return el;
      if ([...el.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim())) return el;
      el = el.parentElement;
    }
    return null;
  }

  document.addEventListener('click', e => {
    if (e.target.closest('.te-modal-backdrop') || e.target.closest('#token-editor-toolbar') || e.target.closest('[data-te-ignore]')) return;
    // 1) Chọn ô để chỉnh (không cần bật chế độ chỉnh sửa trước)
    if (picking) {
      const t = e.target;
      e.preventDefault(); e.stopPropagation();
      if (t === document.body || t === root || t.tagName === 'MAIN') { toast('Hãy nhấn vào một ô cụ thể (chữ, thẻ, nút...).'); return; }
      setPicking(false); openElementPanel(t); return;
    }
    // 2) Chế độ sắp xếp: không điều hướng, không sửa chữ
    if (document.body.classList.contains('te-layout-mode')) { if (e.target.closest('a')) e.preventDefault(); return; }
    // 3) Tệp đính kèm: tải về bằng Blob (data: URL bị Chrome chặn khi điều hướng)
    const dl = e.target.closest('a.file-link[href^="data:"]');
    if (dl && !editing) { e.preventDefault(); try { saveBlob(dataURLToBlob(dl.href), dl.download || dl.dataset.filename || 'tai-lieu'); } catch (err) { toast('Không tải được tệp: ' + err.message); } return; }
    if (!editing) return;
    // 4) Ảnh: nhấn vào ảnh hoặc vùng phủ lên ảnh thành viên
    let img = e.target.closest('img');
    if (!img) { const holder = e.target.closest('.member-photo,figure'); if (holder && e.target === holder) img = holder.querySelector('img'); }
    if (img) { e.preventDefault(); e.stopPropagation(); chooseFile('image/*', f => openCropper(img, f)); return; }
    // 5) Tệp đính kèm
    const link = e.target.closest('.file-link');
    if (link) { e.preventDefault(); e.stopPropagation(); openFileLinkPanel(link); return; }
    // 6) Sửa chữ trực tiếp
    const el = editableFrom(e.target);
    if (!el) return;
    e.preventDefault(); e.stopPropagation();
    if (el.tagName === 'I') { openElementPanel(el); return; }
    if (el.isContentEditable) return;
    el.dataset.teEditable = '1'; el.contentEditable = 'true'; el.focus();
  }, true);

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const dialogs = [...document.querySelectorAll('.te-modal-backdrop')];
    if (dialogs.length) { dialogs[dialogs.length - 1].remove(); e.preventDefault(); return; }
    if (picking) { setPicking(false); return; }
    if (activeEditable) { activeEditable.blur(); activeEditable = null; }
  });
  document.addEventListener('focusin', e => { if (e.target.matches?.('[contenteditable="true"]')) activeEditable = e.target; });
  document.addEventListener('focusout', e => { if (e.target.matches?.('[contenteditable="true"]')) { e.target.removeAttribute('contenteditable'); activeEditable = null; } });
  document.addEventListener('input', e => { if (e.target.closest?.('[contenteditable="true"]')) touch(); });
  document.addEventListener('paste', e => {
    const ed = e.target.closest?.('[contenteditable="true"]'); if (!ed) return;
    e.preventDefault();
    document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain'));
  });
  window.addEventListener('beforeunload', e => { if (unsaved) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- Gắn nút ---------- */
  $('#te-toggle').addEventListener('click', () => setEditing(!editing));
  $('#te-font').addEventListener('click', openFontPanel);
  $('#te-design').addEventListener('click', openDesignPanel);
  $('#te-element').addEventListener('click', () => setPicking(!picking));
  $('#te-structure').addEventListener('click', openStructurePanel);
  $('#te-files').addEventListener('click', openFileManager);
  $('#te-layout').addEventListener('click', () => setLayoutMode(!document.body.classList.contains('te-layout-mode')));
  $('#te-save').addEventListener('click', saveDraft);
  $('#te-export').addEventListener('click', downloadHTML);
  $('#te-viewer').addEventListener('click', () => {
    const url = location.protocol === 'file:' ? location.href.split(/[?#]/)[0] + '?xem' : location.origin + '/xem';
    const done = () => toast('Đã sao chép link người xem: ' + url);
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done, () => window.prompt('Link dành cho người xem:', url));
    else window.prompt('Link dành cho người xem:', url);
  });
  $('#te-help').addEventListener('click', () => modal(`<h3>Cách chỉnh sửa website TOKEN</h3><ol>
    <li>Chọn <b>Bật chỉnh sửa</b>, nhấn vào chữ để sửa nhanh.</li>
    <li><b>Thay ảnh:</b> nhấn vào ảnh → chọn ảnh từ máy → kéo/zoom để cắt → <b>Áp dụng ảnh</b>.</li>
    <li><b>Định dạng chữ:</b> bôi đen đoạn chữ → <b>Thiết kế chữ</b> → chọn đậm/nghiêng/màu/cỡ/căn lề.</li>
    <li><b>Chỉnh từng ô:</b> nhấn nút rồi nhấn vào bất kỳ ô nào trên trang (không cần bật chỉnh sửa).</li>
    <li><b>Tài liệu:</b> bật chỉnh sửa, nhấn “Chưa đính kèm” để gắn tệp; khi tắt chỉnh sửa, nhấn “Tải tài liệu” để tải về.</li>
    <li>Nhấn <b>Esc</b> hoặc <b>Hủy / Đóng</b> để thoát bảng. Chọn <b>Xuất website</b> để tải index.html mới, thay file cũ và giữ nguyên thư mục assets.</li></ol>
    <p><b>Lưu ý:</b> chỉnh sửa diễn ra trên trình duyệt của máy bạn. Muốn người khác thấy bản mới, hãy đưa thư mục website đã xuất lên hosting.</p>`));

  loadFileStore();
  applyFonts();
  applyDesign();
  loadDraft();
})();
