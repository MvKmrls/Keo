// Génère la carte de déplacement (PNG) utilisée par le filtre "liquid glass" du surlignage.
// R = déplacement horizontal, G = déplacement vertical (128 = neutre). Le centre est neutre,
// la déformation monte vers le bord, en courbant le contenu vers l'intérieur (effet lentille).
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const W = 120, H = 72, R = H / 2;              // forme "stade" : rectangle à bouts ronds
const px = new Uint8Array(W * H * 4);
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const cx = x + .5 - W / 2, cy = y + .5 - H / 2;
  // distance signée au "squelette" du stade (segment central) → distance normalisée au bord
  const sx = Math.max(0, Math.abs(cx) - (W / 2 - R));
  const d = Math.hypot(sx, cy) / R;             // 0 au centre du segment, 1 au bord
  const nx = Math.sign(cx) * sx, ny = cy;
  const len = Math.hypot(nx, ny) || 1;
  const f = smooth(.45, 1.02, d);               // neutre au centre, fort au bord
  const vx = -(nx / len) * f, vy = -(ny / len) * f;   // vers l'intérieur = grossissement
  const i = (y * W + x) * 4;
  px[i] = Math.round(128 + 127 * vx); px[i + 1] = Math.round(128 + 127 * vy); px[i + 2] = 128; px[i + 3] = 255;
}
// encodage PNG minimal
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = ~0; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (~c) >>> 0; };
const chunk = (type, data) => { const t = Buffer.from(type); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, c]); };
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; Buffer.from(px.buffer, y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1); }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
const uri = "data:image/png;base64," + png.toString("base64");
writeFileSync(new URL("../js/lens.js", import.meta.url), `// Généré par tools/lens-map.mjs — filtre "liquid glass" du surlignage de la barre.
// Chromium applique la déformation (backdrop-filter: url(#liquid)) ; Safari retombe sur un flou léger.
export const LENS_MAP = "${uri}";
export function installLens() {
  if (document.getElementById("liquid")) return;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "0"); svg.setAttribute("height", "0"); svg.setAttribute("aria-hidden", "true");
  svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
  svg.innerHTML = \`<filter id="liquid" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feImage href="\${LENS_MAP}" preserveAspectRatio="none" result="map"/>
    <feDisplacementMap in="SourceGraphic" in2="map" scale="34" xChannelSelector="R" yChannelSelector="G" result="bent"/>
    <feGaussianBlur in="bent" stdDeviation=".2"/>
  </filter>\`;
  document.body.appendChild(svg);
}
`);
console.log("carte", W + "x" + H, png.length, "octets");
