# PROJECT HAMILTON — 1776

公开仓库下载后，请先按[大文件索引](../../docs/github-large-assets.md)补充本实验的旧开场影片。After cloning the public repository, restore this experiment’s older opening film using the [large asset index](../../docs/github-large-assets.md).

Three.js + TypeScript + Vite 的桌面网页叙事游戏。当前线上版本 **0.1.0 · 测试版**（2026-09-10 起按对外测试版本重新编号，替代之前的内部 0.6.0 标识）。

线上地址：[ham.newflorencia.com](https://ham.newflorencia.com/)。版本发布、归档与回滚见 [版本管理](docs/版本管理.md)，版本变更见 [CHANGELOG](CHANGELOG.md)。

从标题出发，经序幕、纽约、酒馆、公开辩论、Washington 军营和 Yorktown，抵达个人结算与 Burr 尾声。支持中文、英文和双语，默认中文主字幕、英文副字幕。单次游玩时长尚待首次玩家实测；自动化使用即时文字，不能代替真实计时。

## 运行

Node.js 22.12+。依赖固定在 `pnpm-lock.yaml`，不需要账号、后端或 API 密钥。

```sh
pnpm install --frozen-lockfile
npm run dev
```

打开 [本地游戏](http://127.0.0.1:1776/)。脚本只绑定 `127.0.0.1:1776`。

## 进入界面 / Entry screen

根地址现在显示独立的纽约港进入界面：原创油画主视觉、衬线标题与旧金色入口。首页仅提供「启程」，进入三维主线；不再展示经典叙事和自由漫游入口。标题页本身不加载 Three.js 引擎。The root URL opens the New York harbor title screen with original painted key art. Begin your story is the only play entry and opens the 3D narrative. The Three.js engine does not load behind this title screen.

点击「启程」后，在同一页面淡入用户剪辑的 57.2 秒开场 CG，播放期间准备三维场景。片尾约 49.5 秒起利用原有黑场显露「海的另一边」标题，保留片尾音轨并柔和收尾，再淡入码头读信，随后按原剧情进入第一幕。影片支持暂停／继续、静音、跳过，离开窗口时暂停；播放受限或资源失败时可重试或跳过。所有控件支持中、英、双语；减少动态偏好沿用现有设置。Begin your story fades into the user's 57.2-second opening film within the same document while the 3D world prepares. At approximately 49.5 seconds, the original black tail reveals the Across the Sea title while the soundtrack finishes with a soft fade. The curtain then opens onto the dock and its letter, followed by Act I. Pause/resume, mute and skip are available; leaving the window pauses playback. Blocked or failed playback offers resume/retry and skip. Controls support all three language modes and the existing reduced-motion preference.

网页素材为 `public/video/opening-2026-09-11.mp4`，由用户 MOV 无损转封装，1080p、30 fps、原始立体声音轨均保留。直接打开 `?story=3d` 仍可进入原有章节启动流程，便于游戏回归；完整开场体验从根地址「启程」进入。接入与素材记录见 `docs/plans/2026-09-11-opening-film.md`。The web MP4 is a lossless remux retaining the original 1080p, 30 fps video and stereo audio. Direct `?story=3d` links retain the existing chapter startup for regression checks; begin at the root title screen for the full opening sequence.

中文、英文和双语可在右上角即时切换。设置复用三维画质、文字速度与减少动态偏好；游玩须知说明键鼠操作与当前存档范围。小窗口保留主入口，窄屏可纵向滚动，但游戏仍以桌面键鼠为验证范围。Switch languages at the top right. Settings reuse 3D graphics, text speed and motion preferences; Before you begin explains controls and save behavior. The story entry remains available in smaller windows, with vertical scrolling on narrow screens; gameplay remains designed for desktop keyboard and mouse.

代码位于 `src/ui/EntryScreen.ts` 和 `entry.css`；原图与生成提示分别为 `public/art/entry/harbor-arrival-v1.png`、`art-direction/entry-harbor-prompt.md`。主线地址为 `?story=3d`。横版 2D 专用代码和 Phaser 依赖已移除；旧 `?story=2d` 链接自动转入三维主线。样例 `?demo=3d` 仅供环境美术检查；主线结局提供重新启幕或返回标题。The main story is at `?story=3d`. The retired 2D URL redirects to the sole 3D story. Exploration remains an environment art review; the story ending offers a new run or a return to the title.

## 三维主线 / Story in 3D

打开 [三维主线](http://127.0.0.1:1776/?story=3d)，也可从原版标题页或三维漫游页选择「进入三维主线」。完整六幕现在通过走近场景目标与使用出口推进：码头信件 → 纽约报童/街头争论/伯尔 → 酒馆三位同伴 → 广场辩论 → 军营军令 → 约克镇 → 结局。Open the 3D story to follow the complete six-chapter narrative through physical objectives and exits.

- 同幕内自由行走，点击人物或标记会寻路走近；靠近按 E 交谈。亮起的目标为当前主线，完成本幕后出口解锁，不能用场景菜单跳过剧情。Roam within a chapter; click a character/marker or press E nearby. Complete the current objective to unlock the next, then use the chapter exit.
- 读完信件后，“踏上纽约街头”入口持续黄色高亮；走近后的交互按钮沿用黄色，其他主线出口也遵循这一规则。街头酒馆用酒杯木招牌、条纹雨棚和暖灯标明门口，招牌随中英设置即时更新。After the letter, “Step into New York” stays highlighted in yellow, including its nearby interaction prompt. Other unlocked story exits follow the same rule. A tankard sign, striped canopy and warm lights identify the tavern entrance; its lettering updates with the language setting.
- 码头木板区域扩大约 29%。序幕的纽约街区保持在迷雾中，读完信或靠近入口都不会提前显露；完成“踏上纽约街头”的交互转场后才显示街区。纽约采用近夜黄昏、暖色路灯和窗光；围栏外补充石铺侧街与连续房屋背景，仍不可进入。The dock deck is about 29% larger. New York stays in fog throughout the prologue, including after reading the letter or approaching the entrance, and appears after the “Step into New York” transition. Near-night dusk, warm lanterns and window lights accompany paved side streets and rows of houses beyond the nonwalkable boundary.
- 酒馆三人可任意顺序交谈，完整回应三人后才开放出口；每题读完问题后有 10 秒作答，暂停与语言切换保留计时。剧情选项预览受影响指标，以绿色 ↑、红色 ↓ 显示实际变化方向，不显示增减点数；已达数值边界时用中性横线表示不变。Speak to the three tavern companions in any order; finish all three to unlock the exit. Each question allows ten seconds after reading, preserved across pause and language changes. Narrative choices preview affected stats with green up/red down arrows without numeric amounts; a neutral dash indicates no change at a stat limit.
- 公开辩论广场的土地、外围街道和邻近建筑向远处延伸，保留原有行走范围，以碰撞护栏标明边界；纽约街头、军营与约克镇的地面/水岸也扩大了视野覆盖。The debate square now extends into surrounding streets and buildings, with colliding railings marking the original playable area. Outdoor ground and waterfronts also extend farther in New York, the camp and Yorktown.
- 原剧情、选择、关系数值、分支台词、酒馆 10 秒回应与失败继续规则复用。新增报童、保皇派、劳伦斯、拉法耶特、穆利根、华盛顿六名像素 NPC，每人八方向待机；与 Hamilton/Burr 使用相同光照、脚底对齐和遮挡方式。Original dialogue, choices, relationships, branches, ten-second tavern responses and fail-forward rules are retained, with six new eight-direction pixel NPCs.
- 辩论、军令、约克镇三类活动在当前三维场景上打开原玩法面板，完成后继续在场景中行走。**本阶段迁移的是主线和场景连接；约克镇潜行、战术图和节拍操作仍使用活动面板，尚未改成三维地形上的战斗。** Activities open over the current 3D scene. This phase migrates narrative and scene progression; stealth, tactical deployment and rhythm input remain activity panels rather than terrain-based 3D combat.
- Esc 暂停，可切换中/英/双语、文字速度、画质与减少动态；暂停和语言切换保留当前对话/倒计时/活动状态。重开本幕恢复进入时的选择与数值，不会叠加奖励。只有结局保存完整成绩；刷新页面重新开始主线。Pause with Esc. Settings preserve dialogue and activity state; chapter restart restores its entry checkpoint. Only completed results persist; a reload begins a fresh story.
- 主线字幕继续默认中文主字幕、英文副字幕。过幕渐入/渐出各 550 ms，标题等待 2875 ms；减少动态使用 250 ms。Bilingual mode remains the default, with the existing transition timings.
- 幕间标题复用项目已有的对应背景：海上、纽约街头、酒馆。`?art=a/b/c` 优先用所选版本，缺少版本则用同一幕已有版本；辩论、军营、约克镇尚无原图，继续使用深色底。图片有全屏遮罩与独立文字底板，英文副字幕不降透明度。图片失败或延迟不阻塞转场，也不改变等待时间。Chapter titles reuse existing chapter artwork for the sea, New York streets and tavern. Requested art variants fall back within the same chapter; the three chapters without artwork keep a dark background. Two scrims preserve text readability; delayed or failed images never hold up the transition.

## 三维探索样例 / Five explorable 3D scenes

打开 [酒馆](http://127.0.0.1:1776/?demo=3d&scene=tavern)，或使用原游戏标题页的「五幕漫游 · 三维样例」入口。上方场景菜单可直接选择五幕，也可走到出口按 E 连续旅行。Open the tavern, choose any scene from the menu, or walk to an exit and press E to travel.

| 场景 / Scene | 空间与氛围 / Environment |
| --- | --- |
| [纽约街角 / New York](http://127.0.0.1:1776/?demo=3d&scene=street) | 暮夜石路、窗光、路灯、码头与围栏外街区 / Dusk cobblestones, lit windows, lanterns, wharf and surrounding city blocks |
| [酒馆 / Tavern](http://127.0.0.1:1776/?demo=3d&scene=tavern) | 木地板、长桌、吧台、手稿与烛光壁炉 / Timber floor, tables, bar, manuscripts and candlelit hearth |
| [辩论广场 / Debate square](http://127.0.0.1:1776/?demo=3d&scene=square) | 讲台、印刷摊、告示板与城市建筑 / Speaking platform, print stall, notices and civic buildings |
| [华盛顿军营 / Washington’s camp](http://127.0.0.1:1776/?demo=3d&scene=camp) | 黄昏帐篷、地图桌、补给车与篝火 / Dusk tents, map table, supply cart and campfire |
| [约克镇 / Yorktown](http://127.0.0.1:1776/?demo=3d&scene=yorktown) | 月光工事、双通道壕沟、火炮与木栅 / Moonlit earthworks, trench routes, cannons and stockades |

| 操作 / Control | 功能 / Action |
| --- | --- |
| WASD / 方向键 / Arrow keys | 按镜头方向自由行走 / Move relative to the camera |
| Shift | 快步 / Hurry |
| 点击地面 / Click ground | 自动绕障碍走到目标 / Find a path around obstacles |
| 点击标记，或走近按 E / Click a marker or press E nearby | 交谈、查看环境、切换场景 / Talk, inspect surroundings, travel |
| 右键拖动 / Right-drag | 转动与抬低镜头 / Orbit and tilt |
| 滚轮 / Scroll | 拉近与拉远 / Zoom |
| R | 镜头回到默认角度 / Reset camera angle |
| Esc | 暂停、语言、画质、减少动态、回到街口 / Pause, language, graphics, motion, return to spawn |

每幕有三处发现；新场景各含三段中英文环境查看内容。探索记录在本次漫游中按幕保留，切场景清除移动指令和对话，语言及画质偏好保留。默认双语；样例不会改写六幕游戏的选择或成绩。Each scene has three discoveries. Scene changes preserve discoveries for this visit and retain language/graphics preferences, while clearing movement and dialogue. Story results remain separate.

技术上使用真实三维建筑与地形、受光像素人物、距离驱动的八方向步态、脚底阴影、动态投影和轻景深。Hamilton 有八方向待机和每方向四帧行走，Burr 有八方向待机，靠近时面向玩家。视角按世界朝向与镜头角度计算，方向交界处有缓冲以避免抖动；停步保留朝向。Hamilton has eight idle views and four walk frames per direction. Burr has eight idle views and turns toward nearby players; both remain correctly oriented as the camera orbits.

遮挡人物的建筑上部与树冠会淡化，建筑基座保留，便于识别碰撞边界。静态建筑零件使用实例绘制。画质提供均衡 / 精细 / 流畅；浏览器需支持 WebGL 2，当前以桌面键鼠为验证范围。

五幕的自由漫游入口继续用于查看环境与美术；三维主线另按剧情解锁目标与出口。讲台、帐篷与工事遵循地面寻路，没有跳跃或高低地形攀爬。The exploration entry remains available for art review; the story entry gates objectives and exits by narrative progress. Navigation stays on a flat surface without jumping or climbing.

角色图集、叶片切图的原图和生成提示保存在 `public/art/actors/`、`public/art/environment/` 与 `art-direction/*-prompt.json`。`SceneCatalog.ts` 集中维护场景标题、配对文案、出生点、查看点和出口；各 `*World.ts` 提供模型、碰撞和动态环境。切换时释放旧场景 GPU 资源，复用渲染器与角色图集。

```sh
npm test          # 核心状态、剧情与玩法边界测试
npm run build     # 中英配对检查 + TypeScript 检查 + Vite 静态构建
npm run preview   # 查看 dist；须先关闭占用 1776 的开发服务
```

本机 Codex 的 pnpm 包装命令可能触发自动重装检查，因此日常脚本用 `npm run`；它不改变依赖锁文件。Windows 仍可使用 `启动开发.ps1`。

`dist/` 需通过 HTTP 访问，不能直接双击 HTML。当前部署基线为网站根目录；美术路径使用 `/art/`。

## 操作与玩法

标题页的「设置」以及游戏中的暂停设置，都可切换中文 / 英文 / 双语。偏好保存在当前浏览器，切换立即生效，保留对话进度、选项和玩法状态。双语显示以中文为主、较小的英文为副字幕。

幕间渐入、渐出各为 **550 ms**（原 220 ms 的 2.5 倍），标题等待 **2875 ms**（原 1150 ms 的 2.5 倍）。启用「减少动态效果」时采用 250 ms 简化等待。

| 情境 | 操作与规则 |
| --- | --- |
| 探索 | A / D、方向键移动；W / E 互动；点击舞台标记自动走近 |
| 对话 | E / Space 显示全文或继续；1–4 或鼠标选择 |
| 酒馆 | 三人可按任意顺序交谈；读完问题后有 10 秒回应；超时记录沉默，故事继续 |
| 辩论 | 先读论点，点击准备后有 2.5 秒选 FACT / PRINCIPLE / ATTACK / CROWD；接着按 Space 或点击发声踩节拍 |
| 军令 | 三份军令、15 条信息，共 150 秒整理时间；拖拽或点击碎片，再按 1–3 / 点击栏目；提交前可更改 |
| 约克镇潜行 | A / D 移动，按住 Ctrl 蹲在掩体后；E 切换士兵跟随/待命；鼠标可按住对应控件 |
| 约克镇指挥 | 为三队分别指定 HOLD / ADVANCE / FLANK，再确认部署 |
| 约克镇突击 | 根据命令按 Space / A / D / S，或点击按钮；连续 12 道节拍指令 |
| 暂停 | Esc、暂停按钮、窗口失焦或切换标签页；所有玩法计时和移动同步暂停 |

节拍游标到金线的目标时间为 1.2 秒；Perfect ±100 ms，Good ±250 ms。每道指令只接受第一次输入。短提示音可在玩法页关闭；无音频设备也能完整游玩。尚未接入五层配乐。

## 自动英文配音

三维游戏是唯一主流程。标题页「设置」和游戏内 Esc 暂停页的「角色与旁白配音（英文）」默认开启，并记住本浏览器的选择。关闭立即停止发声，重新开启可续播当前句；字幕语言独立，切换字幕不会重播。剧情仍由玩家按 E / Space 或按钮推进；显示全文不会重播，进入下一句停止旧音频。

The 3D game is the only story flow. English character voices and George narration are on by default. Toggle them in title settings or the in-game pause menu; the preference persists. Subtitles remain independent, and advancing dialogue stays manual.

- 六位主要角色使用已有克隆音色；报童 Liam、市民 Chris、保皇派 Daniel。George 只读剧情对话框内的 6 句旁白；章节标题、选择问题、玩法规则、反馈、成绩和结局页面保持静音。
- George only reads narrator lines inside story dialogue. Chapter titles, choice prompts, game instructions, feedback, scores and ending screens have no narration.
- 酒馆问题只显示文字；辩论对方论点由 Daniel 朗读，Hamilton 回应在踩拍后的反馈页朗读；军令碎片在选中时听读，期间保留整理时间。
- 约克镇先读指令再启动节拍，指令键或按钮可跳过朗读，跳过本身不计成绩。
- 暂停、切出窗口和隐藏标签页暂停语音；重开、离开和销毁清理旧队列。加载失败、播放受限或卡住不会阻止继续游戏。
- 玩家直接加载已生成的静态 MP3，不调用 ElevenLabs，也不会消耗生成额度。

`public/audio/en/manifest.json` 保存 134 条可播放台词到 133 个 MP3 的映射，已覆盖全部 10 个说话角色。此前生成的 249 个界面旁白 MP3 仅归档，不在运行时索引或后续生成队列内；归档清单见 `docs/voiceover/archived-ui-narration-manifest.json`。`src/data/voiceover-catalog.json` 是生成脚本同步维护的精简运行时索引，避免从 public 导入资源。`src/systems/VoiceoverSystem.ts` 管理单一播放队列、暂停、设置与容错；`src/ui/voiceover.ts` 按说话人与完整英文文本查找音频。`scripts/voiceover-check.mjs` 使用真实浏览器检查 MP3 播放、开关、设置布局与玩法计时。

## 结果如何产生

- **Debate**：最多六轮；群众支持 ≥75 或对方可信度 ≤25 即获胜。不同回应改变支持与可信度的幅度不同；反击失拍会反噬。成功节拍维持 Flow。至少三次 FACT 增加 Burr 尊重 10；至少三次 ATTACK 增加竞争 10。影响力与锐气按胜负和表现结算。
- **Writing**：目标/时限放 PRIORITY，人员/补给放 ACTION，地点/状况放 CONTEXT。每份提交后展示校对稿；首次分类准确率影响 Washington 信任。未分配和超时未完成的信息计为缺漏，校对阅读不计时。
- **Yorktown**：每处哨岗发现玩家或士兵扣 20 突袭优势，只扣一次；需要全队抵达。战术说明提示三队职责，部署影响守军士气与位置。表现分 = 突袭优势 20% + 部署配合 30% + 节拍 50%。
- **失败继续**：辩论失利、军令错放、潜行被发现和突击漏拍都不会要求重玩；成绩和关系如实保留，历史剧情继续。
- **防重复与回滚**：成绩只在结果页确认后入账一次。重开恢复本章进入时的数值、选择与小游戏；退出清理界面、输入和提示音。
- **持久化**：localStorage 只保存已完成标记与最后一份完整结果，不保存中途进度。结局展示真实完成的辩论、写作与战役表现；兼容早期叙事版结果。

## 当前素材与后续阶段

游戏已接入历史环境方向的美术预览，`?art=a` / `b` / `c` 切换风格；[美术图册](http://127.0.0.1:1776/art-review/) 可并排查看。当前立绘 **12/33**、背景 **7/18**、场内 SVG **33/33**。缺少的背景显示占位，缺少的立绘不加载；不会影响玩法流程。图片目前使用不透明底，并非透明立绘。

美术以 `art-direction/素材提案.md` 为较新的方向：环境参考历史场景，人物保留音乐剧服装辨识度。原规格中的舞台美术约束已被此前用户指令覆盖。原卡剧照只用于参考图册，正式画面使用生成或自制资产；参考说明以本地素材记录为准。

当前实际缺口详见 [素材补齐清单](docs/素材补齐清单-2026-09-08.md)：优先为辩论、军营和约克镇补三张正式过场，再补配乐与环境音。

剩余阶段：补齐并验收美术、五层音乐与 BPM 联动、完整声画润色、时长与难度平衡、首次玩家测试。本版不宣称达到原规格 20–30 分钟或 Yorktown 约 8 分钟的体验目标。没有账号、后端、装备、开放世界或新章节。

## 开发入口

- `AGENTS.md`：后续玩家可见文字与美术文字必须同步生产中英文；不要以空白翻译占位。
- `src/i18n/text.ts`：配对文案、格式化、语言偏好、DOM 字幕与完整配音文本。新文案用 `bi(中文, English)`，动态参数用 `f`，中性拼接用 `cat`。
- `scripts/check-i18n.ts`：检查遗漏配对、英文混入中文、模板参数不匹配及双语对象的错误插值；由构建自动执行，也可单独运行 `npm run check:i18n`。
- `src/data/chapters.ts`：剧情、选项及小游戏入口。
- `src/data/debate.ts` / `writing.ts` / `yorktown.ts`：论点、军令碎片、战术与指令数据。
- `src/systems/TimingSystem.ts` / `DebateSystem.ts` / `WritingSystem.ts` / `YorktownSystem.ts`：纯逻辑规则与活动时间。
- `src/ui/Activity.ts` 与三个 `*Activity.ts`：场景拥有的玩法界面、输入与提示音。
- `src/story3d/StoryDirector.ts` / `StoryUI.ts`：唯一主线的探索、对话、配音和小游戏生命周期。
- `src/systems/StateSystem.ts`：状态限制、结果防重、检查点与完成结果保存。
- `src/data/ending.ts`：按真实选择与成绩生成结局侧写。
- `src/story3d/`：纯剧情进度、章节空间映射、场景剧情调度、双语界面与八方向 NPC；`?story=3d` 从序幕走到结局。
- `src/demo3d/`：三维样例入口、街区模型、导航、像素角色、景深及遮挡处理；`?demo=3d` 懒加载，标题页不加载游戏引擎。

## 浏览器回归

已有 Playwright 的机器可运行：

```sh
HAMILTON_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs HAMILTON_BROWSER=chrome node scripts/entry-check.mjs
HAMILTON_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs HAMILTON_BROWSER=chrome node scripts/opening-film-check.mjs
HAMILTON_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs HAMILTON_BROWSER=chrome node scripts/voiceover-check.mjs
HAMILTON_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs HAMILTON_BROWSER=chrome node scripts/chapter-transition-check.mjs
HAMILTON_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs HAMILTON_BROWSER=chrome node scripts/demo3d-check.mjs
HAMILTON_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs HAMILTON_BROWSER=chrome node scripts/eight-direction-check.mjs
HAMILTON_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs HAMILTON_BROWSER=chrome node scripts/multi-scene-check.mjs
HAMILTON_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs HAMILTON_BROWSER=chrome node scripts/story3d-check.mjs
HAMILTON_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs HAMILTON_BROWSER=chrome node scripts/street-atmosphere-check.mjs
```

三维主线脚本默认验证故意失误仍可通关；添加 `HAMILTON_ROUTE=success` 验证成功操作及对应成绩。两种路线都会实际行走十二处互动，检查暂停、中英切换、酒馆超时、章节重开和结局保存。`scripts/story3d-focus-check.mjs` 单独检查人物身体点击、Tab 焦点循环、选项提示与 Enter 单次提交。

`scripts/street-atmosphere-check.mjs` 检查扩大后的码头通行、序幕迷雾在读信与解锁后的保持、重开恢复、进入街头后显露，以及三种语言、画质与小窗口画面。The street atmosphere check covers the expanded dock, persistent prologue fog, restart and entry behavior, language and quality settings, and smaller viewports.

可省略 `HAMILTON_PLAYWRIGHT_MODULE` 使用项目可解析的 Playwright；浏览器默认 Microsoft Edge。`HAMILTON_URL` 可指向独立预览地址。`scripts/gameplay-helpers.mjs` 为全流程回归提供正常和故意失误的操作路线，包括拖拽、键盘和暂停冻结检查；截图保存在忽略目录 `artifacts/`。设置 `HAMILTON_ROUTE=success HAMILTON_CHECK_RESTART=1` 可额外验证三个玩法章节重开；设置 `HAMILTON_ROUTE=mistakes HAMILTON_CHECK_TIMEOUT=1` 可验证酒馆超时。实际验证记录见 `开发记录.md`。

入口回归 `entry-check.mjs` 检查三种语言与桌面/小窗口/窄屏排版、弹窗键盘焦点、设置保存、唯一主线入口及结局返回标题；已移除横版专用回归脚本。

全流程脚本默认选择中文便于兼容旧回归；设置 `HAMILTON_LANGUAGE=en` 或 `dual` 验证英文或双语。设置 `HAMILTON_CHECK_LANG_SWITCH=1` 会在限时选择、辩论、军令和潜行暂停时切换三种语言，并检查时间或位置保持不变。`entry-check.mjs` 和 `voiceover-check.mjs` 检查默认双语、偏好记忆、小窗口设置与字幕切换；`chapter-transition-check.mjs` 检查转场。

数据链：剧情入口 → 玩法状态机 → 玩家输入与活动时间 → 表现/关系效果 → 章节检查点与全局状态 → 完成结果与结局侧写。
