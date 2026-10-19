// Data loaded from the API, shared by every view
const state = {
  users: [],
  categories: [],
  allRequests: [], // every request, used for counts and stats
  boardRequests: [], // requests matching the board's priority and category filters
  stats: [],
  roleFilter: '',
  priorityFilter: '',
  openRequestId: null,
};

const STATUSES = ['Open', 'In Progress', 'Resolved'];
const AVATAR_COLORS = ['#0f8a7e', '#2f6fdb', '#9333ea', '#d97706', '#db2777', '#0891b2', '#65a30d'];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// Calls the API and returns the "data" field. Throws the API's error message if the request fails.
async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const json = await res.json();

  if (!json.success) {
    throw new Error(json.error || 'Request failed');
  }

  return json.data;
}

// ---------- Small helpers ----------

// Escapes text before putting it into HTML, so user input can't inject markup
function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value ?? '';
  return div.innerHTML;
}

function initials(name = '') {
  return name
    .replace(/^(Dr|Mr|Ms|Mrs|Prof)\.?\s+/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

// The same person always gets the same avatar color
function avatar(user, size = '') {
  const id = user?._id ?? '';
  const sum = [...id].reduce((total, ch) => total + ch.charCodeAt(0), 0);
  const color = AVATAR_COLORS[sum % AVATAR_COLORS.length];
  return `<span class="avatar ${size}" style="background:${color}">${escapeHtml(initials(user?.name))}</span>`;
}

function pill(value) {
  return `<span class="pill ${value.replace(' ', '-')}">${escapeHtml(value)}</span>`;
}

function shortDate(value) {
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function timeAgo(value) {
  const seconds = Math.round((Date.now() - new Date(value)) / 1000);
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, size] of units) {
    if (seconds >= size) {
      const n = Math.floor(seconds / size);
      return `${n} ${unit}${n > 1 ? 's' : ''} ago`;
    }
  }
  return 'just now';
}

let toastTimer;
function showToast(message, isError = false) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.hidden = true), 3000);
}

// Runs an async action and shows any error as a toast
async function attempt(action) {
  try {
    await action();
  } catch (err) {
    showToast(err.message, true);
  }
}

// ---------- Navigation ----------

function showView(name) {
  $$('.nav-link').forEach((link) => link.classList.toggle('active', link.dataset.view === name));
  $$('.view').forEach((view) => view.classList.toggle('active', view.id === `view-${name}`));
  history.replaceState(null, '', `#${name}`);
}

$$('.nav-link').forEach((link) => link.addEventListener('click', () => showView(link.dataset.view)));
$$('[data-goto]').forEach((btn) => btn.addEventListener('click', () => showView(btn.dataset.goto)));

// Buttons with data-open="<dialog id>" open that dialog; data-close closes the dialog they're in
$$('[data-open]').forEach((btn) =>
  btn.addEventListener('click', () => $(`#${btn.dataset.open}`).showModal())
);
$$('[data-close]').forEach((btn) =>
  btn.addEventListener('click', () => btn.closest('dialog').close())
);

// Clicking the dark backdrop around a dialog closes it
$$('dialog').forEach((dialog) =>
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  })
);

// ---------- Loading data ----------

async function loadUsers() {
  state.users = await api('/users');

  $('#request-form').requester.innerHTML = state.users
    .map((u) => `<option value="${u._id}">${escapeHtml(u.name)} (${u.role})</option>`)
    .join('');
}

async function loadCategories() {
  state.categories = await api('/categories');

  const options = state.categories
    .map((c) => `<option value="${c._id}">${escapeHtml(c.name)}</option>`)
    .join('');

  $('#request-form').category.innerHTML = options;
  $('#drawer-form').category.innerHTML = options;

  const filter = $('#board-category');
  const selected = filter.value;
  filter.innerHTML = `<option value="">All categories</option>${options}`;
  filter.value = selected;
}

