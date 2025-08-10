// Tabs
const tabs = document.querySelectorAll('nav.tabs button');
const tabSections = {
  channels: document.getElementById('tab-channels'),
  engagement: document.getElementById('tab-engagement'),
  videos: document.getElementById('tab-videos'),
};

// Channels tab
const channelsRowsEl = document.getElementById('channelsRows');
const addChannelBtn = document.getElementById('addChannel');
const newHandleEl = document.getElementById('newHandle');
const syncAllBtn = document.getElementById('syncBtn');

// Engagement tab
const engRowsEl = document.getElementById('engRows');
const engPrevEl = document.getElementById('engPrev');
const engNextEl = document.getElementById('engNext');
const engPageInfoEl = document.getElementById('engPageInfo');
const engOrderEl = document.getElementById('engOrder');

// All videos tab
const rowsEl = document.getElementById('rows');
const searchEl = document.getElementById('search');
const sortEl = document.getElementById('sort');
const orderEl = document.getElementById('order');
const prevEl = document.getElementById('prev');
const nextEl = document.getElementById('next');
const pageInfoEl = document.getElementById('pageInfo');

let page = 1;
const pageSize = 25;
let engPage = 1;
const engPageSize = 25;

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

async function loadVideos() {
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

async function loadEngagement() {
  const params = new URLSearchParams({
    page: String(engPage),
    pageSize: String(engPageSize),
    order: engOrderEl.value,
  });
  const res = await fetch(`/api/videos/engagement?${params.toString()}`);
  const data = await res.json();
  engRowsEl.innerHTML = '';
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
          </div>
        </div>
      </td>
      <td>${new Date(v.publishedAt).toLocaleString()}</td>
      <td>${secondsToHMS(v.durationSeconds || 0)}</td>
      <td>${v.viewCount?.toLocaleString?.() ?? ''}</td>
      <td>${v.likeCount?.toLocaleString?.() ?? ''}</td>
      <td>${v.commentCount?.toLocaleString?.() ?? ''}</td>
    `;
    engRowsEl.appendChild(tr);
  }
  const start = (engPage - 1) * engPageSize + 1;
  const end = Math.min(engPage * engPageSize, data.total);
  engPageInfoEl.textContent = `${start}-${end} of ${data.total}`;
  engPrevEl.disabled = engPage <= 1;
  engNextEl.disabled = end >= data.total;
}

async function loadChannels() {
  const res = await fetch('/api/channels');
  const data = await res.json();
  channelsRowsEl.innerHTML = '';
  for (const c of data.rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><a href="javascript:void(0)" data-dashboard="${c.id}">${c.title}</a></td>
      <td>${c.handle || ''}</td>
      <td>${(c.subscriberCount ?? 0).toLocaleString()}</td>
      <td>${c.videoCount}</td>
      <td>${c.lastSyncedAt ? new Date(c.lastSyncedAt).toLocaleString() : ''}</td>
      <td>
        <button data-resync="${c.handle || ''}">Re-Sync</button>
        <button data-remove="${c.id}">Remove</button>
      </td>
    `;
    channelsRowsEl.appendChild(tr);
  }
}

function renderChannelDashboard(data) {
  const { channel, trends, top, special } = data;
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2>${channel.title} (${(channel.subscriberCount||0).toLocaleString()} subs)</h2>
        <button id="closeDash">✕</button>
      </div>
      <div class="modal-body">
        <section>
          <h3>Trends (120d)</h3>
          <div class="trend-grid">
            <div><b>Day</b></div><div><b>Views</b></div><div><b>Likes</b></div><div><b>Comments</b></div>
            ${trends.map(t => `<div>${t.day}</div><div>${t.views}</div><div>${t.likes}</div><div>${t.comments}</div>`).join('')}
          </div>
        </section>
        <section>
          <h3>Top Videos (120d)</h3>
          <div class="columns">
            <div>
              <h4>By Views</h4>
              <ul>${top.views.map(v=>`<li><a target="_blank" href="https://www.youtube.com/watch?v=${v.id}">${v.title}</a> — ${v.viewCount?.toLocaleString?.() ?? 0}</li>`).join('')}</ul>
            </div>
            <div>
              <h4>By Likes</h4>
              <ul>${top.likes.map(v=>`<li><a target="_blank" href="https://www.youtube.com/watch?v=${v.id}">${v.title}</a> — ${v.likeCount?.toLocaleString?.() ?? 0}</li>`).join('')}</ul>
            </div>
            <div>
              <h4>By Comments</h4>
              <ul>${top.comments.map(v=>`<li><a target="_blank" href="https://www.youtube.com/watch?v=${v.id}">${v.title}</a> — ${v.commentCount?.toLocaleString?.() ?? 0}</li>`).join('')}</ul>
            </div>
          </div>
        </section>
        <section>
          <h3>Special: 5× Views > Subscribers</h3>
          <ul>${special.map(v=>`<li><a target="_blank" href="https://www.youtube.com/watch?v=${v.id}">${v.title}</a> — ${v.viewCount?.toLocaleString?.() ?? 0} views</li>`).join('')}</ul>
        </section>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('closeDash').addEventListener('click', () => overlay.remove());
}

