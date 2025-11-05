let map = null;
let markersLayer = null;
let selectedPlaces = [];
let placesData = {};

// 🛡️ Khởi tạo icon chỉ khi có Leaflet
let icons = {};
if (typeof L !== 'undefined') {
  icons = {
    tourism: L.icon({
      iconUrl: '/images/icons/tourism.png',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -30]
    }),
    restaurant: L.icon({
      iconUrl: '/images/icons/restaurant.png',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -30]
    }),
    hotel: L.icon({
      iconUrl: '/images/icons/hotel.png',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -30]
    }),
    default: L.icon({
      iconUrl: '/images/icons/default.png',
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -25]
    })
  };
} else {
  console.warn('[main.js] Leaflet not loaded — icons disabled (normal on non-map pages)');
}


/*  1. HÀM CÔNG CỤ (utility)                                    */
const log = (msg, ...args) => console.log(`[main.js] ${msg}`, ...args);
const warn = (msg, ...args) => console.warn(`[main.js] ${msg}`, ...args);


/*  2. KIỂM TRA ĐĂNG NHẬP – DÙNG currentUser */
function checkLoginStatus() {
  return !!window.currentUser;
}


/*  3. KHỞI TẠO BẢN ĐỒ (chỉ 1 lần)                              */
function initializeMap() {
  // 🛡️ Nếu thư viện Leaflet chưa load, bỏ qua hoàn toàn
  if (typeof L === 'undefined') {
    log('Leaflet not loaded — skip map initialization (normal on non-map pages)');
    return false;
  }

  const mapDiv = document.getElementById('map');
  if (!mapDiv) {
    log('Map div not found — skipped (normal on non-map pages)');
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

      // SỬA: LƯU THÊM COORDINATES VÀO placesData ĐỂ resetFilter DÙNG LẠI
      placesData[id] = {
        ...f.properties,
        coordinates: [lng, lat]
      };

      const description = f.properties.description || 'Không có mô tả';
      const imageUrl = f.properties.image_url ? f.properties.image_url : null;

let imageHtml = '';
if (imageUrl) {
  imageHtml = `
    <div style="margin-bottom: 8px; text-align: center;">
      <img src="${imageUrl}" 
           alt="${name}" 
           onclick="openImageModal('${imageUrl}')"
           style="max-width: 100%; max-height: 120px; border-radius: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.1); cursor: zoom-in;"
           title="Click để phóng to">
    </div>
  `;
}

      // Xác định loại địa điểm
const placeType = f.properties.type ? f.properties.type.toLowerCase() : 'default';

// Chọn icon theo loại
const iconType = icons[placeType] || icons.default;

// Tạo marker có icon riêng
const marker = L.marker([lat, lng], { icon: iconType })
  .bindPopup(`
    <div style="max-width: 260px; font-size: 0.9em;">
      ${imageHtml}
      <b style="font-size: 1.1em; display: block; margin-bottom: 4px;">${name}</b>
      <small style="color: #666; display: block; margin-bottom: 6px;">
        ${f.properties.province || ''}
      </small>
      <hr style="margin: 6px 0; border: 0; border-top: 1px solid #eee;">
      <p style="margin: 6px 0; line-height: 1.4; max-height: 60px; overflow-y: auto;">
        ${description.replace(/\n/g, '<br>')}
      </p>
      <div style="text-align: right; margin-top: 8px;">
        <button onclick="addPlaceToItinerary(${id}, '${name.replace(/'/g, "\\'")}')"
                style="font-size: 0.85em; padding: 4px 8px; background: var(--primary); color: white; border: none; border-radius: 4px; cursor: pointer;">
          Chọn
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
  if (!container) return;

  if (selectedPlaces.length === 0) {
    container.innerHTML = '<p style="color: #666; font-style: italic; margin: 0;">Chưa chọn địa điểm nào.</p>';
    return;
  }

  container.innerHTML = '';
  const ul = document.createElement('ul');
  ul.style.margin = '0';
  ul.style.paddingLeft = '20px';

  selectedPlaces.forEach((place, index) => {
    const name = placesData[place.id]?.name || `Địa điểm #${place.id}`;
    const li = document.createElement('li');
    li.style.margin = '8px 0';
    li.innerHTML = `
      <strong>${index + 1}. ${name}</strong>
      <input type="datetime-local" value="${place.time}" onchange="updatePlaceTime(${place.id}, this.value)" style="margin-left: 10px; font-size: 0.9em; width: 180px;">
      <button type="button" onclick="removeSelectedPlace(${place.id})" style="margin-left: 5px; font-size: 0.8em; padding: 2px 6px;">Xóa</button>
    `;
    ul.appendChild(li);
  });

  container.appendChild(ul);
  syncSelectedPlacesToInput();
}

