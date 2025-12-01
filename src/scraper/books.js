const cheerio = require('cheerio');
const { fetchHtml } = require('./http');
const { BASE_URL, BOOKS_PER_PAGE, MAX_PAGE_LIMIT } = require('../config/constants');

/**
 * @typedef {Object} ReadHistory
 * @property {number} readPages - Pages read
 * @property {number} totalPages - Total pages
 * @property {string} readDate - Date read
 * @property {string} registDate - Registration date
 */

/**
 * @typedef {Object} Book
 * @property {string} bookNo - Book ID
 * @property {string} title - Book title
 * @property {string} author - Author name
 * @property {string} publisher - Publisher name
 * @property {string} pages - Page count
 * @property {string} coverImage - Cover image URL
 * @property {number} progress - Reading progress (0-100)
 * @property {string} status - Reading status
 * @property {number} rating - Star rating (1-5)
 * @property {boolean} hasRecommend - Has recommendation
 * @property {number} copyCount - Copy count
 * @property {string} certification - Certification text
 * @property {string} recommendation - Recommendation text
 * @property {string[]} targetAge - Target age groups
 * @property {ReadHistory[]} readHistory - Reading history
 */

/**
 * Scrape user's book library
 * @param {string} cookie - Session cookie
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Book[]>}
 */
