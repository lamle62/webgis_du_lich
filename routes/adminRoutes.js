const express = require("express");
const router = express.Router();
const pool = require("../models/db");
const multer = require("multer");
const path = require("path");
const { isLoggedIn, requireRole } = require("../middleware/auth");

// ====== Setup multer để upload ảnh ======
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "../public/images"));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage: storage });

// ====== Dashboard: danh sách địa điểm ======
router.get("/dashboard", isLoggedIn, requireRole("admin"), async (req, res) => {
  try {
    const placesResult = await pool.query(
      "SELECT * FROM places ORDER BY id ASC"
    );
    res.render("admin/dashboard", {
      user: req.session.user,
      places: placesResult.rows,
      title: "Dashboard Admin",
    });
  } catch (err) {
    console.error(err);
    res.send("Lỗi khi tải danh sách địa điểm");
  }
});

// ====== Thêm địa điểm ======
router.get("/places/add", isLoggedIn, requireRole("admin"), (req, res) => {
  res.render("admin/place_form", {
    user: req.session.user,
    place: null,
    title: "Thêm địa điểm",
  });
});

router.post(
  "/places/add",
  isLoggedIn,
  requireRole("admin"),
  upload.single("image"),
  async (req, res) => {
    const { name, type, province, description, address, lng, lat } = req.body;
    const image_url = req.file ? `/images/${req.file.filename}` : null;

    try {
      await pool.query(
        `INSERT INTO places (name, type, province, description, address, geom, image_url, views)
       VALUES ($1,$2,$3,$4,$5,ST_SetSRID(ST_MakePoint($6,$7),4326),$8,0)`,
        [name, type, province, description, address, lng, lat, image_url]
      );
      res.redirect("/admin/dashboard");
    } catch (err) {
      console.error(err);
      res.send("Lỗi khi thêm địa điểm");
    }
  }
);

// ====== Sửa địa điểm ======
router.get(
  "/places/edit/:id",
  isLoggedIn,
  requireRole("admin"),
  async (req, res) => {
    try {
      const result = await pool.query("SELECT * FROM places WHERE id=$1", [
        req.params.id,
      ]);
      if (result.rows.length === 0) return res.send("Không tìm thấy địa điểm");
      res.render("admin/place_form", {
        user: req.session.user,
        place: result.rows[0],
        title: "Sửa địa điểm",
      });
    } catch (err) {
      console.error(err);
      res.send("Lỗi khi tải form sửa địa điểm");
    }
  }
);

router.post(
  "/places/edit/:id",
  isLoggedIn,
  requireRole("admin"),
  upload.single("image"),
  async (req, res) => {
    const { name, type, province, description, address, lng, lat } = req.body;
    const image_url = req.file
      ? `/images/${req.file.filename}`
      : req.body.old_image;

    try {
      await pool.query(
        `UPDATE places 
       SET name=$1,type=$2,province=$3,description=$4,address=$5,
           geom=ST_SetSRID(ST_MakePoint($6,$7),4326),image_url=$8
       WHERE id=$9`,
        [
          name,
          type,
          province,
          description,
          address,
          lng,
          lat,
          image_url,
          req.params.id,
        ]
      );
      res.redirect("/admin/dashboard");
    } catch (err) {
      console.error(err);
      res.send("Lỗi khi cập nhật địa điểm");
    }
  }
);

// ====== Xóa địa điểm ======
router.get(
  "/places/delete/:id",
  isLoggedIn,
  requireRole("admin"),
  async (req, res) => {
    try {
      await pool.query("DELETE FROM places WHERE id=$1", [req.params.id]);
      res.redirect("/admin/dashboard");
    } catch (err) {
      console.error(err);
      res.send("Lỗi khi xóa địa điểm");
    }
  }
);

// ====== Thống kê top địa điểm ======
router.get("/stats", isLoggedIn, requireRole("admin"), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, views
      FROM places
      ORDER BY views DESC
      LIMIT 10
    `);
    res.render("admin/stats", {
      user: req.session.user,
      topPlaces: result.rows,
      title: "Thống kê địa điểm",
    });
  } catch (err) {
    console.error(err);
    res.send("Lỗi khi tải thống kê");
  }
});

module.exports = router;
