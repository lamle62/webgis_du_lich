// middleware/auth.js

module.exports = {
  // 🔹 Kiểm tra đã login chưa
  isLoggedIn: (req, res, next) => {
    if (req.session && req.session.user) return next();
    return res.redirect("/user/login"); // nếu chưa login → redirect login
  },

  // 🔹 Kiểm tra role (admin, user, ...). Truyền role mong muốn
  requireRole: (role) => {
    return (req, res, next) => {
      if (req.session.user && req.session.user.role === role) {
        return next();
      }
      return res.status(403).send("❌ Bạn không có quyền truy cập trang này");
    };
  },

  // 🔹 Middleware cho admin mặc định (dễ dùng cho admin routes)
  isAdmin: (req, res, next) => {
    if (req.session.user && req.session.user.role === "admin") return next();
    return res.status(403).send("❌ Chỉ admin mới được phép truy cập");
  },
};
