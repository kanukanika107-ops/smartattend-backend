const express = require('express');
const router = express.Router();

const Student = require('../models/Student');
const Class = require('../models/Class');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// GET /api/students
// Optional: classroomId (classId), search
router.get('/', async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ error: 'Only faculty can view students' });
    }

    const { classroomId, classId, search } = req.query;
    let targetClassId = classId || classroomId || null;

    let classIds = [];
    if (targetClassId) {
      const classDoc = await Class.findOne({ _id: targetClassId, facultyId: req.user.id });
      if (!classDoc) return res.status(404).json({ error: 'Class not found' });
      classIds = [classDoc._id];
    } else {
      const classes = await Class.find({ facultyId: req.user.id }).select('_id');
      classIds = classes.map((c) => c._id);
    }

    const filter = { classId: { $in: classIds } };
    if (search) {
      const q = String(search).trim();
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { rollNo: { $regex: q, $options: 'i' } },
      ];
    }

    const students = await Student.find(filter)
      .select('name rollNo semester section classId photoUrl')
      .sort({ createdAt: -1 });

    res.json({ students });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/students/:id
router.delete('/:id', async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ error: 'Only faculty can remove students' });
    }

    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    if (!student.classId) {
      return res.status(400).json({ error: 'Student is not assigned to any class' });
    }

    const classDoc = await Class.findOne({
      _id: student.classId,
      facultyId: req.user.id,
    });
    if (!classDoc) {
      return res.status(404).json({ error: 'Class not found' });
    }

    student.classId = null;
    await student.save();

    res.json({
      message: 'Student removed from class',
      studentId: student._id,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
