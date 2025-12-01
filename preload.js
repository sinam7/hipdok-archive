const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // 로그인
  openLogin: () => ipcRenderer.invoke('open-login'),
  openBrowse: () => ipcRenderer.invoke('open-browse'),
  checkLogin: () => ipcRenderer.invoke('check-login'),
  getSessionCookie: () => ipcRenderer.invoke('get-session-cookie'),
  logout: () => ipcRenderer.invoke('logout'),
  onLoginSuccess: (callback) => ipcRenderer.on('login-success', callback),

  // 노션 설정
  saveNotionToken: (token) => ipcRenderer.invoke('save-notion-token', token),
  getNotionToken: () => ipcRenderer.invoke('get-notion-token'),
  saveNotionPage: (pageId) => ipcRenderer.invoke('save-notion-page', pageId),
  getNotionPage: () => ipcRenderer.invoke('get-notion-page'),

  // 스크래핑
  scrapeBooks: () => ipcRenderer.invoke('scrape-books'),
  scrapePosts: (type) => ipcRenderer.invoke('scrape-posts', type),
  scrapeAttendance: () => ipcRenderer.invoke('scrape-attendance'),

  // 내보내기
  exportToNotion: (data) => ipcRenderer.invoke('export-to-notion', data),

  // 진행 상태
  onProgress: (callback) => ipcRenderer.on('progress', (event, data) => callback(data)),

  // 저장된 정보 삭제
  clearAllData: () => ipcRenderer.invoke('clear-all-data')
});

