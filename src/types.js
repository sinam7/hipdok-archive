/**
 * @file Type definitions for the Hipdok Archive application
 * This file contains JSDoc type definitions used throughout the application.
 */

// ============================================
// Book Types
// ============================================

/**
 * @typedef {Object} ReadHistory
 * @property {number} readPages - Pages read
 * @property {number} totalPages - Total pages in book
 * @property {string} readDate - Date when pages were read
 * @property {string} registDate - Date when record was registered
 */

/**
 * @typedef {Object} Book
 * @property {string} bookNo - Unique book identifier
 * @property {string} title - Book title
 * @property {string} author - Author name
 * @property {string} publisher - Publisher name
 * @property {string} pages - Page count as string
 * @property {string} coverImage - URL to cover image
 * @property {number} progress - Reading progress percentage (0-100)
 * @property {string} status - Reading status ('읽는 중', '완독', '관심')
 * @property {number} rating - Star rating (1-5)
 * @property {boolean} hasRecommend - Whether book has recommendation
 * @property {number} copyCount - Number of copy/transcription sessions
 * @property {string} certification - Certification completion text
 * @property {string} recommendation - Recommendation/review text
 * @property {string[]} targetAge - Target age groups for recommendation
 * @property {ReadHistory[]} readHistory - Reading history records
 */

// ============================================
// Post Types
// ============================================

/**
 * @typedef {Object} Comment
 * @property {string} nickName - Commenter's nickname
 * @property {string} generation - Generation/batch info
 * @property {string} grade - Grade/level info
 * @property {string} text - Comment content
 * @property {string} date - Comment date
 * @property {boolean} isReply - Whether this is a reply to another comment
 * @property {string} replyTo - Username being replied to (if isReply)
 */

/**
 * @typedef {Object} Post
 * @property {string} id - Unique post identifier
 * @property {string} type - Post type key (readCertify, review, bookCopy, freeBoard)
 * @property {string} date - Post creation date
 * @property {string} title - Post title
 * @property {string} content - Post content/body text
 * @property {string[]} images - Array of image URLs
 * @property {string[]} tags - Array of tags/hashtags
 * @property {string} bookTitle - Related book title (for 필사인증)
 * @property {string} bookAuthor - Related book author
 * @property {string} bookPublisher - Related book publisher
 * @property {number} likes - Number of likes/reactions
 * @property {Comment[]} comments - Array of comments
 */

/**
 * @typedef {Object} PostTypeInfo
 * @property {string} key - Type key identifier
 * @property {string} name - Display name in Korean
 * @property {string} emoji - Emoji icon
 * @property {string} detailUrl - URL path for detail page
 * @property {string} paramName - Query parameter name for ID
 * @property {string} tableNm - Database table name for comments API
 */

// ============================================
// Attendance Types
// ============================================

/**
 * @typedef {Object} AttendanceDay
 * @property {number} day - Day of month (1-31)
 * @property {string} date - Full date string (YYYY-MM-DD)
 * @property {boolean} visit - Whether attended in person
 * @property {boolean} online - Whether attended online
 */

/**
 * @typedef {Object} MonthAttendance
 * @property {number} month - Month number (1-12)
 * @property {number} year - Year (e.g., 2025)
 * @property {number} totalVisit - Total in-person attendance count
 * @property {number} totalOnline - Total online attendance count
 * @property {number} totalDays - Total unique days with attendance
 * @property {AttendanceDay[]} days - Daily attendance records
 */

/**
 * @typedef {Object<number, MonthAttendance>} AttendanceData
 * Attendance data keyed by month number
 */

// ============================================
// Export Data Types
// ============================================

/**
 * @typedef {Object} ExportData
 * @property {Book[]} [books] - Books to export
 * @property {Object<string, Post[]>} [posts] - Posts by type to export
 * @property {AttendanceData} [attendance] - Attendance data to export
 */

/**
 * @typedef {Object} ExportOptions
 * @property {boolean} books - Whether to export books
 * @property {Object<string, boolean>} posts - Post types to export (keyed by type)
 * @property {boolean} attendance - Whether to export attendance
 * @property {string} pageId - Target Notion page ID
 */

/**
 * @typedef {Object} ProgressInfo
 * @property {string} message - Progress message
 * @property {number} percent - Progress percentage (0-100)
 */

/**
 * @callback ProgressCallback
 * @param {ProgressInfo} progress - Progress information
 */

// ============================================
// HTTP Types
// ============================================

/**
 * @typedef {Object} HttpClientConfig
 * @property {string} baseUrl - Base URL for requests
 * @property {Object<string, string>} [defaultHeaders] - Default headers
 */

/**
 * @typedef {Object} RequestOptions
 * @property {string} [method] - HTTP method (GET, POST, etc.)
 * @property {Object<string, string>} [headers] - Request headers
 * @property {string|Object} [body] - Request body
 */

/**
 * @typedef {Object} HttpResponse
 * @property {boolean} ok - Whether request was successful (2xx)
 * @property {number} status - HTTP status code
 * @property {function(): Promise<string>} text - Get response as text
 * @property {function(): Promise<Object>} json - Get response as JSON
 */

module.exports = {};

