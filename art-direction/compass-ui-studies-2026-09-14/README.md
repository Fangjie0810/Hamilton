# 属性圆盘三版设计比较 / Attribute dial studies

2026-09-14，根据用户的新要求制作三版比较。用户于 2026-09-15 选定 C「战役徽章」，正式实现位于 `src/story3d/CampaignCompass.ts`，通过 `GrowthCompass` 接入游戏。三版样稿保留用于设计追溯，已归档发布包保持原状。

## 查看

- 交互页：`http://127.0.0.1:1776/art-direction/compass-ui-studies-2026-09-14/index.html`
- 对比图：`comparison.png`
- 完整界面：`interactive-preview.png`
- 各版透明素材：`exports/{enamel,glass,tactical}-{unlocked,locked}.{svg,png}`，PNG 为 720 × 720。

| 方案 | 风格 | 材质 |
| --- | --- | --- |
| A · 鎏金珐琅 / Gilt Enamel | 古典精细 | 金属细边、釉面高光 |
| B · 烟色透镜 / Smoked Lens | 通透凝练 | 透光烟灰、缎面钢边、透镜反光 |
| C · 战役徽章 / Campaign Insignia | 策略游戏 | 锻铁边缘、浮雕进度、徽记和刻度 |

## 共同规则

- 背景透明，无米色背板。中心半径 52，外环半径 108，各扇区完整占据 120°；中心和外环共享边界，仅绘制分界线，不留缝隙。
- 黄色锐气、黑色影响力、墨绿色华盛顿信任均沿整个扇区从内向外增长。半径按已填充面积比例换算：`sqrt(52² + p × (108² − 52²))`。
- 浅烟灰、半透明表示未填充；实心深石墨灰、斜纹和锁头表示军营前锁定。
- 中心红上蓝下表示 Burr 竞争与尊重。分界高度以两项差值的 `tanh` 映射放大变化，并保留真实独立数值。
- 五个区域支持悬停、键盘聚焦和点击解释；三版同步调整数值。支持锁定、背景、174 px 实际尺寸和中英文切换。
- 使用项目 `bi` 配对维护文案；预览页语言切换不覆盖游戏语言偏好。
- 导出图为固定比较样本：解锁态 61 / 36 / 44，竞争 18、尊重 24；锁定态信任为 0。交互页面默认采用街头样本，可自由调节。

## 验证

`render-check.mjs` 验证五档进度面积、完整扇区径向填充、透明像素、锁定灰与未填充灰的透明度和亮度差、键盘说明与焦点恢复、语言切换及 390 px 窄屏布局，同时输出素材和 `verification.json`。

```sh
HAMILTON_PLAYWRIGHT_MODULE=/Users/fangjie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs node art-direction/compass-ui-studies-2026-09-14/render-check.mjs
```

预览数据 → 共用几何 → 三种材质渲染 → 五区域交互 → 透明导出与截图检查。
