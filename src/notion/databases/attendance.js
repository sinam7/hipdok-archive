const { notionRequest, createPage } = require('../client');
const { createHeading, createDivider, createCallout, createTable } = require('../blocks');

/**
 * Create attendance page with monthly breakdown
 * @param {string} parentId - Parent page ID
 * @param {Object} attendance - Attendance data by month
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>}
 */
async function createAttendancePage(parentId, attendance, onProgress) {
  const months = Object.keys(attendance);
  onProgress?.(0, months.length);
  
  const page = await createPage(parentId, '📅 출석현황');

  // Calculate totals
  let totalVisit = 0;
  let totalOnline = 0;
  let totalDays = 0;

  for (const data of Object.values(attendance)) {
    totalVisit += data.totalVisit || 0;
    totalOnline += data.totalOnline || 0;
    totalDays += data.totalDays || 0;
  }

  // Summary blocks
  const summaryBlocks = [
    createCallout(`📊 총 ${totalDays}일 출석 | 방문 ${totalVisit}회 | 온라인 ${totalOnline}회`, '📅'),
    createDivider()
  ];

  await notionRequest(`/blocks/${page.id}/children`, 'PATCH', {
    children: summaryBlocks
  });

  // Monthly detail pages
  let monthIdx = 0;
  for (const [month, data] of Object.entries(attendance)) {
    if (!data.days || data.days.length === 0) continue;
    
    onProgress?.(monthIdx + 1, months.length);

    const monthBlocks = [];
    
    // Month header
    monthBlocks.push(createHeading(
      `${month}월 (${data.totalDays || 0}일 / 방문 ${data.totalVisit || 0}회, 온라인 ${data.totalOnline || 0}회)`,
      3
    ));

    // Sort days and create table
    const sortedDays = [...data.days].sort((a, b) => a.day - b.day);
    
    const tableRows = [
      ['날짜', '💻 온라인', '🏃 방문'],
      ...sortedDays.map(record => [
        `${record.day}일`,
        record.online ? '✅' : '-',
        record.visit ? '✅' : '-'
      ])
    ];

    monthBlocks.push(createTable(tableRows, true));

    await notionRequest(`/blocks/${page.id}/children`, 'PATCH', {
      children: monthBlocks
    });
    
    monthIdx++;
  }

  return page;
}

module.exports = {
  createAttendancePage
};

