# 主像素美术：全流程态度反应审计 / Main Pixel Art Reaction Audit

日期：2026-09-14。状态：制作前剧本审计；本文确定表演需求，素材数量为建议基线，最终实际生成数量以交付清单为准。用户已批准 Eliza 画法及 Hamilton / Lafayette 第二轮说话动作，第一轮四种静态风格不再作为制作方向。

## 范围与核对结果

- 已读主线 `src/data/chapters.ts` 全部分支；`src/data/discoveries.ts` 的基础、变体、重复、过期、选项回复及 11 条状态回声；`src/data/smallTalk.ts` 的 8 位配角闲聊。
- 已核对 `src/story3d/StoryProgress.ts`、`Discoveries.ts`、`StoryDirector.ts`、`StoryUI.ts`：酒馆超时仍是人物台词；选项选中后会经 `showLine(selected)` 和 `DialoguePresentation.play([selected,line])` 实际播放，必须覆盖。
- 已核对 `src/data/debate.ts`、`writing.ts`、`yorktown.ts` 以及 `src/ui/Activity.ts`、`DebateActivity.ts`、`WritingActivity.ts`、`YorktownActivity.ts`：6 个保皇派论点、24 种 Hamilton 回应、15 个军令碎片、12 个战斗命令均纳入；战斗有一条重复口令。
- `src/data/voiceover-catalog.json` 当前 202 个可播放 cue、201 个「角色＋英文文本」唯一组合。与 `docs/voiceover/manifest.json` 逐 id 对齐。202 包含所有分支，不能当作单次游玩的句数。
- 幕间、玩法说明、反馈提示、成绩、结局页面和退役 Demo 漫游不是新旁白素材的触发源。无需扫描 DOM 或新增配音。音乐与开场影片不属于这套立绘动作。
- 剧本没有明确的大笑、痛哭、惊恐或胜利狂欢。Lafayette 的面包闲聊、Mulligan 的袖口提醒、Newsboy 收齐报纸足以支持轻松笑意；不为补齐情绪表而强加大笑。约克镇胜利仍承接责任与未来，不使用狂笑。

| 角色 / Character | 剧情 / Dialogue | 已选选项 / Selected options | 辩论 / Debate | 军令 / Dispatch | 战斗 / Commands | 总计 / Total | 必要姿态组 / Poses |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Hamilton | 46 | 22 | 24 | 15 | 12 | 119 | 6 |
| Burr | 17 | 0 | 0 | 0 | 0 | 17 | 5 |
| Washington | 17 | 0 | 0 | 0 | 0 | 17 | 5 |
| Laurens | 7 | 0 | 0 | 0 | 0 | 7 | 4 |
| Lafayette | 6 | 0 | 0 | 0 | 0 | 6 | 5 |
| Mulligan | 6 | 0 | 0 | 0 | 0 | 6 | 4 |
| Loyalist / 保皇派 | 3 | 0 | 6 | 0 | 0 | 9 | 3 |
| Newsboy / 报童 | 4 | 0 | 0 | 0 | 0 | 4 | 3 |
| Citizen / 市民 | 9 | 0 | 0 | 0 | 0 | 9 | 3 |
| Eliza / 记录者 | 8 | 0 | 0 | 0 | 0 | 8 | 3 |
| 合计 / Total | 123 | 22 | 30 | 15 | 12 | 202 | 41 |

## 角色姿态与覆盖

这里把「姿态」与「嘴型帧」分开计数。共 41 个姿态组，其中 38 个用于可见脸的九名角色，3 个用于 Eliza。保留每名人物已经可辨认的轮廓、服装与朝向；反应首先改变眉眼、下巴、手的收放，避免靠整张立绘上下跳动表达态度。

以下「台词覆盖」指该姿态作为一句话的主要表演态度；0 句表示纯听者或句后姿态，仍是必要资产。一个姿态可以同时承担听者与句后功能。

### Hamilton — 6 个姿态组

| 姿态 / Pose | 动作设计 | 台词覆盖 | 代表 cue 与原句 |
| --- | --- | ---: | --- |
| 坚定表达 / Assertive (assertive) | 前倾递出论证手势，保留用户批准的动作线 | 40 | `opening-letter-base-3`：我带不走那座岛。但我能带走纸上的每一个字。纽约有学校，有印刷机，也有人愿意争论未来。我要在那里找到我的位置。 |
| 思考 / Reflective (reflect) | 手势收回，视线略向下，眉眼专注地核对 | 40 | `arrival-newspaper-base-2`：先给我一份。只有知道这座城在为什么争吵，我的文字才不会只是对着自己说话。 |
| 认可 / Approving (approve) | 肩部放松，温和闭口笑意，小幅点头 | 10 | `lafayette-allies-selected`：建立联盟，把孤军变成共同事业。 |
| 担忧或警告 / Concerned (concern) | 眉间收紧、下巴稍沉，感受代价与责任 | 10 | `arrival-street-base-3`：这两个人都害怕失去手里的生活。但他们还没问过，谁有资格替另一方下注。 |
| 指挥 / Commanding (command) | 稳定挺身，向队伍发出明确的方向手势 | 19 | `yorktown-coordinate-selected`：核对各队的职责，等共同信号再推进。 |
| 平静 / Calm (calm) | 双手下降、闭口听完，保持内向三分之四朝向 | 0 | 所有对方台词及主动发言结束后的平静聆听 |

### Burr — 5 个姿态组

| 姿态 / Pose | 动作设计 | 台词覆盖 | 代表 cue 与原句 |
| --- | --- | ---: | --- |
| 平静 / Calm (calm) | 直立但不僵硬，手落在胸腹附近，安静聆听 | 2 | `arrival-burr-base-1`：你听了很久。亚历山大·汉密尔顿，对吗？我读过你的文字。 |
| 思考 / Reflective (reflect) | 一侧眉略抬，目光审慎，像在衡量论据 | 3 | `burr-question-reply-1`：我相信，作决定之前应该把人看清楚。你这个问题，让我更想认识你了。走吧。 |
| 认可 / Approving (approve) | 克制的浅笑与轻微点头，不作夸张赞许 | 5 | `burr-observe-reply-1`：很好。耐心也能是一种行动。我们去酒馆，那里比街头容易听见真话。 |
| 担忧或警告 / Concerned (concern) | 收紧眉眼、掌心压低，提醒风险 | 3 | `arrival-burr-base-3`：先弄清楚谁在听，再决定说多少。局势会变；公开说过的话，会留下来。 |
| 质疑或迎战 / Challenging (challenge) | 略抬下巴、正视对方，平静接受挑战 | 4 | `discovery-arrival-burr-margin-challenge-reply-1`：好。我会认真准备。你最好也给答案留一点准备的时间。 |

### Washington — 5 个姿态组

| 姿态 / Pose | 动作设计 | 台词覆盖 | 代表 cue 与原句 |
| --- | --- | ---: | --- |
| 平静 / Calm (calm) | 稳重的闭口审视，宽肩保持安定 | 1 | `small-talk-washington`：咖啡又凉了。这里的杯子似乎从来留不住热气。 |
| 指挥 / Commanding (command) | 胸口展开，指向目标或军令，简洁交付职责 | 4 | `washington-offer-base-3`：军令、情报、补给。写错一个地点，也会有人付出代价。我需要副官。你愿意从这里开始吗？ |
| 认可 / Approving (approve) | 眉眼稍缓，少量点头，表现交付信任 | 5 | `washington-accept-reply-1`：很好。今晚有几封信，不能等到明天。 |
| 担忧或警告 / Concerned (concern) | 压低眉与手势，严肃制止逾矩要求 | 3 | `washington-offer-variant-1-1`：你的文章已经传进军营。我也听说了街上的争论。让别人注意你，你很擅长；让别人依靠你，是另一回事。 |
| 思考 / Reflective (reflect) | 目光落向文件高度，手势小而准确，审阅细节 | 4 | `washington-offer-base-1`：我看过你的文章。你能把事情写清楚。但军中需要的，还有把事情做完。 |

### Laurens — 4 个姿态组

| 姿态 / Pose | 动作设计 | 台词覆盖 | 代表 cue 与原句 |
| --- | --- | ---: | --- |
| 坚定表达 / Assertive (assertive) | 前倾提出自由原则，眉眼坚定，开放而有力的手势 | 2 | `tavern-laurens-base-3`：那就让它安静。你认为现在最重要的是什么？ |
| 担忧或警告 / Concerned (concern) | 紧眉、手按胸前，表现对被排除者的忧虑 | 2 | `tavern-laurens-base-1`：我们把自由写得那么大，却总把某些人留在句子外面。一个仍允许奴役的国家，准备怎样解释自己的自由？ |
| 认可 / Approving (approve) | 正视对方并点头，手势邀请并肩 | 1 | `laurens-liberty-reply-1`：我愿意和这样的人并肩。但当这个承诺开始让盟友不舒服时，你还得说下去。 |
| 平静 / Calm (calm) | 放松聆听或包容沉默，闭口等待 | 2 | `tavern-laurens-timeout`：你沉默了一会儿。没关系，先听听其他人的想法；这张桌子还会留一个位置。 |

