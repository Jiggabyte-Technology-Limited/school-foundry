document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const loginContainer = document.getElementById('login-container');
  const keygenContainer = document.getElementById('keygen-container');
  const loginForm = document.getElementById('login-form');
  const passwordInput = document.getElementById('password');
  const loginError = document.getElementById('login-error');
  const logoutBtn = document.getElementById('logout-btn');
  
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  const subTabs = document.querySelectorAll('.sub-tab');
  const subTabContents = document.querySelectorAll('.sub-tab-content');
  
  const clientNameInput = document.getElementById('client-name');
  const machineIdInput = document.getElementById('machine-id');
  const generateBtn = document.getElementById('generate-btn');
  const generateError = document.getElementById('generate-error');
  const resultArea = document.getElementById('result-area');
  const licenseKeyDisplay = document.getElementById('license-key-display');
  const copyBtn = document.getElementById('copy-btn');
  const historyList = document.getElementById('history-list');
  const historyTabBtn = document.getElementById('history-tab-btn');
  
  const dropZone = document.getElementById('drop-zone');
  const fileUpload = document.getElementById('file-upload');
  const qrResult = document.getElementById('qr-result');
  const canvasElement = document.getElementById('canvas');
  const canvas = canvasElement.getContext('2d');

  let authToken = localStorage.getItem('keygen_token');
  let currentMachineId = '';

  // Initialization
  if (authToken) {
    showKeygen();
  }

  // --- Auth Logic ---
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = passwordInput.value;
    loginError.textContent = '';

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      
      const data = await res.json();
      
      if (data.success) {
        authToken = data.token;
        localStorage.setItem('keygen_token', authToken);
        passwordInput.value = '';
        showKeygen();
      } else {
        loginError.textContent = data.message || 'Login failed';
      }
    } catch (err) {
      loginError.textContent = 'Server error. Is it running?';
    }
  });

  logoutBtn.addEventListener('click', () => {
    authToken = null;
    localStorage.removeItem('keygen_token');
    showLogin();
  });

  function showLogin() {
    keygenContainer.classList.add('hidden');
    loginContainer.classList.remove('hidden');
    resetGenerator();
  }

  function showKeygen() {
    loginContainer.classList.add('hidden');
    keygenContainer.classList.remove('hidden');
  }

  // --- Tabs Logic ---
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(tc => tc.classList.remove('active'));
      
      tab.classList.add('active');
      document.getElementById(tab.dataset.target).classList.add('active');
    });
  });

  subTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      subTabs.forEach(t => t.classList.remove('active'));
      subTabContents.forEach(tc => tc.classList.remove('active'));
      
      tab.classList.add('active');
      document.getElementById(tab.dataset.target).classList.add('active');
    });
  });

  historyTabBtn.addEventListener('click', loadHistory);

  // --- History Logic ---
  async function loadHistory() {
    historyList.innerHTML = '<p class="text-muted text-center">Loading history...</p>';
    try {
      const res = await fetch('/api/licenses', {
        headers: { 'Authorization': authToken }
      });
      const data = await res.json();
      if (res.ok) {
        if (!data.licenses || data.licenses.length === 0) {
          historyList.innerHTML = '<p class="text-muted text-center">No licenses generated yet.</p>';
          return;
        }
        
        historyList.innerHTML = '';
        const sorted = data.licenses.sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt));
        
        sorted.forEach(lic => {
          const d = new Date(lic.generatedAt);
          const dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
          
          const item = document.createElement('div');
          item.className = 'history-item';
          item.innerHTML = `
            <div class="history-item-header">
              <span>${lic.clientName}</span>
              <span class="history-item-date">${dateStr}</span>
            </div>
            <div style="font-size: 0.8rem; font-family: monospace; color: var(--text-muted); word-break: break-all;">
              Machine ID: ${lic.machineId}
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <code style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${lic.licenseKey}</code>
              <button class="btn outline small copy-history-btn" data-key="${lic.licenseKey}">Copy</button>
            </div>
          `;
          historyList.appendChild(item);
        });

        document.querySelectorAll('.copy-history-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const key = e.target.dataset.key;
            navigator.clipboard.writeText(key).then(() => {
              const oldText = e.target.textContent;
              e.target.textContent = 'Copied!';
              setTimeout(() => e.target.textContent = oldText, 2000);
            });
          });
        });
      } else {
        if (res.status === 401) logoutBtn.click();
        historyList.innerHTML = '<p class="text-muted text-center error-msg">Failed to load history.</p>';
      }
    } catch (err) {
      historyList.innerHTML = '<p class="text-muted text-center error-msg">Network error.</p>';
    }
  }

  // --- QR Code Scanning Logic ---
  function handleFile(file) {
    if (!file) return;
    
    generateError.textContent = '';
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        canvasElement.width = img.width;
        canvasElement.height = img.height;
        canvas.drawImage(img, 0, 0, img.width, img.height);
        
        const imageData = canvas.getImageData(0, 0, img.width, img.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (code) {
          currentMachineId = code.data;
          qrResult.textContent = `Scanned Machine ID: ${currentMachineId}`;
          qrResult.style.color = 'var(--success-color)';
          machineIdInput.value = currentMachineId; // Auto-fill manual input too
        } else {
          qrResult.textContent = 'Could not find a valid QR code in the image.';
          qrResult.style.color = 'var(--error-color)';
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  fileUpload.addEventListener('change', (e) => {
    handleFile(e.target.files[0]);
  });

  // Drag and drop events
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFile(files[0]);
  });

  // --- Generation Logic ---
  generateBtn.addEventListener('click', async () => {
    // Determine active tab to get the ID
    const activeSubTab = document.querySelector('.sub-tab.active').dataset.target;
    let idToUse = '';
    
    if (activeSubTab === 'sub-tab-manual') {
      idToUse = machineIdInput.value.trim();
    } else {
      idToUse = currentMachineId;
    }

    const clientName = clientNameInput.value.trim();

    if (!clientName) {
      generateError.textContent = 'Please provide a Client Name.';
      return;
    }

    if (!idToUse) {
      generateError.textContent = 'Please provide a Machine ID.';
      return;
    }

    generateError.textContent = '';
    resultArea.classList.add('hidden');
    generateBtn.textContent = 'Generating...';
    generateBtn.disabled = true;

    try {
      const res = await fetch('/api/generate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: authToken, machineId: idToUse, clientName })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        licenseKeyDisplay.textContent = data.licenseKey;
        resultArea.classList.remove('hidden');
      } else {
        if (res.status === 401) {
          logoutBtn.click(); // Token expired or invalid
        } else {
          generateError.textContent = data.error || 'Failed to generate key';
        }
      }
    } catch (err) {
      generateError.textContent = 'Network error occurred.';
    } finally {
      generateBtn.textContent = 'Generate License Key';
      generateBtn.disabled = false;
    }
  });

  // --- Copy Logic ---
  copyBtn.addEventListener('click', () => {
    const text = licenseKeyDisplay.textContent;
    navigator.clipboard.writeText(text).then(() => {
      const originalSVG = copyBtn.innerHTML;
      copyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="color: var(--success-color)"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      setTimeout(() => {
        copyBtn.innerHTML = originalSVG;
      }, 2000);
    });
  });

  function resetGenerator() {
    clientNameInput.value = '';
    machineIdInput.value = '';
    currentMachineId = '';
    qrResult.textContent = '';
    resultArea.classList.add('hidden');
    generateError.textContent = '';
    licenseKeyDisplay.textContent = '';
    fileUpload.value = '';
  }
});
