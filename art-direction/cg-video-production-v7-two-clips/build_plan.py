#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Prepare two multi-reference video requests. Offline; never generates videos."""
import csv
import hashlib
import json
from pathlib import Path
import shutil

ROOT=Path(__file__).resolve().parent
ART=ROOT.parent
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

A=[
 dict(id="S01",title="照料",start=0,end=3,reference_index=1,
      story="孩子把碗放到仍在床上的母亲身边。",camera="沿用床边侧面中景，固定机位。",
      motion="从@图片1孩子已经弯腰托碗的状态开始。前约2秒把碗和原有湿布一起沿最短路径放到木凳，接触凳面后才松手；余下时间稍停。母亲一直斜靠床上，只保留轻微呼吸，不伸手接碗。"),
 dict(id="N02",title="无人空窗与空凳",start=3,end=5,reference_index=2,
      story="另一时刻，房间已无人；空窗和空凳只停留2秒。",camera="固定机位，空窗和空凳同时可见。",
      motion="在第3秒明确硬切到@图片2的无人房间，这是另一个时刻。镜头一开始就已经无人：只看空窗、凳面完全空着的木凳及原有房间，窗外叶子极轻微地动。全程没有主角、母亲、身体、倒影、陶碗或湿布。不从@图片1带入人物或手持物，不演人消失，也不让上一镜的人走出画面来完成转场。第5秒直接切走。"),
 dict(id="S03",title="商行劳动",start=5,end=9,reference_index=3,
      story="多年后，少年在漏雨商行护住账册。",camera="商行侧面中景，固定机位。",
      motion="第5秒硬切到@图片3。孩子已经长成该图中的瘦削少年，年龄变化只发生在切镜之间。少年将怀里近乎竖直的账册下缘落到邻近干燥架面，一手一直扶稳，然后停住。原有滴水落入木桶。账册不放平、不翻页，少年不转身。"),
 dict(id="S04",title="抵住风压",start=9,end=13,reference_index=4,
      story="少年用手和身体承受一次窗板的风压。",camera="窗边背侧中景，固定机位。",
      motion="第9秒硬切到@图片4的风雨中窗边。同一少年右掌已经贴着实木窗板，左掌还在附近。左手只短距离补到邻近实木处，两手贴稳后承受一次很小的风压：肘部和上身微微后让、再回稳。窗缝继续进雨。没有新增脚步，不关死整个窗缝，不让窗户爆裂。"),
 dict(id="S05",title="收笔",start=13,end=17,reference_index=5,
      story="风灾之后，纸上已有文字；少年收笔并停看。",camera="桌边背侧中近景，固定机位，纸面不做特写。",
      motion="第13秒硬切到@图片5，明确是雨停后的另一个白昼，窗外已没有暴雨。纸上原有几行细笔迹保留。少年只做一次极短收笔，稍抬笔尖，然后安静看纸约2秒。左手一直压纸角。不从白纸写起，不新增词句、整行或粗杠，不蘸墨、不翻页。"),
 dict(id="S06",title="读者资助",start=17,end=23,reference_index=6,
      story="读者先阅读，再把钱袋推向旅行袋。",camera="读者、信纸、钱袋与旅行袋同框，固定中景。",
      motion="第17秒硬切到@图片6的另一间屋。画中人是五十余岁的成年读者，与少年是两个不同的人。前2秒继续阅读左手中的信，空白纸背朝镜头；随后2秒用右手把原本已在桌上的钱袋向画面左侧旅行袋旁短推，袋底全程贴桌；最后2秒松指并停住。左手始终持纸，不放纸、不翻面。只有原有一个钱袋与一个旅行袋，不掉金币。"),
 dict(id="S07",title="登船与空梯",start=23,end=30,reference_index=7,
      story="少年上船离开，摄影机留在岸边看空梯。",camera="沿用岸上背侧全身视角，固定机位，不跟拍。",
      motion="第23秒硬切到@图片7的港口。同一位少年只背一只灰色深补丁布袋，一脚已在现有木舷梯上。他用正常、从容步伐继续沿原梯走入现有船舷开口，每步脚底真实落板。登上甲板后继续沿现有甲板向画面右侧走出边界，最迟第28秒完全离画；第28–30秒保持至少2秒空梯与微动水面。不让低船舷遮住整个身体，也不新增遮挡物。不回头、不跑步、不新增行李，不瞬移或融化。船、岸、梯保持原位。"),
]
B=[
 dict(id="E01",title="远海群岛与雨墙",start=0,end=4,reference_index=1,
      story="远海尺度：岛很低，雨墙覆盖很大。",camera="鸟瞰方向和高度保持，只有极慢单向小幅前移。",
      motion="依据@图片1，低岛与远处岛脊处于同一灰湿透视。海面白浪自然起伏，远处雨墙缓慢削弱岛脊能见度。保持海岸形状，没有卫星视角、暴风眼、俯冲或闪电表演。"),
 dict(id="E02",title="海湾里的居民点",start=4,end=7,reference_index=2,
      story="从大范围岛屿切近到海湾，说明那里有人生活。",camera="更近的海湾俯视全景，机位稳定，不改变高度。",
      motion="第4秒硬切到@图片2所示更近的海湾视角，不用飞行俯冲或变焦过渡。灰雨掠过海岸居民点，植物顺着风小幅伏动，水面有自然细浪。保持房屋位置、海岸线与低能见度。"),
 dict(id="E03",title="门廊下的雨街",start=7,end=11,reference_index=3,
      story="地面尺度：摄影机躲在屋檐下，看雨横过街巷。",camera="地面门廊下固定全景，保留近檐与柱子的遮挡。",
      motion="第7秒硬切到@图片3。近处檐水断续落下，街中斜雨掠过，远处蕉叶同向伏动，三者速度和节奏自然有别。保持右下旧木板，不出现波纹金属片。摄影机留在檐下，不走出门廊、不摇晃。"),
 dict(id="E04",title="石岸与缆绳",start=11,end=14,reference_index=4,
      story="港口尺度：一股浪水冲上湿石岸，又退回去。",camera="贴近湿石岸的固定低机位，原缆绳与柱子都在画面中。",
      motion="第11秒硬切到@图片4，普通小浪已经接近岸沿。用这3秒完成一次小股水越过岸沿并自然回流，原有缆绳只有很小的受力变化。岸石不融化，绳柱连接不变，不明显收短绳长。没有巨浪、断绳、新船或撞击。"),
 dict(id="E05",title="灾后街巷",start=14,end=17,reference_index=5,
      story="时间跳到雨后：破损不均的房屋、积水和远处清理者。",camera="地面街巷全景，固定机位。",
      motion="第14秒硬切到@图片5，明确是风雨已停后的另一个白昼。屋檐偶尔滴水，破损房屋与倒伏植株保持原状。远处原有两人只略微扶稳同一根木料，人物很小，不作完整搬运，也不出现更多人。画面安静，不继续倒屋，不突然出现金色阳光。"),
 dict(id="E06",title="倒伏甘蔗与泥水",start=17,end=20,reference_index=6,
      story="灾后延伸到生计：沟水流过，作物倒伏在地。",camera="甘蔗田边低处固定全景，泥水沟在前景。",
      motion="第17秒硬切到@图片6。前景沟水缓慢沿原地势流动，倒伏甘蔗的叶片轻微摆动，远处灰山与树保持原位置。仍是雨停后的阴天；无人进入，不让田地继续塌陷，不把甘蔗变成稻田。结束时保留实际环境微动。"),
]

