"""Build a local review page without changing the mapped original images."""
from pathlib import Path
import html
import json

BASE = Path(__file__).resolve().parent
STATUS = "首帧候选·等用户选定"


def build_page(manifest):
    """Render the existing manifest schema; reading image files is left to main."""
    e = html.escape
    thumbnails = []
    cards = []
    for shot in manifest["shots"]:
        shot_id = e(shot["id"])
        title = e(shot["title"])
        image_path = e(shot["file"])
        thumbnails.append(f'''<a class="thumbnail" href="#{shot_id}" aria-label="跳到 {shot_id} {title}">
<img src="{image_path}" alt=""><span class="thumb-id">{shot_id}</span><span class="thumb-title">{title}</span></a>''')
        cards.append(f'''<section id="{shot_id}" class="shot" aria-labelledby="title-{shot_id}">
<div class="caption"><h2 id="title-{shot_id}"><span class="number">{shot_id}</span>{title}</h2><a class="download" href="{image_path}" download>下载原图</a></div>
<a class="full-image" href="{image_path}" target="_blank" rel="noopener" aria-label="打开 {shot_id} 原图"><img src="{image_path}" alt="{title}"></a>
<p class="description"><span class="text-label">画面内容</span>{e(shot['description'])}</p>
<p class="observation"><span class="text-label">我们的观察</span>{e(shot['review'])}</p></section>''')

    return '''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hamilton · 七张首帧候选</title>
<style>
:root{color-scheme:light;--ink:#26322d;--muted:#626e65;--line:#d7dfd8;--accent:#356651}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#f1f2ed;color:var(--ink);font:16px/1.7 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}
header,main,footer{max-width:1440px;margin:auto;padding:24px}header{padding-top:48px}h1{font-size:clamp(30px,5vw,46px);line-height:1.25;margin:12px 0 18px}h2{font-size:22px;line-height:1.4;margin:0}
a{color:var(--accent)}a:focus-visible,button:focus-visible{outline:3px solid var(--accent);outline-offset:4px}.eyebrow{font-size:13px;letter-spacing:.12em;color:var(--muted)}.intro{max-width:900px}.muted{color:var(--muted);font-size:14px}
.status{display:inline-block;background:#e4eae2;border-left:3px solid var(--accent);padding:7px 14px;font-size:14px;margin:0 0 10px}.overview-heading{display:flex;justify-content:space-between;align-items:center;gap:16px;margin:26px 0 12px}.overview-heading h2{font-size:18px}.print-button{font:inherit;font-size:14px;padding:7px 13px;border:1px solid var(--line);border-radius:4px;color:var(--accent);background:#fff;cursor:pointer}
.overview{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:10px;padding:3px 3px 12px;overflow-x:auto;scroll-snap-type:x proximity}.thumbnail{display:block;min-width:0;padding:7px;background:#fff;border:1px solid var(--line);border-radius:4px;text-decoration:none;scroll-snap-align:start}.thumbnail:hover{border-color:var(--accent)}.thumbnail img{width:100%;aspect-ratio:16/9;object-fit:contain;background:#eeefea;display:block}.thumb-id{display:block;color:var(--accent);font-size:12px;font-weight:650;margin-top:6px}.thumb-title{display:block;font-size:13px;line-height:1.45;color:var(--ink)}
.shot{scroll-margin-top:20px;margin:0 0 32px;padding:20px;background:#fff;border:1px solid var(--line);border-radius:7px}.caption{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;gap:12px}.download{font-size:14px;white-space:nowrap}.number{font-weight:650;color:var(--accent);margin-right:14px}.full-image{display:block}.full-image img{width:100%;height:auto;display:block}.shot p{margin:14px 0 0}.text-label{font-size:13px;font-weight:600;color:var(--muted);margin-right:12px}.observation{color:var(--muted);font-size:14px}.links{display:flex;gap:22px;flex-wrap:wrap;margin-top:16px;font-size:14px}
@media(max-width:1000px){.overview{grid-template-columns:repeat(7,minmax(145px,1fr))}}
@media(max-width:620px){header,main,footer{padding:20px 12px}.shot{padding:12px}h2{font-size:18px}.number{margin-right:8px}.text-label{display:block;margin-bottom:3px}.overview-heading{align-items:baseline}.print-button{padding:5px 9px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
@page{size:A4 portrait;margin:12mm}
@media print{
html{scroll-behavior:auto}body{background:#fff;color:#111;font-size:11pt;line-height:1.55}header,main,footer{max-width:none;padding:0}header{break-after:page}h1{font-size:25pt}h2{font-size:17pt}.intro{max-width:none}.status{border:1px solid #aaa;background:none;color:#111}.print-button,.links,.download{display:none}.overview-heading{margin-top:9mm}.overview{grid-template-columns:repeat(7,minmax(0,1fr));gap:2mm;overflow:visible;padding:0}.thumbnail{padding:1mm;border:1px solid #ccc;border-radius:0;break-inside:avoid}.thumb-id{font-size:8pt}.thumb-title{font-size:8pt;line-height:1.35}.shot{margin:0;padding:0;border:0;border-radius:0;break-after:page;break-inside:avoid}.shot:last-child{break-after:auto}.caption{margin-bottom:5mm}.full-image img{max-height:118mm;object-fit:contain}.shot p{margin-top:5mm}.text-label{display:inline;font-size:10pt;margin-right:3mm}.observation,.muted{font-size:10pt;color:#444}footer{margin-top:6mm}a{color:inherit;text-decoration:none}
}
</style></head><body>
<header><div class="eyebrow">HAMILTON · FIRST FRAMES V4</div>
<h1>七张首帧候选，一起看再决定</h1>
<div class="status">''' + STATUS + '''</div>
<p class="intro">照料母亲 → 空床 → 商行谋生 → 风灾 → 写作 → 获得支持 → 登船。<br>这次先看完整套图片，选定后再开始生成视频。</p>
<p class="muted">同账号 Seedream 5.0 lite / pro 生成 · 原始文件保存 · 点击下方缩略图跳到对应大图</p>
<div class="overview-heading"><h2 id="overview-title">七图总览</h2><button class="print-button" type="button" onclick="window.print()">打印／存为 PDF</button></div>
<nav class="overview" aria-labelledby="overview-title">''' + "\n".join(thumbnails) + '''</nav>
<div class="links"><a href="七镜组图提示词.txt">最初的组图提示词</a><a href="制作说明.md">制作说明</a><a href="操作手册.md">下一步操作</a><a href="firstframes-manifest.json">图片来源与制作记录</a></div>
</header><main>''' + "\n".join(cards) + '''</main>
<footer><p class="muted">以上为静态首帧候选。视频中的动作将在图片选定后制作；我们会在生成后检查实际效果。</p></footer>
</body></html>'''


def main():
    manifest = json.loads((BASE / "firstframes-manifest.json").read_text(encoding="utf-8"))
    for shot in manifest["shots"]:
        if not (BASE / shot["file"]).is_file():
            raise SystemExit("Missing mapped first frame: " + shot["id"])
    (BASE / "全部首帧.html").write_text(build_page(manifest), encoding="utf-8")
    print("Built offline review page for %d mapped originals." % len(manifest["shots"]))


if __name__ == "__main__":
    main()
