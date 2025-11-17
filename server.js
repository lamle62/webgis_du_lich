// server.js - WebGIS Du lịch
const express = require("express");
const session = require("express-session");
const MemoryStore = require("memorystore")(session);
const bodyParser = require("body-parser");
const engine = require("ejs-mate");
const path = require("path");
const pool = require("./models/db");

// Routes
const userRoutes = require("./routes/userRoutes");
const adminRoutes = require("./routes/adminRoutes");
const itineraryRoutes = require("./routes/itineraryRoutes");
const placeRoutes = require("./routes/placeRoutes");

// Middleware
const { isLoggedIn, requireRole } = require("./middleware/auth");

const app = express();
const PORT = 3000;

// -------------------- Thiết lập cơ bản --------------------
app.engine("ejs", engine);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// -------------------- Session --------------------
app.use(
  session({
    secret: "secretkey",
    resave: false,
    saveUninitialized: true,
    store: new MemoryStore({ checkPeriod: 86400000 }),
    cookie: { maxAge: 86400000 },
  })
);

// -------------------- Biến toàn cục cho view --------------------
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.page = req.path === "/" ? "home" : req.path.split("/")[1] || "";
  res.locals.fullPath = req.path;
  next();
});

// -------------------- Trang gốc / redirect sang /home --------------------
app.get("/", (req, res) => {
  res.redirect("/home");
});

// -------------------- Trang home / quảng bá du lịch --------------------
app.get("/home", async (req, res) => {
  const user = req.session.user || null;
  try {
    const topPlacesResult = await pool.query(`
      SELECT id, name, type, province, image_url
      FROM places
      ORDER BY id ASC
      LIMIT 5
    `);

    const festivalsResult = await pool.query(`
      SELECT id, name, date_text AS date, event_location, image_url, ticket_price
      FROM festivals
      ORDER BY id ASC
      LIMIT 5
    `);

    res.render("index", {
      user,
      page: "home",
      topPlaces: topPlacesResult.rows,
      festivals: festivalsResult.rows,
    });
  } catch (err) {
    console.error("Error loading /home:", err.message);
    res.render("index", { user, page: "home", topPlaces: [], festivals: [] });
  }
});

// -------------------- Trang map --------------------
app.get("/map", async (req, res) => {
  if (!req.session.user) return res.redirect("/user/login");

  try {
    const placesResult = await pool.query(`
      SELECT id, name, type, province, description, ST_AsGeoJSON(geom)::json AS geometry, address, image_url
      FROM places ORDER BY id ASC
    `);

    const Itinerary = require("./models/itineraryModel");
    const itineraries = await Itinerary.getAllByUser(req.session.user.id);

    res.render("map", {
      user: req.session.user,
      page: "map",
      places: placesResult.rows,
      itineraries,
      error: null,
    });
  } catch (err) {
    console.error("Error loading /map:", err.message);
    res.render("map", {
      user: req.session.user,
      page: "map",
      places: [],
      itineraries: [],
      error: "Không thể tải dữ liệu bản đồ.",
    });
  }
});

// -------------------- API GeoJSON cho bản đồ --------------------
app.get("/places/geojson", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id, name, type, province, description, address, image_url,
        ST_X(geom) AS lng, ST_Y(geom) AS lat
      FROM places
    `);

    const geojson = {
      type: "FeatureCollection",
      features: result.rows.map((r) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [r.lng, r.lat] },
        properties: {
          id: r.id,
          name: r.name,
          type: r.type,
          province: r.province,
          description: r.description,
          address: r.address,
          image_url: r.image_url,
        },
      })),
    };

    res.json(geojson);
  } catch (err) {
    console.error("Error in /places/geojson:", err.message);
    res.status(500).json({ error: "Không thể tải dữ liệu địa điểm" });
  }
});

// -------------------- Trang about --------------------
app.get("/about", (req, res) => {
  res.render("about", { fullPath: "/about" });
});

app.get("/festivals/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const result = await pool.query(
      `SELECT id, name, date_text, event_location, description, image_url, ticket_price
       FROM festivals WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0)
      return res.status(404).send("Không tìm thấy lễ hội");
    res.render("festival-detail", { festival: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).send("Lỗi server");
  }
});

// -------------------- Mount routes --------------------
// User routes (login/register/profile/user-area)
app.use("/user", userRoutes);

// Admin routes → chỉ admin mới vào được
app.use("/admin", isLoggedIn, requireRole("admin"), adminRoutes);

// Các route khác
app.use("/itineraries", itineraryRoutes);
app.use("/places", placeRoutes);

// -------------------- Trang không tồn tại --------------------
app.use((req, res) => res.status(404).send("Trang không tồn tại"));

// -------------------- Khởi chạy server --------------------
app.listen(PORT, () => {
  console.log(`✅ Server đang chạy tại: http://localhost:${PORT}`);
});
