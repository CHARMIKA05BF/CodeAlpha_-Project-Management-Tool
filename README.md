# 🚀 CollabBoard — Project Management Tool

**Plan. Collaborate. Get Things Done.**

CollabBoard is a full-stack collaborative project management application inspired by tools like Trello and Asana. It helps users organize projects, manage tasks, assign responsibilities, and communicate with team members through task comments and real-time notifications.

🌐 **Live Demo:** https://project-management-tool-2leu.onrender.com/

## ✨ Features

- **User Authentication:** Register, log in, and manage user sessions.
- **Project Management:** Create and organize group projects.
- **Task Management:** Create tasks with descriptions, priorities, statuses, assignees, and due dates.
- **Task Assignment:** Assign responsibilities to team members.
- **Task Comments:** Discuss tasks and share updates within the application.
- **Real-Time Notifications:** Receive updates when project activities occur.
- **WebSocket Integration:** Support real-time notifications and updates.
- **Project Boards:** Organize tasks by status, including To Do, In Progress, and Done.
- **Responsive Interface:** Manage projects through a clean web interface.

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| HTML5 | Application structure |
| CSS3 | Styling and responsive UI |
| JavaScript | Frontend interactions and application logic |
| Node.js | Server-side runtime |
| Express.js | REST API and backend routes |
| WebSockets (`ws`) | Real-time communication |
| JSON Files | Data storage |
| Render | Application deployment |
| Git & GitHub | Version control and source management |

## 🏗️ Project Structure

```text
project-management-tool/
├── data/
│   ├── users.json
│   ├── projects.json
│   ├── tasks.json
│   └── notifications.json
├── frontend/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   └── app.js
│   └── index.html
├── server.js
├── package.json
├── package-lock.json
├── .gitignore
└── README.md
```

## ⚙️ Installation and Setup

### Prerequisites

- Node.js and npm installed
- Git installed (optional, for cloning the repository)

### 1. Clone the repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd project-management-tool
```

Replace `YOUR_GITHUB_REPOSITORY_URL` with your actual repository URL.

### 2. Install dependencies

```bash
npm install
```

### 3. Start the application

```bash
npm start
```

### 4. Open the application

Visit:

```text
http://localhost:3000
```

## 🔌 API Overview

The backend provides REST endpoints for the following operations:

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Register a user |
| POST | `/api/auth/login` | Log in |
| GET | `/api/auth/me` | Retrieve the authenticated user |
| GET | `/api/users` | Retrieve users |
| GET | `/api/projects` | List accessible projects |
| POST | `/api/projects` | Create a project |
| GET | `/api/projects/:id` | Retrieve project details |
| POST | `/api/projects/:id/tasks` | Create a task |
| PUT | `/api/tasks/:id` | Update a task |
| POST | `/api/tasks/:id/comments` | Add a task comment |
| GET | `/api/notifications` | Retrieve notifications |
| POST | `/api/notifications/read` | Mark notifications as read |
| GET | `/api/health` | Check server health |

Authenticated endpoints require a valid bearer token.

## 🔄 How It Works

1. Users register or log in to the application.
2. Authenticated users create projects and manage their project boards.
3. Tasks are created with descriptions, priorities, statuses, assignees, and due dates.
4. Team members communicate through task comments.
5. WebSocket connections deliver real-time notifications and project activity updates.

## 🚀 Deployment

The application is deployed using Render.

**Live Application:** https://project-management-tool-2leu.onrender.com/

## 🎯 Learning Outcomes

This project demonstrates practical experience with:

- Full-stack web application development
- REST API design and integration
- Authentication and session handling
- CRUD operations for projects and tasks
- Real-time communication using WebSockets
- Frontend and backend integration
- Git-based version control and cloud deployment

## 🔮 Future Enhancements

- Persistent database integration
- Stronger password hashing and session security
- Project member invitation and management
- Email notifications
- File attachments and activity history
- Improved access controls and automated testing

## 👩‍💻 Author

**Bella Gnana Charmika**

Computer Science & Engineering Student

- Live Demo: https://project-management-tool-2leu.onrender.com/
- GitHub: Add your repository URL here
- LinkedIn: Add your LinkedIn profile URL here

---

*Built to make team collaboration, task tracking, and project organization simpler.*
