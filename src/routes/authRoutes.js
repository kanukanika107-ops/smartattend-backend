const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');

const JWT_SECRET = process.env.JWT_SECRET || 'secretkey';

// REGISTER
router.post('/register', async (req, res) => {
  try {
    const { name, rollNo, email, semester, section, password, role, department } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    if (role === 'faculty') {
      const faculty = await Faculty.create({
        name, email, department: department || 'General', passwordHash: hashedPassword
      });
      return res.status(201).json({ message: 'Faculty registered successfully', id: faculty._id });
    }

    const student = await Student.create({
      name, rollNo, email, semester: semester || 1, section: section || 'A', passwordHash: hashedPassword
    });
    res.status(201).json({ message: 'Student registered successfully', id: student._id });

  } catch (error) {
    console.error('REGISTER ERROR:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check faculty first
    let user = await Faculty.findOne({ email });
    let role = 'faculty';

    if (!user) {
      user = await Student.findOne({ email });
      role = 'student';
    }

    if (!user) return res.status(400).json({ error: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(400).json({ error: 'Invalid password' });

    const token = jwt.sign(
      { id: user._id, email: user.email, role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role,
      }
    });

  } catch (error) {
    console.error('LOGIN ERROR:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
