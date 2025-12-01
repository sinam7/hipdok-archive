const cheerio = require('cheerio');
const { fetchHtml, request } = require('./http');
const { POST_TYPES, BASE_URL, MAX_PAGE_LIMIT } = require('../config/constants');

/**
 * @typedef {Object} Comment
 * @property {string} nickName - Commenter nickname
 * @property {string} generation - Generation info
 * @property {string} grade - Grade info
 * @property {string} text - Comment text
 * @property {string} date - Comment date
 * @property {boolean} isReply - Whether this is a reply
 * @property {string} replyTo - Who this replies to
 */

/**
 * @typedef {Object} Post
 * @property {string} id - Post ID
 * @property {string} type - Post type
 * @property {string} date - Post date
 * @property {string} title - Post title
 * @property {string} content - Post content
 * @property {string[]} images - Image URLs
 * @property {string[]} tags - Tags
 * @property {string} bookTitle - Related book title
 * @property {string} bookAuthor - Related book author
 * @property {string} bookPublisher - Related book publisher
 * @property {number} likes - Like count
 * @property {Comment[]} comments - Comments
 */

/**
 * Fetch comments via AJAX API
 * @param {string} postId - Post ID
 * @param {string} type - Post type
 * @param {string} cookie - Session cookie
 * @returns {Promise<Comment[]>}
 */
async function fetchComments(postId, type, cookie) {
  const typeInfo = POST_TYPES[type];
  const url = '/user/hipdok/comment/hipdokComment.do';
  
  const body = `tableNm=${typeInfo.tableNm}&tableKey=${postId}`;
  
  console.log(`[Posts] 댓글 API 호출: ${url} (tableNm=${typeInfo.tableNm}, tableKey=${postId})`);
  
  try {
    // ── 1. AJAX API 호출 (POST 요청) ──
    const response = await request(url, cookie, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    });
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const comments = [];
    
    // ── 2. 댓글 아이템 순회 및 파싱 ──
    $('.comment-item').each((idx, item) => {
      const $item = $(item);
      
      // 유효한 댓글인지 확인 (.comment-left 존재 여부)
      if (!$item.find('.comment-left').length) return;
      
      const $right = $item.find('.comment-right').first();
      if (!$right.length) return;
      
      // 2-1. 대댓글 여부 확인
      const isReply = $item.hasClass('sub');
      
      // 2-2. 작성자 정보 파싱
      const $info = $right.find('.comment-info').first();
      const nickName = $info.find('p.nickName').text().trim();
      const generation = $info.find('p').eq(1).text().trim();
      const grade = $info.find('p').eq(2).text().trim();
      
      // 2-3. 댓글 내용 파싱 (멘션 span 제거)
      const $txt = $right.find('.comment-txt').first();
      const $txtClone = $txt.clone();
      $txtClone.find('span').remove();
      const commentText = $txtClone.text().trim();
      
      // 2-4. 답글 대상 파싱
      const replyTo = $txt.find('span').first().text().trim();
      
      // 2-5. 날짜 파싱 (버튼 링크 제거)
      const $date = $right.find('.comment-date').first();
      const $dateClone = $date.clone();
      $dateClone.find('a').remove();
      const commentDate = $dateClone.text().trim();
      
      // 2-6. 유효한 댓글만 추가
      if (nickName && commentText) {
        comments.push({
          nickName,
          generation,
          grade,
          text: commentText,
          date: commentDate,
          isReply,
          replyTo: isReply ? replyTo : ''
        });
      }
    });
    
    console.log(`[Posts] 댓글 API 응답: ${comments.length}개 파싱됨`);
    return comments;
    
  } catch (error) {
    console.error(`[Posts] 댓글 API 오류:`, error.message);
    return [];
  }
}

/**
 * Scrape all post types
 * @param {string} cookie - Session cookie
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object<string, Post[]>>}
 */
async function scrapePosts(cookie, onProgress) {
  console.log('[Posts] 나의게시글 스크래핑 시작');
  const result = {};
  const types = Object.keys(POST_TYPES);

  for (let i = 0; i < types.length; i++) {
    const type = types[i];
    const typeInfo = POST_TYPES[type];
    
    console.log(`[Posts] ${typeInfo.name} (${type}) 스크래핑 중...`);
    onProgress?.({ 
      message: `${typeInfo.name} 게시글을 불러오는 중...`, 
      percent: Math.floor((i / types.length) * 100) 
    });

    try {
      result[type] = await scrapePostsByType(type, cookie);
      console.log(`[Posts] ${typeInfo.name}: ${result[type].length}개 발견`);
    } catch (error) {
      console.error(`[Posts] ${typeInfo.name} 오류:`, error.message);
      result[type] = [];
    }
  }

  return result;
}

/**
 * Scrape posts of a specific type
 * @param {string} type - Post type
 * @param {string} cookie - Session cookie
 * @returns {Promise<Post[]>}
 */
