const User = require('../models/userModel');
const bcrypt = require('bcryptjs');

exports.showLogin = (req, res) => {
  res.render('login', { error: null });
};

exports.showRegister = (req, res) => {
  res.render('register', { error: null });
};

exports.register = async (req, res) => {
  const { username, password } = req.body;
  try {
    const existing = await User.findUserByUsername(username);
    if (existing) {
      return res.render('register', { error: 'Tên đăng nhập đã tồn tại!' });
    }
    await User.createUser(username, password);
    res.redirect('/user/login');
  } catch (err) {
    res.render('register', { error: 'Có lỗi xảy ra!' });
  }
};

exports.login = async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findUserByUsername(username);
    if (!user) {
      return res.render('login', { error: 'Sai tài khoản hoặc mật khẩu!' });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.render('login', { error: 'Sai tài khoản hoặc mật khẩu!' });
    }
    req.session.user = { id: user.id, username: user.username };
    res.redirect('/');
  } catch (err) {
    res.render('login', { error: 'Có lỗi xảy ra!' });
  }
};

exports.logout = (req, res) => {
  req.session.destroy();
  res.redirect('/');
};
