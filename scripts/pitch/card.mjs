import fs from "node:fs";
const LOGO = fs.readFileSync(new URL("../../public/logo-mark.svg", import.meta.url), "utf8").replace("<svg ", '<svg width="100%" height="100%" ');
export function card({ title, sub, left, right, note, pill = "Founding offer: 3 months free · no card", tag = "" }) {
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;800&display=swap" rel="stylesheet">
<style>
html,body{margin:0;width:1080px;height:1350px;overflow:hidden;background:#191919;font-family:"Plus Jakarta Sans",system-ui,sans-serif;color:#fff;-webkit-font-smoothing:antialiased}
.glow{position:absolute;inset:0;background:radial-gradient(ellipse 70% 45% at 50% 100%,rgba(46,242,122,.25),transparent 70%)}
.top{position:absolute;left:70px;right:70px;top:64px;display:flex;align-items:center;gap:18px}
.mark{width:64px;height:64px;border-radius:16px;overflow:hidden}
.brand{font-size:28px;font-weight:800}
.tag{margin-left:auto;display:flex;align-items:center;gap:10px;border:2px solid #2EF27A;color:#2EF27A;font-size:22px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:12px 22px;border-radius:999px}
.tag:before{content:"";width:12px;height:12px;border-radius:50%;background:#2EF27A;box-shadow:0 0 14px #2EF27A}
h1{position:absolute;left:70px;right:70px;top:162px;margin:0;line-height:1.05;font-weight:800;letter-spacing:-.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sub{position:absolute;left:70px;right:70px;top:268px;margin:0;font-size:34px;line-height:1.2;font-weight:800;color:#2EF27A}
.phones{position:absolute;left:0;right:0;top:392px;display:flex;justify-content:center;gap:44px}
.ph{width:390px;height:780px;border-radius:44px;overflow:hidden;box-shadow:0 0 0 8px #2b2b2b,0 0 0 9px #3a3a3a,0 30px 80px rgba(0,0,0,.6);background:#fff}
.ph img{width:100%;display:block}
.ph:last-child{transform:translateY(40px)}
.foot{position:absolute;left:70px;right:70px;bottom:52px;display:flex;align-items:center;justify-content:space-between}
.pill{background:#2EF27A;color:#191919;font-weight:800;font-size:26px;padding:16px 28px;border-radius:999px}
.note{font-size:20px;font-weight:600;color:rgba(255,255,255,.6);text-align:right;line-height:1.35}
</style></head><body><div class="glow"></div>
<div class="top"><div class="mark">${LOGO}</div><div class="brand">Frugal Center</div>${tag ? `<div class="tag">${escape(tag)}</div>` : ""}</div>
<h1 style="font-size:${title.length <= 16 ? 72 : title.length <= 24 ? 58 : 46}px">${escape(title)}</h1>
<p class="sub">${escape(sub)}</p>
<div class="phones"><div class="ph"><img src="${left}"></div><div class="ph"><img src="${right}"></div></div>
<div class="foot"><div class="pill">${pill}</div><div class="note">${note}</div></div>
</body></html>`;
}
function escape(s) { return s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]); }
