const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const pool = require("../models/db");
const {
  createUser,
  findUserByUsername,
  findUserByEmail,
} = require("../models/userModel");
const { showLogin, showRegister } = require("../controllers/userController");
const { isLoggedIn, requireRole } = require("../middleware/auth");

// ===================== Đăng nhập =====================
router.get("/login", (req, res) => {
  if (req.session.user) {
    return req.session.user.role === "admin"
      ? res.redirect("/admin/dashboard")
      : res.redirect("/home");
  }
  showLogin(req, res);
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await findUserByUsername(username);
    if (!user)
      return res.render("user/login", { error: "Sai tài khoản hoặc mật khẩu" });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.render("user/login", { error: "Sai tài khoản hoặc mật khẩu" });

    req.session.user = {
      id: user.id,
      username: user.username,
      role: user.role,
    };

    if (user.role === "admin") return res.redirect("/admin/dashboard");
    return res.redirect("/home");
  } catch (err) {
    console.error("Login error:", err);
    res.render("user/login", { error: "Lỗi server khi đăng nhập" });
  }
});

// ===================== Đăng ký =====================
router.get("/register", (req, res) => {
  if (req.session.user) return res.redirect("/home");
  showRegister(req, res);
});

router.post("/register", async (req, res) => {
  const { username, password, confirmPassword, email, phone } = req.body;
  try {
    if (password !== confirmPassword)
      return res.render("user/register", { error: "Mật khẩu không khớp" });

    if (await findUserByUsername(username))
      return res.render("user/register", { error: "Tên tài khoản đã tồn tại" });

    if (await findUserByEmail(email))
      return res.render("user/register", { error: "Email đã được sử dụng" });

    await createUser(username, password, email, phone, "user");
    res.redirect("/user/login");
  } catch (err) {
    console.error(err);
    res.render("user/register", { error: "Lỗi server khi đăng ký" });
  }
});

// ===================== Đăng xuất =====================
router.get("/logout", isLoggedIn, (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).send("Lỗi khi đăng xuất");
    res.clearCookie("connect.sid");
    res.redirect("/");
  });
});

// ===================== Hồ sơ người dùng =====================
router.get("/profile-data", isLoggedIn, async (req, res) => {
  const userId = req.session.user.id;
  try {
    const result = await pool.query(
      `SELECT username, email, phone, role, created_at AS "createdAt" FROM users WHERE id = $1`,
      [userId]
    );
    if (result.rows.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy người dùng" });

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, message: "Không thể tải thông tin người dùng" });
  }
});

// ===================== User-only page =====================
router.get("/user-area", isLoggedIn, requireRole("user"), (req, res) => {
  res.send(`Chào ${req.session.user.username}, đây là trang dành cho user.`);
});

module.exports = router;
