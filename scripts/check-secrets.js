import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
const files = execFileSync('git', ['ls-files', '-z'], {encoding:'utf8'}).split('\0').filter(Boolean);
const problems = [];
const privatePaths = /^(?:data\/|\.pnpm-store\/|node_modules\/|dist\/|supabase\/(?:\.temp|\.branches)\/)|(?:^|\/)\.env(?:\..*)?$/;
const secrets = [];
if (existsSync('.env')) {
  const env = readFileSync('.env','utf8');
  for (const key of ['OPENAI_API_KEY','SUPABASE_SECRET_KEY','SUPABASE_ACCESS_TOKEN','SUPABASE_DB_PASSWORD']) {
    const value = env.match(new RegExp('^'+key+'=(.+)$','m'))?.[1]?.trim();
    if (value && value.length > 12) secrets.push(value);
  }
}
for (const file of files) {
  if (file !== '.env.example' && privatePaths.test(file)) problems.push(`${file}: private path tracked`);
  const raw = execFileSync('git', ['show', `:${file}`]);
  const content = raw.toString('utf8');
  if (secrets.some(secret => content.includes(secret))) problems.push(`${file}: contains a local secret value`);
  if (/sb_secret_[A-Za-z0-9_-]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{30,}|gh[pousr]_[A-Za-z0-9]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content)) problems.push(`${file}: credential pattern detected`);
  for (const token of content.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) || []) {
    try { if (JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).role === 'service_role') problems.push(`${file}: service-role JWT detected`); } catch {}
  }
}
if(problems.length){console.error(problems.join('\n'));process.exit(1);}
console.log(`Secret audit passed for ${files.length} tracked files; private archive paths excluded.`);