async function loadRequests() {
  // The board's priority and category filters use the API's query parameters
  const params = new URLSearchParams();
  if (state.priorityFilter) params.set('priority', state.priorityFilter);
  if ($('#board-category').value) params.set('category', $('#board-category').value);

  const [all, filtered, stats] = await Promise.all([
    api('/requests'),
    params.size ? api(`/requests?${params}`) : null,
    api('/requests/stats/unresolved-by-category'),
  ]);

  state.allRequests = all;
  state.boardRequests = filtered ?? all;
  state.stats = stats;
}

function renderAll() {
  renderOverview();
  renderBoard();
  renderPeople();
  renderCategories();
}

async function refresh() {
  await loadRequests();
  renderAll();
}

// ---------- Overview ----------

function renderOverview() {
  const all = state.allRequests;
  const count = (status) => all.filter((r) => r.status === status).length;
  const open = count('Open');
  const progress = count('In Progress');
  const resolved = count('Resolved');

  $('#kpi-open').textContent = open;
  $('#kpi-progress').textContent = progress;
  $('#kpi-resolved').textContent = resolved;
  $('#kpi-rate').textContent = all.length ? `${Math.round((resolved / all.length) * 100)}%` : '0%';

  const unresolved = open + progress;
  $('#overview-lede').textContent = unresolved
    ? `${unresolved} request${unresolved > 1 ? 's' : ''} still need${unresolved > 1 ? '' : 's'} attention.`
    : 'All caught up. Every request is resolved.';

  // Unresolved per category, from the aggregation endpoint
  const max = Math.max(1, ...state.stats.map((s) => s.unresolvedCount));
  $('#category-bars').innerHTML = state.stats.length
    ? state.stats
        .map(
          (s) => `
        <div>
          <div class="hbar-top"><span>${escapeHtml(s.categoryName)}</span><strong>${s.unresolvedCount}</strong></div>
          <div class="hbar-track"><div class="hbar-fill" style="width:${(s.unresolvedCount / max) * 100}%"></div></div>
        </div>`
        )
        .join('')
    : '<p class="empty">Nothing unresolved.</p>';

  // Unresolved per priority, as one stacked bar
  const open_ = all.filter((r) => r.status !== 'Resolved');
  const priorities = ['High', 'Medium', 'Low'].map((p) => ({
    name: p,
    count: open_.filter((r) => r.priority === p).length,
    color: `var(--${p.toLowerCase()})`,
  }));

  $('#priority-stack').innerHTML = priorities
    .filter((p) => p.count)
    .map((p) => `<span style="width:${(p.count / open_.length) * 100}%;background:${p.color}"></span>`)
    .join('');

  $('#priority-legend').innerHTML = priorities
    .map((p) => `<li><span class="kpi-dot" style="background:${p.color}"></span>${p.name}<strong>${p.count}</strong></li>`)
    .join('');

  // Recent activity: the most recently updated requests
  const recent = [...all].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 6);

  $('#recent-list').innerHTML = recent.length
    ? recent
        .map(
          (r) => `
        <li data-id="${r._id}">
          ${avatar(r.requester)}
          <div>
            <span class="recent-text">${escapeHtml(r.description)}</span>
            <span class="recent-sub">${escapeHtml(r.requester?.name)} · ${escapeHtml(r.category?.name)} · ${timeAgo(r.updatedAt)}</span>
          </div>
          ${pill(r.status)}
        </li>`
        )
        .join('')
    : '<p class="empty">No requests yet.</p>';
}

$('#recent-list').addEventListener('click', (e) => {
  const item = e.target.closest('li[data-id]');
  if (item) openDrawer(item.dataset.id);
});

// ---------- Board ----------

