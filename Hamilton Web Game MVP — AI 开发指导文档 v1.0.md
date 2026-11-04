# Hamilton Web Game MVP
## AI Development Specification v1.0

### 0. 文档用途

本文件是本项目 MVP 的最高优先级开发规格。

AI Coding Agent 应：

1. 优先完成可玩的完整闭环，而不是增加功能。
2. 不自行扩展章节、角色、地图或系统。
3. 所有剧情文本重新创作，不直接复制音乐剧台词或歌词。
4. 所有美术使用原创设计，不模仿 Broadway 演员肖像、官方 Logo 或具体舞台布景。
5. 所有音乐采用原创、明确获得 Web Game 使用权的音乐或临时占位音乐。
6. 第一版本必须能够从标题页连续游玩至 Ending，不允许只有若干独立 Demo Scene。

---

# 1. 产品定义

## 1.1 项目定位

暂定内部项目名：

**PROJECT HAMILTON — 1776**

类型：

**Narrative Action Game / Rhythm Dialogue / Light Strategy**

平台：

**Desktop Web**

目标游戏时长：

**20–30 分钟**

玩家角色：

**Alexander Hamilton**

核心体验不是传统战斗，而是：

> Hamilton 通过说话、写作、行动和政治选择不断获得影响力，同时逐渐塑造自己与 Burr、Washington 以及“历史”的关系。

MVP 只表现 Hamilton 从抵达纽约到 Yorktown 战役胜利这一时期。

---

# 2. MVP 要证明的三个命题

整个开发过程中，任何功能都应该服务于以下三个问题。

## 命题 A：语言能否成为“战斗”

玩家应该明显感觉：

**Hamilton 的主要武器不是枪，而是语言。**

通过 Debate System，使表达、论证、节奏与攻击性产生类似战斗游戏的爽感。

---

## 命题 B：Hamilton 的性格能否成为游戏机制

核心属性：

### MOMENTUM

代表 Hamilton：

- 野心
- 行动力
- 表达欲
- 不愿错失机会
- 不愿沉默

Momentum 高不是单纯“好”。

它会：

+ 增强 Debate
+ 解锁激进选项
+ 提升政治存在感

同时：

+ 增加 Burr Rivalry
+ 更容易违抗 Washington
+ 诱导玩家不断采取冒险行为

玩家应该逐渐意识到：

> Hamilton 最大的优势，同时也是其悲剧人格的一部分。

---

## 命题 C：剧情选择是否产生长期反馈

玩家不能感觉选择只是换一句 NPC 台词。

每个重要选择至少改变：

- 一个数值
- 一段后续对话
- 或一个后续 gameplay modifier

---

# 3. MVP 范围

游戏包含：

1. Opening
2. Arrival in New York
3. Tavern
4. Public Debate
5. Washington
6. Yorktown
7. Results

共约 20–30 分钟。

明确不开发：

- Eliza 恋爱线
- Angelica
- Reynolds Affair
- Cabinet Battle
- Presidency
- Election of 1800
- Hamilton–Burr 最终决斗
- 开放世界
- 背包
- 装备
- 技能树
- 存档系统
- 多周目
- 账号
- 后端
- 联机
- 成就
- 手机完整适配

这些属于 Full Game，不属于 MVP。

---

# 4. 技术方案

推荐：

### Engine
Phaser 3

### Language
TypeScript

### Build
Vite

### Rendering
Phaser Canvas/WebGL

### Data
JSON / TypeScript configuration

### Audio
Web Audio API + Phaser Audio

### Storage
localStorage，仅保存：

- 是否完成游戏
- 音量
- 最后一次结果

不得开发服务器。

---

# 5. 项目结构

建议结构：

```text
/src
  /core
    Game.ts
    GameState.ts
    EventBus.ts

  /scenes
    BootScene.ts
    MenuScene.ts
    OpeningScene.ts
    ArrivalScene.ts
    TavernScene.ts
    DebateScene.ts
    WashingtonScene.ts
    YorktownScene.ts
    EndingScene.ts

  /systems
    DialogueSystem.ts
    ChoiceSystem.ts
    MovementSystem.ts
    DebateSystem.ts
    RhythmSystem.ts
    StateSystem.ts
    AudioSystem.ts

  /ui
    HUD.ts
    DialogueBox.ts
    ChoicePanel.ts
    DebateHUD.ts
    RelationshipIndicator.ts
    TransitionOverlay.ts

  /data
    dialogue.ts
    characters.ts
    debateCards.ts
    chapters.ts
    musicCues.ts

  /assets
    /characters
    /backgrounds
    /ui
    /audio
    /sfx

/public
```

