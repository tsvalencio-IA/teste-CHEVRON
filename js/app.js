/* ==================================================================
CONFIGURAÇÃO DO FIREBASE
================================================================== */
const firebaseConfig = {
  apiKey: "AIzaSyB5JpYm8l0AlF5ZG3HtkyFZgmrpsUrDhv0",
  authDomain: "dashboard-oficina-pro.firebaseapp.com",
  databaseURL: "https://dashboard-oficina-pro-default-rtdb.firebaseio.com",
  projectId: "dashboard-oficina-pro",
  storageBucket: "dashboard-oficina-pro.appspot.com",
  messagingSenderId: "736157192887",
  appId: "1:736157192887:web:c23d3daade848a33d67332"
};

let activeCloudinaryConfig = null;

// Sistema de Notificações
function showNotification(message, type = 'success') {
  const existing = document.getElementById('notification');
  if (existing) existing.remove();
  const notification = document.createElement('div');
  notification.id = 'notification';
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  setTimeout(() => notification.classList.add('show'), 10);
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => { if (document.body.contains(notification)) document.body.removeChild(notification); }, 500);
  }, 4000);
}

// Upload Otimizado Cloudinary
const uploadFileToCloudinary = async (file) => {
  if (!activeCloudinaryConfig) throw new Error('Configure a conta de mídia no painel de admin.');
  const { cloudName, uploadPreset } = activeCloudinaryConfig;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);

  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, { method: 'POST', body: formData });
    if (!response.ok) throw new Error('Falha no upload.');
    const data = await response.json();
    return { url: data.secure_url, configKey: activeCloudinaryConfig.key };
  } catch (error) { console.error("Erro Cloudinary:", error); throw error; }
};

