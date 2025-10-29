exports.showLogin = (req, res) => {
  res.render('login', { error: null });
};

exports.showRegister = (req, res) => {
  res.render('register', { error: null });
};

exports.logout = (req, res) => {
  req.session.destroy(err => {
    if (err) console.error('Logout error:', err);
    res.redirect('/');
  });
};