async function scrapeBooks(cookie, onProgress) {
  const books = [];
  let page = 1;
  let hasMore = true;

  console.log('[Books] 나의서재 스크래핑 시작');
  onProgress?.({ message: '나의서재 목록을 불러오는 중...', percent: 0 });

  // ══════════════════════════════════════════
  // 1단계: 목록 페이지에서 도서 ID 수집
  // ══════════════════════════════════════════
  while (hasMore) {
    try {
      const url = `/user/hipdok/book/mypage/hipdokBookList.do?currentPageNo=${page}&searchCondition=title&searchStatusCode=&searchSort=ordDesc&openYn=ALL&bookNo=0`;
      console.log(`[Books] 페이지 ${page} 요청: ${url}`);
      
      const html = await fetchHtml(url, cookie);
      const $ = cheerio.load(html);
      
      // ── 1-1. fnBookDetail('bookNo') 패턴으로 ID 추출 ──
      const bookLinks = [];
      $('[onclick*="fnBookDetail"]').each((_, el) => {
        const onclick = $(el).attr('onclick') || '';
        const match = onclick.match(/fnBookDetail\(['"]?(\d+)['"]?\)/);
        if (match) {
          bookLinks.push(match[1]);
        }
      });

      // ── 1-2. 대체: data-book-no 또는 href에서 추출 ──
      if (bookLinks.length === 0) {
        $('a[href*="bookNo="], [data-book-no]').each((_, el) => {
          const href = $(el).attr('href') || '';
          const dataNo = $(el).attr('data-book-no');
          const match = href.match(/bookNo=(\d+)/) || [null, dataNo];
          if (match && match[1]) {
            bookLinks.push(match[1]);
          }
        });
      }

      // ── 1-3. 대체: 도서 카드 요소에서 추출 ──
      if (bookLinks.length === 0) {
        $('.book-card, .book-item, .mylib-list li').each((_, el) => {
          const $el = $(el);
          const onclick = $el.attr('onclick') || $el.find('[onclick]').first().attr('onclick') || '';
          const match = onclick.match(/['"](\d{4,})['"]/) || onclick.match(/\((\d{4,})\)/);
          if (match) {
            bookLinks.push(match[1]);
          }
        });
      }

      console.log(`[Books] 페이지 ${page}에서 도서 ${bookLinks.length}개 발견`);

      // ── 1-4. 중복 제거 후 목록에 추가 ──
      for (const bookNo of bookLinks) {
        if (!books.find(b => b.bookNo === bookNo)) {
          books.push({ bookNo });
        }
      }

      // ── 1-5. 다음 페이지 존재 여부 확인 ──
      hasMore = bookLinks.length >= BOOKS_PER_PAGE;
      page++;
      
      if (page > MAX_PAGE_LIMIT) break;
      
    } catch (error) {
      console.error(`[Books] 페이지 ${page} 오류:`, error.message);
      hasMore = false;
    }
  }

  console.log(`[Books] 총 ${books.length}권 발견, 상세 정보 수집 시작`);

  // ══════════════════════════════════════════
  // 2단계: 각 도서의 상세 정보 수집
  // ══════════════════════════════════════════
  for (let i = 0; i < books.length; i++) {
    const book = books[i];
    onProgress?.({ 
      message: `도서 정보 수집 중... (${i + 1}/${books.length})`, 
      percent: Math.round((i / books.length) * 80) 
    });

    try {
      // 2-1. 도서 상세 페이지에서 기본 정보 수집
      const detail = await scrapeBookDetail(book.bookNo, cookie);
      Object.assign(book, detail);
      
      // 2-2. 독서기록 팝업에서 기록 수집
      const readHistory = await scrapeReadHistory(book.bookNo, cookie);
      book.readHistory = readHistory;
      
      console.log(`[Books] ${i + 1}/${books.length}: ${book.title?.substring(0, 30) || book.bookNo} (독서기록 ${readHistory.length}개)`);
    } catch (error) {
      console.error(`[Books] 도서 ${book.bookNo} 상세 오류:`, error.message);
    }
  }

  onProgress?.({ message: `${books.length}권의 도서 정보 수집 완료`, percent: 80 });
  return books;
}

/**
 * Scrape book detail page
 * @param {string} bookNo - Book ID
 * @param {string} cookie - Session cookie
 * @returns {Promise<Object>}
 */
async function scrapeBookDetail(bookNo, cookie) {
  const url = `/user/hipdok/book/mypage/hipdokBookDetail.do?bookNo=${bookNo}`;
  
  console.log(`[Books] 상세 요청: ${url}`);
  const html = await fetchHtml(url, cookie);
  const $ = cheerio.load(html);

  // ── 페이지 구조 확인 ──
  const hasDetailView = $('.mylib-view-top').length > 0;
  console.log(`[Books] 상세뷰 존재: ${hasDetailView}`);
  
  if (!hasDetailView) {
    console.log(`[Books] HTML 미리보기: ${html.substring(0, 500)}`);
  }

  // ── 기본 정보 파싱 (.mylib-view-top 영역) ──
  const $viewTop = $('.mylib-view-top');
  const title = $viewTop.find('.info-tit').text().trim() || 
                $('.info-tit').first().text().trim();
  
  const coverImage = $viewTop.find('.top-img img').attr('src') || 
                     $('.top-img img').attr('src') || '';
  
  // 저자, 출판사, 페이지수 (barList 내부)
  const infoPs = $viewTop.find('.info-info.barList div p');
  const author = infoPs.eq(0).text().trim();
  const publisher = infoPs.eq(1).text().trim();
  const pages = infoPs.eq(2).text().trim();

  console.log(`[Books] 파싱: 제목="${title}", 저자="${author}", 출판사="${publisher}"`);

  // ── 상태 플래그 파싱 (.info-state 영역) ──
  const hasComplete = $('.info-state .state.complete').length > 0 ||
                      $('.info-state .complete').length > 0;
  const hasRecommend = $('.info-state .state.recommend').length > 0 ||
                       $('.info-state .recommend').length > 0;
  const copyText = $('.info-state .state.copy, .info-state .copy').text();
  const copyMatch = copyText.match(/필사\((\d+)회\)/);
  const copyCount = copyMatch ? parseInt(copyMatch[1]) : 0;

  // ── 진행률 파싱 ──
  const progressText = $('.info-reading .txt strong, .info-reading strong').first().text();
  const progress = parseInt(progressText) || 0;

  // ── 평점 파싱 (score1 ~ score5 클래스) ──
  const starClass = $('.star-rating').attr('class') || '';
  const scoreMatch = starClass.match(/score(\d)/);
  const rating = scoreMatch ? parseInt(scoreMatch[1]) : 0;

  // ── 완독인증 텍스트 (.complete-box) ──
  const certification = $('.complete-box .txt').text().trim();

  // ── 도서추천 텍스트 (.recommend-box) ──
  let recommendation = '';
  $('.recommend-box').find('.txt').each((i, el) => {
    if (i === 0) {
      recommendation = $(el).text().trim();
    }
  });

  // ── 추천 대상 연령대 파싱 ──
  const targetAge = [];
  const ageText = $('.recommend-box .barList span').text();
  ageText.split(',').forEach(age => {
    const trimmed = age.trim();
    if (trimmed && trimmed.includes('대')) targetAge.push(trimmed);
  });

  // ── 읽기 상태 결정 ──
  let status = '읽는 중';
  if (hasComplete) status = '완독';
  else if (progress === 0) status = '관심';

  return {
    title,
    author,
    publisher,
    pages,
    coverImage: coverImage.startsWith('http') ? coverImage : (coverImage ? `${BASE_URL}${coverImage}` : ''),
    progress,
    status,
    rating,
    hasRecommend,
    copyCount,
    certification,
    recommendation,
    targetAge
  };
}

/**
 * Scrape reading history for a book
 * @param {string} bookNo - Book ID
 * @param {string} cookie - Session cookie
 * @returns {Promise<ReadHistory[]>}
 */
async function scrapeReadHistory(bookNo, cookie) {
  const url = `/user/hipdok/book/mypage/hipdokReadHistoryRegistPop.do?bookNo=${bookNo}`;
  
  try {
    const html = await fetchHtml(url, cookie);
    const $ = cheerio.load(html);
    
    const history = [];
    
    $('.board-table tbody tr').each((_, row) => {
      const $row = $(row);
      const cells = $row.find('td');
      
      if (cells.length >= 3) {
        const pageText = cells.eq(1).text().trim();
        const readDate = cells.eq(2).text().trim();
        const registDate = cells.eq(3).text().trim();
        
        const pageMatch = pageText.match(/(\d+)\/(\d+)p?/);
        const readPages = pageMatch ? parseInt(pageMatch[1]) : 0;
        const totalPages = pageMatch ? parseInt(pageMatch[2]) : 0;
        
        history.push({
          readPages,
          totalPages,
          readDate,
          registDate
        });
      }
    });
    
    console.log(`[Books] 독서기록 ${history.length}개 (bookNo=${bookNo})`);
    return history;
  } catch (error) {
    console.error(`[Books] 독서기록 오류 (bookNo=${bookNo}):`, error.message);
    return [];
  }
}

module.exports = { scrapeBooks };
