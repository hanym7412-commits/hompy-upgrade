import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // 서버 전용 (service role key)

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL 또는 SUPABASE_SERVICE_KEY가 .env에 설정되지 않았습니다.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
