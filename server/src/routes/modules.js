const express = require('express');
const { getAllModuleTypes } = require('../db');

const router = express.Router();

// GET / - list all module types (no auth required)
router.get('/', (req, res) => {
  try {
    const modules = getAllModuleTypes();
    res.json(modules);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
