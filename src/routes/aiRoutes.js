router.post('/faculty-query', authMiddleware, async (req, res) => {
  try {
    const { query } = req.body;

    const records = await AQSRecord.find()
      .populate('studentId', 'name rollNo')
      .populate('sessionId', 'subjectId startTime')
      .maxTimeMS(5000)  // ← yeh line add karo
      .lean();

    const avgAQS = records.reduce((sum, r) => sum + r.totalAQS, 0) / (records.length || 1);
    const lowPerformers = records.filter(r => r.totalAQS < 50);

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `
      You are SmartAttend AI assistant for faculty.
      Database has this attendance data:
      - Total Records: ${records.length}
      - Average AQS Score: ${Math.round(avgAQS)}
      - Low Performers (AQS < 50): ${lowPerformers.length}
      - Student Data: ${JSON.stringify(records.slice(0, 10))}
      Faculty asked: "${query}"
      Give a helpful, concise answer in 2-3 lines based on the data above.
    `;

    const result = await model.generateContent(prompt);
    const aiResponse = result.response.text();

    res.json({
      query,
      aiResponse,
      summary: `Total records: ${records.length}, Average AQS: ${Math.round(avgAQS)}`,
      lowPerformers: lowPerformers.length,
      data: records,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});