import { readFileSync, writeFileSync } from 'node:fs';
import { enhanceGallery } from './gallery-markup.js';
writeFileSync('web/index.html', enhanceGallery(readFileSync('web/index.html', 'utf8')));
console.log('Added lightweight navigation, photo viewing, and transcription formatting.');
