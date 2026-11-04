# 0.5.1 主像素美术灰框修复

## 原因与处理

保皇派 v2 图集的实际绿幕众数为 `RGB(4,249,20)`，与原先声明的纯绿 `#00ff00` 不同。蓝通道差值 20 超过默认抠像容差 18，背景被保留成低透明度灰色矩形；只检查绿色残留无法发现这种中性灰底。

- `mainPixelArt.ts` 将保皇派 key 改为实测 `#04f914`，市民 v2 同步使用其实际众数 `#04f70b`。
- `portraitPixels.ts` 按实际 key 的高低通道色差归一化，继续使用原有局部前景拟合、连续 alpha 与边缘颜色恢复。非纯 RGB 绿幕也对应完整的背景色度，避免边缘残留绿色。
- 两张生成原件保持原样，未重绘、裁切或覆盖。人物朝向、5 帧语义与说话循环不变。

## 验证

- `node --import tsx --test tests/portrait-pixels.test.ts`：18 项通过，包括 v2 背景完全透明和非纯绿幕边缘恢复回归。
- `scripts/main-pixel-art-check.mjs`：Chrome 浏览器 10 位角色、59 帧全部通过；正常说话、重音、闭口反应、听者变暗、暂停、减少动态、390 px 布局通过。
- 对 v2 两角色每帧左上经审查为空背景的 96 × 96 原图区域直接测量 alpha。保皇派修复前平均 alpha 为 15.27–24.36 / 255；保皇派与市民共 10 帧修复后均为 0。此透明度断言已加入全帧检查脚本。
- 已逐图查看 [保皇派全部 5 帧](loyalist-all-frames.png) 与 [市民全部 5 帧](citizen-all-frames.png)，人物轮廓、手部、纸页和发丝清晰，背景无灰蒙矩形。
- 完整数据：[浏览器回归报告](main-pixel-art-check.json)。

原图 SHA-256：

```text
824453b05baf0edeb02fdccaf5869736a632d39ec3fd68447f16d00a654f018d  public/art/main-pixel/v2/loyalist.png
ff54324974f987e390d01f2845e79ae07ba468ff1af227207c1fee806eee8eb8  public/art/main-pixel/v2/citizen.png
```

链条：图集实际绿幕 → 角色 key 元数据 → 共享抠像与边缘恢复 → 统一帧注册 → 对话正常／听者画布 → 全帧与 alpha 验证。
