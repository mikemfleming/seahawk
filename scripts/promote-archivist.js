import { adminClient } from '../lib/supabase-store.js';
const email = process.argv.slice(2).filter(arg => arg !== '--')[0];
if (!email || !email.includes('@')) throw new Error('Usage: pnpm archivist -- email@example.com');
const admin = adminClient();
const { data: profile, error } = await admin.from('profiles').select('id').eq('email', email).single();
if (error) throw new Error('Create this account first.');
const { error: failure } = await admin.from('profiles').update({ role: 'archivist', status: 'approved' }).eq('id', profile.id);
if (failure) throw failure;
console.log('Archivist permissions granted to the account.');
