const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3001;

// ✅ CORS setup to allow local dev and optional production frontend
app.use(cors({
  origin: ['http://localhost:5173', 'https://billet-frontend.onrender.com'],
  credentials: true
}));

app.use(express.json());

// ✅ PostgreSQL connection pool using DATABASE_URL from environment
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// ✅ GET all annotations for a given log
app.get('/api/logs/:logId/annotations', async (req, res) => {
  try {
    const { logId } = req.params;
    const result = await pool.query('SELECT * FROM annotations WHERE log_id = $1', [logId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching annotations:', err);
    res.status(500).json({ error: 'Failed to fetch annotations' });
  }
});

// ✅ POST a new annotation
app.post('/api/annotations', async (req, res) => {
  try {
    const { log_id, type, position, depth, hash, comment, inspector } = req.body;
    const result = await pool.query(
      `INSERT INTO annotations (log_id, type, position, depth, hash, comment, inspector)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [log_id, type, position, depth, hash, comment, inspector]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error inserting annotation:', err);
    res.status(500).json({ error: 'Failed to insert annotation' });
  }
});

// ✅ DELETE an annotation by ID
app.delete('/api/annotations/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM annotations WHERE id = $1', [req.params.id]);
    res.sendStatus(204);
  } catch (err) {
    console.error('Error deleting annotation:', err);
    res.status(500).json({ error: 'Failed to delete annotation' });
  }
});

// ✅ Health check endpoint
app.get('/', (req, res) => {
  res.send('Billet backend is running');
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
