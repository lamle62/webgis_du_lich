const Itinerary = require('../models/itineraryModel');
const Place = require('../models/placeModel');

exports.renderCreateForm = async (req, res) => {
  const userId = req.session.user?.id;
  console.log('Render create itinerary form, userId:', userId);
  if (!userId) {
    return res.redirect('/user/login');
  }
  try {
    const places = await Place.getAll();
    res.render('create_itinerary', { user: req.session.user, places, error: null });
  } catch (error) {
    console.error('Error rendering create itinerary form:', error.message);
    res.status(500).render('create_itinerary', { user: req.session.user, places: [], error: 'Lỗi khi tải form tạo lịch trình' });
  }
};

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

  if (typeof places === 'string') {
    try {
      places = JSON.parse(places);
    } catch (error) {
      console.log('Invalid places format:', places);
      return res.status(400).json({ error: 'Danh sách địa điểm không hợp lệ' });
    }
  }

  if (!Array.isArray(places) || places.some(p => !p.id || typeof p.id !== 'number' || !p.time)) {
    console.log('Invalid input: places is not an array of valid objects', places);
    return res.status(400).json({ error: 'Danh sách địa điểm phải là mảng các object {id: number, time: string}' });
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

exports.createItineraryFromForm = async (req, res) => {
  let { name, places } = req.body;
  const userId = req.session.user?.id;
  console.log('Create itinerary from form:', { name, places, userId });

  if (!userId) {
    return res.redirect('/user/login');
  }

  if (!name) {
    return res.status(400).render('create_itinerary', { user: req.session.user, places: [], error: 'Tên lịch trình là bắt buộc' });
  }

  if (typeof places === 'string') {
    try {
      places = JSON.parse(places);
    } catch (error) {
      return res.status(400).render('create_itinerary', { user: req.session.user, places: [], error: 'Danh sách địa điểm không hợp lệ' });
    }
  }

  if (!Array.isArray(places) || places.length === 0 || places.some(p => !p.id || !p.time)) {
    return res.status(400).render('create_itinerary', { user: req.session.user, places: [], error: 'Phải chọn ít nhất một địa điểm và nhập thời gian' });
  }

  try {
    const itinerary = await Itinerary.create({ name, places, userId });
    console.log('Itinerary created from form:', itinerary);
    res.redirect('/itineraries/page');
  } catch (error) {
    console.error('Error creating itinerary from form:', error.message);
    res.status(500).render('create_itinerary', { user: req.session.user, places: [], error: 'Lỗi khi tạo lịch trình' });
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

  if (!name) {
    console.log('Invalid input: Missing name');
    return res.status(400).json({ error: 'Tên lịch trình là bắt buộc' });
  }

  // Sửa: Parse places nếu là chuỗi JSON
  if (typeof places === 'string') {
    try {
      places = JSON.parse(places);
    } catch (error) {
      console.error('Error parsing places JSON:', error.message);
      return res.status(400).json({ error: 'Danh sách địa điểm không hợp lệ (phải là JSON mảng object)' });
    }
  }

  // Validate places là mảng object {id, time}
  if (!Array.isArray(places) || places.some(p => !Number.isInteger(p.id) || typeof p.time !== 'string')) {
    console.log('Invalid places format:', places);
    return res.status(400).json({ error: 'Danh sách địa điểm phải là mảng các object {id: number, time: string}' });
  }

  // Bắt buộc time nếu cần (tùy chọn: bỏ nếu time optional)
  if (places.some(p => !p.time.trim())) {
    return res.status(400).json({ error: 'Tất cả địa điểm phải có thời gian' });
  }

  try {
    console.log('Updating itinerary with parsed places:', { id, name, places, userId });
    const itinerary = await Itinerary.update(id, { name, places }, userId);
    if (!itinerary) {
      console.log('Itinerary not found or unauthorized:', { id, userId });
      return res.status(404).json({ error: 'Lịch trình không tồn tại hoặc bạn không có quyền chỉnh sửa' });
    }
    console.log('Itinerary updated successfully:', itinerary);
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

exports.createItineraryFromForm = async (req, res) => {
  let { name, places } = req.body;
  const userId = req.session.user?.id;
  console.log('Create itinerary from form:', { name, places, userId });

  if (!userId) {
    return res.redirect('/user/login');
  }

  if (!name) {
    return res.status(400).render('create_itinerary', { user: req.session.user, places: [], error: 'Tên lịch trình là bắt buộc' });
  }

  // Sửa: Parse places nếu là chuỗi JSON
  if (typeof places === 'string') {
    try {
      places = JSON.parse(places);
    } catch (error) {
      console.error('Error parsing places JSON:', error.message);
      return res.status(400).render('create_itinerary', { user: req.session.user, places: [], error: 'Danh sách địa điểm không hợp lệ' });
    }
  }

  // Validate places là mảng object {id, time}
  if (!Array.isArray(places) || places.length === 0 || places.some(p => !Number.isInteger(p.id) || typeof p.time !== 'string')) {
    console.log('Invalid places format:', places);
    return res.status(400).render('create_itinerary', { user: req.session.user, places: [], error: 'Phải chọn ít nhất một địa điểm và nhập thời gian' });
  }

  // Bắt buộc time không rỗng
  if (places.some(p => !p.time.trim())) {
    return res.status(400).render('create_itinerary', { user: req.session.user, places: [], error: 'Tất cả địa điểm phải có thời gian' });
  }

  try {
    const itinerary = await Itinerary.create({ name, places, userId });
    console.log('Itinerary created from form:', itinerary);
    res.redirect('/itineraries/page');
  } catch (error) {
    console.error('Error creating itinerary from form:', error.message);
    res.status(500).render('create_itinerary', { user: req.session.user, places: [], error: 'Lỗi khi tạo lịch trình' });
  }
};