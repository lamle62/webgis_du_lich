const express = require('express');
const router = express.Router();
const pool = require('../models/db');
const bcrypt = require('bcryptjs');
const { createUser, findUserByUsername, findUserByEmail } = require('../models/userModel');

router.get('/login', (req, res) => {
  res.render('login', { error: null });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username=$1', [username]);
    if (result.rows.length === 0) {
      return res.render('login', { error: 'Sai tài khoản hoặc mật khẩu' });
    }
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.render('login', { error: 'Sai tài khoản hoặc mật khẩu' });
    }
    req.session.user = { id: user.id, username: user.username };
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.render('login', { error: 'Lỗi server khi đăng nhập' });
  }
});

router.get('/register', (req, res) => {
  res.render('register', { error: null });
});

router.post('/register', async (req, res) => {
  const { username, password, confirmPassword, email, phone } = req.body;
  try {
    // Kiểm tra confirmPassword
    if (password !== confirmPassword) {
      return res.render('register', { error: 'Mật khẩu và nhập lại mật khẩu không khớp' });
    }

    // Kiểm tra username đã tồn tại
    const existingUser = await findUserByUsername(username);
    if (existingUser) {
      return res.render('register', { error: 'Tên tài khoản đã tồn tại' });
    }

    // Kiểm tra email đã tồn tại
    const existingEmail = await findUserByEmail(email);
    if (existingEmail) {
      return res.render('register', { error: 'Email đã được sử dụng' });
    }

    // Kiểm tra định dạng số điện thoại (tùy chọn, 10-11 số)
    if (!/^\d{10,11}$/.test(phone)) {
      return res.render('register', { error: 'Số điện thoại phải có 10-11 chữ số' });
    }

    // Tạo người dùng mới
    await createUser(username, password, email, phone);
    res.redirect('/user/login');
  } catch (err) {
    console.error(err);
    res.render('register', { error: 'Lỗi server khi đăng ký' });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

module.exports = router;