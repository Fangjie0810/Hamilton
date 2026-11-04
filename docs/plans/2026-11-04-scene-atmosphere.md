# 场景氛围与门槛透视 Implementation Plan

**Goal:** 酒馆呈现暗暖旧木与炉火，纽约呈现昏黄夜灯和可见边界，舞会采用泛蓝灯感；建筑只在角色进门后开启透视。

**Architecture:** 共用房间结构记录门槛通行状态；墙和屋顶不再参与镜头射线自动透视。每个场景分别配置环境光，实际灯具对应局部光源；视觉边界与碰撞一起生成。复用导航、收藏品、缩放和已有裁切稳定性修复。

**Tech Stack:** Three.js、TypeScript、Vite、Node tests。

## 1. 门槛状态与回归

修改 SceneryKit.ts 和 StableCutaway.ts；新建 RoomAccess.ts。记录上一帧脚底位置，检测穿过真实门洞，越过内侧阈值后进入，越过外侧阈值后退出；初始出生点允许位于室内。测试墙外靠近、门口停留、进出、共享门墙、快速通行与场景出生点。排除建筑墙屋顶的自由射线裁切。

## 2. 场景灯光与物件

新建 lighting.ts，修改 Experience.ts、Worlds.ts 和 SceneryKit.ts。纽约夜色与暖灯池；酒馆降低全局亮度、改深木护墙和暗窗、错缝旧木地板、实心砖炉和柴火、黄铜酒具与壁饰；舞会用蓝侧光和暖吊灯。光源数量受控，沿用单一阴影主光。

## 3. 地图边界

纽约四周加入砖墙、封闭木门、草带及码头栏杆，碰撞与可见结构一致，保留所有门洞、收藏品站位与连续路径。

## 4. 验证与交付

运行 npm test 和 npm run build；浏览器检查三场氛围、100%–140% 缩放、街头贴墙不透视、门洞进出、夜景收藏品可见性及浏览器错误。保存实际截图和新版模型，不自动部署。

参考：Fraunces Tavern Museum 的 Long Room 复原与建筑资料，仅参考木作、砖石、壁炉和陈设方向，不宣称完整历史复刻。
https://www.frauncestavernmuseum.org/the-long-room-exhibition
https://www.frauncestavernmuseum.org/architecture-restoration
