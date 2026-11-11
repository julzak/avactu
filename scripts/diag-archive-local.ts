/** Diag : appelle api/archive.ts en local contre la vraie base. Usage : tsx --env-file=... scripts/diag-archive-local.ts 'view=list&kind=dossier&slug=chine' [fichier] */
import { writeFileSync } from 'fs';
import handler from '../api/archive.js';
const query = Object.fromEntries(new URLSearchParams(process.argv[2]));
let status = 0;
const res = {
  setHeader() { return res; },
  status(s: number) { status = s; return res; },
  send(body: string) { console.log(status, body.length, 'octets'); if (process.argv[3]) writeFileSync(process.argv[3], body); return res; },
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
await handler({ query } as any, res as any);
