const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// GET all heats
app.get("/api/heats", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM heats ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching heats:", err);
    res.status(500).send("Internal Server Error");
  }
});

// POST create new heat
app.post("/api/heats", async (req, res) => {
  const { heat_number, customer, alloy, diameter, length } = req.body;

  if (!/^A\d{7}$/.test(heat_number)) {
    return res.status(400).json({ error: "Invalid heat number format. Must be 'A' followed by 7 digits." });
  }

  try {
    const insertResult = await pool.query(
      "INSERT INTO heats (heat_number, customer, alloy, diameter, length) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [heat_number, customer || '', alloy || '', diameter || null, length || null]
    );
    res.status(201).json(insertResult.rows[0]);
  } catch (err) {
    console.error("Error creating new heat:", err);
    res.status(500).json({ error: "Failed to create heat" });
  }
});

// PUT update existing heat
app.put("/api/heats/:heat_number", async (req, res) => {
  const { heat_number } = req.params;
  const { customer, alloy, diameter, length } = req.body;

  try {
    await pool.query(
      `UPDATE heats SET customer = $1, alloy = $2, diameter = $3, length = $4 WHERE heat_number = $5`,
      [customer || '', alloy || '', diameter || null, length || null, heat_number]
    );
    res.status(200).json({ message: "Heat updated" });
  } catch (err) {
    console.error("Error updating heat:", err);
    res.status(500).json({ error: "Failed to update heat" });
  }
});

// GET full heat object (heat + logs + annotations)
app.get("/api/heats/:heat_number", async (req, res) => {
  const { heat_number } = req.params;

  if (!/^A\d{7}$/.test(heat_number)) {
    return res.status(400).json({ error: "Invalid heat number format." });
  }

  try {
    const heatResult = await pool.query("SELECT * FROM heats WHERE heat_number = $1", [heat_number]);
    if (heatResult.rows.length === 0) return res.status(404).json({ error: "Heat not found" });

    const logsResult = await pool.query("SELECT * FROM logs WHERE heat_number = $1 ORDER BY log_number", [heat_number]);

    const logs = await Promise.all(
      logsResult.rows.map(async (log) => {
        const annotationsResult = await pool.query("SELECT * FROM annotations WHERE log_id = $1 ORDER BY position", [log.id]);
        return { ...log, annotations: annotationsResult.rows };
      })
    );

    res.json({ ...heatResult.rows[0], logs });
  } catch (err) {
    console.error("Error fetching heat:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET logs for heat_number
app.get("/api/heats/:heat_number/logs", async (req, res) => {
  const { heat_number } = req.params;
  try {
    const result = await pool.query("SELECT * FROM logs WHERE heat_number = $1", [heat_number]);
    const logsWithAnnotations = await Promise.all(result.rows.map(async log => {
      const annotationsResult = await pool.query("SELECT * FROM annotations WHERE log_id = $1", [log.id]);
      return { ...log, annotations: annotationsResult.rows };
    }));
    res.json(logsWithAnnotations);
  } catch (err) {
    console.error("Error fetching logs:", err);
    res.status(500).send("Internal Server Error");
  }
});

// PUT (create/update) log and annotations
app.put("/api/heats/:heat_number/logs/:log_id", async (req, res) => {
  const { heat_number, log_id } = req.params;
  const log = req.body;

  try {
    const existingLog = await pool.query("SELECT id FROM logs WHERE id = $1", [log_id]);

    if (existingLog.rows.length === 0) {
      await pool.query(
        `INSERT INTO logs (id, heat_number, log_number, optional_name, diameter, length, unit, transducer, calibration, gain, prf)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          log_id,
          heat_number,
          log.log_number,
          log.optional_name || '',
          log.diameter || null,
          log.length || null,
          log.unit || '',
          log.transducer || '',
          log.calibration || '',
          log.gain || '',
          log.prf || ''
        ]
      );
    } else {
      await pool.query(
        `UPDATE logs SET log_number = $1, optional_name = $2, diameter = $3, length = $4,
         unit = $5, transducer = $6, calibration = $7, gain = $8, prf = $9
         WHERE id = $10`,
        [
          log.log_number,
          log.optional_name || '',
          log.diameter || null,
          log.length || null,
          log.unit || '',
          log.transducer || '',
          log.calibration || '',
          log.gain || '',
          log.prf || '',
          log_id
        ]
      );
    }

    await pool.query("DELETE FROM annotations WHERE log_id = $1", [log_id]);

    console.log("Saving annotations:", log.annotations);

    for (const annotation of log.annotations || []) {
      try {
        await pool.query(
          `INSERT INTO annotations (log_id, position, type, comment, hash, depth, created_by, inspector)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            log_id,
            annotation.position,
            annotation.type,
            annotation.comment || null,
            annotation.hash || null,
            annotation.depth || null,
            annotation.created_by || null,
            annotation.inspector || null
          ]
        );
      } catch (err) {
        console.error("Failed to insert annotation:", annotation, err);
      }
    }

    res.send("Saved");
  } catch (err) {
    console.error("Error saving log and annotations:", err);
    res.status(500).send("Internal Server Error");
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
