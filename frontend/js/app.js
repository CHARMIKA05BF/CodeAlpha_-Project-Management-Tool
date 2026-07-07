const state = {
  token: localStorage.getItem('collabboard-token') || '',
  user: null,
  projects: [],
  users: [],
  notifications: [],
  selectedProjectId: null,
  selectedTaskId: null,
  socket: null
};

const elements = {
  authScreen: document.getElementById('authScreen'),
  appShell: document.getElementById('appShell'),
  loginForm: document.getElementById('loginForm'),
  registerForm: document.getElementById('registerForm'),
  projectForm: document.getElementById('projectForm'),
  taskForm: document.getElementById('taskForm'),
  projectList: document.getElementById('projectList'),
  notificationList: document.getElementById('notificationList'),
  projectEmpty: document.getElementById('projectEmpty'),
  projectBoardSection: document.getElementById('projectBoardSection'),
  boardGrid: document.getElementById('boardGrid'),
  projectTitle: document.getElementById('projectTitle'),
  projectSubtitle: document.getElementById('projectSubtitle'),
  taskDetail: document.getElementById('taskDetail'),
  userLabel: document.getElementById('userLabel'),
  logoutBtn: document.getElementById('logoutBtn'),
  markReadBtn: document.getElementById('markReadBtn'),
  toast: document.getElementById('toast')
};

function init() {
  bindAuthTabs();
  bindForms();
  if (state.token) {
    bootApp().catch((error) => {
      // If boot fails (e.g., invalid token), clear it and show auth
      console.error('Boot failed:', error);
      localStorage.removeItem('collabboard-token');
      state.token = '';
      showAuth();
    });
  } else {
    showAuth();
  }
}

function bindAuthTabs() {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((entry) => entry.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.auth-form').forEach((entry) => entry.classList.remove('active'));
      document.getElementById(`${tab.dataset.view}Form`).classList.add('active');
    });
  });
}

function bindForms() {
  elements.loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
      email: document.getElementById('loginEmail').value,
      password: document.getElementById('loginPassword').value
    };
    try {
      const result = await api('/auth/login', { method: 'POST', body: JSON.stringify(payload) });
      setSession(result.user);
      showToast('Logged in successfully');
      await bootApp();
    } catch (error) {
      showToast(error.message);
    }
  });

  elements.registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
      name: document.getElementById('registerName').value,
      email: document.getElementById('registerEmail').value,
      password: document.getElementById('registerPassword').value
    };
    try {
      const result = await api('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
      document.getElementById('registerName').value = '';
      document.getElementById('registerEmail').value = '';
      document.getElementById('registerPassword').value = '';
      showToast('Account created successfully! Please login.');
      // Switch to login form
      document.querySelectorAll('.tab').forEach((tab) => tab.classList.remove('active'));
      document.querySelector('[data-view="login"]').classList.add('active');
      document.querySelectorAll('.auth-form').forEach((form) => form.classList.remove('active'));
      document.getElementById('loginForm').classList.add('active');
      // Pre-fill email
      document.getElementById('loginEmail').value = payload.email;
    } catch (error) {
      showToast(error.message);
    }
  });

  elements.projectForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
      name: document.getElementById('projectName').value,
      description: document.getElementById('projectDescription').value
    };
    try {
      const result = await api('/projects', { method: 'POST', body: JSON.stringify(payload) });
      document.getElementById('projectName').value = '';
      document.getElementById('projectDescription').value = '';
      state.projects.unshift(result.project);
      renderProjects();
      selectProject(result.project.id);
      showToast('Project created');
    } catch (error) {
      showToast(error.message);
    }
  });

  elements.taskForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!state.selectedProjectId) return;
    const payload = {
      title: document.getElementById('taskTitle').value,
      description: document.getElementById('taskDescription').value,
      assigneeId: document.getElementById('taskAssignee').value || null,
      status: document.getElementById('taskStatus').value,
      priority: document.getElementById('taskPriority').value,
      dueDate: document.getElementById('taskDueDate').value
    };
    try {
      const result = await api(`/projects/${state.selectedProjectId}/tasks`, { method: 'POST', body: JSON.stringify(payload) });
      document.getElementById('taskTitle').value = '';
      document.getElementById('taskDescription').value = '';
      document.getElementById('taskDueDate').value = '';
      const project = state.projects.find((entry) => entry.id === state.selectedProjectId);
      if (project) {
        project.tasks.push(result.task);
      }
      renderBoard();
      selectTask(result.task.id);
      showToast('Task created');
    } catch (error) {
      showToast(error.message);
    }
  });

  elements.logoutBtn.addEventListener('click', logout);
  elements.markReadBtn.addEventListener('click', async () => {
    try {
      await api('/notifications/read', { method: 'POST' });
      await loadNotifications();
      showToast('Notifications marked as read');
    } catch (error) {
      showToast(error.message);
    }
  });
}

