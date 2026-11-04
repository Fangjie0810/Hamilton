#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Render an offline illustrated review; no media generation or API calls."""
from html import escape as h
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parent
M=json.loads((ROOT/"manifest.json").read_text(encoding="utf-8"))
SHOTS=M["shots"]

def tc(seconds):
    return f"{int(seconds)//60:02}:{int(seconds)%60:02}"

SYNOPSIS=[
    "一只碗被放到母亲床边。下一镜，孩子的手仍在碗旁，床却空了。镜头不解释死亡，只让观众有时间注意到：熟悉的照料动作还在，被照料的人已经不在。",
    "切到已经长大的少年，他在漏雨商行护住账册。风声先进入房间，画面才切到远海：岛很低，雨墙很大。随即回到门廊下，被屋檐挡住的视野里，斜雨扫过街道。少年抵住窗板；紧接着，岸边缆绳与浪水承受同样的力量。",
    "猛烈风声突然退去。街巷的屋顶有的坏了、有的还在，远处的人扶着木料。灾后的安静持续片刻，才切进写作的房间。纸上已有字，少年收笔，抬起笔尖，看着自己写下的东西。",
    "另一双眼睛在读他的文章。读者不说话，把钱袋推到旅行袋旁。下一镜，少年背着灰布袋走上船。摄影机留在岸上，等到他被船舷遮住，还看着空舷梯。最后半秒淡黑，交给第一幕。",
]

