import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Accept both GET (from email link) and POST
  const token = req.method === 'GET'
    ? req.query.token as string
    : req.body?.token as string;

  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }

  // Validate environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing environment variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find subscriber by token
    const { data: subscriber, error: fetchError } = await supabase
      .from('subscribers')
      .select('id, email, frequency, pending_frequency, confirmation_token, token_expires_at, confirmed')
      .eq('confirmation_token', token)
      .single();

    if (fetchError || !subscriber) {
      return res.status(404).json({
        error: 'invalid_token',
        message: 'Token invalide ou expiré'
      });
    }

    // Check token expiration
    if (subscriber.token_expires_at && new Date(subscriber.token_expires_at) < new Date()) {
      return res.status(400).json({
        error: 'expired_token',
        message: 'Ce lien a expiré. Refais ta demande.'
      });
    }

    // Apply the pending frequency change
    const newFrequency = subscriber.pending_frequency || subscriber.frequency;

    const { error: updateError } = await supabase
      .from('subscribers')
      .update({
        frequency: newFrequency,
        confirmed: true,
        pending_frequency: null,
        confirmation_token: null,
        token_expires_at: null,
      })
      .eq('id', subscriber.id);

    if (updateError) {
      console.error('Update error:', updateError);
      return res.status(500).json({ error: 'Failed to confirm subscription' });
    }

    // Notify admin when a new subscriber confirms
    if (!subscriber.confirmed) {
      const resendApiKey = process.env.RESEND_API_KEY;
      if (resendApiKey) {
        const resend = new Resend(resendApiKey);
        resend.emails.send({
          from: 'Avactu <briefing@avactu.com>',
          to: 'jzakoian@gmail.com',
          subject: `Nouvel abonné Avactu : ${subscriber.email}`,
          text: [
            `Nouvel abonné confirmé sur Avactu`,
            ``,
            `Email : ${subscriber.email}`,
            `Fréquence : ${newFrequency}`,
            `Date : ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}`,
          ].join('\n'),
        }).catch((err) => {
          console.error('Admin notification email error:', err);
        });
      }
    }

    // Return success with frequency info
    return res.status(200).json({
      success: true,
      email: subscriber.email,
      frequency: newFrequency,
      wasNewSubscriber: !subscriber.confirmed,
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'An unexpected error occurred' });
  }
}
