let SCRIPT_URL = localStorage.getItem('script_url') || '';
let PIN = localStorage.getItem('pin') || '';
let isSetupMode = false;
let uploadedImages = {
    main: null,
    gallery: [],
    floorPlans: []
};

console.log('🚀 [INIT] SCRIPT_URL:', SCRIPT_URL);
console.log('🚀 [INIT] PIN:', PIN ? 'установлен' : 'не установлен');

document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 [DOM] Document loaded');
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

async function init() {    console.log('🔄 [INIT] Starting init...');
    const scriptParam = getUrlParameter('script');
    console.log('📥 [INIT] URL parameter:', scriptParam);
   
    if (scriptParam) {
        SCRIPT_URL = decodeURIComponent(scriptParam);
        localStorage.setItem('script_url', SCRIPT_URL);
        console.log('✅ [INIT] Saved SCRIPT_URL:', SCRIPT_URL);
        cleanUrl();
    }

    if (!SCRIPT_URL) {
        console.warn('⚠️ [INIT] No SCRIPT_URL, opening settings');
        openSettings();
        return;
    }
    await checkPinAndLoad();
}

async function checkPinAndLoad(msg) {
    console.log('🔐 [AUTH] Checking PIN...');
    if (!PIN) {
        try {
            console.log('📡 [AUTH] Fetching without PIN...');
            const res = await fetch(SCRIPT_URL);
            console.log('📥 [AUTH] Response status:', res.status);
            if (!res.ok) {
                throw new Error('HTTP error! status: ' + res.status);
            }
            const data = await res.json();
            console.log('📦 [AUTH] Response data:', data);
            if (data.needs_setup) showPinScreen(true);
            else showPinScreen(false, msg);
        } catch (e) {
            console.error('❌ [AUTH] Error:', e);
            showPinScreen(false, 'Ошибка сети. Проверьте URL.');
        }
    } else {
        try {
            console.log('📡 [AUTH] Fetching with PIN...');
            const res = await fetch(SCRIPT_URL + '?pin=' + PIN);
            console.log('📥 [AUTH] Response status:', res.status);
            if (!res.ok) {
                throw new Error('HTTP error! status: ' + res.status);
            }
            const data = await res.json();
            console.log('📦 [AUTH] Response data:', data);

            if (data.unauthorized || data.error === 'Неверный PIN') {
                console.error('❌ [AUTH] Wrong PIN');                PIN = '';
                localStorage.removeItem('pin');
                showPinScreen(false, 'Неверный PIN. Попробуйте ещё раз или обратитесь к Администратору.');
            } else if (data.needs_setup) {
                console.log('⚠️ [AUTH] Needs setup');
                showPinScreen(true);
            } else {
                console.log('✅ [AUTH] Success!');
                showMainScreen();
                renderObjects(data);
            }
        } catch (e) {
            console.error('❌ [AUTH] Error:', e);
            showPinScreen(false, 'Ошибка сети');
        }
    }
}

function showPinScreen(isSetup, msg) {
    console.log('🔑 [UI] Showing PIN screen, isSetup:', isSetup);
    document.getElementById('main-screen').style.display = 'none';
    document.getElementById('settings-screen').style.display = 'none';
    document.getElementById('pin-screen').style.display = 'block';

    isSetupMode = isSetup;
    document.getElementById('pin-title').textContent = isSetup ? 'Придумайте PIN-код' : 'Введите PIN-код';
    document.getElementById('pin-btn').textContent = isSetup ? 'Сохранить' : 'Войти';

    const msgEl = document.getElementById('pin-message');
    if (msg) { msgEl.textContent = msg; msgEl.style.display = 'block'; }
    else { msgEl.style.display = 'none'; }
}

async function submitPin() {
    const inputPin = document.getElementById('pin-input').value;
    console.log('🔢 [PIN] Entered:', inputPin);
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
            console.log('💾 [PIN] Setting up new PIN...');            await fetch(SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {'Content-Type': 'text/plain;charset=utf-8'},
                body: JSON.stringify({ action: 'setup_pin', data: { pin: inputPin } })
            });

            setTimeout(async function() {
                try {
                    const checkRes = await fetch(SCRIPT_URL);
                    if (!checkRes.ok) {
                        throw new Error('HTTP error! status: ' + checkRes.status);
                    }
                    const checkData = await checkRes.json();
                    console.log('📦 [PIN] Setup check:', checkData);

                    if (!checkData.needs_setup) {
                        PIN = inputPin;
                        localStorage.setItem('pin', PIN);
                        console.log('✅ [PIN] PIN saved');
                        showMainScreen();
                        loadObjects();
                    } else {
                        alert('PIN не установлен. Попробуйте ещё раз.');
                    }
                } catch (e) {
                    console.error('❌ [PIN] Setup error:', e);
                    alert('Ошибка проверки PIN: ' + e.message);
                }
                btn.textContent = isSetupMode ? 'Сохранить' : 'Войти';
                btn.disabled = false;
            }, 2000);

            return;
        } catch(e) {
            console.error('❌ [PIN] Setup error:', e);
            alert('Ошибка установки PIN: ' + e.message);
        }
    } else {
        console.log('🔐 [PIN] Logging in with existing PIN');
        PIN = inputPin;
        localStorage.setItem('pin', PIN);
        await checkPinAndLoad();
    }

    btn.textContent = isSetupMode ? 'Сохранить' : 'Войти';
    btn.disabled = false;
}

