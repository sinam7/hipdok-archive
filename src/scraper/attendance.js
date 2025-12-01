const cheerio = require('cheerio');
const { fetchHtml } = require('./http');
const { SEASON_MONTHS, CURRENT_YEAR } = require('../config/constants');

/**
 * @typedef {Object} AttendanceDay
 * @property {number} day - Day of month
 * @property {string} date - Full date string (YYYY-MM-DD)
 * @property {boolean} visit - Whether visited in person
 * @property {boolean} online - Whether attended online
 */

/**
 * @typedef {Object} MonthAttendance
 * @property {number} month - Month number
 * @property {number} year - Year
 * @property {number} totalVisit - Total visit attendance count
 * @property {number} totalOnline - Total online attendance count
 * @property {number} totalDays - Total days with attendance
 * @property {AttendanceDay[]} days - Daily attendance records
 */

/**
 * Scrape attendance data for the season
 * @param {string} cookie - Session cookie
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object<number, MonthAttendance>>}
 */
async function scrapeAttendance(cookie, onProgress) {
  console.log('[Attendance] 출석현황 스크래핑 시작');
  const attendance = {};

  // ── 시즌 월(4~12월)별로 순회하며 출석 데이터 수집 ──
  for (let i = 0; i < SEASON_MONTHS.length; i++) {
    const month = SEASON_MONTHS[i];
    const yearMonth = `${CURRENT_YEAR}-${String(month).padStart(2, '0')}`;
    
    console.log(`[Attendance] ${month}월 (${yearMonth}) 스크래핑...`);
    onProgress?.({ 
      message: `${month}월 출석 정보를 불러오는 중...`, 
      percent: Math.floor((i / SEASON_MONTHS.length) * 100) 
    });

    try {
      // 월별 출석 정보 수집
      attendance[month] = await scrapeMonthAttendance(yearMonth, cookie);
      const { totalVisit, totalOnline } = attendance[month];
      console.log(`[Attendance] ${month}월: 방문 ${totalVisit}회, 온라인 ${totalOnline}회`);
    } catch (error) {
      // 오류 시 빈 데이터로 대체
      console.error(`[Attendance] ${month}월 오류:`, error.message);
      attendance[month] = { 
        month, 
        year: CURRENT_YEAR, 
        totalVisit: 0, 
        totalOnline: 0, 
        days: [] 
      };
    }
  }

  return attendance;
}

/**
 * Scrape attendance for a specific month
 * @param {string} yearMonth - Year-month string (YYYY-MM)
 * @param {string} cookie - Session cookie
 * @returns {Promise<MonthAttendance>}
 */
async function scrapeMonthAttendance(yearMonth, cookie) {
  const url = `/user/hipdok/mypage/attend/hipdokAttendCaledar.do?searchMonth=${yearMonth}&searchYmd=`;
  console.log(`[Attendance] 요청: ${url}`);
  
  const html = await fetchHtml(url, cookie);
  const $ = cheerio.load(html);
  
  const dayMap = new Map();

  // ══════════════════════════════════════════
  // 1단계: 달력에서 출석일 날짜 추출
  // ══════════════════════════════════════════
  // fnAttendHistoryPop('YYYY-MM-DD') 패턴에서 날짜 추출
  const onclickElements = $('[onclick*="fnAttendHistoryPop"]');
  console.log(`[Attendance] fnAttendHistoryPop 요소 발견: ${onclickElements.length}개`);

  const datesToFetch = new Set();
  
  onclickElements.each((_, el) => {
    const onclick = $(el).attr('onclick') || '';
    const match = onclick.match(/fnAttendHistoryPop\s*\(\s*['"](\d{4}-\d{2}-\d{2})['"]\s*\)/);
    
    if (match) {
      const dateStr = match[1];
      const [year, month] = dateStr.split('-').map(Number);
      
      // 현재 조회 월과 일치하는 날짜만 추가
      if (`${year}-${String(month).padStart(2, '0')}` === yearMonth) {
        datesToFetch.add(dateStr);
      }
    }
  });

  console.log(`[Attendance] 출석일 ${datesToFetch.size}일 발견, 상세 정보 수집 중...`);

  // ══════════════════════════════════════════
  // 2단계: 각 날짜의 상세 정보 (방문/온라인) 수집
  // ══════════════════════════════════════════
  for (const dateStr of datesToFetch) {
    try {
      const status = await scrapeAttendanceDetail(dateStr, cookie);
      dayMap.set(dateStr, status);
    } catch (error) {
      // 실패 시 기본값 (방문으로 가정)
      console.log(`[Attendance] ${dateStr} 상세 정보 실패`);
      dayMap.set(dateStr, { visit: true, online: false });
    }
  }

  // ══════════════════════════════════════════
  // 3단계: 결과 집계 및 반환
  // ══════════════════════════════════════════
  const days = [];
  let totalVisit = 0;
  let totalOnline = 0;

  for (const [dateStr, status] of dayMap) {
    const day = parseInt(dateStr.split('-')[2]);
    
    days.push({
      day,
      date: dateStr,
      visit: status.visit,
      online: status.online
    });
    
    if (status.visit) totalVisit++;
    if (status.online) totalOnline++;
  }

  const [year, month] = yearMonth.split('-').map(Number);
  
  return {
    month,
    year,
    totalVisit,
    totalOnline,
    totalDays: dayMap.size,
    days: days.sort((a, b) => a.day - b.day)
  };
}

/**
 * Scrape attendance detail for a specific date (popup)
 * @param {string} dateStr - Date string (YYYY-MM-DD)
 * @param {string} cookie - Session cookie
 * @returns {Promise<{visit: boolean, online: boolean}>}
 */
async function scrapeAttendanceDetail(dateStr, cookie) {
  const url = `/user/hipdok/attend/hipdokAttendHistoryPop.do?attendYmd=${dateStr}`;
  
  try {
    const html = await fetchHtml(url, cookie);
    const $ = cheerio.load(html);
    
    const result = { visit: false, online: false };
    
    // ── 1차 시도: strong 태그에서 출석 유형 확인 ──
    $('.layer-attendHis strong, .layerInner strong').each((_, el) => {
      const text = $(el).text().trim();
      
      if (text.includes('방문')) {
        result.visit = true;
        console.log(`[Attendance] ${dateStr}: 방문출석 확인`);
      }
      if (text.includes('온라인')) {
        result.online = true;
        console.log(`[Attendance] ${dateStr}: 온라인출석 확인`);
      }
    });

    // ── 2차 시도: 전체 텍스트에서 키워드 검색 (폴백) ──
    if (!result.visit && !result.online) {
      const bodyText = $('body').text();
      
      if (bodyText.includes('방문출석') || bodyText.includes('방문 출석')) {
        result.visit = true;
      }
      if (bodyText.includes('온라인출석') || bodyText.includes('온라인 출석')) {
        result.online = true;
      }
    }
    
    return result;
  } catch (error) {
    // 오류 시 기본값 반환
    console.error(`[Attendance] ${dateStr} 팝업 오류:`, error.message);
    return { visit: true, online: false };
  }
}

module.exports = { scrapeAttendance };
