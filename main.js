const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const Store = require('./src/store');
const { scrapeBooks, scrapePosts, scrapeAttendance } = require('./src/scraper');
const { initNotion, exportToNotion } = require('./src/notion');

let store;
let mainWindow;
let loginWindow;

// ============================================
// Window Management
// ============================================

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 700,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src/renderer/index.html'));
  mainWindow.setMenuBarVisibility(false);
  
  // 개발자 도구 (필요시 주석 해제)
  // mainWindow.webContents.openDevTools({ mode: 'detach' });
  console.log('[Main] 앱 시작');
}

function createLoginWindow() {
  loginWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    parent: mainWindow,
    modal: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  loginWindow.setMenuBarVisibility(false);
  
  const loginUrl = 'https://seouloutdoorlibrary.kr/user/loginUserForm.do';
  console.log('[Login] 로그인 페이지 로드:', loginUrl);
  loginWindow.loadURL(loginUrl);

  loginWindow.webContents.on('did-finish-load', () => {
    console.log('[Login] 페이지 로드 완료:', loginWindow.webContents.getURL());
  });

  loginWindow.webContents.on('did-navigate', async (event, url) => {
    console.log('[Login] 페이지 이동:', url);
    
    if (url.includes('seouloutdoorlibrary.kr') && !url.includes('loginUserForm') && !url.includes('login')) {
      console.log('[Login] 로그인 성공 감지!');
      
      const cookies = await session.defaultSession.cookies.get({ url: 'https://seouloutdoorlibrary.kr' });
      const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
      console.log('[Login] 쿠키 저장:', cookies.length + '개');
      
      store.set('sessionCookie', cookieString);
      mainWindow.webContents.send('login-success');
      loginWindow.close();
    }
  });

  loginWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('[Login] 페이지 로드 실패:', errorCode, errorDescription);
  });

  loginWindow.on('closed', () => {
    console.log('[Login] 로그인 창 닫힘');
    loginWindow = null;
  });
}

function createBrowseWindow() {
  const browseWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  browseWindow.setMenuBarVisibility(false);
  browseWindow.loadURL('https://seouloutdoorlibrary.kr/user/hipdok/myActStatus.do');
  
  browseWindow.webContents.on('did-navigate', (event, url) => {
    console.log('[Browse] 현재 URL:', url);
  });
}

// ============================================
// IPC Handler Factories
// ============================================

/**
 * Register store getter/setter handlers
 * @param {string} key - Store key
 * @param {string} getChannel - IPC channel for getting value
 * @param {string} setChannel - IPC channel for setting value (optional)
 */
function registerStoreHandlers(key, getChannel, setChannel = null) {
  ipcMain.handle(getChannel, () => store.get(key));
  if (setChannel) {
    ipcMain.handle(setChannel, (event, value) => store.set(key, value));
  }
}

/**
 * Register scraper handler with progress callback
 * @param {string} channel - IPC channel name
 * @param {Function} scraperFn - Scraper function to call
 */
function registerScraperHandler(channel, scraperFn) {
  ipcMain.handle(channel, async () => {
    const cookie = store.get('sessionCookie');
    return scraperFn(cookie, (progress) => {
      mainWindow.webContents.send('progress', progress);
    });
  });
}

/**
 * Send progress to renderer
 * @param {Object} progress - Progress object with message and percent
 */
function sendProgress(progress) {
  console.log('[Export] 진행:', progress.message, progress.percent + '%');
  mainWindow.webContents.send('progress', progress);
}

// ============================================
// IPC Handlers Registration
// ============================================

// Window handlers
ipcMain.handle('open-login', () => createLoginWindow());
ipcMain.handle('open-browse', () => createBrowseWindow());

// Auth handlers
ipcMain.handle('check-login', () => !!store.get('sessionCookie'));
ipcMain.handle('logout', async () => {
  store.delete('sessionCookie');
  await session.defaultSession.clearStorageData({ storages: ['cookies'] });
});

// Store handlers (using factory)
registerStoreHandlers('sessionCookie', 'get-session-cookie');
registerStoreHandlers('notionToken', 'get-notion-token', 'save-notion-token');
registerStoreHandlers('notionPageId', 'get-notion-page', 'save-notion-page');

// Clear all stored data handler
ipcMain.handle('clear-all-data', async () => {
  store.delete('sessionCookie');
  store.delete('notionToken');
  store.delete('notionPageId');
  await session.defaultSession.clearStorageData({ storages: ['cookies'] });
  console.log('[Store] 모든 저장된 정보 삭제 완료');
});

// Scraper handlers (using factory)
registerScraperHandler('scrape-books', scrapeBooks);
registerScraperHandler('scrape-posts', scrapePosts);
registerScraperHandler('scrape-attendance', scrapeAttendance);

// Export handler
ipcMain.handle('export-to-notion', async (event, options) => {
  console.log('[Export] 내보내기 시작:', options);
  
  // ── 1. 인증 정보 확인 ──
  const token = store.get('notionToken');
  const cookie = store.get('sessionCookie');
  
  console.log('[Export] 토큰 존재:', !!token);
  console.log('[Export] 쿠키 존재:', !!cookie);
  
  if (!token) throw new Error('노션 토큰이 설정되지 않았습니다.');
  if (!cookie) throw new Error('로그인이 필요합니다.');
  if (!options.pageId) throw new Error('노션 페이지 ID가 필요합니다.');

  // ── 2. 노션 클라이언트 초기화 ──
  initNotion(token);

  const data = {};

  try {
    // ── 3. 데이터 수집 단계 ──
    
    // 3-1. 나의서재 (도서) 수집
    if (options.books) {
      sendProgress({ message: '나의서재 데이터 수집 중...', percent: 5 });
      data.books = await scrapeBooks(cookie, sendProgress);
      console.log('[Export] 도서 수집 완료:', data.books?.length || 0, '권');
    }

    // 3-2. 게시글 수집 (선택된 타입만)
    const selectedPostTypes = options.posts && Object.entries(options.posts)
      .filter(([, selected]) => selected)
      .map(([type]) => type);
    
    if (selectedPostTypes?.length > 0) {
      sendProgress({ message: '게시글 데이터 수집 중...', percent: 35 });
      const allPosts = await scrapePosts(cookie, sendProgress);
      
      // 선택된 타입만 필터링
      data.posts = {};
      for (const type of selectedPostTypes) {
        if (allPosts[type]) {
          data.posts[type] = allPosts[type];
        }
      }
      console.log('[Export] 게시글 수집 완료:', JSON.stringify(Object.keys(data.posts || {})));
    }

    // 3-3. 출석현황 수집
    if (options.attendance) {
      sendProgress({ message: '출석현황 데이터 수집 중...', percent: 65 });
      data.attendance = await scrapeAttendance(cookie, sendProgress);
      console.log('[Export] 출석 수집 완료:', Object.keys(data.attendance || {}).length, '개월');
    }

    // ── 4. 노션 내보내기 실행 ──
    sendProgress({ message: '노션에 내보내는 중...', percent: 80 });
    const result = await exportToNotion(options.pageId, data, sendProgress);
    console.log('[Export] 노션 내보내기 완료!');
    
    return result;
  } catch (error) {
    console.error('[Export] 오류 발생:', error.message);
    console.error('[Export] 스택:', error.stack);
    throw error;
  }
});

// ============================================
// App Lifecycle
// ============================================

app.whenReady().then(() => {
  store = new Store();
  createMainWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});