/* CẬP NHẬT THỜI GIAN CHO ĐỊA ĐIỂM */
window.updatePlaceTime = function (placeId, time) {
  const place = selectedPlaces.find(p => p.id === placeId);
  if (place) place.time = time || '';
  syncSelectedPlacesToInput();
};

/* XÓA ĐỊA ĐIỂM ĐÃ CHỌN */
window.removeSelectedPlace = function (placeId) {
  selectedPlaces = selectedPlaces.filter(p => p.id !== placeId);
  updateSelectedPlacesUI();
};

/* ĐỒNG BỘ DỮ LIỆU VÀO HIDDEN INPUT */
function syncSelectedPlacesToInput() {
  const input = document.getElementById('selectedPlacesInput');
  if (input) input.value = JSON.stringify(selectedPlaces);
}

/*  6. CHỈNH SỬA LỊCH TRÌNH – TRANG CHI TIẾT                     */
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
  // Use RESTful DELETE /itineraries/:id
  const res = await fetch(`/itineraries/${id}`, { method: 'DELETE' });
    if (res.ok) {
      alert('Đã xóa');
      window.location = '/itineraries/page';
    } else if (res.status === 401) {
      alert('Bạn cần đăng nhập để xóa lịch trình');
    } else if (res.status === 404) {
      alert('Lịch trình không tồn tại');
    } else {
      // Try to parse error message from server
      try {
        const json = await res.json();
        alert(json.error || 'Xóa thất bại');
      } catch (e) {
        alert('Xóa thất bại');
      }
    }
  } catch (e) {
    alert('Lỗi mạng');
  }
};

