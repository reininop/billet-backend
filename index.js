const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Routes
app.get('/api/logs/:logId/annotations', async (req, res) => {
  const { logId } = req.params;
  const result = await pool.query('SELECT * FROM annotations WHERE log_id = $1', [logId]);
  res.json(result.rows);
});

app.post('/api/annotations', async (req, res) => {
  const { log_id, type, position, depth, hash, comment, inspector } = req.body;
  const result = await pool.query(
    `INSERT INTO annotations (log_id, type, position, depth, hash, comment, inspector)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [log_id, type, position, depth, hash, comment, inspector]
  );
  res.json(result.rows[0]);
});

app.delete('/api/annotations/:id', async (req, res) => {
  await pool.query('DELETE FROM annotations WHERE id = $1', [req.params.id]);
  res.sendStatus(204);
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
