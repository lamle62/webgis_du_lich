const express = require('express');
const router = express.Router();
const Itinerary = require('../models/itineraryModel');
const itineraryController = require('../controllers/itineraryController');

router.get('/page', async (req, res) => {
    const userId = req.session.user?.id;
    console.log('Fetching itineraries for user:', userId);
    try {
        if (!userId) {
            console.log('Unauthorized attempt to fetch itineraries');
            if (req.headers.accept && req.headers.accept.includes('application/json')) {
                return res.status(401).json({ error: 'Bạn cần đăng nhập để xem lịch trình' });
            }
            return res.redirect('/user/login');
        }
        const itineraries = await Itinerary.getAllByUser(userId);
        console.log('Itineraries fetched for /itineraries/page:', itineraries);
        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            res.json({ itineraries });
        } else {
            res.render('itinerary', { itineraries, user: req.session.user });
        }
    } catch (error) {
        console.error('Error fetching itineraries for /itineraries/page:', error);
        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            res.status(500).json({ error: 'Lỗi khi tải danh sách lịch trình' });
        } else {
            res.status(500).render('itinerary', { itineraries: [], user: req.session.user, error: 'Lỗi khi tải danh sách lịch trình' });
        }
    }
});

// Render create itinerary form
router.get('/create', itineraryController.renderCreateForm);
// Handle create itinerary form submission
router.post('/create', itineraryController.createItineraryFromForm);


router.get('/:id', itineraryController.getItineraryById);
router.post('/', itineraryController.createItinerary);
router.post('/:id/edit', itineraryController.updateItinerary);
// Use RESTful DELETE /:id for deleting itineraries
router.delete('/:id', itineraryController.deleteItinerary);
router.post('/:id/remove-place', itineraryController.removePlaceFromItinerary);

module.exports = router;