/* -----------------------------------------------------------------
   9. TÌM KIẾM & LỌC – ĐỒNG BỘ DANH SÁCH + BẢN ĐỒ
------------------------------------------------------------------- */
window.filterPlaces = function () {
  const type = document.getElementById('type-filter')?.value || '';
  const province = document.getElementById('province-filter')?.value.trim().toLowerCase() || '';
  const placeItems = document.querySelectorAll('#places-list > div');

   if (placeItems.length > 0) {
    placeItems.forEach(item => {
      const provinceText = item.textContent.toLowerCase();
      const placeType = item.dataset.type || '';
      const matchType = !type || placeType === type;
      const matchProvince = !province || provinceText.includes(province);
      item.style.display = matchType && matchProvince ? 'flex' : 'none';
    });
  }

  // Luôn lọc marker trên bản đồ
  if (map && markersLayer && Object.keys(placesData).length > 0) {
    markersLayer.clearLayers();
    Object.values(placesData).forEach(p => {
      const matchType = !type || (p.type && p.type.toLowerCase() === type.toLowerCase());
      const matchProvince = !province || (p.province && p.province.toLowerCase().includes(province));
      if (!matchType || !matchProvince) return;

      const [lng, lat] = p.coordinates || [];
      if (!lat || !lng) return;

      const iconType = icons[p.type?.toLowerCase()] || icons.default;
      const description = p.description || 'Không có mô tả';
      const imageUrl = p.image_url ? p.image_url : null;
      let imageHtml = '';

      if (imageUrl) {
        imageHtml = `
          <div style="margin-bottom:8px;text-align:center;">
            <img src="${imageUrl}" alt="${p.name}" 
                 onclick="openImageModal('${imageUrl}')"
                 style="max-width:100%;max-height:120px;border-radius:6px;box-shadow:0 2px 6px rgba(0,0,0,0.1);cursor:zoom-in;">
          </div>`;
      }

      const marker = L.marker([lat, lng], { icon: iconType })
        .bindPopup(`
          <div style="max-width:260px;font-size:0.9em;">
            ${imageHtml}
            <b style="font-size:1.1em;display:block;margin-bottom:4px;">${p.name}</b>
            <small style="color:#666;display:block;margin-bottom:6px;">${p.province || ''}</small>
            <hr style="margin:6px 0;border:0;border-top:1px solid #eee;">
            <p style="margin:6px 0;line-height:1.4;max-height:60px;overflow-y:auto;">${description.replace(/\n/g, '<br>')}</p>
            <div style="text-align:right;margin-top:8px;">
              <button onclick="addPlaceToItinerary(${p.id}, '${p.name.replace(/'/g, "\\'")}')" 
                      style="font-size:0.85em;padding:4px 8px;background:var(--primary);color:white;border:none;border-radius:4px;cursor:pointer;">
                Chọn
              </button>
            </div>
          </div>
        `);
      marker.addTo(markersLayer);
    });
  }

  log('Filtered on map:', { type, province });


  placeItems.forEach(item => {
    const provinceText = item.textContent.toLowerCase();
    const placeType = item.dataset.type || '';
    const onclickStr = item.querySelector('button')?.getAttribute('onclick') || '';
    const placeIdMatch = onclickStr.match(/addPlaceToItinerary\((\d+)/);
    const placeId = placeIdMatch ? placeIdMatch[1] : null;

    const matchType = !type || placeType === type;
    const matchProvince = !province || provinceText.includes(province);

    item.style.display = matchType && matchProvince ? 'flex' : 'none';

    if (map && markersLayer && placeId) {
      const marker = [...markersLayer.getLayers()].find(m => {
        const popup = m.getPopup();
        return popup && popup.getContent().includes(`addPlaceToItinerary(${placeId},`);
      });

      if (marker) {
        if (matchType && matchProvince) {
          if (!markersLayer.hasLayer(marker)) markersLayer.addLayer(marker);
        } else {
          if (markersLayer.hasLayer(marker)) markersLayer.removeLayer(marker);
        }
      }
    }
  });

  log('Filtered:', { type, province });
};

/* Reset bộ lọc – HIỆN LẠI TẤT CẢ MARKER TỪ placesData */
window.resetFilter = function () {
  const typeFilter = document.getElementById('type-filter');
  const provinceFilter = document.getElementById('province-filter');
  if (typeFilter) typeFilter.value = '';
  if (provinceFilter) provinceFilter.value = '';

  // 1. Hiện lại danh sách (nếu có)
  document.querySelectorAll('#places-list > div').forEach(item => {
    item.style.display = 'flex';
  });

  // 2. Xóa toàn bộ marker cũ trên map
  if (!map || !markersLayer) return;
  markersLayer.clearLayers();

  // 3. Thêm lại toàn bộ marker từ placesData
  if (Object.keys(placesData).length > 0) {
    Object.values(placesData).forEach(p => {
      const [lng, lat] = p.coordinates || [];
      if (!lat || !lng) return;

      const iconType = icons[p.type?.toLowerCase()] || icons.default;
      const description = p.description || 'Không có mô tả';
      const imageUrl = p.image_url ? p.image_url : null;

      let imageHtml = '';
      if (imageUrl) {
        imageHtml = `
          <div style="margin-bottom: 8px; text-align: center;">
            <img src="${imageUrl}" 
                 alt="${p.name}" 
                 onclick="openImageModal('${imageUrl}')"
                 style="max-width: 100%; max-height: 120px; border-radius: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.1); cursor: zoom-in;">
          </div>
        `;
      }

      const marker = L.marker([lat, lng], { icon: iconType })
        .bindPopup(`
          <div style="max-width: 260px; font-size: 0.9em;">
            ${imageHtml}
            <b style="font-size: 1.1em; display: block; margin-bottom: 4px;">${p.name}</b>
            <small style="color: #666; display: block; margin-bottom: 6px;">
              ${p.province || ''}
            </small>
            <hr style="margin: 6px 0; border: 0; border-top: 1px solid #eee;">
            <p style="margin: 6px 0; line-height: 1.4; max-height: 60px; overflow-y: auto;">
              ${description.replace(/\n/g, '<br>')}
            </p>
            <div style="text-align: right; margin-top: 8px;">
              <button onclick="addPlaceToItinerary(${p.id}, '${p.name.replace(/'/g, "\\'")}')"
                      style="font-size: 0.85em; padding: 4px 8px; background: var(--primary); color: white; border: none; border-radius: 4px; cursor: pointer;">
                Chọn
              </button>
            </div>
          </div>
        `);
      marker.addTo(markersLayer);
    });

    // 4. Fit lại bản đồ cho đẹp
    const bounds = L.latLngBounds(Object.values(placesData).map(p => {
      const [lng, lat] = p.coordinates || [];
      return lat && lng ? [lat, lng] : null;
    }).filter(Boolean));
    if (bounds.isValid()) map.fitBounds(bounds);

    log(`✅ All markers restored (${Object.keys(placesData).length})`);
  } else {
    warn('⚠️ placesData rỗng — không thể khôi phục marker, cần kiểm tra loadPlacesData()');
  }
};

/* -----------------------------------------------------------------
   8. DOMContentLoaded – CHỈ CHẠY LOGIC CẦN THIẾT
------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', async () => {
  const path = location.pathname;
  log('Page loaded:', path);

  // Nếu có div #map ở bất kỳ trang nào, luôn khởi tạo bản đồ và tải marker.
  // Điều này đảm bảo Home, Create và các trang khác dùng chung logic map.
  const mapDiv = document.getElementById('map');
  if (mapDiv) {
    const initialized = initializeMap();
    if (initialized) {
      await loadPlacesData();
      // Áp dụng bộ lọc nếu có (yếu tố không bắt buộc)
      try { filterPlaces(); } catch (e) { /* ignore */ }
    } else {
      warn('initializeMap returned false — map div may be missing');
    }

    // Cập nhật UI các địa điểm đã chọn (nếu tồn tại)
    try {
      const isLogged = await checkLoginStatus();
      // updateSelectedPlacesUI will gracefully no-op if no selected-places container
      if (typeof updateSelectedPlacesUI === 'function') updateSelectedPlacesUI();
      if (isLogged) {
        log('User logged in — selection features are available');
      }
    } catch (err) {
      warn('checkLoginStatus failed:', err);
    }
  }

  // Trang chi tiết: không cần xử lý thêm ở đây (nếu muốn giữ hiện trạng, các chức năng chi tiết vẫn hoạt động)
  if (/^\/itineraries\/\d+$/.test(path)) {
    log('Detail page detected');
  }
});

