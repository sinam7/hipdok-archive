// DOM Elements
const elements = {
  loginStatus: document.getElementById('login-status'),
  btnLogin: document.getElementById('btn-login'),
  btnLogout: document.getElementById('btn-logout'),
  notionToken: document.getElementById('notion-token'),
  notionPage: document.getElementById('notion-page'),
  btnSaveNotion: document.getElementById('btn-save-notion'),
  btnExport: document.getElementById('btn-export'),
  btnClearData: document.getElementById('btn-clear-data'),
  optBooks: document.getElementById('opt-books'),
  optReadCertify: document.getElementById('opt-readCertify'),
  optReview: document.getElementById('opt-review'),
  optBookCopy: document.getElementById('opt-bookCopy'),
  optFreeBoard: document.getElementById('opt-freeBoard'),
  optAttendance: document.getElementById('opt-attendance'),
  progressSection: document.getElementById('progress-section'),
  progressFill: document.getElementById('progress-fill'),
  progressText: document.getElementById('progress-text')
};

// State
const state = {
  isLoggedIn: false,
  hasNotionConfig: false
};

// Initialize
async function init() {
  await checkLoginStatus();
  await loadNotionConfig();
  updateExportButton();
}

// Login Management
async function checkLoginStatus() {
  state.isLoggedIn = await window.api.checkLogin();
  updateLoginUI();
}

function updateLoginUI() {
  if (state.isLoggedIn) {
    elements.loginStatus.className = 'status status-success';
    elements.loginStatus.innerHTML = `
      <span class="status-icon">●</span>
      <span class="status-text">로그인 완료</span>
    `;
    elements.btnLogin.classList.add('hidden');
    elements.btnLogout.classList.remove('hidden');
  } else {
    elements.loginStatus.className = 'status status-pending';
    elements.loginStatus.innerHTML = `
      <span class="status-icon">○</span>
      <span class="status-text">로그인이 필요합니다</span>
    `;
    elements.btnLogin.classList.remove('hidden');
    elements.btnLogout.classList.add('hidden');
  }
  updateExportButton();
}

// Notion Configuration
async function loadNotionConfig() {
  const [token, pageId] = await Promise.all([
    window.api.getNotionToken(),
    window.api.getNotionPage()
  ]);
  
  if (token) {
    elements.notionToken.value = token;
    state.hasNotionConfig = true;
  }
  if (pageId) {
    elements.notionPage.value = pageId;
  }
}

async function saveNotionConfig() {
  const token = elements.notionToken.value.trim();
  const pageId = elements.notionPage.value.trim();
  
  if (!token) {
    alert('노션 토큰을 입력해주세요.');
    return;
  }
  
  await Promise.all([
    window.api.saveNotionToken(token),
    window.api.saveNotionPage(pageId)
  ]);
  
  state.hasNotionConfig = true;
  updateExportButton();
  alert('저장되었습니다.');
}

// Export Button State
function updateExportButton() {
  const hasSelection = elements.optBooks.checked || 
                       elements.optReadCertify.checked ||
                       elements.optReview.checked ||
                       elements.optBookCopy.checked ||
                       elements.optFreeBoard.checked ||
                       elements.optAttendance.checked;
  
  elements.btnExport.disabled = !state.isLoggedIn || !state.hasNotionConfig || !hasSelection;
}

// 노션 페이지 ID 추출 (URL 또는 ID 지원)
function parseNotionPageId(input) {
  const trimmed = input.trim();
  
  // URL 형태인 경우: https://www.notion.so/username/Page-Name-1c8d6739a79f80c0af7bc093f4fb1ee1
  // 또는: https://www.notion.so/1c8d6739a79f80c0af7bc093f4fb1ee1
  const urlMatch = trimmed.match(/([a-f0-9]{32})(?:\?|$)/i) || 
                   trimmed.match(/([a-f0-9-]{36})(?:\?|$)/i) ||
                   trimmed.match(/-([a-f0-9]{32})(?:\?|$)/i);
  
  if (urlMatch) {
    return urlMatch[1].replace(/-/g, '');
  }
  
  // 이미 ID 형태인 경우
  return trimmed.replace(/-/g, '');
}

// Export Process
async function startExport() {
  const pageId = parseNotionPageId(elements.notionPage.value);
  
  if (!pageId || pageId.length < 32) {
    alert('올바른 노션 페이지 링크 또는 ID를 입력해주세요.');
    return;
  }

  const options = {
    books: elements.optBooks.checked,
    posts: {
      readCertify: elements.optReadCertify.checked,
      review: elements.optReview.checked,
      bookCopy: elements.optBookCopy.checked,
      freeBoard: elements.optFreeBoard.checked
    },
    attendance: elements.optAttendance.checked,
    pageId
  };

  elements.progressSection.classList.remove('hidden');
  elements.btnExport.disabled = true;
  
  try {
    await window.api.exportToNotion(options);
    updateProgress(100, '✅ 완료!');
    // 진행바 업데이트가 화면에 반영된 후 팝업 표시
    await new Promise(resolve => setTimeout(resolve, 300));
    alert('내보내기가 완료되었습니다!');
  } catch (error) {
    updateProgress(0, `❌ 오류: ${error.message}`);
    await new Promise(resolve => setTimeout(resolve, 100));
    alert(`오류가 발생했습니다: ${error.message}`);
  } finally {
    elements.btnExport.disabled = false;
  }
}

function updateProgress(percent, text) {
  elements.progressFill.style.width = `${percent}%`;
  elements.progressText.textContent = text;
}

// Clear All Data
async function clearAllData() {
  const confirmed = confirm('저장된 모든 정보(로그인, 노션 설정)를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.');
  
  if (!confirmed) return;
  
  await window.api.clearAllData();
  
  // UI 초기화
  state.isLoggedIn = false;
  state.hasNotionConfig = false;
  elements.notionToken.value = '';
  elements.notionPage.value = '';
  updateLoginUI();
  updateExportButton();
  
  alert('저장된 정보가 모두 삭제되었습니다.');
}

// Event Listeners
elements.btnLogin.addEventListener('click', () => window.api.openLogin());
elements.btnLogout.addEventListener('click', async () => {
  await window.api.logout();
  state.isLoggedIn = false;
  updateLoginUI();
});
elements.btnSaveNotion.addEventListener('click', saveNotionConfig);
elements.btnExport.addEventListener('click', startExport);
elements.btnClearData.addEventListener('click', clearAllData);

// Checkbox listeners
[elements.optBooks, elements.optReadCertify, elements.optReview, elements.optBookCopy, elements.optFreeBoard, elements.optAttendance].forEach(el => {
  el.addEventListener('change', updateExportButton);
});

// IPC Listeners
window.api.onLoginSuccess(() => {
  state.isLoggedIn = true;
  updateLoginUI();
});

window.api.onProgress((data) => {
  console.log('[Renderer] 진행:', data);
  updateProgress(data.percent, data.message);
});

console.log('[Renderer] 앱 초기화');

// Start
init();

