const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 10000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

app.use(cors());
app.use(express.json());

// Create a new heat
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
    res.status(500).send('Error creating heat');
  }
});

// Get all heats (for analysis dropdown)
app.get('/api/heats', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM heats ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching heats');
  }
});

// Get logs for a specific heat
app.get('/api/heats/:heatId/logs', async (req, res) => {
  const { heatId } = req.params;
  try {
    const result = await pool.query('SELECT * FROM logs WHERE heat_id = $1', [heatId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching logs');
  }
});

// Get annotations for a specific log
app.get('/api/logs/:logId/annotations', async (req, res) => {
  const { logId } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM annotations WHERE log_id = $1 ORDER BY position',
      [logId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching annotations');
  }
});

// Save an annotation
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
  console.log(`Server running on port ${port}`);
});
