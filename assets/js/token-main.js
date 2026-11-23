// TOKEN GROUP 09: close the mobile menu after a navigation choice.
document.querySelectorAll('#tokenNav .nav-link, #tokenNav .dropdown-item').forEach(link => {
  link.addEventListener('click', () => {
    const nav = document.getElementById('tokenNav');
    if (nav && nav.classList.contains('show')) bootstrap.Collapse.getOrCreateInstance(nav).hide();
  });
});

// The full directory card acts as a navigation target; inner links keep their own anchors.
document.querySelectorAll('.directory-card[data-href]').forEach(card => {
  const openCard = event => {
    if (event.target.closest('a')) return;
    window.location.href = card.dataset.href;
  };
  card.addEventListener('click', openCard);
  card.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      window.location.href = card.dataset.href;
    }
  });
});


/* === TOKEN GROUP 09: AUTO-SAVE FILE UPLOAD TO BROWSER MEMORY (IndexedDB) === */
(function () {
  const DB_NAME = 'TOKEN_GROUP09_DOCS_DB';
  const STORE_NAME = 'uploaded_files';
  const DB_VERSION = 1;

  function openDocsDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function getAllSavedFiles() {
    const db = await openDocsDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function saveFileRecord(record) {
    const db = await openDocsDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).add(record);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function deleteFileRecord(id) {
    const db = await openDocsDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  function getFileIcon(mime, name) {
    const ext = (name.split('.').pop() || '').toLowerCase();
    if (mime.includes('pdf') || ext === 'pdf') return 'bi-file-earmark-pdf';
    if (mime.includes('word') || ['doc', 'docx'].includes(ext)) return 'bi-file-earmark-word';
    if (mime.includes('presentation') || ['ppt', 'pptx'].includes(ext)) return 'bi-file-earmark-slides';
    if (mime.includes('sheet') || ['xls', 'xlsx', 'csv'].includes(ext)) return 'bi-file-earmark-excel';
    if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return 'bi-file-earmark-image';
    if (['zip', 'rar', '7z'].includes(ext)) return 'bi-file-earmark-zip';
    return 'bi-file-earmark-text';
  }

  function renderFileCard(item) {
    const groupEl = document.getElementById(item.category);
    if (!groupEl) return;
    const row = groupEl.querySelector('.row');
    if (!row) return;
    if (row.querySelector(`[data-saved-doc-id="${item.id}"]`)) return;

    const blobUrl = URL.createObjectURL(item.blob);
    const sizeKB = Math.max(1, Math.round(item.size / 1024));
    const col = document.createElement('div');
    col.className = 'col-md-4';
    col.setAttribute('data-saved-doc-id', item.id);
    col.innerHTML = `
      <article class="file-card">
        <i class="bi ${getFileIcon(item.type, item.name)}"></i>
        <div>
          <b>${item.name}</b>
          <small>${sizeKB} KB · Đã lưu tự động (${item.date})</small>
        </div>
        <div class="d-flex align-items-center gap-2 mt-2">
          <a class="file-link" href="${blobUrl}" download="${item.name}">Tải tài liệu <i class="bi bi-download"></i></a>
          <button type="button" class="btn btn-sm btn-outline-danger border-0 px-2 py-1" data-remove-doc="${item.id}" title="Xóa tệp khỏi bộ nhớ">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </article>
    `;
    row.appendChild(col);

    // Sync into window.__tokenFiles so exporting HTML also embeds uploaded files
    window.__tokenFiles = window.__tokenFiles || [];
    if (!window.__tokenFiles.some(f => f.name === item.name && f.size === item.size)) {
      const reader = new FileReader();
      reader.onload = () => {
        window.__tokenFiles.push({
          name: item.name,
          type: item.type,
          size: item.size,
          data: reader.result,
          folder: groupEl.querySelector('h3')?.textContent?.trim() || 'Tệp nén & bổ sung'
        });
      };
      reader.readAsDataURL(item.blob);
    }
  }

  async function initAutoUploader() {
    const btn = document.getElementById('tokenBtnUploadNow');
    const input = document.getElementById('tokenQuickUpload');
    const select = document.getElementById('tokenUploadCategory');
    const status = document.getElementById('tokenUploadStatus');

    try {
      const saved = await getAllSavedFiles();
      saved.forEach(renderFileCard);
    } catch (err) {
      console.error('Lỗi đọc bộ nhớ tài liệu:', err);
    }

    document.addEventListener('click', async (e) => {
      const delBtn = e.target.closest('[data-remove-doc]');
      if (!delBtn) return;
      const id = Number(delBtn.getAttribute('data-remove-doc'));
      if (!confirm('Xóa tài liệu này khỏi bộ nhớ trình duyệt?')) return;
      await deleteFileRecord(id);
      document.querySelector(`[data-saved-doc-id="${id}"]`)?.remove();
    });

    if (!btn || !input || !select) return;

    btn.addEventListener('click', async () => {
      if (!input.files || !input.files.length) {
        if (status) status.textContent = 'Vui lòng chọn ít nhất 1 tệp trước khi tải lên.';
        return;
      }
      const category = select.value;
      const today = new Date().toLocaleDateString('vi-VN');
      let count = 0;

      for (const file of input.files) {
        const record = {
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          category: category,
          date: today,
          blob: file
        };
        const newId = await saveFileRecord(record);
        record.id = newId;
        renderFileCard(record);
        count++;
      }

      input.value = '';
      if (status) {
        status.textContent = `Đã tải lên và tự động lưu ${count} tệp vào bộ nhớ! Tệp sẽ tự động hiển thị lại mỗi khi mở trang.`;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', initAutoUploader);
})();