def make_prompt(job_id,segments):
    if job_id=="A01":
        intro="""生成一条30秒、包含7个明确独立镜头的历史实景电影叙事片段，18世纪加勒比海港镇。按下面的时间轴硬切各场景；每段都是真实动态镜头，不是静态图片幻灯片。人物表演克制，使用自然光、真实磨损的房间和衣料，保留参考图的湿度、颗粒与摄影质感。

输入图片按上传顺序对应：
@图片1：童年孩子照料母亲，锁定童年脸、头发、衣服及床边空间。
@图片2：已补制的无人房间参考，锁定木窗、空床和凳面无物的木凳。第3–5秒从第一帧起就保持无人空景，不带入其他图片的人与道具。
@图片3：已长大的少年在商行，锁定少年身份、低束深发、旧灰白衬衫与深色背心。
@图片4：同一少年抵窗，锁定雨中窗扇、手掌当前接触状态。
@图片5：同一少年雨后桌边收笔，锁定纸上已有细字、手、笔和陶墨罐。
@图片6：另一位五十余岁成年读者及信、钱袋、旅行袋；不是主角，不借他的脸给少年。
@图片7：同一少年携单只灰色补丁布袋登船，锁定岸、梯与船的实际连接。

身份关系：@图片1是主角童年；@图片3、4、5、7是主角少年；@图片6是不同的成年读者。每段以该段指定图片为主要场景和构图参考，角色只在指定场景出现。"""
        ending="""必须保留第3–5秒整整2秒无人空窗空凳；必须保留读者先读信、后推钱袋的顺序；最后至少2秒是无人空舷梯。不要遗漏任一场景或用复杂额外动作占用这些时间。时间与年龄的跨度都用明确硬切表达，不在连续镜头里把人变没、变老或换脸。"""
    else:
        intro="""生成一条20秒、包含6个明确独立镜头的18世纪加勒比环境电影片段。由远海雨墙、近岸居民点、地面雨街、受力码头，切到风灾后的街道与甘蔗地。按下面的时间点硬切；这是一组运动真实的环境镜头，不是图片溶解或自动巡游风景。保持湿灰自然光、旧木与石灰墙、泥地、热带植被和真实风雨的尺度。

输入图片按上传顺序对应：
@图片1：远海群岛与雨墙，仅用于第0–4秒。
@图片2：海湾居民点，仅用于第4–7秒。
@图片3：门廊下雨街及右下旧木板，仅用于第7–11秒。
@图片4：湿石岸、系缆柱与绳，仅用于第11–14秒。
@图片5：雨后受损街巷及极远处两名清理者，仅用于第14–17秒。
@图片6：雨后倒伏甘蔗和泥水沟，仅用于第17–20秒。

前四镜是同一次风灾中的环境；后两镜是风雨已停后的另一个白昼。保持参考图的海岸、房屋与作物特征。不能把不同图片插值变形成同一个地方；地点变化用硬切交代。"""
        ending="""必须完成全部6个环境场景，前4镜风雨、后2镜灾后。第14秒以硬切完成时间跳跃，不能把灾后街巷当成仍在升级的风灾。不添加主角、面部特写或背景人群；只允许@图片5极远处已有两人作小幅稳定动作。"""
    parts=[intro,"", "逐镜时间轴（秒数为整条视频的时间，不是每镜重新从0开始）："]
    for n,s in enumerate(segments,1):
        parts += ["",f"镜头{n}｜{s['start']:02}–{s['end']:02}秒｜{s['title']}｜场景参考@图片{s['reference_index']}",s["camera"],s["motion"]]
    parts += ["",ending,"", "统一拍摄与声音要求：只在上述时间点切镜，镜头内部不新增剪切、环绕、甩镜、快速推进、拉焦或慢动作。所有动作按正常速度，不用慢动作填满时长。保持人物和物件结构、真实接触及自然环境变化；不加舞台聚光、金色滤镜、美颜或油画笔触。全片无对白、独白、配音、歌唱、口型表演、字幕、画内标题、音乐及音效，直接输出无声视频。参考图的@编号和本时间轴文字不进入画面。片头片尾不淡黑，不自动添加转场装饰或黑场。"]
    return "\n".join(parts)+"\n"

