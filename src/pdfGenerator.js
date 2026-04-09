import puppeteer from 'puppeteer';
import { marked } from 'marked';

export async function generatePdf(markdownContent, url) {
  const html = buildHtml(markdownContent, url);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();

    // JavaScript 비활성화 (마크다운 렌더링에 불필요, 보안 강화)
    await page.setJavaScriptEnabled(false);

    // 외부 네트워크 요청 차단 (SSRF 방지)
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (req.resourceType() === 'document') {
        req.continue();
      } else {
        req.abort();
      }
    });

    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
      printBackground: true,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

function buildHtml(markdownContent, url) {
  const htmlContent = marked.parse(markdownContent);
  const date = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo',
                   'Noto Sans KR', sans-serif;
      font-size: 13px;
      line-height: 1.85;
      color: #1f2937;
    }
    .header {
      margin-bottom: 24px;
      padding-bottom: 14px;
      border-bottom: 2px solid #2563eb;
    }
    .header h1 { font-size: 18px; color: #1e3a5f; margin-bottom: 4px; }
    .header p  { font-size: 11px; color: #6b7280; }

    h3 {
      font-size: 15px; font-weight: 700;
      margin: 22px 0 6px; color: #1e3a5f;
      page-break-after: avoid;
    }
    strong { font-weight: 600; color: #374151; }
    ul { padding-left: 22px; margin: 4px 0; }
    li { margin: 3px 0; page-break-inside: avoid; }
    p  { margin: 5px 0; }
    hr { border: none; border-top: 1px solid #e5e7eb; margin: 16px 0; }

    table { border-collapse: collapse; width: 100%; margin: 8px 0; table-layout: fixed; }
    th, td {
      border: 1px solid #9ca3af;
      padding: 7px 12px;
      vertical-align: top;
      word-break: break-word;
    }
    th { background: #f3f4f6; font-weight: 600; }

    blockquote {
      border: 1px solid #9ca3af;
      border-radius: 4px;
      padding: 10px 14px;
      margin: 8px 0;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>홈페이지 마케팅 분석 보고서</h1>
    <p>${url} &nbsp;·&nbsp; 생성일: ${date}</p>
  </div>
  ${htmlContent}
</body>
</html>`;
}
