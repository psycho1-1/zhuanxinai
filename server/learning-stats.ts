export const totalsQuery = `SELECT COUNT(*) AS attempts, COALESCE(SUM(correct),0) AS correct,
  COALESCE(SUM(CASE WHEN date(created_at, '+8 hours') = date('now', '+8 hours') THEN 1 ELSE 0 END),0) AS today
  FROM attempts WHERE learner = ?`;
export const daysQuery = `SELECT date(created_at, '+8 hours') AS day, COUNT(*) AS count
  FROM attempts WHERE learner = ? AND date(created_at, '+8 hours') >= date('now', '+8 hours', '-6 days')
  GROUP BY day ORDER BY day`;
