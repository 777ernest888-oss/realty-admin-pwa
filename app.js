let SCRIPT_URL = localStorage.getItem('script_url') || '';
let PIN = localStorage.getItem('pin') || '';
let isSetupMode = false;
let uploadedImages = {
    main: null,
    gallery: [],
    floorPlans: []
};

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('property-form').addEventListener('submit', handleSubmit);
    init();
});

function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

function cleanUrl() {
    if (window.history && window.history.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const str = String(text);
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
}

function logout() {
    if (confirm('Выйти из приложения? URL скрипта и PIN будут удалены.')) {
        localStorage.removeItem('script_url');
        localStorage.removeItem('pin');
        SCRIPT_URL = '';
        PIN = '';
        location.reload();
    }
}

async function init() {
    const scriptParam = getUrlParameter('script');
    if (scriptParam) {
        SCRIPT_URL = scriptParam;
        localStorage.setItem('script_url', SCRIPT_URL);        cleanUrl();
    }

    if (!SCRIPT_URL) {
        openSettings();
        return;
    }
    await checkPinAndLoad();
}

async function checkPinAndLoad(msg) {
    if (!PIN) {
        try {
            const res = await fetch(SCRIPT_URL);
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            const data = await res.json();
            if (data.needs_setup) showPinScreen(true);
            else showPinScreen(false, msg);
        } catch (e) {
            showPinScreen(false, 'Ошибка сети. Проверьте URL.');
        }
    } else {
        try {
            const res = await fetch(`${SCRIPT_URL}?pin=${PIN}`);
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            const data = await res.json();

            if (data.unauthorized || data.error === 'Неверный PIN') {
                PIN = '';
                localStorage.removeItem('pin');
                showPinScreen(false, 'Неверный PIN. Попробуйте ещё раз или обратитесь к Администратору.');
            } else if (data.needs_setup) {
                showPinScreen(true);
            } else {
                showMainScreen();
                renderObjects(data);
            }
        } catch (e) {
            showPinScreen(false, 'Ошибка сети');
        }
    }
}

function showPinScreen(isSetup, msg) {
    document.getElementById('main-screen').style.display = 'none';
    document.getElementById('settings-screen').style.display = 'none';    document.getElementById('pin-screen').style.display = 'block';

    isSetupMode = isSetup;
    document.getElementById('pin-title').textContent = isSetup ? 'Придумайте PIN-код' : 'Введите PIN-код';
    document.getElementById('pin-btn').textContent = isSetup ? 'Сохранить' : 'Войти';

    const msgEl = document.getElementById('pin-message');
    if (msg) { msgEl.textContent = msg; msgEl.style.display = 'block'; }
    else { msgEl.style.display = 'none'; }
}

async function submitPin() {
    const inputPin = document.getElementById('pin-input').value;
    if (!inputPin) return;

    if (!/^\d{6,}$/.test(inputPin)) {
        alert('PIN должен содержать минимум 6 цифр');
        return;
    }

    const btn = document.getElementById('pin-btn');
    btn.textContent = 'Загрузка...';
    btn.disabled = true;

    if (isSetupMode) {
        try {
            await fetch(SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {'Content-Type': 'text/plain;charset=utf-8'},
                body: JSON.stringify({ action: 'setup_pin', data: { pin: inputPin } })
            });
           
            setTimeout(async function() {
                try {
                    const checkRes = await fetch(SCRIPT_URL);
                    if (!checkRes.ok) {
                        throw new Error(`HTTP error! status: ${checkRes.status}`);
                    }
                    const checkData = await checkRes.json();
                   
                    if (!checkData.needs_setup) {
                        PIN = inputPin;
                        localStorage.setItem('pin', PIN);
                        showMainScreen();
                        loadObjects();
                    } else {
                        alert('PIN не установлен. Попробуйте ещё раз.');
                    }
                } catch (e) {                    alert('Ошибка проверки PIN: ' + e.message);
                }
                btn.textContent = isSetupMode ? 'Сохранить' : 'Войти';
                btn.disabled = false;
            }, 2000);
           
            return;
        } catch(e) {
            alert('Ошибка установки PIN: ' + e.message);
        }
    } else {
        PIN = inputPin;
        localStorage.setItem('pin', PIN);
        await checkPinAndLoad();
    }

    btn.textContent = isSetupMode ? 'Сохранить' : 'Войти';
    btn.disabled = false;
}