async function bootApp() {
  try {
    await Promise.all([loadUser(), loadUsers(), loadProjects(), loadNotifications()]);
    showApp();
    connectSocket();
    if (state.projects.length) {
      selectProject(state.projects[0].id);
    }
  } catch (error) {
    console.error('Boot error:', error);
    // Clear invalid token and return to auth
    localStorage.removeItem('collabboard-token');
    state.token = '';
    state.user = null;
    showAuth();
    showToast(error.message || 'Session expired. Please login again.');
  }
}

async function loadUser() {
  const result = await api('/auth/me');
  state.user = result.user;
  elements.userLabel.textContent = state.user.name;
}

async function loadUsers() {
  const result = await api('/users');
  state.users = result.users;
  populateAssigneeOptions();
}

async function loadProjects() {
  const result = await api('/projects');
  state.projects = result.projects || [];
  renderProjects();
  if (state.selectedProjectId) {
    const stillExists = state.projects.some((project) => project.id === state.selectedProjectId);
    if (!stillExists) {
      state.selectedProjectId = null;
      state.selectedTaskId = null;
    }
  }
  renderBoard();
}

async function loadNotifications() {
  const result = await api('/notifications');
  state.notifications = result.notifications || [];
  renderNotifications();
}

function populateAssigneeOptions() {
  const select = document.getElementById('taskAssignee');
  select.innerHTML = '<option value="">Unassigned</option>';
  state.users.forEach((user) => {
    const option = document.createElement('option');
    option.value = user.id;
    option.textContent = user.name;
    select.appendChild(option);
  });
}

function renderProjects() {
  elements.projectList.innerHTML = '';
  if (!state.projects.length) {
    elements.projectList.innerHTML = '<p>No projects yet. Create one to get started.</p>';
    return;
  }

  state.projects.forEach((project) => {
    const item = document.createElement('button');
    item.className = `project-item ${state.selectedProjectId === project.id ? 'active' : ''}`;
    item.innerHTML = `<h4>${escapeHtml(project.name)}</h4><p>${escapeHtml(project.description || 'No description')}</p>`;
    item.addEventListener('click', () => selectProject(project.id));
    elements.projectList.appendChild(item);
  });
}

function renderBoard() {
  if (!state.selectedProjectId) {
    elements.projectEmpty.hidden = false;
    elements.projectBoardSection.hidden = true;
    elements.taskDetail.innerHTML = '<p>Select a task to inspect comments and update it.</p>';
    return;
  }

  elements.projectEmpty.hidden = true;
  elements.projectBoardSection.hidden = false;
  const project = state.projects.find((entry) => entry.id === state.selectedProjectId);
  if (!project) return;

  elements.projectTitle.textContent = project.name;
  elements.projectSubtitle.textContent = project.description || 'Collaborate and track work';

  const columns = {
    todo: [],
    inprogress: [],
    done: []
  };

  (project.tasks || []).forEach((task) => {
    columns[task.status] ? columns[task.status].push(task) : columns.todo.push(task);
  });

  elements.boardGrid.innerHTML = '';
  Object.entries(columns).forEach(([key, tasks]) => {
    const column = document.createElement('div');
    column.className = 'board-column';
    const header = document.createElement('h4');
    header.textContent = formatStatus(key);
    column.appendChild(header);
    tasks.forEach((task) => {
      const card = document.createElement('div');
      card.className = `task-card ${state.selectedTaskId === task.id ? 'active' : ''}`;
      card.innerHTML = `
        <h5>${escapeHtml(task.title)}</h5>
        <p>${escapeHtml(task.description || 'No description')}</p>
        <div><span class="badge ${task.priority || 'medium'}">${escapeHtml(task.priority || 'medium')}</span><span class="badge">${escapeHtml(task.assignee ? task.assignee.name : 'Unassigned')}</span></div>
      `;
      card.addEventListener('click', () => selectTask(task.id));
      column.appendChild(card);
    });
    elements.boardGrid.appendChild(column);
  });

  if (state.selectedTaskId) {
    const task = (project.tasks || []).find((entry) => entry.id === state.selectedTaskId);
    if (task) {
      renderTaskDetail(task);
    }
  }
}