def main():
    if (ROOT/'review-lock.json').exists():
        raise SystemExit('Review lock exists; preserve it and deliberately review revisions first.')
    refs=ROOT/'references';refs.mkdir(parents=True,exist_ok=True)
    if not (refs/'N02.png').is_file():
        raise SystemExit('N02 empty-room reference is not ready; do not substitute a person-containing image.')
    for sid in ['S01','S03','S04','S05','S06','S07']:
        shutil.copyfile(ART/'cg-ark-firstframes-v4/firstframes'/f'{sid}.png',refs/f'{sid}.png')
    for sid in [f'E{i:02}' for i in range(1,7)]:
        shutil.copyfile(ART/'cg-environments-v5/firstframes'/f'{sid}.png',refs/f'{sid}.png')
    (ROOT/'prompts').mkdir(exist_ok=True)
    jobs=[]
    for jid,title,duration,segments in [('A01','人物叙事 · 7镜30秒',30,A),('B01','风暴与灾后 · 6镜20秒',20,B)]:
        p=ROOT/'prompts'/f'{jid}.txt';p.write_text(make_prompt(jid,segments),encoding='utf-8')
        references=[]
        for s in segments:
            filename=f"{s['id']}.png"
            ref=dict(image_index=s['reference_index'],id=s['id'],file=f"references/{filename}",sha256=sha(refs/filename))
            if s['id']=='N02':
                ref.update(scope='empty_room_scene',preview_is_desired_output=True,note='同账号生图模型编辑所得无人空窗空凳参考；视频第3–5秒从第一帧起保持无人、凳面无物。')
            references.append(ref)
        jobs.append(dict(id=jid,title=title,duration=duration,prompt_file=f'prompts/{jid}.txt',prompt_sha256=sha(p),references=references,segments=segments))
    order=['S01','N02','S03','E01','E02','E03','S04','E04','E05','E06','S05','S06','S07']
    by_scene={s['id']:(j['id'],s) for j in jobs for s in j['segments']}
    timeline=[];cursor=0
    for sid in order:
        jid,s=by_scene[sid];length=s['end']-s['start']
        filename=f'{sid}.png'
        timeline.append(dict(scene_id=sid,title=s['title'],source_job=jid,source_in=s['start'],source_out=s['end'],start=cursor,end=cursor+length,reference_file=f'references/{filename}',story=s['story'],reference_preview_is_desired_output=True))
        cursor+=length
    manifest=dict(version=7,date='2026-09-11',title='离岛以前 · 两条视频能力实验',status='prepared_for_user_review',video_submission_authorized=False,
        defaults=dict(model='doubao-seedance-2-5-260628',resolution='720p',ratio='16:9',generate_audio=False,output_format='mp4',omni_reference_task_type='reference'),
        source_duration_seconds=50,target_edit_duration_seconds=50,edit_fps=24,final_fade_seconds=0.5,batch_concurrency=1,
        input_mode='multiple_scene_reference_images_not_exact_first_frames',timing_status='requested_not_yet_verified_on_generated_video',
        pricing=dict(currency='CNY',basis='input_has_no_video',width=1280,height=720,estimated_fps=24,estimated_output_tokens=1080000,price_per_million_tokens=70,estimated_total=75.60,by_job={'A01':45.36,'B01':30.24},alternative_1080p_discount_total=134.72,alternative_1080p_regular_total=187.11,alternative_1080p_discount_until='2026-09-17T14:00:00+08:00',source='https://ark.volcengine.com/region:cn-beijing/docs/82379/1544106?lang=zh',note='用户选择720p；视频预算不含参考图修订、成功重生成或账户专属抵扣。实际以usage与账单为准。'),
        preserved_plan='../cg-video-production-v6/manifest.json',jobs=jobs,edit_timeline=timeline,
        acceptance=['A01包含全部7个有明确切点的场景；N02整段无人且凳面为空','主角童年和少年、不同成年读者身份不混淆','B01包含全部6个环境场景，14秒之后为灾后','切镜是独立场景硬切，没有人物消失或场景变形过渡','A01末尾至少2秒人物离画后的空梯','静音、无口型、无字幕；时间点按成片实际重新核验'],
        execution_note='先审阅本版。用户明确下令后仅执行A01与B01，不执行v6十一镜，不为失败自动增加付费请求。')
    (ROOT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    with (ROOT/'交叉剪辑表.csv').open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.writer(f);w.writerow(['顺序','场景','标题','源视频','源入点秒_预案','源出点秒_预案','成片入点秒','成片出点秒'])
        for n,s in enumerate(timeline,1):w.writerow([n,s['scene_id'],s['title'],s['source_job'],s['source_in'],s['source_out'],s['start'],s['end']])
    print('Prepared A01 30s + B01 20s; 13 scene references; 50s interleaved edit. No network.')

if __name__=='__main__':main()