### Lafayette — 5 个姿态组

| 姿态 / Pose | 动作设计 | 台词覆盖 | 代表 cue 与原句 |
| --- | --- | ---: | --- |
| 坚定表达 / Assertive (assertive) | 沿用批准的挺胸摊手号召姿态 | 1 | `tavern-lafayette-base-1`：我横渡大西洋，不是为了旁观。可勇气不能替士兵装满口粮。面对更强的军队，你准备把力气用在哪里？ |
| 思考 / Reflective (reflect) | 手势略收，眉眼专注地权衡盟友、口粮和战术 | 2 | `lafayette-negotiate-reply-1`：可以。但谈判桌也需要有人在外面守着。别把喘息误当成终点。 |
| 认可 / Approving (approve) | 爽快的闭口笑意与点头，认同后准备行动 | 1 | `lafayette-independence-reply-1`：够直接。我喜欢。但说完这句话，下一步就该准备行军了。 |
| 平静 / Calm (calm) | 放松落手，仍保持灵活而挺拔的站姿 | 1 | `tavern-lafayette-timeout`：你沉默了一会儿。没关系，先听听其他人的想法；这张桌子还会留一个位置。 |
| 轻松笑意 / Amused (amused) | 面包闲聊时扬眉浅笑，可一瞬轻笑，不仰头大笑 | 1 | `small-talk-lafayette`：这里的面包很硬，不过蘸进汤里就好多了。 |

### Mulligan — 4 个姿态组

| 姿态 / Pose | 动作设计 | 台词覆盖 | 代表 cue 与原句 |
| --- | --- | ---: | --- |
| 坚定表达 / Assertive (assertive) | 身体结实地前倾，手掌向前摆出可执行的事情 | 1 | `tavern-mulligan-base-1`：大道理我听够了。明早有十个人愿意帮忙，一家印刷铺肯赊账，还有一辆空车。汉密尔顿，你怎么用？ |
| 认可 / Approving (approve) | 实在的温暖笑意，点头表示愿意帮忙 | 3 | `mulligan-print-reply-1`：行。少写几个漂亮词，多写几句他们能讲给邻居听的话。 |
| 担忧或警告 / Concerned (concern) | 收紧目光、掌心压低，提醒巡逻与他人处境 | 1 | `mulligan-rally-reply-1`：场地可以有。巡逻队一来，你可不能只顾着自己的演说。 |
| 平静 / Calm (calm) | 落手放松，闲聊或容许对方先听 | 1 | `tavern-mulligan-timeout`：你沉默了一会儿。没关系，先听听其他人的想法；这张桌子还会留一个位置。 |

### Loyalist / 保皇派 — 3 个姿态组

| 姿态 / Pose | 动作设计 | 台词覆盖 | 代表 cue 与原句 |
| --- | --- | ---: | --- |
| 坚定表达 / Assertive (assertive) | 紧握文稿或有棱角的论辩手势，质问有压迫感 | 8 | `arrival-street-base-2`：没有王室和海军，这座港口靠什么维持秩序？你们把眼前的生计，押给一个还不存在的国家。 |
| 质疑或迎战 / Challenging (challenge) | 闭口抬眉、微收下巴，审视反驳而不自动服气 | 0 | 作为 Hamilton 六轮反驳时的听者，维持怀疑态度 |
| 平静 / Calm (calm) | 放低手或整理文稿，恢复日常状态 | 1 | `small-talk-loyalist`：我刚把纸理齐，风又把它们吹乱了。 |

### Newsboy / 报童 — 3 个姿态组

| 姿态 / Pose | 动作设计 | 台词覆盖 | 代表 cue 与原句 |
| --- | --- | ---: | --- |
| 坚定表达 / Assertive (assertive) | 精神饱满地递出报纸、吆喝消息，儿童比例清楚 | 1 | `arrival-newspaper-base-1`：港口的消息！英军动向、商船货价，还有一整版互相反驳的文章。先生，你想知道发生了什么，还是想让别人知道你是谁？ |
| 认可 / Approving (approve) | 明亮的感谢与小幅开心笑容，抱稳报纸 | 2 | `discovery-arrival-scattered-paper-base-2`：多谢！你就是刚才买报的先生。我会记得你的名字。 |
| 平静 / Calm (calm) | 自然收好报纸，轻松日常表情 | 1 | `small-talk-newsboy`：先别把报纸折起来，墨还没干呢。 |

### Citizen / 市民 — 3 个姿态组

| 姿态 / Pose | 动作设计 | 台词覆盖 | 代表 cue 与原句 |
| --- | --- | ---: | --- |
| 担忧或警告 / Concerned (concern) | 眉眼忧虑，手贴向胸前或向外询问生计 | 4 | `arrival-street-base-1`：驻军越来越多。有人说军队保护生意，可我只想知道：他们保护的是谁作决定的权利？ |
| 认可 / Approving (approve) | 放松眉眼、闭口致谢，认可被认真听见 | 3 | `discovery-square-bread-and-prices-repeat-1`：账单还在，问题也是。谢谢你先问了我们的日子。 |
| 平静 / Calm (calm) | 收手观察、日常抱臂或垂手，不预设政治赞同 | 2 | `discovery-square-bread-and-prices-inactive-1`：争论散了，明天还是要开门做生意。我会看你们怎样兑现说过的话。 |

### Eliza / 记录者 — 3 个姿态组

| 姿态 / Pose | 动作设计 | 台词覆盖 | 代表 cue 与原句 |
| --- | --- | ---: | --- |
| 书写 / Recording (write) | 低头执笔，纸页承托，脸完整隐在阴影中 | 3 | `opening-letter-base-2`：他把所见写成文字。有人读了那篇文章，开始相信，这个年轻人应该得到继续求学的机会。 |
| 思考 / Reflective (reflect) | 停笔片刻、头微垂，承受回忆与代价 | 2 | `opening-letter-base-1`：他来自加勒比海。商行的账本教会他计算，海上的风暴教会他：一个人的处境，可能在一夜之间被改写。 |
| 翻页 / Turning the page (turn) | 手按书页或轻翻一页，收录章节转折；不露五官 | 3 | `yorktown-command-base-1`：1781 年，法美联军围困约克镇。数年的行军、军令与争执，终于把汉密尔顿带到一座英军堡垒前。 |

## 生成数量建议与动作语义

- 基线为 41 幅闭口／非张嘴姿态图；九位可见脸人物各加普通开口与强调开口 2 帧，合计 59 帧。此数量是有依据的最低交付，不把口型重复帧误称为 59 种情绪。
- 59 帧方案要求：说话帧承载基础表达，句后和听者阶段切到相应的独立反应图；不能将「反应图上没有对应开口」掩盖为完整情绪口型。若希望一句话从头到尾保持担忧、认可等脸型，需为这些确实发言的姿态追加对应开口帧，并在最终交付清单明确实际帧数。
- 对已经批准的 Hamilton / Lafayette 动作，闭口、普通开口、强调帧须使用相同头部与身体基准。平静、认可、忧虑是另画的姿态，不是把开口强行关上后继续指着听者。
- 建议运行时语义收敛为 `calm / assertive / reflect / approve / concern / command / challenge / amused`；Eliza 使用 `write / reflect / turn`。具体轮廓仍按角色区分，例如 Washington 的 concern 是严肃训诫，Citizen 的 concern 是生计担忧。
- 开口循环只由当前句的真实音频 `playing` 驱动；`waiting / pause / ended / error` 应闭口。正常结束后转句后姿态；暂停不能触发结束反应。关闭语音仍可采用有界阅读时长，时间结束闭口并保留态度。
- 听者始终覆灰黑蒙版，但保留反应轮廓；不能所有听者都点头赞同，也不应与说话者同时循环张嘴。句后反应允许继续显示直到用户进入下一句，不自动推进剧本。
- Eliza 的三种动作都不画嘴或五官；她持续记录、短暂停笔、翻页承接故事，其动作可随女声旁白开始，但不应模拟露脸说话。
- 清理粉边以资产透明背景和实际轮廓 alpha 为目标；对浅蓝衣服、肤色、金色和深色发丝检查，不能靠过度阈值造成缺角、洞眼或细节消失。

## 必须分支处理的听者与句后反应

