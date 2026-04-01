
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
const verifyRoutes = require('./src/routes/verifyRoutes');
const classRoutes = require('./src/routes/classRoutes');
const academicSessionRoutes = require('./src/routes/academicSessionRoutes');
const studentRoutes = require('./src/routes/studentRoutes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));

app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/pulse-check', pulseCheckRoutes);
app.use('/api/aqs', aqsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/verify', verifyRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/academic-sessions', academicSessionRoutes);
app.use('/api/students', studentRoutes);

app.get('/', (req, res) => res.send('SmartAttend API Running'));

// Socket.IO
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-session', (sessionId) => {
    socket.join(sessionId);
    console.log(`User joined session: ${sessionId}`);
  });

  socket.on('attendance-marked', (data) => {
    io.to(data.sessionId).emit('attendance-update', {
      sessionId: data.sessionId,
      studentId: data.studentId,
      studentName: data.studentName,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on('pulse-check-triggered', (data) => {
    io.to(data.sessionId).emit('new-quiz', {
      sessionId: data.sessionId,
      pulseCheckId: data.pulseCheckId,
      questions: data.questions,
      durationSec: data.durationSec,
      expiresAt: data.expiresAt,
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