剧情内容必须 data-driven。

禁止把大量剧情文字直接 hardcode 到 Scene 文件。

---

# 6. 全局 Game State

统一维护：

```ts
interface GameState {
  momentum: number;
  influence: number;

  burrRivalry: number;
  burrRespect: number;

  washingtonTrust: number;

  debatePerformance: number;
  yorktownPerformance: number;

  choices: Record<string, string>;
}
```

初始状态：

```text
Momentum          40
Influence         10
Burr Rivalry      10
Burr Respect      20
Washington Trust   0
```

所有数值范围：

```text
0–100
```

必须 clamp。

---

# 7. UI 原则

不要使用传统 RPG UI。

整体视觉：

**18 世纪纸张 + 墨水 + 舞台感 + 现代动态图形**

关键词：

- parchment
- ink
- newspaper
- handwritten annotation
- theatrical spotlight
- silhouette
- restrained gold
- dark wood
- revolutionary-era printing

不要：

- 卡通 Q 版
- MMORPG HUD
- 血条
- 武器栏
- Cyberpunk UI
- Broadway 官方黄色星形 Logo

---

# 8. HUD

正常探索只显示极少信息。

左上：

```text
NEW YORK
1776
```

右上只显示：

```text
MOMENTUM
██████░░░░
```

当数值变化：

```text
MOMENTUM +5
BURR RIVALRY +8
```

浮现 1.5 秒后消失。

不要持续显示五六根属性条。

玩家应感受到系统，而不是盯着 Excel 玩。

---

# 9. 基础操控

### Keyboard

```text
A / D       移动
W           互动
E           主要交互
1–4         对话 / Debate 选择
SPACE       Rhythm Action
ESC         Menu
```

鼠标可以点击对应按钮。

---

# 10. Opening

时长：

**60–90 秒**

目的：

只建立三件事情。

1. Hamilton 来自加勒比地区。
2. 写作让别人注意到了他。
3. 他来到纽约寻找机会。

表现：

黑色背景。

纸张、海浪、地图、信件、船只等图层快速拼接。

最后：

```text
NEW YORK
1776
```

Hamilton 从船上走下来。

玩家第一次获得控制权。

禁止制作十分钟背景介绍。

---

# 11. Chapter 1 — ARRIVAL

## 场景

1776 New York。

形式：

横向 2.5D 场景。

背景包括：

- 港口
- 街道
- King's College 方向
- 酒馆入口
- 报童
- 英军 / 殖民地居民

地图不超过约 3 个屏幕宽度。

---

## Gameplay

玩家移动 Hamilton。

通过 3 个环境互动学习操作：

### Interaction A
阅读新闻。

Influence 世界观教学。

### Interaction B
听街头争论。

出现革命派与 Loyalist。

### Interaction C
遇到 Aaron Burr。

---

# 12. Burr Dialogue

这是 Choice System 教学。

Burr 的人物设计：

- 冷静
- 克制
- 实用主义
- 不轻易公开立场
- 对 Hamilton 有好奇与欣赏
- 同时觉得 Hamilton 太危险

Hamilton：

- 快
- 聪明
- 急于证明自己
- 不愿保持沉默

注意：

重新创作对话。

不要复制音乐剧台词。

---

## Choice Example

Burr 建议 Hamilton：

在政治环境尚未明确时，不要太快公开自己的立场。

出现：

### A — Observe first.

效果：

```text
Momentum -5
Burr Respect +5
```

### B — Ask what Burr believes.

效果：

```text
Influence +2
Burr Respect +3
```

### C — Declare support for revolution.

效果：

```text
Momentum +10
Influence +5
Burr Rivalry +5
```

选择 C 应具有明显更强烈的视觉反馈。

让玩家自然觉得：

**“激进选择很好玩。”**

这是后续设计伏笔。

---

# 13. Chapter 2 — TAVERN

Hamilton 进入酒馆。