| 情境或 cue | 说话者句后 | 听者反应 |
| --- | --- | --- |
| `burr-observe-selected` → `burr-observe-reply-1` | Hamilton 平静；Burr 克制认可 | Burr 认可耐心；Hamilton 温和接纳 |
| `burr-question-selected` / `burr-question-reply-1` | Hamilton 思考；Burr 温和收束 | Burr 被勾起兴趣，不能用敌意；Hamilton 继续观察 |
| `burr-revolution-selected` → `burr-revolution-reply-1` | Hamilton 收住论证手；Burr 保留警告 | Burr 担心公开风险；Hamilton 认真承接，不配庆祝 |
| `laurens-stability-selected` / `laurens-representation-selected` | Hamilton 思考或平静 | Laurens 仍关注被排除的人，不自动认同「以后再说」 |
| `laurens-liberty-selected` → `laurens-liberty-reply-1` | Laurens 认可支持 | Hamilton 点头承诺；认可应带认真而非嬉笑 |
| `lafayette-negotiate-selected` / `lafayette-allies-reply-1` | Lafayette 手势收回，继续权衡 | Hamilton 思考「谈判外的守卫」与「盟友需要」 |
| `lafayette-independence-selected` → `lafayette-independence-reply-1` | Lafayette 爽快认可，然后平稳收手 | Hamilton 接受鼓励；可笑意，不能变成宴饮大笑 |
| `mulligan-print-selected` / `mulligan-supplies-selected` | Mulligan 认可并准备协助 | Hamilton 接纳务实支持 |
| `mulligan-rally-selected` → `mulligan-rally-reply-1` | Mulligan 留下警惕 | Hamilton 承接巡逻风险，不能持续得意 |
| 三个 `tavern-*-timeout` | Laurens / Lafayette / Mulligan 平静包容 | Hamilton 稍收目光；不羞辱玩家，也不恼怒催促 |
| `washington-accept-selected` → `washington-accept-reply-1` | Washington 克制肯定 | Hamilton 认真接受职责 |
| `washington-negotiate-selected` → `washington-negotiate-reply-1` | Washington 坚定交付标准 | Hamilton 平静听完条件 |
| `washington-demand-selected` → `washington-demand-reply-1` | Washington 严肃制止 | Hamilton 收起进逼手势，担忧或不甘但不怒吼 |
| `washington-offer-variant-1-1` / `yorktown-command-base-2` | Washington 训诫后仍稳重 | Hamilton 思考「可靠」与「整支队伍」，与高信任变体不同 |
| `yorktown-command-variant-1-2` / `echo-yorktown-detail-recall` | Washington 肯定信任 | Hamilton 承重而认真地接受，不采用年轻时炫耀姿态 |
| `discovery-arrival-scattered-paper-base-2` / repeat | Newsboy 感激、轻快开心 | Hamilton 温和认可；可以小笑，不能嘲笑报童 |
| `discovery-square-bread-and-prices-base-2` | Citizen 保留担忧 | Hamilton 认真听见生计；回应后 Citizen 才缓和 |
| `echo-square-paper-recognition` / `echo-square-influence-recognition` | Citizen 开放聆听 | Hamilton 温和接纳；被认出不等于其全部主张已获赞成 |
| `discovery-burr-respect-*` | 双方温和认可或继续思考 | Burr 认可论据会修正，而不是迷恋 Hamilton |
| `discovery-burr-rivalry-*` / margin challenge | 双方保留迎战张力 | Burr 直视挑战；Hamilton 坚定，不能与尊重分支同用点头笑意 |
| `discovery-letter-name-echo-*` / `yorktown-surrender-base-3` | Hamilton 沉思、肩手收落 | 另一侧安静承接；胜利、姓名和责任不能全是热烈动作 |
| `small-talk-lafayette` / `small-talk-mulligan` | Lafayette 浅笑；Mulligan 温暖务实 | Hamilton 放松；只表示闲聊亲近，不新增笑声配音 |
| `small-talk-burr` / `small-talk-washington` | 闭口放松 | 日常疲惫或享受安静，不使用强烈忧伤与愤怒 |

## 小游戏：以真实结果补充无新增台词的反应

| 入口 / Event | Hamilton | 对方 / Listener | 条件限制 |
| --- | --- | --- | --- |
| 辩论论点朗读 | 专注或思考听取 | Loyalist 强势陈述 | 只朗读论点，不把规则交给人物 |
| 辩论选择回应与节拍等待 | 蓄势、闭口 | Loyalist 怀疑审视 | 选择未落实前不提前演成功 |
| 辩论回应实际播放 | FACT 可思考论证；其他坚定表达 | Loyalist 持保留态度 | 不能给反对者无条件认可动画 |
| 辩论反馈 `MISS` | 收手、担忧或反省 | Loyalist 保持审视 | 以成绩分支为准，不篡改成绩；保护反噬成功仍是失拍 |
| 辩论反馈 GOOD/PERFECT | 稳定认可自己的回应 | Loyalist 稍沉静但未改换立场 | 句子说完再反应；不配笑声 |
| 辩论 `won` / 非 won 结果 | 克制欣慰 / 收束思考 | Loyalist 冷静接受结果 / 保留质疑 | 可呈静态反应；现有结果页面仍不朗读 |
| 军令碎片点击、反馈校对稿朗读 | 专注核对后闭口思考 | Washington 审阅 | 语音结束恢复计时的现有机制须保留 |
| 军令提交反馈 | 本轮准确则认可，有遗漏则反省 | Washington 克制认可 / 细节审阅 | 用 `scores[round]` 与该轮碎片数；不要伪装所有提交都正确 |
| 军令最终结果 | 收束沉思或认可 | Washington 按 ≥80 / ≥50 / <50 的既有信任档态度 | 不改变原有参数，不新增训斥台词 |
| 约克镇实际军令朗读 | 指挥开口 → 闭口待命 | Lafayette 稳定聆听 | 听者不可循环大笑或鼓掌 |
| 约克镇命令反馈 | 命中后稳定确认；MISS 时重整 | Lafayette 认可 / 战术思考 | `feedback` 850ms 足够做一次收束；保持既有游戏节奏 |
| 约克镇结果与后续投降对话 | 克制松弛、承重思考 | Lafayette 可以点头；Eliza 继续记录 | 不新增战争狂欢或主张旁白念成绩 |

## 初次审计的 202 条逐句覆盖表

下表是人工阅读后按有共同表演意图的场景分组编制的制作标记。它不意味着自动对英文做关键词匹配。`说话态度 → 句后` 是表演意图；运行时若只交付基础开口帧，应明确在说话后才切入独立反应姿态。听者栏给出态度方向，精确角色关系优先以上分支表和当前实际对话对手。

