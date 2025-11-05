// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../models/db'); // ⚡ Thêm dòng này nếu chưa có
const {
  createUser,
  findUserByUsername,
  findUserByEmail
} = require('../models/userModel');
const { showLogin, showRegister } = require('../controllers/userController');

// ===================== Đăng nhập =====================
router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/home');
  showLogin(req, res);
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await findUserByUsername(username);
    if (!user)
      return res.render('login', { error: 'Sai tài khoản hoặc mật khẩu' });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.render('login', { error: 'Sai tài khoản hoặc mật khẩu' });

    req.session.user = { id: user.id, username: user.username };
    res.redirect('/home');
  } catch (err) {
    console.error('Login error:', err);
    res.render('login', { error: 'Lỗi server khi đăng nhập' });
  }
});

// ===================== Đăng ký =====================
router.get('/register', (req, res) => {
  if (req.session.user) return res.redirect('/home');
  showRegister(req, res);
});

router.post('/register', async (req, res) => {
  const { username, password, confirmPassword, email, phone } = req.body;

  try {
    if (password !== confirmPassword)
      return res.render('register', {
        error: 'Mật khẩu và nhập lại mật khẩu không khớp'
      });

    const existingUser = await findUserByUsername(username);
    if (existingUser)
      return res.render('register', { error: 'Tên tài khoản đã tồn tại' });

    const existingEmail = await findUserByEmail(email);
    if (existingEmail)
      return res.render('register', { error: 'Email đã được sử dụng' });

    if (!/^\d{10,11}$/.test(phone))
      return res.render('register', {
        error: 'Số điện thoại phải có 10-11 chữ số'
      });

    await createUser(username, password, email, phone);
    res.redirect('/user/login');
  } catch (err) {
    console.error('Register error:', err);
    res.render('register', { error: 'Lỗi server khi đăng ký' });
  }
});

// ===================== Đăng xuất =====================
router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).send('Lỗi khi đăng xuất');
    }
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
});

// ===================== Kiểm tra đăng nhập =====================
router.get('/check', (req, res) => {
  if (req.session && req.session.user) {
    res.json({ isLoggedIn: true, user: req.session.user });
  } else {
    res.json({ isLoggedIn: false });
  }
});


// ✅ ✅ ✅ ===================== HỒ SƠ NGƯỜI DÙNG =====================
router.get('/profile-data', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
  }

  const userId = req.session.user.id;
  try {
    const result = await pool.query(
  `SELECT username, email, phone, created_at AS "createdAt" 
   FROM users 
   WHERE id = $1`,
  [userId]
);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    const user = result.rows[0];
    return res.json({ success: true, data: user });
  } catch (error) {
    console.error('Lỗi lấy hồ sơ:', error);
    return res.status(500).json({ success: false, message: 'Không thể tải thông tin người dùng' });
  }
});


module.exports = router;
