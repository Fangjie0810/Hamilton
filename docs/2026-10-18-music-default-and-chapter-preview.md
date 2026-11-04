# 启程音量与本地章节试玩

用户要求点击启程时音乐降低 40%，改善未设置音量时的首次体验；并确认当前浏览器要跳到广场公开辩论。

背景音乐默认值从 100% 改为 60%，涵盖标题唱片、启程和后续章节。已保存的音量、0% 静音和旧静音偏好迁移继续生效；对白与旁白、CG 音量独立。Music now defaults to 60% across the title, Begin and chapters. Saved levels and mute preferences remain effective; voices and film audio stay independent.

增加仅开发模式启用的章节入口：`/?story=3d&chapter=Debate`。生产构建仍固定从序幕开始，非法章节名也回到序幕。章节试玩复用实际场景、音乐、人物、交互、进入检查点与下一章流程；使用初始属性，不伪造前面章节的选择或成绩。A development-only chapter URL starts at a real chapter entrance with initial stats, its own restart checkpoint and the normal subsequent story flow. Production always begins at the prologue.

验收：200/200 项测试通过；双语检查、TypeScript 与 Vite 构建通过。新增章节测试覆盖初始属性、重开检查点、进入下一章和新游戏回到序幕；音乐测试确认新用户从标题进入序幕保持 60%，已保存值保留。生产产物中的 startingChapter 固定为 Opening。

当前用户 Chrome 标签页已进入第一幕第三场「把声音放到街上」的广场入口。实际设置核对：背景音乐 60%、对白与旁白 70%，画质精细、正常文字速度和中文主双语保留。音量验证后页面已回到可操作场景，用户已继续完成广场的「面包与货价」交互；保留其当前进度。截图与日志保存在 `artifacts/music-default-2026-10-18/`。本次仅本地修改，版本号仍为 0.5.2，未部署。