| Cue id | 角色 | 类型 | 中文原句 | 说话态度 → 句后 | 听者反应方向 |
| --- | --- | --- | --- | --- | --- |
| `opening-letter-base-1` | Eliza / 记录者 | dialogue | 他来自加勒比海。商行的账本教会他计算，海上的风暴教会他：一个人的处境，可能在一夜之间被改写。 | reflect → reflect | 安静等待对方思考 |
| `opening-letter-base-2` | Eliza / 记录者 | dialogue | 他把所见写成文字。有人读了那篇文章，开始相信，这个年轻人应该得到继续求学的机会。 | write → write | 沉思回忆 |
| `opening-letter-base-3` | Hamilton | dialogue | 我带不走那座岛。但我能带走纸上的每一个字。纽约有学校，有印刷机，也有人愿意争论未来。我要在那里找到我的位置。 | assertive → calm | 专注听取，不自动认同 |
| `arrival-newspaper-base-1` | Newsboy / 报童 | dialogue | 港口的消息！英军动向、商船货价，还有一整版互相反驳的文章。先生，你想知道发生了什么，还是想让别人知道你是谁？ | assertive → calm | 专注听取，不自动认同 |
| `arrival-newspaper-base-2` | Hamilton | dialogue | 先给我一份。只有知道这座城在为什么争吵，我的文字才不会只是对着自己说话。 | reflect → reflect | 安静等待对方思考 |
| `arrival-street-base-1` | Citizen / 市民 | dialogue | 驻军越来越多。有人说军队保护生意，可我只想知道：他们保护的是谁作决定的权利？ | concern → concern | 认真承接担忧或警告 |
| `arrival-street-base-2` | Loyalist / 保皇派 | dialogue | 没有王室和海军，这座港口靠什么维持秩序？你们把眼前的生计，押给一个还不存在的国家。 | assertive → calm | 专注听取，不自动认同 |
| `arrival-street-base-3` | Hamilton | dialogue | 这两个人都害怕失去手里的生活。但他们还没问过，谁有资格替另一方下注。 | concern → concern | 认真承接担忧或警告 |
| `arrival-burr-base-1` | Burr | dialogue | 你听了很久。亚历山大·汉密尔顿，对吗？我读过你的文字。 | calm → calm | 平静陪伴 |
| `arrival-burr-base-2` | Hamilton | dialogue | 那就省了介绍。你也听见了——他们谈论自由的时候，仿佛每个人说的是不同的东西。 | assertive → calm | 专注听取，不自动认同 |
| `arrival-burr-base-3` | Burr | dialogue | 先弄清楚谁在听，再决定说多少。局势会变；公开说过的话，会留下来。 | concern → concern | 认真承接担忧或警告 |
| `burr-observe-selected` | Hamilton | player-option | 先观察，弄清各方的立场。 | reflect → reflect | 安静等待对方思考 |
| `burr-observe-reply-1` | Burr | dialogue | 很好。耐心也能是一种行动。我们去酒馆，那里比街头容易听见真话。 | approve → approve | 接受善意，小幅缓和 |
| `burr-question-selected` | Hamilton | player-option | 那你呢？你自己相信什么？ | reflect → reflect | 安静等待对方思考 |
| `burr-question-reply-1` | Burr | dialogue | 我相信，作决定之前应该把人看清楚。你这个问题，让我更想认识你了。走吧。 | reflect → reflect | 安静等待对方思考 |
| `burr-revolution-selected` | Hamilton | player-option | 我支持革命。现在就可以写下我的名字。 | assertive → calm | 专注听取，不自动认同 |
| `burr-revolution-reply-1` | Burr | dialogue | 我听见了。整条街也听见了。希望你准备好了，为这么响亮的名字负责。 | concern → concern | 认真承接担忧或警告 |
| `tavern-laurens-base-1` | Laurens | dialogue | 我们把自由写得那么大，却总把某些人留在句子外面。一个仍允许奴役的国家，准备怎样解释自己的自由？ | concern → concern | 认真承接担忧或警告 |
| `tavern-laurens-base-2` | Hamilton | dialogue | 你要的答案，恐怕会让这张桌子安静下来。 | concern → concern | 认真承接担忧或警告 |
| `tavern-laurens-base-3` | Laurens | dialogue | 那就让它安静。你认为现在最重要的是什么？ | assertive → calm | 专注听取，不自动认同 |
| `laurens-stability-selected` | Hamilton | player-option | 先维持秩序，让人们活过这场战争。 | concern → concern | 认真承接担忧或警告 |
| `laurens-stability-reply-1` | Laurens | dialogue | 活下来当然重要。可有些人一直在等“以后”，我们不能再轻易替他们说这个词。 | concern → concern | 认真承接担忧或警告 |
| `laurens-representation-selected` | Hamilton | player-option | 谁来作决定，谁又有权提出反对？ | reflect → reflect | 安静等待对方思考 |
| `laurens-representation-reply-1` | Laurens | dialogue | 那么，记得把被排除的人也算进去。换一个掌权的人，还不够。 | assertive → calm | 专注听取，不自动认同 |
| `laurens-liberty-selected` | Hamilton | player-option | 自由的承诺，应当包含被奴役的人。 | assertive → calm | 专注听取，不自动认同 |
| `laurens-liberty-reply-1` | Laurens | dialogue | 我愿意和这样的人并肩。但当这个承诺开始让盟友不舒服时，你还得说下去。 | approve → approve | 接受善意，小幅缓和 |
| `tavern-laurens-timeout` | Laurens | dialogue | 你沉默了一会儿。没关系，先听听其他人的想法；这张桌子还会留一个位置。 | calm → calm | 平静陪伴 |
| `tavern-lafayette-base-1` | Lafayette | dialogue | 我横渡大西洋，不是为了旁观。可勇气不能替士兵装满口粮。面对更强的军队，你准备把力气用在哪里？ | assertive → calm | 专注听取，不自动认同 |
| `tavern-lafayette-base-2` | Hamilton | dialogue | 每一条路都要付代价。区别在于，我们愿不愿意自己选择。 | concern → concern | 认真承接担忧或警告 |
| `lafayette-negotiate-selected` | Hamilton | player-option | 保持谈判，为居民争取喘息。 | reflect → reflect | 安静等待对方思考 |
| `lafayette-negotiate-reply-1` | Lafayette | dialogue | 可以。但谈判桌也需要有人在外面守着。别把喘息误当成终点。 | reflect → reflect | 安静等待对方思考 |
| `lafayette-allies-selected` | Hamilton | player-option | 建立联盟，把孤军变成共同事业。 | approve → approve | 接受善意，小幅缓和 |
| `lafayette-allies-reply-1` | Lafayette | dialogue | 那你得学会听见盟友的需要。共同事业，不能只有一个人的声音。 | reflect → reflect | 安静等待对方思考 |
| `lafayette-independence-selected` | Hamilton | player-option | 公开争取独立，不再等待许可。 | assertive → calm | 专注听取，不自动认同 |
| `lafayette-independence-reply-1` | Lafayette | dialogue | 够直接。我喜欢。但说完这句话，下一步就该准备行军了。 | approve → approve | 接受善意，小幅缓和 |
| `tavern-lafayette-timeout` | Lafayette | dialogue | 你沉默了一会儿。没关系，先听听其他人的想法；这张桌子还会留一个位置。 | calm → calm | 平静陪伴 |
| `tavern-mulligan-base-1` | Mulligan | dialogue | 大道理我听够了。明早有十个人愿意帮忙，一家印刷铺肯赊账，还有一辆空车。汉密尔顿，你怎么用？ | assertive → calm | 专注听取，不自动认同 |
| `tavern-mulligan-base-2` | Hamilton | dialogue | 你给我的不是十个人，是十个人各自认识的那条街。 | approve → approve | 接受善意，小幅缓和 |
| `mulligan-print-selected` | Hamilton | player-option | 印一份清楚的传单，让每条街接着讨论。 | assertive → calm | 专注听取，不自动认同 |
| `mulligan-print-reply-1` | Mulligan | dialogue | 行。少写几个漂亮词，多写几句他们能讲给邻居听的话。 | approve → approve | 接受善意，小幅缓和 |
| `mulligan-supplies-selected` | Hamilton | player-option | 先送补给，让愿意加入的人吃上饭。 | approve → approve | 接受善意，小幅缓和 |
| `mulligan-supplies-reply-1` | Mulligan | dialogue | 车我来找。愿意做这种不显眼的事，才有人下次还来找你。 | approve → approve | 接受善意，小幅缓和 |
| `mulligan-rally-selected` | Hamilton | player-option | 召集公开集会，今天就让更多人听见。 | assertive → calm | 专注听取，不自动认同 |
| `mulligan-rally-reply-1` | Mulligan | dialogue | 场地可以有。巡逻队一来，你可不能只顾着自己的演说。 | concern → concern | 认真承接担忧或警告 |
| `tavern-mulligan-timeout` | Mulligan | dialogue | 你沉默了一会儿。没关系，先听听其他人的想法；这张桌子还会留一个位置。 | calm → calm | 平静陪伴 |
| `debate-loyalist-base-1` | Loyalist / 保皇派 | dialogue | 脱离英国之后，商船由谁护送，货物卖给谁？你们用自由作保证，却要每一个家庭拿生计来冒险。 | assertive → calm | 专注听取，不自动认同 |
| `debate-loyalist-base-2` | Citizen / 市民 | dialogue | 这也是我想问的。没有明天的面包，今天的口号有什么用？ | concern → concern | 认真承接担忧或警告 |
| `debate-loyalist-base-3` | Burr | dialogue | 他们在等你的回答。把问题听完。 | concern → concern | 认真承接担忧或警告 |
| `debate-round-1-argument` | Loyalist / 保皇派 | debate-speech | 脱离英国之后，商船由谁护送，货物卖给谁？你们让每个家庭用明天的面包支付自由。 | assertive → calm | 专注听取，不自动认同 |
| `debate-round-1-fact` | Hamilton | debate-speech | 把税负与贸易限制也算进去。 | reflect → reflect | Loyalist 怀疑审视；失败/成功反馈另按实际成绩 |
| `debate-round-1-principle` | Hamilton | debate-speech | 承担代价的人应有决定权。 | assertive → calm | Loyalist 怀疑审视；失败/成功反馈另按实际成绩 |
| `debate-round-1-attack` | Hamilton | debate-speech | 你为何只计算改变的代价？ | assertive → calm | Loyalist 怀疑审视；失败/成功反馈另按实际成绩 |
| `debate-round-1-crowd` | Hamilton | debate-speech | 让码头的人说说他们的账本。 | assertive → calm | Loyalist 怀疑审视；失败/成功反馈另按实际成绩 |
| `debate-round-2-argument` | Loyalist / 保皇派 | debate-speech | 帝国的议会已经替各地考虑过了。若每座港口都要求自己决定，法律还剩下什么？ | assertive → calm | 专注听取，不自动认同 |
| `debate-round-2-fact` | Hamilton | debate-speech | 把殖民地的代表席位列出来。 | reflect → reflect | Loyalist 怀疑审视；失败/成功反馈另按实际成绩 |
| `debate-round-2-principle` | Hamilton | debate-speech | 服从法律，也应参与制定。 | assertive → calm | Loyalist 怀疑审视；失败/成功反馈另按实际成绩 |
| `debate-round-2-attack` | Hamilton | debate-speech | 考虑过，不等于听过我们的声音。 | assertive → calm | Loyalist 怀疑审视；失败/成功反馈另按实际成绩 |
| `debate-round-2-crowd` | Hamilton | debate-speech | 谁愿意让别人决定自己的税？ | assertive → calm | Loyalist 怀疑审视；失败/成功反馈另按实际成绩 |
| `debate-round-3-argument` | Loyalist / 保皇派 | debate-speech | 倡议革命的人只会写文章。等粮食短缺，他们会让穷人承担后果。 | assertive → calm | 专注听取，不自动认同 |
| `debate-round-3-fact` | Hamilton | debate-speech | 补给方案与责任人必须公开。 | reflect → reflect | Loyalist 怀疑审视；失败/成功反馈另按实际成绩 |
| `debate-round-3-principle` | Hamilton | debate-speech | 自由不能只属于有余粮的人。 | assertive → calm | Loyalist 怀疑审视；失败/成功反馈另按实际成绩 |
| `debate-round-3-attack` | Hamilton | debate-speech | 你也没给穷人留下别的出路。 | assertive → calm | Loyalist 怀疑审视；失败/成功反馈另按实际成绩 |
| `debate-round-3-crowd` | Hamilton | debate-speech | 请工人和店主自己提出条件。 | assertive → calm | Loyalist 怀疑审视；失败/成功反馈另按实际成绩 |
| `debate-round-4-argument` | Loyalist / 保皇派 | debate-speech | 驻军只为保护秩序。既然你们没有做错什么，为何害怕更多巡逻？ | assertive → calm | 专注听取，不自动认同 |
| `debate-round-4-fact` | Hamilton | debate-speech | 检查驻军的权限与费用。 | reflect → reflect | Loyalist 怀疑审视；失败/成功反馈另按实际成绩 |
| `debate-round-4-principle` | Hamilton | debate-speech | 权力仍需得到被治理者同意。 | assertive → calm | Loyalist 怀疑审视；失败/成功反馈另按实际成绩 |
| `debate-round-4-attack` | Hamilton | debate-speech | 要求解释，何时成了认错？ | assertive → calm | Loyalist 怀疑审视；失败/成功反馈另按实际成绩 |
| `debate-round-4-crowd` | Hamilton | debate-speech | 请居民讲讲巡逻带来的变化。 | assertive → calm | Loyalist 怀疑审视；失败/成功反馈另按实际成绩 |
| `debate-round-5-argument` | Loyalist / 保皇派 | debate-speech | 帝国拥有舰队和资金。你们连统一的军需账册都没有，却要把大家带进战争。 | assertive → calm | 专注听取，不自动认同 |
| `debate-round-5-fact` | Hamilton | debate-speech | 统一账册，逐项落实补给。 | reflect → reflect | Loyalist 怀疑审视；失败/成功反馈另按实际成绩 |
| `debate-round-5-principle` | Hamilton | debate-speech | 危险不能取消选择的权利。 | assertive → calm | Loyalist 怀疑审视；失败/成功反馈另按实际成绩 |
| `debate-round-5-attack` | Hamilton | debate-speech | 你的胜算只是让我们永远服从。 | assertive → calm | Loyalist 怀疑审视；失败/成功反馈另按实际成绩 |
| `debate-round-5-crowd` | Hamilton | debate-speech | 把愿意承担的工作写在这里。 | assertive → calm | Loyalist 怀疑审视；失败/成功反馈另按实际成绩 |
| `debate-round-6-argument` | Loyalist / 保皇派 | debate-speech | 即使赢了，谁能保证新掌权的人更好？你们只是把一种不确定换成另一种。 | assertive → calm | 专注听取，不自动认同 |
| `debate-round-6-fact` | Hamilton | debate-speech | 将任期与问责写进制度。 | reflect → reflect | Loyalist 怀疑审视；失败/成功反馈另按实际成绩 |
| `debate-round-6-principle` | Hamilton | debate-speech | 让人民保留更换掌权者的权利。 | assertive → calm | Loyalist 怀疑审视；失败/成功反馈另按实际成绩 |
| `debate-round-6-attack` | Hamilton | debate-speech | 没有保证，不等于现状无需改变。 | assertive → calm | Loyalist 怀疑审视；失败/成功反馈另按实际成绩 |
| `debate-round-6-crowd` | Hamilton | debate-speech | 把你们不愿再接受的事说出来。 | assertive → calm | Loyalist 怀疑审视；失败/成功反馈另按实际成绩 |
| `washington-offer-base-1` | Washington | dialogue | 我看过你的文章。你能把事情写清楚。但军中需要的，还有把事情做完。 | reflect → reflect | 安静等待对方思考 |
| `washington-offer-base-2` | Hamilton | dialogue | 我希望带兵。我的能力不该只留在信纸上。 | assertive → calm | 专注听取，不自动认同 |
| `washington-offer-base-3` | Washington | dialogue | 军令、情报、补给。写错一个地点，也会有人付出代价。我需要副官。你愿意从这里开始吗？ | command → command | 稳住聆听，准备行动 |
| `washington-offer-variant-1-1` | Washington | dialogue | 你的文章已经传进军营。我也听说了街上的争论。让别人注意你，你很擅长；让别人依靠你，是另一回事。 | concern → concern | 认真承接担忧或警告 |
| `washington-offer-variant-1-2` | Hamilton | dialogue | 那么给我一支队伍。我愿意用行动证明。 | assertive → calm | 专注听取，不自动认同 |
| `washington-offer-variant-1-3` | Washington | dialogue | 先做我的副官。军令、情报和补给，也决定着一支队伍能不能回来。你愿意承担吗？ | command → command | 稳住聆听，准备行动 |
| `washington-accept-selected` | Hamilton | player-option | 接受副官职位，先完成眼前的责任。 | approve → approve | 接受善意，小幅缓和 |
| `washington-accept-reply-1` | Washington | dialogue | 很好。今晚有几封信，不能等到明天。 | approve → approve | 接受善意，小幅缓和 |
| `washington-negotiate-selected` | Hamilton | player-option | 接受，同时明确争取未来的指挥机会。 | assertive → calm | 专注听取，不自动认同 |
| `washington-negotiate-reply-1` | Washington | dialogue | 我听清了你的要求。你也要听清我的：用现在的职责，证明我能交给你下一份职责。 | command → command | 稳住聆听，准备行动 |
| `washington-demand-selected` | Hamilton | player-option | 我属于战场，应当立刻得到指挥权。 | assertive → calm | 专注听取，不自动认同 |
| `washington-demand-reply-1` | Washington | dialogue | 这里没有人只凭“应当”获得命令权。今晚你仍然从这些军令开始。 | concern → concern | 认真承接担忧或警告 |
| `washington-dispatch-base-1` | Washington | dialogue | 北线的部队需要补给。驻地、出发时间、目的地都在这些报告里。给军需官一份能够执行的命令。 | command → command | 稳住聆听，准备行动 |
| `washington-dispatch-base-2` | Hamilton | dialogue | 一页纸。不能让收信人猜测，也不能让他在一段漂亮文字里寻找自己的任务。 | reflect → reflect | 安静等待对方思考 |
| `dispatch-north-supplies` | Hamilton | dispatch-text | 运送面粉二十桶、药品两箱。 | reflect → reflect | 安静等待对方思考 |
| `dispatch-north-position` | Hamilton | dispatch-text | 接收地点为北线河岸营地。 | reflect → reflect | 安静等待对方思考 |
| `dispatch-north-time` | Hamilton | dispatch-text | 明日拂晓前必须抵达。 | reflect → reflect | 安静等待对方思考 |
| `dispatch-north-troops` | Hamilton | dispatch-text | 由军需官率一队士兵护送车队。 | reflect → reflect | 安静等待对方思考 |
| `dispatch-north-objective` | Hamilton | dispatch-text | 首先解除北线断粮的危险。 | reflect → reflect | 安静等待对方思考 |
| `dispatch-medical-position` | Hamilton | dispatch-text | 旧石桥受损，东岸渡口仍可通行。 | reflect → reflect | 安静等待对方思考 |
| `dispatch-medical-troops` | Hamilton | dispatch-text | 医官带担架队经渡口护送伤员。 | reflect → reflect | 安静等待对方思考 |
| `dispatch-medical-objective` | Hamilton | dispatch-text | 优先将重伤员转移到后方医院。 | reflect → reflect | 安静等待对方思考 |
| `dispatch-medical-supplies` | Hamilton | dispatch-text | 携带绷带、饮水与两辆空车。 | reflect → reflect | 安静等待对方思考 |
| `dispatch-medical-time` | Hamilton | dispatch-text | 今晚日落前完成转移。 | reflect → reflect | 安静等待对方思考 |
| `dispatch-muster-time` | Hamilton | dispatch-text | 后日清晨六时前完成准备。 | reflect → reflect | 安静等待对方思考 |
| `dispatch-muster-objective` | Hamilton | dispatch-text | 首要任务是保障各队准时集结。 | reflect → reflect | 安静等待对方思考 |
| `dispatch-muster-position` | Hamilton | dispatch-text | 集结地在磨坊以南的空地。 | reflect → reflect | 安静等待对方思考 |
| `dispatch-muster-supplies` | Hamilton | dispatch-text | 每队领取两日口粮并核对弹药。 | reflect → reflect | 安静等待对方思考 |
| `dispatch-muster-troops` | Hamilton | dispatch-text | 传令兵通知各队队长清点人数。 | reflect → reflect | 安静等待对方思考 |
| `yorktown-command-base-1` | Eliza / 记录者 | dialogue | 1781 年，法美联军围困约克镇。数年的行军、军令与争执，终于把汉密尔顿带到一座英军堡垒前。 | turn → reflect | 安静承接时序转折 |
| `yorktown-command-base-2` | Washington | dialogue | 你得到这次指挥机会。我要看到的，是一个能对整支队伍负责的军官。严格执行计划，别把它变成你一个人的证明。 | concern → concern | 认真承接担忧或警告 |
| `yorktown-command-base-3` | Hamilton | dialogue | 我明白。等了这么久，我不能只想着自己如何被看见。 | concern → concern | 认真承接担忧或警告 |
| `yorktown-command-variant-1-1` | Eliza / 记录者 | dialogue | 1781 年，法美联军围困约克镇。数年的行军与军令，把汉密尔顿带到一座英军堡垒前。 | turn → reflect | 安静承接时序转折 |
| `yorktown-command-variant-1-2` | Washington | dialogue | 你证明了自己能承担责任。这支队伍交给你。按计划行动；现场需要判断时，我相信你知道命令背后的目的。 | approve → approve | 接受善意，小幅缓和 |
| `yorktown-command-variant-1-3` | Hamilton | dialogue | 这一次，纸上的名字会和我一起向前。我会记住，他们要跟随的不是一句漂亮的话。 | concern → concern | 认真承接担忧或警告 |
| `yorktown-coordinate-selected` | Hamilton | player-option | 核对各队的职责，等共同信号再推进。 | command → command | 稳住聆听，准备行动 |
| `yorktown-coordinate-reply-1` | Hamilton | dialogue | 每一队都要知道身旁的人在哪里。听到信号，一起前进。 | command → command | 稳住聆听，准备行动 |
| `yorktown-lead-selected` | Hamilton | player-option | 我走在最前面，你们跟紧。 | command → command | 稳住聆听，准备行动 |
| `yorktown-lead-reply-1` | Hamilton | dialogue | 我会先走出去。但看清信号，别因为跟随我而忘了自己的位置。 | command → command | 稳住聆听，准备行动 |
| `yorktown-rally-selected` | Hamilton | player-option | 说明共同目标，让每个人知道为何出发。 | command → command | 稳住聆听，准备行动 |
| `yorktown-rally-reply-1` | Hamilton | dialogue | 我们要打开围城的一道缺口。记住身边的人，记住回来的路。现在，各就各位。 | command → command | 稳住聆听，准备行动 |
| `yorktown-command-1` | Hamilton | battle-command | 推进 | command → command | 稳住聆听，准备行动 |
| `yorktown-command-2` | Hamilton | battle-command | 稳住阵形 | command → command | 稳住聆听，准备行动 |
| `yorktown-command-3` | Hamilton | battle-command | 左翼包抄 | command → command | 稳住聆听，准备行动 |
| `yorktown-command-4` | Hamilton | battle-command | 推进 | command → command | 稳住聆听，准备行动 |
| `yorktown-command-5` | Hamilton | battle-command | 右翼支援 | command → command | 稳住聆听，准备行动 |
| `yorktown-command-6` | Hamilton | battle-command | 等待友军 | command → command | 稳住聆听，准备行动 |
| `yorktown-command-7` | Hamilton | battle-command | 侧翼接应 | command → command | 稳住聆听，准备行动 |
| `yorktown-command-8` | Hamilton | battle-command | 越过土垒 | command → command | 稳住聆听，准备行动 |
| `yorktown-command-9` | Hamilton | battle-command | 保持联系 | command → command | 稳住聆听，准备行动 |
| `yorktown-command-10` | Hamilton | battle-command | 重新集结 | command → command | 稳住聆听，准备行动 |
| `yorktown-command-11` | Hamilton | battle-command | 进入堡垒 | command → command | 稳住聆听，准备行动 |
| `yorktown-command-12` | Hamilton | battle-command | 守住阵地 | command → command | 稳住聆听，准备行动 |
| `yorktown-surrender-base-1` | Eliza / 记录者 | dialogue | 汉密尔顿率队攻下十号堡垒，法军攻下相邻的九号堡垒。围城继续收紧。 | write → write | 沉思回忆 |
| `yorktown-surrender-base-2` | Eliza / 记录者 | dialogue | 数日后，英军在约克镇投降。胜利来自许多人的共同作战。战争尚未正式结束，但局势已经改变。 | turn → reflect | 安静承接时序转折 |
| `yorktown-surrender-base-3` | Hamilton | dialogue | 那些从前只能写进信里的愿望，现在终于有了重量。明天，还会有人问，我们准备拿这个胜利做什么。 | concern → concern | 认真承接担忧或警告 |
| `discovery-letter-name-base-1` | Eliza / 记录者 | dialogue | 翻过信纸，背面留着几次试写的姓名。墨迹有深有浅，最后一次落笔格外清楚。 | write → write | 沉思回忆 |
| `discovery-letter-name-base-2` | Hamilton | dialogue | 亚历山大·汉密尔顿。先把名字写稳，再让人记住它。 | assertive → calm | 专注听取，不自动认同 |
| `discovery-letter-name-repeat-1` | Hamilton | dialogue | 这个名字已经写下。下一页，要写什么？ | reflect → reflect | 安静等待对方思考 |
| `discovery-arrival-scattered-paper-base-1` | Hamilton | dialogue | 等等，你还少了这几张。我替你压住它们。 | approve → approve | 接受善意，小幅缓和 |
| `discovery-arrival-scattered-paper-base-2` | Newsboy / 报童 | dialogue | 多谢！你就是刚才买报的先生。我会记得你的名字。 | approve → approve | 接受善意，小幅缓和 |
| `discovery-arrival-scattered-paper-base-3` | Hamilton | dialogue | 汉密尔顿。希望下次让你忙起来的，是值得传开的消息。 | approve → approve | 接受善意，小幅缓和 |
| `discovery-arrival-scattered-paper-repeat-1` | Newsboy / 报童 | dialogue | 报纸都收好了，汉密尔顿先生！这一回，风抢不过我。 | approve → approve | 接受善意，小幅缓和 |
| `discovery-arrival-burr-margin-base-1` | Hamilton | dialogue | 你在这句旁边写了问号：谁来承担代价？ | reflect → reflect | 安静等待对方思考 |
| `discovery-arrival-burr-margin-base-2` | Burr | dialogue | 一句话让自己满意很容易。试试让付出代价的人也愿意听下去。 | reflect → reflect | 安静等待对方思考 |
| `discovery-arrival-burr-margin-repeat-1` | Burr | dialogue | 问号还在这里。写出答案之前，不必急着擦掉它。 | reflect → reflect | 安静等待对方思考 |
| `discovery-arrival-burr-margin-ask-selected` | Hamilton | player-option | 请指出我还没有回答的部分。 | reflect → reflect | 安静等待对方思考 |
| `discovery-arrival-burr-margin-ask-reply-1` | Burr | dialogue | 从他们最具体的担忧开始。你愿意改进论据，我愿意继续听。 | approve → approve | 接受善意，小幅缓和 |
| `discovery-arrival-burr-margin-challenge-selected` | Hamilton | player-option | 下一次，把这个问题当面抛给我。 | assertive → calm | 专注听取，不自动认同 |
| `discovery-arrival-burr-margin-challenge-reply-1` | Burr | dialogue | 好。我会认真准备。你最好也给答案留一点准备的时间。 | challenge → challenge | 正视对方，保持张力 |
| `discovery-tavern-unfinished-draft-base-1` | Eliza / 记录者 | dialogue | 空桌上留着一张草稿，末行只有半句：如果我们的声音值得被听见…… | reflect → reflect | 安静等待对方思考 |
| `discovery-tavern-unfinished-draft-base-2` | Hamilton | dialogue | 这里还缺一句愿意公开承担的话。 | reflect → reflect | 安静等待对方思考 |
| `discovery-tavern-unfinished-draft-repeat-1` | Hamilton | dialogue | 最后一行写完了。到了广场，就没有纸张替我挡住目光。 | assertive → calm | 专注听取，不自动认同 |
| `discovery-tavern-unfinished-draft-complete-selected` | Hamilton | player-option | 就把主张说清，也让人追问。 | assertive → calm | 专注听取，不自动认同 |
| `discovery-tavern-unfinished-draft-complete-reply-1` | Hamilton | dialogue | 写在纸上还不够。我会把这句话带到街上。 | assertive → calm | 专注听取，不自动认同 |
| `discovery-square-bread-and-prices-base-1` | Hamilton | dialogue | 这张账单上的面包和运费，都被重新改过。你最担心哪一项？ | concern → concern | 认真承接担忧或警告 |
| `discovery-square-bread-and-prices-base-2` | Citizen / 市民 | dialogue | 我担心付完今天的钱，明天又不够。你们谈未来时，也把这一餐算进去。 | concern → concern | 认真承接担忧或警告 |
| `discovery-square-bread-and-prices-base-3` | Hamilton | dialogue | 我记住了。你不该先放下自己的生活，才有资格谈自由。 | approve → approve | 接受善意，小幅缓和 |
| `discovery-square-bread-and-prices-repeat-1` | Citizen / 市民 | dialogue | 账单还在，问题也是。谢谢你先问了我们的日子。 | approve → approve | 接受善意，小幅缓和 |
| `discovery-square-bread-and-prices-inactive-1` | Citizen / 市民 | dialogue | 争论散了，明天还是要开门做生意。我会看你们怎样兑现说过的话。 | calm → calm | 平静陪伴 |
| `discovery-camp-misfiled-dispatch-base-1` | Hamilton | dialogue | 外封写着北侧驻地，正文却让车队往东。我得先核对，再送出去。 | reflect → reflect | 安静等待对方思考 |
| `discovery-camp-misfiled-dispatch-base-2` | Washington | dialogue | 正文才是这批补给的目的地。发现一处不一致，就先把它弄清楚。 | reflect → reflect | 安静等待对方思考 |
| `discovery-camp-misfiled-dispatch-repeat-1` | Hamilton | dialogue | 便条已经核对。下一封也要经得起同样的检查。 | reflect → reflect | 安静等待对方思考 |
| `discovery-camp-misfiled-dispatch-inactive-1` | Washington | dialogue | 这一批便条已经归档。记住：地点和时间，都要让收信人看得明白。 | reflect → reflect | 安静等待对方思考 |
| `discovery-camp-misfiled-dispatch-correct-selected` | Hamilton | player-option | 修正外封，标明核对后的目的地。 | reflect → reflect | 安静等待对方思考 |
| `discovery-camp-misfiled-dispatch-correct-reply-1` | Hamilton | dialogue | 现在内外一致了。收信人不必替我们猜测。 | approve → approve | 接受善意，小幅缓和 |
| `discovery-camp-misfiled-dispatch-correct-reply-2` | Washington | dialogue | 很好。可靠，常常从这种小处开始。 | approve → approve | 接受善意，小幅缓和 |
| `discovery-letter-name-echo-base-1` | Hamilton | dialogue | 当初在信纸背面写这个名字，只盼着有人记住。 | reflect → reflect | 安静等待对方思考 |
| `discovery-letter-name-echo-base-2` | Hamilton | dialogue | 现在，名字落在军令下面。有人会照着它出发，也有人在等他们回来。 | concern → concern | 认真承接担忧或警告 |
| `discovery-letter-name-echo-repeat-1` | Hamilton | dialogue | 同一个名字，已经承担了不同的重量。 | concern → concern | 认真承接担忧或警告 |
| `discovery-letter-name-echo-inactive-1` | Hamilton | dialogue | 这张文件还留着签名的位置。落笔以前，先确认每一处细节。 | reflect → reflect | 安静等待对方思考 |
| `discovery-burr-respect-base-1` | Hamilton | dialogue | 你认为我的论据站得住吗？我想听具体的。 | reflect → reflect | 安静等待对方思考 |
| `discovery-burr-respect-base-2` | Burr | dialogue | 你愿意让人追问，这一点站得住。接下来，把每项主张和承担它的人连起来。 | approve → approve | 接受善意，小幅缓和 |
| `discovery-burr-respect-base-3` | Hamilton | dialogue | 我会继续补全。也请你继续指出空缺。 | approve → approve | 接受善意，小幅缓和 |
| `discovery-burr-respect-variant-1-1` | Hamilton | dialogue | 你在页边留下的问号，我一直记得。今天，我回答得更完整了吗？ | reflect → reflect | 安静等待对方思考 |
| `discovery-burr-respect-variant-1-2` | Burr | dialogue | 你开始把听众的顾虑放进论证了。接下来，让每项主张都找到愿意承担它的人。 | approve → approve | 接受善意，小幅缓和 |
| `discovery-burr-respect-variant-1-3` | Hamilton | dialogue | 那么，把新的问号也留下吧。 | approve → approve | 接受善意，小幅缓和 |
| `discovery-burr-respect-repeat-1` | Burr | dialogue | 肯继续修正论据的人，值得继续听。 | approve → approve | 接受善意，小幅缓和 |
| `discovery-burr-rivalry-base-1` | Hamilton | dialogue | 下一次，由你来回应我？你总不能一直站在场边。 | assertive → calm | 专注听取，不自动认同 |
| `discovery-burr-rivalry-base-2` | Burr | dialogue | 可以。但我会挑你最不愿停下来回答的问题。 | challenge → challenge | 正视对方，保持张力 |
| `discovery-burr-rivalry-base-3` | Hamilton | dialogue | 那就带着问题来。我会带着答案。 | assertive → calm | 专注听取，不自动认同 |
| `discovery-burr-rivalry-variant-1-1` | Hamilton | dialogue | 页边的挑战还算数。下一次，由你来回应我？ | assertive → calm | 专注听取，不自动认同 |
| `discovery-burr-rivalry-variant-1-2` | Burr | dialogue | 我记得。也已经开始准备。别把我没有抢着开口，当成我无话可说。 | challenge → challenge | 正视对方，保持张力 |
| `discovery-burr-rivalry-variant-1-3` | Hamilton | dialogue | 好。那我也不能停在今天的答案上。 | assertive → calm | 专注听取，不自动认同 |
| `discovery-burr-rivalry-repeat-1` | Burr | dialogue | 约定还在。我们都还有准备的时间。 | challenge → challenge | 正视对方，保持张力 |
| `echo-square-paper-recognition` | Citizen / 市民 | dialogue | 你就是帮报童收过纸的人吧？我记得你的名字。说吧，我们听着。 | approve → approve | 接受善意，小幅缓和 |
| `echo-square-influence-recognition` | Citizen / 市民 | dialogue | 汉密尔顿？有人向我提起过你。我愿意先听听你的回答。 | approve → approve | 接受善意，小幅缓和 |
| `echo-square-draft-courage` | Hamilton | dialogue | 酒馆里那句写完的话，该拿出来接受追问了。 | assertive → calm | 专注听取，不自动认同 |
| `echo-square-high-momentum` | Hamilton | dialogue | 我会走到人群面前，把主张说清楚。 | assertive → calm | 专注听取，不自动认同 |
| `echo-square-low-momentum` | Hamilton | dialogue | 先把他们的问题听完整。稳稳地回答，也是一种承担。 | reflect → reflect | 安静等待对方思考 |
| `echo-square-bread-recall` | Citizen / 市民 | dialogue | 刚才账单上的那一餐，请记得放进你的答案里。 | concern → concern | 认真承接担忧或警告 |
| `echo-camp-detail-recall` | Washington | dialogue | 你核对过那张便条。现在，让每一份军令都经得起同样的检查。 | reflect → reflect | 安静等待对方思考 |
| `echo-camp-duty-trust` | Washington | dialogue | 你愿意承担眼前的职责，我就从这几封军令开始相信你。 | approve → approve | 接受善意，小幅缓和 |
| `echo-yorktown-detail-recall` | Washington | dialogue | 你从核对一张便条开始证明可靠。今晚，同样的细心也要跟着队伍出发。 | approve → approve | 接受善意，小幅缓和 |
| `echo-yorktown-high-momentum` | Hamilton | dialogue | 我争取这一刻很久了。现在，我会让这份勇气带着责任一起向前。 | command → command | 稳住聆听，准备行动 |
| `echo-yorktown-low-momentum` | Hamilton | dialogue | 不必抢过每个人的脚步。我要把他们一起带到目标前。 | reflect → reflect | 安静等待对方思考 |
| `small-talk-newsboy` | Newsboy / 报童 | dialogue | 先别把报纸折起来，墨还没干呢。 | calm → calm | 平静陪伴 |
| `small-talk-citizen` | Citizen / 市民 | dialogue | 码头的风总能钻进袖口里。 | calm → calm | 平静陪伴 |
| `small-talk-loyalist` | Loyalist / 保皇派 | dialogue | 我刚把纸理齐，风又把它们吹乱了。 | calm → calm | 平静陪伴 |
| `small-talk-burr` | Burr | dialogue | 难得有一会儿安静。让我把这杯茶喝完。 | calm → calm | 平静陪伴 |
| `small-talk-laurens` | Laurens | dialogue | 这张桌子有点晃。也许垫一张折好的纸就行。 | calm → calm | 平静陪伴 |
| `small-talk-lafayette` | Lafayette | dialogue | 这里的面包很硬，不过蘸进汤里就好多了。 | amused → amused | 浅笑或放松，不强迫大笑 |
| `small-talk-mulligan` | Mulligan | dialogue | 袖口松了线就来找我，别等它整片掉下来。 | approve → approve | 接受善意，小幅缓和 |
| `small-talk-washington` | Washington | dialogue | 咖啡又凉了。这里的杯子似乎从来留不住热气。 | calm → calm | 平静陪伴 |

