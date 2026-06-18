let SCRIPT_URL = localStorage.getItem('script_url') || '';
let PIN = localStorage.getItem('pin') || '';
let isSetupMode = false;

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('property-form').addEventListener('submit', handleSubmit);
    init();
});

async function init() {
    if (!SCRIPT_URL) {
        openSettings();
        return;
    }
    await checkPinAndLoad();
}

async function checkPinAndLoad(msg) {
    if (!PIN) {
        // Пытаемся узнать статус сервера без PIN
        try {
            const res = await fetch(SCRIPT_URL);
            const data = await res.json();
            if (data.needs_setup) showPinScreen(true);
            else showPinScreen(false, msg);
        } catch (e) {
            showPinScreen(false, 'Ошибка сети. Проверьте URL.');
        }
    } else {
        // Пробуем загрузить с сохраненным PIN
        try {
            const res = await fetch(`${SCRIPT_URL}?pin=${PIN}`);
            const data = await res.json();
           
            if (data.unauthorized || data.error === 'Неверный PIN') {
                PIN = '';
                localStorage.removeItem('pin');
                showPinScreen(false, 'Неверный PIN. Посмотрите его в листе Config вашей таблицы.');
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
    if (!inputPin) return;

    if (isSetupMode) {
        try {
            const res = await fetch(SCRIPT_URL, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ action: 'setup_pin', data: { pin: inputPin } })
            });
            const data = await res.json();
            if (data.success) {
                PIN = inputPin;
                localStorage.setItem('pin', PIN);
                showMainScreen();
                loadObjects();
            }
        } catch(e) { alert('Ошибка установки PIN'); }
    } else {
        PIN = inputPin;
        localStorage.setItem('pin', PIN);
        await checkPinAndLoad();
    }
}

function showMainScreen() {
    document.getElementById('pin-screen').style.display = 'none';
    document.getElementById('settings-screen').style.display = 'none';
    document.getElementById('main-screen').style.display = 'block';
}

async function loadObjects() {
    const list = document.getElementById('objects-list');
    list.innerHTML = 'Загрузка...';
    try {        const response = await fetch(`${SCRIPT_URL}?pin=${PIN}`);
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
    if (data.length <= 1) { list.innerHTML = '<p>Нет объектов</p>'; return; }
    const headers = data[0];
    const rows = data.slice(1);
    list.innerHTML = rows.map(function(row) {
        const obj = {};
        headers.forEach(function(header, i) { obj[header] = row[i]; });
        return '<div class="object-card">' +
            '<h3>' + (obj.name || 'Без названия') + '</h3>' +
            '<p class="price">' + (obj.price_from || '?') + ' - ' + (obj.price_to || '?') + ' млн руб</p>' +
            '<p>📍 ' + (obj.address || 'Адрес не указан') + '</p>' +
            '<p>🏗 ' + (obj.status || 'Статус неизвестен') + '</p>' +
            '<div class="actions">' +
                '<button onclick="editObject(\'' + obj.id + '\')" class="btn btn-primary">Редактировать</button>' +
                '<button onclick="deleteObject(\'' + obj.id + '\')" class="btn btn-secondary">Удалить</button>' +
            '</div></div>';
    }).join('');
}

function openForm() {
    document.getElementById('main-screen').style.display = 'none';
    document.getElementById('form-screen').style.display = 'block';
    document.getElementById('form-title').textContent = 'Новый объект';
    document.getElementById('property-form').reset();
    document.getElementById('prop-id').value = '';
}

function closeForm() {
    document.getElementById('form-screen').style.display = 'none';
    document.getElementById('main-screen').style.display = 'block';
}

async function handleSubmit(e) {
    e.preventDefault();
    const data = {
        id: document.getElementById('prop-id-input').value,
        name: document.getElementById('prop-name').value,        district: document.getElementById('prop-district').value,
        metro: document.getElementById('prop-metro').value,
        price_from: parseFloat(document.getElementById('prop-price-from').value) || null,
        price_to: parseFloat(document.getElementById('prop-price-to').value) || null,
        rooms: document.getElementById('prop-rooms').value,
        area_min: parseFloat(document.getElementById('prop-area-min').value) || null,
        area_max: parseFloat(document.getElementById('prop-area-max').value) || null,
        completion_soonest: document.getElementById('prop-completion').value,
        status: document.getElementById('prop-status').value,
        class: document.getElementById('prop-class').value,
        address: document.getElementById('prop-address').value,
        image_main: document.getElementById('prop-image').value,
        active: document.getElementById('prop-active').value,
        pin: PIN // Добавляем PIN в запрос
    };
    const existingId = document.getElementById('prop-id').value;
    const action = existingId ? 'update' : 'create';
    if (action === 'update') data.id = existingId;
   
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ action: action, data: data })
        });
        const result = await response.json();
        if (result.success) { alert('Сохранено!'); closeForm(); loadObjects(); }
        else { alert('Ошибка: ' + result.error); }
    } catch (error) { alert('Ошибка: ' + error.message); }
}

async function editObject(id) {
    try {
        const response = await fetch(`${SCRIPT_URL}?pin=${PIN}`);
        const data = await response.json();
        const headers = data[0];
        const rows = data.slice(1);
        const obj = {};
        rows.forEach(function(row) {
            const rowObj = {};
            headers.forEach(function(header, i) { rowObj[header] = row[i]; });
            if (rowObj.id === id) Object.assign(obj, rowObj);
        });
        if (Object.keys(obj).length === 0) { alert('Не найдено'); return; }
       
        document.getElementById('main-screen').style.display = 'none';
        document.getElementById('form-screen').style.display = 'block';
        document.getElementById('form-title').textContent = 'Редактировать';
        document.getElementById('prop-id').value = obj.id;
        document.getElementById('prop-id-input').value = obj.id;        document.getElementById('prop-name').value = obj.name || '';
        document.getElementById('prop-district').value = obj.district || '';
        document.getElementById('prop-metro').value = obj.metro || '';
        document.getElementById('prop-price-from').value = obj.price_from || '';
        document.getElementById('prop-price-to').value = obj.price_to || '';
        document.getElementById('prop-rooms').value = obj.rooms || '';
        document.getElementById('prop-area-min').value = obj.area_min || '';
        document.getElementById('prop-area-max').value = obj.area_max || '';
        document.getElementById('prop-completion').value = obj.completion_soonest || '';
        document.getElementById('prop-status').value = obj.status || 'Строится';
        document.getElementById('prop-class').value = obj.class || 'Комфорт';
        document.getElementById('prop-address').value = obj.address || '';
        document.getElementById('prop-image').value = obj.image_main || '';
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
        const result = await response.json();
        if (result.success) { alert('Удалено!'); loadObjects(); }
        else { alert('Ошибка: ' + result.error); }
    } catch (error) { alert('Ошибка: ' + error.message); }
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
