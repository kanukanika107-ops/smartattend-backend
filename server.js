require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const authRoutes = require('./src/routes/authRoutes');
const sessionRoutes = require('./src/routes/sessionRoutes');
const attendanceRoutes = require('./src/routes/attendanceRoutes');
const pulseCheckRoutes = require('./src/routes/pulseCheckRoutes');
const aqsRoutes = require('./src/routes/aqsRoutes');
const aiRoutes = require('./src/routes/aiRoutes');
const authMiddleware = require('./src/middleware/authMiddleware');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));

app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/pulse-check', pulseCheckRoutes);
app.use('/api/aqs', aqsRoutes);
app.use('/api/ai', aiRoutes);

// Socket.IO real-time events
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-session', (sessionId) => {
    socket.join(sessionId);
    console.log(`User joined session: ${sessionId}`);
  });

  socket.on('attendance-marked', (data) => {
    io.to(data.sessionId).emit('attendance-update', data);
  });

  socket.on('pulse-check-triggered', (data) => {
    io.to(data.sessionId).emit('new-quiz', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

app.get('/', (req, res) => res.send('SmartAttend API Running'));

app.get('/api/protected', authMiddleware, (req, res) => {
  res.json({ message: 'Protected route works', user: req.user });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));