// Thêm chức năng tích status trong bảng danh sách
const itineraryId = window.itineraryId; // Lấy từ EJS
if (itineraryId) {
  document.querySelectorAll('.place-status-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', async function () {
      const placeId = this.dataset.placeId;
      const isDone = this.checked;

      try {
        const res = await 
        fetch(`/itineraries/${itineraryId}/toggle-status`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
    body: JSON.stringify({ placeId: Number(placeId), status: isDone })
})
.then(res => {
    if (!res.ok) {
        return res.json().then(err => { throw err; });
    }
    return res.json();
})
.then(data => {
    if (data.success) {
        // CẬP NHẬT UI CHÍNH XÁC
        checkbox.checked = isDone;
        console.log('UI cập nhật thành công:', isDone);
    } else {
        throw new Error(data.error || 'Cập nhật thất bại');
    }
})
.catch(error => {
    console.error('Lỗi cập nhật status:', error.message || error);
    alert('Lỗi cập nhật trạng thái: ' + (error.message || 'Không rõ'));
    // Hoàn tác checkbox nếu lỗi
    checkbox.checked = !isDone;
});

        // Cập nhật label nếu có (tùy chọn, nếu có label)
        const label = this.closest('td').querySelector('.status-label');
        if (label) {
          label.textContent = isDone ? 'Hoàn thành' : 'Chưa hoàn thành';
          label.className = `status-label ${isDone ? 'status-done' : 'status-pending'}`;
        }

        log(`Status updated for place ${placeId}: ${isDone}`);
      } catch (err) {
        alert('Lỗi cập nhật status: ' + err.message);
        this.checked = !isDone; // Rollback checkbox
      }
    });
  });
} else {
  warn('itineraryId not found - skipping status toggle');
}

