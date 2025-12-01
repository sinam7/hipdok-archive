const { notionRequest } = require('../client');
const { createRichText, createParagraphBlocks, createImage, createHeading, createDivider } = require('../blocks');
const { POST_TYPES, BASE_URL } = require('../../config/constants');

/**
 * Create content blocks for a post page
 * @param {Object} post - Post data
 * @returns {Array}
 */
function createPostContent(post) {
  const children = [];

  // Main content
  if (post.content) {
    children.push(...createParagraphBlocks(post.content));
  }

  // Images
  for (const imageUrl of (post.images || [])) {
    children.push(createImage(imageUrl));
  }

  // Tags
  if (post.tags?.length) {
    const tagsText = post.tags.map(t => `#${t}`).join(' ');
    children.push({
      type: 'paragraph',
      paragraph: { 
        rich_text: createRichText(tagsText, { color: 'gray' })
      }
    });
  }

  // Book info (for 필사인증 etc.)
  if (post.bookTitle) {
    children.push({
      type: 'callout',
      callout: {
        icon: { emoji: '📚' },
        rich_text: [{ 
          type: 'text', 
          text: { content: `${post.bookTitle}${post.bookAuthor ? ' - ' + post.bookAuthor : ''}${post.bookPublisher ? ' (' + post.bookPublisher + ')' : ''}` }
        }]
      }
    });
  }

  // Comments section
  if (post.comments?.length) {
    children.push(createDivider());
    children.push(createHeading(`💬 댓글 (${post.comments.length})`, 3));

    for (const comment of post.comments) {
      const prefix = comment.isReply ? '↳ ' : '';
      const replyMention = comment.replyTo ? `@${comment.replyTo} ` : '';
      const header = `${prefix}${comment.nickName}${comment.grade ? ' (' + comment.grade + ')' : ''} · ${comment.date}`;
      const body = `${replyMention}${comment.text}`;
      
      children.push({
        type: 'quote',
        quote: {
          rich_text: [
            { type: 'text', text: { content: header.substring(0, 200) }, annotations: { bold: true, color: 'gray' } },
            { type: 'text', text: { content: '\n' + body.substring(0, 1800) } }
          ]
        }
      });
    }
  }

  return children;
}

/**
 * Create a single post entry in database
 * @param {string} databaseId - Database ID
 * @param {Object} post - Post data
 * @returns {Promise<void>}
 */
async function createPostEntry(databaseId, post) {
  const children = createPostContent(post);
  
  // Parse date (2025. 11. 29 or 2025.11.29 format)
  let dateValue = null;
  if (post.date) {
    const dateMatch = post.date.match(/(\d{4})[.\s-]+(\d{1,2})[.\s-]+(\d{1,2})/);
    if (dateMatch) {
      const [, year, month, day] = dateMatch;
      dateValue = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }

  const title = (post.title || '제목 없음').substring(0, 100);
  
  const properties = {
    '제목': { title: [{ text: { content: title } }] },
    '공감': { number: post.likes || 0 },
    '댓글수': { number: post.comments?.length || 0 }
  };
  
  if (dateValue) {
    properties['날짜'] = { date: { start: dateValue } };
  }

  await notionRequest('/pages', 'POST', {
    parent: { database_id: databaseId },
    properties,
    children
  });
}

/**
 * Create posts database for a specific type
 * @param {string} parentId - Parent page ID
 * @param {string} type - Post type key
 * @param {Array} items - Posts data
 * @param {string} emoji - Emoji for database title
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>}
 */
async function createPostDatabase(parentId, type, items, emoji, onProgress) {
  const typeInfo = POST_TYPES[type];
  onProgress?.(0, items.length);
  
  const database = await notionRequest('/databases', 'POST', {
    parent: { page_id: parentId },
    title: [{ type: 'text', text: { content: `${emoji || '📄'} ${typeInfo.name}` } }],
    properties: {
      '제목': { title: {} },
      '날짜': { date: {} },
      '공감': { number: {} },
      '댓글수': { number: {} }
    }
  });

  for (let i = 0; i < items.length; i++) {
    onProgress?.(i + 1, items.length);
    await createPostEntry(database.id, items[i]);
  }

  return database;
}

module.exports = {
  createPostDatabase,
  createPostEntry,
  createPostContent
};

