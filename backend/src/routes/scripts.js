const express = require('express');
const router = express.Router();
const { generateScriptFromIdea } = require('../services/aiService');

router.post('/generate', async (req, res) => {
  const { idea, tone = 'than thien', duration = 90, provider = 'gemini' } = req.body;

  if (!idea || !idea.title) {
    return res.status(400).json({ error: 'Idea phai duoc gui len de tao kich ban.' });
  }

  try {
    const generated = await generateScriptFromIdea(idea, tone, duration, provider);
    res.json(generated);
  } catch (error) {
    console.error('Script generation error:', error);
    res.status(500).json({ error: 'Khong the tao kich ban vao luc nay.' });
  }
});

module.exports = router;
