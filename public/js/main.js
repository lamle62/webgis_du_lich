let map = null;
let markersLayer = null;
let selectedPlaces = [];
let placesData = {};
let routeLayer = null;

// 🛡️ Khởi tạo icon chỉ khi có Leaflet
let icons = {};
if (typeof L !== "undefined") {
  icons = {
    tourism: L.icon({
      iconUrl: "/images/icons/tourism.png",
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -30],
    }),
    restaurant: L.icon({
      iconUrl: "/images/icons/restaurant.png",
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -30],
    }),
    hotel: L.icon({
      iconUrl: "/images/icons/hotel.png",
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -30],
    }),
    default: L.icon({
      iconUrl: "/images/icons/default.png",
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -25],
    }),
  };
} else {
  console.warn(
    "[main.js] Leaflet not loaded — icons disabled (normal on non-map pages)"
  );
}

/* ------------------ UTILITY ------------------ */
const log = (msg, ...args) => console.log(`[main.js] ${msg}`, ...args);
const warn = (msg, ...args) => console.warn(`[main.js] ${msg}`, ...args);

function checkLoginStatus() {
  return !!window.currentUser;
}

/* ------------------ INITIALIZE MAP ------------------ */
function initializeMap() {
  if (typeof L === "undefined") return false;
  const mapDiv = document.getElementById("map");
  if (!mapDiv) return false;

  map = L.map("map", { center: [16.0666, 108.2498], zoom: 12 });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
    maxZoom: 18,
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
  routeLayer = L.layerGroup().addTo(map);
  log("Map & markersLayer initialized");
  return true;
}

