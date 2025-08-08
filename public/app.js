const rowsEl = document.getElementById('rows');
const searchEl = document.getElementById('search');
const sortEl = document.getElementById('sort');
const orderEl = document.getElementById('order');
const prevEl = document.getElementById('prev');
const nextEl = document.getElementById('next');
const pageInfoEl = document.getElementById('pageInfo');
const syncBtn = document.getElementById('syncBtn');

let page = 1;
const pageSize = 25;

function secondsToHMS(total) {
  if (!total && total !== 0) return '';
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s]
    .map((v, i) => (i === 0 ? v : String(v).padStart(2, '0')))
    .filter((v, i) => v !== 0 || i > 0)
    .join(':');
}

async function load() {
  const params = new URLSearchParams({
    q: searchEl.value,
    sort: sortEl.value,
    order: orderEl.value,
    page: String(page),
    pageSize: String(pageSize),
  });
  const res = await fetch(`/api/videos?${params.toString()}`);
  const data = await res.json();
  rowsEl.innerHTML = '';
  for (const v of data.rows) {
    const thumb = (() => {
      try {
        const t = JSON.parse(v.thumbnails || 'null');
        return t?.medium?.url || t?.default?.url || '';
      } catch {
        return '';
      }
    })();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="video">
          ${thumb ? `<img src="${thumb}" alt="thumb"/>` : ''}
          <div>
            <a href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener">${v.title}</a>
            <div class="desc">${(v.description || '').slice(0, 140)}</div>
          </div>
        </div>
      </td>
      <td>${new Date(v.publishedAt).toLocaleString()}</td>
      <td>${secondsToHMS(v.durationSeconds || 0)}</td>
      <td>${v.viewCount?.toLocaleString?.() ?? ''}</td>
      <td>${v.likeCount?.toLocaleString?.() ?? ''}</td>
      <td>${v.commentCount?.toLocaleString?.() ?? ''}</td>
    `;
    rowsEl.appendChild(tr);
  }
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, data.total);
  pageInfoEl.textContent = `${start}-${end} of ${data.total}`;
  prevEl.disabled = page <= 1;
  nextEl.disabled = end >= data.total;
}

searchEl.addEventListener('input', () => {
  page = 1;
  load();
});
for (const el of [sortEl, orderEl]) el.addEventListener('change', () => { page = 1; load(); });
prevEl.addEventListener('click', () => { if (page > 1) { page--; load(); } });
nextEl.addEventListener('click', () => { page++; load(); });
syncBtn.addEventListener('click', async () => {
  syncBtn.disabled = true;
  syncBtn.textContent = 'Syncing…';
  try {
    const res = await fetch('/api/sync');
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Sync failed');
  } catch (e) {
    alert(e.message || String(e));
  } finally {
    syncBtn.disabled = false;
    syncBtn.textContent = 'Sync last 120 days';
    load();
  }
});

load();


