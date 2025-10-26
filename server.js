// server.js - Thêm route /user/check để kiểm tra trạng thái đăng nhập
const express = require("express");
const session = require("express-session");
const MemoryStore = require('memorystore')(session); // Thêm memorystore
const bodyParser = require("body-parser");
const path = require("path");
const pool = require("./models/db");
const userRoutes = require("./routes/userRoutes");
const itineraryRoutes = require("./routes/itineraryRoutes");
const placeRoutes = require("./routes/placeRoutes");
const Itinerary = require("./models/itineraryModel");

const app = express();
const PORT = 3000;

// Middleware
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: "secretkey",
  resave: false,
  saveUninitialized: true,
  store: new MemoryStore({
    checkPeriod: 86400000 // Xóa session hết hạn sau 24h
  }),
  cookie: { maxAge: 86400000 } // Cookie hết hạn sau 24h
}));
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  console.log(`Request: ${req.method} ${req.url}, Session user:`, req.session.user, 'Session ID:', req.sessionID);
  next();
});

// Trang chủ
app.get("/", async (req, res) => {
  try {
    const placesResult = await pool.query("SELECT id, name, type, province, description, ST_AsGeoJSON(geom)::json AS geometry FROM places ORDER BY id ASC");
    let itineraries = [];
    if (req.session.user) {
      itineraries = await Itinerary.getAllByUser(req.session.user.id);
    }
    console.log('Places fetched for /:', placesResult.rows.length);
    console.log('Place types:', placesResult.rows.map(row => row.type));
    console.log('Itineraries fetched for /:', itineraries.length);
    res.render("index", { 
      places: placesResult.rows, 
      itineraries, 
      user: req.session.user,
      error: null
    });
  } catch (err) {
    console.error('Error in /:', err.message);
    res.render("index", { places: [], itineraries: [], user: req.session.user, error: 'Lỗi khi tải trang chủ' });
  }
});

function normalizeProvince(input) {
  if (!input) return '';
  const map = {
    'da nang': 'Đà Nẵng',
    'ha noi': 'Hà Nội',
    'ho chi minh': 'Hồ Chí Minh',
    'hue': 'Huế',
    // Thêm các tỉnh khác nếu cần
  };
  const normalized = input.trim().toLowerCase();
  return map[normalized] || input.trim();
}
// API GeoJSON
// Trong app.get("/places/geojson")
app.get("/places/geojson", async (req, res) => {
  try {
    console.log('Handling /places/geojson with query:', req.query);
    let { type, province, id } = req.query;
    let query = `
      SELECT id, name, type, province, description,
             ST_X(geom) AS lng,
             ST_Y(geom) AS lat
      FROM places
      WHERE 1=1
    `;
    const params = [];
    if (id) {
      const parsedId = parseInt(id);
      if (isNaN(parsedId)) {
        console.log('Invalid id parameter:', id);
        return res.status(400).json({ error: "ID không hợp lệ" });
      }
      params.push(parsedId);
      query += ` AND id = $${params.length}`;
    }
    if (type) {
      type = type.trim().toLowerCase();
      if (!['tourism', 'hotel', 'restaurant'].includes(type)) {
        console.log('Invalid type parameter:', type);
        return res.status(400).json({ error: "Loại địa điểm không hợp lệ" });
      }
      params.push(type);
      query += ` AND LOWER(type) = $${params.length}`;
    }
    if (province) {
      province = normalizeProvince(province);
      params.push(`%${province}%`);
      query += ` AND province ILIKE $${params.length}`;
    }
    console.log('SQL query:', query);
    console.log('Params:', params);
    const result = await pool.query(query, params);
    console.log('Raw rows:', result.rows);
    console.log('Places fetched for /places/geojson:', result.rows.length);
    const geojson = {
      type: "FeatureCollection",
      features: result.rows.map(row => {
        if (row.lng == null || row.lat == null) {
          console.warn('Invalid coordinates for place:', row);
          return null;
        }
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [row.lng, row.lat] },
          properties: { id: row.id, name: row.name, type: row.type, province: row.province, description: row.description },
        };
      }).filter(feature => feature !== null),
    };
    console.log('GeoJSON response sent with', geojson.features.length, 'features');
    res.json(geojson);
  } catch (err) {
    console.error('Error in /places/geojson:', err.message);
    res.status(500).json({ error: `Lỗi server khi lấy dữ liệu places: ${err.message}` });
  }
});

// Thêm route /user/check để kiểm tra trạng thái đăng nhập
app.get('/user/check', (req, res) => {
  console.log('Request: GET /user/check, Session user:', req.session.user, 'Session ID:', req.sessionID);
  res.json({ isLoggedIn: !!req.session.user });
});

// Routes
app.use("/user", userRoutes);
app.use("/itineraries", itineraryRoutes);
app.use("/places", placeRoutes);

// Middleware tĩnh
app.use(express.static(path.join(__dirname, "public")));

// Xử lý 404
app.use((req, res) => {
  console.log(`404 for ${req.method} ${req.url}`);
  res.status(404).json({ error: "Endpoint không tồn tại" });
});

app.listen(PORT, () => {
  console.log(`✅ Server chạy tại http://localhost:${PORT}`);
});