/* ------------------ LOAD PLACES DATA ------------------ */
async function loadPlacesData() {
  if (!map || !markersLayer) return;

  try {
    const res = await fetch("/places/geojson", {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const geojson = await res.json();

    if (!Array.isArray(geojson.features)) {
      warn("GeoJSON không hợp lệ");
      return;
    }

    markersLayer.clearLayers();
    placesData = {};
    const bounds = L.latLngBounds();

    geojson.features.forEach((f) => {
      const id = f.properties?.id;
      const name = f.properties?.name;
      if (!id || !name) return;

      const [lng, lat] = f.geometry.coordinates;
      if (!lng || !lat) return;

      // Tạo đối tượng p để dùng trong popup và filter
      const p = {
        id,
        name,
        type: f.properties.type || "default",
        province: f.properties.province || "",
        address: f.properties.address || "",
        description: f.properties.description || "Không có mô tả",
        coordinates: [lng, lat],
        image_url: f.properties.image_url || null,
      };

      // Lưu vào placesData
      placesData[id] = p;

      // Icon
      const iconType = icons[p.type.toLowerCase()] || icons.default;

      // HTML ảnh
      let imageHtml = "";
      if (p.image_url) {
        imageHtml = `
      <div style="margin-bottom: 8px; text-align: center;">
        <img src="${p.image_url}" alt="${p.name}" 
             onclick="openImageModal('${p.image_url}')"
             style="max-width:100%;max-height:120px;border-radius:6px;box-shadow:0 2px 6px rgba(0,0,0,0.1);cursor:zoom-in;">
      </div>`;
      }

      // Marker & Popup
      const marker = L.marker([lat, lng], { icon: iconType }).bindPopup(`
  <div style="max-width:260px;font-size:0.9em;">
    ${imageHtml}
    <b style="font-size:1.1em;display:block;margin-bottom:4px;">${p.name}</b>
    <small style="color:#555; display:block; margin-bottom:4px;">
      📍 <b>Địa chỉ:</b> ${p.address}
    </small>
    <small style="color:#888; display:block; margin-bottom:6px;">
      🗺️ <b>Tỉnh:</b> ${p.province || "Không rõ"}
    </small>
    <hr style="margin:6px 0;border:0;border-top:1px solid #eee;">
    <p style="margin:6px 0;line-height:1.4;max-height:60px;overflow-y:auto;">
      ${p.description.replace(/\n/g, "<br>")}
    </p>
    <div style="text-align:right; margin-top:8px;">
      <button onclick="addPlaceToItinerary(${p.id}, '${p.name.replace(
        /'/g,
        "\\'"
      )}')"
              style="font-size:0.85em;padding:4px 8px;background:var(--primary);color:white;border:none;border-radius:4px;cursor:pointer;">
        Chọn
      </button>
      <button onclick="window.location.href='/places/${p.id}'"
              style="font-size:0.85em;padding:4px 8px;background:#28a745;color:white;border:none;border-radius:4px;cursor:pointer;margin-left:4px;">
        Xem chi tiết
      </button>
    </div>
  </div>
`);

      marker.addTo(markersLayer);
      bounds.extend([lat, lng]);
    });

    if (geojson.features.length) map.fitBounds(bounds);
    log(`Loaded ${geojson.features.length} places`);
  } catch (e) {
    warn("loadPlacesData error:", e);
  }
}

/* ------------------ ADD PLACE TO ITINERARY ------------------ */
window.addPlaceToItinerary = function (placeId, placeName) {
  placeId = parseInt(placeId);
  if (isNaN(placeId)) return alert("Lỗi ID địa điểm");
  if (selectedPlaces.some((p) => p.id === placeId)) {
    alert(`Đã chọn: ${placeName}`);
    return;
  }
  selectedPlaces.push({ id: placeId, time: "" });
  log("Added place:", { id: placeId, name: placeName });
  updateSelectedPlacesUI();
};

/* ------------------ UPDATE SELECTED PLACES UI ------------------ */
function updateSelectedPlacesUI() {
  const container = document.getElementById("selected-places-container");
  if (!container) return;
  if (selectedPlaces.length === 0) {
    container.innerHTML =
      '<p style="color:#666;font-style:italic;margin:0;">Chưa chọn địa điểm nào.</p>';
    return;
  }

  container.innerHTML = "";
  const ul = document.createElement("ul");
  ul.style.margin = "0";
  ul.style.paddingLeft = "20px";

  selectedPlaces.forEach((place, index) => {
    const name = placesData[place.id]?.name || `Địa điểm #${place.id}`;
    const li = document.createElement("li");
    li.style.margin = "8px 0";
    li.innerHTML = `
      <strong>${index + 1}. ${name}</strong>
      <input type="datetime-local" value="${
        place.time
      }" onchange="updatePlaceTime(${
      place.id
    }, this.value)" style="margin-left:10px;font-size:0.9em;width:180px;">
      <button type="button" onclick="removeSelectedPlace(${
        place.id
      })" style="margin-left:5px;font-size:0.8em;padding:2px 6px;">Xóa</button>
    `;
    ul.appendChild(li);
  });

  container.appendChild(ul);
  syncSelectedPlacesToInput();
}

window.updatePlaceTime = function (placeId, time) {
  const place = selectedPlaces.find((p) => p.id === placeId);
  if (place) place.time = time || "";
  syncSelectedPlacesToInput();
};

window.removeSelectedPlace = function (placeId) {
  selectedPlaces = selectedPlaces.filter((p) => p.id !== placeId);
  updateSelectedPlacesUI();
};

function syncSelectedPlacesToInput() {
  const input = document.getElementById("selectedPlacesInput");
  if (input) input.value = JSON.stringify(selectedPlaces);
}

/* ------------------ DRAW ROUTE ------------------ */
window.drawRouteToPlace = function (lat, lng) {
  if (!map) return;
  if (routeLayer) routeLayer.clearLayers();

  const userLatLng = map.getCenter(); // Lấy vị trí trung tâm bản đồ làm start tạm
  const polyline = L.polyline([userLatLng, [lat, lng]], {
    color: "blue",
  }).addTo(routeLayer);
  map.fitBounds(polyline.getBounds());
};

/* ------------------ FILTER / RESET ------------------ */
window.filterPlaces = function () {
  const type = document.getElementById("type-filter")?.value || "";
  const province =
    document.getElementById("province-filter")?.value.trim().toLowerCase() ||
    "";
  const placeItems = document.querySelectorAll("#places-list > div");

  if (placeItems.length > 0) {
    placeItems.forEach((item) => {
      const provinceText = item.textContent.toLowerCase();
      const placeType = item.dataset.type || "";
      const matchType = !type || placeType === type;
      const matchProvince = !province || provinceText.includes(province);
      item.style.display = matchType && matchProvince ? "flex" : "none";
    });
  }

  if (map && markersLayer && Object.keys(placesData).length > 0) {
    markersLayer.clearLayers();
    Object.values(placesData).forEach((p) => {
      const matchType =
        !type || (p.type && p.type.toLowerCase() === type.toLowerCase());
      const matchProvince =
        !province ||
        (p.province && p.province.toLowerCase().includes(province));
      if (!matchType || !matchProvince) return;

      const [lng, lat] = p.coordinates || [];
      if (!lat || !lng) return;

      const iconType = icons[p.type?.toLowerCase()] || icons.default;
      const description = p.description || "Không có mô tả";
      const imageUrl = p.image_url ? p.image_url : null;
      let imageHtml = "";
      if (imageUrl) {
        imageHtml = `<div style="margin-bottom:8px;text-align:center;">
          <img src="${imageUrl}" alt="${p.name}" style="max-width:100%;max-height:120px;border-radius:6px;box-shadow:0 2px 6px rgba(0,0,0,0.1);cursor:zoom-in;">
        </div>`;
      }

      const marker = L.marker([lat, lng], { icon: iconType }).bindPopup(`
        <div style="max-width:260px; font-size:0.9em;">
          ${imageHtml}
          <b style="font-size:1.1em; display:block; margin-bottom:4px;">${
            p.name
          }</b>
          <small style="color:#555; display:block; margin-bottom:4px;">
            📍 <b>Địa chỉ:</b> ${p.address || "Không có địa chỉ"}
          </small>
          <small style="color:#888; display:block; margin-bottom:6px;">
            🗺️ <b>Tỉnh:</b> ${p.province || "Không rõ"}
          </small>
          <hr style="margin:6px 0; border:0; border-top:1px solid #eee;">
          <p style="margin:6px 0; line-height:1.4; max-height:60px; overflow-y:auto;">
            ${description.replace(/\n/g, "<br>")}
          </p>
          <div style="text-align:right; margin-top:8px;">
            <button onclick="addPlaceToItinerary(${p.id}, '${p.name.replace(
        /'/g,
        "\\'"
      )}')"
                    style="font-size:0.85em;padding:4px 8px;background:var(--primary);color:white;border:none;border-radius:4px;cursor:pointer;">
              Chọn
            </button>
            <button onclick="window.location.href='/places/${p.id}'"
          style="font-size:0.85em;padding:4px 8px;background:#2a9df4;color:white;border:none;border-radius:4px;cursor:pointer;margin-left:4px;">
    Xem chi tiết
  </button>
          </div>
        </div>
      `);
      marker.addTo(markersLayer);
    });
  }
};

window.resetFilter = function () {
  const typeFilter = document.getElementById("type-filter");
  const provinceFilter = document.getElementById("province-filter");
  if (typeFilter) typeFilter.value = "";
  if (provinceFilter) provinceFilter.value = "";
  document
    .querySelectorAll("#places-list > div")
    .forEach((item) => (item.style.display = "flex"));
  if (!map || !markersLayer) return;

  markersLayer.clearLayers();
  Object.values(placesData).forEach((p) => {
    const [lng, lat] = p.coordinates || [];
    if (!lat || !lng) return;
    const iconType = icons[p.type?.toLowerCase()] || icons.default;
    const description = p.description || "Không có mô tả";
    const imageUrl = p.image_url ? p.image_url : null;
    let imageHtml = "";
    if (imageUrl) {
      imageHtml = `<div style="margin-bottom:8px;text-align:center;">
        <img src="${imageUrl}" alt="${p.name}" style="max-width:100%;max-height:120px;border-radius:6px;box-shadow:0 2px 6px rgba(0,0,0,0.1);cursor:zoom-in;">
      </div>`;
    }
    const marker = L.marker([lat, lng], { icon: iconType }).bindPopup(`
      <div style="max-width:260px;font-size:0.9em;">
        ${imageHtml}
        <b style="font-size:1.1em; display:block; margin-bottom:4px;">${
          p.name
        }</b>
        <small style="color:#555; display:block; margin-bottom:4px;">
          📍 <b>Địa chỉ:</b> ${p.address || "Không có địa chỉ"}
        </small>
        <small style="color:#888; display:block; margin-bottom:6px;">
          🗺️ <b>Tỉnh:</b> ${p.province || "Không rõ"}
        </small>
        <hr style="margin:6px 0;border:0;border-top:1px solid #eee;">
        <p style="margin:6px 0;line-height:1.4;max-height:60px;overflow-y:auto;">
          ${description.replace(/\n/g, "<br>")}
        </p>
        <div style="text-align:right;margin-top:8px;">
          <button onclick="addPlaceToItinerary(${p.id}, '${p.name.replace(
      /'/g,
      "\\'"
    )}')"
                  style="font-size:0.85em;padding:4px 8px;background:var(--primary);color:white;border:none;border-radius:4px;cursor:pointer;">
            Chọn
          </button>
          <button onclick="drawRouteToPlace(${lat}, ${lng})"
                  style="font-size:0.85em;padding:4px 8px;background:#555;color:white;border:none;border-radius:4px;cursor:pointer;margin-left:4px;">
            Xem tuyến
          </button>
          <button onclick="window.location.href='/places/${p.id}'"
          style="font-size:0.85em;padding:4px 8px;background:#2a9df4;color:white;border:none;border-radius:4px;cursor:pointer;margin-left:4px;">
    Xem chi tiết
  </button>
        </div>
      </div>
    `);
    marker.addTo(markersLayer);
  });
};

/* ------------------ PROFILE MODAL ------------------ */
window.openProfileModal = async function () {
  const modal = document.getElementById("profile-modal");
  const infoBox = document.getElementById("profile-info");
  const avatar = document.getElementById("profile-avatar");
  if (!modal || !infoBox) return;

  modal.style.display = "flex";
  document.body.style.overflow = "hidden";
  infoBox.innerHTML = "<p>Đang tải thông tin...</p>";

  try {
    const res = await fetch("/user/profile-data");
    if (!res.ok) throw new Error("Không thể tải thông tin hồ sơ");
    const json = await res.json();
    if (!json.success || !json.data) {
      infoBox.innerHTML = `<p style="color:red;">${
        json.message || "Lỗi tải hồ sơ"
      }</p>`;
      return;
    }
    const { username, email, phone, createdAt, avatar: avatarUrl } = json.data;
    if (avatarUrl) avatar.src = avatarUrl;
    infoBox.innerHTML = `
      <p><strong>Tên đăng nhập:</strong> ${username}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Số điện thoại:</strong> ${phone || "Chưa cập nhật"}</p>
      <p><strong>Ngày tham gia:</strong> ${new Date(
        createdAt
      ).toLocaleDateString("vi-VN")}</p>
    `;
  } catch (err) {
    console.error("Lỗi load hồ sơ:", err);
    infoBox.innerHTML =
      '<p style="color:red;">Không thể tải thông tin hồ sơ.</p>';
  }
};

window.closeProfileModal = function () {
  const modal = document.getElementById("profile-modal");
  if (modal) {
    modal.style.display = "none";
    document.body.style.overflow = "";
  }
};

/* ------------------ IMAGE MODAL ------------------ */
window.openImageModal = function (url) {
  const modal = document.getElementById("image-modal");
  const img = document.getElementById("image-modal-img");
  if (!modal || !img) return;
  img.src = url;
  modal.style.display = "flex";
};

window.closeImageModal = function () {
  const modal = document.getElementById("image-modal");
  if (modal) modal.style.display = "none";
};

/* ------------------ DOMContentLoaded ------------------ */
document.addEventListener("DOMContentLoaded", () => {
  initializeMap();
  loadPlacesData();

  document
    .getElementById("filter-btn")
    ?.addEventListener("click", () => filterPlaces());
  document
    .getElementById("reset-btn")
    ?.addEventListener("click", () => resetFilter());
  document
    .getElementById("profile-btn")
    ?.addEventListener("click", () => openProfileModal());
  document
    .getElementById("profile-modal-close")
    ?.addEventListener("click", () => closeProfileModal());
  document
    .getElementById("image-modal-close")
    ?.addEventListener("click", () => closeImageModal());

  log("DOMContentLoaded - all listeners attached");
});