def make_markdown():
    lines=["# 离岛以前 · 开场 CG 图文生产方案 v6", "", "状态：待你审阅；尚未提交本批视频。", "",
           f"主方案：**11镜 / 68秒成片 / 138秒生成源素材 / {M['defaults']['resolution']} / 16:9 / 无声生成**。9段各12秒，S06与S07各15秒。E02与E06为替换备选，不进入自动生产。", "",
           "这是给剪辑与生成使用的工作脚本；下面的文字不进入画面，也不朗读。照料与资助的具体动作是戏剧化概括，不作为史料场景复刻。", "",
           "## 看完后的故事", ""]
    lines+=sum(([p,""] for p in SYNOPSIS),[])
    lines += ["## 生成规格与费用", "",
              f"默认 {M['defaults']['resolution']}，每镜仅上传对应的一张原始PNG，显式指定 first_frame，ratio=adaptive，generate_audio=false，MP4。固定镜头靠提示词与看片保证，不发送 camera_fixed、seed、draft 或 flex。", "",
              "已按你的选择准备720p，现价约¥208.66。费用按138秒源素材估算，不按68秒成片计算；720p不受1080p限时优惠结束影响。估算不含重生成、Codex用量或既有生图费，实际以返回usage和账号账单为准。", "",
              "720p预估tokens = 1280 × 720 × 24 × 138 ÷ 1024 = 2,980,800；费用 = 2.9808 × ¥70。1080p仅作比较：当前约¥371.82，2026年9月17日14:00优惠结束后约¥516.42，本批不会按1080p提交。关闭声音不按其他型号的无声折扣计费。详见[官方核实记录](官方接口核实.md)。", "",
              "每段多生成的余量供剪辑选择自然的动作与停顿；备选首帧没有隐藏在批次内，不额外生成试片。", "",
              "## 图文分镜与精确提示词", "",
              "源片取用区间是剪辑预案，尚无本批视频可实测。生成后我会依据实际动作落点和帧数微调入出点；不拉伸人物动作凑时长，也不未经同意重新付费。静态预演只能判断画面次序与停留时长，不能证明视频动作质量。", ""]
    for n,s in enumerate(SHOTS,1):
        e=s["edit"]
        prompt=(ROOT/s["prompt_file"]).read_text(encoding="utf-8").strip()
        lines += [f"### {n:02} · {s['id']} {s['title']} · {tc(e['start'])}–{tc(e['end'])}", "",
                  f"![{s['id']} 实际首帧]({s['first_frame']})", "",
                  f"**观众看见：**{s['scene']}", "",f"**这一镜的作用：**{s['beat']}。", "",
                  f"**生成 / 取用：**{s['duration']}秒源片；预取源{e['in']}–{e['out']}秒，成片用{e['end']-e['start']}秒。", "",
                  f"**摄影：**{s['camera']}", "",f"**剪切：**{s['cut']}", "",f"**声音（后期）：**{s['sound']}", "",
                  "**API将发送的完整提示词：**", "", "```text",prompt,"```", "",
                  "**验收：**"+"；".join(s["checks"])+"。", "",
                  f"首帧：`{s['first_frame']}`；提示词：`{s['prompt_file']}`。使用同账号原始图片字节，不重新压图。", ""]
    lines += ["## 整片剪辑与声音", "",
              "按24fps规划，成片1632帧。镜间全部硬切，不使用溶解、变形转场或数字推拉。S01→S02是相似构图下的时间跳跃；S02→S03以年龄和工作空间明确经过多年；风暴在商行段之后出现。", "",
              "37秒码头切灾后，以风雨声骤退建立另一时段；42秒进入写作。59秒旅行袋接登船，同款道具建立因果，不做照片间的精确形状变换。成片最后12帧在剪辑端淡黑，生成片段本身不带黑场。68秒后由现有第一幕流程接入，不额外堆叠字幕或片头。此轮不修改游戏播放入口。", "",
              "所有AI视频直接关闭音轨。后期只计划人工选择或录制的室内底声、滴水、风、浪、木件、笔纸和脚步，没有任何对白、独白、AI配音、歌声或配乐。声音表是待制作的声音脚本，本包没有伪装成已制作的音效。", "",
              "后期先核对720p源片实际时长、尺寸、帧率、是否含音轨与编码。保留模型原文件，如播放器兼容有问题，再另做播放副本，不把播放器解码问题算成生成失败。调色只做镜间曝光与白平衡衔接，不磨皮、不增金色、不重新烘焙文字。", "",
              "## 两张替换备选", ""]
    for s in M["alternates"]:
        lines += [f"**{s['id']} {s['title']} → 仅可替换{s['replaces']}。**不计入本批提交。", "", f"![备选{s['id']}]({s['file']})", ""]
    lines += ["## 我接下来如何执行", "",
              "你明确说“按v6开始生成”后，我先核对当前审阅指纹、费用有效期与原图，然后用现有本机Key顺序完成11镜的创建、查询和下载。你不需要复制提示词、上传首帧、运行代码或逐条下载。更改画质或镜头需要更新同一份计划并重新生成审阅指纹。", "",
              "后端默认不发请求。正式生成每次只处理一镜，完成下载再继续下一镜；这不是试拍流程，期间不逐镜向你确认。遇到输入审核拒绝、余额错误或任务失败，保存结果并停在该镜；遇到提交超时则保留未知状态，不猜测失败后重复付费。已有成功任务断点续用。", "",
              "当前准备状态与实际只读验证见[准备与验证记录](准备与验证记录.md)；程序操作见[后端说明](后端说明.md)。API支持关闭声音，与某些平台包装工具默认总生成声音的行为不同。", "",
              "数据链：原始首帧 + 当前提示词 → 审阅指纹 → 你明确下令 → 方舟任务ID → 本地源视频与用量记录 → 逐镜验收 → 按68秒时间线剪辑、声音和第一幕衔接。"]
    (ROOT/"图文脚本与生成方案.md").write_text("\n".join(lines)+"\n",encoding="utf-8")