认识：

- John Laurens
- Lafayette
- Hercules Mulligan

本场景功能：

### 把玩家从个人故事拉入革命群体。

---

## Tavern Social Mechanic

三个角色分别抛出政治问题。

玩家快速选择回应。

每题限时约：

```text
5 秒
```

但不是答题考试。

它测的是人格。

例如：

> Britain increases military control of the colonies. What matters most?

选项：

```text
A. Stability
B. Representation
C. Independence
D. Opportunity
```

不同人物对回答有不同反应。

连续选择激进答案会增加：

```text
Momentum
Influence
```

同时背景音乐逐渐增加 percussion layer。

这建立：

### Player action → music intensification

---

# 14. Momentum 音乐机制

音乐不是静态 BGM。

每个场景提供 Layer：

```text
Layer 1 — ambience
Layer 2 — percussion
Layer 3 — bass
Layer 4 — strings
Layer 5 — rhythmic accent
```

Momentum 越高：

越多音乐层进入。

例如：

```text
0–20     ambience
21–40    + percussion
41–60    + bass
61–80    + strings
81–100   + rhythmic accents
```

因此玩家无需看 UI，也能听出：

Hamilton 正越来越进入状态。

---

# 15. Chapter 3 — PUBLIC DEBATE

这是 MVP 第一核心玩法。

Hamilton 遇到 Loyalist public speaker。

不要直接复刻 Samuel Seabury 的音乐剧台词。

可以将角色设计为：

**A Loyalist pamphleteer**

历史背景明确，但文本原创。

---

# 16. Debate System

这是本项目最重要的系统。

Debate 不应该只是：

“选择正确答案。”

而应该产生类似战斗的节奏感。

---

## 对方提出 Argument

例如：

> Breaking from Britain will destroy the colonies' economic security.

随后玩家拥有四种 Response Type：

```text
1 FACT
2 PRINCIPLE
3 ATTACK
4 CROWD
```

---

## FACT

逻辑论证。

伤害稳定。

```text
Credibility +++
Crowd ++
Momentum +
```

---

## PRINCIPLE

强调 liberty / representation。

```text
Crowd +++
Momentum ++
Credibility +
```

---

## ATTACK

攻击对方逻辑或者人格。

```text
Momentum +++
Crowd ++
Risk ++
```

失败惩罚明显。

---

## CROWD

迎合现场群众。

```text
Crowd +++
Credibility -
```

---

# 17. Debate Timing

对方说完一个 Argument 后：

屏幕出现四张卡片。

玩家有：

```text
2.5 秒
```

进行选择。

随后进入 Beat Window。

例如：

```text
|     |     |     |     |
      SPACE
```

在节拍附近按下 SPACE。

判定：

```text
PERFECT
GOOD
MISS
```

窗口应宽松。

本项目不是专业音游。

建议：

```text
Perfect ±100ms
Good    ±250ms
```

MISS 不结束游戏。

只是降低效果。

---

# 18. Debate Combo

如果连续成功：

```text
FLOW x2
FLOW x3
FLOW x4
```

字体、动画、音乐强度逐渐增加。

每次正确回应让：

```text
CROWD SUPPORT
██████░░░░
```

上升。

对方：

```text
CREDIBILITY
████░░░░░░
```

下降。

---

# 19. Debate Ending

胜利不依赖完全正确。

达到任意条件：

```text
Crowd Support >= 75
```

或者：

```text
Opponent Credibility <= 25
```

即可结束。

结算：

```text
Influence +10~20
Momentum +5~15
```

依据表现浮动。

Burr 在旁观察。

如果玩家大量使用 ATTACK：

```text
Burr Rivalry +10
```

如果大量使用 FACT：

```text
Burr Respect +10
```

这一点必须存在。

它证明：

**玩法风格会形成角色关系。**

---

# 20. Chapter 4 — WASHINGTON

转场。

战争已经开始。

Hamilton 已经因写作和组织能力受到注意。

玩家第一次见 George Washington。

这一章主要是：

**Narrative Decision**

不制作大战。

---

# 21. Washington Conflict

Washington 希望 Hamilton：

帮助处理：

- correspondence
- intelligence
- orders
- logistics

Hamilton 想：

获得 battlefield command。

Washington 问：

