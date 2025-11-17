const Place = require("../models/placeModel");

exports.renderDetailPage = async (req, res) => {
  try {
    const placeId = req.params.id;
    const place = await Place.getById(placeId);
    if (!place) return res.status(404).send("Địa điểm không tồn tại");

    const nearby = await Place.getNearby(placeId);

    res.render("place_detail", {
      place,
      nearby,
      user: req.session.user || null,
    });
  } catch (err) {
    console.error("Error rendering place detail:", err);
    res.status(500).send("Lỗi server");
  }
};

const placeController = {
  // 1. Trả JSON tất cả địa điểm
  getAll: async (req, res) => {
    try {
      const places = await Place.getAll();
      res.json(places);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Lỗi khi lấy danh sách địa điểm" });
    }
  },

  // 2. Render trang HTML danh sách
  renderPage: async (req, res) => {
    try {
      const places = await Place.getAll();
      res.render("places", { places, user: req.session.user });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Lỗi khi render trang địa điểm" });
    }
  },

  // 3. Trả GeoJSON
  getGeoJSON: async (req, res) => {
    try {
      const geojson = await Place.getGeoJSON();
      res.json(geojson);
    } catch (err) {
      console.error("Lỗi lấy GeoJSON:", err);
      res.status(500).json({ error: "Không thể lấy dữ liệu địa điểm" });
    }
  },

  // ⭐ 4. TRANG CHI TIẾT
  getDetail: async (req, res) => {
    try {
      const id = req.params.id;
      const place = await Place.getById(id);

      if (!place) {
        return res
          .status(404)
          .render("404", { message: "Không tìm thấy địa điểm" });
      }
      place.image_url = place.image_url || "/images/default-place.png";
      res.render("place-detail", { place });
    } catch (err) {
      console.error("Lỗi chi tiết:", err);
      res.status(500).json({ error: "Lỗi server" });
    }
  },

  // ⭐ 5. NEARBY
  getNearby: async (req, res) => {
    try {
      const id = req.params.id;
      const nearby = await Place.getNearby(id, 3000); // 3km
      res.json({ nearby });
    } catch (err) {
      console.error("Lỗi nearby:", err);
      res.status(500).json({ error: "Không thể lấy nearby" });
    }
  },

  // ⭐ 6. FILTER NÂNG CAO
  filter: async (req, res) => {
    try {
      const { type, province, district, ward, minRating, maxPrice, parking } =
        req.query;

      const places = await Place.filter({
        type,
        province,
        district,
        ward,
        minRating,
        maxPrice,
        parking,
      });

      res.json({ places });
    } catch (err) {
      console.error("Lỗi filter:", err);
      res.status(500).json({ error: "Không thể lọc địa điểm" });
    }
  },
};

module.exports = placeController;