function renderTaskDetail(task) {
  const assignee = task.assignee ? task.assignee.name : 'Unassigned';
  elements.taskDetail.innerHTML = `
    <h4>${escapeHtml(task.title)}</h4>
    <p>${escapeHtml(task.description || 'No description')}</p>
    <p><strong>Assignee:</strong> ${escapeHtml(assignee)}</p>
    <p><strong>Status:</strong> ${escapeHtml(formatStatus(task.status))}</p>
    <p><strong>Priority:</strong> ${escapeHtml(task.priority || 'medium')}</p>
    <p><strong>Due:</strong> ${escapeHtml(task.dueDate || 'No due date')}</p>
    <div class="comment-list">
      ${(task.comments || []).map((comment) => `
        <div class="comment-item">
          <strong>${escapeHtml(comment.user?.name || 'Member')}</strong>
          <div>${escapeHtml(comment.text)}</div>
        </div>
      `).join('') || '<p>No comments yet.</p>'}
    </div>
    <form id="commentForm" class="task-form">
      <textarea id="commentText" placeholder="Add a comment"></textarea>
      <button type="submit">Comment</button>
    </form>
    <form id="taskUpdateForm" class="task-form">
      <select id="updateStatus"><option value="todo">To Do</option><option value="inprogress">In Progress</option><option value="done">Done</option></select>
      <select id="updateAssignee"></select>
      <select id="updatePriority"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>
      <button type="submit">Update</button>
    </form>
  `;
  const updateAssignee = document.getElementById('updateAssignee');
  updateAssignee.innerHTML = '<option value="">Unassigned</option>';
  state.users.forEach((user) => {
    const option = document.createElement('option');
    option.value = user.id;
    option.textContent = user.name;
    if (task.assigneeId === user.id) option.selected = true;
    updateAssignee.appendChild(option);
  });
  document.getElementById('updateStatus').value = task.status;
  document.getElementById('updatePriority').value = task.priority || 'medium';
  document.getElementById('commentForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = document.getElementById('commentText').value;
    if (!text) return;
    try {
      await api(`/tasks/${task.id}/comments`, { method: 'POST', body: JSON.stringify({ text }) });
      document.getElementById('commentText').value = '';
      await loadProjects();
      showToast('Comment added');
    } catch (error) {
      showToast(error.message);
    }
  });
  document.getElementById('taskUpdateForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await api(`/tasks/${task.id}`, { method: 'PUT', body: JSON.stringify({ status: document.getElementById('updateStatus').value, assigneeId: document.getElementById('updateAssignee').value || null, priority: document.getElementById('updatePriority').value }) });
      await loadProjects();
      showToast('Task updated');
    } catch (error) {
      showToast(error.message);
    }
  });
}

function selectProject(projectId) {
  state.selectedProjectId = projectId;
  state.selectedTaskId = null;
  renderProjects();
  renderBoard();
}

function selectTask(taskId) {
  state.selectedTaskId = taskId;
  const project = state.projects.find((entry) => entry.id === state.selectedProjectId);
  if (!project) return;
  const task = (project.tasks || []).find((entry) => entry.id === taskId);
  if (task) {
    renderTaskDetail(task);
    renderBoard();
  }
}

function renderNotifications() {
  elements.notificationList.innerHTML = '';
  if (!state.notifications.length) {
    elements.notificationList.innerHTML = '<p>No notifications yet.</p>';
    return;
  }
  state.notifications.forEach((notification) => {
    const entry = document.createElement('div');
    entry.className = 'notification-item';
    entry.innerHTML = `<h4>${escapeHtml(notification.type)}</h4><p>${escapeHtml(notification.message)}</p>`;
    elements.notificationList.appendChild(entry);
  });
}

function showAuth() {
  elements.authScreen.hidden = false;
  elements.appShell.hidden = true;
}

function showApp() {
  elements.authScreen.hidden = true;
  elements.appShell.hidden = false;
}

function setSession(user) {
  state.token = user.token;
  state.user = user;
  localStorage.setItem('collabboard-token', user.token);
}

async function logout() {
  localStorage.removeItem('collabboard-token');
  state.token = '';
  state.user = null;
  state.projects = [];
  state.notifications = [];
  if (state.socket) {
    state.socket.close();
    state.socket = null;
  }
  // Clear form fields
  document.getElementById('loginEmail').value = '';
  document.getElementById('loginPassword').value = '';
  document.getElementById('registerName').value = '';
  document.getElementById('registerEmail').value = '';
  document.getElementById('registerPassword').value = '';
  // Show login form
  document.querySelectorAll('.tab').forEach((tab) => tab.classList.remove('active'));
  document.querySelector('[data-view="login"]').classList.add('active');
  document.querySelectorAll('.auth-form').forEach((form) => form.classList.remove('active'));
  document.getElementById('loginForm').classList.add('active');
  showToast('You have been logged out');
  showAuth();
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }
  const response = await fetch(`/api${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

function connectSocket() {
  if (state.socket) return;
  state.socket = new WebSocket(`ws://${window.location.host}`);
  state.socket.addEventListener('open', () => {
    if (state.token) {
      state.socket.send(JSON.stringify({ type: 'auth', token: state.token }));
    }
  });
  state.socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'notification') {
      state.notifications.unshift(data.notification);
      renderNotifications();
      showToast(data.notification.message);
    } else if (data.type === 'update') {
      showToast(data.message);
      loadProjects();
      loadNotifications();
    }
  });
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => {
    elements.toast.classList.remove('show');
  }, 2200);
}

function formatStatus(status) {
  const map = {
    todo: 'To Do',
    inprogress: 'In Progress',
    done: 'Done'
  };
  return map[status] || 'To Do';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

init();
