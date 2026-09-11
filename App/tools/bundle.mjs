// Assemble l'app en une seule page HTML (aperçu en artefact Claude).
// Usage : node App/tools/bundle.mjs <fichier de sortie>
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const out = process.argv[2] || "uss-app.html";

const css = read("css/theme.css") + "\n" + read("css/app.css");
const icon = read("icons/icon.svg");

// Modules concaténés dans l'ordre des dépendances, imports/exports retirés.
const strip = (src) => src.replace(/^import .*$/gm, "").replace(/^export /gm, "");
const js = [
  strip(read("js/config.js")),
  strip(read("js/demo-data.js")),
  "const demo = { teams, profiles, events, attendance, standings, match_stats };",
  strip(read("js/store.js")),
  strip(read("js/lens.js")),
  strip(read("js/app.js"))
    .replace(/document\.body\.appendChild\(sheet\)/, '$("#app").appendChild(sheet)')
    .replace(/window\.scrollTo\(0, 0\)/g, '$("#app").scrollTo(0, 0)')
    .replace(/if \("serviceWorker" in navigator[\s\S]*?\}\n/, ""),
].join("\n");

// Sur grand écran, l'app s'affiche dans un cadre de téléphone.
const frameCss = `
html,body{height:100%;}
body{background:#03061a;}
#app{position:relative;overflow:auto;height:100vh;background-attachment:local;transform:translateZ(0);}
@media (min-width:760px){
  body{display:grid;place-items:center;padding:24px 24px 44px;background:
    radial-gradient(60% 50% at 50% 0,#122352 0,transparent 70%),#03061a;}
  #app{width:393px;height:min(852px,calc(100vh - 80px));border-radius:48px;border:10px solid #101733;
    box-shadow:0 30px 80px rgba(0,0,0,.6),inset 0 0 0 1px rgba(255,255,255,.06);}
  #app::-webkit-scrollbar{display:none;}
  .preview-note{position:fixed;left:0;right:0;bottom:12px;text-align:center;font:500 12px/1.4 -apple-system,"Segoe UI",Roboto,sans-serif;color:#7d88ab;}
}
@media (max-width:759px){ .preview-note{display:none;} }
`;

const html = `<title>USS Savigny</title>
<meta name="description" content="Aperçu de l'application du club : agenda, convocations, classement, stats.">
<style>${css}${frameCss}</style>
<div id="app"><main class="auth"><div class="crest">USS</div><div class="sub">Chargement…</div></main></div>
<div class="preview-note">Aperçu de développement · mode démonstration · ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</div>
<script type="module">
${js}
</script>
`;
writeFileSync(out, html);
console.log(`écrit ${out} (${(html.length / 1024).toFixed(0)} Ko)`);
