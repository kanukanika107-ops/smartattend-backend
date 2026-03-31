# SmartAttend Backend API

SmartAttend backend for attendance sessions, QR-based marking, pulse checks, AQS analytics, AI-assisted queries, and verification proof flow.

## Live URL

https://smartattend-backend-5irf.onrender.com

## GitHub Repo

https://github.com/kanukanika107-ops/smartattend-backend

## Tech Stack

- Node.js
- Express.js
- MongoDB Atlas + Mongoose
- Socket.IO
- JWT authentication
- Google Gemini API
- Render deployment

## Local Setup

```bash
git clone https://github.com/kanukanika107-ops/smartattend-backend
cd smartattend-backend
npm install
npm start
```

Server runs on `PORT=5000` locally by default.

## Environment Variables

Create a `.env` file:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
GEMINI_API_KEY=your_gemini_api_key
MONGO_VECTOR_INDEX=aqs_embedding_index
BLOCKCHAIN_SALT=optional_local_proof_salt
```

## Test Credentials

Faculty:

- Email: `faculty@test.com`
- Password: `123456`

Sample student used during testing:

- Email: `student@test.com`
- Password: `123456`

## Auth Header

Use this for protected routes:

```text
Authorization: Bearer <token>
```

## API Endpoints

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`

### Sessions

- `GET /api/sessions`
- `GET /api/sessions/:id`
- `POST /api/sessions/start`
- `GET /api/sessions/:id/qr`
- `POST /api/sessions/:id/close`

### Attendance

- `POST /api/attendance/mark`
- `GET /api/attendance/:sessionId`

### Pulse Check

- `POST /api/pulse-check/create`
- `PUT /api/pulse-check/:id/questions`
- `POST /api/pulse-check/:id/approve`
- `POST /api/pulse-check/:id/trigger`
- `POST /api/pulse-check/:id/submit`

### AQS

- `GET /api/aqs/analytics/:subjectId`
- `GET /api/aqs/:studentId/:subjectId`
- `POST /api/aqs/rebuild/:sessionId`
- `POST /api/aqs/rebuild-all`

### Academic Sessions

- `POST /api/academic-sessions`
- `GET /api/academic-sessions`

### AI

- `POST /api/ai/sync-embeddings`
- `POST /api/ai/faculty-query`
- `POST /api/ai/student-query`
- `POST /api/ai/generate-questions`

### Verify

- `GET /api/verify/:sessionId`

## AI and Embeddings Flow

Implemented backend flow:

1. Attendance and AQS records are created from session activity.
2. `POST /api/ai/sync-embeddings` generates embeddings for AQS records.
3. Faculty and student AI routes try vector retrieval first.
4. If vector search is unavailable, backend falls back to recent analytics records.
5. If AI text generation fails, backend returns a safe fallback summary instead of crashing.

## Pulse Check Approval Flow

1. Teacher creates quiz questions (manual or AI-generated).
2. Teacher reviews and edits questions.
3. Teacher approves questions.
4. Only approved questions can be triggered for students.

## Verification / Blockchain Proof

The project currently stores a blockchain-style verification proof for each closed session:

- session payload is hashed
- proof is stored in `BlockchainProof`
- `blockchainTxHash` is saved on the session
- `GET /api/verify/:sessionId` verifies the stored proof against recalculated session data

Note: this is a local proof/hash verification flow, not a live on-chain blockchain integration.

## Socket.IO Events

### Connect

```js
const socket = io("https://smartattend-backend-5irf.onrender.com");
```

### Join Session

```js
socket.emit("join-session", "SESSION_ID");
```

### Listen Events

```js
socket.on("attendance-update", (data) => console.log(data));
socket.on("new-quiz", (data) => console.log(data));
```

## Current Status

Completed and working:

- JWT auth
- sessions
- QR rotation
- attendance marking
- pulse check routes
- AQS calculation and rebuild
- AI routes
- embedding sync
- Render deployment
- verification proof route

## Important Notes

- Render free instance may take time to wake up on the first request.
- Protected routes require `Authorization: Bearer <token>`.
- Vector search can fall back to normal analytics retrieval if Atlas vector search is unavailable.
- Railway was mentioned in planning docs, but the live deployment is on Render.
