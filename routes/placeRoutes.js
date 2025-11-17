const express = require("express");
const router = express.Router();
const placeController = require("../controllers/placeController");

/* -------------------------
   API: Lấy toàn bộ danh sách
-------------------------- */
router.get("/", placeController.getAll);

/* -------------------------
   Render trang danh sách
-------------------------- */
router.get("/page", placeController.renderPage);

/* -------------------------
   GeoJSON cho bản đồ
-------------------------- */
router.get("/geojson", placeController.getGeoJSON);

/* -------------------------
   ⭐ Trang chi tiết địa điểm
   GET /places/123
-------------------------- */
router.get("/:id", placeController.getDetail);

/* -------------------------
   ⭐ Gợi ý địa điểm gần đó
   GET /places/123/nearby
-------------------------- */
router.get("/:id/nearby", placeController.getNearby);

/* -------------------------
   ⭐ Bộ lọc nâng cao
   GET /places/filter?type=...&province=...
-------------------------- */
router.get("/filter/advanced", placeController.filter);

module.exports = router;
