const Itinerary = require('../models/itineraryModel');
const Place = require('../models/placeModel');

exports.createItinerary = async (req, res) => {
  let { name, places } = req.body;
  const userId = req.session.user?.id;
  console.log('Creating itinerary:', { name, places, userId });

  if (!userId) {
    console.log('Unauthorized create attempt:', { name, places });
    return res.status(401).json({ error: 'Bạn cần đăng nhập để tạo lịch trình' });
  }

  if (!name) {
    console.log('Invalid input: Missing name');
    return res.status(400).json({ error: 'Tên lịch trình là bắt buộc' });
  }

  // Xử lý places: Nếu là chuỗi JSON, parse thành mảng
  if (typeof places === 'string') {
    try {
      places = JSON.parse(places);
    } catch (error) {
      console.log('Invalid places format:', places);
      return res.status(400).json({ error: 'Danh sách địa điểm không hợp lệ' });
    }
  }

  if (!Array.isArray(places) || places.some(id => !Number.isInteger(Number(id)))) {
    console.log('Invalid input: places is not an array of integers', places);
    return res.status(400).json({ error: 'Danh sách địa điểm phải là mảng các ID số nguyên' });
  }

  try {
    const itinerary = await Itinerary.create({ name, places, userId });
    console.log('Itinerary created:', itinerary);
    res.status(201).json(itinerary);
  } catch (error) {
    console.error('Error creating itinerary:', error.message);
    res.status(500).json({ error: 'Lỗi khi tạo lịch trình' });
  }
};

// Các hàm khác giữ nguyên
exports.getItineraryById = async (req, res) => {
  const { id } = req.params;
  const userId = req.session.user?.id;
  console.log('Rendering itinerary detail:', { id, userId });

  try {
    const itinerary = await Itinerary.getById(id, userId);
    if (!itinerary) {
      console.log('Itinerary not found or unauthorized:', { id, userId });
      return res.status(404).render('itinerary_detail', { 
        itinerary: null, 
        user: req.session.user, 
        error: 'Lịch trình không tồn tại hoặc bạn không có quyền truy cập' 
      });
    }
    console.log('Itinerary for render:', itinerary);
    res.render('itinerary_detail', { 
      itinerary, 
      user: req.session.user, 
      error: null 
    });
  } catch (error) {
    console.error('Error rendering itinerary:', error.message);
    res.status(500).render('itinerary_detail', { 
      itinerary: null, 
      user: req.session.user, 
      error: 'Lỗi khi tải lịch trình' 
    });
  }
};

exports.updateItinerary = async (req, res) => {
  const { id } = req.params;
  let { name, places } = req.body;
  const userId = req.session.user?.id;
  console.log('POST /itineraries/:id/edit request:', { id, body: req.body });

  if (!userId) {
    console.log('Unauthorized update attempt:', { id, userId });
    return res.status(401).json({ error: 'Bạn cần đăng nhập để chỉnh sửa lịch trình' });
  }

  if (!places || places === '') {
    places = [];
  } else if (typeof places === 'string') {
    places = places.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
  }

  if (!name || !Array.isArray(places)) {
    console.log('Invalid input:', { name, places });
    return res.status(400).json({ error: 'Tên lịch trình và danh sách địa điểm hợp lệ là bắt buộc' });
  }

  try {
    console.log('Updating itinerary:', { id, name, places, userId });
    const itinerary = await Itinerary.update(id, { name, places }, userId);
    if (!itinerary) {
      console.log('Itinerary not found or unauthorized:', { id, userId });
      return res.status(404).json({ error: 'Lịch trình không tồn tại hoặc bạn không có quyền chỉnh sửa' });
    }
    console.log('Itinerary updated, redirecting to /itineraries/page');
    res.redirect('/itineraries/page');
  } catch (error) {
    console.error('Error updating itinerary:', error.message);
    res.status(500).json({ error: 'Lỗi khi cập nhật lịch trình' });
  }
};

exports.deleteItinerary = async (req, res) => {
    const { id } = req.params;
    const userId = req.session.user?.id;
    console.log('Deleting itinerary:', { id, userId });

    if (!userId) {
        console.log('Unauthorized delete attempt:', { id, userId });
        return res.status(401).json({ error: 'Bạn cần đăng nhập để xóa lịch trình' });
    }

    try {
        const success = await Itinerary.delete(id, userId);
        if (!success) {
            console.log('Itinerary not found or unauthorized:', { id, userId });
            return res.status(404).json({ error: 'Lịch trình không tồn tại hoặc bạn không có quyền xóa' });
        }
        console.log('Itinerary deleted successfully:', { id });
        res.status(200).json({ message: 'Lịch trình đã được xóa', redirect: '/itineraries/page' });
    } catch (error) {
        console.error('Error deleting itinerary:', error.message);
        res.status(500).json({ error: 'Lỗi khi xóa lịch trình: ' + error.message });
    }
};

exports.removePlaceFromItinerary = async (req, res) => {
  const { id } = req.params;
  const { placeId } = req.body;
  const userId = req.session.user?.id;
  console.log('Removing place from itinerary:', { id, placeId, userId });

  if (!userId) {
    console.log('Unauthorized remove place attempt:', { id, placeId, userId });
    return res.status(401).json({ error: 'Bạn cần đăng nhập để xóa địa điểm khỏi lịch trình' });
  }

  try {
    const itinerary = await Itinerary.removePlace(id, placeId, userId);
    if (!itinerary) {
      console.log('Itinerary not found or unauthorized:', { id, userId });
      return res.status(404).json({ error: 'Lịch trình không tồn tại hoặc bạn không có quyền truy cập' });
    }
    console.log('Place removed, redirecting to /itineraries/' + id);
    res.redirect(`/itineraries/${id}`);
  } catch (error) {
    console.error('Error removing place:', error.message);
    res.status(500).json({ error: 'Lỗi khi xóa địa điểm khỏi lịch trình' });
  }
};