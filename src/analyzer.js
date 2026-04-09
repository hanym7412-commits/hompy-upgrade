import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function analyzePageStream(pageData, onChunk) {
  const prompt = buildPrompt(pageData);

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
    messages: [{ role: 'user', content: prompt }],
    system: `당신은 10년 경력의 디지털 마케팅 전문가입니다. 홈페이지의 HTML 구조와 콘텐츠를 분석하여 마케팅 관점에서 구체적이고 실행 가능한 개선 방향을 제시합니다. 항상 한국어로 답변하며, 각 항목마다 현재 상태를 먼저 평가한 뒤 구체적인 개선 방법을 제시합니다.`,
  });

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      onChunk(event.delta.text);
    }
  }
}

function buildPrompt(data) {
  return `다음은 "${data.url}" 홈페이지에서 추출한 정보입니다. 마케팅 전문가 관점에서 10가지 항목을 분석하고 개선 방향을 제시해주세요.

---
## 추출된 페이지 정보

**페이지 제목(title):** ${data.title || '없음'}
**메타 설명(meta description):** ${data.metaDescription || '없음'}
**메타 키워드:** ${data.metaKeywords || '없음'}
**OG 제목:** ${data.ogTitle || '없음'}
**OG 사이트명:** ${data.ogSiteName || '없음'}

**H1 헤딩:** ${data.headings.h1.length > 0 ? data.headings.h1.join(' / ') : '없음'}
**H2 헤딩:** ${data.headings.h2.length > 0 ? data.headings.h2.join(' / ') : '없음'}
**H3 헤딩:** ${data.headings.h3.length > 0 ? data.headings.h3.join(' / ') : '없음'}

**CTA 버튼/링크 텍스트:** ${data.ctaTexts.length > 0 ? data.ctaTexts.join(', ') : '없음'}
**네비게이션 메뉴:** ${data.navItems.length > 0 ? data.navItems.join(', ') : '없음'}
**이미지 alt 텍스트:** ${data.imgAlts.length > 0 ? data.imgAlts.join(', ') : '없음'}
**폼(Form) 존재:** ${data.hasForms ? `있음 (입력 타입: ${data.formInputTypes.join(', ')})` : '없음'}
**소셜 프루프 관련 키워드 발견:** ${data.socialProofKeywords.length > 0 ? data.socialProofKeywords.join(', ') : '발견되지 않음'}

**주요 본문 텍스트 (일부):**
${data.mainText}

---

위 정보를 바탕으로 아래 10개 항목을 각각 분석해주세요. 각 항목은 다음 형식으로 작성하세요:

### [번호]. [항목명]
**현재 상태:** (발견한 내용을 구체적으로 서술)
**개선 방향:** (실행 가능한 구체적 방법 2~3가지를 bullet point로)

---

분석할 10개 항목:
1. **메인 메시지 명확성** - 헤드라인과 가치 제안(Value Proposition)이 명확하게 전달되는가
2. **CTA(Call-to-Action) 효과성** - 방문자를 행동으로 이끄는 버튼/링크가 효과적인가
3. **SEO 기본 요소** - title, meta description, 헤딩 구조가 검색엔진 최적화에 적합한가
4. **신뢰 요소(Trust Factor)** - 고객 후기, 인증, 파트너사, 수상 이력 등이 잘 활용되는가
5. **타겟 고객 명확성** - 누구를 위한 서비스/제품인지 즉시 파악할 수 있는가
6. **콘텐츠 품질** - 읽기 쉽고 혜택 중심(benefit-oriented)의 문구가 사용되는가
7. **시각적 구조 & 이미지 활용** - 이미지와 시각 요소가 마케팅 메시지를 강화하는가
8. **전환율 최적화(CRO)** - 구매/문의/가입으로 이어지는 흐름이 최적화되어 있는가
9. **소셜 프루프 & 커뮤니티** - 사회적 증거와 커뮤니티 요소가 잘 활용되는가
10. **경쟁 차별화 포인트** - 경쟁사 대비 독자적인 강점이 명확하게 드러나는가

마지막에는 **우선순위 TOP 3 개선 과제**를 간략하게 정리해주세요.`;
}
