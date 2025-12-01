const { notionRequest } = require('../client');
const { createRichText, createParagraphBlocks, createImage, createHeading, createTable } = require('../blocks');
const { BASE_URL } = require('../../config/constants');

/**
 * Map book status to Notion select option
 * @param {string} status 
 * @returns {string}
 */
function mapStatus(status) {
  if (status.includes('완독') || status.includes('완료')) return '완독';
  if (status.includes('읽') || status.includes('진행')) return '읽는 중';
  return '대기';
}

/**
 * Create content blocks for a book page
 * @param {Object} book - Book data
 * @returns {Array}
 */
function createBookContent(book) {
  const blocks = [];
  
  // Cover image
  if (book.coverImage) {
    blocks.push(createImage(book.coverImage));
  }

  // Rating display
  if (book.rating > 0) {
    const stars = '⭐'.repeat(book.rating) + '☆'.repeat(5 - book.rating);
    blocks.push({
      type: 'paragraph',
      paragraph: { rich_text: [{ type: 'text', text: { content: `평점: ${stars} (${book.rating}/5)` } }] }
    });
  }

  // Certification (완독인증 - 나의 느낌)
  if (book.certification) {
    blocks.push(
      createHeading('✅ 완독인증 - 나의 느낌', 2),
      ...createParagraphBlocks(book.certification)
    );
  }

  // Recommendation (도서추천 - 서평)
  if (book.recommendation) {
    blocks.push(
      createHeading('💡 도서추천 - 서평', 2),
      ...createParagraphBlocks(book.recommendation)
    );
    
    // Target age groups
    if (book.targetAge?.length > 0) {
      blocks.push({
        type: 'paragraph',
        paragraph: { 
          rich_text: createRichText(`추천대상: ${book.targetAge.join(', ')}`, { color: 'gray' })
        }
      });
    }
  }

  // Reading history
  if (book.readHistory?.length > 0) {
    blocks.push(createHeading('📖 독서기록', 2));
    
    const tableRows = [
      ['읽은 페이지', '읽은 날짜', '등록일'],
      ...book.readHistory.map(record => [
        `${record.readPages}/${record.totalPages}p`,
        record.readDate || '-',
        record.registDate || '-'
      ])
    ];

    blocks.push(createTable(tableRows, true));
  }

  return blocks;
}

/**
 * Create books database in Notion
 * @param {string} parentId - Parent page ID
 * @param {Array} books - Books data
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>}
 */
async function createBooksDatabase(parentId, books, onProgress) {
  onProgress?.(0, books.length);
  
  const database = await notionRequest('/databases', 'POST', {
    parent: { page_id: parentId },
    title: [{ type: 'text', text: { content: '📖 나의서재' } }],
    properties: {
      '제목': { title: {} },
      '저자': { rich_text: {} },
      '출판사': { rich_text: {} },
      '페이지': { rich_text: {} },
      '상태': { 
        select: { 
          options: [
            { name: '읽는 중', color: 'blue' },
            { name: '완독', color: 'green' },
            { name: '대기', color: 'gray' }
          ]
        }
      },
      '진행률': { number: { format: 'percent' } },
      '평점': { number: {} },
      '추천': { checkbox: {} },
      '필사': { number: {} }
    }
  });

  for (let i = 0; i < books.length; i++) {
    const book = books[i];
    onProgress?.(i + 1, books.length);
    
    // Apply text length limits
    const title = (book.title || '제목 없음').substring(0, 100);
    const author = (book.author || '').substring(0, 200);
    const publisher = (book.publisher || '').substring(0, 200);
    const pages = (book.pages || '').substring(0, 50);
    
    const properties = {
      '제목': { title: [{ text: { content: title } }] },
      '저자': { rich_text: [{ text: { content: author } }] },
      '출판사': { rich_text: [{ text: { content: publisher } }] },
      '페이지': { rich_text: [{ text: { content: pages } }] },
      '진행률': { number: (book.progress || 0) / 100 },
      '평점': { number: book.rating || 0 },
      '추천': { checkbox: book.hasRecommend || false },
      '필사': { number: book.copyCount || 0 }
    };

    if (book.status) {
      properties['상태'] = { select: { name: mapStatus(book.status) } };
    }

    await notionRequest('/pages', 'POST', {
      parent: { database_id: database.id },
      properties,
      children: createBookContent(book)
    });
  }

  return database;
}

module.exports = {
  createBooksDatabase,
  createBookContent,
  mapStatus
};

