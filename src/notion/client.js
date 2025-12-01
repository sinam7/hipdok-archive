const { net } = require('electron');

const NOTION_API = 'https://api.notion.com/v1';
let authToken = null;

/**
 * Initialize Notion client with API token
 * @param {string} token - Notion API token
 */
function initNotion(token) {
  authToken = token;
}

/**
 * Get current auth token
 * @returns {string|null}
 */
function getAuthToken() {
  return authToken;
}

/**
 * Make a Notion API request
 * @param {string} endpoint - API endpoint
 * @param {string} [method='GET'] - HTTP method
 * @param {Object} [body=null] - Request body
 * @returns {Promise<Object>}
 */
function notionRequest(endpoint, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = `${NOTION_API}${endpoint}`;
    console.log(`[Notion] ${method} ${endpoint}`);
    
    const request = net.request({ method, url });

    request.setHeader('Authorization', `Bearer ${authToken}`);
    request.setHeader('Notion-Version', '2022-06-28');
    request.setHeader('Content-Type', 'application/json');

    let responseData = '';

    request.on('response', (response) => {
      console.log(`[Notion] 응답: ${response.statusCode}`);
      
      response.on('data', (chunk) => {
        responseData += chunk.toString();
      });

      response.on('end', () => {
        try {
          const data = JSON.parse(responseData);
          if (response.statusCode >= 200 && response.statusCode < 300) {
            console.log(`[Notion] 성공: ${endpoint}`);
            resolve(data);
          } else {
            console.error(`[Notion] 오류: ${response.statusCode}`, data.message || responseData.substring(0, 200));
            reject(new Error(data.message || `Notion API Error: ${response.statusCode}`));
          }
        } catch (e) {
          console.error(`[Notion] JSON 파싱 실패:`, responseData.substring(0, 200));
          reject(new Error(`Parse error: ${responseData.substring(0, 200)}`));
        }
      });
    });

    request.on('error', (error) => {
      console.error(`[Notion] 네트워크 오류:`, error.message);
      reject(error);
    });

    if (body) {
      const bodyStr = JSON.stringify(body);
      console.log(`[Notion] Body 길이: ${bodyStr.length}`);
      request.write(bodyStr);
    }

    request.end();
  });
}

/**
 * Create a new Notion page
 * @param {string} parentId - Parent page ID
 * @param {string} title - Page title
 * @param {Array} [children=[]] - Page content blocks
 * @returns {Promise<Object>}
 */
async function createPage(parentId, title, children = []) {
  return notionRequest('/pages', 'POST', {
    parent: { page_id: parentId },
    properties: {
      title: { title: [{ text: { content: title } }] }
    },
    children
  });
}

module.exports = {
  initNotion,
  getAuthToken,
  notionRequest,
  createPage
};

