const express = require('express');
const cors = require('cors');
const app = express();
const pool = require('./db'); // Assuming you're using pg and have this setup

app.use(cors());
app.use(express.json());

// Fetch all heats
app.get('/api/heats', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM heats ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch logs for a heat
app.get('/api/heats/:heatId/logs', async (req, res) => {
  const { heatId } = req.params;
  try {
    const result = await pool.query('SELECT * FROM logs WHERE heat_id = $1', [heatId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch annotations for a log
app.get('/api/logs/:logId/annotations', async (req, res) => {
  const { logId } = req.params;
  try {
    const result = await pool.query('SELECT * FROM annotations WHERE log_id = $1', [logId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add new heat (for data entry mode)
app.post('/api/heats', async (req, res) => {
  const { customer, alloy, diameter, length } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO heats (customer, alloy, diameter, length) VALUES ($1, $2, $3, $4) RETURNING *',
      [customer, alloy, diameter, length]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add new log
app.post('/api/logs', async (req, res) => {
  const { heat_id, log_number } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO logs (heat_id, log_number) VALUES ($1, $2) RETURNING *',
      [heat_id, log_number]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add new annotation
app.post('/api/logs/:logId/annotations', async (req, res) => {
  const { logId } = req.params;
  const { type, position, note } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO annotations (log_id, type, position, note) VALUES ($1, $2, $3, $4) RETURNING *',
      [logId, type, position, note]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
