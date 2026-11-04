# 双侧像素对话人物 Implementation Plan

**Goal:** 为三维主线的全部对话提供相向的左右半身像素人物，补齐旁白人物，并让说话动作与实际配音同步。

**Architecture:** 复用现有人物图集，通过独立 DOM/Canvas 立绘组件放大上半身。剧情状态提供当前人物及同场对话者；语音系统发布真实播放状态，表现层据此切换高亮、暗色遮罩与口型。保持字幕、选项、计时和章节检查点的现有生命周期。

**Tech Stack:** TypeScript、DOM、Canvas、CSS、HTMLAudioElement、Node test、Playwright。

## 实现与检查

1. `src/data/dialogueCast.ts`、`src/ui/DialoguePortraits.ts`、`src/ui/dialogue-portraits.css`：覆盖全部十位说话者，复用九位既有人物；按用户追加要求，旁白为音乐剧形象的 Eliza，浅蓝裙、面部隐于阴影、手持书页与羽毛笔，使用执笔动作且不显示口型。保持双侧槽位、相向朝向、上半身裁切，静音时使用短时说话动作；减少动态保持静态。
2. `src/systems/VoiceoverSystem.ts`、`tests/voiceover.test.ts`：发布正在播放、等待、暂停、切句及结束状态；验证旧播放事件不会污染新台词。
3. `src/story3d/StoryUI.ts`、`StoryDirector.ts`、`StoryProgress.ts`、`Discoveries.ts`：传递真实当前对话上下文；立绘独立于字幕滚动区；选择回应的两条配音切换人物焦点，语言切换保留节点和进度。
4. `src/ui/Activity.ts`：让三类活动的实际台词共用相同组件；玩法说明不增加旁白。
5. `tests/dialogue-cast.test.ts`、`scripts/dialogue-portraits-check.mjs`：覆盖角色、相向位置、暗化、口型、配音切换、暂停、快速推进与清理，以及四种语言和桌面/小窗口布局。
6. 运行 `npm test`、`npm run build`、人物浏览器回归和 `scripts/subtitle-check.mjs`，查看实际截图并修正布局。

采用复用图集方案以保持当前像素人物辨识度。独立制作全部高清立绘会改变既定画风，单纯放大三维镜头则无法稳定形成两侧对话构图。此目录无 Git 元数据，直接在当前工作区完成实现与验证。本次为本地开发，不执行发布。

数据链：实际剧情句子与同场角色 → 两侧人物槽位 → 配音播放事件 → 说话者焦点、口型与动作 → 翻页或退出时清理。
