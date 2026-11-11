/**
 * Mail ponctuel aux abonnés confirmés : « Si tu aimes Avactu recommande-le à tes proches »
 * (décision Julien 2026-11-11, chantier acquisition n°3).
 *
 * Par défaut : essai à blanc, rien n'est envoyé. Envoi réel uniquement avec --send.
 * Usage (en CI, workflow send-referral-mail.yml) :
 *   tsx scripts/send-referral-mail.ts          # liste les destinataires, affiche le mail
 *   tsx scripts/send-referral-mail.ts --send   # envoie
 */
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const APP_URL = (process.env.APP_URL || 'https://avactu.com').replace(/\/$/, '');
const SIGNUP_URL = `${APP_URL}/?src=ami`;
const SUBJECT = 'Avactu';

const TEXT = `Hello,

Si tu aimes Avactu recommande-le à tes proches !
L'inscription est gratuite et se fait ici : ${SIGNUP_URL}

Merci,
Avactu

Se désabonner : ${APP_URL}/unsubscribe
`;

const HTML = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="color-scheme" content="dark"><title>Avactu</title></head>
<body style="margin: 0; padding: 0; background-color: #05070A; font-family: Georgia, 'Times New Roman', serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #05070A;">
    <tr><td align="center" style="padding: 40px 20px;">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width: 560px; width: 100%;">
        <tr><td align="center" style="padding-bottom: 28px;">
          <img src="${APP_URL}/icon-email.png" alt="Avactu" width="48" height="48" style="display: block; border: 0;" />
        </td></tr>
        <tr><td style="font-family: Georgia, serif; font-size: 17px; line-height: 1.7; color: #f8fafc;">
          <p style="margin: 0 0 18px 0;">Hello,</p>
          <p style="margin: 0 0 18px 0;">Si tu aimes Avactu recommande-le à tes proches !<br />
          L'inscription est gratuite et se fait ici : <a href="${SIGNUP_URL}" style="color: #22d3ee; text-decoration: underline;">avactu.com</a></p>
          <p style="margin: 0;">Merci,<br />Avactu</p>
        </td></tr>
        <tr><td align="center" style="padding-top: 36px;">
          <a href="${APP_URL}/unsubscribe" style="font-family: 'SF Mono', SFMono-Regular, Consolas, monospace; font-size: 10px; color: #64748b; text-decoration: underline;">Se désabonner</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

async function main(): Promise<void> {
  const send = process.argv.includes('--send');
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!supabaseUrl || !supabaseKey || !resendKey) {
    console.error('❌ SUPABASE_URL, SUPABASE_SERVICE_KEY ou RESEND_API_KEY manquante');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase
    .from('subscribers')
    .select('email, frequency')
    .eq('confirmed', true)
    .order('email');
  if (error) {
    console.error('❌ Lecture des abonnés:', error.message);
    process.exit(1);
  }

  // Même filtre que send-newsletter.ts : une adresse invalide fait rejeter tout le lot
  const EMAIL_FORMAT = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  const TEST_DOMAINS = /@(example\.(com|org|net)|test\.[a-z]+|localhost)$/i;
  const recipients = [...new Set((data || []).map((s) => s.email as string))].filter(
    (e) => EMAIL_FORMAT.test(e) && !TEST_DOMAINS.test(e)
  );

  console.log(`👥 ${recipients.length} abonnés confirmés`);
  const byFrequency: Record<string, number> = {};
  for (const s of data || []) byFrequency[s.frequency as string] = (byFrequency[s.frequency as string] || 0) + 1;
  console.log('   par fréquence:', JSON.stringify(byFrequency));
  console.log(`\nObjet : ${SUBJECT}\n${'─'.repeat(40)}\n${TEXT}${'─'.repeat(40)}`);

  if (!send) {
    console.log('\n🔸 Essai à blanc : rien n\'est envoyé. Relancer avec --send pour envoyer.');
    return;
  }

  const resend = new Resend(resendKey);
  const { data: result, error: sendError } = await resend.batch.send(
    recipients.map((to) => ({ from: 'Avactu <briefing@avactu.com>', to, subject: SUBJECT, html: HTML, text: TEXT }))
  );
  if (sendError) {
    console.error('❌ Envoi refusé par Resend:', sendError.message);
    process.exit(1);
  }
  console.log(`\n✅ ${result?.data?.length ?? recipients.length} emails acceptés par Resend`);
}

main().catch((err) => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});
