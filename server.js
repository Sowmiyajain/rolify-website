const express = require('express');
const mysql   = require('mysql2/promise');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// ── MySQL connection pool ──────────────────────────────────
const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT || '3306'),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASS,
  ssl:      { rejectUnauthorized: false },
  waitForConnections: true,
  connectionLimit:    10,
});

// ── Simple in-memory cache (5 min) ────────────────────────
let cache = { data: null, ts: 0 };
const CACHE_TTL = 5 * 60 * 1000;

// ── API: GET /api/jobs ─────────────────────────────────────
app.get('/api/jobs', async (req, res) => {
  try {
    const now = Date.now();
    if (cache.data && (now - cache.ts) < CACHE_TTL) {
      return res.json({ jobs: cache.data, cached: true, total: cache.data.length });
    }

    const [rows] = await pool.query(`
      SELECT date, company, title, location, url, source, scraped_at
      FROM jobs
      WHERE scraped_at >= NOW() - INTERVAL 3 DAY
      ORDER BY scraped_at DESC
    `);

    cache = { data: rows, ts: now };
    console.log(`[Rolify] Served ${rows.length} jobs from DB`);
    res.json({ jobs: rows, cached: false, total: rows.length });

  } catch (err) {
    console.error('[Rolify] DB error:', err.message);
    res.status(500).json({ error: 'Database error', jobs: [] });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Rolify running at http://localhost:${PORT}`);
});
