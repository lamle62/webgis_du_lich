// Placeholder cho các tương tác admin (xóa confirm, live upload, v.v.)
document.querySelectorAll('a[href*="delete"]').forEach((a) => {
  a.addEventListener("click", (e) => {
    if (!confirm("Bạn có chắc chắn xoá không?")) e.preventDefault();
  });
});

// Lấy tất cả link trong nav
const navLinks = document.querySelectorAll(".admin-nav a");

// Lấy path hiện tại
const currentPath = window.location.pathname;

// Duyệt qua từng link
navLinks.forEach((link) => {
  // Nếu href của link trùng hoặc nằm trong currentPath
  if (currentPath.startsWith(link.getAttribute("href"))) {
    link.classList.add("active");
  }
});
