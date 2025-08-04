const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

app.get("/api/heats", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM heats ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching heats:", err);
    res.status(500).send("Internal Server Error");
  }
});

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

app.get("/api/heats/:heatId/logs", async (req, res) => {
  const heatId = req.params.heatId;
  try {
    const result = await pool.query("SELECT * FROM logs WHERE heat_id = $1", [heatId]);
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

app.post("/api/heats/:heatId/logs", async (req, res) => {
  const heatId = req.params.heatId;
  const log = req.body;
  const logId = `${heatId}-${log.logNumber}`;

  try {
    const existingLog = await pool.query("SELECT id FROM logs WHERE id = $1", [logId]);

    if (existingLog.rows.length === 0) {
      await pool.query(
        "INSERT INTO logs (id, heat_id, log_number, name, finished_length, finished_diameter) VALUES ($1, $2, $3, $4, $5, $6)",
        [logId, heatId, log.logNumber, log.name, log.finishedLength, log.finishedDiameter]
      );
    } else {
      await pool.query(
        "UPDATE logs SET log_number = $1, name = $2, finished_length = $3, finished_diameter = $4 WHERE id = $5",
        [log.logNumber, log.name, log.finishedLength, log.finishedDiameter, logId]
      );
    }

    await pool.query("DELETE FROM annotations WHERE log_id = $1", [logId]);

    for (const annotation of log.annotations) {
      await pool.query(
        "INSERT INTO annotations (log_id, position, type, note, user_name, user_role, user_color) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [logId, annotation.position, annotation.type, annotation.note, annotation.user?.name, annotation.user?.role, annotation.user?.color]
      );
    }

    res.send("saved");
  } catch (err) {
    console.error("Error saving log and annotations:", err);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/heats/:heatNumber", async (req, res) => {
  const { heatNumber } = req.params;

  try {
    const heatResult = await pool.query("SELECT * FROM heats WHERE heat_number = $1", [heatNumber]);

    if (heatResult.rows.length === 0) {
      return res.status(404).json({ error: "Heat not found" });
    }

    const heat = heatResult.rows[0];

    const logsResult = await pool.query(
      "SELECT * FROM logs WHERE heat_id = $1 ORDER BY log_number",
      [heat.id]
    );

    const logs = await Promise.all(
      logsResult.rows.map(async (log) => {
        const annotationsResult = await pool.query(
          "SELECT * FROM annotations WHERE log_id = $1 ORDER BY position",
          [log.id]
        );
        return { ...log, annotations: annotationsResult.rows };
      })
    );

    res.json({ ...heat, logs });
  } catch (err) {
    console.error("Error fetching heat:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
