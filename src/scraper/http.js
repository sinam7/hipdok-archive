const { createScraperClient } = require('../lib/httpClient');
const { BASE_URL } = require('../config/constants');

// Cache for client instances per cookie
const clientCache = new Map();

/**
 * Get or create a scraper client for the given cookie
 * @param {string} cookie - Session cookie
 * @returns {Object} HTTP client
 */
function getClient(cookie) {
  if (!clientCache.has(cookie)) {
    clientCache.set(cookie, createScraperClient(cookie));
  }
  return clientCache.get(cookie);
}

/**
 * Fetch HTML from the library website
 * @param {string} path - URL path
 * @param {string} cookie - Session cookie
 * @returns {Promise<string>}
 */
async function fetchHtml(path, cookie) {
  const client = getClient(cookie);
  return client.fetchHtml(path);
}

/**
 * Fetch JSON from the library website
 * @param {string} path - URL path
 * @param {string} cookie - Session cookie
 * @returns {Promise<Object>}
 */
async function fetchJson(path, cookie) {
  const client = getClient(cookie);
  return client.fetchJson(path);
}

/**
 * Make a raw request to the library website
 * @param {string} path - URL path
 * @param {string} cookie - Session cookie
 * @param {Object} [options] - Request options
 * @returns {Promise<Object>}
 */
async function request(path, cookie, options = {}) {
  const client = getClient(cookie);
  return client.request(path, options);
}

module.exports = { request, fetchHtml, fetchJson, BASE_URL };