为什么自己应该相信 Hamilton？

玩家根据之前经历获得不同选项。

---

## Possible Choice

### A

接受副官职位。

```text
Washington Trust +15
Momentum -5
```

### B

接受，但明确要求未来指挥机会。

```text
Washington Trust +8
Momentum +5
```

### C

强硬表示自己属于战场。

```text
Washington Trust -8
Momentum +15
```

这里推荐 B 为 mechanically optimal。

但不要明确告诉玩家。

---

# 22. Writing Mini-game

Washington 随后要求 Hamilton 快速整理军令。

第一次出现：

### WRITE

屏幕有若干信息碎片：

```text
Troops
Supplies
Position
Time
Objective
```

玩家拖拽到：

```text
PRIORITY
ACTION
CONTEXT
```

正确组合形成一份简洁 military dispatch。

不是文字生成游戏。

只是信息结构小游戏。

持续：

2–3 分钟。

目的：

告诉玩家：

Hamilton 的 Writing 本身也是 gameplay。

Full Game 可以在此基础上发展 Federalist Papers 等系统。

---

# 23. Time Transition

写作完成以后：

通过：

- 地图
- 信件
- 新闻标题
- 战线移动

快速跳过战争过程。

时间进入：

```text
1781
YORKTOWN
```

不要额外制作中间章节。

---

# 24. Chapter 5 — YORKTOWN

这是 MVP 第二核心玩法，也是高潮。

目标：

让玩家第一次：

**真正得到自己一直争取的 command。**

Washington Trust 必须影响这一段开场对话。

例如：

高 Trust：

Washington 明确表示信任。

低 Trust：

Washington 强调这是 Hamilton 最后证明自己的机会。

---

# 25. Yorktown Gameplay

分为三阶段。

总时长：

约 8 分钟。

---

## PHASE 1 — APPROACH

类型：

轻 Stealth。

横向移动。

Hamilton 带领小队接近 Redoubt。

Guard 有简单视野 Cone。

玩家：

```text
A / D move
CTRL crouch
E command soldiers
```

目标：

到达攻击位置。

被发现：

不是 Game Over。

而是：

```text
Surprise Bonus -20
```

游戏继续。

禁止频繁失败重开。

---

# 26. PHASE 2 — COMMAND

进入 Tactical View。

简单俯视地图。

三支小队。

玩家分别下达：

```text
HOLD
ADVANCE
FLANK
```

不做复杂 RTS。

敌军状态：

```text
Alert
Morale
Position
```

正确包围：

```text
Enemy Morale ↓
```

---

# 27. PHASE 3 — ASSAULT

音乐进入最强状态。

回到 side view。

出现 Rhythm Command。

例如：

```text
ADVANCE       SPACE
LEFT FLANK    A
RIGHT FLANK   D
HOLD          S
```

指令按节拍出现。

成功率决定：

```text
Yorktown Performance
```

视觉需要明显提升：

- camera shake
- silhouettes
- smoke
- percussion
- flags
- muzzle flash

但不要制作写实暴力。

重点是：

**战争舞台化。**

---

# 28. Yorktown Victory

最后敌方 surrender。

不要马上结算。

先安静。

Hamilton 站在战场。

音乐从高强度瞬间降为环境音。

屏幕：

```text
YORKTOWN
1781
```

随后出现：

```text
THE WAR IS TURNING.
```

停顿。

然后进入 Ending。

---

# 29. Ending

整个 MVP 的所有数值第一次一起出现。

例如：

```text
ALEXANDER HAMILTON

MOMENTUM
█████████░ 87

INFLUENCE
███████░░░ 73

WASHINGTON TRUST
████████░░ 81

BURR RESPECT
██████░░░░ 62

BURR RIVALRY
████░░░░░░ 39
```

随后显示几个行为总结。

例如：

```text
You rarely remained silent.

You won the crowd through argument.

Washington learned to trust your judgment.

Burr admired your ability to act —
and began to fear it.
```

最后只出现：

```text
THE REVOLUTION MADE HIS NAME.

AMBITION WOULD DECIDE
WHAT HAPPENED NEXT.
```

然后：

```text
END OF PROTOTYPE
```

---

# 30. 最后一处伏笔

Ending 最后一镜：

Hamilton 离开。

Burr 留在画面中。

