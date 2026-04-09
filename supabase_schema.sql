-- ============================================================
-- Supabase 설정 SQL
-- Supabase 대시보드 > SQL Editor에서 실행하세요
-- ============================================================

-- 1. analyses 테이블 생성
CREATE TABLE IF NOT EXISTS analyses (
  id         TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  url        TEXT        NOT NULL,
  saved_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  result     TEXT        NOT NULL,
  pdf_url    TEXT                         -- Storage에 저장된 PDF 링크
);

-- 2. RLS(Row Level Security) 활성화 후 전체 허용 정책 설정
--    (로그인 없이 누구나 사용 가능하도록 설정)
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON analyses
  FOR ALL USING (true) WITH CHECK (true);

-- 3. 최신순 조회를 위한 인덱스
CREATE INDEX IF NOT EXISTS analyses_saved_at_idx ON analyses (saved_at DESC);

-- ============================================================
-- Storage 버킷 설정
-- Supabase 대시보드 > Storage에서 아래를 직접 수행하세요:
--   1. "New bucket" 클릭
--   2. Bucket name: pdfs
--   3. Public bucket: ON (체크)
--   4. 저장
-- ============================================================
