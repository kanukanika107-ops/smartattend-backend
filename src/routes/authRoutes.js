const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const Student = require("../models/Student");

console.log("AUTH ROUTES FILE LOADED");

// REGISTER
router.post("/register", async (req, res) => {
  try {
    const { name, rollNo, email, semester, section, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const newStudent = new Student({
      name,
      rollNo,
      email,
      semester,
      section,
      passwordHash: hashedPassword
    });

    await newStudent.save();

    res.status(201).json({ message: "Student registered successfully" });

  } catch (error) {
    console.error("ERROR:", error.message);
    res.status(500).json({ error: error.message });
  }
});


// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const student = await Student.findOne({ email });

    if (!student) {
      return res.status(400).json({ error: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, student.passwordHash);

    if (!isMatch) {
      return res.status(400).json({ error: "Invalid password" });
    }

    // ✅ FINAL JWT (FIXED)
    const token = jwt.sign(
      { id: student._id, email: student.email },
      "secretkey",
      { expiresIn: "1h" }
    );

    res.json({
      message: "Login successful",
      token: token
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;