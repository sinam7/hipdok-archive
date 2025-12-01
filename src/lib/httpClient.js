const { net } = require('electron');

/**
 * @typedef {Object} HttpClientConfig
 * @property {string} baseUrl - Base URL for requests
 * @property {Object<string, string>} [defaultHeaders] - Default headers for all requests
 */

/**
 * @typedef {Object} RequestOptions
 * @property {string} [method] - HTTP method (GET, POST, etc.)
 * @property {Object<string, string>} [headers] - Request headers
 * @property {string|Object} [body] - Request body
 * @property {boolean} [json] - If true, parse response as JSON
 */

/**
 * @typedef {Object} HttpResponse
 * @property {boolean} ok - Whether the request was successful
 * @property {number} status - HTTP status code
 * @property {function(): Promise<string>} text - Get response as text
 * @property {function(): Promise<Object>} json - Get response as JSON
 */

/**
 * Creates an HTTP client with configurable base URL and default headers
 * @param {HttpClientConfig} config 
 * @returns {Object} HTTP client instance
 */
function createHttpClient(config) {
  const { baseUrl, defaultHeaders = {} } = config;

  /**
   * Make an HTTP request
   * @param {string} path - URL path (can be full URL or relative path)
   * @param {RequestOptions} [options] - Request options
   * @returns {Promise<HttpResponse>}
   */
  function request(path, options = {}) {
    return new Promise((resolve, reject) => {
      const url = path.startsWith('http') ? path : `${baseUrl}${path}`;
      const method = options.method || 'GET';
      
      console.log(`[HTTP] ${method} ${url}`);
      
      const req = net.request({ method, url });

      // Set default headers
      for (const [key, value] of Object.entries(defaultHeaders)) {
        req.setHeader(key, value);
      }

      // Set request-specific headers
      if (options.headers) {
        for (const [key, value] of Object.entries(options.headers)) {
          req.setHeader(key, value);
        }
      }

      let responseData = '';

      req.on('response', (response) => {
        console.log(`[HTTP] Response: ${response.statusCode} (${url})`);
        
        response.on('data', (chunk) => {
          responseData += chunk.toString();
        });

        response.on('end', () => {
          const ok = response.statusCode >= 200 && response.statusCode < 300;
          
          if (ok) {
            console.log(`[HTTP] Success: ${url} (${responseData.length} bytes)`);
          } else {
            console.error(`[HTTP] Failed: ${response.statusCode} ${url}`);
            console.error(`[HTTP] Response:`, responseData.substring(0, 500));
          }

          resolve({
            ok,
            status: response.statusCode,
            text: () => Promise.resolve(responseData),
            json: () => {
              try {
                return Promise.resolve(JSON.parse(responseData));
              } catch (e) {
                console.error(`[HTTP] JSON parse failed:`, responseData.substring(0, 200));
                return Promise.reject(e);
              }
            }
          });
        });
      });

      req.on('error', (error) => {
        console.error(`[HTTP] Network error: ${url}`, error.message);
        reject(error);
      });

      if (options.body) {
        const bodyStr = typeof options.body === 'string' 
          ? options.body 
          : JSON.stringify(options.body);
        req.write(bodyStr);
      }

      req.end();
    });
  }

  /**
   * Fetch and return HTML as string
   * @param {string} path 
   * @returns {Promise<string>}
   */
  async function fetchHtml(path) {
    const response = await request(path);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${path}`);
    }
    return response.text();
  }

  /**
   * Fetch and return JSON
   * @param {string} path 
   * @param {RequestOptions} [options]
   * @returns {Promise<Object>}
   */
  async function fetchJson(path, options = {}) {
    const response = await request(path, options);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || `HTTP ${response.status}: ${path}`);
    }
    return response.json();
  }

  return {
    request,
    fetchHtml,
    fetchJson
  };
}

/**
 * Create a scraper HTTP client with cookie authentication
 * @param {string} cookie - Session cookie string
 * @returns {Object} HTTP client for scraping
 */
function createScraperClient(cookie) {
  return createHttpClient({
    baseUrl: 'https://seouloutdoorlibrary.kr',
    defaultHeaders: {
      'Cookie': cookie,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
}

/**
 * Create a Notion API client with Bearer token authentication
 * @param {string} token - Notion API token
 * @returns {Object} HTTP client for Notion API
 */
function createNotionClient(token) {
  const client = createHttpClient({
    baseUrl: 'https://api.notion.com/v1',
    defaultHeaders: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    }
  });

  return {
    ...client,
    /**
     * Make a Notion API request with better error handling
     * @param {string} endpoint 
     * @param {string} [method] 
     * @param {Object} [body] 
     * @returns {Promise<Object>}
     */
    async notionRequest(endpoint, method = 'GET', body = null) {
      console.log(`[Notion] ${method} ${endpoint}`);
      
      const response = await client.request(endpoint, {
        method,
        body: body ? JSON.stringify(body) : undefined
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error(`[Notion] Error: ${response.status}`, data.message || '');
        throw new Error(data.message || `Notion API Error: ${response.status}`);
      }
      
      console.log(`[Notion] Success: ${endpoint}`);
      return data;
    }
  };
}

module.exports = {
  createHttpClient,
  createScraperClient,
  createNotionClient
};