不要对话。

只让：

```text
BURR RIVALRY
```

短暂闪现。

随后黑屏。

这样直接连接 Full Game 最终：

Hamilton vs Burr。

---

# 31. 美术资产规格

MVP 不追求角色动画数量。

每个角色需要：

```text
idle
walk
talk
gesture
```

四类即可。

主要人物：

- Hamilton
- Burr
- Washington
- Laurens
- Lafayette
- Mulligan
- Loyalist Speaker
- generic revolutionary
- generic soldier
- generic civilian

---

# 32. 推荐视觉方案

角色：

### 2D illustrated silhouettes / cutout characters

不要追求写实人物。

背景：

### painterly 18th-century America + theatrical staging

场景始终有一点：

**“这是真实历史，同时也是一个舞台。”**

例如：

Yorktown 背景远处甚至可以看到类似 theater rigging 的结构。

但不要直接复刻 Hamilton Broadway 舞台。

---

# 33. 音乐设计

MVP 必须做到：

**音乐影响玩法。**

但不得依赖 Hamilton 原曲才能成立。

原创音乐方向：

### Opening
80–90 BPM

- sparse piano
- low strings
- ocean ambience
- restrained percussion

### New York
90–100 BPM

- chamber strings
- light hip-hop percussion
- harpsichord accents

### Tavern
100–108 BPM

- boom-bap inspired percussion
- bass
- handclaps
- strings

### Debate
108–116 BPM

- staccato strings
- breakbeat
- percussion accents

### Washington
75–85 BPM

- military snare
- low strings
- restrained brass

### Yorktown
112–120 BPM

- military percussion
- cinematic strings
- modern rhythmic bass
- gradually layered arrangement

音乐要创造：

**18th century instrumentation × contemporary rhythmic language**

但不得复制 Hamilton 具体歌曲：

- melody
- recognizable hook
- chord progression + rhythm combination
- arrangement
- recording

---

# 34. AudioSystem

所有音乐通过：

```ts
MusicCue
```

加载。

例如：

```ts
interface MusicCue {
  id: string;
  bpm: number;
  baseTrack: string;
  layers?: string[];
}
```

必须支持：

```ts
playCue()
stopCue()
fadeTo()
setIntensity()
syncLayer()
```

Gameplay 不得直接引用文件名。

Scene 只调用：

```ts
audio.playCue("tavern");
audio.setIntensity(0.7);
```

未来换授权音乐时：

只修改：

```text
musicCues.ts
/assets/audio
```

不得修改 Scene。

---

# 35. 公共 Demo 音频规则

正式 Web Build：

只允许：

### A
原创音乐。

### B
明确授权可用于 Web Game 的音乐。

### C
专门委托制作的 soundtrack。

开发过程中也默认使用以上资产。

禁止把以下文件 commit 到 repository：

- Hamilton original cast recording
- Hamilton instrumental
- ripped audio
- vocal-removed Hamilton tracks
- Broadway recording
- Disney+ recording audio

---

# 36. Dialogue 内容原则

Hamilton：

语言速度快、信息量高。

Burr：

短句、谨慎。

Washington：

简短、权威、重视纪律。

Lafayette：

直接、充满行动感。

Laurens：

理想主义。

Mulligan：

务实而有街头能量。

禁止让人物只是负责 exposition。

NPC 的观点必须产生冲突。

---

# 37. Narrative Text Rule

AI 在生成剧情时：

不得搜索、引用或重新拼接音乐剧歌词。

不得把经典歌词轻微改词后使用。

应该：

### 根据历史事件重新创作。

例如不要引用音乐剧中的著名句子。

可以表达同一个人物思想：

> Hamilton believes that remaining silent will allow other people to shape the future for him.

而不是复制作品原句。

---

# 38. Loading / Transition

所有 Chapter 之间使用统一 Transition：

黑屏。

白字：

```text
NEW YORK
1776
```

背景出现：

- printing press
- quill
- map
- newspaper

持续：

1.5–2.5 秒。

不要开发复杂 Loading Screen。

---

# 39. Accessibility

必须提供：

```text
Music Volume
SFX Volume
Text Speed
Reduce Camera Shake
```

Debate rhythm 必须允许：

```text
Relaxed Timing
```

开启后：

