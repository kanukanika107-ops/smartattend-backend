const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const Class = require('../models/Class');
const AcademicSession = require('../models/AcademicSession');
const Student = require('../models/Student');
const authMiddleware = require('../middleware/authMiddleware');

function generateTempPassword() {
  return crypto.randomBytes(4).toString('hex');
}

router.post('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ error: 'Only faculty can create classes' });
    }

    const { academicSession, academicSessionId, subjectName, classCode, section } = req.body;
    if ((!academicSession && !academicSessionId) || !subjectName || !classCode) {
      return res.status(400).json({ error: 'academicSession or academicSessionId, subjectName, and classCode are required' });
    }

    let sessionLabel = academicSession || null;
    let sessionRef = null;

    if (academicSessionId) {
      const sessionDoc = await AcademicSession.findOne({ _id: academicSessionId, facultyId: req.user.id });
      if (!sessionDoc) {
        return res.status(404).json({ error: 'Academic session not found' });
      }
      sessionLabel = sessionDoc.label;
      sessionRef = sessionDoc._id;
    }

    const created = await Class.create({
      academicSession: sessionLabel,
      academicSessionId: sessionRef,
      subjectName,
      classCode,
      section: section || 'A',
      facultyId: req.user.id,
    });

    res.status(201).json({ message: 'Class created', class: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ error: 'Only faculty can view classes' });
    }

    const classes = await Class.find({ facultyId: req.user.id }).sort({ createdAt: -1 });
    res.json({ classes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ error: 'Only faculty can view classes' });
    }

    const classDoc = await Class.findOne({ _id: req.params.id, facultyId: req.user.id });
    if (!classDoc) return res.status(404).json({ error: 'Class not found' });

    res.json({ class: classDoc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/students', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ error: 'Only faculty can add students' });
    }

    const classDoc = await Class.findOne({ _id: req.params.id, facultyId: req.user.id });
    if (!classDoc) return res.status(404).json({ error: 'Class not found' });

    const { name, rollNo, email, semester, section, photoUrl, parentPhone, parentEmail } = req.body;
    if (!name || !rollNo) {
      return res.status(400).json({ error: 'name and rollNo are required' });
    }

    const plainPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const student = await Student.create({
      name,
      rollNo,
      email: email || `${rollNo}@smartattend.local`,
      semester: semester || 1,
      section: section || classDoc.section,
      classId: classDoc._id,
      photoUrl: photoUrl || null,
      parentPhone,
      parentEmail,
      passwordHash,
    });

    res.status(201).json({
      message: 'Student added',
      student: {
        id: student._id,
        name: student.name,
        rollNo: student.rollNo,
        email: student.email,
        classId: student.classId,
      },
      generatedPassword: plainPassword,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Student with same rollNo or email already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/students', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ error: 'Only faculty can view students' });
    }

    const classDoc = await Class.findOne({ _id: req.params.id, facultyId: req.user.id });
    if (!classDoc) return res.status(404).json({ error: 'Class not found' });

    const students = await Student.find({ classId: classDoc._id })
      .select('name rollNo email semester section photoUrl')
      .sort({ rollNo: 1 });

    res.json({ students });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
