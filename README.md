# PROJECT HAMILTON — 1776

Three.js + TypeScript + Vite 的桌面网页叙事游戏。本地版本 **0.5.2 · 测试版**，本次记录与归档不自动切换线上版本。

线上地址：[ham.newflorencia.com](https://ham.newflorencia.com/)。部署操作见 [部署指导](docs/部署指导.md)（采用个人主页项目的 SSH 连接方式）；版本发布、归档与回滚见 [版本管理](docs/版本管理.md)，版本变更见 [CHANGELOG](CHANGELOG.md)。

从标题出发，经序幕、纽约、酒馆、公开辩论、Washington 军营和 Yorktown，抵达个人结算与 Burr 尾声。支持中文、英文、双语 · 中文主字幕和双语 · 英文主字幕，默认中文主字幕、英文副字幕。双语仅用于对话，其余界面跟随主语言。单次游玩时长尚待首次玩家实测；自动化使用即时文字，不能代替真实计时。

## 公开仓库与下载 / Repository and downloads

[GitHub 仓库 / Repository](https://github.com/Fangjie0810/Hamilton) · [历史归档下载 / Historical archives](https://github.com/Fangjie0810/Hamilton/releases/tag/project-archive-2026-11-04)

仓库包含当前源码、游戏素材、美术探索、实验项目、设计文档及验收记录。少量超大原始视频和素材压缩包通过同一仓库的 Releases 下载，见[大文件索引](docs/github-large-assets.md)。历史版本网站包和源码包统一保存在 Releases 的项目归档中。依赖、构建缓存和本地密钥不上传；运行游戏不需要密钥。This repository includes the current source, game assets, art studies, experiments, design documents and validation records. A few large original videos and art bundles are available in Releases; see the [large asset index](docs/github-large-assets.md). Historical site and source bundles are available in the project archive under Releases. Dependencies, build caches and local credentials are excluded; no credentials are needed to play locally.

```sh
git clone https://github.com/Fangjie0810/Hamilton.git
cd Hamilton
pnpm install --frozen-lockfile
npm run dev
```

本仓库公开当前开发快照，不代表网站已部署相同版本。历史归档保留原始版本号；归档标签仅标记本次整理时间。This repository shares a development snapshot and does not imply a matching website deployment. Historical bundles retain their original versions; the archive tag records the date they were collected here.

## 三场景扩充体验 / Expanded scene review · 2026-11-04

可转发离线包：[Hamilton-Scenes-Offline.zip](artifacts/scene-offline/20261104T041554Z/Hamilton-Scenes-Offline.zip)（约 14.4 MB）。解压后用电脑浏览器打开 `Hamilton-Scenes.html`，三个场景、人物图集与模型导出功能均已内嵌，无需安装依赖或启动服务。Share the offline ZIP, extract it and open `Hamilton-Scenes.html` in a desktop browser. All three scenes, character sheets and model export are embedded. No installation or server is required. [打包与验收记录](artifacts/scene-offline/20261104T041554Z/README.md)。重新打包使用 `npm run scenes:pack`。

最新一轮：纽约改为昏黄路灯夜景，并用围墙、木门、码头护栏及植被标明边界；酒馆改为暗暖烛火、深木护墙和砖石壁炉；舞会采用蓝色侧光。只有角色穿过门洞进入室内后才开启建筑透视，墙外靠近不触发；相连后室保持入口大厅视线通畅。The latest pass adds amber-lit New York nights and visible street boundaries, a darker timber-and-hearth tavern, and blue ballroom lighting. Buildings reveal only after the player enters through a doorway; connected back rooms keep the entrance hall out of the camera's way. [本轮验收](docs/2026-11-04-scene-atmosphere.md) · [最新模型与画面](artifacts/scene-atmosphere-2026-11-04/README.md)。

本轮已修复共墙重叠与颗粒遮罩闪动，收藏品标记改为同帧跟随；细化场景及十二件物品，降低吧台，移除舞会楼梯和几何宾客，并加入缩放百分比条。按最新反馈，缩放固定为 **100%–140%**，低墙使用独立实心墙基与连续顶盖，移除裁切残边。100% 为默认视距；俯视按钮只改变角度。The latest pass removes duplicate walls and noisy cutaways, updates item labels every frame, refines scenery and twelve keepsakes, lowers the bar, removes ballroom stairs and geometric guests, and adds a synchronized zoom slider. Following the latest feedback, zoom is limited to **100%–140%** and cutaway walls retain solid bases with continuous caps. 100% is the default view distance; Overhead view changes only the angle. [精细化验收](docs/2026-11-02-scene-experience-polish.md) · [低墙修复验收](docs/2026-11-02-scene-wall-cap-fix.md) · [高墙柱头修复](docs/2026-11-02-scene-wall-crown-fix.md) · [墙顶修复历史模型](artifacts/scene-wall-crown-fix-2026-11-02/README.md)。

打开 [3D 体验页](http://127.0.0.1:1776/?experience=3d&scene=street)，切换纽约街头、酒馆和舞会。街头新增可进入的印刷店、布料铺和港口仓库；酒馆包含储酒间与后室；舞会包含中央舞池与两间侧室。室内通过门洞连续进入，自动处理屋顶与墙面遮挡。Open the [3D review](http://127.0.0.1:1776/?experience=3d&scene=street) to explore expanded streets, a tavern and a ballroom. Shops, storage rooms and side rooms share the same scene; roofs and foreground walls reveal the occupied interior.

每场景有四件角色收藏品，附独立模型及中英原创短文。顶部「收藏品」复选框控制显示与拾取；走近按 E 查看，收藏册支持回看与重置本场。可保存当前画面或导出完整静态 GLB。Each scene has four character keepsakes with distinct models and original bilingual vignettes. Toggle Collectibles, approach and press E, then revisit items in the Collection. Save the view or export a complete static GLB.

[交付与验收](docs/2026-11-02-scene-experience.md) · [模型与截图](artifacts/scene-experience-2026-11-02/README.md)。这是独立的本地场景验收入口；收藏品保留后续剧情标签，尚未触发主线、支线或结局。舞会楼上回廊为布景。This local review is separate from the story. Keepsake tags prepare later narrative work; branch and ending effects are not connected. The upper ballroom gallery is scenery.

## 运行

Node.js 22.12+。依赖固定在 `pnpm-lock.yaml`，不需要账号、后端或 API 密钥。

```sh
pnpm install --frozen-lockfile
npm run dev
```

打开 [本地游戏](http://127.0.0.1:1776/)。脚本只绑定 `127.0.0.1:1776`。

标题页右下角唱片可播放已有七首 BGM，点击唱片直接切换下一首，不提供选曲列表；播放时转动，保留独立播放/暂停按钮，播完按顺序循环。曲名在所有语言模式下始终使用英文原名；自动播放受限时可点击播放按钮。点击启程后从头播放既有序幕曲并进入 CG。The title-screen record plays the seven existing BGM tracks in sequence. Click the record for the next track; there is no track picker. A separate play/pause button controls playback, including when autoplay is blocked. Song titles always use their original English names in every language mode. Beginning the journey restarts the prologue track and enters the existing opening film. [设计与验收 / Design and validation](docs/plans/2026-10-18-title-record-design.md)。

首页唱片默认从 **My Shot** 开始，之后沿原曲序循环。左上角 H.T.T.X. Logo 以暖金色显示，悬停或键盘聚焦出现主页访问提示，点击在新标签页打开个人主页。The title record starts with **My Shot**, then continues in the existing cyclic order. The warm-gold H.T.T.X. logo reveals a homepage hint on hover or keyboard focus and opens the creator’s homepage in a new tab. [首页改动与验收 / Homepage changes and validation](docs/plans/2026-10-18-home-branding-design.md)。

## 0.5.2 更新 / Changes

属性教学加入正式战役徽章图示，以真实数值高亮对应模块；拉法耶特的主像素说话与态度帧已对齐，消除横跳并保留手势。Attribute explanations now show the actual campaign badge with the relevant section highlighted. Lafayette’s portrait frames are aligned while preserving gestures. [验收记录](docs/0.5.2-validation.md)。

另有两版面向新玩家的中英文背景介绍及独立预览，分别为清晰导读与时代告示；暂不接入游戏。Two bilingual background introductions are available as separate design studies and are not part of the game. [设计与全文](docs/designs/intro-background-0.5.2/README.md) · [独立预览](docs/designs/intro-background-0.5.2/preview.html)。

## 0.5.1 更新 / Changes

首次报童、街头争论、伯尔和华盛顿主线交互分别介绍影响力、锐气、伯尔双关系和华盛顿信任；弹窗仅保留简短解释，全文中英同步。设置标题统一为「设置」，交互标题在原距离的一半才出现。广场面包交互移到左侧货架旁，伯尔移到喷泉右侧；移除军营文件签名交互。First main interactions introduce Influence, Momentum, Burr's two relationships, and Washington Trust with concise explanations. Settings and nearby labels are simplified, and the square's interaction positions are updated.

高俯视 Q 版美术覆盖 9 位场景角色，镜头进入最高 30% 时自动切换，维持脚底位置及现有动作；修复保皇派主像素人物的灰色背景。Nine scene characters switch to newly drawn overhead sprites in the upper 30% of the camera range, with their feet and actions preserved. The loyalist portrait's gray background is fixed. [美术与生成提示](docs/art/high-angle-pixel-0.5.1.md) · [验收记录](docs/0.5.1-validation.md)。

## 进入界面 / Entry screen

根地址现在显示独立的纽约港进入界面：原创油画主视觉、衬线标题与旧金色入口。首页仅提供「启程」，进入三维主线；不再展示经典叙事和自由漫游入口。标题页本身不加载 Three.js 引擎。The root URL opens the New York harbor title screen with original painted key art. Begin your story is the only play entry and opens the 3D narrative. The Three.js engine does not load behind this title screen.

点击「启程」立即响起已有序幕音乐，按钮放大并亮起；停留 2 秒后，在同一页面渐隐切换用户剪辑的 57.2 秒开场 CG。CG 宽高均为原来的 50%，居中、四周黑底，从第一帧开始；播放期间准备三维场景。片尾约 49.5 秒起利用原有黑场显露「海的另一边」标题，保留片尾音轨并柔和收尾，再淡入码头读信，随后按原剧情进入第一幕。战役徽章属性盘在序幕隐藏，抵达第一幕纽约街头后才出现。影片支持暂停／继续、音量、静音与跳过；播放受限或资源失败时可重试或跳过。Begin immediately starts the existing prologue music with an enlarged, illuminated button response. After a two-second hold, the title fades into the user's 57.2-second film in the same document. The film starts at its first frame, centred at half its former width and height with black surroundings, while the 3D world prepares. At approximately 49.5 seconds, the original black tail reveals the Across the Sea title while its soundtrack finishes. The curtain then opens onto the dock and letter, followed by Act I. The campaign dial stays hidden throughout the prologue and appears on arrival in New York. Pause/resume, volume, mute, skip and playback-failure recovery remain available.

当前网页播放 `public/video/opening-2026-09-14-web720.mp4` 的 720p 优化版，保留原剪辑与音轨。直接打开 `?story=3d` 仍进入章节启动流程，便于游戏回归；完整开场体验从根地址「启程」进入。初始接入记录见 `docs/plans/2026-09-11-opening-film.md`。The current web player uses the listed 720p optimized video with the original edit and soundtrack. Direct `?story=3d` links retain chapter startup for regression checks; begin at the root title screen for the full opening sequence.

中文、英文和双语可在右上角即时切换。设置提供三维画质、文字速度与两路音量；游玩须知说明键鼠操作与当前存档范围。小窗口保留主入口，窄屏可纵向滚动，但游戏仍以桌面键鼠为验证范围。Switch languages at the top right. Settings offer 3D graphics, text speed, and separate music and voice levels; Before you begin explains controls and save behavior. The story entry remains available in smaller windows, with vertical scrolling on narrow screens; gameplay remains designed for desktop keyboard and mouse.

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
- Esc 暂停，可切换中文/英文/双语 · 中文主字幕/双语 · 英文主字幕、文字速度、画质与音量；暂停和语言切换保留当前对话/倒计时/活动状态。重开本幕恢复进入时的选择与数值，不会叠加奖励。只有结局保存完整成绩；刷新页面重新开始主线。Pause with Esc. Choose Chinese, English, bilingual with Chinese primary, or bilingual with English primary. Settings preserve dialogue and activity state; chapter restart restores its entry checkpoint. Only completed results persist; a reload begins a fresh story.
- 主线字幕继续默认中文主字幕、英文副字幕。过幕渐入/渐出各 550 ms，标题等待 2875 ms；减少动态使用 250 ms。Bilingual mode remains the default, with the existing transition timings.
- 六幕标题均接入正式背景：海上、纽约街头、酒馆、辩论广场、华盛顿军营、约克镇。`?art=a/b/c` 优先用所选版本，缺少版本则用同一幕已有版本；后三幕已补齐 A 版，B/C 自动复用同章 A 版。图片有全屏遮罩与独立文字底板，英文副字幕不降透明度。图片失败或延迟不阻塞转场，也不改变等待时间。All six chapter titles have production backdrops: the sea, New York streets, the tavern, the debate square, Washington's camp and Yorktown. Requested art variants fall back within the same chapter; the final three chapters now include A artwork reused by B/C. Two scrims preserve text readability; delayed or failed images never hold up the transition.

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
| 右键拖动或右下角半透明球 / Right-drag or translucent orb | 转动与抬低镜头 / Orbit and tilt |
| 滚轮 / Scroll | 拉近与拉远 / Zoom |
| R | 镜头回到默认角度 / Reset camera angle |
| Esc | 暂停、语言、画质、音量、回到街口 / Pause, language, graphics, volume, return to spawn |

每幕有三处发现；新场景各含三段中英文环境查看内容，按主语言显示。探索记录在本次漫游中按幕保留，切场景清除移动指令和对话，语言及画质偏好保留。默认对话双语、中文为主；样例不会改写六幕游戏的选择或成绩。Each scene has three discoveries, with descriptions shown in the primary language. Scene changes preserve discoveries for this visit and retain language/graphics preferences, while clearing movement and dialogue. Dialogue defaults to bilingual with Chinese primary. Story results remain separate.

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

标题页和游戏内暂停设置均提供中文、英文、双语 · 中文主字幕（`dual`）、双语 · 英文主字幕（`dual-en`）四种模式。偏好保存在当前浏览器，切换立即生效，保留对话进度、选项、计时、成绩及配音播放位置。双语对话以所选语言为主字幕，另一种语言显示为较小的副字幕；按钮、选择选项、角色说明、玩法说明、非对话小游戏、幕间标题、状态反馈和结局等只显示主语言。Title and pause settings offer Chinese, English, bilingual with Chinese primary (`dual`), and bilingual with English primary (`dual-en`). Preferences persist and apply immediately without resetting dialogue, choices, timers, scores or voice playback. Only dialogue uses both languages, with the other language as a smaller subtitle. Buttons, choices, character descriptions, instructions, non-dialogue activities, chapter titles, feedback and endings follow the primary language.

幕间渐入、渐出各为 **550 ms**（原 220 ms 的 2.5 倍），标题等待 **2875 ms**（原 1150 ms 的 2.5 倍）。系统启用减少动态偏好时采用 250 ms 简化等待；游戏设置不再提供额外选框。

| 情境 | 操作与规则 |
| --- | --- |
| 探索 | WASD、方向键或点击地面移动；E 互动；点击人物或标记自动走近 |
| 对话 | 左键单击屏幕 / Space 显示全文或继续；E 不推进台词；1–4 或鼠标选择 |
| 酒馆 | 三人可按任意顺序交谈；读完问题后有 10 秒回应；超时记录沉默，故事继续 |
| 辩论 | 先读论点，点击准备后有 7.5 秒选 FACT / PRINCIPLE / ATTACK / CROWD；接着按 Space 或点击发声踩节拍 |
| 军令 | 三份军令、15 条信息，共 150 秒整理时间；拖拽或点击碎片，再按 1–3 / 点击栏目；提交前可更改 |
| 约克镇潜行 | A / D 移动，按住 Ctrl 蹲在掩体后；E 切换士兵跟随/待命；鼠标可按住对应控件 |
| 约克镇指挥 | 为三队分别指定 HOLD / ADVANCE / FLANK，再确认部署 |
| 约克镇突击 | 根据命令按 Space / A / D / S，或点击按钮；连续 12 道节拍指令 |
| 暂停 | Esc、暂停按钮、窗口失焦或切换标签页；所有玩法计时和移动同步暂停 |

节拍游标到金线的目标时间为 1.2 秒；Perfect ±100 ms，Good ±250 ms。每道指令只接受第一次输入。短提示音可在玩法页关闭；无音频设备也能完整游玩。尚未接入五层配乐。

语言入口始终用目标语言命名：「双语 · 中文主字幕」「Bilingual · English first」「中文」「English」。标题按钮、标题设置及游戏内设置一致，不随当前界面翻译。Language choices always use their own target language across the title and settings screens, regardless of the active interface language.

## 主背景音乐 / Main background music

主线使用用户提供的 7 个原始 MP3，保存在 `public/audio/bgm/`，文件名和 SHA-256 记录于该目录的 `manifest.json`。`src/data/music.ts` 维护映射，`MusicSystem` 使用同一个播放器循环播放，背景音乐默认音量为 60%（2026-10-18 调低 40%），首次点击启程也使用此值。标题设置和 Esc 暂停设置仅保留背景音乐和对白与旁白两路音量，拉至 0% 静音；不再提供独立开关。

The story loops seven supplied MP3s through one music player, defaulting to 60% volume, including the first Begin click. Music and voices have separate persistent volume sliders; 0% mutes each channel, with no additional enable checkbox.

标题页及 Esc 设置提供独立的「背景音乐音量」和「对白与旁白音量」滑块，范围 0–100%，背景音乐默认 60%，对白与旁白默认 100%（保留已保存的个人音量）。两路音量各自保存，实时作用于当前及后续音频；0% 即静音，调音不重播、不解除暂停，也不改变字幕或剧情进度。旧版关闭的音轨迁移为 0%，拉高滑块即可恢复声音。

Title and pause settings offer separate music and dialogue/narration volume sliders from 0–100%, defaulting to 60% for music and 100% for voices while retaining saved personal levels. Each level persists and applies to current and future clips. Adjustments retain playback position, pause state and story progress; 0% does not change the corresponding enable toggle.

CG 播放界面另有独立的「CG 音量 / Film volume」滑块，初次默认 60%，范围 0–100%，记住浏览器内的调整值。支持键盘调音；静音、暂停与进度保持独立。片尾及跳过时的渐隐始终乘以选定音量，不会回升到满音量。

The film player has a separate 0–100% Film volume slider, initially set to 60% and saved in the browser. Keyboard adjustments preserve mute, pause and playback position. Ending and skip fades scale the selected level without raising it back to full volume.

| 章节 / Chapter | BGM |
| --- | --- |
| 序幕 / Prologue | Alexander Hamilton |
| 第一幕第一场 / Act I, Scene 1 | Aaron Burr, Sir |
| 第一幕第二场 / Act I, Scene 2 | My Shot |
| 第一幕第三场 / Act I, Scene 3 | Farmer Refuted |
| 辩论游戏 / Debate activity | Cabinet Battle #1 |
| 第二幕第一场 / Act II, Scene 1 | History Has Its Eyes on You |
| 第二幕第二场 / Act II, Scene 2 | Yorktown |

点击「启程」立即请求播放序幕曲，跨 CG、序幕标题和读信连续播放；跳过 CG 不重置音乐，影片原声保留。其余章节开始切换时用 550 ms 渐隐旧曲，在入场遮罩完全移除后播放新曲。辩论活动临时替换本幕曲，确认结果并离开活动后续播原位置。Esc、失焦、隐藏页面和影片暂停都会先渐隐再暂停音乐；重开本幕从曲首开始，进入结局渐隐停播，点击返回标题会等待渐隐完成再跳转。直接关闭或刷新页面时立即清理音源。切换字幕语言不改变播放位置。浏览器拒绝自动播放时，在下一次真实键盘或指针输入重试，不阻塞剧情。

Begin starts the prologue track across the film, title and letter; skipping the film retains its playhead and the original film audio remains. Later tracks start only after the chapter curtain is fully removed. The debate temporarily replaces the chapter track, which resumes on leaving the activity. Pauses and track changes fade out over 550 ms before stopping; pauses preserve the playhead, chapter restarts reset it, and the ending fades music out. Return to title waits for the fade before navigating; closing or reloading the page cleans up immediately. Subtitle changes do not affect playback; autoplay refusal never blocks the story.

## 自动英文配音

三维游戏是唯一主流程。标题页和 Esc 设置以「对白与旁白音量」调节英文配音，默认 100%，0% 静音并保存偏好，不再提供启用选框。字幕语言独立，切换字幕不会重播。剧情由左键单击屏幕或空格推进；显示全文不会重播，进入下一句停止旧音频。

The 3D game is the only story flow. A persistent dialogue/narration volume slider controls English voices, defaulting to 100%; 0% mutes them. Subtitles remain independent. Left-click the screen or press Space to advance dialogue manually.

- 六位主要角色使用已有克隆音色；报童 VALF 儿童角色音色、市民 Chris、保皇派 Daniel。Eliza 记录故事的旁白采用温暖沉静的女声 Sarah，覆盖全部 8 句剧情旁白；章节标题、选择问题、玩法规则、反馈、成绩和结局页面保持静音。旧 George 音频保留归档。
- Eliza's narration uses the warm female Sarah voice for all eight narrator lines inside story dialogue. Chapter titles, choice prompts, game instructions, feedback, scores and ending screens have no narration. The former George files remain archived.
- 酒馆问题只显示文字；辩论对方论点由 Daniel 朗读，Hamilton 回应在踩拍后的反馈页朗读；军令碎片在选中时听读，期间保留整理时间。
- 约克镇先读指令再启动节拍，指令键或按钮可跳过朗读，跳过本身不计成绩。
- 暂停、切出窗口和隐藏标签页暂停语音；重开、离开和销毁清理旧队列。加载失败、播放受限或卡住不会阻止继续游戏。
- 玩家直接加载已生成的静态 MP3，不调用 ElevenLabs，也不会消耗生成额度。

`public/audio/en/manifest.json` 保存 202 条可播放台词到 201 个 MP3 的映射，已覆盖全部 10 个说话角色。此前生成的 249 个界面旁白 MP3 仅归档，不在运行时索引或后续生成队列内；归档清单见 `docs/voiceover/archived-ui-narration-manifest.json`。`src/data/voiceover-catalog.json` 是生成脚本同步维护的精简运行时索引，避免从 public 导入资源。`src/systems/VoiceoverSystem.ts` 管理单一播放队列、暂停、设置与容错；`src/ui/voiceover.ts` 按说话人与完整英文文本查找音频。`scripts/voiceover-check.mjs` 使用真实浏览器检查 MP3 播放、开关、设置布局与玩法计时。

## 双侧像素对话人物 / Pixel dialogue portraits

主线、分支回应、地图发现和闲聊均显示相向的两侧像素人物，上半身露在对话框上方；同一对话内保持左右位置，多人接话时按实际发言替换人物。说话者亮起并随真实音频做口型和轻微点头，聆听者覆盖灰黑蒙版。选中的玩家回应先由 Hamilton 说出，随后随下一条音频切换焦点。静音使用短时动作，减少动态保留静态人物，暂停、缓冲或语音结束时停止动作。

Story lines, replies, discoveries and repeat conversations show two inward-facing pixel figures above the dialogue box. They keep their sides through a conversation and swap cast members when another speaker joins. Actual audio drives mouth movement and small nods; a grey-black mask dims the listener. Selected player replies focus Hamilton first, then the next voice takes the spotlight. Muted lines use brief timed gestures; reduced motion keeps portraits still. Pausing, buffering and the end of speech stop the motion.

旁白为音乐剧 Eliza 的浅蓝裙形象，面部完全隐藏在阴影里，以书页和羽毛笔表达「Eliza 在记录」；她使用执笔动作，不露出口型。辩论台词、军令朗读和战斗指令复用同一效果。字幕独立滚动，人物不会被长文裁掉；四种语言和双语小窗口保持当前人物、语音及玩法进度。

The narrator appears as musical-theatre Eliza in pale blue, her face entirely concealed in shadow. An open book and quill express Eliza recording the story; she writes instead of showing mouth movement. Debate lines, dispatch readings and battle commands share the presentation. Text scrolls independently below the portraits, and all four language modes preserve the cast, voice and gameplay progress.

验收脚本：`scripts/dialogue-portraits-check.mjs`。女声替换与旧音频归档证据：`docs/voiceover/eliza-narrator-verification.json`。Browser verification uses `scripts/dialogue-portraits-check.mjs`; female-narration and archive verification are recorded in `docs/voiceover/eliza-narrator-verification.json`.

## 场景角色与再次交谈 / Cast and repeat conversations

第一幕第一场与第三场均有保皇派、市民和伯尔的实际人物；保皇派与市民在首次交互前相向争论，交替使用指点和摊手姿势。沿用已有角色美术，新增市民及争论动作图集。暂停冻结动作，减少动态时保留静态争论姿势。酒馆 Lafayette 位于右下桌前，人物与互动点均避开桌椅。

Act I scenes 1 and 3 include the loyalist, citizen and Burr. Before their conversation, the two disputants face each other and alternate pointing and open-handed gestures based on the established character art. Pauses freeze them, and reduced motion retains a static argumentative pose. Lafayette stands in front of the lower-right tavern table with a clear approach path.

每位场景角色完成其关联的主线对话后，会保留「闲聊」入口，也可点击人物或靠近后按 E。闲聊为每个角色固定的一句双语台词，使用对应英文配音；可以反复听，不推进主线、不修改选择/成绩、不重复发奖励。仍有未完成关联对话时优先处理主线，重开本幕恢复原有对话流程。

After a character's associated story conversations are complete, click the character or their Chat marker, or approach and press E, to hear a fixed bilingual remark with their English voice. Repeat conversations never advance the story, change choices or scores, or grant rewards. Unfinished story interactions retain priority, and restarting a chapter restores the original sequence.

报童已从 Liam 改为目录中用于儿童角色的 VALF 音色；旧文件与映射保留归档。连接器目录标题含 Child，而官方 CLI 当前标题省略此词，同一 ID 的描述均明确提及儿童角色，原始证据见 `docs/voiceover/newsboy-child-voice-selection.json`。

The newsboy now uses the VALF child-character voice; the old Liam recording is archived. The connector's title includes Child while the current CLI title omits it; both identify the same voice and describe children's characters. The observed catalog records are preserved in the voice-selection evidence file.

## 结果如何产生

- **Debate**：最多六轮；群众支持 ≥75 或对方可信度 ≤25 即获胜。不同回应改变支持与可信度的幅度不同；反击失拍会反噬。成功节拍维持 Flow。至少三次 FACT 增加 Burr 尊重 10；至少三次 ATTACK 增加竞争 10。影响力与锐气按胜负和表现结算。
- **Writing**：目标/时限放 PRIORITY，人员/补给放 ACTION，地点/状况放 CONTEXT。每份提交后展示校对稿；首次分类准确率影响 Washington 信任。未分配和超时未完成的信息计为缺漏，校对阅读不计时。
- **Yorktown**：每处哨岗发现玩家或士兵扣 20 突袭优势，只扣一次；需要全队抵达。战术说明提示三队职责，部署影响守军士气与位置。表现分 = 突袭优势 20% + 部署配合 30% + 节拍 50%。
- **失败继续**：辩论失利、军令错放、潜行被发现和突击漏拍都不会要求重玩；成绩和关系如实保留，历史剧情继续。
- **防重复与回滚**：成绩只在结果页确认后入账一次。重开恢复本章进入时的数值、选择与小游戏；退出清理界面、输入和提示音。
- **持久化**：localStorage 只保存已完成标记与最后一份完整结果，不保存中途进度。结局展示真实完成的辩论、写作与战役表现；兼容早期叙事版结果。

## 当前素材与后续阶段

游戏已接入历史环境方向的美术预览，`?art=a` / `b` / `c` 切换风格；[美术图册](http://127.0.0.1:1776/art-review/) 可并排查看。当前立绘 **12/33**、背景 **10/18**、场内 SVG **33/33**。三维主线六幕背景已齐，尚缺的八张为备用 B/C 画风；主线会复用同章已有版本。图片目前使用不透明底，并非透明立绘。The art gallery contains 12/33 portraits, 10/18 backgrounds and 33/33 legacy SVG assets. All six 3D story chapters have backdrops; the eight remaining backgrounds are optional B/C variants. Missing variants use existing artwork from the same chapter.

美术以 `art-direction/素材提案.md` 为较新的方向：环境参考历史场景，人物保留音乐剧服装辨识度。原规格中的舞台美术约束已被此前用户指令覆盖。原卡剧照只用于参考图册，正式画面使用生成或自制资产；参考说明以本地素材记录为准。

当前实际缺口详见 [素材补齐清单](docs/素材补齐清单-2026-09-08.md)：优先为辩论、军营和约克镇补三张正式过场，再补配乐与环境音。

剩余阶段：补齐并验收美术、五层音乐与 BPM 联动、完整声画润色、时长与难度平衡、首次玩家测试。本版不宣称达到原规格 20–30 分钟或 Yorktown 约 8 分钟的体验目标。没有账号、后端、装备、开放世界或新章节。

## 开发入口

- `AGENTS.md`：后续玩家可见文字与美术文字必须同步生产中英文；不要以空白翻译占位。
- `src/i18n/text.ts`：配对文案、格式化、语言偏好、DOM 字幕与完整配音文本。新文案用 `bi(中文, English)`，动态参数用 `f`，中性拼接用 `cat`；普通界面用 `setText` / `setLabel` 显示主语言，对话正文用 `setDialogueText` 显式支持双语。
- `scripts/check-i18n.ts`：检查遗漏配对、英文混入中文、模板参数不匹配及双语对象的错误插值；由构建自动执行，也可单独运行 `npm run check:i18n`。
- `src/data/chapters.ts`：剧情、选项及小游戏入口。
- `src/data/debate.ts` / `writing.ts` / `yorktown.ts`：论点、军令碎片、战术与指令数据。
- `src/systems/TimingSystem.ts` / `DebateSystem.ts` / `WritingSystem.ts` / `YorktownSystem.ts`：纯逻辑规则与活动时间。
- `src/ui/Activity.ts` 与三个 `*Activity.ts`：场景拥有的玩法界面、输入与提示音。
- `src/story3d/StoryDirector.ts` / `StoryUI.ts`：唯一主线的探索、对话、配音和小游戏生命周期。
- `src/systems/StateSystem.ts`：状态限制、结果防重、检查点与完成结果保存。
- `src/data/ending.ts`：按真实选择与成绩生成结局侧写。
- `src/story3d/`：纯剧情进度、章节空间映射、场景剧情调度、双语对话与八方向 NPC；`?story=3d` 从序幕走到结局。
- `src/demo3d/`：三维样例入口、街区模型、导航、像素角色、景深及遮挡处理；`?demo=3d` 懒加载，标题页不加载游戏引擎。

## 浏览器回归

已有 Playwright 的机器可运行：

```sh
HAMILTON_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs HAMILTON_BROWSER=chrome node scripts/entry-check.mjs
HAMILTON_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs HAMILTON_BROWSER=chrome node scripts/release-0.4.0-check.mjs
HAMILTON_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs HAMILTON_BROWSER=chrome node scripts/subtitle-check.mjs
HAMILTON_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs HAMILTON_BROWSER=chrome node scripts/opening-film-check.mjs
HAMILTON_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs HAMILTON_BROWSER=chrome node scripts/music-check.mjs
HAMILTON_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs HAMILTON_BROWSER=chrome node scripts/volume-check.mjs
HAMILTON_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs HAMILTON_BROWSER=chrome node scripts/voiceover-check.mjs
HAMILTON_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs HAMILTON_BROWSER=chrome node scripts/chapter-transition-check.mjs
HAMILTON_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs HAMILTON_BROWSER=chrome node scripts/demo3d-check.mjs
HAMILTON_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs HAMILTON_BROWSER=chrome node scripts/eight-direction-check.mjs
HAMILTON_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs HAMILTON_BROWSER=chrome node scripts/multi-scene-check.mjs
HAMILTON_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs HAMILTON_BROWSER=chrome node scripts/story3d-check.mjs
HAMILTON_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs HAMILTON_BROWSER=chrome node scripts/street-atmosphere-check.mjs
```

三维主线脚本默认验证故意失误仍可通关；添加 `HAMILTON_ROUTE=success` 验证成功操作及对应成绩。两种路线都会实际行走十二处互动，检查暂停、中英切换、酒馆超时、章节重开和结局保存。`scripts/story3d-focus-check.mjs` 单独检查人物身体点击、Tab 焦点循环、选项提示与 Enter 单次提交。

`scripts/street-atmosphere-check.mjs` 检查扩大后的码头通行、序幕迷雾在读信与解锁后的保持、重开恢复、进入街头后显露，以及语言切换、画质与小窗口画面。The street atmosphere check covers the expanded dock, persistent prologue fog, restart and entry behavior, language and quality settings, and smaller viewports.

可省略 `HAMILTON_PLAYWRIGHT_MODULE` 使用项目可解析的 Playwright；浏览器默认 Microsoft Edge。`HAMILTON_URL` 可指向独立预览地址。`scripts/gameplay-helpers.mjs` 为全流程回归提供正常和故意失误的操作路线，包括拖拽、键盘和暂停冻结检查；截图保存在忽略目录 `artifacts/`。设置 `HAMILTON_ROUTE=success HAMILTON_CHECK_RESTART=1` 可额外验证三个玩法章节重开；设置 `HAMILTON_ROUTE=mistakes HAMILTON_CHECK_TIMEOUT=1` 可验证酒馆超时。实际验证记录见 `开发记录.md`。

入口回归 `entry-check.mjs` 检查四种语言模式与桌面/小窗口/窄屏排版、弹窗键盘焦点、设置保存、唯一主线入口及结局返回标题；已移除横版专用回归脚本。

`subtitle-check.mjs` 使用实际 StoryUI 和玩法状态机，检查四种模式、主副字幕换序、非对话单语、打字进度、选项倒计时、三类小游戏各阶段的状态保持与完成，以及窄屏布局和偏好保存。`subtitle-check.mjs` exercises the production UI and activity systems to verify all four modes, subtitle order, primary-language interface text, typewriter progress, choice timers, activity state and completion, narrow layouts and saved preferences.

全流程脚本默认选择中文便于兼容旧回归；设置 `HAMILTON_LANGUAGE=en`、`dual` 或 `dual-en` 验证英文、中文主双语或英文主双语。设置 `HAMILTON_CHECK_LANG_SWITCH=1` 会在限时选择、辩论、军令和潜行暂停时切换语言，并检查时间或位置保持不变。`entry-check.mjs` 和 `voiceover-check.mjs` 检查默认中文主双语、偏好记忆、小窗口设置与字幕切换；`chapter-transition-check.mjs` 检查跟随主语言的转场。

数据链：剧情入口 → 玩法状态机 → 玩家输入与活动时间 → 表现/关系效果 → 章节检查点与全局状态 → 完成结果与结局侧写。


## 0.2.0 成长与地图发现 / Growth and discoveries

纽约入场说明 3 项主要指标和 2 项伯尔关系。HUD 采用已选定的 C「战役徽章」圆盘：透明底、由内向外的径向进度，未填充浅灰与锁定深灰斜纹分开表现。悬停五个部分查看数值，点击或按 Enter／空格打开指标详情；也可在小游戏中打开「成长」。面板暂停游戏及配音，关闭后恢复原状态和焦点。Growth introduces three main attributes and two Burr relationships on arrival in New York. The HUD uses the selected C Campaign Insignia: transparent backing and outward radial progress, with light translucent empty sectors distinct from dark hatched locks. Hover any of its five parts for values, or click / press Enter or Space for details. Growth is also available during activities. The panel pauses gameplay and audio, restoring state and focus when closed.

圆盘专项回归：`HAMILTON_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/campaign-compass-check.mjs`。三版历史样稿保存在 `art-direction/compass-ui-studies-2026-09-14/`。Dial regression: run the command above against the local Vite server; historical studies remain in the listed directory.

影响力 25/30 分别让辩论初始群众支持增加 5/10；锐气 55 提供一次反击失拍保护，MISS 与断连击仍保留；信任 8 提供一次军令片段分类提示，信任 18 提供一次单队部署核对。辅助均由玩家主动操作或在指定失误时触发，不直接代答、加分或延长时限。At 25/30 Influence, initial debate support rises by 5/10. At 55 Momentum, one mistimed attack avoids its backlash while still counting as a MISS and breaking Flow. At 8 Trust, inspect one dispatch fragment category; at 18 Trust, check one squad's deployment. Assistance never submits an answer or directly adds score or time.

纸张标识为可选发现：纽约两处、酒馆一处、广场一处、军营一处，序幕信纸另有军营呼应；广场还可按伯尔关系解锁两段交流。全部可跳过，奖励每轮仅一次，重开按章节检查点回滚。Paper markers identify optional discoveries: two in New York, one in the tavern, one in the square, and one at camp, plus a prologue letter echoed at camp. Two additional square conversations depend on Burr's respect and rivalry. All are optional, rewards commit once, and chapter restart restores the checkpoint.

新增回归：`node scripts/growth-check.mjs`、`node scripts/growth-guide-check.mjs`、`node scripts/discovery-map-check.mjs`，沿用上述 Playwright 运行时配置。前两项检验实际活动和 UI 生命周期，后一项通过实际地图移动与交互检验发现、复看、主线及结局。New regression scripts cover activity assistance, the guide's real UI lifecycle, and discoveries through actual map movement and interaction.
