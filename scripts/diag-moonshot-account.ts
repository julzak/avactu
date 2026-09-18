// Diag ad hoc : le compte Moonshot répond-il, et son erreur est-elle classée "erreur de compte" ?
// Usage: ANTHROPIC_AUTH_TOKEN=$(cat ~/.config/moonshot/key) ./node_modules/.bin/tsx scripts/diag-moonshot-account.ts
import Anthropic from '@anthropic-ai/sdk';
import { isAccountError } from './synthesis-client.js';

const client = new Anthropic({ baseURL: 'https://api.moonshot.ai/anthropic', apiKey: null, maxRetries: 0 });
client.messages
  .create({ model: 'kimi-k3', max_tokens: 16, messages: [{ role: 'user', content: 'ping' }] })
  .then((r) => console.log(`✅ Compte OK, réponse de ${r.model}`))
  .catch((e) => console.log(`status=${e.status} isAccountError=${isAccountError(e)}\n${String(e.message).replace(/org-\w+|ak-\w+/g, '***').slice(0, 200)}`));
