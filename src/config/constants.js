/**
 * Application-wide constants and configuration
 */

// URLs
const BASE_URL = 'https://seouloutdoorlibrary.kr';
const NOTION_API_URL = 'https://api.notion.com/v1';

// Scraping limits
const MAX_PAGE_LIMIT = 50;
const BOOKS_PER_PAGE = 10;

// Notion API limits
const NOTION_TEXT_LIMIT = 2000;

// Season configuration (힙독클럽: 4월~12월)
const CURRENT_YEAR = new Date().getFullYear();
const SEASON_MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12];

// Post types configuration
const POST_TYPES = {
  readCertify: { 
    key: 'readCertify', 
    name: '독서인증샷',
    emoji: '📸',
    detailUrl: '/user/hipdok/mypage/hipdokReadCertifyDetail.do',
    paramName: 'readCertifyNo',
    tableNm: 'HD_READ_CERTIFY'
  },
  review: { 
    key: 'review', 
    name: '활동후기',
    emoji: '📋',
    detailUrl: '/user/hipdok/mypage/hipdokReviewDetail.do',
    paramName: 'reviewNo',
    tableNm: 'HD_REVIEW'
  },
  bookCopy: { 
    key: 'bookCopy', 
    name: '필사인증',
    emoji: '✍️',
    detailUrl: '/user/hipdok/mypage/hipdokBookCopyDetail.do',
    paramName: 'bookCopyNo',
    tableNm: 'HD_BOOK_COPY'
  },
  freeBoard: { 
    key: 'freeBoard', 
    name: '자유게시판',
    emoji: '💬',
    detailUrl: '/user/hipdok/mypage/hipdokFreeBoardDetail.do',
    paramName: 'freeBoardNo',
    tableNm: 'HD_FREE_BOARD'
  }
};

// Post type order for iteration
const POST_TYPE_ORDER = ['readCertify', 'review', 'bookCopy', 'freeBoard'];

module.exports = {
  BASE_URL,
  NOTION_API_URL,
  MAX_PAGE_LIMIT,
  BOOKS_PER_PAGE,
  NOTION_TEXT_LIMIT,
  CURRENT_YEAR,
  SEASON_MONTHS,
  POST_TYPES,
  POST_TYPE_ORDER
};

