import { supabase } from './supabase.js';

export async function saveAnalysis(url, result) {
  const { data, error } = await supabase
    .from('analyses')
    .insert({ url, result })
    .select('id, url, saved_at, result')
    .single();

  if (error) throw new Error(`저장 실패: ${error.message}`);

  return {
    id: data.id,
    url: data.url,
    savedAt: data.saved_at,
    result: data.result,
  };
}

export async function listAnalyses() {
  const { data, error } = await supabase
    .from('analyses')
    .select('id, url, saved_at')
    .order('saved_at', { ascending: false });

  if (error) throw new Error(`목록 조회 실패: ${error.message}`);

  return data.map((row) => ({
    id: row.id,
    url: row.url,
    savedAt: row.saved_at,
  }));
}

export async function getAnalysis(id) {
  const { data, error } = await supabase
    .from('analyses')
    .select('id, url, saved_at, result, pdf_url')
    .eq('id', id)
    .single();

  if (error) return null;

  return {
    id: data.id,
    url: data.url,
    savedAt: data.saved_at,
    result: data.result,
    pdfUrl: data.pdf_url || null,
  };
}

export async function deleteAnalysis(id) {
  const { error, count } = await supabase
    .from('analyses')
    .delete({ count: 'exact' })
    .eq('id', id);

  if (error) throw new Error(`삭제 실패: ${error.message}`);
  return (count ?? 1) > 0;
}

export async function savePdfUrl(id, pdfUrl) {
  const { error } = await supabase
    .from('analyses')
    .update({ pdf_url: pdfUrl })
    .eq('id', id);

  if (error) throw new Error(`PDF URL 저장 실패: ${error.message}`);
}
