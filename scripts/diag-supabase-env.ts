/**
 * Diagnostic : vérifie que les clés Supabase de .env.local pointent bien vers
 * jazzy-apps (vpmmobouujkknustjlho) et que le fetch subscribers de
 * send-newsletter.ts fonctionne. AUCUN envoi d'email.
 *
 * Usage : set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/diag-supabase-env.ts
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

if (!url || !serviceKey) {
  console.error('❌ SUPABASE_URL ou SUPABASE_SERVICE_KEY non définie');
  process.exit(1);
}

const EXPECTED_REF = 'vpmmobouujkknustjlho';

if (!url.includes(EXPECTED_REF)) {
  console.error(`❌ SUPABASE_URL ne pointe pas vers jazzy-apps (${EXPECTED_REF}) : ${url}`);
  process.exit(1);
}

const keyRef = JSON.parse(Buffer.from(serviceKey.split('.')[1], 'base64url').toString()).ref;
if (keyRef !== EXPECTED_REF) {
  console.error(`❌ SUPABASE_SERVICE_KEY émise pour "${keyRef}", attendu "${EXPECTED_REF}"`);
  process.exit(1);
}
console.log(`✓ URL et service key pointent vers ${EXPECTED_REF}`);

const supabase = createClient(url, serviceKey);

// Même requête que send-newsletter.ts:354 (toutes fréquences pour le diag)
const { data, error } = await supabase
  .from('subscribers')
  .select('id, email, confirmed, frequency')
  .eq('confirmed', true);

if (error) {
  console.error('❌ Erreur fetch subscribers:', error.message);
  process.exit(1);
}

const byFreq: Record<string, number> = {};
for (const s of data ?? []) {
  const f = (s as { frequency: string }).frequency;
  byFreq[f] = (byFreq[f] ?? 0) + 1;
}
console.log(`✓ Fetch subscribers OK : ${data?.length ?? 0} confirmés`, byFreq);
console.log('✅ Diagnostic OK : send-newsletter peut fetch les subscribers avec ce .env.local');