def make_html():
    segments=[]; cards=[]; thumbnails=[]
    for n,s in enumerate(SHOTS,1):
        e=s["edit"]; length=e["end"]-e["start"]
        prompt=(ROOT/s["prompt_file"]).read_text(encoding="utf-8").strip()
        segments.append(f'<button type="button" class="segment {"env" if s["id"].startswith("E") else ""}" style="flex:{length}" data-seek="{e["start"]}" title="{h(s["title"])}，{length}秒">{s["id"]}<small>{length}s</small></button>')
        thumbnails.append(f'<a class="thumbnail" href="#shot-{s["id"]}"><img src="{s["first_frame"]}" loading="lazy" alt="{h(s["title"])}首帧"><span>{n:02} / {s["id"]} · {h(s["title"])}</span></a>')
        checks="".join(f"<li>{h(c)}</li>" for c in s["checks"])
        cards.append(f'''<article class="shot" id="shot-{s['id']}">
          <header><div class="eyebrow">{n:02} / {s['id']} · {tc(e['start'])}—{tc(e['end'])}</div><h2>{h(s['title'])}</h2><p class="beat">{h(s['beat'])}</p></header>
          <div class="shot-grid"><a class="frame-link" href="{s['first_frame']}" target="_blank"><img src="{s['first_frame']}" loading="lazy" alt="{h(s['title'])}：实际将上传的原始首帧"><span>实际首帧 · 2560 × 1440 · 点击查看原图</span></a>
          <div class="shot-text"><p class="scene">{h(s['scene'])}</p><dl><dt>生成 / 取用</dt><dd>{s['duration']}秒源片 → 预取{e['in']}–{e['out']}秒 → 成片{length}秒</dd><dt>摄影</dt><dd>{h(s['camera'])}</dd><dt>剪切</dt><dd>{h(s['cut'])}</dd><dt>声音 · 后期制作</dt><dd>{h(s['sound'])}</dd></dl></div></div>
          <div class="prompt-header"><h3>这一镜的完整生成提示词</h3><button type="button" class="copy" data-copy="prompt-{s['id']}">复制提示词</button><a href="{s['prompt_file']}" target="_blank">打开 TXT</a></div>
          <textarea class="prompt" id="prompt-{s['id']}" readonly spellcheck="false" aria-label="{s['id']}完整视频提示词">{h(prompt)}</textarea>
          <details class="checks"><summary>看片验收 · {len(s['checks'])}个具体条件</summary><ul>{checks}</ul></details>
        </article>''')
    alternatives="".join(f'<figure><a href="{s["file"]}" target="_blank"><img src="{s["file"]}" loading="lazy" alt="备选{s["id"]}"></a><figcaption>{s["id"]} · {h(s["title"])}<br><small>只替换 {s["replaces"]}，不进入本批生成</small></figcaption></figure>' for s in M["alternates"])
    synopsis="".join(f"<p>{h(p)}</p>" for p in SYNOPSIS)
    js_data=json.dumps([{"id":s["id"],"title":s["title"],"beat":s["beat"],"image":s["first_frame"],"scene":s["scene"],**s["edit"]} for s in SHOTS],ensure_ascii=False).replace("<","\\u003c")
    page='''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>离岛以前 · CG 完整生产方案 v6</title><style>
    :root{color-scheme:light;--ink:#252a29;--muted:#626b68;--line:#ccd1cb;--paper:#f1f0e9;--accent:#365c58;--env:#687969}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.75 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}a{color:var(--accent);text-underline-offset:4px}button,input,textarea{font:inherit}button{cursor:pointer;border:1px solid var(--line);border-radius:4px;background:#fffdf6;color:var(--ink);padding:8px 15px}button:focus-visible,a:focus-visible,input:focus-visible{outline:3px solid #518bc0;outline-offset:3px}.wrap{max-width:1320px;margin:auto;padding:38px 44px 80px}.masthead{border-bottom:1px solid var(--line);padding-bottom:24px}.eyebrow{letter-spacing:.12em;color:var(--muted);font-size:12px}h1{font-size:clamp(32px,5vw,60px);line-height:1.18;font-weight:560;margin:17px 0}h2{font-size:28px;line-height:1.35;margin:12px 0}h3{font-size:17px;margin:0}.lede{max-width:800px;font-size:19px}.badges{display:flex;gap:8px;flex-wrap:wrap}.badges span{border:1px solid var(--line);padding:3px 10px;border-radius:3px;font-size:13px}.notice{background:#e3e8e1;padding:20px 24px;margin:24px 0;border-left:3px solid var(--accent)}.notice p{margin:4px 0}.notice small,.muted{color:var(--muted);font-size:13px}.nav{display:flex;gap:24px;flex-wrap:wrap;font-size:14px;margin:25px 0}.section{margin-top:50px}.section-intro{max-width:850px}.preview-stage{background:#161c1c}.preview-stage img{width:100%;aspect-ratio:16/9;display:block;object-fit:contain}.preview-meta{display:grid;grid-template-columns:140px 1fr;gap:20px;border:1px solid var(--line);padding:15px 20px;min-height:96px}.time{font-variant-numeric:tabular-nums;font-size:23px;font-weight:550}.preview-meta p{margin:0;font-size:14px;color:var(--muted)}.controls{display:flex;gap:12px;align-items:center;margin:15px 0}.controls input{flex:1;accent-color:var(--accent);min-width:50px}.timeline{display:flex;gap:3px}.segment{min-width:0;padding:8px 0;background:#cdd5cf;border:0;border-radius:2px;font-size:12px}.segment.env{background:#aebfb5}.segment small{display:block;font-size:11px;opacity:.7}.segment.active{background:var(--accent);color:white}.synopsis{columns:2;column-gap:38px}.synopsis p{margin:0 0 18px;break-inside:avoid}.thumbnails{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.thumbnail{text-decoration:none;font-size:12px}.thumbnail img{width:100%;aspect-ratio:16/9;object-fit:contain;display:block}.thumbnail span{display:block;margin-top:5px}.shot{scroll-margin-top:20px;margin-top:64px;border-top:1px solid var(--line);padding-top:24px}.shot header{margin-bottom:22px}.beat{margin:0;color:var(--accent)}.shot-grid{display:grid;grid-template-columns:1.3fr 1fr;gap:28px;align-items:start}.frame-link{display:block;font-size:12px;color:var(--muted);text-decoration:none}.frame-link img{width:100%;display:block}.frame-link span{display:block;margin-top:8px}.scene{font-size:17px;margin-top:0}dl{margin:15px 0 0}dt{font-size:12px;color:var(--muted);margin-top:12px}dd{font-size:14px;margin:1px 0}.prompt-header{display:flex;align-items:center;gap:16px;margin:22px 0 10px}.prompt-header h3{margin-right:auto}.prompt-header a{font-size:13px}.copy{font-size:13px;padding:5px 11px}.prompt{display:block;width:100%;height:300px;resize:vertical;border:1px solid var(--line);background:#faf9f2;color:var(--ink);padding:18px;font-size:14px;line-height:1.8;border-radius:2px}.checks{margin-top:14px;font-size:14px}.checks summary{cursor:pointer}.checks ul{margin:12px 0}.alternatives{display:grid;grid-template-columns:1fr 1fr;gap:24px}.alternatives figure{margin:0}.alternatives img{width:100%;display:block}.alternatives figcaption{margin-top:10px}.alternatives small{color:var(--muted)}.workflow{display:grid;grid-template-columns:1fr 1fr;gap:40px}.workflow p{margin-top:0}.footer{margin-top:55px;border-top:1px solid var(--line);padding-top:20px;font-size:13px;color:var(--muted)}@media(max-width:800px){.wrap{padding:25px 18px 50px}.shot-grid,.workflow{grid-template-columns:1fr}.synopsis{columns:1}.thumbnails{grid-template-columns:repeat(2,1fr)}.preview-meta{grid-template-columns:1fr;gap:5px}.alternatives{grid-template-columns:1fr}.prompt-header{flex-wrap:wrap;gap:8px}.prompt-header h3{width:100%}.controls{gap:7px}.controls button{padding:7px 10px;font-size:13px}.segment{font-size:10px}.segment small{font-size:9px}}@media print{.controls,.timeline,.nav,.copy{display:none}.wrap{max-width:none;padding:0}.shot{break-before:page}.shot-grid{grid-template-columns:1fr 1fr}.prompt{height:auto;min-height:310px;font-size:11px}.preview-stage{display:none}.thumbnails{grid-template-columns:repeat(4,1fr)}}
    </style></head><body><main class="wrap"><header class="masthead"><div class="eyebrow">HAMILTON / ACT I PROLOGUE / PRODUCTION v6</div><h1>离岛以前</h1><p class="lede">从床边的一只碗，走到岸边的一架空梯。风暴发生在两者之间，也发生在整个岛上。</p><div class="badges"><span>11 个正式镜头</span><span>成片 68 秒</span><span>源素材 138 秒</span><span>Seedance 2.5 · RESOLUTION</span><span>16:9 · 无声生成</span><span>待审阅 · 本批未提交</span></div></header>
    <div class="notice"><p><strong>已按你的选择准备720p。先看这一版，再下令生成。</strong>你不需要逐镜上传、复制提示词或下载，我会用已配置的方舟后端执行。</p><p>本批现价预估 <strong>¥208.66</strong>，输出1280 × 720。720p不参与1080p的限时优惠，报价不因该优惠到期而变化。</p><small>按138秒源素材、首帧输入和公开单价估算；实际以usage和账单为准。备选图不自动生视频，未包含重生成、Codex用量或此前生图费。1080p仅作比较：目前约¥372，9月17日14:00优惠结束后约¥516。<a href="官方接口核实.md">价格与接口依据</a></small></div>
    <nav class="nav"><a href="#preview">68秒静态预演</a><a href="#story">完整故事</a><a href="#index">11镜图文脚本</a><a href="#alternates">替换备选</a><a href="#execution">下令后怎样执行</a><a href="图文脚本与生成方案.md">完整文字版</a></nav>
    <section class="section" id="preview"><div class="eyebrow">01 / WATCH THE CUT</div><h2>先看整段的次序与停留</h2><p class="section-intro">这是<strong>首帧静态预演</strong>：按成片68秒的时长硬切图片，没有伪造运动或声音。它帮助判断剪辑结构；实际动作、空床停顿和空梯尾段仍以生成后的视频为准。</p><div class="preview-stage"><img id="preview-image" src="firstframes/S01.png" alt="S01 照料母亲的首帧"></div><div class="preview-meta"><div class="time" id="time">00:00 / 01:08</div><div><strong id="preview-title">S01 · 照料母亲</strong><p id="preview-beat">还能够照料她</p></div></div><div class="controls"><button type="button" id="play">播放静态预演</button><button type="button" id="restart">回到开头</button><input id="scrub" type="range" min="0" max="68" step="0.1" value="0" aria-label="预演时间"><a id="detail-link" href="#shot-S01">看当前分镜</a></div><div class="timeline">SEGMENTS</div><p class="muted">绿色较深的四段是环境镜头，共18秒。可点时间轴直接跳转。所有说明文字都在画面外，不进入最终CG。</p></section>
    <section class="section" id="story"><div class="eyebrow">02 / THE FILM</div><h2>剪完之后，观众会看见什么</h2><div class="synopsis">SYNOPSIS</div><p class="muted">本版将音乐剧开头的经历作无对白的戏剧化概括。母亲离世和后来的风暴由年龄及商行场景隔开，避免误读为同一天。</p></section>
    <section class="section" id="index"><div class="eyebrow">03 / SHOT BY SHOT</div><h2>实际首帧、动作与剪切</h2><p class="section-intro">下列首帧将逐张原样上传。每镜只有一个主要动作；源片入出点是剪辑预案，生成后按实际动作落点微调。完整提示词就在每张图下面，与API读取的TXT文件一致。</p><div class="thumbnails">THUMBNAILS</div>CARDS</section>
    <section class="section" id="alternates"><div class="eyebrow">04 / ALTERNATES</div><h2>两张候选，只做替换</h2><p>换E01会让海湾居民点更具体；换E05会把灾后重点转向生计。当前11镜批次不包含这两张。</p><div class="alternatives">ALTERNATIVES</div></section>
    <section class="section" id="execution"><div class="eyebrow">05 / READY FOR YOUR CUE</div><h2>你下令之后，我来执行</h2><div class="workflow"><div><p><strong>一句“按v6开始生成”，对应这一整批。</strong>我先复核方案指纹与当前报价，然后依次提交11镜，自动查询并下载原视频。不再追加试片，不逐镜让你操作。</p><p>每次只处理一个任务，成功下载后继续下一镜。中断后按任务ID恢复；审核拒绝或提交结果不明时停住，不盲目重复付费。</p><p><a href="准备与验证记录.md">查看实际准备与验证状态</a> · <a href="后端说明.md">后端操作说明</a></p></div><div><p><strong>生成后还有一次真正的看片与剪辑。</strong>先检查手、道具、雨水、脚步和空镜，再按68秒时间线选入出点；最后12帧在剪辑端淡黑。原视频保留，剪辑不向人物加数字推拉。</p><p>本批视频关闭全部声音。后期仅使用选取或录制的环境声与拟音，没有配音、对白、歌唱或配乐。本页是声音脚本，尚未制作音效。按720p实际输出检查尺寸、帧率、编码与音轨，再制作播放版本。</p><p><a href="edit-decision-list.csv">下载剪辑表 CSV</a> · <a href="manifest.json">查看当前批次清单</a></p></div></div></section>
    <footer class="footer">原始首帧 + 精确提示词 → 审阅指纹 → 你明确下令 → 任务与源视频 → 验收 → 68秒剪辑与第一幕衔接。<br>制作方案 v6 · 2026-09-11 · 本页面不包含密钥，也不会调用生成接口。</footer></main>
    <script>const shots=SHOTDATA;const total=68;let time=0,playing=false,lastTick=null,active=-1;const byId=id=>document.getElementById(id);const format=s=>String(Math.floor(s/60)).padStart(2,'0')+':'+String(Math.floor(s%60)).padStart(2,'0');const images=shots.map(s=>{const i=new Image();i.src=s.image;return i});function render(){let idx=shots.findIndex(s=>time>=s.start&&time<s.end);if(idx<0)idx=shots.length-1;const s=shots[idx];if(idx!==active){active=idx;byId('preview-image').src=s.image;byId('preview-image').alt=s.id+' '+s.title+'的静态首帧';byId('preview-title').textContent=s.id+' · '+s.title;byId('preview-beat').textContent=s.beat;byId('detail-link').href='#shot-'+s.id;document.querySelectorAll('.segment').forEach((b,i)=>b.classList.toggle('active',i===idx))}byId('time').textContent=format(time)+' / 01:08';byId('scrub').value=time;byId('play').textContent=playing?'暂停预演':(time>=total?'重新播放':'播放静态预演')}function tick(stamp){if(playing){if(lastTick!==null)time=Math.min(total,time+(stamp-lastTick)/1000);lastTick=stamp;if(time>=total){playing=false;lastTick=null}render()}requestAnimationFrame(tick)}byId('play').addEventListener('click',()=>{if(time>=total)time=0;playing=!playing;lastTick=null;render()});byId('restart').addEventListener('click',()=>{time=0;playing=false;lastTick=null;render()});byId('scrub').addEventListener('input',e=>{time=Number(e.target.value);lastTick=null;render()});document.querySelectorAll('[data-seek]').forEach(b=>b.addEventListener('click',()=>{time=Number(b.dataset.seek);lastTick=null;render()}));document.addEventListener('visibilitychange',()=>{if(document.hidden){playing=false;lastTick=null;render()}});document.querySelectorAll('[data-copy]').forEach(b=>b.addEventListener('click',async()=>{const input=byId(b.dataset.copy);try{await navigator.clipboard.writeText(input.value);b.textContent='已复制'}catch(e){input.focus();input.select();b.textContent='已选中，可复制'}setTimeout(()=>b.textContent='复制提示词',2200)}));render();requestAnimationFrame(tick);</script></body></html>'''
    for key,value in {"RESOLUTION":h(M["defaults"]["resolution"]),"SEGMENTS":"".join(segments),"SYNOPSIS":synopsis,"THUMBNAILS":"".join(thumbnails),"CARDS":"".join(cards),"ALTERNATIVES":alternatives,"SHOTDATA":js_data}.items():
        page=page.replace(key,value)
    (ROOT/"完整CG方案.html").write_text(page,encoding="utf-8")

if __name__=="__main__":
    make_markdown()
    make_html()
    print("Wrote offline illustrated script and 68-second static preview; no network.")
