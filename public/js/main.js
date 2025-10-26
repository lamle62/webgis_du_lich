  let selectedPlaces = [];
  let placesData = {};
  let map;
  let markersLayer; // Layer để quản lý các marker

  // Hàm chuẩn hóa province (thêm vào main.js)
function normalizeProvince(input) {
  if (!input) return '';
  const map = {
    'da nang': 'Đà Nẵng',
    'ha noi': 'Hà Nội',
    'ho chi minh': 'Hồ Chí Minh',
    'hue': 'Huế',
    // Thêm các tỉnh khác nếu cần
  };
  const normalized = input.trim().toLowerCase();
  return map[normalized] || input.trim();
}

  // Kiểm tra trạng thái đăng nhập
  async function checkLoginStatus() {
    try {
      console.log('Fetching /user/check at', new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }));
      const response = await fetch('/user/check', {
        headers: { 'Accept': 'application/json' },
      });
      if (!response.ok) {
        console.warn('Error checking login status, status:', response.status, 'statusText:', response.statusText);
        return false;
      }
      const data = await response.json();
      console.log('Login status:', data);
      return data.isLoggedIn;
    } catch (error) {
      console.error('Error checking login status:', error.message);
      return false;
    }
  }

  function initializeMap() {
    const mapDiv = document.getElementById('map');
    if (!mapDiv) {
      console.warn('Map div not found. User may not be logged in.');
      return false;
    }
    map = L.map('map', {
      center: [16.0666, 108.2498],
      zoom: 12,
      zoomControl: true
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18
    }).addTo(map);
    // Khởi tạo layer cho markers
    markersLayer = L.layerGroup().addTo(map);
    console.log('Map initialized with center: [16.0666, 108.2498], zoom: 12');
    console.log('Map div size:', { width: mapDiv.offsetWidth, height: mapDiv.offsetHeight });
    return true;
  }

  async function loadPlacesData() {
    if (!map || !markersLayer) {
    console.error('Map or markersLayer not initialized. Aborting loadPlacesData.');
    alert('Lỗi: Bản đồ chưa được khởi tạo. Vui lòng tải lại trang.');
    return false;
  }
  try {
    console.log('Starting to fetch /places/geojson for placesData');
    const response = await fetch('/places/geojson', {
      headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) {
      console.error('Error fetching places:', response.status, response.statusText);
      alert('Lỗi khi tải dữ liệu địa điểm');
      return false;
    }
    const geojson = await response.json();
    console.log('GeoJSON received:', geojson);
    if (!geojson.features || !Array.isArray(geojson.features)) {
      console.warn('No features or invalid features in GeoJSON:', geojson);
      alert('Không có dữ liệu địa điểm hợp lệ');
      return false;
    }
    // Xóa tất cả marker trước khi thêm mới
    if (markersLayer) {
      markersLayer.clearLayers();
      console.log('Cleared all markers in loadPlacesData');
    } else {
      console.error('markersLayer is not defined in loadPlacesData');
      return false;
    }
    placesData = {};
    const bounds = L.latLngBounds();
    geojson.features.forEach(feature => {
      const id = feature.properties.id;
      placesData[id] = feature.properties;
      if (feature.geometry.coordinates[0] && feature.geometry.coordinates[1]) {
        const latlng = [feature.geometry.coordinates[1], feature.geometry.coordinates[0]];
        const marker = L.marker(latlng, { placeId: id })
          .bindPopup(`<b>${feature.properties.name}</b><br>${feature.properties.province}<br><button onclick="addPlaceToItinerary(${id}, '${feature.properties.name.replace(/'/g, "\\'")}')">Chọn</button>`);
        markersLayer.addLayer(marker);
        bounds.extend(latlng);
        console.log('Added marker in loadPlacesData:', { id, name: feature.properties.name });
      } else {
        console.warn('Invalid coordinates for feature:', feature);
      }
    });
    console.log('Places data loaded:', Object.keys(placesData).length, 'markers');
    if (geojson.features.length > 0) {
      map.fitBounds(bounds);
      console.log('Map adjusted to bounds:', bounds.toBBoxString());
    }
    updatePlacesListUI(geojson.features);
    return true;
  } catch (error) {
    console.error('Error loading places data:', error.message);
    alert('Lỗi khi tải dữ liệu địa điểm: ' + error.message);
    return false;
  }
}

async function filterPlaces(event) {
  event.preventDefault();
  console.log('filterPlaces called at', new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const form = document.getElementById('filter-form');
  if (!form) {
    console.error('Filter form not found');
    alert('Lỗi: Không tìm thấy form lọc');
    return;
  }
  const typeFilter = document.getElementById('type-filter')?.value || '';
  const provinceFilter = normalizeProvince(document.getElementById('province-filter')?.value || '');
  console.log('Filtering places with:', { type: typeFilter, province: provinceFilter });

  if (!typeFilter && !provinceFilter) {
    console.warn('No filter criteria provided, loading all places');
    alert('Vui lòng chọn ít nhất một tiêu chí lọc (loại hoặc tỉnh/thành)');
    resetFilter();
    return;
  }

  const filterButton = form.querySelector('button[type="submit"]');
  if (filterButton) {
    filterButton.disabled = true;
    filterButton.textContent = 'Đang lọc...';
  }

  try {
    const params = new URLSearchParams();
    if (typeFilter) params.append('type', typeFilter);
    if (provinceFilter) params.append('province', provinceFilter);
    const url = `/places/geojson?${params.toString()}`;
    console.log('Fetching filtered places from:', url);

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) {
      console.error('Error fetching filtered places:', response.status, response.statusText);
      alert(`Lỗi khi tải dữ liệu địa điểm: ${response.statusText}`);
      return;
    }
    const geojson = await response.json();
    console.log('Filtered GeoJSON received:', geojson);

    // Xóa layer cũ và tạo mới
    if (markersLayer) {
      map.removeLayer(markersLayer);
      console.log('Removed old markersLayer in filterPlaces');
    }
    markersLayer = L.layerGroup().addTo(map);
    console.log('Created new markersLayer in filterPlaces');

    placesData = {};
    const bounds = L.latLngBounds();

    if (geojson.features && Array.isArray(geojson.features) && geojson.features.length > 0) {
      geojson.features.forEach(feature => {
        const id = feature.properties.id;
        placesData[id] = feature.properties;
        if (feature.geometry.coordinates[0] && feature.geometry.coordinates[1]) {
          const latlng = [feature.geometry.coordinates[1], feature.geometry.coordinates[0]];
          const marker = L.marker(latlng, { placeId: id })
            .bindPopup(`<b>${feature.properties.name}</b><br>${feature.properties.province}<br><button onclick="addPlaceToItinerary(${id}, '${feature.properties.name.replace(/'/g, "\\'")}')">Chọn</button>`);
          markersLayer.addLayer(marker);
          bounds.extend(latlng);
          console.log('Added marker in filterPlaces:', { id, name: feature.properties.name });
        } else {
          console.warn('Invalid coordinates for feature:', feature);
        }
      });
      console.log(`Added ${geojson.features.length} markers to map`);
      alert(`Tìm thấy ${geojson.features.length} địa điểm phù hợp.`);
      if (geojson.features.length > 0) {
        map.fitBounds(bounds);
        console.log('Map adjusted to bounds:', bounds.toBBoxString());
      }
    } else {
      console.warn('No features or invalid features in filtered GeoJSON:', geojson);
      alert('Không tìm thấy địa điểm phù hợp với bộ lọc.');
    }

    updatePlacesListUI(geojson.features || []);
  } catch (error) {
    console.error('Error filtering places:', error.message);
    alert('Lỗi khi lọc địa điểm: ' + error.message);
  } finally {
    if (filterButton) {
      filterButton.disabled = false;
      filterButton.textContent = 'Lọc';
    }
  }
}

function resetFilter() {
  console.log('resetFilter called at', new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const typeFilter = document.getElementById('type-filter');
  const provinceFilter = document.getElementById('province-filter');
  if (typeFilter) typeFilter.value = '';
  if (provinceFilter) provinceFilter.value = '';
  if (markersLayer) {
    map.removeLayer(markersLayer);
    console.log('Removed old markersLayer in resetFilter');
  }
  markersLayer = L.layerGroup().addTo(map);
  console.log('Created new markersLayer in resetFilter');
  placesData = {};
  loadPlacesData();
}

function updatePlacesListUI(features) {
  const placesListDiv = document.getElementById('places-list');
  if (!placesListDiv) {
    console.warn('Places list div not found');
    return;
  }
  placesListDiv.innerHTML = '';
  if (!features || features.length === 0) {
    placesListDiv.innerHTML = '<p>Chưa có địa điểm nào.</p>';
    return;
  }
  features.forEach(feature => {
    const place = feature.properties;
    const div = document.createElement('div');
    div.innerHTML = `
      ${place.name} - ${place.province}
      <button onclick="addPlaceToItinerary(${place.id}, '${place.name.replace(/'/g, "\\'")}')">Chọn</button>
    `;
    placesListDiv.appendChild(div);
  });
  console.log('Places list UI updated with', features.length, 'items');
}

  function addPlaceToItinerary(placeId, placeName) {
    placeId = parseInt(placeId);
    if (!placeId) {
      console.error('Invalid placeId:', placeId);
      alert('Lỗi: Địa điểm không có ID');
      return;
    }
    if (!selectedPlaces.includes(placeId)) {
      selectedPlaces.push(placeId);
      console.log('Added place to selectedPlaces:', selectedPlaces);
      alert(`Đã chọn: ${placeName}`);
      updateSelectedPlacesUI();
    } else {
      alert(`Địa điểm ${placeName} đã được chọn`);
    }
  }

  function updateSelectedPlacesUI() {
    const selectedPlacesDiv = document.getElementById('selected-places');
    if (!selectedPlacesDiv) {
      console.warn('Selected places div not found');
      return;
    }
    selectedPlacesDiv.innerHTML = '';
    if (selectedPlaces.length === 0) {
      selectedPlacesDiv.innerHTML = '<p>Chưa chọn địa điểm nào.</p>';
      return;
    }
    selectedPlaces.forEach(placeId => {
      const place = placesData[placeId];
      if (place) {
        console.log('Displaying place:', { placeId, name: place.name, province: place.province });
        const div = document.createElement('div');
        div.className = 'selected-place';
        div.innerHTML = `${place.name} (${place.province}) <button onclick="removePlace(${placeId})">Xóa</button>`;
        selectedPlacesDiv.appendChild(div);
      } else {
        console.warn('Place not found in placesData:', placeId); // Dòng 82
        const div = document.createElement('div');
        div.className = 'selected-place';
        div.innerHTML = `Địa điểm ID ${placeId} (chưa tải thông tin) <button onclick="removePlace(${placeId})">Xóa</button>`;
        selectedPlacesDiv.appendChild(div);
      }
    });
    const selectedPlacesInput = document.getElementById('selected-places-input');
    if (selectedPlacesInput) {
      selectedPlacesInput.value = JSON.stringify(selectedPlaces);
      console.log('Updated selected-places-input:', selectedPlacesInput.value);
    }
  }

  function removePlace(placeId) {
    selectedPlaces = selectedPlaces.filter(id => id !== placeId);
    console.log('Removed place, updated selectedPlaces:', selectedPlaces);
    updateSelectedPlacesUI();
  }

  async function loadPlacesData() {
  try {
    console.log('Starting to fetch /places/geojson for placesData');
    const response = await fetch('/places/geojson', {
      headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) {
      console.error('Error fetching places:', response.status, response.statusText);
      alert('Lỗi khi tải dữ liệu địa điểm');
      return false;
    }
    const geojson = await response.json();
    console.log('GeoJSON received:', geojson);
    if (!geojson.features || !Array.isArray(geojson.features)) {
      console.warn('No features or invalid features in GeoJSON:', geojson);
      alert('Không có dữ liệu địa điểm hợp lệ');
      return false;
    }
    // Xóa layer cũ và tạo mới
    if (markersLayer) {
      map.removeLayer(markersLayer);
      console.log('Removed old markersLayer in loadPlacesData');
    }
    markersLayer = L.layerGroup().addTo(map);
    console.log('Created new markersLayer in loadPlacesData');
    placesData = {};
    const bounds = L.latLngBounds();
    geojson.features.forEach(feature => {
      const id = feature.properties.id;
      placesData[id] = feature.properties;
      if (feature.geometry.coordinates[0] && feature.geometry.coordinates[1]) {
        const latlng = [feature.geometry.coordinates[1], feature.geometry.coordinates[0]];
        const marker = L.marker(latlng, { placeId: id })
          .bindPopup(`<b>${feature.properties.name}</b><br>${feature.properties.province}<br><button onclick="addPlaceToItinerary(${id}, '${feature.properties.name.replace(/'/g, "\\'")}')">Chọn</button>`);
        markersLayer.addLayer(marker);
        bounds.extend(latlng);
        console.log('Added marker in loadPlacesData:', { id, name: feature.properties.name });
      } else {
        console.warn('Invalid coordinates for feature:', feature);
      }
    });
    console.log('Places data loaded:', Object.keys(placesData).length, 'markers');
    if (geojson.features.length > 0) {
      map.fitBounds(bounds);
      console.log('Map adjusted to bounds:', bounds.toBBoxString());
    }
    updatePlacesListUI(geojson.features);
    return true;
  } catch (error) {
    console.error('Error loading places data:', error.message);
    alert('Lỗi khi tải dữ liệu địa điểm: ' + error.message);
    return false;
  }
}

  async function loadMap() {
    // Tải placesData trước để hỗ trợ UI ngay cả khi không đăng nhập
    await loadPlacesData();

    const isLoggedIn = await checkLoginStatus();
    if (!isLoggedIn) {
      console.warn('User not logged in, skipping map initialization'); // Dòng 135
      updateSelectedPlacesUI();
      return;
    }
    if (!initializeMap()) return;

    try {
      console.log('Starting to fetch /places/geojson for map');
      const response = await fetch('/places/geojson', {
        headers: { 'Accept': 'application/json' },
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response from /places/geojson:', errorText);
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const geojson = await response.json();
      console.log('GeoJSON received:', JSON.stringify(geojson, null, 2));
      if (!geojson.features || !Array.isArray(geojson.features) || geojson.features.length === 0) {
        console.warn('No features or invalid features in GeoJSON:', geojson);
        alert('Không có địa điểm nào để hiển thị trên bản đồ');
        return;
      }
      geojson.features.forEach(feature => {
        const id = feature.properties.id;
        placesData[id] = feature.properties;
        console.log('Processed feature:', { id, coordinates: feature.geometry.coordinates });
      });
      const geoJsonLayer = L.geoJSON(geojson, {
        onEachFeature: function (feature, layer) {
          if (!feature.geometry || !feature.geometry.coordinates) {
            console.warn('Invalid geometry for feature:', feature);
            return;
          }
          console.log('Adding marker for:', feature.properties.name, feature.geometry.coordinates);
          layer.bindPopup(`<b>${feature.properties.name}</b><br>${feature.properties.description}<br><button onclick="addPlaceToItinerary(${feature.properties.id}, '${feature.properties.name.replace(/'/g, "\\'")}')">Chọn</button>`);
        }
      }).addTo(map);
      if (geojson.features.length > 0) {
        const bounds = geoJsonLayer.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds);
          console.log('Map adjusted to bounds:', bounds);
        } else {
          console.warn('Invalid bounds for GeoJSON layer');
        }
      }
      updateSelectedPlacesUI();
    } catch (error) {
      console.error('Error loading map:', error);
      alert('Lỗi khi tải bản đồ: ' + error.message);
    }
  }

  async function createItinerary(name, places) {
    try {
      console.log('Creating itinerary:', { name, places });
      const response = await fetch('/itineraries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, places })
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error creating itinerary:', errorText);
        throw new Error(`HTTP error! Status: ${response.status}, Response: ${errorText}`);
      }
      const data = await response.json();
      console.log('Itinerary created:', data);
      alert('Tạo lịch trình thành công!');
      await updateItinerariesUI();
      selectedPlaces = [];
      updateSelectedPlacesUI();
      return data;
    } catch (error) {
      console.error('Error creating itinerary:', error);
      alert('Lỗi khi tạo lịch trình: ' + error.message);
    }
  }

  async function updateItinerary(id, name, places) {
    try {
      const response = await fetch(`/itineraries/${id}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, places })
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response from /itineraries:', errorText);
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      console.log('Itinerary updated:', data);
      alert('Cập nhật lịch trình thành công!');
    } catch (error) {
      console.error('Error updating itinerary:', error);
      alert('Lỗi khi cập nhật lịch trình: ' + error.message);
    }
  }

  async function deleteItinerary(id) {
    try {
        const response = await fetch(`/itineraries/${id}/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Lỗi khi xóa lịch trình');
        }
        console.log('Itinerary deleted:', data.message);
        if (data.redirect) {
            window.location.href = data.redirect; // Chuyển hướng dựa trên phản hồi JSON
        } else {
            window.location.href = '/itineraries/page'; // Fallback
        }
    } catch (error) {
        console.error('Error deleting itinerary:', error);
        alert('Lỗi khi xóa lịch trình: ' + error.message);
    }
}

async function updateItinerariesUI() {
    try {
        console.log('Fetching itineraries from /itineraries/page');
        const response = await fetch('/itineraries/page', {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            credentials: 'include', // Gửi cookie session
        });
        if (!response.ok) {
            if (response.status === 401) {
                console.warn('Unauthorized: Redirecting to login');
                window.location.href = '/user/login';
                return;
            }
            const text = await response.text();
            console.error('Non-JSON response:', text.substring(0, 100));
            const data = JSON.parse(text); // Thử parse JSON
            throw new Error(data.error || 'Lỗi khi tải danh sách lịch trình');
        }
        const data = await response.json();
        console.log('Itineraries received:', data);
        const itineraryList = document.getElementById('itineraries-list');
        if (!itineraryList) {
            console.warn('Không tìm thấy itineraries-list element');
            return;
        }
        itineraryList.innerHTML = '';
        if (data.itineraries && data.itineraries.length > 0) {
            data.itineraries.forEach(itinerary => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <a href="/itineraries/${itinerary.id}">
                        ${itinerary.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')}
                    </a>
                `;
                itineraryList.appendChild(li);
            });
        } else {
            itineraryList.innerHTML = '<p>Chưa có lịch trình nào.</p>';
        }
    } catch (error) {
        console.error('Error updating itineraries UI:', error);
        alert('Lỗi khi cập nhật danh sách lịch trình: ' + error.message);
    }
}


  function toggleEditForm() {
    const editForm = document.getElementById('editForm');
    if (editForm) {
      editForm.style.display = editForm.style.display === 'none' ? 'block' : 'none';
      if (editForm.style.display === 'block') {
        loadPlacesForDropdown();
      }
    } else {
      console.warn('Edit form not found');
    }
  }

 function loadPlacesForDropdown() {
  const select = document.getElementById('addPlaceSelect');
  if (!select) {
    console.warn('Add place select not found. Ensure edit form is rendered.');
    return;
  }
  select.innerHTML = '<option value="">Chọn địa điểm</option>';
  fetch('/places/geojson')
    .then(response => {
      if (!response.ok) {
        console.error('Error fetching /places/geojson for dropdown:', response.status, response.statusText);
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      console.log('GeoJSON for dropdown received:', data);
      if (!data.features || !Array.isArray(data.features) || data.features.length === 0) {
        console.warn('No features or invalid features in GeoJSON for dropdown:', data);
        select.innerHTML = '<option value="">Không có địa điểm nào</option>';
        return;
      }
      data.features.forEach(feature => {
        if (!feature?.properties?.id || !feature?.properties?.name) {
          console.warn('Feature missing properties:', feature);
          return;
        }
        const option = document.createElement('option');
        option.value = feature.properties.id;
        option.textContent = `${feature.properties.name} (${feature.properties.type || 'Unknown'})`;
        select.appendChild(option);
        console.log('Added option to dropdown:', { id: feature.properties.id, name: feature.properties.name });
      });
      console.log('Dropdown populated with', select.options.length - 1, 'places');
    })
    .catch(err => {
      console.error('Error loading places for dropdown:', err);
      select.innerHTML = '<option value="">Lỗi khi tải địa điểm</option>';
    });
}

  function addPlaceToEdit() {
    const select = document.getElementById('addPlaceSelect');
    const placeId = select.value;
    const placeText = select.options[select.selectedIndex]?.text;
    if (placeId && placeText) {
      const list = document.getElementById('editPlaceList');
      if (list) {
        const existingIds = Array.from(list.querySelectorAll('.edit-place-item')).map(item => item.dataset.placeId);
        if (existingIds.includes(placeId)) {
          alert(`Địa điểm ${placeText} đã có trong danh sách`);
          return;
        }
        const li = document.createElement('li');
        li.className = 'edit-place-item';
        li.dataset.placeId = placeId;
        li.innerHTML = `${placeText} <button type="button" onclick="removePlaceFromEdit(${placeId})">Xóa</button>`;
        list.appendChild(li);
        updateEditPlacesInput();
      }
    }
  }

  function removePlaceFromEdit(placeId) {
    const items = document.querySelectorAll('.edit-place-item');
    items.forEach(item => {
      if (item.dataset.placeId === placeId.toString()) {
        item.remove();
      }
    });
    updateEditPlacesInput();
  }

  function updateEditPlacesInput() {
    const items = document.querySelectorAll('.edit-place-item');
    const placeIds = Array.from(items).map(item => item.dataset.placeId);
    const input = document.getElementById('editPlacesInput');
    if (input) {
      input.value = placeIds.join(',');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded at', new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }));
    loadMap();

    const createForm = document.getElementById('create-itinerary-form');
    if (createForm) {
      createForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameInput = createForm.querySelector('input[name="name"]');
        const placesInput = createForm.querySelector('input[name="places"]');
        const name = nameInput.value.trim();
        let places = placesInput.value ? JSON.parse(placesInput.value) : [];
        console.log('Submitting create itinerary:', { name, places });
        if (!name) {
          alert('Vui lòng nhập tên lịch trình');
          return;
        }
        if (!Array.isArray(places) || places.length === 0) {
          console.warn('No places selected for itinerary');
          alert('Vui lòng chọn ít nhất một địa điểm');
          return;
        }
        await createItinerary(name, places);
      });
    } else {
      console.warn('Create itinerary form not found');
    }
  });

function addPlaceToItinerary(placeId, placeName) {
  placeId = parseInt(placeId);
  if (!placeId) {
    console.error('Invalid placeId:', placeId);
    alert('Lỗi: Địa điểm không có ID');
    return;
  }
  if (!selectedPlaces.includes(placeId)) {
    selectedPlaces.push(placeId);
    console.log('Added place to selectedPlaces:', selectedPlaces);
    alert(`Đã chọn: ${placeName}`);
    updateSelectedPlacesUI();
  } else {
    alert(`Địa điểm ${placeName} đã được chọn`);
  }
}
