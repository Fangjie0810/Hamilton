#!/usr/bin/env python3
"""Build the reviewed production inputs from selected Ark originals; no network."""
import csv
import hashlib
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent
ART = ROOT.parent

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

COMMON = """{duration}秒，单个连续镜头，横向历史实景电影画面。从输入首帧的准确状态继续，保持原有空间、人物面容与年龄、头发、衣服、道具、自然光、湿度、色彩和颗粒。{camera}动作按真实速度发生，光线不突然变亮；保留旧房间与物件实际使用后的磨损，不增加舞台灯、金色滤镜、油画笔触、柔光美颜或装饰性烟雾。

{action}

{restrictions}整个片段内不切镜、不转场、不变焦、不突然拉焦、不慢动作；物件不凭空增减、穿透或变形。人物不看镜头、不作夸张表情。不出现对白、独白、配音、歌唱、口型表演、音乐、音效或字幕；输出无声。保留现有微小自然变化，不将尾段冻结为静帧。开头和结尾都不淡入淡出、不加黑场或片头片尾。"""

SHOTS = [
    dict(id="S01", title="照料母亲", duration=12, take=[1,6],
         beat="还能够照料她", scene="狭窄的房间里，孩子把碗放到母亲床边。母亲没有回应，只有很轻的呼吸。这个动作熟练、安静，像已经重复过许多次。",
         camera="摄影机完全固定，保持首帧的侧面中景、镜头高度和景深。",
         action="0–1秒：延续首帧弯身托碗的姿态，母亲仍斜靠床上。\n1–4秒：孩子把现有陶碗和搭在碗沿的湿布一起缓慢落到眼前木凳上，碗底先接触凳面。\n4–6秒：双手轻轻松开，停在碗旁；母亲不伸手接碗。\n6–12秒：孩子安静停留，母亲只作微小自然呼吸，房间没有新的事件。",
         restrictions="陶碗、湿布与木凳保持一一对应，不新增物件。",
         cut="从已经在进行的动作进入，不放标题。碗放稳、手稍停后，硬切同方向的空床画面。",
         sound="后期只铺很低的室内底声；碗触木凳一次轻响。没有可辨识的人声或喘息表演。",
         checks=["母亲始终在床上，未变换身份", "碗底真实落凳，手没有穿进碗里", "安静停顿至少能取用1秒"]),
    dict(id="S02", title="空床", duration=12, take=[4,9],
         beat="动作还在，接受照料的人已不在", scene="几乎相同的房间里，床上已经没有母亲。切进来时孩子的手正离开碗，随后面对空床停住。观众通过缺席理解失去，不用死亡表演。",
         camera="摄影机完全固定，保持首帧构图和景深，不向空床推进。",
         action="0–2秒：孩子仍托着首帧中已有的陶碗与湿布，床一直空着。\n2–4秒：沿眼前最短路径将陶碗和原有湿布一起放稳在木凳面上。\n4–5秒：双手松开并停在近处，湿布自然保持搭在碗沿的原状。\n5–12秒：孩子目光低垂，手和身体安静停留；薄被与床铺保持空置。",
         restrictions="右侧空床全程不出现人、人体轮廓或新隆起；不让母亲在镜头中消失。",
         cut="取放稳后的松手与空床停顿，避免重复演示完整放碗。采用相似构图作联想剪辑，不做变形过渡；空床被看见之后直接切已长大的少年。",
         sound="沿用同一室内底声；此处碗响更轻。环境声不中断，不插悲伤音效。",
         checks=["床全程为空", "首帧持碗状态没有跳成空手", "动作结束后留出明确的空床阅读时间"]),
    dict(id="S03", title="商行谋生", duration=12, take=[1,8],
         beat="少年已经靠劳动维持生活", scene="时间跳过去，孩子已长成少年。在漏雨的商行，他先把账册护到干处。动作表现责任与生计，远处滴水让坏天气先从生活中出现。",
         camera="摄影机完全固定，保持首帧中景、朝向和景深。",
         action="0–1秒：延续抱住近乎竖直账册的姿势。\n1–5秒：少年把账册下缘缓慢落到紧邻的干燥空架面上，账册保持近乎竖直，一只手始终扶稳。\n5–12秒：继续扶住账册并停顿，身体保持原朝向；原有屋顶滴水断续落入旁边的木桶。",
         restrictions="账册不旋转放平、不翻页、不撒手；少年不转身或重新抓取。书架的干燥处保持干燥。",
         cut="从孩子的手切到少年扶账册的手，身形和工作场所交代多年过去。在扶稳之后切远海，扩大风雨的空间。",
         sound="木桶接水和木架轻响；成片16.3秒起提前引入低沉风声，接17秒鸟瞰。",
         checks=["账册下缘和架面真实接触", "扶册手没有完全松开", "成年少年与童年段有可辨识年龄差"]),
    dict(id="E01", title="远海雨墙 · 群岛鸟瞰", duration=12, take=[2,6],
         beat="第一次看见整个岛的处境", scene="从逼仄商行骤然来到远海。低岛被灰色海水围住，远处雨墙压低了能见度。画面看得很远，却不给观众游览风景的舒适感。",
         camera="保持首帧的鸟瞰方向、高度与俯角，仅作极慢、单一方向的小幅向前平移，12秒内画面位移很小。",
         action="0–4秒：海面原有白浪不规则地起伏，远处雨墙缓慢移动。\n4–8秒：一小段远处岛脊逐渐被雨雾削弱，近岛的海岸轮廓仍保持可辨。\n8–12秒：继续同一方向的极慢观察，天气自然延续，不发生新的灾难事件。",
         restrictions="不环绕、不俯冲、不升降，不改变海岸线；不出现卫星视角、暴风眼、闪电表演或现代建筑。",
         cut="商行硬切鸟瞰，4秒内建立尺度；随后立刻降回门廊地面，整片不再反复航拍。",
         sound="宽阔、低沉的风和远海底声，没有航拍器声。音量不冲击式拔高。",
         checks=["海岸线与岛屿数量稳定", "移动极慢且单向，没有环绕", "雨墙没有变成可见实体墙或海啸"]),
    dict(id="E03", title="门廊下的雨街", duration=12, take=[2,7],
         beat="观众站在一个能避雨的地方", scene="黑暗的近处屋檐压在头顶，街巷被斜雨遮住。近处檐水断断续续，远处蕉叶受风。摄影机留在门廊里，任风雨发生。",
         camera="摄影机完全固定在首帧门廊下，保持高度、朝向和前景屋檐的遮挡。",
         action="0–4秒：屋檐近处落水与街道斜雨以不同节奏持续，远处蕉叶朝同一受风方向伏动。\n4–8秒：一阵稍密的斜雨掠过街道，泥水沿原地势流动，门窗和屋顶保持原位。\n8–12秒：雨势自然回到此前强度，檐水仍断续落下。",
         restrictions="不晃镜模拟纪实，不走出门廊，不新增人物、波纹金属板或现代路面，不发生坍塌。",
         cut="鸟瞰后硬切屋檐遮挡，观众的观看位置变得具体。斜雨持续时切少年抵窗，风声保持连续。",
         sound="近处檐水清楚、远处风声较闷；剪到室内时高频雨声被窗墙遮掉。",
         checks=["前景檐柱和街巷结构不漂移", "修正后的旧木板未变回金属片", "雨与蕉叶的受风方向一致"]),
    dict(id="S04", title="风压", duration=12, take=[1,8],
         beat="整场风灾落到一双手上", scene="回到室内，少年把还悬着的左掌补到窗板上。一阵风压让肘部稍退，他顶住。动作很小，重量来自前面的雨街和海面。",
         camera="摄影机完全固定，保持首帧的背侧中景与景深。",
         action="0–1秒：右掌持续贴住首帧中的实木窗板，左掌仍在原来的附近位置。\n1–3秒：左掌向同一窗扇邻近的实木部位短距离靠近并贴稳。\n3–5秒：仅一次风压让窗板、双肘和上身有微小受力变化；两只手保持接触，没有松开。\n5–12秒：少年回稳并继续抵住窗板，原有窗缝的雨持续。",
         restrictions="不把窗缝完全关死、不抬窗板、不换手、不新增脚步，不让窗户爆裂或人物被风吹飞。",
         cut="雨街的斜雨接到窗缝；窗板受压后切缆绳与水，同一股力量从身体延伸至港口。",
         sound="木窗低哑吱声只出现一次；室内风声闷，不加入呼喊或重击配乐。",
         checks=["左手从悬空到贴木板的路径连贯", "右掌持续接触，窗扇没有复制", "一次压力后回稳，不反复弹跳"]),
    dict(id="E04", title="风压下的旧码头", duration=12, take=[3,7],
         beat="房间外还有整个港口在受力", scene="低机位贴着湿石岸。浪越过边缘，缆绳绷紧，水又退去。我们看见一小块真实物件如何受力，而不是一张灾难海报。",
         camera="摄影机完全固定在首帧低机位，保持系缆柱、前景绳索和岸沿的构图。",
         action="0–3秒：原有近岸水面起伏，一次普通风浪逐渐接近石岸。\n3–5秒：这一小股浪水越过岸沿，已有缆绳只轻微绷紧。\n5–7秒：水沿石面自然退回，缆绳压力稍缓。\n7–12秒：继续不规则的小幅水面起伏，不再安排第二次显著冲击。",
         restrictions="不生成巨浪、海啸、船只撞击或断绳，不增加轮胎、现代防波设施或人物。",
         cut="接窗板的受力，4秒取到浪上岸及退水。37秒硬切灾后，风雨声在切点迅速收掉。",
         sound="绳索低响、一次浪水上石与回流；切灾后时只保留约0.25秒退水尾声。",
         checks=["浪的尺度普通且与岸沿一致", "水真实流回海里", "绳索与系缆柱连接不变，没有重复冲击"]),
    dict(id="E05", title="雨停后的街巷", duration=12, take=[2,7],
         beat="灾难结束，生活留下损失", scene="同一类港镇街巷已经安静。有人家的屋顶坏了一角，有人家仍能住。远处两个人扶着木料，近处泥水和倒伏的树占据画面。没有人为镜头表演悲惨。",
         camera="摄影机完全固定在当前地面视角，保持全景、遮挡和景深。",
         action="0–4秒：灰阴的灾后白昼，屋檐偶尔滴水，地面积水有很小的自然波纹。\n4–8秒：极远处原有的两个人只略微调整握力，稳住他们已经扶着的同一根木料；身体位置变化极小。\n8–12秒：他们继续扶稳木料，街巷安静，偶有滴水，不出现新的事件。",
         restrictions="不安排完整搬运动作、不新增人群、不继续坍塌，不让雨停后立刻出现金色阳光或英雄姿态。",
         cut="用风声的骤退标明时间跳跃，不做渐变天气。安静停留5秒后切桌前，窗光自然变亮但不变暖金。",
         sound="稀疏滴水、很远的木料轻碰；41.5秒提前入下一镜的室内底声与滴水，笔尖摩擦只对齐S05实际可见的收笔。",
         checks=["房屋破损程度维持原图，不全部夷平", "远处两人和木料数量、位置稳定", "灾后没有恢复为暴雨镜头"]),
    dict(id="S05", title="自己的文字", duration=12, take=[1,8],
         beat="他把经历变成了文字", scene="纸上已经有几行细小笔迹。少年只把最后一点笔势收住，抬笔，停看。我们关注他写完之后的停顿，文字不承担需要读懂的内容。",
         camera="摄影机完全固定，保持首帧桌边背侧中近景，不靠近纸面、不拉焦到字。",
         action="0–1秒：延续首帧握笔与左手压纸的准确姿势，纸面已有笔迹保持原样。\n1–2秒：右手只作一次极短的收笔，笔尖位置保持在原有局部遮挡附近，不写出新的单词或整行。\n2–3秒：笔尖稍稍离开纸面。\n3–12秒：少年安静看着纸，左手继续压住同一纸角；纸、墨罐和桌面都不移动。",
         restrictions="不从白纸开始写字、不出现粗杠、不增加滚动字符、不蘸墨、不翻页，不试图展示可辨读的英文句子。",
         cut="从灾后的环境后果切入写完的纸。目光停住后切另一个人阅读，建立文章被看见的关系。",
         sound="只在收笔处一点笔尖摩擦，之后是安静室内底声；没有把文字念出来的声音。",
         checks=["已有细字不变成爬动符号或粗线", "只收笔一次，随后笔尖离纸", "脸、手、纸与墨罐不漂移"]),
    dict(id="S06", title="文章获得支持", duration=15, take=[2,12],
         beat="有人愿意让他离开这里", scene="一个成年读者继续看信。他没有开口，也没有抬头赞许，只把桌上的钱袋推到旅行袋旁。纸与路费在同一个画面里，支持因此变得具体。",
         camera="摄影机完全固定，保持首帧读者、钱袋与旅行袋同时可见的构图和景深。",
         action="0–4秒：读者左手一直拿着原有信纸，空白背面朝摄影机，安静阅读；右手仍握着桌上的原有钱袋。\n4–7秒：右手把钱袋沿桌面向画面左侧的旅行袋旁缓慢滑动一小段，袋底全程接触桌面。\n7–9秒：右手放松手指并停住，左手保持持信。\n9–15秒：钱袋留在靠近旅行袋的位置，读者继续看纸，保持安静。",
         restrictions="不翻信纸、不放信纸、不新增钱袋或散落金币，不开合旅行袋，不让其他人物进入。",
         cut="纸的阅读接住上一镜写作；钱袋推近旅行袋后再停留。59秒直接切少年身上的单只补丁袋与舷梯。",
         sound="轻微纸响、布袋擦木面；57.8秒先入平静港口水声，预告离岛。",
         checks=["左手持纸始终不换手、不放下", "钱袋沿桌面短移，不提起掉落", "钱袋与旅行袋全程各一只"]),
    dict(id="S07", title="登船离开", duration=15, take=[2,11],
         beat="他走出了画面，未来留在画外", scene="少年背着那一只灰布袋，继续沿木梯上船。摄影机留在岸上。他被船舷开口遮住之后，空梯子和水还在。最后一点等待交给第一幕。",
         camera="摄影机完全固定在首帧岸上背侧视角，不跟拍、不推进、不向天空抬镜。",
         action="0–1秒：从首帧已有一只脚踩上舷梯的状态继续，重心自然移向这一脚。\n1–8秒：少年以正常而从容的步伐沿现有木舷梯上行，进入原有船舷开口；每一步脚底接触木板，单只旅行袋随步伐小幅摆动。到8秒左右，身体被船舷和开口自然遮住，离开视野。\n8–15秒：保持空舷梯与原船体构图，水面仍有微小流动，少年不重新出现。",
         restrictions="不增加第二件行李、不更改肩带与补丁，不回头、不跳跃，不加人，不让人物融化或瞬移，不使船、岸或梯子移动。",
         cut="从钱袋旁的旅行袋接到少年携带的布袋，采用道具联想而非袋子特写变形。取到人物离画后约3秒空梯。成片最后12帧由剪辑淡黑，68秒交给第一幕入口。",
         sound="几次克制的木板脚步与平静水声；人离画后脚步消失，最后0.5秒水声随画面退去。",
         checks=["每步落在原木梯上，人物被船体遮挡后离画", "只保留一只灰色补丁旅行袋", "可用段末尾至少2秒空梯，没有模型自动黑场"]),
]