## 审计验证与限制

- 初次审计的 202 / 202 个运行时语音 cue 已有明确标记；0.4.0 的现行数量与新报纸原文见文末复核。每个说话态度都存在于对应角色姿态清单中。无第 11 个说话角色。
- 初次审计时无配音缺口；0.4.0 后新增的 3 条原文尚待录音，5 个脚本位置采用静音表演。此处保留初次立绘审计记录。若后续改剧本，需重新导出台本并补该句的态度标记，不能将本文固定数量当成永久上限。
- 制作前审计确定的 41 个姿态组已落实为 59 帧正式素材并接入；本表保留审计依据，最终素材与回归结果见交付记录。
- 数据链：源码实际台词和结果 → 稳定 cue / 当前交互与分支 → 说话态度、句后姿态、听者态度 → 角色各自像素姿态与开口帧 → 音频生命周期及真实游戏反馈驱动展示。

## 运行时映射交付 / Runtime Mapping

- 已实现 `src/data/dialoguePerformance.ts`。初次审计以明确的 202 个 cue id 登记表演；0.4.0 的 `DIALOGUE_PERFORMANCE_AUDIT` 对应 198 个录音 catalog cue，另由 `SOURCE_DIALOGUE_PERFORMANCE_AUDIT` 保留 3 条未录音新原文的明确表演。不按台词关键词猜情绪；`getDialoguePerformance(line, partner)` 使用精确英文或中文原文查找，双语字幕模式不会改变表演。
- 运行时姿态与 `src/data/mainPixelArt.ts` 的 41 个闭口／非嘴型姿态、18 个基础开口帧清单对齐；Eliza 的「书写」键统一为 `write`。
- `getActivityReaction(activity, outcome)` 接收游戏实际给出的 `success / miss / neutral`，为辩论、军令、约克镇返回有区别的闭口反馈。调用者负责按真实结果选择，不以台词推断成绩。
- `tests/dialogue-performance.test.ts` 新增 9 项测试，覆盖全部 202 个 cue、每句与十位对手组合的姿态存在性、四语言模式及精确中英原文同结果、尊重／挑战和信任／训诫分支、失败／成功反馈、未知台词安全默认。
- 已通过 `node --import tsx --test tests/dialogue-performance.test.ts` 与 `npx tsc --noEmit`。此验证只证明映射完整和类型正确；最终生成素材质量、渲染与游戏接入仍按主任务回归记录。

