const express = require('express');
const router = express.Router();
const placeController = require('../controllers/placeController');

router.get('/', placeController.getAll);
router.get('/page', placeController.renderPage);

module.exports = router;