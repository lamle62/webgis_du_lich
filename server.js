// server.js - WebGIS Du lịch
const express = require("express");
const session = require("express-session");
const MemoryStore = require("memorystore")(session);
const bodyParser = require("body-parser");
const path = require("path");
const pool = require("./models/db");

// Routes
const userRoutes = require("./routes/userRoutes");
const itineraryRoutes = require("./routes/itineraryRoutes");
const placeRoutes = require("./routes/placeRoutes");
const Itinerary = require("./models/itineraryModel");

const app = express();
const PORT = 3000;

// -------------------- Thiết lập cơ bản --------------------
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

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
  res.locals.page = req.path === "/" ? "index" : req.path.split("/")[1] || "";
  res.locals.fullPath = req.path;
  next();
});

// -------------------- Trang chủ (index) --------------------
app.get("/", (req, res) => {
  if (req.session.user) return res.redirect("/home");
  res.render("index", { user: null, page: "index" });
});

// -------------------- Trang Home sau khi đăng nhập --------------------
app.get("/home", async (req, res) => {
  if (!req.session.user) return res.redirect("/");

  try {
    const placesResult = await pool.query(`
      SELECT id, name, type, province, description, ST_AsGeoJSON(geom)::json AS geometry
      FROM places ORDER BY id ASC
    `);

    const itineraries = await Itinerary.getAllByUser(req.session.user.id);

    res.render("home", {
      user: req.session.user,
      page: "home",
      places: placesResult.rows,
      itineraries,
      error: null,
    });
  } catch (err) {
    console.error("Error loading /home:", err.message);
    res.render("home", {
      user: req.session.user,
      page: "home",
      places: [],
      itineraries: [],
      error: "Không thể tải dữ liệu trang home.",
    });
  }
});

// -------------------- Trang danh sách lịch trình --------------------

// -------------------- API GeoJSON cho bản đồ --------------------
app.get("/places/geojson", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, type, province, description,image_url,
             ST_X(geom) AS lng, ST_Y(geom) AS lat
      FROM places
    `);

    const geojson = {
      type: "FeatureCollection",
      features: result.rows.map((r) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [r.lng, r.lat] },
        properties: r,
        image_url: r.image_url
      })),
    };

    res.json(geojson);
  } catch (err) {
    console.error("Error in /places/geojson:", err.message);
    res.status(500).json({ error: "Không thể tải dữ liệu địa điểm" });
  }
});

// -------------------- Route con --------------------
app.use("/user", userRoutes);
app.use("/itineraries", itineraryRoutes);
app.use("/places", placeRoutes);

// -------------------- Trang không tồn tại --------------------
app.use((req, res) => res.status(404).send("Trang không tồn tại"));

// -------------------- Khởi chạy server --------------------
app.listen(PORT, () => {
  console.log(`✅ Server đang chạy tại: http://localhost:${PORT}`);
});
