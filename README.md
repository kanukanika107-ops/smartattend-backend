# SmartAttend Backend API 🎓

A production-ready attendance system with AI analytics, real-time WebSocket updates, JWT auth, and QR-based attendance marking.

## 🔗 Live URL
https://smartattend-backend-5irf.onrender.com

## 📦 GitHub Repo
https://github.com/kanukanika107-ops/smartattend-backend

## 🚀 Local Setup
git clone https://github.com/kanukanika107-ops/smartattend-backend
cd smartattend-backend
npm install
npm start
Server runs on PORT 5000

## 🔧 Environment Variables
Create a .env file:
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key

## 🔐 Test Credentials
Email:    faculty@test.com
Password: 123456
Role:     faculty

## 🔑 Auth Header
Authorization: Bearer <token>

## 📡 API Endpoints

### Auth
POST /api/auth/register
POST /api/auth/login

### Sessions
POST   /api/sessions/start
GET    /api/sessions/:id/qr
POST   /api/sessions/:id/close

### Attendance
POST /api/attendance/mark

### Pulse Check
POST /api/pulse-check/create
POST /api/pulse-check/:id/trigger
POST /api/pulse-check/:id/submit

### AQS
GET /api/aqs/analytics/:subjectId
GET /api/aqs/:studentId/:subjectId

### AI
POST /api/ai/faculty-query
POST /api/ai/student-query
POST /api/ai/generate-questions

### Verify
GET /api/verify/:sessionId

## 🔌 Socket.IO Events

### Connect
const socket = io("https://smartattend-backend-5irf.onrender.com");

### Join Session
socket.emit("join-session", { sessionId: "SESSION_ID" });

### Listen Events
socket.on("attendance-update", (data) => console.log(data));
socket.on("pulse-check-triggered", (data) => console.log(data));

## ⚠️ Important Notes
- Free Render instance — pehli request 50 sec lag sakti hai
- Token 7 days mein expire hoga
- Har protected route mein Authorization header zaroori hai