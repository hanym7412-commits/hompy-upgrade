import 'dotenv/config';
import express from 'express';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchPageData } from './src/fetcher.js';
import { analyzePageStream } from './src/analyzer.js';
import {
  saveAnalysis, listAnalyses, getAnalysis, deleteAnalysis,
} from './src/storage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Rate Limiting
const analyzeLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: '요청이 너무 많습니다. 15분 후 다시 시도해주세요.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimit = rateLimit({
  windowMs: 60 * 1000,
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

app.listen(PORT, () => {
  console.log(`서버 시작: http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY)    console.warn('⚠️  ANTHROPIC_API_KEY 미설정');
  if (!process.env.SUPABASE_URL)         console.warn('⚠️  SUPABASE_URL 미설정');
  if (!process.env.SUPABASE_SERVICE_KEY) console.warn('⚠️  SUPABASE_SERVICE_KEY 미설정');
});

export default app;
