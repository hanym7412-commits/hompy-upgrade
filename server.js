import 'dotenv/config';
import express from 'express';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchPageData } from './src/fetcher.js';
import { analyzePageStream } from './src/analyzer.js';
import { generatePdf } from './src/pdfGenerator.js';
import {
  saveAnalysis, listAnalyses, getAnalysis,
  deleteAnalysis, savePdfUrl,
} from './src/storage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Rate Limiting
const analyzeLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 10,                   // 15분에 최대 10회
  message: { error: '요청이 너무 많습니다. 15분 후 다시 시도해주세요.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimit = rateLimit({
  windowMs: 60 * 1000, // 1분
  max: 60,
  message: { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
});

app.use(generalLimit);

// 분석 실행 (SSE 스트리밍)
app.post('/api/analyze', analyzeLimit, async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL을 입력해주세요.' });
  }

  let normalizedUrl = url.trim();
  if (!/^https?:\/\//i.test(normalizedUrl)) {
    normalizedUrl = 'https://' + normalizedUrl;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    send('status', { message: '페이지를 가져오는 중...' });
    const pageData = await fetchPageData(normalizedUrl);

    send('status', { message: 'AI 분석 중... (잠시만 기다려주세요)' });

    let fullResult = '';
    await analyzePageStream(pageData, (chunk) => {
      fullResult += chunk;
      send('chunk', { text: chunk });
    });

    const saved = await saveAnalysis(normalizedUrl, fullResult);
    send('done', { message: '분석 완료', id: saved.id });
  } catch (err) {
    console.error('[오류]', err.message);
    send('error', { message: err.message });
  } finally {
    res.end();
  }
});

// 기록 목록 조회
app.get('/api/history', async (req, res) => {
  try {
    res.json(await listAnalyses());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 특정 분석 상세 조회
app.get('/api/history/:id', async (req, res) => {
  try {
    const entry = await getAnalysis(req.params.id);
    if (!entry) return res.status(404).json({ error: '찾을 수 없습니다.' });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 특정 분석 삭제
app.delete('/api/history/:id', async (req, res) => {
  try {
    const ok = await deleteAnalysis(req.params.id);
    if (!ok) return res.status(404).json({ error: '찾을 수 없습니다.' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PDF 생성 (puppeteer) + Supabase Storage 업로드 + 클라이언트 다운로드
app.get('/api/history/:id/pdf/generate', async (req, res) => {
  try {
    const entry = await getAnalysis(req.params.id);
    if (!entry) return res.status(404).json({ error: '찾을 수 없습니다.' });

    console.log('[PDF] 생성 시작:', entry.url);
    const pdfBuffer = await generatePdf(entry.result, entry.url);
    console.log('[PDF] 생성 완료, 크기:', Math.round(pdfBuffer.length / 1024), 'KB');

    // ASCII 안전 파일명 생성
    const safeFilename = entry.url
      .replace(/^https?:\/\//, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 60) + '.pdf';
    const filePath = `${req.params.id}/${safeFilename}`;

    // Supabase Storage 업로드
    try {
      const { supabase } = await import('./src/supabase.js');
      const { error } = await supabase.storage
        .from('pdfs')
        .upload(filePath, pdfBuffer, { contentType: 'application/pdf', upsert: true });

      if (error) {
        console.warn('[Storage] 업로드 실패:', error.message);
      } else {
        const { data } = supabase.storage.from('pdfs').getPublicUrl(filePath);
        await savePdfUrl(req.params.id, data.publicUrl);
        console.log('[Storage] 업로드 완료:', data.publicUrl);
      }
    } catch (storageErr) {
      console.warn('[Storage] 오류:', storageErr.message);
    }

    // 클라이언트에 PDF 스트림 전송
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('[PDF] 생성 오류:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`서버 시작: http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY)    console.warn('⚠️  ANTHROPIC_API_KEY 미설정');
  if (!process.env.SUPABASE_URL)         console.warn('⚠️  SUPABASE_URL 미설정');
  if (!process.env.SUPABASE_SERVICE_KEY) console.warn('⚠️  SUPABASE_SERVICE_KEY 미설정');
});