function showMainScreen() {    console.log('🏠 [UI] Showing main screen');
    document.getElementById('pin-screen').style.display = 'none';
    document.getElementById('settings-screen').style.display = 'none';
    document.getElementById('main-screen').style.display = 'block';
}

async function loadObjects() {
    console.log('📋 [LOAD] Loading objects...');
    const list = document.getElementById('objects-list');
    list.innerHTML = 'Загрузка...';
    try {
        const response = await fetch(SCRIPT_URL + '?pin=' + PIN);
        console.log('📥 [LOAD] Response status:', response.status);
        if (!response.ok) {
            throw new Error('HTTP error! status: ' + response.status);
        }
        const data = await response.json();
        console.log('📦 [LOAD] Objects count:', Array.isArray(data) ? data.length - 1 : 0);
        if (data.error && !Array.isArray(data)) {
            list.innerHTML = '<p style="color:red;">' + data.error + '</p>';
            return;
        }
        renderObjects(data);
    } catch (error) {
        console.error('❌ [LOAD] Error:', error);
        list.innerHTML = '<p style="color:red;">Ошибка: ' + error.message + '</p>';
    }
}

function renderObjects(data) {
    console.log('🎨 [RENDER] Rendering objects...');
    const list = document.getElementById('objects-list');
    if (!Array.isArray(data) || data.length <= 1) {
        list.innerHTML = '<p>Нет объектов</p>';
        return;
    }

    const headers = data[0];
    const rows = data.slice(1);

    list.innerHTML = rows.map(function(row) {
        const obj = {};
        headers.forEach(function(header, i) { obj[header] = row[i]; });
        var imgHtml = '';
        if (obj.image_main) {
            imgHtml = '<img src="' + escapeHtml(obj.image_main) + '" style="width:100%;border-radius:8px;margin-bottom:8px;" onerror="this.style.display=\'none\'">';
        }
        return '<div class="object-card">' +
            imgHtml +
            '<h3>' + escapeHtml(obj.name || 'Без названия') + '</h3>' +            '<p class="price">' + escapeHtml(obj.price_from || '?') + ' - ' + escapeHtml(obj.price_to || '?') + ' млн руб</p>' +
            '<p>📍 ' + escapeHtml(obj.address || 'Адрес не указан') + '</p>' +
            '<p>🏗 ' + escapeHtml(obj.status || 'Статус неизвестен') + '</p>' +
            '<div class="actions">' +
                '<button onclick="editObject(\'' + escapeHtml(obj.id) + '\')" class="btn btn-primary">Редактировать</button>' +
                '<button onclick="deleteObject(\'' + escapeHtml(obj.id) + '\')" class="btn btn-secondary">Удалить</button>' +
            '</div></div>';
    }).join('');
    console.log('✅ [RENDER] Done');
}

function openForm() {
    console.log('➕ [FORM] Opening form');
    document.getElementById('main-screen').style.display = 'none';
    document.getElementById('form-screen').style.display = 'block';
    document.getElementById('form-title').textContent = 'Новый объект';
    document.getElementById('property-form').reset();
    document.getElementById('prop-id').value = '';
    uploadedImages = { main: null, gallery: [], floorPlans: [] };
    var mainPreview = document.getElementById('image-main-preview');
    var galleryPreview = document.getElementById('image-gallery-preview');
    var floorPreview = document.getElementById('image-floor-plans-preview');
    if (mainPreview) mainPreview.style.display = 'none';
    if (galleryPreview) galleryPreview.style.display = 'none';
    if (floorPreview) floorPreview.style.display = 'none';
}

function closeForm() {
    console.log('❌ [FORM] Closing form');
    document.getElementById('form-screen').style.display = 'none';
    document.getElementById('main-screen').style.display = 'block';
}