### 句后反应可感知性复核

基础说话循环只包含每人已绘制的闭口、普通开口与强调口型。为让独立态度图在正常配音下确实可见，Lafayette 面包闲聊结束后保持 `amused` 浅笑；Hamilton 的 19 条指挥表演与 Washington 的 4 条职责交付表演结束后保持 `command` 方向手势，直到下一句或小游戏真实反馈接管。普通坚定论证仍收为 `calm`。此处没有声称独立情绪图都具备各自嘴型。

已补测试验证全部 23 条 command 表演有可停留的句后姿态，并验证 Lafayette 闲聊笑意不会在基础说话循环结束时丢失。

## 全流程接入回归 / Integration Regression

截至本轮检查，十位人物正式原图已在 `public/art/main-pixel/v1/`，浏览器确认十位角色全部使用真实主像素 atlas，不依赖回退人物。此处记录流程证据，抠像边界质量另由素材专项检查验收。

- `npm test`：166 / 166 通过；`npm run build` 通过，包含 77 个源码文件的双语配对与参数检查。
- `scripts/dialogue-portraits-check.mjs`：6 组完整检查通过，页面错误与资源失败均为 0。覆盖十人实际素材、左右相向、发言者单独高亮、听者实际灰黑像素、口型变化、暂停／恢复／减少动态、音频交接、过期事件无效、静音有限表演和四种语言的 1280 / 1024 / 390 宽度布局。
- 静音回归已从旧的「直接跳过选中台词」断言，更新为更完整的「Hamilton 选中台词 → 对方回复 → 闭口句后反应」顺序检查，并验证不新增音频、不自动推进、不循环重播。初次出现的旧断言失败属于预期设计变更；最终通过记录为 `artifacts/dialogue-portraits-check.json`。
- `scripts/story3d-check.mjs` 的失败路线完整通过：真实步行经历六章、十二主线交互及三个小游戏，失误、零分、暂停、章节重开、闲聊重复、结果持久化均可继续到结局；没有页面错误或资源失败。证据为 `artifacts/story3d-check-failure.json`。

