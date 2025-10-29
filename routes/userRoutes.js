// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const { createUser, findUserByUsername, findUserByEmail } = require('../models/userModel');
const { showLogin, showRegister, logout } = require('../controllers/userController');

router.get('/login', showLogin);

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await findUserByUsername(username);
    if (!user) {
      return res.render('login', { error: 'Sai tài khoản hoặc mật khẩu' });
    }
    const match = await require('bcryptjs').compare(password, user.password);
    if (!match) {
      return res.render('login', { error: 'Sai tài khoản hoặc mật khẩu' });
    }
    req.session.user = { id: user.id, username: user.username };
    res.redirect('/');
  } catch (err) {
    console.error('Login error:', err);
    res.render('login', { error: 'Lỗi server khi đăng nhập' });
  }
});

router.get('/register', showRegister);

router.post('/register', async (req, res) => {
  const { username, password, confirmPassword, email, phone } = req.body;

  try {
    // Kiểm tra mật khẩu
    if (password !== confirmPassword) {
      return res.render('register', { error: 'Mật khẩu và nhập lại mật khẩu không khớp' });
    }

    // Kiểm tra username
    const existingUser = await findUserByUsername(username);
    if (existingUser) {
      return res.render('register', { error: 'Tên tài khoản đã tồn tại' });
    }

    // Kiểm tra email
    const existingEmail = await findUserByEmail(email);
    if (existingEmail) {
      return res.render('register', { error: 'Email đã được sử dụng' });
    }

    // Kiểm tra số điện thoại
    if (!/^\d{10,11}$/.test(phone)) {
      return res.render('register', { error: 'Số điện thoại phải có 10-11 chữ số' });
    }

    // Tạo user
    await createUser(username, password, email, phone);
    res.redirect('/user/login');
  } catch (err) {
    console.error('Register error:', err);
    res.render('register', { error: 'Lỗi server khi đăng ký' });
  }
});

router.get('/logout', logout);

module.exports = router;