// Tab switching
tabs.forEach((b) => {
  b.addEventListener('click', () => {
    tabs.forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    for (const key in tabSections) tabSections[key].classList.remove('active');
    const target = b.dataset.tab;
    tabSections[target].classList.add('active');
    if (target === 'videos') loadVideos();
    if (target === 'engagement') loadEngagement();
    if (target === 'channels') loadChannels();
  });
});

// Events
searchEl?.addEventListener('input', () => {
  page = 1;
  loadVideos();
});
for (const el of [sortEl, orderEl]) el?.addEventListener('change', () => { page = 1; loadVideos(); });
prevEl?.addEventListener('click', () => { if (page > 1) { page--; loadVideos(); } });
nextEl?.addEventListener('click', () => { page++; loadVideos(); });

engOrderEl.addEventListener('change', () => { engPage = 1; loadEngagement(); });
engPrevEl.addEventListener('click', () => { if (engPage > 1) { engPage--; loadEngagement(); } });
engNextEl.addEventListener('click', () => { engPage++; loadEngagement(); });

syncAllBtn.addEventListener('click', async () => {
  syncAllBtn.disabled = true;
  syncAllBtn.textContent = 'Syncing…';
  try {
    const res = await fetch('/api/channels');
    const data = await res.json();
    const active = data.rows.filter(r => r.isActive);
    for (const ch of active) {
      await fetch(`/api/sync?handle=${encodeURIComponent(ch.handle || ch.title)}&sinceDays=36500`);
    }
  } finally {
    syncAllBtn.disabled = false;
    syncAllBtn.textContent = 'Sync all active';
    loadChannels();
  }
});

addChannelBtn.addEventListener('click', async () => {
  const handle = newHandleEl.value.trim();
  if (!handle) return;
  addChannelBtn.disabled = true;
  try {
    const res = await fetch('/api/channels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ handle }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Add failed');
    newHandleEl.value = '';
    await loadChannels();
  } catch (e) {
    alert(e.message || String(e));
  } finally {
    addChannelBtn.disabled = false;
  }
});

channelsRowsEl.addEventListener('click', async (e) => {
  const target = e.target;
  // Handle remove button via closest
  const removeBtn = target instanceof Element ? target.closest('button[data-remove]') : null;
  if (removeBtn) {
    const id = removeBtn.getAttribute('data-remove');
    await fetch(`/api/channels/${id}`, { method: 'DELETE' });
    await loadChannels();
    return;
  }
  // Handle re-sync button via closest
  const resyncBtn = target instanceof Element ? target.closest('button[data-resync]') : null;
  if (resyncBtn) {
    const handle = resyncBtn.getAttribute('data-resync') || '';
    if (!handle) return;
    resyncBtn.disabled = true;
    try {
      await fetch(`/api/sync?handle=${encodeURIComponent(handle)}&sinceDays=36500`);
      await loadChannels();
    } finally {
      resyncBtn.disabled = false;
    }
    return;
  }
  // Handle dashboard link via closest
  const link = target instanceof Element ? target.closest('a[data-dashboard]') : null;
  if (link) {
    e.preventDefault();
    const id = link.getAttribute('data-dashboard');
    const res = await fetch(`/api/channels/${id}/dashboard`);
    const data = await res.json();
    if (!res.ok) return alert(data?.error || 'Load failed');
    renderChannelDashboard(data);
  }
});

// initial
loadChannels();
loadEngagement();
loadVideos();