/* -----------------------------------------------------------------
   10. PROFILE MODAL – LẤY THÔNG TIN NGƯỜI DÙNG VÀ HIỂN THỊ
------------------------------------------------------------------- */

document.addEventListener('DOMContentLoaded', () => {
  const profileLink = document.getElementById('profile-link');
  const modal = document.getElementById('profile-modal');
  const closeBtn = modal ? modal.querySelector('.close-modal') : null;

  // Mở modal khi click "Hồ sơ"
  if (profileLink && modal) {
    profileLink.addEventListener('click', async (e) => {
      e.preventDefault();

      try {
        const res = await fetch('/user/profile-data');
        if (!res.ok) throw new Error('Không lấy được dữ liệu hồ sơ');
        const json = await res.json();

        if (json.success) {
          const { username, email, phone, createdAt } = json.data;
          modal.querySelector('.profile-info').innerHTML = `
            <p><strong>Tên đăng nhập:</strong> ${username}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Số điện thoại:</strong> ${phone || 'Chưa cập nhật'}</p>
            <p><strong>Ngày tham gia:</strong> ${new Date(createdAt).toLocaleDateString('vi-VN')}</p>
          `;
        } else {
          modal.querySelector('.profile-info').innerHTML = `<p>Lỗi: ${json.message}</p>`;
        }
      } catch (err) {
        modal.querySelector('.profile-info').innerHTML = `<p style="color:red;">Không thể tải thông tin hồ sơ.</p>`;
      }

      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    });
  }

  // Nút đóng
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    });
  }

  // Click ra ngoài để đóng
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
      }
    });
  }
});

// ====================== PROFILE MODAL ======================
window.openProfileModal = async function () {
  const modal = document.getElementById('profile-modal');
  const infoBox = document.getElementById('profile-info');
  const avatar = document.getElementById('profile-avatar');

  if (!modal || !infoBox) return;

  // Hiện modal trước
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  infoBox.innerHTML = '<p>Đang tải thông tin...</p>';

  try {
    const res = await fetch('/user/profile-data');
    if (!res.ok) throw new Error('Không thể tải thông tin người dùng');
    const json = await res.json();

    if (!json.success || !json.data) {
      infoBox.innerHTML = `<p style="color:red;">${json.message || 'Lỗi tải hồ sơ'}</p>`;
      return;
    }

    const { username, email, phone, createdAt, avatar: avatarUrl } = json.data;
    if (avatarUrl) avatar.src = avatarUrl;

    infoBox.innerHTML = `
      <p><strong>Tên đăng nhập:</strong> ${username}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Số điện thoại:</strong> ${phone || 'Chưa cập nhật'}</p>
      <p><strong>Ngày tham gia:</strong> ${new Date(createdAt).toLocaleDateString('vi-VN')}</p>
    `;
  } catch (err) {
    console.error('Lỗi load hồ sơ:', err);
    infoBox.innerHTML = '<p style="color:red;">Không thể tải thông tin hồ sơ.</p>';
  }
};

window.closeProfileModal = function () {
  const modal = document.getElementById('profile-modal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
};

// Click ra ngoài để đóng
document.addEventListener('click', (e) => {
  const modal = document.getElementById('profile-modal');
  if (modal && e.target === modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
});
