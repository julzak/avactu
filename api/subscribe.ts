import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { randomUUID } from 'crypto';

// Types
type Frequency = 'daily' | 'biweekly' | 'weekly';

interface SubscribeRequest {
  email: string;
  frequency: Frequency;
}

// Constants
const APP_URL = process.env.APP_URL || 'https://avactu.com';
const TOKEN_VALIDITY_HOURS = 24;

const FREQUENCY_LABELS: Record<Frequency, string> = {
  daily: 'tous les jours',
  biweekly: 'tous les 2 jours',
  weekly: 'chaque samedi',
};

// Email template
function generateConfirmationEmail(frequency: Frequency, confirmUrl: string, isNewSubscriber: boolean): string {
  const action = isNewSubscriber ? 'ton inscription' : 'ton changement de fréquence';
  const frequencyLabel = FREQUENCY_LABELS[frequency];

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <title>Confirme ${action} - Avactu</title>
</head>
<body style="margin: 0; padding: 0; background-color: #05070A; font-family: Georgia, 'Times New Roman', serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #05070A;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width: 560px; width: 100%;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <img src="${APP_URL}/icon-email.png" alt="Avactu" width="48" height="48" style="display: block; border: 0;" />
            </td>
          </tr>

          <!-- Title -->
          <tr>
            <td style="padding-bottom: 24px;">
              <h1 style="margin: 0; font-family: Georgia, serif; font-size: 24px; font-weight: 600; color: #f8fafc; text-align: center;">
                Confirme ${action}
              </h1>
            </td>
          </tr>

          <!-- Message -->
          <tr>
            <td style="padding-bottom: 32px;">
              <p style="margin: 0; font-family: Georgia, serif; font-size: 16px; line-height: 1.6; color: #94a3b8; text-align: center;">
                Tu as demandé à recevoir Avactu <strong style="color: #f8fafc;">${frequencyLabel}</strong>.
                <br><br>
                Clique sur le bouton ci-dessous pour confirmer.
              </p>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <a href="${confirmUrl}" style="display: inline-block; padding: 16px 32px; font-family: 'SF Mono', SFMono-Regular, Consolas, monospace; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #05070A; text-decoration: none; background-color: #22d3ee; border-radius: 8px; font-weight: 600;">
                Confirmer
              </a>
            </td>
          </tr>

          <!-- Expiration notice -->
          <tr>
            <td style="padding-bottom: 32px;">
              <p style="margin: 0; font-family: 'SF Mono', SFMono-Regular, Consolas, monospace; font-size: 12px; color: #64748b; text-align: center;">
                Ce lien expire dans ${TOKEN_VALIDITY_HOURS} heures.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top: 24px; border-top: 1px solid rgba(148, 163, 184, 0.2);">
              <p style="margin: 0; font-family: 'SF Mono', SFMono-Regular, Consolas, monospace; font-size: 11px; color: #64748b; text-align: center;">
                Si tu n'as pas fait cette demande, ignore cet email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

function generateTextEmail(frequency: Frequency, confirmUrl: string, isNewSubscriber: boolean): string {
  const action = isNewSubscriber ? 'ton inscription' : 'ton changement de fréquence';
  const frequencyLabel = FREQUENCY_LABELS[frequency];

  return `AVACTU - Confirme ${action}

Tu as demandé à recevoir Avactu ${frequencyLabel}.

Clique sur ce lien pour confirmer :
${confirmUrl}

Ce lien expire dans ${TOKEN_VALIDITY_HOURS} heures.

Si tu n'as pas fait cette demande, ignore cet email.
`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!supabaseUrl || !supabaseServiceKey || !resendApiKey) {
    console.error('Missing environment variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Parse request body
  const { email, frequency } = req.body as SubscribeRequest;

  if (!email || !frequency) {
    return res.status(400).json({ error: 'Email and frequency are required' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Validate frequency
  if (!['daily', 'biweekly', 'weekly'].includes(frequency)) {
    return res.status(400).json({ error: 'Invalid frequency' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    // Initialize clients
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    // Generate confirmation token
    const confirmationToken = randomUUID();
    const tokenExpiresAt = new Date(Date.now() + TOKEN_VALIDITY_HOURS * 60 * 60 * 1000).toISOString();

    // Check if subscriber exists
    const { data: existingSubscriber } = await supabase
      .from('subscribers')
      .select('id, frequency, confirmed')
      .eq('email', normalizedEmail)
      .single();

    let isNewSubscriber = false;

    if (existingSubscriber) {
      // Existing subscriber - update with pending frequency
      const { error: updateError } = await supabase
        .from('subscribers')
        .update({
          pending_frequency: frequency,
          confirmation_token: confirmationToken,
          token_expires_at: tokenExpiresAt,
        })
        .eq('email', normalizedEmail);

      if (updateError) {
        console.error('Update error:', updateError);
        return res.status(500).json({ error: 'Failed to update subscriber' });
      }
    } else {
      // New subscriber - create with pending frequency
      isNewSubscriber = true;
      const { error: insertError } = await supabase
        .from('subscribers')
        .insert({
          email: normalizedEmail,
          confirmed: false,
          frequency: 'biweekly', // Default, will be updated on confirmation
          pending_frequency: frequency,
          confirmation_token: confirmationToken,
          token_expires_at: tokenExpiresAt,
        });

      if (insertError) {
        console.error('Insert error:', insertError);
        return res.status(500).json({ error: 'Failed to create subscriber' });
      }
    }

    // Send confirmation email
    const confirmUrl = `${APP_URL}/confirm?token=${confirmationToken}`;
    const htmlContent = generateConfirmationEmail(frequency, confirmUrl, isNewSubscriber);
    const textContent = generateTextEmail(frequency, confirmUrl, isNewSubscriber);

    const { error: emailError } = await resend.emails.send({
      from: 'Avactu <briefing@avactu.com>',
      to: normalizedEmail,
      subject: isNewSubscriber ? 'Confirme ton inscription à Avactu' : 'Confirme ton changement de fréquence',
      html: htmlContent,
      text: textContent,
    });

    if (emailError) {
      console.error('Email error:', emailError);
      return res.status(500).json({ error: 'Failed to send confirmation email' });
    }

    return res.status(200).json({
      success: true,
      message: 'Confirmation email sent',
      isNewSubscriber,
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'An unexpected error occurred' });
  }
}