- `HAMILTON_ROUTE=success` 的完整主流程也已通过，同样真实走完六章、十二交互、三个小游戏、结局和新周目清理；辩论 100、军令 100、约克镇 88，最终 Washington 信任 38。页面错误和资源失败均为 0，证据为 `artifacts/story3d-check-success.json`。与失败路线一起覆盖成功／失误结果反应及不同信任状态，完整报告各自保存。

## 0.4.0 报纸拾取与归还台词复核 / Newspaper Dialogue Review

新版报纸事件分为酒馆后的即时拾取与报童处的归还对话。新增原文尚未生成配音，运行时按精确文字查找，不能播放旧版不同措辞的录音。`SOURCE_DIALOGUE_PERFORMANCE_AUDIT` 独立记录新台词的态度；历史录音保留原文映射，供已有素材审查使用。

| 新原文 / Current source | 说话与句后 / Speaking and settled | 听者 / Listener |
| --- | --- | --- |
| 报纸被风吹走了好多页，这下赚不到钱了...... / The wind blew away so many pages. Now I will not earn any money...... | 报童 `calm → calm`；当前图集没有担忧专用帧，使用收敛的中性姿态 / restrained neutral pose | Hamilton `concern` |
| 我在酒馆后面找到了这些报纸。拿好，别再让风抢走了。 / I found these pages behind the tavern. Hold them tight so the wind cannot snatch them again. | Hamilton `approve → approve` | 报童 / Newsboy `approve` |
| 谢谢您先生！我会记住您的名字 / Thank you, sir! I will remember your name | 报童 `approve → approve`；归还后闲聊复用同一原文 / same source for later chat | Hamilton `approve` |