async function handleImageSelect(event, type) {
    console.log('📸 [UPLOAD] Starting upload, type:', type);
    const files = event.target.files;
    if (!files || files.length === 0) {
        console.warn('⚠️ [UPLOAD] No files selected');
        return;
    }

    console.log('📁 [UPLOAD] Files:', files.length);
    const statusEl = document.createElement('div');
    statusEl.textContent = '⏳ Загрузка фото...';
    statusEl.style.cssText = 'background:#fff3cd;color:#856404;padding:10px;border-radius:5px;margin-top:10px;font-weight:bold;';
    event.target.parentNode.appendChild(statusEl);

    try {
        if (type === 'main') {
            console.log('🖼️ [UPLOAD] Uploading main image...');            const file = files[0];
            console.log('📄 [UPLOAD] File:', file.name, file.size, 'bytes');
            const url = await uploadImageToDrive(file);
            console.log('✅ [UPLOAD] Main image URL:', url);
            uploadedImages.main = url;
            document.getElementById('prop-image-main').value = url;
            console.log('💾 [UPLOAD] Saved to prop-image-main:', document.getElementById('prop-image-main').value);

            var preview = document.getElementById('image-main-preview');
            var previewImg = document.getElementById('image-main-preview-img');
            if (preview && previewImg) {
                previewImg.src = URL.createObjectURL(file);
                preview.style.display = 'block';
            }
            statusEl.textContent = '✅ Главное фото загружено!';
            statusEl.style.background = '#d4edda';
            statusEl.style.color = '#155724';

        } else if (type === 'gallery') {
            console.log('🖼️ [UPLOAD] Uploading gallery images...');
            const urls = [];
            for (let i = 0; i < files.length; i++) {
                statusEl.textContent = '⏳ Загрузка фото ' + (i + 1) + ' из ' + files.length + '...';
                const url = await uploadImageToDrive(files[i]);
                urls.push(url);
            }
            uploadedImages.gallery = urls;
            document.getElementById('prop-images-gallery').value = urls.join(',');
            console.log('✅ [UPLOAD] Gallery URLs:', urls);

            var container = document.getElementById('gallery-images-container');
            if (container) {
                container.innerHTML = '';
                for (let i = 0; i < files.length; i++) {
                    var img = document.createElement('img');
                    img.src = URL.createObjectURL(files[i]);
                    img.style.cssText = 'width:80px;height:80px;object-fit:cover;border-radius:5px;margin:2px;';
                    container.appendChild(img);
                }
                document.getElementById('image-gallery-preview').style.display = 'block';
            }
            statusEl.textContent = '✅ Галерея загружена! (' + urls.length + ' фото)';
            statusEl.style.background = '#d4edda';
            statusEl.style.color = '#155724';

        } else if (type === 'floor-plans') {
            console.log('️ [UPLOAD] Uploading floor plans...');
            const urls = [];
            for (let i = 0; i < files.length; i++) {
                statusEl.textContent = '⏳ Загрузка планировки ' + (i + 1) + ' из ' + files.length + '...';                const url = await uploadImageToDrive(files[i]);
                urls.push(url);
            }
            uploadedImages.floorPlans = urls;
            document.getElementById('prop-floor-plans-images').value = urls.join(',');
            console.log('✅ [UPLOAD] Floor plan URLs:', urls);

            var fpContainer = document.getElementById('floor-plans-images-container');
            if (fpContainer) {
                fpContainer.innerHTML = '';
                for (let i = 0; i < files.length; i++) {
                    var fpImg = document.createElement('img');
                    fpImg.src = URL.createObjectURL(files[i]);
                    fpImg.style.cssText = 'width:80px;height:80px;object-fit:cover;border-radius:5px;margin:2px;';
                    fpContainer.appendChild(fpImg);
                }
                document.getElementById('image-floor-plans-preview').style.display = 'block';
            }
            statusEl.textContent = '✅ Планировки загружены! (' + urls.length + ' фото)';
            statusEl.style.background = '#d4edda';
            statusEl.style.color = '#155724';
        }

    } catch (error) {
        console.error('❌ [UPLOAD] Error:', error);
        statusEl.textContent = '❌ Ошибка: ' + error.message;
        statusEl.style.background = '#f8d7da';
        statusEl.style.color = '#721c24';
    }
}

