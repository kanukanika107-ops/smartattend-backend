const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { parse } = require('csv-parse/sync');

const Class = require('../models/Class');
const AcademicSession = require('../models/AcademicSession');
const Student = require('../models/Student');
const authMiddleware = require('../middleware/authMiddleware');

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildRollQuery(rollNoValue) {
  const normalized = rollNoValue ? String(rollNoValue).trim() : '';
  const query = [];
  if (normalized) {
    query.push({ rollNo: normalized });
    query.push({ rollNo: { $regex: new RegExp(`^\\s*${escapeRegex(normalized)}\\s*$`, 'i') } });
    const rollAsNumber = Number(normalized);
    if (!Number.isNaN(rollAsNumber)) {
      query.push({ rollNo: rollAsNumber });
    }
  }
  return query;
}

async function findStudentByRollNo(rollNoValue) {
  const rollQuery = buildRollQuery(rollNoValue);
  if (!rollQuery.length) {
    return null;
  }
  return Student.findOne({ $or: rollQuery });
}

function generateTempPassword() {
  return crypto.randomBytes(4).toString('hex');
}

const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'students');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.jpg' || ext === '.jpeg') {
      return cb(null, true);
    }
    return cb(new Error('Only .jpg/.jpeg files are allowed'));
  },
  limits: { fileSize: 2 * 1024 * 1024 },
});

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.csv') {
      return cb(null, true);
    }
    return cb(new Error('Only .csv files are allowed'));
  },
});

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

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ error: 'Only faculty can delete classes' });
    }

    const classDoc = await Class.findOne({ _id: req.params.id, facultyId: req.user.id });
    if (!classDoc) return res.status(404).json({ error: 'Class not found' });

    await Student.updateMany(
      { classId: classDoc._id },
      { $set: { classId: null } }
    );

    await classDoc.deleteOne();

    res.json({ message: 'Class deleted successfully', classId: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/students', authMiddleware, upload.single('photo'), async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ error: 'Only faculty can add students' });
    }

    const classDoc = await Class.findOne({ _id: req.params.id, facultyId: req.user.id });
    if (!classDoc) return res.status(404).json({ error: 'Class not found' });

    const { name, rollNo, semester, section } = req.body;
    const normalizedRollNo = rollNo ? String(rollNo).trim() : '';
    if (!name || !normalizedRollNo) {
      return res.status(400).json({ error: 'name and rollNo are required' });
    }

    const photoUrl = req.file ? `/uploads/students/${req.file.filename}` : null;
    const existingStudent = await findStudentByRollNo(normalizedRollNo);

    if (existingStudent) {
      existingStudent.name = name || existingStudent.name;
      existingStudent.semester = semester || existingStudent.semester || 1;
      existingStudent.section = section || classDoc.section;
      existingStudent.classId = classDoc._id;
      if (photoUrl) {
        existingStudent.photoUrl = photoUrl;
      }
      await existingStudent.save();

      return res.status(200).json({
        message: 'Student assigned to class',
        reused: true,
        student: {
          id: existingStudent._id,
          name: existingStudent.name,
          rollNo: existingStudent.rollNo,
          classId: existingStudent.classId,
        },
        generatedPassword: null,
      });
    }

    const plainPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const student = await Student.create({
      name,
      rollNo: normalizedRollNo,
      semester: semester || 1,
      section: section || classDoc.section,
      classId: classDoc._id,
      ...(photoUrl ? { photoUrl } : {}),
      passwordHash,
    });

    res.status(201).json({
      message: 'Student added',
      reused: false,
      student: {
        id: student._id,
        name: student.name,
        rollNo: student.rollNo,
        classId: student.classId,
      },
      generatedPassword: plainPassword,
    });
  } catch (err) {
    if (err.message && err.message.includes('Only .jpg/.jpeg files')) {
      return res.status(400).json({ error: err.message });
    }
    if (err.code === 11000) {
      try {
        const { rollNo, name, semester, section } = req.body;
        const normalizedRollNo = rollNo ? String(rollNo).trim() : '';
        if (normalizedRollNo) {
          const classDoc = await Class.findOne({ _id: req.params.id, facultyId: req.user.id });
          const existing = await findStudentByRollNo(normalizedRollNo);
          if (existing && classDoc) {
            existing.name = name || existing.name;
            existing.semester = semester || existing.semester || 1;
            existing.section = section || classDoc.section;
            existing.classId = classDoc._id;
            await existing.save();
            return res.status(200).json({
              message: 'Student assigned to class',
              reused: true,
              student: {
                id: existing._id,
                name: existing.name,
                rollNo: existing.rollNo,
                classId: existing.classId,
              },
              generatedPassword: null,
            });
          }
        }
      } catch (innerErr) {
        return res.status(500).json({ error: innerErr.message });
      }
      return res.status(400).json({ error: 'Student with same rollNo already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// POST /api/classes/:id/students/bulk
// multipart/form-data with file field "file" (CSV)
router.post('/:id/students/bulk', authMiddleware, csvUpload.single('file'), async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ error: 'Only faculty can add students' });
    }

    const classDoc = await Class.findOne({ _id: req.params.id, facultyId: req.user.id });
    if (!classDoc) return res.status(404).json({ error: 'Class not found' });

    if (!req.file) {
      return res.status(400).json({ error: 'CSV file is required (field: file)' });
    }

    const csvText = req.file.buffer.toString('utf8');
    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'CSV has no rows' });
    }

    const toInsert = [];
    const credentials = [];

    for (const row of records) {
      const name = row.name || row.Name;
      const rollNoRaw = row.rollNo || row.RollNo || row.rollno;
      const rollNo = rollNoRaw ? String(rollNoRaw).trim() : '';
      const semester = row.semester || row.Semester || 1;
      const section = row.section || row.Section || classDoc.section;
      const photoUrl = row.photoUrl || row.PhotoUrl || null;

      if (!name || !rollNo) {
        continue;
      }

      const plainPassword = generateTempPassword();
      const passwordHash = await bcrypt.hash(plainPassword, 10);

      toInsert.push({
        name,
        rollNo,
        semester,
        section,
        classId: classDoc._id,
        photoUrl,
        passwordHash,
      });

      credentials.push({ rollNo, password: plainPassword, name });
    }

    if (toInsert.length === 0) {
      return res.status(400).json({ error: 'No valid rows found (name and rollNo required)' });
    }

    let createdCount = 0;
    let errors = [];

    try {
      const result = await Student.insertMany(toInsert, { ordered: false });
      createdCount = result.length;
    } catch (err) {
      if (Array.isArray(err.writeErrors)) {
        errors = err.writeErrors.map((e) => ({
          index: e.index,
          message: e.errmsg || e.message,
        }));
        createdCount = (err.result && err.result.nInserted) || 0;
      } else {
        throw err;
      }
    }

    res.status(201).json({
      message: 'Bulk student import processed',
      created: createdCount,
      skipped: toInsert.length - createdCount,
      errors,
      credentials,
    });
  } catch (err) {
    if (err.message && err.message.includes('Only .csv files')) {
      return res.status(400).json({ error: err.message });
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
      .select('name rollNo semester section photoUrl')
      .sort({ rollNo: 1 });

    res.json({ students });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
