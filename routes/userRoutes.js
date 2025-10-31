// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const {
  createUser,
  findUserByUsername,
  findUserByEmail
} = require('../models/userModel');
const { showLogin, showRegister } = require('../controllers/userController');

// ===================== Đăng nhập =====================
router.get('/login', (req, res) => {
  // Nếu đã đăng nhập thì không cần vào lại trang login
  if (req.session.user) {
    return res.redirect('/home');
  }
  showLogin(req, res);
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await findUserByUsername(username);
    if (!user) {
      return res.render('login', { error: 'Sai tài khoản hoặc mật khẩu' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.render('login', { error: 'Sai tài khoản hoặc mật khẩu' });
    }

    // ✅ Lưu session user
    req.session.user = { id: user.id, username: user.username };
    // ✅ Chuyển sang trang home
    res.redirect('/home');
  } catch (err) {
    console.error('Login error:', err);
    res.render('login', { error: 'Lỗi server khi đăng nhập' });
  }
});

// ===================== Đăng ký =====================
router.get('/register', (req, res) => {
  // Nếu đã đăng nhập → không cho vào trang đăng ký nữa
  if (req.session.user) {
    return res.redirect('/home');
  }
  showRegister(req, res);
});

router.post('/register', async (req, res) => {
  const { username, password, confirmPassword, email, phone } = req.body;

  try {
    // Kiểm tra nhập lại mật khẩu
    if (password !== confirmPassword) {
      return res.render('register', { error: 'Mật khẩu và nhập lại mật khẩu không khớp' });
    }

    // Kiểm tra username trùng
    const existingUser = await findUserByUsername(username);
    if (existingUser) {
      return res.render('register', { error: 'Tên tài khoản đã tồn tại' });
    }

    // Kiểm tra email trùng
    const existingEmail = await findUserByEmail(email);
    if (existingEmail) {
      return res.render('register', { error: 'Email đã được sử dụng' });
    }

    // Kiểm tra số điện thoại hợp lệ
    if (!/^\d{10,11}$/.test(phone)) {
      return res.render('register', { error: 'Số điện thoại phải có 10-11 chữ số' });
    }

    // ✅ Tạo tài khoản mới
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
    // ✅ Xóa cookie và quay về trang index
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
});

router.get('/check', (req, res) => {
  if (req.session && req.session.user) {
    res.json({ isLoggedIn: true, user: req.session.user });
  } else {
    res.json({ isLoggedIn: false });
  }
});


module.exports = router;
