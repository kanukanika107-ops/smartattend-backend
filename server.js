require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const authRoutes = require('./src/routes/authRoutes');
const sessionRoutes = require('./src/routes/sessionRoutes');
const attendanceRoutes = require('./src/routes/attendanceRoutes');
const pulseCheckRoutes = require('./src/routes/pulseCheckRoutes');
const aqsRoutes = require('./src/routes/aqsRoutes');
const authMiddleware = require('./src/middleware/authMiddleware');

const app = express();
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

app.get('/', (req, res) => res.send('SmartAttend API Running'));

app.get('/api/protected', authMiddleware, (req, res) => {
  res.json({ message: 'Protected route works', user: req.user });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));