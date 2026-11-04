# 0.5.1 高俯视图集 GPU 回归

专项脚本：`scripts/high-angle-textures-check.mjs`。它调用实际 `PixelActor`、`StoryNpc` 与 `disposeWorld`，用两张纯色图集明确区分 GPU 实际显示的来源。原始 Q 版美术本身由场景专项另行验证。

## 已发现并修复的问题

Three.js 0.185.1 将 GPU 纹理绑定缓存于 source 和纹理参数。直接替换已上传纹理的 `source` 并设置 `needsUpdate`，虽然 CPU 原图没有被更改，但仍会复用旧 GPU 绑定。

最小 WebGL 复现中，A、B 两个克隆最初均显示红色；仅将 A 换为蓝色 source 后，A、B 都显示蓝色。随后销毁 A 抛出 `Cannot read properties of undefined (reading 'usedTimes')`。这会影响场景角色的图集隔离及高视角后的章节切换。

正式实现现于替换 source 前调用 `texture.dispose()`，先释放旧 source 的 GPU 引用，再更换 source、标记更新。帧 UV 和材质对象保留。

## 最终结果

- 实际两种角色类均通过：A 使用高俯视蓝色图集时，B 仍显示标准红色图集。
- 每类完成 4 次完整来回切换；每轮回到标准视角后的 GPU 纹理数与初始一致，帧号、UV 和读取到的像素一致。
- 从实际平面几何顶点计算第 120 / 128 像素的脚底线，俯仰旋转前后仍与角色根坐标重合。
- 两种角色在高俯视状态销毁整个场景均无异常，GPU 剩余纹理数均为 0。
- [完整回归数据](high-angle-textures-check.json)。

运行方式：

```sh
HAMILTON_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs BASE_URL=http://127.0.0.1:1776 HAMILTON_BROWSER=chrome node scripts/high-angle-textures-check.mjs
```

链条：视角阈值 → 释放旧 GPU 引用 → 替换原图来源 → 保留帧 UV → GPU 像素与脚底线验证 → 高视角场景销毁。
