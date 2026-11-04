# 拉法耶特主像素说话帧对齐

## 原因

`public/art/main-pixel/v1/lafayette.png` 的七格人物并未完全使用相同的绘制原点。普通开口帧相对基础闭口帧，头部左移约 21 个源像素、衣领和身体左移约 20 个源像素；重音帧左移约 13–14 个源像素。原先整图统一缩放只保持了帧尺寸，未纠正这些原图中的位置差。

## 改动

- `src/data/mainPixelArt.ts` 增加逐帧 `frameOffsets` 元数据，为拉法耶特七帧记录经原图检查的平移量。基础闭口帧作为原点；普通开口、重音以及句前／句后态度围绕稳定的头发、眼部、衣领和躯干位置校准。
- `src/ui/DialoguePortraits.ts` 与正式主像素检查页均把该元数据传给已有 `extractPortraitFrames`。
- 继续使用 `portraitPixels.ts` 的共享抠像、原始单元格清理、24 像素横向 overscan 和统一帧缩放。偏移在统一缩放前应用，外框由所有校正后帧的完整边界计算；没有逐帧拉伸、固定裁框或删除手势。
- 所有七帧提取前后的原图边界完全一致，包括跨名义列边界的重音指尖。原图、朝向、态度语义和口型播放节奏均保持原样。

## 真实像素验证

专项脚本：`scripts/lafayette-registration-check.mjs`。对实际抠像后的 360 × 450 画布，以稳定头发、眼部、衣领和身体区域进行二维像素匹配。

| 实际输出画布锚点 | 修复前水平偏移 | 对齐后水平偏移 |
| --- | ---: | ---: |
| 普通开口：头发／眼部 | −19 / −19 px | 0 / 0 px |
| 普通开口：衣领／身体 | −17 / −17 px | +1 / +1 px |
| 重音：头发／眼部 | −12 / −12 px | 0 / −1 px |
| 重音：衣领／身体 | −12 / −11 px | 0 / 0 px |

三张说话帧的全部测量区域纵向偏移均为 0。其余四张态度帧的头发锚点水平／纵向偏移最多 1 像素；原图中的低头、眼神和手势差异继续保留。

专项另外经过真实 `DialoguePortraits` API 播放全部五种态度的句前、普通说话、重音、缓冲、暂停、系统减少动态与句后状态。每个实际显示画布的像素均匹配修正后帧，确保校正进入正式运行时。

- [可交替播放的前后对照](lafayette-registration/index.html)：可选普通口型、重音和句前／句后循环。
- [三张说话帧静态对照](lafayette-registration/comparison.png)。
- [七帧完整截图](lafayette-all-frames.png)。
- [专项真实像素报告](lafayette-registration/check.json)。
- [全 59 帧浏览器回归报告](main-pixel-art-check.json)：10 角色、59 帧、全部画像生命周期和 390 px 布局通过。
- 相关单测 39 项通过：`portrait-pixels`、`dialogue-performance`、`dialogue-presentation`。

运行专项：

```sh
HAMILTON_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs BASE_URL=http://127.0.0.1:1776 node scripts/lafayette-registration-check.mjs
```

原图 SHA-256 保持：`fc0eb8c31de8fc00d3d6ed0b686633482a32953a5619666de301c684f8117b7b`。

链条：实际图集锚点 → 逐帧源像素偏移 → 共享提帧与统一缩放 → 真实说话／态度画布 → 像素匹配与前后播放对照。
