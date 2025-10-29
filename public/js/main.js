
let map = null;
let markersLayer = null;
let selectedPlaces = [];
let placesData = {};

/*  1. HÀM CÔNG CỤ (utility)                                    */
const log = (msg, ...args) => console.log(`[main.js] ${msg}`, ...args);
const warn = (msg, ...args) => console.warn(`[main.js] ${msg}`, ...args);


/*  2. KIỂM TRA ĐĂNG NHẬP                                       */
async function checkLoginStatus() {
  try {
    const res = await fetch('/user/check', { headers: { Accept: 'application/json' } });
    if (!res.ok) return false;
    const data = await res.json();
    return data.isLoggedIn === true;
  } catch (e) {
    warn('checkLoginStatus error:', e);
    return false;
  }
}


/*  3. KHỞI TẠO BẢN ĐỒ (chỉ 1 lần)                              */
function initializeMap() {
  const mapDiv = document.getElementById('map');
  if (!mapDiv) {
    log('Map div not found – skipped (normal on non-map pages)');
    return false;
  }

  map = L.map('map', { center: [16.0666, 108.2498], zoom: 12 });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 18
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
  log('Map & markersLayer initialized');
  return true;
}

/*  4. TẢI DỮ LIỆU ĐỊA ĐIỂM (GeoJSON)                           */
async function loadPlacesData() {
  if (!map || !markersLayer) {
    warn('Map/markersLayer chưa sẵn sàng → bỏ qua loadPlacesData');
    return;
  }

  try {
    const res = await fetch('/places/geojson', { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const geojson = await res.json();

    if (!Array.isArray(geojson.features)) {
      warn('GeoJSON không hợp lệ');
      return;
    }

    markersLayer.clearLayers();
    placesData = {};
    const bounds = L.latLngBounds();

    geojson.features.forEach(f => {
      const id = f.properties?.id;
      const name = f.properties?.name;
      if (!id || !name) return;

      const [lng, lat] = f.geometry.coordinates;
      if (!lng || !lat) return;

      placesData[id] = f.properties;

      const marker = L.marker([lat, lng])
        .bindPopup(`
          <b>${name}</b><br>
          ${f.properties.province || ''}<br>
          <button onclick="addPlaceToItinerary(${id}, '${name.replace(/'/g, "\\'")}')">
            Chọn
          </button>
        `);
      marker.addTo(markersLayer);
      bounds.extend([lat, lng]);
    });

    if (geojson.features.length) map.fitBounds(bounds);
    log(`Loaded ${geojson.features.length} places`);
  } catch (e) {
    warn('loadPlacesData error:', e);
  }
}

/*  5. CHỌN ĐỊA ĐIỂM – TRANG TẠO LỊCH TRÌNH                      */

window.addPlaceToItinerary = function (placeId, placeName) {
  placeId = parseInt(placeId);
  if (isNaN(placeId)) return alert('Lỗi ID địa điểm');

  if (selectedPlaces.some(p => p.id === placeId)) {
    alert(`Đã chọn: ${placeName}`);
    return;
  }

  selectedPlaces.push({ id: placeId, time: '' });
  log('Added place:', { id: placeId, name: placeName });
  updateSelectedPlacesUI();
};

/* CẬP NHẬT GIAO DIỆN DANH SÁCH ĐÃ CHỌN */
function updateSelectedPlacesUI() {
  const container = document.getElementById('selected-places-container');
  if (!container) {
    log('No #selected-places-container → skip UI update');
    return;
  }

  container.innerHTML = '';

  if (selectedPlaces.length === 0) {
    container.innerHTML = '<p style="color: #666; font-style: italic; margin: 0;">Chưa chọn địa điểm nào.</p>';
    return;
  }

  const ul = document.createElement('ul');
  ul.style.margin = '0';
  ul.style.paddingLeft = '20px';

  selectedPlaces.forEach((place, index) => {
    const name = placesData[place.id]?.name || `Địa điểm #${place.id}`;
    const li = document.createElement('li');
    li.style.margin = '8px 0';
    li.innerHTML = `
      <strong>${index + 1}. ${name}</strong>
      <input type="datetime-local" value="${place.time}" 
             onchange="window.updatePlaceTime(${place.id}, this.value)"
             style="margin-left: 10px; font-size: 0.9em; width: 180px;">
      <button type="button" onclick="window.removeSelectedPlace(${place.id})" 
              style="margin-left: 5px; font-size: 0.8em; padding: 2px 6px;">
        Xóa
      </button>
    `;
    ul.appendChild(li);
  });

  container.appendChild(ul);
  syncSelectedPlacesToInput();
  log('UI updated:', selectedPlaces);
}

/* CẬP NHẬT THỜI GIAN */
window.updatePlaceTime = function (placeId, time) {
  const place = selectedPlaces.find(p => p.id === placeId);
  if (place) {
    place.time = time || '';
    updateSelectedPlacesUI();
  }
};

/* XÓA ĐỊA ĐIỂM */
window.removeSelectedPlace = function (placeId) {
  selectedPlaces = selectedPlaces.filter(p => p.id !== placeId);
  updateSelectedPlacesUI();
};

/* ĐỒNG BỘ DỮ LIỆU VÀO INPUT ẨN */
function syncSelectedPlacesToInput() {
  const input = document.getElementById('selectedPlacesInput');
  if (input) {
    input.value = JSON.stringify(selectedPlaces);
    log('Synced to input:', selectedPlaces);
  }
}

/*  6. CHỈNH SỬA LỊCH TRÌNH (trang chi tiết)                    */
window.updatePlaceTimeInEdit = function (placeId, time) {
  document.querySelectorAll('.edit-place-item').forEach(item => {
    if (Number(item.dataset.placeId) === placeId) {
      item.dataset.placeTime = time || '';
    }
  });
  updateEditPlacesInput();
};

function updateEditPlacesInput() {
  const items = document.querySelectorAll('.edit-place-item');
  const places = Array.from(items).map(item => ({
    id: Number(item.dataset.placeId),
    time: item.dataset.placeTime || ''
  }));
  const input = document.getElementById('editPlacesInput');
  if (input) input.value = JSON.stringify(places);
}

window.removePlaceFromEdit = function (placeId) {
  document.querySelectorAll('.edit-place-item').forEach(item => {
    if (item.dataset.placeId == placeId) item.remove();
  });
  updateEditPlacesInput();
};

function toggleEditForm() {
  const form = document.getElementById('editForm');
  if (!form) return;
  const visible = form.style.display !== 'none';
  form.style.display = visible ? 'none' : 'block';
  if (!visible) {
    loadPlacesForDropdown();
    updateEditPlacesInput();
  }
}

function loadPlacesForDropdown() {
  const select = document.getElementById('addPlaceSelect');
  if (!select) return;

  select.innerHTML = '<option value="">Chọn địa điểm</option>';
  fetch('/places/geojson')
    .then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(data => {
      if (!Array.isArray(data.features)) return;
      data.features.forEach(f => {
        const id = f.properties?.id;
        const name = f.properties?.name;
        const type = f.properties?.type || 'Unknown';
        if (id && name) {
          const opt = document.createElement('option');
          opt.value = id;
          opt.textContent = `${name} (${type})`;
          select.appendChild(opt);
        }
      });
    })
    .catch(() => {
      select.innerHTML = '<option value="">Lỗi tải địa điểm</option>';
    });
}

window.addPlaceToEdit = function () {
  const select = document.getElementById('addPlaceSelect');
  const timeInp = document.getElementById('newPlaceTime');
  const id = select.value;
  const text = select.options[select.selectedIndex]?.text;
  const time = timeInp.value;

  if (!id || !text) return alert('Chọn địa điểm');

  const list = document.getElementById('editPlaceList');
  if (Array.from(list.querySelectorAll('.edit-place-item')).some(i => i.dataset.placeId == id)) {
    return alert('Địa điểm đã có');
  }

  const li = document.createElement('li');
  li.className = 'edit-place-item';
  li.dataset.placeId = id;
  li.dataset.placeTime = time;
  li.innerHTML = `
    ${text}
    <input type="datetime-local" value="${time}" onchange="updatePlaceTimeInEdit(${id}, this.value)">
    <button type="button" onclick="removePlaceFromEdit(${id})">Xóa</button>
  `;
  list.appendChild(li);
  updateEditPlacesInput();
  timeInp.value = '';
};
/*  7. XÓA LỊCH TRÌNH                                            */

window.deleteItinerary = async function (id) {
  if (!confirm('Xóa lịch trình này?')) return;
  try {
    const res = await fetch(`/itineraries/${id}`, { method: 'DELETE' });
    if (res.ok) {
      alert('Đã xóa');
      window.location = '/itineraries/page';
    } else {
      alert('Xóa thất bại');
    }
  } catch (e) {
    alert('Lỗi mạng');
  }
};
/*  8. DOMContentLoaded – CHỈ CHẠY LOGIC CẦN THIẾT              */

document.addEventListener('DOMContentLoaded', async () => {
  const path = location.pathname;
  log('Page loaded:', path);

  // Load map trên trang chủ và tạo lịch trình
  if (path === '/' || path === '/itineraries/create') {
    const isLogged = await checkLoginStatus();
    if (isLogged && document.getElementById('map')) {
      if (initializeMap()) await loadPlacesData();
    } else {
      warn('User not logged in or no map div – skipped');
    }
  }

  // Trang chi tiết: không làm gì với map
  if (/^\/itineraries\/\d+$/.test(path)) {
    log('Detail page – no map needed');
    return;
  }

  // Các trang khác → không làm gì
});