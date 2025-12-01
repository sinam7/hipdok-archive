const { initNotion, notionRequest, createPage } = require('./client');
const { createBooksDatabase } = require('./databases/books');
const { createPostDatabase } = require('./databases/posts');
const { createAttendancePage } = require('./databases/attendance');
const { POST_TYPES, POST_TYPE_ORDER } = require('../config/constants');

/**
 * Export all data to Notion
 * @param {string} parentPageId - Target Notion page ID
 * @param {Object} data - Data to export (books, posts, attendance)
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>}
 */
async function exportToNotion(parentPageId, data, onProgress) {
  // ── 1. 섹션 목록 구성 ──
  // 내보낼 데이터 종류에 따라 섹션 정보 생성
  const sections = [];
  
  if (data.books?.length > 0) {
    sections.push({ type: 'books', name: '📖 나의서재', count: data.books.length, unit: '권' });
  }
  
  if (data.posts) {
    for (const type of POST_TYPE_ORDER) {
      const items = data.posts[type];
      if (items?.length > 0) {
        const typeInfo = POST_TYPES[type];
        sections.push({ 
          type, 
          name: `${typeInfo.emoji} ${typeInfo.name}`, 
          count: items.length, 
          unit: '개' 
        });
      }
    }
  }
  
  if (data.attendance) {
    const monthCount = Object.keys(data.attendance).length;
    sections.push({ type: 'attendance', name: '📅 출석현황', count: monthCount, unit: '개월' });
  }
  
  const totalSections = sections.length;

  // ── 2. 루트 아카이브 페이지 생성 ──
  onProgress?.({ message: '아카이브 페이지 생성 중...', percent: 5 });
  
  const archivePage = await createPage(parentPageId, '📚 힙독클럽 1기 아카이브 (2025)', [
    { type: 'paragraph', paragraph: { rich_text: [{ text: { content: '서울야외도서관 힙독클럽 1기 활동기록 아카이브' } }] } },
    { type: 'divider', divider: {} }
  ]);

  let sectionIdx = 0;
  
  // 진행률 계산 헬퍼 (섹션별 10~90% 구간 분배)
  const getProgressPercent = (sectionIndex, itemIndex, itemTotal) => {
    const sectionStart = 10 + (80 * sectionIndex / totalSections);
    const sectionEnd = 10 + (80 * (sectionIndex + 1) / totalSections);
    const sectionProgress = itemTotal > 0 ? (itemIndex / itemTotal) : 1;
    return Math.floor(sectionStart + (sectionEnd - sectionStart) * sectionProgress);
  };

  // ── 3. 섹션별 데이터베이스/페이지 생성 ──

  // 3-1. 나의서재 데이터베이스
  if (data.books?.length > 0) {
    const section = sections[sectionIdx];
    const progressCallback = (current, total) => {
      onProgress?.({ 
        message: `${section.name} (${sectionIdx + 1}/${totalSections}) - ${current}/${total}${section.unit}`, 
        percent: getProgressPercent(sectionIdx, current, total) 
      });
    };
    await createBooksDatabase(archivePage.id, data.books, progressCallback);
    sectionIdx++;
  }

  // 3-2. 게시글 타입별 데이터베이스
  if (data.posts) {
    for (const type of POST_TYPE_ORDER) {
      const items = data.posts[type];
      if (!items?.length) continue;
      
      const section = sections[sectionIdx];
      const typeInfo = POST_TYPES[type];
      const progressCallback = (current, total) => {
        onProgress?.({ 
          message: `${section.name} (${sectionIdx + 1}/${totalSections}) - ${current}/${total}${section.unit}`, 
          percent: getProgressPercent(sectionIdx, current, total) 
        });
      };
      
      await createPostDatabase(archivePage.id, type, items, typeInfo.emoji, progressCallback);
      sectionIdx++;
    }
  }

  // 3-3. 출석현황 페이지
  if (data.attendance) {
    const section = sections[sectionIdx];
    const progressCallback = (current, total) => {
      onProgress?.({ 
        message: `${section.name} (${sectionIdx + 1}/${totalSections}) - ${current}/${total}${section.unit}`, 
        percent: getProgressPercent(sectionIdx, current, total) 
      });
    };
    await createAttendancePage(archivePage.id, data.attendance, progressCallback);
  }

  // ── 4. 하단 크레딧 추가 ──
  onProgress?.({ message: '마무리 중...', percent: 95 });
  await notionRequest(`/blocks/${archivePage.id}/children`, 'PATCH', {
    children: [
      { type: 'divider', divider: {} },
      {
        type: 'paragraph',
        paragraph: {
          rich_text: [
            { type: 'text', text: { content: '이 아카이브는 ' }, annotations: { color: 'gray' } },
            { type: 'text', text: { content: 'sinam7', link: { url: 'https://github.com/sinam7' } }, annotations: { color: 'gray' } },
            { type: 'text', text: { content: '이 제작한 힙독클럽 아카이브 도구로 생성되었습니다.' }, annotations: { color: 'gray' } }
          ]
        }
      },
      {
        type: 'paragraph',
        paragraph: {
          rich_text: [
            { type: 'text', text: { content: '문의: ' }, annotations: { color: 'gray' } },
            { type: 'text', text: { content: 'mail@sinam7.com', link: { url: 'mailto:mail@sinam7.com' } }, annotations: { color: 'gray' } },
            { type: 'text', text: { content: ' | MIT License' }, annotations: { color: 'gray' } }
          ]
        }
      }
    ]
  });

  onProgress?.({ message: '완료!', percent: 100 });
  return archivePage;
}

module.exports = { 
  initNotion, 
  exportToNotion 
};
