import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const configured = process.env.PAGES_BASE_PATH ?? "/aplicativo-habitos/";
const base = configured.endsWith("/") ? configured : `${configured}/`;
const origin = "https://example.github.io";
const manifestURL = new URL(`${base}manifest.webmanifest`, origin);
const root = path.resolve("dist");
const read = (file) => readFileSync(path.join(root, file), "utf8");
const fileFor = (url) => {
  assert.ok(
    url.pathname.startsWith(base),
    `URL fora do caminho do Pages: ${url}`,
  );
  const relative = url.pathname.slice(base.length);
  assert.ok(
    existsSync(path.join(root, relative)),
    `Arquivo não encontrado: ${relative}`,
  );
};
const manifest = JSON.parse(read("manifest.webmanifest"));
assert.equal(new URL(manifest.start_url, manifestURL).pathname, base);
assert.equal(new URL(manifest.scope, manifestURL).pathname, base);
for (const icon of manifest.icons) {
  const url = new URL(icon.src, manifestURL);
  fileFor(url);
  const png = readFileSync(path.join(root, url.pathname.slice(base.length)));
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes);
}
const html = read("index.html");
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g))
  fileFor(new URL(match[1], new URL(base, origin)));
assert.ok(html.includes(`${base}icons/apple-touch-icon.png`));
assert.ok(html.includes(`${base}manifest.webmanifest`));
const registration = read("registerSW.js");
assert.ok(registration.includes(`register('${base}sw.js'`));
assert.ok(registration.includes(`scope: '${base}'`));
const sw = read("sw.js");
assert.ok(sw.includes(`${base}index.html`), "Fallback offline incorreto");
const cached = [...sw.matchAll(/url:"([^"]+)"/g)].map((m) => m[1]);
assert.ok(cached.length > 0, "Precache ausente");
for (const url of cached)
  fileFor(new URL(url, new URL(`${base}sw.js`, origin)));
for (const required of [
  "index.html",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
])
  assert.ok(
    cached.some(
      (url) =>
        new URL(url, new URL(`${base}sw.js`, origin)).pathname ===
        `${base}${required}`,
    ),
    `Precache ausente: ${required}`,
  );
console.log(
  `PWA verificada em ${base}: HTML, manifesto, ícones, service worker, escopo e ${cached.length} arquivos de precache.`,
);
