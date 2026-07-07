const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;
const rootDir = __dirname;
const dataDir = path.join(rootDir, 'data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const state = {
  users: readJson('users.json'),
  projects: readJson('projects.json'),
  tasks: readJson('tasks.json'),
  notifications: readJson('notifications.json')
};

const clients = new Set();

app.use(express.json());
app.use(express.static(path.join(rootDir, 'frontend')));

function readJson(fileName) {
  const filePath = path.join(dataDir, fileName);
  if (!fs.existsSync(filePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return [];
  }
}

function writeJson(fileName, data) {
  fs.writeFileSync(path.join(dataDir, fileName), JSON.stringify(data, null, 2));
}

function persistData() {
  writeJson('users.json', state.users);
  writeJson('projects.json', state.projects);
  writeJson('tasks.json', state.tasks);
  writeJson('notifications.json', state.notifications);
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const user = state.users.find((entry) => entry.token === token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  req.user = user;
  next();
}

function serializeTask(task) {
  const assignee = state.users.find((user) => user.id === task.assigneeId) || null;
  return {
    ...task,
    assignee,
    comments: (task.comments || []).map((comment) => ({
      ...comment,
      user: state.users.find((user) => user.id === comment.userId) || null
    }))
  };
}

function serializeProject(project) {
  return {
    ...project,
    members: (project.memberIds || []).map((id) => state.users.find((user) => user.id === id)).filter(Boolean),
    tasks: state.tasks
      .filter((task) => task.projectId === project.id)
      .map(serializeTask)
  };
}

function createNotification(userIds, message, type, payload = {}) {
  const notification = {
    id: makeId('notif'),
    userIds: Array.isArray(userIds) ? userIds : [userIds],
    message,
    type,
    payload,
    createdAt: new Date().toISOString(),
    read: false
  };

  state.notifications.push(notification);
  persistData();

  const payloadToSend = { type: 'notification', notification };
  clients.forEach((client) => {
    if (!client.userId) return;
    if (notification.userIds.includes(client.userId)) {
      client.send(JSON.stringify(payloadToSend));
    }
  });
}

function broadcastUpdate(message, extra = {}) {
  const payload = { type: 'update', message, ...extra };
  clients.forEach((client) => client.send(JSON.stringify(payload)));
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Project management tool API is running' });
});

app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  const existingUser = state.users.find((user) => user.email.toLowerCase() === email.toLowerCase());
  if (existingUser) {
    return res.status(409).json({ error: 'A user with that email already exists' });
  }

  const user = {
    id: makeId('user'),
    name,
    email,
    password: hashPassword(password),
    token: makeId('token'),
    createdAt: new Date().toISOString()
  };

  state.users.push(user);
  persistData();

  res.json({ user: { id: user.id, name: user.name, email: user.email, token: user.token }, message: 'Registration successful' });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = state.users.find((entry) => entry.email.toLowerCase() === email.toLowerCase() && entry.password === hashPassword(password));
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  user.token = makeId('token');
  persistData();

  res.json({ user: { id: user.id, name: user.name, email: user.email, token: user.token }, message: 'Login successful' });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: { id: req.user.id, name: req.user.name, email: req.user.email } });
});

app.get('/api/users', requireAuth, (req, res) => {
  res.json({ users: state.users.map((user) => ({ id: user.id, name: user.name, email: user.email })) });
});

app.get('/api/projects', requireAuth, (req, res) => {
  const userProjects = state.projects.filter((project) => (project.memberIds || []).includes(req.user.id));
  res.json({ projects: userProjects.map(serializeProject) });
});

app.post('/api/projects', requireAuth, (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  const project = {
    id: makeId('project'),
    name,
    description: description || '',
    ownerId: req.user.id,
    memberIds: [req.user.id],
    status: 'Active',
    createdAt: new Date().toISOString()
  };

  state.projects.push(project);
  persistData();
  createNotification([req.user.id], `Project "${project.name}" created`, 'project');
  broadcastUpdate(`Project "${project.name}" created`);

  res.status(201).json({ project: serializeProject(project) });
});