def main():
    if (ROOT / "review-lock.json").exists():
        raise SystemExit("Review lock exists: deliberately review changes before rebuilding production inputs.")
    character = json.loads((ART/"cg-ark-firstframes-v4/firstframes-manifest.json").read_text())
    environment = json.loads((ART/"cg-environments-v5/environment-manifest.json").read_text())
    sources = {s["id"]: (ART/"cg-ark-firstframes-v4", s) for s in character["shots"]}
    sources.update({s["id"]: (ART/"cg-environments-v5",s) for s in environment["shots"]})
    for sub in ("firstframes", "prompts", "alternates"):
        (ROOT/sub).mkdir(parents=True,exist_ok=True)
    shots=[]
    cursor=0
    for source in SHOTS:
        s=dict(source)
        sid=s["id"]
        folder, info=sources[sid]
        src=folder/info["file"]
        if sha(src)!=info["sha256"]:
            raise SystemExit(sid+" original hash mismatch")
        target=ROOT/"firstframes"/(sid+".png")
        shutil.copyfile(src,target)
        prompt=COMMON.format(**s).strip()+"\n"
        prompt_path=ROOT/"prompts"/(sid+".txt")
        prompt_path.write_text(prompt,encoding="utf-8")
        a,b=s.pop("take")
        s.update(first_frame="firstframes/"+sid+".png",first_frame_sha256=sha(target),
                 prompt_file="prompts/"+sid+".txt",prompt_sha256=sha(prompt_path),
                 edit={"in":a,"out":b,"start":cursor,"end":cursor+b-a},
                 source_origin=info["origin"], source_image_model=info["model"],
                 original_bytes_preserved=True,first_frame_size=[2560,1440])
        cursor+=b-a
        shots.append(s)
    alternates=[]
    for sid,replaces in (("E02","E01"),("E06","E05")):
        folder,info=sources[sid]
        path=ROOT/"alternates"/(sid+".png")
        shutil.copyfile(folder/info["file"],path)
        alternates.append({"id":sid,"title":info["title"],"replaces":replaces,
                           "file":"alternates/"+sid+".png","sha256":sha(path),"submitted_in_this_plan":False})
    manifest={
        "version":6,"date":"2026-09-11","title":"离岛以前 · Hamilton 第一幕前 CG",
        "status":"prepared_for_user_review","video_submission_authorized":False,
        "defaults":{"model":"doubao-seedance-2-5-260628","resolution":"720p","ratio":"adaptive","generate_audio":False,"output_format":"mp4"},
        "source_duration_seconds":sum(s["duration"] for s in shots),"target_edit_duration_seconds":cursor,
        "edit_fps":24,"final_fade_seconds":0.5,"batch_concurrency":1,
        "edit_ranges_status":"proposed_until_generated_video_review",
        "pricing":{"currency":"CNY","basis":"input_has_no_video","estimated_fps":24,
            "width":1280,"height":720,"estimated_output_tokens":2980800,
            "price_per_million_tokens":70,"estimated_total":208.66,
            "regular_price_per_million_tokens":70,"estimated_regular_total":208.66,
            "alternative_1080p_estimated_total":371.82,
            "alternative_1080p_regular_total":516.42,
            "alternative_1080p_discount_until":"2026-09-17T14:00:00+08:00",
            "source":"https://ark.volcengine.com/region:cn-beijing/docs/82379/1544106?lang=zh",
            "note":"用户已选择720p。按首帧输入、24fps和计划时长估算；实际以返回usage与账单为准。720p不参与1080p限时优惠；执行前核价。未含重生成、Codex用量或既有生图费。"},
        "shots":shots,"alternates":alternates,
        "authorization_note":"审阅方案不代表提交；仅在用户随后明确要求按本版生成时，由代理运行带当前计划指纹的执行命令。",
    }
    (ROOT/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    with (ROOT/"edit-decision-list.csv").open("w",encoding="utf-8-sig",newline="") as f:
        writer=csv.writer(f)
        writer.writerow(["order","shot_id","title","source_duration_s","source_in_s_proposed","source_out_s_proposed","timeline_start_s","timeline_end_s","take_duration_s"])
        for n,s in enumerate(shots,1):
            e=s["edit"]
            writer.writerow([n,s["id"],s["title"],s["duration"],e["in"],e["out"],e["start"],e["end"],e["end"]-e["start"]])
    print("Prepared %d original frames, %ds sources, %ds proposed edit; no network."%(len(shots),manifest["source_duration_seconds"],cursor))

if __name__=="__main__":
    main()