保留的 Hamilton 自我介绍沿用已审核的 `approve → approve`。以上新增台词不启用强调或大笑，中文、英文及双语模式共用同一份表演。新增测试覆盖两种原文与双语对象的精确映射，以及未生成台词不会误播旧录音。


## 0.4.0 真实覆盖范围复核 / Authored Coverage Reconciliation

共享目录中的配音导出清单曾在不同任务间更新，不能把它的总条目数当成实际对话数量。当前源码直接枚举得到 **203 个脚本播放位置，200 个「角色＋中英文原文」唯一组合**：124 个剧情位置、22 个已选选项、30 个辩论位置、15 个军令碎片、12 个战斗命令。十位角色全部有明确表演映射。

当前录音 catalog 有 **198 个 cue**；另外 **5 个脚本 cue 复用 3 条待录音的新原文**，这些新原文和表演均予保留，未生成配音：

| 脚本 cue / Playback location | 对应新原文 / Reviewed original |
| --- | --- |
| `discovery-arrival-scattered-paper-base-1` | Hamilton 交还报纸 / Hamilton returns the pages |
| `discovery-arrival-scattered-paper-base-2` | 报童感谢 / Newsboy thanks Hamilton |
| `discovery-arrival-scattered-paper-repeat-1` | 复用同一感谢 / The same thanks |
| `small-talk-newsboy` | 报童为丢失报纸烦恼 / Newsboy worries about lost pages |
| `small-talk-newsboy-thanks` | 复用同一感谢 / The same thanks |

`docs/voiceover/manifest.json` 当前包含 338 个导出条目，其中还包括幕间、选项问题、提示、反馈、结局和开发漫游。`dynamic-variants.json` 另有 169 个由成绩模板展开的派生条目（9 个反馈、160 个结局），它们不是新的实际人物台词，不应扩大主像素表演审计数量。以上文件未被本次修复改写。

覆盖测试已改为直接遍历游戏的章节、所有剧情变体、选项与回复、支线基础／重复／过期分支、状态回声、闲聊、辩论、军令和战斗数据；酒馆三位角色的超时句通过真实 `StoryProgress` 超时路径取得。录音导出与派生结果文件不再决定测试的覆盖分母。每个脚本位置都必须找到精确原文对应的录音审计或独立新原文审计，不能凭存在录音或默认姿态蒙混通过。

同时明确断言 203 个位置、200 组唯一原文、各类型数量、5 个待录音位置与 3 条新原文的完整一一覆盖。所有 203 个位置都执行十位对手姿态存在性和四语言／中英原文一致性检查。针对测试 **10 / 10 通过**，`npx tsc --noEmit` 通过。版本保持 **0.4.0**，未修改任何版本归档、运行时代码或配音文件。
