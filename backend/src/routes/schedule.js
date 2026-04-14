const express = require('express');
const router = express.Router();

const sampleSchedule = [
  { id: 1, date: '2026-04-20', time: '10:00', title: 'Video massage bau', status: 'Da len lich' },
  { id: 2, date: '2026-04-23', time: '14:00', title: 'Cach cham soc da sau sinh', status: 'Cho dang' }
];

router.get('/', (req, res) => {
  res.json(sampleSchedule);
});

router.post('/', (req, res) => {
  const newItem = req.body;
  newItem.id = sampleSchedule.length + 1;
  newItem.status = newItem.status || 'Cho dang';
  sampleSchedule.push(newItem);
  res.status(201).json(newItem);
});

module.exports = router;
