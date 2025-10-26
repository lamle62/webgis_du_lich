const pool = require('../models/db');

const placeController = {
  getAll: async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM places ORDER BY id ASC');
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Lỗi khi lấy danh sách địa điểm' });
    }
  },

  renderPage: async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM places ORDER BY id ASC');
      res.render('places', { places: result.rows, user: req.session.user });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Lỗi khi render trang địa điểm' });
    }
  }
};

module.exports = placeController;