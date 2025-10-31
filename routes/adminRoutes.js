// middleware/isAdmin.js
function isAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  res.status(403).send('Truy cập bị từ chối. Chỉ Admin.');
}

// routes/admin.js
const express = require('express');
const router = express.Router();
const { isAdmin } = require('../middleware/isAdmin');
const User = require('../models/User');
const Place = require('../models/Place');
const Itinerary = require('../models/Itinerary');

router.get('/admin', isAdmin, async (req, res) => {
  const [users, places, itineraries] = await Promise.all([
    User.find().limit(10),
    Place.countDocuments(),
    Itinerary.countDocuments()
  ]);

  const stats = {
    users: await User.countDocuments(),
    places,
    itineraries,
    activeToday: await User.countDocuments({ lastLogin: { $gte: new Date().setHours(0,0,0,0) } })
  };

  res.render('admin', { users, stats });
});

router.delete('/admin/users/:id', isAdmin, async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

module.exports = router;