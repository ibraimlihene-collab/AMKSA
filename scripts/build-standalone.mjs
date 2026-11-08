import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const html = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8');
const jsRef = html.match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
const cssRef = html.match(/href="(\/assets\/[^"]+\.css)"/)?.[1];
if (!jsRef || !cssRef) throw new Error('Could not resolve Vite asset names from dist/index.html');

const js = fs.readFileSync(path.join(root, 'dist', jsRef.replace(/^\//, '')), 'utf8');
const css = fs.readFileSync(path.join(root, 'dist', cssRef.replace(/^\//, '')), 'utf8');
const b64 = Buffer.from(js, 'utf8').toString('base64');
const chunks = [];
for (let i = 0; i < b64.length; i += 180) chunks.push(JSON.stringify(b64.slice(i, i + 180)));
const joined = chunks.join('\n+');

const out = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1.0" />
<title>ⴰⵎⴽⵙⴰ — Amksa</title>
<style>${css}</style>
<style>#__err{position:fixed;inset:0;background:#450a0a;color:#fecaca;font:14px/1.5 monospace;padding:16px;white-space:pre-wrap;z-index:2147483647;direction:ltr;display:none}</style>
</head>
<body>
<div id="__err"></div><div id="root"></div>
<script>
window.addEventListener("error",function(e){showErr("RUNTIME: "+(e.message||"error")+" @ "+(e.lineno||0)+":"+(e.colno||0)+"\\n"+(e.error&&e.error.stack||""));});
window.addEventListener("unhandledrejection",function(e){showErr("REJECTION: "+((e.reason&&e.reason.message)||e.reason||"?"));});
try{var b64=${joined};var code=new TextDecoder().decode(Uint8Array.from(atob(b64),function(c){return c.charCodeAt(0);}));(new Function(code))();}catch(e){showErr("LOADER: "+e.message+"\\n"+e.stack);}
function showErr(t){var el=document.getElementById("__err");el.textContent=t;el.style.display="block";}
</script>
</body>
</html>`;

const decoded = Buffer.from(b64, 'base64').toString('utf8');
if (decoded !== js) throw new Error('Base64 round-trip check failed');
const outPath = path.join(root, 'dist/standalone.html');
fs.writeFileSync(outPath, out, 'utf8');
console.log(`Wrote ${outPath} (${fs.statSync(outPath).size} bytes); base64 round-trip OK`);
