const { NOTION_TEXT_LIMIT } = require('../config/constants');

/**
 * Split long text into chunks respecting Notion's text limit
 * @param {string} text - Text to split
 * @param {number} [maxLength=NOTION_TEXT_LIMIT] - Maximum length per chunk
 * @returns {string[]}
 */
function splitText(text, maxLength = NOTION_TEXT_LIMIT) {
  if (!text || text.length <= maxLength) {
    return [text || ''];
  }
  
  const chunks = [];
  let remaining = text;
  
  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }
    
    // Try to cut at sentence end or space
    let cutPoint = remaining.lastIndexOf('. ', maxLength);
    if (cutPoint === -1 || cutPoint < maxLength / 2) {
      cutPoint = remaining.lastIndexOf(' ', maxLength);
    }
    if (cutPoint === -1 || cutPoint < maxLength / 2) {
      cutPoint = maxLength;
    }
    
    chunks.push(remaining.substring(0, cutPoint));
    remaining = remaining.substring(cutPoint).trim();
  }
  
  return chunks;
}

/**
 * Convert text to rich_text array (respecting 2000 char limit)
 * @param {string} text - Text content
 * @param {Object} [annotations={}] - Text annotations (bold, italic, color, etc.)
 * @returns {Array}
 */
function createRichText(text, annotations = {}) {
  const chunks = splitText(text);
  return chunks.map(chunk => ({
    type: 'text',
    text: { content: chunk },
    ...(Object.keys(annotations).length > 0 ? { annotations } : {})
  }));
}

/**
 * Convert text to paragraph blocks
 * @param {string} text - Text content
 * @param {Object} [annotations={}] - Text annotations
 * @returns {Array}
 */
function createParagraphBlocks(text, annotations = {}) {
  const chunks = splitText(text);
  return chunks.map(chunk => ({
    type: 'paragraph',
    paragraph: {
      rich_text: [{
        type: 'text',
        text: { content: chunk },
        ...(Object.keys(annotations).length > 0 ? { annotations } : {})
      }]
    }
  }));
}

/**
 * Create a heading block
 * @param {string} text - Heading text
 * @param {number} [level=2] - Heading level (1, 2, or 3)
 * @returns {Object}
 */
function createHeading(text, level = 2) {
  const type = `heading_${level}`;
  return {
    type,
    [type]: {
      rich_text: [{ text: { content: text } }]
    }
  };
}

/**
 * Create a divider block
 * @returns {Object}
 */
function createDivider() {
  return { type: 'divider', divider: {} };
}

/**
 * Create an image block
 * @param {string} url - Image URL
 * @returns {Object}
 */
function createImage(url) {
  return {
    type: 'image',
    image: { type: 'external', external: { url } }
  };
}

/**
 * Create a callout block
 * @param {string} text - Callout text
 * @param {string} [emoji='📌'] - Emoji icon
 * @returns {Object}
 */
function createCallout(text, emoji = '📌') {
  return {
    type: 'callout',
    callout: {
      rich_text: [{ type: 'text', text: { content: text } }],
      icon: { emoji }
    }
  };
}

/**
 * Create a table block with rows
 * @param {Array<Array<string>>} rows - Table data (first row is header if hasHeader=true)
 * @param {boolean} [hasHeader=true] - Whether first row is header
 * @returns {Object}
 */
function createTable(rows, hasHeader = true) {
  const tableRows = rows.map(cells => ({
    type: 'table_row',
    table_row: {
      cells: cells.map(cell => [{ type: 'text', text: { content: cell } }])
    }
  }));

  return {
    type: 'table',
    table: {
      table_width: rows[0]?.length || 1,
      has_column_header: hasHeader,
      has_row_header: false,
      children: tableRows
    }
  };
}

/**
 * Create a quote block
 * @param {string} text - Quote text
 * @param {Object} [annotations={}] - Text annotations
 * @returns {Object}
 */
function createQuote(text, annotations = {}) {
  return {
    type: 'quote',
    quote: {
      rich_text: [{
        type: 'text',
        text: { content: text },
        ...(Object.keys(annotations).length > 0 ? { annotations } : {})
      }]
    }
  };
}

module.exports = {
  splitText,
  createRichText,
  createParagraphBlocks,
  createHeading,
  createDivider,
  createImage,
  createCallout,
  createTable,
  createQuote
};

