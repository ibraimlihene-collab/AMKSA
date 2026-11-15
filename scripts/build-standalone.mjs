import { copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const dist = new URL('../dist/', import.meta.url);
if (!existsSync(new URL('index.html', dist))) throw new Error('Build the application before export.');
// Retain this command for older users. The export uses normal module assets and requires HTTP hosting.
copyFileSync(new URL('index.html', dist), new URL('standalone.html', dist));
console.log(`Created ${fileURLToPath(new URL('standalone.html', dist))}. Deploy the complete dist directory.`);