async function uploadImageToDrive(file) {
    console.log('☁️ [DRIVE] Starting upload to Drive...');
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const base64Data = e.target.result;
                console.log('📊 [DRIVE] Base64 length:', base64Data.length);

                console.log('📡 [DRIVE] Sending upload request...');
                console.log('📍 [DRIVE] SCRIPT_URL:', SCRIPT_URL);
                console.log('🔐 [DRIVE] PIN:', PIN ? 'present' : 'missing');
               
                await fetch(SCRIPT_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: {'Content-Type': 'text/plain;charset=utf-8'},
                    body: JSON.stringify({
                        action: 'upload_image',                        data: {
                            image: base64Data,
                            fileName: file.name,
                            pin: PIN
                        }
                    })
                });
                console.log('⏳ [DRIVE] Waiting for processing...');
                await new Promise(r => setTimeout(r, 3000));

                console.log('📡 [DRIVE] Fetching file URL...');
                const response = await fetch(SCRIPT_URL + '?action=get_last_file_url&pin=' + PIN);
                console.log('📥 [DRIVE] Response status:', response.status);
                if (!response.ok) {
                    throw new Error('Не удалось получить URL файла (HTTP ' + response.status + ')');
                }
                const result = await response.json();
                console.log('📦 [DRIVE] Result:', result);

                if (result.success && result.url) {
                    console.log('✅ [DRIVE] Got URL:', result.url);
                    resolve(result.url);
                } else {
                    console.error('❌ [DRIVE] No URL in response');
                    reject(new Error(result.error || 'URL файла пустой'));
                }

            } catch (error) {
                console.error('❌ [DRIVE] Upload error:', error);
                reject(error);
            }
        };
        reader.onerror = function() {
            console.error('❌ [DRIVE] File read error');
            reject(new Error('Не удалось прочитать файл'));
        };
        reader.readAsDataURL(file);
    });
}

async function handleSubmit(e) {
    console.log('💾 [SUBMIT] Form submitted');
    e.preventDefault();

    const name = document.getElementById('prop-name').value.trim();
    const address = document.getElementById('prop-address').value.trim();
    const imageMain = document.getElementById('prop-image-main').value.trim();

    console.log('📝 [SUBMIT] Name:', name);
    console.log('📝 [SUBMIT] Address:', address);    console.log(' [SUBMIT] Image URL:', imageMain);

    if (!name) {
        console.error('❌ [SUBMIT] Missing name');
        alert('❌ Поле "Название ЖК" обязательно для заполнения!');
        return;
    }

    if (!address) {
        console.error('❌ [SUBMIT] Missing address');
        alert('❌ Поле "Адрес" обязательно для заполнения!');
        return;
    }

    if (!imageMain) {
        console.error('❌ [SUBMIT] Missing image');
        alert('❌ Поле "Главное фото" обязательно для заполнения! Нажмите "Выбрать файл" и дождитесь загрузки фото.');
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

    const existingId = document.getElementById('prop-id').value;    const action = existingId ? 'update' : 'create';

    console.log('📡 [SUBMIT] Sending data...');
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {'Content-Type': 'text/plain;charset=utf-8'},
            body: JSON.stringify({ action: action, data: data })
        });
        console.log('✅ [SUBMIT] Sent successfully');

        setTimeout(async function() {
            alert('✅ Объект успешно сохранён!');
            closeForm();
            loadObjects();
        }, 2000);

    } catch (error) {
        console.error('❌ [SUBMIT] Error:', error);
        alert('❌ Ошибка сети: ' + error.message);
    }
}

async function editObject(id) {
    console.log('✏️ [EDIT] Editing object:', id);
    try {
        const response = await fetch(SCRIPT_URL + '?pin=' + PIN);
        if (!response.ok) {
            throw new Error('HTTP error! status: ' + response.status);
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
    console.log('🗑️ [DELETE] Deleting object:', id);
    if (!confirm('Удалить объект?')) return;
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {'Content-Type': 'text/plain;charset=utf-8'},
            body: JSON.stringify({ action: 'delete', data: {id: id, pin: PIN} })
        });

        setTimeout(async function() {
            alert('✅ Объект удалён!');
            loadObjects();
        }, 2000);

    } catch (error) {
        console.error('❌ [DELETE] Error:', error);
        alert('❌ Ошибка: ' + error.message);
    }
}
function openSettings() {
    console.log('⚙️ [SETTINGS] Opening settings');
    document.getElementById('main-screen').style.display = 'none';
    document.getElementById('pin-screen').style.display = 'none';
    document.getElementById('settings-screen').style.display = 'block';
    document.getElementById('script-url').value = SCRIPT_URL;
}

function closeSettings() {
    console.log('⚙️ [SETTINGS] Closing settings');
    document.getElementById('settings-screen').style.display = 'none';
    if (SCRIPT_URL) init();
}

function saveSettings() {
    console.log('💾 [SETTINGS] Saving settings');
    SCRIPT_URL = document.getElementById('script-url').value;
    localStorage.setItem('script_url', SCRIPT_URL);
    closeSettings();
}