app.get('/api/projects/:id', requireAuth, (req, res) => {
  const project = state.projects.find((entry) => entry.id === req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  if (!(project.memberIds || []).includes(req.user.id)) {
    return res.status(403).json({ error: 'You do not have access to this project' });
  }

  res.json({ project: serializeProject(project) });
});

app.post('/api/projects/:id/tasks', requireAuth, (req, res) => {
  const project = state.projects.find((entry) => entry.id === req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const { title, description, assigneeId, status, priority, dueDate } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Task title is required' });
  }

  const task = {
    id: makeId('task'),
    projectId: project.id,
    title,
    description: description || '',
    assigneeId: assigneeId || null,
    status: status || 'todo',
    priority: priority || 'medium',
    dueDate: dueDate || '',
    createdAt: new Date().toISOString(),
    comments: []
  };

  state.tasks.push(task);
  persistData();

  const targetUsers = (project.memberIds || []).filter((memberId) => memberId !== req.user.id);
  if (assigneeId && targetUsers.includes(assigneeId)) {
    targetUsers.push(assigneeId);
  }
  createNotification(targetUsers.length ? targetUsers : [req.user.id], `Task "${task.title}" created`, 'task', { projectId: project.id, taskId: task.id });
  broadcastUpdate(`Task "${task.title}" added to ${project.name}`);

  res.status(201).json({ task: serializeTask(task) });
});

app.put('/api/tasks/:id', requireAuth, (req, res) => {
  const task = state.tasks.find((entry) => entry.id === req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const project = state.projects.find((entry) => entry.id === task.projectId);
  if (!project || !(project.memberIds || []).includes(req.user.id)) {
    return res.status(403).json({ error: 'You cannot update this task' });
  }

  const updateFields = ['title', 'description', 'assigneeId', 'status', 'priority', 'dueDate'];
  updateFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      task[field] = req.body[field];
    }
  });

  persistData();
  createNotification((project.memberIds || []).filter((memberId) => memberId !== req.user.id), `Task "${task.title}" updated`, 'task', { projectId: project.id, taskId: task.id });
  broadcastUpdate(`Task "${task.title}" updated`);

  res.json({ task: serializeTask(task) });
});

app.post('/api/tasks/:id/comments', requireAuth, (req, res) => {
  const task = state.tasks.find((entry) => entry.id === req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const project = state.projects.find((entry) => entry.id === task.projectId);
  if (!project || !(project.memberIds || []).includes(req.user.id)) {
    return res.status(403).json({ error: 'You cannot comment on this task' });
  }

  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Comment text is required' });
  }

  const comment = {
    id: makeId('comment'),
    userId: req.user.id,
    text,
    createdAt: new Date().toISOString()
  };

  task.comments.push(comment);
  persistData();

  createNotification((project.memberIds || []).filter((memberId) => memberId !== req.user.id), `New comment on "${task.title}"`, 'comment', { projectId: project.id, taskId: task.id });
  broadcastUpdate(`New comment added to ${task.title}`);

  res.status(201).json({ comment: serializeTask(task).comments.at(-1) });
});

app.get('/api/notifications', requireAuth, (req, res) => {
  const userNotifications = state.notifications.filter((notification) => (notification.userIds || []).includes(req.user.id));
  res.json({ notifications: userNotifications.slice(-15).reverse() });
});

app.post('/api/notifications/read', requireAuth, (req, res) => {
  state.notifications.forEach((notification) => {
    if ((notification.userIds || []).includes(req.user.id)) {
      notification.read = true;
    }
  });
  persistData();
  res.json({ message: 'Notifications marked as read' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(rootDir, 'frontend', 'index.html'));
});

const server = app.listen(PORT, () => {
  console.log(`Project management tool running on http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'auth' && data.token) {
        const user = state.users.find((entry) => entry.token === data.token);
        if (user) {
          ws.userId = user.id;
        }
      }
    } catch (error) {
      // ignore malformed websocket payloads
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
  });
});
