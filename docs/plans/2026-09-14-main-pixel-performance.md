# 主像素美术与态度演出 Implementation Plan

**Goal:** 以用户批准的 Eliza 画法和双人说话动作为正式主像素美术，覆盖全流程角色态度，清除底色残边并记录 0.3.0 大内容版本。

**Architecture:** 精确审计 202 条台词，以稳定文本索引映射说话、句后、听者态度；10 张角色图集独立于 Q 版素材，由统一像素提取与去污染模块渲染。实际 voice playback 驱动开口；waiting/pause 与结束分离，结束保留句后反应；重复和跳句沿用现有生命周期。

**Tech Stack:** TypeScript、Canvas、image_gen、HTMLAudioElement、Node tests、Playwright、现有发布工具。

## 制作清单

Hamilton 8、Burr 7、Washington 7、Laurens 6、Lafayette 7、Mulligan 6、Loyalist 5、Newsboy 5、Citizen 5、Eliza 3，共 59 帧，包含 41 个闭口/记录姿态与 18 个基础开口帧。依据逐句审计制作，不无端添加狂笑。

## 执行

1. `docs/art/main-pixel-reaction-audit-2026-09-14.md`：全流程/分支/闲聊/小游戏实际语音审计；`src/data/dialoguePerformance.ts` 维护精确 cue 映射及未知台词保守回退，测试覆盖全部现有 cue 和听者关系。
2. `public/art/main-pixel/v1/`：使用 built-in image_gen，读取批准立绘作风格/身份参考，按固定行列、无字、纯绿背景、头部注册一致生成十名角色；保留提示词与原件来源。`src/data/mainPixelArt.ts` 维护图集与语义姿态。
3. `src/ui/portraitPixels.ts`：颜色解混、连续 alpha、黑轮廓保护、逐格碎片清理及统一注册；通过合成边缘与原图检查解决残粉，不修改 Q 版美术。
4. `src/ui/DialoguePortraits.ts` 和 CSS：高分辨率绘制基础嘴形、句后及听者反应，相向大半身和 inactive 蒙版；姿态保持直到新句或关闭。
5. `src/ui/DialoguePresentation.ts`：当前实际 cue 对应态度，语音开始/结束、暂停、等待、静音、快速跳句、选项+回复、减少动态均验证；不扩展旁白范围。
6. 浏览器验证所有59帧、粉/绿边、相向、句后、听者、暂停与四种语言窄屏；跑现有全主流程与对白检查，必要时修复素材或取帧。
7. 更新 package.json 为0.3.0和 CHANGELOG；执行 `npm run release:pack -- --notes '主像素人物与全流程态度演出'`，该工具运行 npm test、release tests、i18n、TypeScript与生产构建，保留网站及源码归档。用户要求记录版本，未请求上线，因此不执行上传或current切换。

数据链：剧情/选项/小游戏真实台词 → 精确态度表 → 当前语音生命周期 → 图集嘴形与句后/听者姿态 → 双侧画布 → 测试、构建与版本归档。

## 最终执行结果

10位角色59帧已全部生成并接入，完整回归通过。共享项目的另一项工作先完成0.4.0归档，已经包含本任务最终素材和全部运行时代码，因此保留0.4.0正式版本，没有另建0.3.0归档。当前完整生产构建与0.4.0网站档逐文件一致、全部src文件与源码档一致，详见 `docs/art/verification-0.4.0/archive-consistency.json`。合入新增报童台词后，覆盖测试直接枚举203个实际脚本位置；179项单元测试、7项发布工具测试、双语检查和生产构建通过。后续只加强覆盖测试及更正验收记录，未改归档或游戏运行时代码。
