# 首页文案与 H.T.T.X. 品牌调整

按用户要求将首页介绍替换为「一封信、一个移民、一场革命、一段历史」，英文为 “A letter, an immigrant, a revolution, a chapter of history”。页脚两种语言统一显示 “Created by H.T.T.X.”。

左上角使用用户提供的 H.T.T.X. 行星 Logo，暖金色与现有页面配色一致，透明背景。悬停或键盘聚焦时轻微上浮并展开「点击访问主页 / Click to visit homepage」提示；链接在新标签页打开 https://bio.newflorencia.com/。减少动态时取消过渡动画。

标题唱片默认从 My Shot 开始，后续依次为 Farmer Refuted、Cabinet Battle #1、History Has Its Eyes on You、Yorktown、Alexander Hamilton、Aaron Burr, Sir，然后循环。复用单一播放器；启程继续从零播放原序幕曲。

验证范围：现有音乐系统测试、完整 npm test、npm run build（含双语和 TypeScript 检查），以及浏览器中的四语言文案、Logo 与链接、键盘提示、桌面与小窗口布局、实际唱片状态和启程音乐衔接。仅本地开发，版本仍为 0.5.2。

Logo 使用内置 image_gen 编辑，原文件保留。提示词：从原图提取行星、两颗卫星和完整 H.T.T.X. 字样；保留形状、比例、倾角、字体与四个句点，将黑色改成 #cbae73，移除方格和外围背景，输出透明 PNG，四周保留少量透明边距，不添加纹理、阴影、发光或其他元素。

已保存素材：`public/art/entry/httx-logo-gold-v1.png`，已检查透明通道和页面实际显示。

验收结果：199/199 项测试通过，双语完整性、TypeScript 和 Vite 构建通过。浏览器确认四种语言的文案和署名、Logo 资源加载与外链属性、键盘聚焦提示、My Shot 播放状态及唱片转动、切换下一首与暂停。1440×900 桌面、390×844 两种双语窄屏及 1024×640 小窗口无横向溢出；新文案同时保留在较矮桌面布局，1024×560 英文模式内容与页脚不重叠。游戏启程音乐交接由音乐系统现有测试覆盖，本次未重跑完整剧情。

浏览器首次阻止自动播放时仍使用已有「点击播放」入口，点击后实际状态为 playing；不会用额外代码绕过浏览器播放策略。截图与日志保存在 `artifacts/home-branding-2026-10-18/`。