// ==================================================================
// LÓGICA PRINCIPAL OTIMIZADA
// ==================================================================
document.addEventListener('DOMContentLoaded', () => {
  firebase.initializeApp(firebaseConfig);
  const db = firebase.database();

  let currentUser = null;
  let allServiceOrders = {};
  let lightboxMedia = [];
  let currentLightboxIndex = 0;
  let filesToUpload = [];
  let appStartTime = Date.now();
  
  // Variável para o Debounce (Otimização de Performance)
  let attentionUpdateTimeout = null;

  const USERS = [
    { name: 'Augusto', role: 'Gestor', password: 'jose' },
    { name: 'William Barbosa', role: 'Atendente', password: '2312' },
    { name: 'Thiago Ventura Valencio', role: 'Atendente', password: '1940' },
    { name: 'Fernando', role: 'Mecânico', password: 'fernando' },
    { name: 'Gustavo', role: 'Mecânico', password: 'gustavo' },
    { name: 'Marcelo', role: 'Mecânico', password: 'marcelo' }
  ];

  const USERS_CAN_DELETE_MEDIA = ['Thiago Ventura Valencio', 'William Barbosa', 'Augusto'];
  const STATUS_LIST = [ 'Aguardando-Mecanico', 'Em-Analise', 'Orcamento-Enviado', 'Aguardando-Aprovacao', 'Servico-Autorizado', 'Em-Execucao', 'Finalizado-Aguardando-Retirada', 'Entregue' ];
  const ATTENTION_STATUSES = { 'Aguardando-Mecanico': { label: 'AGUARDANDO MECÂNICO', color: 'yellow', blinkClass: 'blinking-aguardando' }, 'Servico-Autorizado': { label: 'SERVIÇO AUTORIZADO', color: 'green', blinkClass: 'blinking-autorizado' } };
  const LED_TRIGGER_STATUSES = ['Aguardando-Mecanico', 'Servico-Autorizado'];

  // Seletores
  const userScreen = document.getElementById('userScreen');
  const app = document.getElementById('app');
  const loginForm = document.getElementById('loginForm');
  const userSelect = document.getElementById('userSelect');
  const passwordInput = document.getElementById('passwordInput');
  const loginError = document.getElementById('loginError');
  const kanbanBoard = document.getElementById('kanbanBoard');
  const addOSBtn = document.getElementById('addOSBtn');
  const logoutButton = document.getElementById('logoutButton');
  const osModal = document.getElementById('osModal');
  const osForm = document.getElementById('osForm');
  const detailsModal = document.getElementById('detailsModal');
  const logForm = document.getElementById('logForm');
  const kmUpdateForm = document.getElementById('kmUpdateForm');
  const attentionPanel = document.getElementById('attention-panel');
  const attentionPanelContainer = document.getElementById('attention-panel-container');
  const togglePanelBtn = document.getElementById('toggle-panel-btn');
  const lightbox = document.getElementById('lightbox');
  const mediaInput = document.getElementById('media-input');
  const openCameraBtn = document.getElementById('openCameraBtn');
  const openGalleryBtn = document.getElementById('openGalleryBtn');
  const alertLed = document.getElementById('alert-led');
  const postLogActions = document.getElementById('post-log-actions');
  const deleteOsBtn = document.getElementById('deleteOsBtn');
  const confirmDeleteModal = document.getElementById('confirmDeleteModal');
  const confirmDeleteText = document.getElementById('confirmDeleteText');
  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  const globalSearchInput = document.getElementById('globalSearchInput');
  const globalSearchResults = document.getElementById('globalSearchResults');
  const timelineContainer = document.getElementById('timelineContainer');
  const thumbnailGrid = document.getElementById('thumbnail-grid');
  const confirmDeleteLogModal = document.getElementById('confirmDeleteLogModal');
  const confirmDeleteLogText = document.getElementById('confirmDeleteLogText');
  const cancelDeleteLogBtn = document.getElementById('cancelDeleteLogBtn');
  const confirmDeleteLogBtn = document.getElementById('confirmDeleteLogBtn');
  const confirmDeleteMediaModal = document.getElementById('confirmDeleteMediaModal');
  const confirmDeleteMediaText = document.getElementById('confirmDeleteMediaText');
  const cancelDeleteMediaBtn = document.getElementById('cancelDeleteMediaBtn');
  const confirmDeleteMediaBtn = document.getElementById('confirmDeleteMediaBtn');
  const adminBtn = document.getElementById('adminBtn');
  const adminModal = document.getElementById('adminModal');
  const cloudinaryForm = document.getElementById('cloudinaryForm');
  const activeCloudinaryInfo = document.getElementById('activeCloudinaryInfo');
  const detailsHeader = document.getElementById('detailsHeader');
  const reportsBtn = document.getElementById('reportsBtn');
  const reportsModal = document.getElementById('reportsModal');
  const reportsForm = document.getElementById('reportsForm');
  const reportsResultContainer = document.getElementById('reportsResultContainer');
  const exportReportBtn = document.getElementById('exportReportBtn');
  const arBtn = document.getElementById('arBtn');

  const formatStatus = (status) => status.replace(/-/g, ' ');

  const logoutUser = () => { localStorage.removeItem('currentUserSession'); location.reload(); };

  const scheduleDailyLogout = () => {
    const now = new Date();
    const logoutTime = new Date();
    logoutTime.setHours(19, 0, 0, 0);
    if (now > logoutTime) logoutTime.setDate(logoutTime.getDate() + 1);
    setTimeout(() => { if (localStorage.getItem('currentUserSession')) { showNotification('Sessão encerrada.', 'success'); setTimeout(logoutUser, 2000); } }, logoutTime.getTime() - now.getTime());
  };

  const loginUser = (user) => {
    const sessionData = { user: user, loginTime: new Date().toISOString() };
    localStorage.setItem('currentUserSession', JSON.stringify(sessionData));
    currentUser = user;
    document.getElementById('currentUserName').textContent = user.name;
    userScreen.classList.add('hidden');
    app.classList.remove('hidden');
    
    initializeKanban();
    listenToServiceOrders();
    listenToNotifications();
    listenToCloudinaryConfigs(); 
    scheduleDailyLogout();

    if(arBtn) arBtn.classList.remove('hidden'); 
    
    // RESTAURADO: Permissões do Thiago (Botão Relatórios e Admin)
    if (user.name === 'Thiago Ventura Valencio') {
      adminBtn.classList.remove('hidden');
      reportsBtn.classList.remove('hidden');
    }
  };

  const initializeLoginScreen = () => {
    const storedSession = localStorage.getItem('currentUserSession');
    if (storedSession) {
        const sessionData = JSON.parse(storedSession);
        const loginTime = new Date(sessionData.loginTime);
        const now = new Date();
        const lastCutoff = new Date();
        lastCutoff.setHours(19, 0, 0, 0);
        if (now < lastCutoff) lastCutoff.setDate(lastCutoff.getDate() - 1);
        if (loginTime < lastCutoff) { logoutUser(); return; }
        loginUser(sessionData.user);
        return;
    }
    userScreen.classList.remove('hidden'); app.classList.add('hidden');
    userSelect.innerHTML = '<option value="">Selecione seu usuário...</option>';
    USERS.forEach(user => { const option = document.createElement('option'); option.value = user.name; option.textContent = user.name; userSelect.appendChild(option); });
  };

  const initializeKanban = () => {
    const collapsedState = JSON.parse(localStorage.getItem('collapsedColumns')) || {};
    kanbanBoard.innerHTML = STATUS_LIST.map(status => {
      const isCollapsed = collapsedState[status];
      const searchInputHTML = status === 'Entregue' ? `<div class="my-2"><input type="search" data-status="${status}" placeholder="Buscar Placa..." class="w-full p-2 text-sm border border-gray-300 rounded-md search-input-entregue"></div>` : '';
      const columnLedHTML = isCollapsed ? '<div class="column-led ml-2"></div>' : '';
      return `<div class="status-column p-4"><div class="flex justify-between items-center cursor-pointer toggle-column-btn mb-2" data-status="${status}"><div class="flex items-center"><h3 class="font-bold text-gray-800">${formatStatus(status)}</h3>${columnLedHTML}</div><i class='bx bxs-chevron-down ${isCollapsed ? 'rotate-180' : ''}'></i></div>${searchInputHTML}<div class="space-y-3 vehicle-list ${isCollapsed ? 'collapsed' : ''}" data-status="${status}"></div></div>`;
    }).join('');
  };

  const createCardHTML = (os) => {
    const idx = STATUS_LIST.indexOf(os.status);
    const prev = idx > 0 ? STATUS_LIST[idx - 1] : null;
    const next = idx < STATUS_LIST.length - 1 ? STATUS_LIST[idx + 1] : null;
    const prevBtn = prev ? `<button data-os-id="${os.id}" data-new-status="${prev}" class="btn-move-status p-2 rounded-full hover:bg-gray-100"><i class='bx bx-chevron-left text-xl text-gray-600'></i></button>` : `<div class="w-10 h-10"></div>`;
    const nextBtn = next ? `<button data-os-id="${os.id}" data-new-status="${next}" class="btn-move-status p-2 rounded-full hover:bg-gray-100"><i class='bx bx-chevron-right text-xl text-gray-600'></i></button>` : `<div class="w-10 h-10"></div>`;
    const priority = os.priority ? `<div class="priority-indicator priority-${os.priority}" title="Urgência: ${os.priority}"></div>` : '';
    return `<div id="${os.id}" class="vehicle-card status-${os.status}" data-os-id="${os.id}">${priority}<div class="flex justify-between items-start"><div class="card-clickable-area cursor-pointer flex-grow"><p class="font-bold text-base text-gray-800">${os.placa}</p><p class="text-sm text-gray-600">${os.modelo}</p><div class="text-xs mt-1 text-gray-500">KM: ${os.km || 'N/A'}</div></div><div class="flex flex-col -mt-1 -mr-1">${nextBtn}${prevBtn}</div></div></div>`;
  };

  const renderDeliveredColumn = () => {
      const list = kanbanBoard.querySelector('.vehicle-list[data-status="Entregue"]');
      if (!list) return;
      const term = kanbanBoard.querySelector('.search-input-entregue')?.value.toUpperCase().trim() || '';
      let items = Object.values(allServiceOrders).filter(os => os.status === 'Entregue');
      if (term) items = items.filter(os => (os.placa?.toUpperCase().includes(term)) || (os.modelo?.toUpperCase().includes(term)));
      // PERFORMANCE: Limita a exibição
      const recentItems = items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50); 
      list.innerHTML = recentItems.map(os => createCardHTML(os)).join('');
  };

  // PERFORMANCE: Debounce para evitar travamento
  const triggerAttentionUpdate = () => {
      clearTimeout(attentionUpdateTimeout);
      attentionUpdateTimeout = setTimeout(updateAttentionPanel, 100);
  };

  const listenToServiceOrders = () => {
    const osRef = db.ref('serviceOrders');
    osRef.on('child_added', snapshot => {
      const os = { ...snapshot.val(), id: snapshot.key };
      allServiceOrders[os.id] = os;
      if (os.status === 'Entregue') renderDeliveredColumn();
      else { const l = kanbanBoard.querySelector(`.vehicle-list[data-status="${os.status}"]`); if(l) l.insertAdjacentHTML('beforeend', createCardHTML(os)); }
      triggerAttentionUpdate();
    });
    osRef.on('child_changed', snapshot => {
      const os = { ...snapshot.val(), id: snapshot.key };
      const oldOs = allServiceOrders[os.id];
      allServiceOrders[os.id] = os;
      const card = document.getElementById(os.id);
      if (oldOs && oldOs.status !== os.status) {
        if (card) card.remove();
        if (os.status === 'Entregue') renderDeliveredColumn();
        else { const l = kanbanBoard.querySelector(`.vehicle-list[data-status="${os.status}"]`); if(l) l.insertAdjacentHTML('beforeend', createCardHTML(os)); }
        if (oldOs.status === 'Entregue') renderDeliveredColumn();
      } else if (card) {
        if (os.status === 'Entregue') renderDeliveredColumn(); else card.outerHTML = createCardHTML(os);
      }
      if(!detailsModal.classList.contains('hidden') && document.getElementById('logOsId').value === os.id) { renderTimeline(os); renderMediaGallery(os); }
      triggerAttentionUpdate();
    });
    osRef.on('child_removed', snapshot => { delete allServiceOrders[snapshot.key]; const c = document.getElementById(snapshot.key); if(c) c.remove(); renderDeliveredColumn(); triggerAttentionUpdate(); });
  };

  const updateAttentionPanel = () => {
    let triggering = new Set();
    Object.values(allServiceOrders).forEach(os => { if (LED_TRIGGER_STATUSES.includes(os.status)) triggering.add(os.id); });
    attentionPanel.innerHTML = Object.entries(ATTENTION_STATUSES).map(([key, cfg]) => {
        const items = Object.values(allServiceOrders).filter(os => os.status === key);
        const blink = (items.length > 0 && cfg.blinkClass && !attentionPanelContainer.classList.contains('collapsed')) ? cfg.blinkClass : '';
        const listHTML = items.length > 0 ? items.map(os => `<p class="cursor-pointer attention-vehicle text-white hover:text-blue-300" data-os-id="${os.id}">${os.placa} - ${os.modelo}</p>`).join('') : `<p class="text-gray-400">- Vazio -</p>`;
        return `<div class="attention-box p-2 rounded-md bg-gray-900 border-2 border-gray-700 ${blink}"><h3 class="text-center text-${cfg.color}-400 font-bold text-xs truncate">${cfg.label}</h3><div class="mt-1 text-center text-white text-xs space-y-1 h-16 overflow-y-auto">${listHTML}</div></div>`;
    }).join('');
    alertLed.classList.toggle('hidden', !(triggering.size > 0 && attentionPanelContainer.classList.contains('collapsed')));
  };

  function sendTeamNotification(message) { if (!currentUser) return; db.ref('notifications').push({ message, user: currentUser.name, timestamp: firebase.database.ServerValue.TIMESTAMP }); }
  function listenToNotifications() { db.ref('notifications').orderByChild('timestamp').startAt(appStartTime).on('child_added', s => { const n = s.val(); if (n && n.user !== currentUser.name) showNotification(n.message); s.ref.remove(); }); }
  const listenToCloudinaryConfigs = () => { db.ref('cloudinaryConfigs').orderByChild('timestamp').limitToLast(1).on('value', s => { if (s.exists()) { s.forEach(c => { const val = c.val(); activeCloudinaryConfig = { ...val, key: c.key }; document.getElementById('activeCloudinaryInfo').textContent = `Cloud: ${val.cloudName}`; }); } else document.getElementById('activeCloudinaryInfo').textContent = 'Sem config.'; }); };

  const updateServiceOrderStatus = async (osId, newStatus) => {
    const os = allServiceOrders[osId]; if (!os) return;
    const updates = { status: newStatus, lastUpdate: new Date().toISOString() };
    if (newStatus === 'Em-Analise') updates.responsibleForBudget = currentUser.name;
    else if (newStatus === 'Em-Execucao') updates.responsibleForService = currentUser.name;
    else if (newStatus === 'Entregue') updates.responsibleForDelivery = currentUser.name;
    try { await db.ref(`serviceOrders/${osId}/logs`).push({ timestamp: new Date().toISOString(), user: currentUser.name, description: `Status alterado para "${formatStatus(newStatus)}"`, type: 'status' }); await db.ref(`serviceOrders/${osId}`).update(updates); sendTeamNotification(`O.S. ${os.placa} movida para ${formatStatus(newStatus)}`); } catch (e) { showNotification("Erro ao mover.", "error"); }
  };

  const openDetailsModal = (osId) => {
    const os = allServiceOrders[osId]; if (!os) return;
    const canEdit = currentUser.name === 'Thiago Ventura Valencio';
    const editIcon = `<i class='bx bxs-edit-alt text-gray-400 hover:text-blue-600 cursor-pointer ml-2 text-lg'></i>`;
    detailsHeader.innerHTML = `<div class="mb-4"><h2 class="text-3xl font-bold text-gray-800 inline-flex items-center"><span data-field="placa">${os.placa}</span>${canEdit ? `<span class="edit-btn" data-field="placa">${editIcon}</span>` : ''}<span class="mx-2">-</span><span data-field="modelo">${os.modelo}</span>${canEdit ? `<span class="edit-btn" data-field="modelo">${editIcon}</span>` : ''}</h2><p class="text-lg text-gray-600 mt-1"><span>Cliente: </span><span data-field="cliente">${os.cliente}</span>${canEdit ? `<span class="edit-btn" data-field="cliente">${editIcon}</span>` : ''}<br><span class="text-sm text-gray-500">Tel: <span data-field="telefone">${os.telefone || 'N/A'}</span>${canEdit ? `<span class="edit-btn" data-field="telefone">${editIcon}</span>` : ''}</span></p><p class="text-lg text-blue-800 font-bold mt-1">KM: ${os.km || 'N/A'}</p></div>`;
    const obsDiv = document.getElementById('detailsObservacoes');
    obsDiv.innerHTML = `<div class="flex justify-between items-center"><h4 class="text-sm font-semibold text-gray-500">Queixa:</h4>${canEdit ? `<span class="edit-btn" data-field="observacoes">${editIcon}</span>` : ''}</div><p class="text-gray-800 bg-yellow-100 p-3 rounded-md whitespace-pre-wrap" data-field="observacoes">${os.observacoes}</p>`;
    obsDiv.classList.remove('hidden');
    deleteOsBtn.classList.toggle('hidden', !(currentUser.role === 'Gestor' || currentUser.role === 'Atendente'));
    document.getElementById('logOsId').value = osId;
    logForm.reset(); document.getElementById('fileName').textContent = ''; filesToUpload = []; postLogActions.style.display = 'none';
    renderTimeline(os); renderMediaGallery(os);
    detailsModal.classList.remove('hidden'); detailsModal.classList.add('flex');
  };

  const renderTimeline = (os) => {
    const logs = Object.entries(os.logs || {}).sort(([,a], [,b]) => new Date(b.timestamp) - new Date(a.timestamp));
    timelineContainer.innerHTML = logs.length ? logs.map(([id, log]) => {
      const canDel = (currentUser.role === 'Gestor' || currentUser.role === 'Atendente') && !log.description?.startsWith('ATT EXCLUIDA');
      
      // === CORREÇÃO: FORMATAÇÃO DE DATA E HORA ===
      const dateObj = new Date(log.timestamp);
      // Aqui usamos pt-BR completo para exibir data e hora
      const dataHoraFormatada = dateObj.toLocaleString('pt-BR');

      return `<div class="timeline-item"><div class="bg-gray-50 p-3 rounded-lg relative">${canDel ? `<button class="delete-log-btn" data-os-id="${os.id}" data-log-id="${id}"><i class='bx bx-x text-lg'></i></button>` : ''}<div class="flex justify-between mb-1"><h4 class="font-semibold text-gray-800 text-sm">${log.user}</h4><span class="text-xs text-gray-500">${dataHoraFormatada}</span></div><p class="text-gray-700 text-sm">${log.description}</p>${log.parts ? `<p class="text-gray-600 text-xs mt-1"><strong>Peças:</strong> ${log.parts}</p>` : ''}${log.value ? `<p class="text-green-600 text-xs mt-1"><strong>Valor:</strong> R$ ${parseFloat(log.value).toFixed(2)}</p>` : ''}</div></div>`;
    }).join('') : '<p class="text-gray-500 text-center py-4">Sem histórico.</p>';
  };

  // RESTAURADO: TRUQUE w_200 (Miniaturas Rápidas)
  const renderMediaGallery = (os) => {
    const media = Object.entries(os.media || {});
    lightboxMedia = media.map(e => ({...e[1], key: e[0]}));
    thumbnailGrid.innerHTML = media.length ? media.map(([key, item], idx) => {
        const canDel = USERS_CAN_DELETE_MEDIA.includes(currentUser.name);
        
        let thumbUrl = item.url;
        if(item.url.includes('cloudinary.com') && item.type.startsWith('image')) {
            thumbUrl = item.url.replace('/upload/', '/upload/w_200,h_200,c_fill,q_auto,f_auto/');
        }
        
        let content = `<i class='bx bx-file text-4xl text-gray-500'></i>`;
        if (item.type?.startsWith('image')) content = `<img src="${thumbUrl}" class="w-full h-full object-cover">`;
        else if (item.type?.startsWith('video')) content = `<i class='bx bx-play-circle text-4xl text-blue-500'></i>`;
        return `<div class="thumbnail-container aspect-square bg-gray-200 rounded-md overflow-hidden flex items-center justify-center relative">${canDel ? `<button class="delete-media-btn" data-os-id="${os.id}" data-media-key="${key}"><i class='bx bxs-trash'></i></button>` : ''}<div class="thumbnail-item w-full h-full cursor-pointer" data-index="${idx}">${content}</div></div>`;
    }).join('') : `<div class="col-span-full text-center py-8 text-gray-400"><p class="text-sm">Sem mídia</p></div>`;
  };

  const exportOsToPrint = (osId) => {
    const os = allServiceOrders[osId];
    if (!os) { showNotification('Dados da O.S. não encontrados.', 'error'); return; }
    
    // Formata Data E HORA
    const formatDate = (isoString) => {
        if (!isoString) return 'N/A';
        return new Date(isoString).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    };

    const logs = os.logs ? Object.values(os.logs).sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp)) : [];
    let totalValue = 0;
    
    const timelineHtml = logs.map(log => {
        if (log.value) { totalValue += parseFloat(log.value); }
        return `<tr>
            <td>${formatDate(log.timestamp)}</td>
            <td>${log.user}</td>
            <td>${log.description}</td>
            <td>${log.parts || '---'}</td>
            <td style="text-align: right;">${log.value ? `R$ ${parseFloat(log.value).toFixed(2)}` : '---'}</td>
        </tr>`;
    }).join('');

    const media = os.media ? Object.values(os.media) : [];
    const photos = media.filter(item => item && item.type && item.type.startsWith('image/'));
    const photosHtml = photos.length > 0 
        ? `<div class="section"><h2>Registros Fotográficos</h2><div class="photo-gallery">${photos.map(photo => `<img src="${photo.url}" alt="Foto da O.S.">`).join('')}</div></div>` 
        : '';

    const printHtml = `
    <html>
    <head>
        <title>Ordem de Serviço - ${os.placa}</title>
        <style>
            body{font-family:sans-serif;margin:0;padding:20px;color:#333}
            .container{max-width:800px;margin:auto}
            .header{text-align:center;border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:20px}
            .header h1{margin:0;font-size:24px;color:#1d4ed8}.header p{margin:5px 0}
            .section{margin-bottom:20px;border:1px solid #ccc;border-radius:8px;padding:15px;page-break-inside:avoid}
            .section h2{margin-top:0;font-size:18px;border-bottom:1px solid #eee;padding-bottom:5px;margin-bottom:10px;color:#444}
            .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
            .grid-item strong{color:#555}
            table{width:100%;border-collapse:collapse;margin-top:10px}
            th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:12px}
            th{background-color:#f2f2f2}
            .total{text-align:right;font-size:18px;font-weight:bold;margin-top:20px}
            .photo-gallery{display:grid;grid-template-columns:repeat(3, 1fr);gap:10px;margin-top:10px}
            .photo-gallery img{width:100%;height:150px;object-fit:cover;border:1px solid #ddd;border-radius:4px}
            .footer{text-align:center;margin-top:50px;padding-top:20px;border-top:1px solid #ccc}
            .signature-line{border-bottom:1px solid #000;width:300px;margin:50px auto 10px auto}
            @media print{.no-print{display:none}}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>CHEVRON Bosch Car Service</h1>
                <p>Relatório Técnico de Manutenção</p>
            </div>
            <div class="section">
                <h2>Dados do Veículo e Cliente</h2>
                <div class="grid">
                    <div class="grid-item"><strong>Placa:</strong> ${os.placa}</div>
                    <div class="grid-item"><strong>Modelo:</strong> ${os.modelo}</div>
                    <div class="grid-item"><strong>Cliente:</strong> ${os.cliente}</div>
                    <div class="grid-item"><strong>Telefone:</strong> ${os.telefone||"N/A"}</div>
                    <div class="grid-item"><strong>KM Atual:</strong> ${os.km?new Intl.NumberFormat("pt-BR").format(os.km):"N/A"}</div>
                    <div class="grid-item"><strong>Abertura:</strong> ${formatDate(os.createdAt)}</div>
                </div>
            </div>
            ${os.observacoes ? `<div class="section"><h2>Queixa do Cliente</h2><p>${os.observacoes}</p></div>` : ""}
            <div class="section">
                <h2>Histórico de Serviços e Peças</h2>
                <table>
                    <thead><tr><th>Data/Hora</th><th>Técnico</th><th>Descrição</th><th>Peças</th><th style="text-align:right;">Valor</th></tr></thead>
                    <tbody>${timelineHtml||'<tr><td colspan="5" style="text-align:center;">Sem registros.</td></tr>'}</tbody>
                </table>
                <div class="total">Total Estimado: R$ ${totalValue.toFixed(2)}</div>
            </div>
            ${photosHtml}
            <div class="footer">
                <div class="signature-line"></div>
                <p>Assinatura do Responsável / Cliente</p>
                <p style="font-size:10px;color:#888;margin-top:20px">Desenvolvido com 🤖 - por thIAguinho Soluções - gerado em: ${new Date().toLocaleString("pt-BR")}</p>
            </div>
        </div>
        <script>window.onload=function(){window.print();setTimeout(function(){window.close()},500)}<\/script>
    </body>
    </html>`;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printHtml);
    printWindow.document.close();
  };
  const openLightbox = (idx) => { currentLightboxIndex = idx; const m = lightboxMedia[idx]; if(!m) return; if(m.type==='application/pdf'){ window.open(m.url); return; } document.getElementById('lightbox-content').innerHTML = m.type.startsWith('image')?`<img src="${m.url}" class="max-w-full max-h-full">`:`<video src="${m.url}" controls class="max-w-full max-h-full"></video>`; lightbox.classList.remove('hidden'); lightbox.classList.add('flex'); };

  loginForm.addEventListener('submit', (e) => { e.preventDefault(); const u = USERS.find(x => x.name === userSelect.value); if(u && u.password === passwordInput.value) loginUser(u); else loginError.textContent = 'Senha incorreta.'; });
  logoutButton.addEventListener('click', logoutUser);
  togglePanelBtn.addEventListener('click', () => { attentionPanelContainer.classList.toggle('collapsed'); togglePanelBtn.querySelector('i').classList.toggle('rotate-180'); updateAttentionPanel(); });
  attentionPanel.addEventListener('click', (e) => { const el = e.target.closest('.attention-vehicle'); if(el) openDetailsModal(el.dataset.osId); });
  kanbanBoard.addEventListener('click', (e) => { const mv = e.target.closest('.btn-move-status'); const ck = e.target.closest('.card-clickable-area'); const tg = e.target.closest('.toggle-column-btn'); if(mv) { e.stopPropagation(); updateServiceOrderStatus(mv.dataset.osId, mv.dataset.newStatus); } else if(ck) openDetailsModal(e.target.closest('.vehicle-card').dataset.osId); else if(tg) { const l = kanbanBoard.querySelector(`.vehicle-list[data-status="${tg.dataset.status}"]`); l.classList.toggle('collapsed'); tg.querySelector('i').classList.toggle('rotate-180'); localStorage.setItem('collapsedColumns', JSON.stringify({ ...JSON.parse(localStorage.getItem('collapsedColumns')), [tg.dataset.status]: l.classList.contains('collapsed') })); } });
  kanbanBoard.addEventListener('input', (e) => { if(e.target.matches('.search-input-entregue')) renderDeliveredColumn(); });
  globalSearchInput.addEventListener('input', (e) => { const t = e.target.value.toUpperCase().trim(); if(!t) { globalSearchResults.classList.add('hidden'); return; } const res = Object.values(allServiceOrders).filter(o => o.placa?.toUpperCase().includes(t)).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)); globalSearchResults.innerHTML = res.map(o => `<div class="search-result-item p-2 hover:bg-gray-100 cursor-pointer" data-os-id="${o.id}"><p class="font-bold">${o.placa}</p><p class="text-sm">${formatStatus(o.status)}</p></div>`).join(''); globalSearchResults.classList.remove('hidden'); });
  globalSearchResults.addEventListener('click', (e) => { const el = e.target.closest('.search-result-item'); if(el) { openDetailsModal(el.dataset.osId); globalSearchResults.classList.add('hidden'); } });
  
  // === CORREÇÃO CRÍTICA DO TRAVAMENTO ===
  document.addEventListener('click', (e) => { 
      if(e.target.closest('.btn-close-modal') || ['detailsModal','osModal','adminModal','reportsModal'].includes(e.target.id)) {
          document.getElementById(e.target.id||e.target.closest('.modal').id).classList.add('hidden'); 
      }
      
      // Correção: Verifica se search-container existe antes de checar click
      const sc = document.querySelector('.search-container');
      if(sc && !sc.contains(e.target)) {
          globalSearchResults.classList.add('hidden'); 
      }
  });

  thumbnailGrid.addEventListener('click', (e) => { const d = e.target.closest('.delete-media-btn'); if(d) { e.stopPropagation(); confirmDeleteMediaBtn.dataset.osId = d.dataset.osId; confirmDeleteMediaBtn.dataset.mediaKey = d.dataset.mediaKey; confirmDeleteMediaModal.classList.remove('hidden'); confirmDeleteMediaModal.classList.add('flex'); } else if(e.target.closest('.thumbnail-item')) openLightbox(parseInt(e.target.closest('.thumbnail-item').dataset.index)); });
  addOSBtn.addEventListener('click', () => { document.getElementById('osModalTitle').textContent = 'Nova O.S.'; document.getElementById('osId').value = ''; osForm.reset(); document.getElementById('osResponsavel').innerHTML = USERS.map(u => `<option>${u.name}</option>`).join(''); osModal.classList.remove('hidden'); osModal.classList.add('flex'); });
  osForm.addEventListener('submit', (e) => { e.preventDefault(); const d = { placa: document.getElementById('osPlaca').value.toUpperCase(), modelo: document.getElementById('osModelo').value, cliente: document.getElementById('osCliente').value, telefone: document.getElementById('osTelefone').value, km: parseInt(document.getElementById('osKm').value), responsible: document.getElementById('osResponsavel').value, observacoes: document.getElementById('osObservacoes').value, priority: document.querySelector('input[name="osPrioridade"]:checked').value, status: 'Aguardando-Mecanico', createdAt: new Date().toISOString(), lastUpdate: new Date().toISOString() }; db.ref('serviceOrders').push(d); osModal.classList.add('hidden'); });
  
  // CORREÇÃO: MÚLTIPLAS FOTOS (.push) - LÓGICA ORIGINAL DO SEU ARQUIVO
  logForm.addEventListener('submit', async (e) => { 
      e.preventDefault(); 
      const id = document.getElementById('logOsId').value; 
      
      if(filesToUpload.length) {
          for(let f of filesToUpload) { 
              const r = await uploadFileToCloudinary(f); 
              await db.ref(`serviceOrders/${id}/media`).push({url:r.url, type:f.type}); 
          }
      }
      
      await db.ref(`serviceOrders/${id}/logs`).push({ timestamp: new Date().toISOString(), user: currentUser.name, description: document.getElementById('logDescricao').value, parts: document.getElementById('logPecas').value, value: document.getElementById('logValor').value }); 
      logForm.reset(); 
      filesToUpload = []; // Reseta a lista
      document.getElementById('fileName').textContent = '';
      postLogActions.style.display = 'block'; 
  });

  ['btn-move-next','btn-move-prev','btn-stay'].forEach(id => document.getElementById(id).addEventListener('click', () => { if(id!=='btn-stay') { const os = allServiceOrders[document.getElementById('logOsId').value]; const idx = STATUS_LIST.indexOf(os.status); const next = id==='btn-move-next'?STATUS_LIST[idx+1]:STATUS_LIST[idx-1]; if(next) updateServiceOrderStatus(os.id, next); } detailsModal.classList.add('hidden'); }));
  kmUpdateForm.addEventListener('submit', async(e)=>{e.preventDefault(); const km=parseInt(document.getElementById('updateKmInput').value); const id=document.getElementById('logOsId').value; await db.ref(`serviceOrders/${id}`).update({km}); await db.ref(`serviceOrders/${id}/logs`).push({timestamp:new Date().toISOString(), user:currentUser.name, description:`KM: ${km}`, type:'log'}); });
  deleteOsBtn.addEventListener('click', ()=>{confirmDeleteModal.classList.remove('hidden'); confirmDeleteModal.classList.add('flex'); confirmDeleteText.innerHTML='Excluir OS?';}); confirmDeleteBtn.addEventListener('click', ()=>{ db.ref(`serviceOrders/${document.getElementById('logOsId').value}`).remove(); detailsModal.classList.add('hidden'); confirmDeleteModal.classList.add('hidden'); }); cancelDeleteBtn.addEventListener('click', ()=>confirmDeleteModal.classList.add('hidden'));
  confirmDeleteLogBtn.addEventListener('click', async()=>{ await db.ref(`serviceOrders/${confirmDeleteLogBtn.dataset.osId}/logs/${confirmDeleteLogBtn.dataset.logId}`).remove(); confirmDeleteLogModal.classList.add('hidden'); }); cancelDeleteLogBtn.addEventListener('click', ()=>confirmDeleteLogModal.classList.add('hidden'));
  confirmDeleteMediaBtn.addEventListener('click', async()=>{ await db.ref(`serviceOrders/${confirmDeleteMediaBtn.dataset.osId}/media/${confirmDeleteMediaBtn.dataset.mediaKey}`).remove(); confirmDeleteMediaModal.classList.add('hidden'); }); cancelDeleteMediaBtn.addEventListener('click', ()=>confirmDeleteMediaModal.classList.add('hidden'));
  
  openCameraBtn.addEventListener('click', ()=>{mediaInput.accept='image/*'; mediaInput.capture='camera'; mediaInput.click();}); 
  openGalleryBtn.addEventListener('click', ()=>{mediaInput.accept='image/*,video/*,application/pdf'; mediaInput.removeAttribute('capture'); mediaInput.click();}); 
  
  mediaInput.addEventListener('change', (e)=>{
      if(e.target.files.length > 0) {
          filesToUpload.push(...e.target.files);
      }
      document.getElementById('fileName').textContent = `${filesToUpload.length} foto(s) na lista`;
  });

  ['lightbox-prev','lightbox-next','lightbox-close','lightbox-close-bg'].forEach(id=>document.getElementById(id).addEventListener('click', ()=>{ if(id.includes('prev')&&currentLightboxIndex>0) openLightbox(currentLightboxIndex-1); else if(id.includes('next')&&currentLightboxIndex<lightboxMedia.length-1) openLightbox(currentLightboxIndex+1); else lightbox.classList.add('hidden'); }));
  adminBtn.addEventListener('click', ()=>{adminModal.classList.remove('hidden'); adminModal.classList.add('flex');}); cloudinaryForm.addEventListener('submit', (e)=>{e.preventDefault(); db.ref('cloudinaryConfigs').push({cloudName:document.getElementById('cloudNameInput').value, uploadPreset:document.getElementById('uploadPresetInput').value, timestamp:firebase.database.ServerValue.TIMESTAMP}); adminModal.classList.add('hidden');});
  
  // RESTAURADO: Lógica do Relatório (Botão e PDF)
  reportsBtn.addEventListener('click', () => { reportsForm.reset(); reportsResultContainer.innerHTML = ''; exportReportBtn.classList.add('hidden'); reportsModal.classList.remove('hidden'); reportsModal.classList.add('flex'); });
  reportsForm.addEventListener('submit', (e) => { e.preventDefault(); const startDate = new Date(document.getElementById('startDate').value + 'T00:00:00'); const endDate = new Date(document.getElementById('endDate').value + 'T23:59:59'); const delivered = Object.values(allServiceOrders).filter(os => { if (os.status !== 'Entregue') return false; const d = new Date(os.lastUpdate); return d >= startDate && d <= endDate; }).sort((a,b) => new Date(b.lastUpdate) - new Date(a.lastUpdate)); if (delivered.length > 0) { reportsResultContainer.innerHTML = `<table id="reportTable" class="w-full text-sm"><thead><tr><th>Data</th><th>Placa</th><th>Modelo</th><th>Cliente</th></tr></thead><tbody>${delivered.map(os => `<tr><td>${new Date(os.lastUpdate).toLocaleDateString()}</td><td>${os.placa}</td><td>${os.modelo}</td><td>${os.cliente}</td></tr>`).join('')}</tbody></table>`; exportReportBtn.classList.remove('hidden'); } else { reportsResultContainer.innerHTML = '<p class="text-center p-4">Nenhum veículo.</p>'; exportReportBtn.classList.add('hidden'); } });
  exportReportBtn.addEventListener('click', () => { const { jsPDF } = window.jspdf; const doc = new jsPDF(); doc.text("Veículos Entregues", 14, 16); doc.autoTable({ html: '#reportTable' }); doc.save(`Relatorio_${new Date().toISOString().slice(0,10)}.pdf`); });

  if(arBtn) arBtn.addEventListener('click', () => window.location.href = 'consultor.html');
  
  detailsModal.addEventListener('click', (e) => {
      const edit = e.target.closest('.edit-btn');
      if(edit) {
          const field = edit.dataset.field; const el = detailsModal.querySelector(`[data-field="${field}"]`);
          if(el.querySelector('input,textarea')) return;
          const old = el.textContent;
          el.innerHTML = field==='observacoes' ? `<textarea class="w-full border p-1">${old}</textarea>` : `<input value="${old}" class="w-full border p-1">`;
          const inp = el.querySelector('input,textarea'); inp.focus();
          inp.addEventListener('blur', () => {
              const val = inp.value.trim(); const id = document.getElementById('logOsId').value;
              if(val && val!==old) {
                  db.ref(`serviceOrders/${id}`).update({[field]: field==='placa'?val.toUpperCase():val});
                  db.ref(`serviceOrders/${id}/logs`).push({timestamp:new Date().toISOString(), user:currentUser.name, description:`Alterou ${field} para ${val}`, type:'log'});
                  el.textContent = field==='placa'?val.toUpperCase():val;
              } else el.textContent = old;
          });
      }
      const exp = e.target.closest('#exportOsBtn');
      if(exp) exportOsToPrint(document.getElementById('logOsId').value);
  });

  initializeLoginScreen();
});