function showMainScreen() {
    document.getElementById('pin-screen').style.display = 'none';
    document.getElementById('settings-screen').style.display = 'none';
    document.getElementById('main-screen').style.display = 'block';
}

async function loadObjects() {
    const list = document.getElementById('objects-list');
    list.innerHTML = 'Загрузка...';
    try {
        const response = await fetch(`${SCRIPT_URL}?pin=${PIN}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data.error && !Array.isArray(data)) {
            list.innerHTML = '<p style="color:red;">' + data.error + '</p>';
            return;
        }
        renderObjects(data);
    } catch (error) {
        list.innerHTML = '<p style="color:red;">Ошибка: ' + error.message + '</p>';
    }
}

function renderObjects(data) {
    const list = document.getElementById('objects-list');
    if (!Array.isArray(data) || data.length <= 1) {
        list.innerHTML = '<p>Нет объектов</p>';
        return;    }
   
    const headers = data[0];
    const rows = data.slice(1);
   
    list.innerHTML = rows.map(function(row) {
        const obj = {};
        headers.forEach(function(header, i) { obj[header] = row[i]; });
        return '<div class="object-card">' +
            '<h3>' + escapeHtml(obj.name || 'Без названия') + '</h3>' +
            '<p class="price">' + escapeHtml(obj.price_from || '?') + ' - ' + escapeHtml(obj.price_to || '?') + ' млн руб</p>' +
            '<p> ' + escapeHtml(obj.address || 'Адрес не указан') + '</p>' +
            '<p>🏗 ' + escapeHtml(obj.status || 'Статус неизвестен') + '</p>' +
            '<div class="actions">' +
                '<button onclick="editObject(\'' + escapeHtml(obj.id) + '\')" class="btn btn-primary">Редактировать</button>' +
                '<button onclick="deleteObject(\'' + escapeHtml(obj.id) + '\')" class="btn btn-secondary">Удалить</button>' +
            '</div></div>';
    }).join('');
}

function openForm() {
    document.getElementById('main-screen').style.display = 'none';
    document.getElementById('form-screen').style.display = 'block';
    document.getElementById('form-title').textContent = 'Новый объект';
    document.getElementById('property-form').reset();
    document.getElementById('prop-id').value = '';
    uploadedImages = { main: null, gallery: [], floorPlans: [] };
    document.getElementById('image-main-preview').style.display = 'none';
    document.getElementById('image-gallery-preview').style.display = 'none';
    document.getElementById('image-floor-plans-preview').style.display = 'none';
}

function closeForm() {
    document.getElementById('form-screen').style.display = 'none';
    document.getElementById('main-screen').style.display = 'block';
}

async function handleImageSelect(event, type) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const btn = document.createElement('button');
    btn.textContent = 'Загрузка фото...';
    btn.style.cssText = 'background:#f39c12; color:white; border:none; padding:10px; border-radius:5px; margin-top:10px;';
    event.target.parentNode.appendChild(btn);

    try {
        if (type === 'main') {
            const file = files[0];
            const url = await uploadImageToDrive(file);            uploadedImages.main = url;
            document.getElementById('prop-image-main').value = url;
           
            const preview = document.getElementById('image-main-preview');
            const previewImg = document.getElementById('image-main-preview-img');
            previewImg.src = URL.createObjectURL(file);
            preview.style.display = 'block';
           
        } else if (type === 'gallery') {
            const urls = [];
            for (let i = 0; i < files.length; i++) {
                const url = await uploadImageToDrive(files[i]);
                urls.push(url);
            }
            uploadedImages.gallery = urls;
            document.getElementById('prop-images-gallery').value = urls.join(',');
           
            const container = document.getElementById('gallery-images-container');
            container.innerHTML = '';
            for (let i = 0; i < files.length; i++) {
                const img = document.createElement('img');
                img.src = URL.createObjectURL(files[i]);
                img.style.cssText = 'width:80px; height:80px; object-fit:cover; border-radius:5px;';
                container.appendChild(img);
            }
            document.getElementById('image-gallery-preview').style.display = 'block';
           
        } else if (type === 'floor-plans') {
            const urls = [];
            for (let i = 0; i < files.length; i++) {
                const url = await uploadImageToDrive(files[i]);
                urls.push(url);
            }
            uploadedImages.floorPlans = urls;
            document.getElementById('prop-floor-plans-images').value = urls.join(',');
           
            const container = document.getElementById('floor-plans-images-container');
            container.innerHTML = '';
            for (let i = 0; i < files.length; i++) {
                const img = document.createElement('img');
                img.src = URL.createObjectURL(files[i]);
                img.style.cssText = 'width:80px; height:80px; object-fit:cover; border-radius:5px;';
                container.appendChild(img);
            }
            document.getElementById('image-floor-plans-preview').style.display = 'block';
        }
       
    } catch (error) {
        alert('Ошибка загрузки фото: ' + error.message);
    } finally {        btn.remove();
    }
}

async function uploadImageToDrive(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const base64Data = e.target.result;
               
                const response = await fetch(SCRIPT_URL, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        action: 'upload_image',
                        data: {
                            image: base64Data,
                            fileName: file.name,
                            pin: PIN
                        }
                    })
                });
               
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
               
                const result = await response.json();
               
                if (result.success) {
                    resolve(result.url);
                } else {
                    reject(new Error(result.error));
                }
               
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function handleSubmit(e) {
    e.preventDefault();
   
    const name = document.getElementById('prop-name').value.trim();
    const address = document.getElementById('prop-address').value.trim();    const imageMain = document.getElementById('prop-image-main').value.trim();
   
    if (!name) {
        alert('❌ Поле "Название ЖК" обязательно для заполнения!');
        return;
    }
   
    if (!address) {
        alert('❌ Поле "Адрес" обязательно для заполнения!');
        return;
    }
   
    if (!imageMain) {
        alert('❌ Поле "Главное фото" обязательно для заполнения! Выберите фото из галереи.');
        return;
    }
   
    const data = {
        id: document.getElementById('prop-id').value,
        name: name,
        district: document.getElementById('prop-district').value,
        metro: document.getElementById('prop-metro').value,
        price_from: parseFloat(document.getElementById('prop-price-from').value) || null,
        price_to: parseFloat(document.getElementById('prop-price-to').value) || null,
        rooms: document.getElementById('prop-rooms').value,
        area_min: parseFloat(document.getElementById('prop-area-min').value) || null,
        area_max: parseFloat(document.getElementById('prop-area-max').value) || null,
        price_per_sqm: parseFloat(document.getElementById('prop-price-per-sqm').value) || null,
        completion_soonest: document.getElementById('prop-completion-soonest').value,
        completion_all: document.getElementById('prop-completion-all').value,
        status: document.getElementById('prop-status').value,
        class: document.getElementById('prop-class').value,
        finishing: document.getElementById('prop-finishing').value,
        description: document.getElementById('prop-description').value,
        image_main: imageMain,
        images_gallery: document.getElementById('prop-images-gallery').value,
        floor_plans_text: document.getElementById('prop-floor-plans-text').value,
        floor_plans_images: document.getElementById('prop-floor-plans-images').value,
        features: document.getElementById('prop-features').value,
        address: address,
        lat: parseFloat(document.getElementById('prop-lat').value) || null,
        lng: parseFloat(document.getElementById('prop-lng').value) || null,
        active: document.getElementById('prop-active').value,
        pin: PIN
    };
   
    const existingId = document.getElementById('prop-id').value;
    const action = existingId ? 'update' : 'create';
  
    try {        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ action: action, data: data })
        });
       
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
       
        const result = await response.json();
       
        if (result.success) {
            alert('✅ Объект успешно сохранён!');
            closeForm();
            loadObjects();
        } else {
            alert('❌ Ошибка: ' + result.error);
        }
       
    } catch (error) {
        alert('❌ Ошибка сети: ' + error.message);
    }
}

async function editObject(id) {
    try {
        const response = await fetch(`${SCRIPT_URL}?pin=${PIN}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (!Array.isArray(data) || data.length <= 1) { alert('Объект не найден'); return; }
       
        const headers = data[0];
        const rows = data.slice(1);
       
        const foundRow = rows.find(function(row) {
            const rowObj = {};
            headers.forEach(function(header, i) { rowObj[header] = row[i]; });
            return rowObj.id === id;
        });
       
        if (!foundRow) { alert('Объект не найден'); return; }
       
        const obj = {};
        headers.forEach(function(header, i) { obj[header] = foundRow[i]; });

        document.getElementById('main-screen').style.display = 'none';
        document.getElementById('form-screen').style.display = 'block';        document.getElementById('form-title').textContent = 'Редактировать';
        document.getElementById('prop-id').value = obj.id || '';
        document.getElementById('prop-name').value = obj.name || '';
        document.getElementById('prop-district').value = obj.district || '';
        document.getElementById('prop-metro').value = obj.metro || '';
        document.getElementById('prop-price-from').value = obj.price_from || '';
        document.getElementById('prop-price-to').value = obj.price_to || '';
        document.getElementById('prop-rooms').value = obj.rooms || '';
        document.getElementById('prop-area-min').value = obj.area_min || '';
        document.getElementById('prop-area-max').value = obj.area_max || '';
        document.getElementById('prop-price-per-sqm').value = obj.price_per_sqm || '';
        document.getElementById('prop-completion-soonest').value = obj.completion_soonest || '';
        document.getElementById('prop-completion-all').value = obj.completion_all || '';
        document.getElementById('prop-status').value = obj.status || 'Строится';
        document.getElementById('prop-class').value = obj.class || 'Комфорт';
        document.getElementById('prop-finishing').value = obj.finishing || '';
        document.getElementById('prop-description').value = obj.description || '';
        document.getElementById('prop-image-main').value = obj.image_main || '';
        document.getElementById('prop-images-gallery').value = obj.images_gallery || '';
        document.getElementById('prop-floor-plans-text').value = obj.floor_plans_text || '';
        document.getElementById('prop-floor-plans-images').value = obj.floor_plans_images || '';
        document.getElementById('prop-features').value = obj.features || '';
        document.getElementById('prop-address').value = obj.address || '';
        document.getElementById('prop-lat').value = obj.lat || '';
        document.getElementById('prop-lng').value = obj.lng || '';
        document.getElementById('prop-active').value = obj.active || 'TRUE';
    } catch (error) { alert('Ошибка: ' + error.message); }
}

async function deleteObject(id) {
    if (!confirm('Удалить объект?')) return;
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ action: 'delete', data: {id: id, pin: PIN} })
        });
       
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
       
        const result = await response.json();
        if (result.success) {
            alert('Объект удалён!');
            loadObjects();
        } else {
            alert('Ошибка: ' + result.error);
        }
    } catch (error) {         alert('Ошибка: ' + error.message);
    }
}

function openSettings() {
    document.getElementById('main-screen').style.display = 'none';
    document.getElementById('pin-screen').style.display = 'none';
    document.getElementById('settings-screen').style.display = 'block';
    document.getElementById('script-url').value = SCRIPT_URL;
}

function closeSettings() {
    document.getElementById('settings-screen').style.display = 'none';
    if (SCRIPT_URL) init();
}

function saveSettings() {
    SCRIPT_URL = document.getElementById('script-url').value;
    localStorage.setItem('script_url', SCRIPT_URL);
    closeSettings();
}