```text
Good Window ±400ms
```

---

# 40. Failure Philosophy

本游戏原则：

## FAIL FORWARD

玩家操作差：

改变结果。

不要频繁 Game Over。

例如：

Debate 输：

Influence 少。

Yorktown 被发现：

Performance 少。

Writing 失败：

Washington Trust 少。

但剧情继续。

唯一允许 Restart：

菜单主动选择 Restart Chapter。

---

# 41. MVP Success Criteria

只有同时满足以下条件才算 MVP 完成。

### Functional

- 从 Menu 到 Ending 可以完整游玩
- 无 blocker bug
- Scene 正确切换
- 所有 Choice 改变 GameState
- GameState 能影响后续场景
- Debate 可以完整胜负结算
- Yorktown 可以完整结算
- Audio intensity 正常工作

### Experience

第一次玩家无需说明书即可：

- 移动
- 对话
- 作选择
- Debate
- Yorktown

### Narrative

测试玩家应该能够理解：

1. Hamilton 是一个极度主动的人。
2. Burr 与 Hamilton 性格不同。
3. Hamilton 的语言能力是一种力量。
4. Washington 对 Hamilton 的评价很重要。
5. Hamilton 最终获得了他想要的战场机会。

### Product

玩家结束后应该产生：

> “我想继续玩 Hamilton 后面的政治生涯。”

如果没有产生这个欲望，MVP 失败。

---

# 42. 开发顺序

AI Agent 严格按照以下顺序开发。

## Milestone 1 — Skeleton

完成：

```text
Menu
Scene switching
GameState
basic movement
dialogue
choice
ending
```

全部使用 placeholder graphics。

目标：

10 分钟内可以从头走到尾。

---

## Milestone 2 — Debate

只开发 Debate。

完成：

```text
argument
response cards
timer
beat input
combo
crowd support
results
```

不要同时做 Yorktown。

---

## Milestone 3 — Yorktown

完成：

```text
approach
command
assault
results
```

---

## Milestone 4 — Audio

实现：

```text
BPM
layers
intensity
transition
```

---

## Milestone 5 — Art

替换 placeholder。

---

## Milestone 6 — Polish

添加：

- transition
- animation
- screen shake
- sound effects
- typography
- particles
- accessibility
- balancing

---

# 43. AI Coding Agent 工作规则

每次实施一个 Milestone。

实施前必须：

1. 阅读现有代码。
2. 不重构与当前任务无关的系统。
3. 复用已有组件。
4. TypeScript 不允许无必要的 `any`。
5. Gameplay 数据与代码分离。
6. 每个核心系统有最小测试。
7. 每个 Milestone 完成后运行 build。
8. 修复所有 TypeScript error。
9. 不因“未来可能用到”而增加抽象层。

---

# 44. First Playable Definition

第一版完全允许：

Hamilton = 蓝色矩形。

Burr = 灰色矩形。

Washington = 深色矩形。

Yorktown soldiers = 圆点。

背景 = 色块。

但是以下必须真实工作：

```text
movement
dialogue
choice
state
debate
rhythm
Yorktown
ending
```

优先顺序永远是：

**GAMEPLAY > ART**

---

# 45. 最核心的设计判断

开发时遇到任何 scope 冲突，使用以下判断：

### 这个机制是否让玩家更像 Hamilton？

如果：

**是**

保留。

如果：

只是因为“游戏一般都有”

删除。

因此本项目需要：

- Writing
- Debate
- Momentum
- Relationship consequences
- Command

而不需要：

- Inventory
- Crafting
- HP
- Loot
- Weapons
- Character level

---

# 46. MVP 的最终体验公式

整个 Prototype 应呈现：

```text
ARRIVE
   ↓
SPEAK
   ↓
GAIN ATTENTION
   ↓
ARGUE
   ↓
GAIN INFLUENCE
   ↓
DEMAND ACTION
   ↓
EARN TRUST
   ↓
COMMAND
   ↓
WIN
```

同时隐藏另一条线：

```text
ACT
 ↓
ACT
 ↓
ACT
 ↓
ACT
 ↓
BURR WATCHES
 ↓
RIVALRY
```

第一条线是玩家现在体验到的成功。

第二条线是 Full Game 的悲剧伏笔。

这就是 MVP 最重要的结构。