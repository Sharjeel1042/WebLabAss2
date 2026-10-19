// Data loaded from the API, kept here so every tab can use it
const state = {
  users: [],
  categories: [],
  requests: [],
  editingId: null,
};

const $ = (selector) => document.querySelector(selector);

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

// Escapes text before putting it into HTML, so user input can't inject markup
function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value ?? '';
  return div.innerHTML;
}

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
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

function badge(value) {
  // "In Progress" becomes the class "In-Progress"
  return `<span class="badge ${value.replace(' ', '-')}">${escapeHtml(value)}</span>`;
}

// ---------- Tabs ----------

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
    tab.classList.add('active');
    $(`#${tab.dataset.tab}`).classList.add('active');
  });
});

// ---------- Dashboard ----------

async function loadDashboard() {
  const [allRequests, unresolved] = await Promise.all([
    api('/requests'),
    api('/requests/stats/unresolved-by-category'),
  ]);

  const countStatus = (status) => allRequests.filter((r) => r.status === status).length;
  $('#stat-total').textContent = allRequests.length;
  $('#stat-open').textContent = countStatus('Open');
  $('#stat-progress').textContent = countStatus('In Progress');
  $('#stat-resolved').textContent = countStatus('Resolved');

  const max = Math.max(1, ...unresolved.map((c) => c.unresolvedCount));
  $('#category-bars').innerHTML = unresolved.length
    ? unresolved
        .map(
          (c) => `
        <div class="bar-row">
          <span>${escapeHtml(c.categoryName)}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${(c.unresolvedCount / max) * 100}%"></div></div>
          <span class="bar-count">${c.unresolvedCount}</span>
        </div>`
        )
        .join('')
    : '<p class="empty">No unresolved requests. Everything is resolved.</p>';

  $('#latest-list').innerHTML = allRequests.length
    ? allRequests
        .slice(0, 5)
        .map(
          (r) => `
        <li>
          <div>
            ${escapeHtml(r.description)}
            <span class="sub">${escapeHtml(r.requester?.name)} · ${escapeHtml(r.category?.name)} · ${formatDate(r.date)}</span>
          </div>
          <div>${badge(r.status)}</div>
        </li>`
        )
        .join('')
    : '<p class="empty">No requests yet.</p>';
}

// ---------- Requests ----------

async function loadRequests() {
  const params = new URLSearchParams();
  if ($('#filter-status').value) params.set('status', $('#filter-status').value);
  if ($('#filter-priority').value) params.set('priority', $('#filter-priority').value);
  if ($('#filter-category').value) params.set('category', $('#filter-category').value);

  state.requests = await api(`/requests?${params}`);
  renderRequests();
}