async function scrapePostsByType(type, cookie) {
  const typeInfo = POST_TYPES[type];
  const posts = [];
  let page = 1;
  let hasMore = true;

  // ══════════════════════════════════════════
  // 1단계: 목록 페이지에서 게시글 ID 수집
  // ══════════════════════════════════════════
  while (hasMore) {
    try {
      const url = `/user/hipdok/mypage/hipdokReviewReadCertifyAllList.do?searchKey=${type}&currentPageNo=${page}`;
      console.log(`[Posts] 목록 요청: ${url}`);
      
      const html = await fetchHtml(url, cookie);
      const $ = cheerio.load(html);
      
      // ── 1-1. fnDetail() onclick 요소 찾기 ──
      const onclickElements = $('[onclick*="fnDetail"]');
      console.log(`[Posts] onclick 요소 발견: ${onclickElements.length}개`);

      let foundInPage = 0;
      const validPostTypes = Object.keys(POST_TYPES);
      
      // ── 1-2. 각 요소에서 게시글 ID 추출 ──
      onclickElements.each((_, el) => {
        const onclick = $(el).attr('onclick') || '';
        
        // fnDetail('ID', 'type') 또는 fnDetail('ID') 패턴 매칭
        const matchTwo = onclick.match(/fnDetail\s*\(\s*['"](\d+)['"]\s*,\s*['"](\w+)['"]\s*\)/);
        const matchOne = onclick.match(/fnDetail\s*\(\s*['"](\d+)['"]\s*\)/);
        
        let postId = null;
        let detectedType = null;
        
        if (matchTwo) {
          postId = matchTwo[1];
          const secondParam = matchTwo[2];
          // 두 번째 파라미터가 유효한 타입이면 사용, 아니면 현재 타입
          detectedType = validPostTypes.includes(secondParam) ? secondParam : type;
        } else if (matchOne) {
          postId = matchOne[1];
          detectedType = type;
        }
        
        // ── 1-3. 현재 타입과 일치하면 목록에 추가 (중복 제외) ──
        if (postId && detectedType === type && !posts.find(p => p.id === postId)) {
          posts.push({ id: postId, type });
          foundInPage++;
          console.log(`[Posts] ID 발견: ${postId} (${type})`);
        }
      });

      // ── 1-4. 다음 페이지 존재 여부 확인 ──
      const nextPageExists = $(`a[onclick*="fnList(${page + 1})"]`).length > 0 
        || $(`a[onclick*="goPage(${page + 1})"]`).length > 0;
      
      hasMore = foundInPage > 0;
      if (!nextPageExists) hasMore = false;
      
      page++;
      if (page > MAX_PAGE_LIMIT) break;
      
    } catch (error) {
      console.error(`[Posts] 목록 페이지 ${page} 오류:`, error.message);
      hasMore = false;
    }
  }

  console.log(`[Posts] ${typeInfo.name} 총 ${posts.length}개 ID 수집, 상세 정보 가져오는 중...`);

  // ══════════════════════════════════════════
  // 2단계: 각 게시글의 상세 정보 수집
  // ══════════════════════════════════════════
  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    try {
      const detail = await scrapePostDetail(post.id, type, cookie);
      Object.assign(post, detail);
      console.log(`[Posts] 상세 완료 (${i + 1}/${posts.length}): ${post.title?.substring(0, 20) || post.id}`);
    } catch (error) {
      console.error(`[Posts] 상세 ${post.id} 오류:`, error.message);
    }
  }

  return posts;
}

/**
 * Scrape post detail page
 * @param {string} postId - Post ID
 * @param {string} type - Post type
 * @param {string} cookie - Session cookie
 * @returns {Promise<Object>}
 */
async function scrapePostDetail(postId, type, cookie) {
  const typeInfo = POST_TYPES[type];
  const url = `${typeInfo.detailUrl}?${typeInfo.paramName}=${postId}`;
  
  console.log(`[Posts] 상세 요청: ${url}`);
  const html = await fetchHtml(url, cookie);
  const $ = cheerio.load(html);

  // ── 1. 공통 정보 파싱 (날짜, 제목, 공감수) ──
  const date = $('.top-date').first().text().trim();
  const title = $('.top-tit').first().text().trim();
  
  const likesText = $('.view-like .like span').first().text().trim();
  const likes = parseInt(likesText) || 0;
  console.log(`[Posts] 공감수: ${likes}`);
  
  // ── 2. 본문 내용 파싱 (타입별 셀렉터) ──
  let content = '';
  
  if (type === 'readCertify') {
    content = $('.txextArea, .textArea, .view-con .txt').first().text().trim();
  } else if (type === 'bookCopy') {
    content = $('.book-target .txt, .book-text .txt').first().text().trim();
  } else if (type === 'review') {
    content = $('.view-con .txt, .review-content, .txextArea').first().text().trim();
  } else if (type === 'freeBoard') {
    content = $('.view-con .txt, .board-content, .txextArea').first().text().trim();
  }
  
  // ── 3. 이미지 URL 수집 (아이콘/버튼 제외) ──
  const images = [];
  $('.slideImg img, .book-text img, .view-con img').each((_, img) => {
    let src = $(img).attr('src');
    if (src && !src.includes('icon') && !src.includes('btn') && !src.includes('grade')) {
      if (!src.startsWith('http')) {
        src = `${BASE_URL}${src}`;
      }
      images.push(src);
    }
  });

  // ── 4. 관련 도서 정보 파싱 (필사인증 등) ──
  const $bookInfo = $('.book-info');
  const bookTitle = $bookInfo.find('.bookName, .book-name').text().trim();
  const bookAuthor = $bookInfo.find('.barList p').eq(0).text().trim();
  const bookPublisher = $bookInfo.find('.barList p').eq(1).text().trim();
  
  // ── 5. 태그/해시태그 수집 ──
  const tags = [];
  $('.tag:not(.book-info .tag), .hashtag').each((_, tag) => {
    const text = $(tag).text().trim().replace('#', '');
    if (text) tags.push(text);
  });

  // ── 6. 댓글 수집 (별도 API 호출) ──
  const comments = await fetchComments(postId, type, cookie);

  console.log(`[Posts] 파싱 완료: ${title || postId} / 내용 ${content.length}자 / 이미지 ${images.length}개 / 댓글 ${comments.length}개`);

  return {
    date,
    title: title || `${typeInfo.name} ${postId}`,
    content,
    images,
    tags,
    bookTitle,
    bookAuthor,
    bookPublisher,
    likes,
    comments
  };
}

module.exports = { scrapePosts, POST_TYPES };
