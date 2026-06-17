// Настройки
let SCRIPT_URL = localStorage.getItem('script_url') || '';
let AGENT_ID = localStorage.getItem('agent_id') || '';

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    if (!SCRIPT_URL || !AGENT_ID) {
        openSettings();
    } else {
        loadObjects();
    }
   
    document.getElementById('property-form').addEventListener('submit', handleSubmit);
});

// Загрузка объектов
async function loadObjects() {
    const list = document.getElementById('objects-list');
    list.innerHTML = 'Загрузка...';
   
    try {
        const url = `${SCRIPT_URL}?agent_id=${AGENT_ID}`;
        const response = await fetch(url);
        const data = await response.json();
       
        if (data.error) {
            list.innerHTML = `<p style="color:red;">${data.error}</p>`;
            return;
        }
       
        if (data.length <= 1) {
            list.innerHTML = '<p>Нет объектов</p>';
            return;
        }
       
        const headers = data[0];
        const rows = data.slice(1);
       
        list.innerHTML = rows.map(row => {
            const obj = {};
            headers.forEach((header, i) => {
                obj[header] = row[i];
            });
           
            return `
                <div class="object-card">
                    <h3>${obj.name || 'Без названия'}</h3>
                    <p class="price">${obj.price_from || '?'} - ${obj.price_to || '?'} млн руб</p>
                    <p>📍 ${obj.address || 'Адрес не указан'}</p>
                    <p>🏗 ${obj.status || 'Статус неизвестен'}</p>                    <div class="actions">
                        <button onclick="editObject('${obj.id}')" class="btn btn-primary">Редактировать</button>
                        <button onclick="deleteObject('${obj.id}')" class="btn btn-secondary">Удалить</button>
                    </div>
                </div>
            `;
        }).join('');
       
    } catch (error) {
        list.innerHTML = `<p style="color:red;">Ошибка: ${error.message}</p>`;
    }
}

// Открытие формы создания
function openForm() {
    document.getElementById('main-screen').style.display = 'none';
    document.getElementById('form-screen').style.display = 'block';
    document.getElementById('form-title').textContent = 'Новый объект';
    document.getElementById('property-form').reset();
    document.getElementById('prop-id').value = '';
}

// Закрытие формы
function closeForm() {
    document.getElementById('form-screen').style.display = 'none';
    document.getElementById('main-screen').style.display = 'block';
}

// Обработка отправки формы
async function handleSubmit(e) {
    e.preventDefault();
   
    const data = {
        id: document.getElementById('prop-id-input').value,
        name: document.getElementById('prop-name').value,
        district: document.getElementById('prop-district').value,
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
        owner_id: AGENT_ID
    };   
    const existingId = document.getElementById('prop-id').value;
    const action = existingId ? 'update' : 'create';
   
    if (action === 'update') {
        data.id = existingId;
    }
   
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                action: action,
                data: data
            })
        });
       
        const result = await response.json();
       
        if (result.success) {
            alert('Объект сохранён!');
            closeForm();
            loadObjects();
        } else {
            alert('Ошибка: ' + result.error);
        }
    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
}

// Редактирование объекта
async function editObject(id) {
    try {
        const url = `${SCRIPT_URL}?agent_id=${AGENT_ID}`;
        const response = await fetch(url);
        const data = await response.json();
       
        const headers = data[0];
        const rows = data.slice(1);
       
        const obj = {};
        rows.forEach(row => {
            const rowObj = {};
            headers.forEach((header, i) => {
                rowObj[header] = row[i];
            });
            if (rowObj.id === id) {
                Object.assign(obj, rowObj);            }
        });
       
        if (Object.keys(obj).length === 0) {
            alert('Объект не найден');
            return;
        }
       
        document.getElementById('main-screen').style.display = 'none';
        document.getElementById('form-screen').style.display = 'block';
        document.getElementById('form-title').textContent = 'Редактировать объект';
        document.getElementById('prop-id').value = obj.id;
        document.getElementById('prop-id-input').value = obj.id;
        document.getElementById('prop-name').value = obj.name || '';
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
       
    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
}

// Удаление объекта
async function deleteObject(id) {
    if (!confirm('Удалить объект?')) return;
   
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                action: 'delete',
                data: {id: id}
            })
        });
       
        const result = await response.json();
       
        if (result.success) {            alert('Объект удалён!');
            loadObjects();
        } else {
            alert('Ошибка: ' + result.error);
        }
    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
}

// Настройки
function openSettings() {
    document.getElementById('main-screen').style.display = 'none';
    document.getElementById('settings-screen').style.display = 'block';
    document.getElementById('script-url').value = SCRIPT_URL;
    document.getElementById('agent-id').value = AGENT_ID;
}

function closeSettings() {
    document.getElementById('settings-screen').style.display = 'none';
    if (SCRIPT_URL && AGENT_ID) {
        document.getElementById('main-screen').style.display = 'block';
    }
}

function saveSettings() {
    SCRIPT_URL = document.getElementById('script-url').value;
    AGENT_ID = document.getElementById('agent-id').value;
   
    localStorage.setItem('script_url', SCRIPT_URL);
    localStorage.setItem('agent_id', AGENT_ID);
   
    closeSettings();
    loadObjects();
}