function renderBoard() {
  const search = $('#search').value.trim().toLowerCase();

  const visible = state.boardRequests.filter(
    (r) =>
      !search ||
      r.description.toLowerCase().includes(search) ||
      r.requester?.name.toLowerCase().includes(search)
  );

  $$('.column').forEach((column) => {
    const cards = visible.filter((r) => r.status === column.dataset.status);
    column.querySelector('.count').textContent = cards.length;

    column.querySelector('.column-body').innerHTML = cards.length
      ? cards
          .map(
            (r) => `
          <article class="ticket" draggable="true" data-id="${r._id}">
            <div class="ticket-top">${pill(r.priority)}<span class="pill tag">${escapeHtml(r.category?.name)}</span></div>
            <p class="ticket-text">${escapeHtml(r.description)}</p>
            <div class="ticket-foot">
              ${avatar(r.requester, 'sm')}
              <span>${escapeHtml(r.requester?.name)}</span>
              <span class="date">${shortDate(r.date)}</span>
            </div>
          </article>`
          )
          .join('')
      : '<p class="column-empty">No requests</p>';
  });
}

$('#search').addEventListener('input', renderBoard);
$('#board-category').addEventListener('change', () => attempt(refresh));

$('#priority-chips').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  $$('#priority-chips .chip').forEach((c) => c.classList.toggle('active', c === chip));
  state.priorityFilter = chip.dataset.priority;
  attempt(refresh);
});

// Clicking a card opens its details
$('#board').addEventListener('click', (e) => {
  const card = e.target.closest('.ticket');
  if (card) openDrawer(card.dataset.id);
});

// Drag and drop: dropping a card on another column changes its status
$('#board').addEventListener('dragstart', (e) => {
  const card = e.target.closest('.ticket');
  if (!card) return;
  card.classList.add('dragging');
  e.dataTransfer.setData('text/plain', card.dataset.id);
});

$('#board').addEventListener('dragend', (e) => {
  e.target.closest('.ticket')?.classList.remove('dragging');
});

$$('.column').forEach((column) => {
  column.addEventListener('dragover', (e) => {
    e.preventDefault();
    column.classList.add('drag-over');
  });

  column.addEventListener('dragleave', (e) => {
    if (!column.contains(e.relatedTarget)) column.classList.remove('drag-over');
  });

  column.addEventListener('drop', (e) => {
    e.preventDefault();
    column.classList.remove('drag-over');

    const id = e.dataTransfer.getData('text/plain');
    const request = state.allRequests.find((r) => r._id === id);
    const status = column.dataset.status;

    if (request && request.status !== status) {
      attempt(() => updateStatus(id, status));
    }
  });
});

async function updateStatus(id, status) {
  await api(`/requests/${id}`, { method: 'PATCH', body: { status } });
  showToast(`Moved to ${status}`);
  await refresh();
}

// ---------- Request drawer ----------

function openDrawer(id) {
  const request = state.allRequests.find((r) => r._id === id);
  if (!request) return;

  state.openRequestId = id;
  const form = $('#drawer-form');

  $('#drawer-id').textContent = `#${id.slice(-6)}`;
  form.description.value = request.description;
  form.category.value = request.category?._id;
  form.priority.value = request.priority;

  $$('#drawer-status button').forEach((btn) =>
    btn.classList.toggle('active', btn.dataset.status === request.status)
  );

  $('#drawer-person').innerHTML = `
    ${avatar(request.requester)}
    <div>
      <div class="tile-title">${escapeHtml(request.requester?.name)}</div>
      <div class="tile-sub">${escapeHtml(request.requester?.email)} · ${escapeHtml(request.requester?.role)}</div>
    </div>`;

  $('#drawer-meta').textContent =
    `Submitted ${new Date(request.date).toLocaleString()} · Last updated ${timeAgo(request.updatedAt)}`;

  const drawer = $('#drawer');
  if (!drawer.open) drawer.showModal();
}

// Status buttons in the drawer save immediately
$('#drawer-status').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn || btn.classList.contains('active')) return;

  attempt(async () => {
    await updateStatus(state.openRequestId, btn.dataset.status);
    openDrawer(state.openRequestId);
  });
});

$('#drawer-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;

  attempt(async () => {
    await api(`/requests/${state.openRequestId}`, {
      method: 'PATCH',
      body: {
        description: form.description.value,
        category: form.category.value,
        priority: form.priority.value,
      },
    });
    $('#drawer').close();
    showToast('Changes saved');
    await refresh();
  });
});

