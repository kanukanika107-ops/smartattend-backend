const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Student = require("../models/Student");
const Faculty = require("../models/Faculty");

console.log("AUTH ROUTES FILE LOADED");

// REGISTER
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    if (role === "faculty") {
      // Faculty register
      const existing = await Faculty.findOne({ email });
      if (existing) return res.status(400).json({ error: "Faculty already exists" });

      const faculty = new Faculty({
        name,
        email,
        passwordHash: hashedPassword
      });
      await faculty.save();

      const token = jwt.sign(
        { id: faculty._id, email: faculty.email, role: "faculty" },
        process.env.JWT_SECRET || "secretkey",
        { expiresIn: "7d" }
      );

      return res.status(201).json({ message: "Faculty registered successfully", token });

    } else {
      // Student register
      const { rollNo, semester, section } = req.body;
      const existing = await Student.findOne({ email });
      if (existing) return res.status(400).json({ error: "Student already exists" });

      const student = new Student({
        name,
        rollNo,
        email,
        semester,
        section,
        passwordHash: hashedPassword
      });
      await student.save();

      const token = jwt.sign(
        { id: student._id, email: student.email, role: "student" },
        process.env.JWT_SECRET || "secretkey",
        { expiresIn: "1h" }
      );

      return res.status(201).json({ message: "Student registered successfully", token });
    }

  } catch (error) {
    console.error("ERROR:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Pehle Faculty mein dhundo
    let user = await Faculty.findOne({ email });
    let role = "faculty";

    // Nahi mila toh Student mein dhundo
    if (!user) {
      user = await Student.findOne({ email });
      role = "student";
    }

    if (!user) return res.status(400).json({ error: "User not found" });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(400).json({ error: "Invalid password" });

    const token = jwt.sign(
      { id: user._id, email: user.email, role },
      process.env.JWT_SECRET || "secretkey",
      { expiresIn: "7d" }
    );

    res.json({ message: "Login successful", token, role });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;