function renderRequests() {
  const statuses = ['Open', 'In Progress', 'Resolved'];

  $('#requests-body').innerHTML = state.requests
    .map(
      (r) => `
    <tr>
      <td class="desc">${escapeHtml(r.description)}</td>
      <td>${escapeHtml(r.requester?.name)}<span class="sub">${escapeHtml(r.requester?.role)}</span></td>
      <td>${escapeHtml(r.category?.name)}</td>
      <td>${badge(r.priority)}</td>
      <td>
        <select class="status-select" data-id="${r._id}">
          ${statuses.map((s) => `<option ${s === r.status ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </td>
      <td>${formatDate(r.date)}</td>
      <td class="actions">
        <button class="btn small" data-edit="${r._id}">Edit</button>
        <button class="btn small danger" data-delete="${r._id}">Delete</button>
      </td>
    </tr>`
    )
    .join('');

  $('#requests-empty').hidden = state.requests.length > 0;
}

// Reloads the request table and the dashboard after something changes
async function refreshRequests() {
  await Promise.all([loadRequests(), loadDashboard()]);
}

['#filter-status', '#filter-priority', '#filter-category'].forEach((id) => {
  $(id).addEventListener('change', () => loadRequests().catch((err) => showToast(err.message, true)));
});

$('#request-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;

  try {
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
    showToast('Request submitted');
    await refreshRequests();
  } catch (err) {
    showToast(err.message, true);
  }
});

// Status dropdowns in the table: update the request as soon as the value changes
$('#requests-body').addEventListener('change', async (e) => {
  if (!e.target.matches('.status-select')) return;

  try {
    await api(`/requests/${e.target.dataset.id}`, {
      method: 'PATCH',
      body: { status: e.target.value },
    });
    showToast(`Status changed to ${e.target.value}`);
    await refreshRequests();
  } catch (err) {
    showToast(err.message, true);
  }
});

// Edit and Delete buttons in the table
$('#requests-body').addEventListener('click', async (e) => {
  const editId = e.target.dataset.edit;
  const deleteId = e.target.dataset.delete;

  if (editId) {
    openEditDialog(state.requests.find((r) => r._id === editId));
  }

  if (deleteId) {
    if (!confirm('Delete this request? This cannot be undone.')) return;

    try {
      await api(`/requests/${deleteId}`, { method: 'DELETE' });
      showToast('Request deleted');
      await refreshRequests();
    } catch (err) {
      showToast(err.message, true);
    }
  }
});

// ---------- Edit dialog ----------

function openEditDialog(request) {
  const form = $('#edit-form');
  state.editingId = request._id;
  form.description.value = request.description;
  form.category.value = request.category?._id;
  form.priority.value = request.priority;
  form.status.value = request.status;
  $('#edit-dialog').showModal();
}

$('#edit-cancel').addEventListener('click', () => $('#edit-dialog').close());

$('#edit-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;

  try {
    await api(`/requests/${state.editingId}`, {
      method: 'PATCH',
      body: {
        description: form.description.value,
        category: form.category.value,
        priority: form.priority.value,
        status: form.status.value,
      },
    });
    $('#edit-dialog').close();
    showToast('Request updated');
    await refreshRequests();
  } catch (err) {
    showToast(err.message, true);
  }
});

// ---------- Users ----------

async function loadUsers() {
  state.users = await api('/users');
  renderUsers();

  // Fill the requester dropdown on the new request form
  $('#request-form').requester.innerHTML = state.users
    .map((u) => `<option value="${u._id}">${escapeHtml(u.name)} (${u.role})</option>`)
    .join('');
}

function renderUsers() {
  const role = $('#filter-role').value;
  const users = role ? state.users.filter((u) => u.role === role) : state.users;

  $('#users-list').innerHTML = users.length
    ? users
        .map(
          (u) => `
        <li>
          <div>${escapeHtml(u.name)}<span class="sub">${escapeHtml(u.email)}</span></div>
          ${badge(u.role)}
        </li>`
        )
        .join('')
    : '<p class="empty">No users found.</p>';
}

$('#filter-role').addEventListener('change', renderUsers);

$('#user-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;

  try {
    await api('/users', {
      method: 'POST',
      body: { name: form.name.value, email: form.email.value, role: form.role.value },
    });
    form.reset();
    showToast('User added');
    await loadUsers();
  } catch (err) {
    showToast(err.message, true);
  }
});

// ---------- Categories ----------

async function loadCategories() {
  state.categories = await api('/categories');

  $('#categories-list').innerHTML = state.categories.length
    ? state.categories
        .map(
          (c) => `
        <li>
          <div>${escapeHtml(c.name)}<span class="sub">${escapeHtml(c.description) || 'No description'}</span></div>
        </li>`
        )
        .join('')
    : '<p class="empty">No categories yet.</p>';

  // Fill every category dropdown, keeping the current filter choice
  const options = state.categories
    .map((c) => `<option value="${c._id}">${escapeHtml(c.name)}</option>`)
    .join('');

  $('#request-form').category.innerHTML = options;
  $('#edit-form').category.innerHTML = options;

  const filter = $('#filter-category');
  const selected = filter.value;
  filter.innerHTML = `<option value="">All categories</option>${options}`;
  filter.value = selected;
}

$('#category-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;

  try {
    await api('/categories', {
      method: 'POST',
      body: { name: form.name.value, description: form.description.value },
    });
    form.reset();
    showToast('Category added');
    await loadCategories();
  } catch (err) {
    showToast(err.message, true);
  }
});

// ---------- Start ----------

async function init() {
  try {
    await Promise.all([loadUsers(), loadCategories()]);
    await refreshRequests();
  } catch (err) {
    showToast(`Could not load data: ${err.message}`, true);
  }
}

init();