$('#drawer-delete').addEventListener('click', () => {
  if (!confirm('Delete this request? This cannot be undone.')) return;

  attempt(async () => {
    await api(`/requests/${state.openRequestId}`, { method: 'DELETE' });
    $('#drawer').close();
    showToast('Request deleted');
    await refresh();
  });
});

// ---------- New request ----------

$('#request-form').description.addEventListener('input', (e) => {
  $('#desc-count').textContent = e.target.value.length;
});

$('#request-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;

  attempt(async () => {
    await api('/requests', {
      method: 'POST',
      body: {
        requester: form.requester.value,
        category: form.category.value,
        priority: form.priority.value,
        description: form.description.value,
      },
    });
    form.description.value = '';
    $('#desc-count').textContent = '0';
    $('#request-dialog').close();
    showToast('Request submitted');
    await refresh();
  });
});

// ---------- People ----------

function renderPeople() {
  const people = state.roleFilter
    ? state.users.filter((u) => u.role === state.roleFilter)
    : state.users;

  $('#people-grid').innerHTML = people.length
    ? people
        .map((u) => {
          const theirs = state.allRequests.filter((r) => r.requester?._id === u._id);
          const active = theirs.filter((r) => r.status !== 'Resolved').length;
          return `
          <div class="tile">
            <div class="tile-head">
              ${avatar(u, 'lg')}
              <div>
                <div class="tile-title">${escapeHtml(u.name)}</div>
                <div class="tile-sub">${escapeHtml(u.email)}</div>
              </div>
            </div>
            <div><span class="pill tag">${u.role === 'staff' ? 'Staff' : 'Student'}</span></div>
            <div class="tile-stats">
              <div><strong>${theirs.length}</strong>requests</div>
              <div><strong>${active}</strong>unresolved</div>
            </div>
          </div>`;
        })
        .join('')
    : '<p class="empty">No people found.</p>';
}

$('#role-filter').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  $$('#role-filter button').forEach((b) => b.classList.toggle('active', b === btn));
  state.roleFilter = btn.dataset.role;
  renderPeople();
});

$('#person-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;

  attempt(async () => {
    await api('/users', {
      method: 'POST',
      body: { name: form.name.value, email: form.email.value, role: form.role.value },
    });
    form.reset();
    $('#person-dialog').close();
    showToast('Person added');
    await loadUsers();
    renderPeople();
  });
});

// ---------- Categories ----------

function renderCategories() {
  $('#category-grid').innerHTML = state.categories.length
    ? state.categories
        .map((c) => {
          const theirs = state.allRequests.filter((r) => r.category?._id === c._id);
          const resolved = theirs.filter((r) => r.status === 'Resolved').length;
          const percent = theirs.length ? Math.round((resolved / theirs.length) * 100) : 0;
          return `
          <div class="tile">
            <div class="tile-title">${escapeHtml(c.name)}</div>
            <p class="tile-desc">${escapeHtml(c.description) || 'No description'}</p>
            <div>
              <div class="hbar-top"><span class="tile-sub">${percent}% resolved</span></div>
              <div class="hbar-track"><div class="hbar-fill" style="width:${percent}%"></div></div>
            </div>
            <div class="tile-stats">
              <div><strong>${theirs.length}</strong>total</div>
              <div><strong>${theirs.length - resolved}</strong>unresolved</div>
            </div>
          </div>`;
        })
        .join('')
    : '<p class="empty">No categories yet.</p>';
}

$('#category-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;

  attempt(async () => {
    await api('/categories', {
      method: 'POST',
      body: { name: form.name.value, description: form.description.value },
    });
    form.reset();
    $('#category-dialog').close();
    showToast('Category added');
    await loadCategories();
    renderCategories();
  });
});

// ---------- Start ----------

async function init() {
  const startView = location.hash.slice(1);
  if (['overview', 'board', 'people', 'categories'].includes(startView)) {
    showView(startView);
  }

  try {
    await Promise.all([loadUsers(), loadCategories()]);
    await refresh();
  } catch (err) {
    showToast(`Could not load data: ${err.message}`, true);
  }
}

init();
