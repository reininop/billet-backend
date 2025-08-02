const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(cors());
app.use(express.json());

// Get all heats
app.get('/api/heats', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM heats ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching heats');
  }
});

// Get logs for a heat
app.get('/api/heats/:heatId/logs', async (req, res) => {
  try {
    const { heatId } = req.params;
    const result = await pool.query('SELECT * FROM logs WHERE heat_id = $1 ORDER BY log_number ASC', [heatId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching logs');
  }
});

// Get annotations for a log
app.get('/api/logs/:logId/annotations', async (req, res) => {
  try {
    const { logId } = req.params;
    const result = await pool.query('SELECT * FROM annotations WHERE log_id = $1 ORDER BY position ASC', [logId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching annotations');
  }
});

// Add a new heat
app.post('/api/heats', async (req, res) => {
  const { customer, alloy, diameter, length } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO heats (customer, alloy, diameter, length) VALUES ($1, $2, $3, $4) RETURNING *',
      [customer, alloy, diameter, length]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error adding heat');
  }
});

// Add a new log to a heat
app.post('/api/logs', async (req, res) => {
  const { heat_id, log_number, diameter } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO logs (heat_id, log_number, diameter) VALUES ($1, $2, $3) RETURNING *',
      [heat_id, log_number, diameter]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error adding log');
  }
});

// Add or update an annotation
app.post('/api/logs/:logId/annotations', async (req, res) => {
  const { logId } = req.params;
  const { type, position, depth, hash, comment, inspector } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO annotations (log_id, type, position, depth, hash, comment, inspector)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [logId, type, position, depth, hash, comment, inspector]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error saving annotation');
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
