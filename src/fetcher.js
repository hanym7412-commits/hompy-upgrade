import axios from 'axios';
import * as cheerio from 'cheerio';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// 내부 IP/루프백 패턴 (SSRF 방지)
const BLOCKED_HOSTNAMES = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,  // AWS metadata
  /^::1$/,
  /^fe80:/i,
];

function validateUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('유효한 URL 형식이 아닙니다.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('HTTP/HTTPS URL만 지원합니다.');
  }
  const hostname = parsed.hostname;
  if (BLOCKED_HOSTNAMES.some(p => p.test(hostname))) {
    throw new Error('접근할 수 없는 주소입니다.');
  }
  return parsed.toString();
}

export async function fetchPageData(url) {
  const safeUrl = validateUrl(url);
  let html;
  try {
    const response = await axios.get(safeUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
      },
      timeout: 15000,
      maxRedirects: 5,
    });
    html = response.data;
  } catch (err) {
    throw new Error(`페이지를 가져올 수 없습니다: ${err.message}`);
  }

  const $ = cheerio.load(html);

  // 불필요한 태그 제거
  $('script, style, noscript, iframe, svg').remove();

  // 메타 정보
  const title = $('title').text().trim();
  const metaDescription =
    $('meta[name="description"]').attr('content') ||
    $('meta[property="og:description"]').attr('content') ||
    '';
  const metaKeywords = $('meta[name="keywords"]').attr('content') || '';
  const ogTitle = $('meta[property="og:title"]').attr('content') || '';
  const ogSiteName = $('meta[property="og:site_name"]').attr('content') || '';

  // 헤딩
  const h1s = $('h1').map((_, el) => $(el).text().trim()).get().filter(Boolean).slice(0, 5);
  const h2s = $('h2').map((_, el) => $(el).text().trim()).get().filter(Boolean).slice(0, 10);
  const h3s = $('h3').map((_, el) => $(el).text().trim()).get().filter(Boolean).slice(0, 10);

  // CTA 버튼 텍스트
  const ctaTexts = [];
  $('a, button').each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length > 1 && text.length < 60) {
      ctaTexts.push(text);
    }
  });
  const uniqueCtas = [...new Set(ctaTexts)].slice(0, 30);

  // 이미지 alt 텍스트
  const imgAlts = $('img')
    .map((_, el) => $(el).attr('alt') || '')
    .get()
    .filter((alt) => alt.trim().length > 0)
    .slice(0, 20);

  // 네비게이션 메뉴
  const navItems = [];
  $('nav a, header a').each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length < 40) navItems.push(text);
  });
  const uniqueNavItems = [...new Set(navItems)].slice(0, 20);

  // 소셜 프루프 관련 키워드 탐지
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const socialProofKeywords = [
    '리뷰', '후기', '평점', '별점', '만족', '추천', '고객', '사례', '성공',
    'review', 'testimonial', 'rating', 'customer', 'trust', 'award', '수상',
    '인증', '파트너', 'partner', '언론', '매체',
  ].filter((kw) => bodyText.toLowerCase().includes(kw.toLowerCase()));

  // 폼 존재 여부
  const hasForms = $('form').length > 0;
  const formInputTypes = $('form input')
    .map((_, el) => $(el).attr('type') || 'text')
    .get();

  // 주요 본문 텍스트 (처음 3000자)
  const mainText = bodyText.slice(0, 3000);

  return {
    url,
    title,
    metaDescription,
    metaKeywords,
    ogTitle,
    ogSiteName,
    headings: { h1: h1s, h2: h2s, h3: h3s },
    ctaTexts: uniqueCtas,
    imgAlts,
    navItems: uniqueNavItems,
    socialProofKeywords,
    hasForms,
    formInputTypes,
    mainText,
  };
}
