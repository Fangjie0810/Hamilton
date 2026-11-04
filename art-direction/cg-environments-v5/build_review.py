"""Build the offline environment-frame gallery from local production records."""
from pathlib import Path
import html
import json

BASE = Path(__file__).resolve().parent
ROUGH_CUT = (
    ("S01", "照料母亲", 5),
    ("S02", "空床", 5),
    ("S03", "商行谋生", 7),
    ("E01", "", 4),
    ("E03", "", 5),
    ("S04", "风灾", 7),
    ("E04", "", 4),
    ("E05", "", 5),
    ("S05", "写作", 7),
    ("S06", "获得支持", 10),
    ("S07", "登船", 9),
)


def clock_label(seconds):
    return f"{seconds // 60:02d}:{seconds % 60:02d}"


def build_page(manifest, costs):
    """Return HTML without reading images, following URLs or creating media."""
    e = html.escape
    shots = manifest["shots"]
    by_id = {shot["id"]: shot for shot in shots}
    expected = [f"E{i:02d}" for i in range(1, 7)]
    if len(shots) != 6 or set(by_id) != set(expected):
        raise ValueError("Expected exactly one environment frame for each ID E01–E06.")
    ordered = [by_id[shot_id] for shot_id in expected]
    overview = []
    cards = []
    for shot in ordered:
        shot_id, title = e(shot["id"]), e(shot["title"])
        image_path, category = e(shot["file"]), e(shot["category"])
        overview.append(f'''<a class="environment-thumb" href="#{shot_id}" aria-label="跳到 {shot_id} {title}">
<img src="{image_path}" alt=""><div class="thumb-caption"><span class="number">{shot_id}</span><span>{title}</span><span class="category">{category}</span></div></a>''')
        cards.append(f'''<section id="{shot_id}" class="shot" aria-labelledby="title-{shot_id}">
<div class="caption"><h2 id="title-{shot_id}"><span class="number">{shot_id}</span>{title}</h2><span class="category">{category}</span></div>
<a class="full-image" href="{image_path}" target="_blank" rel="noopener" aria-label="打开 {shot_id} 原图"><img src="{image_path}" alt="{title}"></a>
<p class="purpose"><span class="text-label">画面用途</span>{e(shot['purpose'])}</p>
<p class="observation"><span class="text-label">我们的观察</span>{e(shot['review'])}</p>
<div class="shot-links"><a href="{image_path}" download>下载原图</a><a href="{e(shot['image_prompt'])}">图片提示词</a><a href="{e(shot['motion_prompt'])}">后续视频提示词</a></div></section>''')

    timeline = []
    elapsed = 0
    for shot_id, title, duration in ROUGH_CUT:
        if shot_id.startswith("E"):
            title, image_path = by_id[shot_id]["title"], by_id[shot_id]["file"]
        else:
            image_path = f"characters/{shot_id}.png"
        start, end = clock_label(elapsed), clock_label(elapsed + duration)
        timeline.append(f'''<a class="cut-frame" href="{e(image_path)}" target="_blank" rel="noopener" aria-label="打开 {e(shot_id)} 静态原图">
<img src="{e(image_path)}" alt=""><span class="cut-id">{e(shot_id)} · {duration} 秒</span><span class="cut-title">{e(title)}</span><span class="cut-time">{start}—{end}</span></a>''')
        elapsed += duration

    current_cost = f"¥{costs['current_estimated_cny']:.2f}"
    previous_cost = f"¥{costs['previous_estimated_cny']:.2f}"
    unknown_extra = f"¥{costs['previous_unknown_max_extra_cny']:.2f}"
    output_tokens = f"{costs['current_output_tokens']:,}"

    return '''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hamilton · 环境首帧候选</title>
<style>
:root{color-scheme:dark;--bg:#171c1f;--panel:#21282b;--ink:#eff0e9;--muted:#abb7b5;--line:#3c484a;--accent:#d2b885}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.7 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}
header,main,footer{max-width:1400px;margin:auto;padding:24px}header{padding-top:46px}h1{font-size:clamp(30px,5vw,46px);line-height:1.25;margin:12px 0 18px}h2{font-size:22px;line-height:1.4;margin:0}a{color:var(--accent)}a:focus-visible,button:focus-visible,summary:focus-visible{outline:3px solid var(--accent);outline-offset:4px}
.eyebrow{font-size:13px;letter-spacing:.12em;color:var(--muted)}.intro{max-width:850px}.muted{color:var(--muted);font-size:14px}.status{border-left:3px solid var(--accent);background:#2e3332;padding:12px 16px;margin:18px 0}.status strong{font-weight:600}.status p{margin:4px 0 0;color:var(--muted)}.document-links,.shot-links{display:flex;gap:22px;flex-wrap:wrap;font-size:14px}.document-links{margin:18px 0}.costs{color:var(--muted);font-size:13px;margin:16px 0}.costs strong{color:var(--ink);font-weight:500}
.overview-heading{display:flex;justify-content:space-between;align-items:center;gap:16px;margin:30px 0 14px}.overview-heading h2{font-size:19px}.print-button{font:inherit;font-size:14px;padding:7px 13px;border:1px solid var(--line);border-radius:4px;color:var(--accent);background:var(--panel);cursor:pointer}
.overview{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.environment-thumb{display:block;min-width:0;background:var(--panel);border:1px solid var(--line);border-radius:5px;overflow:hidden;text-decoration:none}.environment-thumb:hover{border-color:var(--accent)}.environment-thumb img{display:block;width:100%;aspect-ratio:16/9;object-fit:contain;background:#14191b}.thumb-caption{display:flex;align-items:baseline;gap:10px;padding:10px 12px;color:var(--ink);font-size:15px}.thumb-caption .category{margin-left:auto}.category{font-size:12px;color:var(--muted)}.number{font-weight:600;color:var(--accent);margin-right:12px}.thumb-caption .number{margin-right:0;white-space:nowrap}
.shot{scroll-margin-top:20px;margin:0 0 32px;padding:20px;background:var(--panel);border:1px solid var(--line);border-radius:7px}.caption{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;gap:12px}.full-image{display:block}.full-image img{width:100%;height:auto;display:block}.shot p{margin:14px 0 0}.text-label{font-size:13px;font-weight:600;color:var(--muted);margin-right:12px}.observation{color:var(--muted);font-size:14px}.shot-links{margin-top:16px}
.rough-cut{border:1px solid var(--line);border-radius:7px;background:var(--panel);margin:8px 0 18px;padding:18px 20px}.rough-cut summary{cursor:pointer;font-size:20px;font-weight:500}.rough-content>p{margin:12px 0 18px}.timeline{display:grid;grid-template-columns:repeat(11,minmax(100px,1fr));gap:9px;overflow-x:auto;padding:3px 3px 12px}.cut-frame{min-width:0;text-decoration:none;border:1px solid var(--line);padding:5px;border-radius:3px;background:var(--bg)}.cut-frame img{width:100%;aspect-ratio:16/9;object-fit:contain;display:block}.cut-id,.cut-title,.cut-time{display:block;line-height:1.45}.cut-id{font-size:12px;margin-top:6px;color:var(--accent)}.cut-title{font-size:12px;color:var(--ink);margin-top:3px}.cut-time{font-size:10px;color:var(--muted);margin-top:5px;white-space:nowrap}
@media(max-width:700px){header,main,footer{padding:20px 12px}.overview{grid-template-columns:1fr;gap:14px}.shot,.rough-cut{padding:12px}h2{font-size:18px}.number{margin-right:8px}.text-label{display:block;margin-bottom:3px}.caption{align-items:baseline}.thumb-caption{font-size:16px}.rough-cut summary{font-size:18px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
@page{size:A4 portrait;margin:12mm}
@media print{
:root{color-scheme:light;--bg:#fff;--panel:#fff;--ink:#111;--muted:#555;--line:#ccc;--accent:#343e37}html{scroll-behavior:auto}body{background:#fff;font-size:10.5pt;line-height:1.5}header,main,footer{max-width:none;padding:0}header{break-after:page}h1{font-size:25pt}h2{font-size:17pt}.eyebrow{font-size:9pt}.intro{max-width:none}.status{background:none;border:1px solid #aaa;padding:3mm}.document-links,.shot-links,.print-button{display:none}.costs{font-size:8pt}.overview-heading{margin:7mm 0 3mm}.overview{grid-template-columns:repeat(3,minmax(0,1fr));gap:3mm}.environment-thumb{border-radius:0}.thumb-caption{gap:1mm;padding:2mm;font-size:9pt;flex-wrap:wrap}.thumb-caption .category{font-size:8pt}.shot{margin:0;padding:0;border:0;border-radius:0;break-after:page;break-inside:avoid}.caption{margin-bottom:5mm}.full-image img{max-height:118mm;object-fit:contain}.shot p{margin-top:5mm}.text-label{display:inline;font-size:9pt;margin-right:3mm}.observation,.muted{font-size:9pt}.rough-cut{margin:0;padding:0;border:0;break-inside:avoid}.rough-cut summary{font-size:17pt;list-style:none}.rough-cut summary::-webkit-details-marker{display:none}.timeline{grid-template-columns:repeat(6,minmax(0,1fr));overflow:visible;gap:3mm;padding:0}.cut-frame{break-inside:avoid}.cut-id,.cut-title{font-size:8pt}.cut-time{font-size:7pt}footer{margin-top:6mm}a{color:inherit;text-decoration:none}
}
</style></head><body>
<header><div class="eyebrow">HAMILTON · ENVIRONMENT FIRST FRAMES V5</div>
<h1>加勒比：风暴与灾后</h1>
<p class="intro">2张鸟瞰、2张风暴中的地面视角、2张灾后环境。把岛屿、天气与生计接回人物经历，再决定哪些镜头进入剪辑。</p>
<div class="status"><strong>首帧候选·等用户选定 ｜ 未生成视频</strong><p>本页全部是静态图片；下方的剪辑粗排也不是视频预览。</p></div>
<nav class="document-links" aria-label="制作文档"><a href="费用记录.md">费用记录</a><a href="剪辑结构建议.md">剪辑结构建议</a><a href="操作手册.md">操作手册</a></nav>
<p class="costs">本轮按公开价格预估 <strong>''' + current_cost + '''</strong> · 输出 token <strong>''' + output_tokens + '''</strong><br>上轮预估 ''' + previous_cost + '''；上轮未知请求可能另计最多 ''' + unknown_extra + '''。以上为估算，实际扣款以账单为准。</p>
<div class="overview-heading"><h2 id="overview-title">六图总览</h2><button class="print-button" type="button" onclick="window.print()">打印／存为 PDF</button></div>
<nav class="overview" aria-labelledby="overview-title">''' + "\n".join(overview) + '''</nav>
<p class="muted">点击缩略图跳到对应大图；点击大图可打开原始图片。</p>
</header><main>''' + "\n".join(cards) + '''
<details class="rough-cut" id="rough-cut"><summary>连进人物镜头的 68 秒粗排</summary><div class="rough-content">
<p class="muted">以下 11 张静态缩略图只表达建议顺序与剪辑时长。人物图片沿用上一轮；还没有生成或拼接这些视频。</p>
<div class="timeline" aria-label="68 秒静态剪辑顺序">''' + "\n".join(timeline) + '''</div>
</div></details></main>
<footer><p class="muted">选定首帧后再制作视频。每张图的后续视频提示词已单独链接，实际动作效果将在生成后检查。</p></footer>
<script>
const roughCut = document.getElementById('rough-cut');
let wasOpenBeforePrint = null;
window.addEventListener('beforeprint', () => {
  if (wasOpenBeforePrint === null) wasOpenBeforePrint = roughCut.open;
  roughCut.open = true;
});
window.addEventListener('afterprint', () => {
  if (wasOpenBeforePrint !== null) roughCut.open = wasOpenBeforePrint;
  wasOpenBeforePrint = null;
});
</script></body></html>'''


def main():
    manifest = json.loads((BASE / "environment-manifest.json").read_text(encoding="utf-8"))
    costs = json.loads((BASE / "cost-report.json").read_text(encoding="utf-8"))
    page = build_page(manifest, costs)
    required_images = [shot["file"] for shot in manifest["shots"]]
    required_images.extend(f"characters/S{i:02d}.png" for i in range(1, 8))
    for relative_path in required_images:
        if not (BASE / relative_path).is_file():
            raise SystemExit("Missing local review image: " + relative_path)
    (BASE / "环境首帧.html").write_text(page, encoding="utf-8")
    print("Built offline gallery for 6 environment frames and an 11-shot, 68-second still-image outline.")


if __name__ == "__main__":
    main()
