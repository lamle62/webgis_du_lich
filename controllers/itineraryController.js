const Itinerary = require('../models/itineraryModel');
const Place = require('../models/placeModel');
const pool = require('../models/db');

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
    return res.status(400).json({ error: 'Danh sách địa điểm phải là mảng các object {id: number, time: string, status: boolean (optional)}' });
  }

  // Mặc định status = false nếu không có
  places = places.map(p => ({ ...p, status: p.status === true ? true : false }));

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

  // Mặc định status = false nếu không có
  places = places.map(p => ({ ...p, status: p.status === true ? true : false }));

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
    const itineraryId = req.params.id;
    const userId = req.session.user?.id;

    try {
        // 1. Lấy lịch trình + các địa điểm hiện tại
        const itineraryResult = await pool.query(
            `SELECT i.*, 
                    COALESCE(json_agg(
                        json_build_object(
                            'id', p.id,
                            'name', p.name,
                            'type', p.type,
                            'province', p.province,
                            'time', ip.visit_time,
                            'status', ip.status
                        )
                    ) FILTER (WHERE p.id IS NOT NULL), '[]') AS places
             FROM itineraries i
             LEFT JOIN itinerary_places ip ON i.id = ip.itinerary_id
             LEFT JOIN places p ON ip.place_id = p.id
             WHERE i.id = $1 AND i.user_id = $2
             GROUP BY i.id`,
            [itineraryId, userId]
        );

        if (itineraryResult.rows.length === 0) {
            return res.status(404).render('error', { message: 'Lịch trình không tồn tại' });
        }

        const itinerary = itineraryResult.rows[0];

        // 2. LẤY TẤT CẢ ĐỊA ĐIỂM CÓ TRONG HỆ THỐNG (CHO DROPDOWN)
        const placesResult = await pool.query(
            `SELECT id, name, type, province 
             FROM places 
             ORDER BY name ASC`
        );
        const allPlaces = placesResult.rows;

        // 3. Render file gốc 'itinerary_detail' với thêm allPlaces
        res.render('itinerary_detail', {
            itinerary,
            allPlaces,  // TRUYỀN DANH SÁCH ĐIỂM CHO DROPDOWN
            user: req.session.user,
            error: null
        });

    } catch (error) {
        console.error('Error loading detail:', error);
        res.status(500).render('error', { message: 'Lỗi tải chi tiết' });
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

  // Validate places là mảng object {id, time, status (optional)}
  if (!Array.isArray(places) || places.some(p => !Number.isInteger(p.id) || typeof p.time !== 'string')) {
    console.log('Invalid places format:', places);
    return res.status(400).json({ error: 'Danh sách địa điểm phải là mảng các object {id: number, time: string, status: boolean (optional)}' });
  }

  // Bắt buộc time nếu cần (tùy chọn: bỏ nếu time optional)
  if (places.some(p => !p.time.trim())) {
    return res.status(400).json({ error: 'Tất cả địa điểm phải có thời gian' });
  }

  // Mặc định status = false nếu không có
  places = places.map(p => ({ ...p, status: p.status === true ? true : false }));

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
    const itineraryId = req.params.id;
    const userId = req.session.user?.id;

    try {
        if (!userId) {
            return res.status(401).json({ error: 'Bạn cần đăng nhập để xóa lịch trình' });
        }

        // Kiểm tra quyền
        const check = await pool.query(
            'SELECT 1 FROM itineraries WHERE id = $1 AND user_id = $2',
            [itineraryId, userId]
        );

        if (check.rowCount === 0) {
            return res.status(404).json({ error: 'Lịch trình không tồn tại hoặc không thuộc về bạn' });
        }

        // Xóa cascade
        await pool.query('DELETE FROM itinerary_places WHERE itinerary_id = $1', [itineraryId]);
        await pool.query('DELETE FROM itineraries WHERE id = $1', [itineraryId]);

        console.log('XÓA LỊCH TRÌNH THÀNH CÔNG:', itineraryId);
        res.status(200).json({ success: true });

    } catch (error) {
        console.error('Lỗi xóa lịch trình:', error.message);
        res.status(500).json({ error: 'Xóa thất bại' });
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

exports.togglePlaceStatus = async (req, res) => {
    try {
        // === LOG TOÀN BỘ REQUEST ===
        console.log('TOGGLE STATUS REQUEST:', {
            params: req.params,
            body: req.body,
            session: req.session?.user
        });

        const userId = req.session?.user?.id;
        const itineraryId = req.params.id;
        const { placeId, status } = req.body || {};

        // === 1. Kiểm tra đăng nhập ===
        if (!userId) {
            return res.status(401).json({ error: 'Chưa đăng nhập' });
        }

        // === 2. Kiểm tra dữ liệu ===
        if (!placeId || status === undefined) {
            console.log('Thiếu dữ liệu:', { placeId, status });
            return res.status(400).json({ error: 'Thiếu placeId hoặc status' });
        }

        // === 3. Kiểm tra quyền sở hữu ===
        const ownerCheck = await pool.query(
            'SELECT 1 FROM itineraries WHERE id = $1 AND user_id = $2',
            [itineraryId, userId]
        );

        if (ownerCheck.rowCount === 0) {
            return res.status(403).json({ error: 'Không có quyền' });
        }

        // === 4. Cập nhật status ===
        const result = await pool.query(
            `UPDATE itinerary_places 
             SET status = $1 
             WHERE itinerary_id = $2 AND place_id = $3`,
            [status, itineraryId, placeId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Không tìm thấy địa điểm trong lịch trình' });
        }

        console.log('CẬP NHẬT THÀNH CÔNG:', { itineraryId, placeId, status });
        res.json({ success: true });

    } catch (error) {
        // === IN LỖI CHI TIẾT ===
        console.error('LỖI 500 TRONG TOGGLE STATUS:', error.message);
        console.error('Stack:', error.stack);
        res.status(500).json({ error: 'Lỗi server', details: error.message });
    }
};