# Eliza 风格动作样稿 / Eliza-style action studies

2026-09-14 · 待评审 / For review

用户认为第一轮四种主像素风格游戏感不足、姿态缺少张力。本轮以现有 Eliza 主像素立绘的硬边轮廓、雕塑般的明暗色块、厚实衣褶和稍带动画感的人物比例为参考。这里的“高精细、半写实游戏像素立绘”是方向描述，不是严格的流派名称。

The first four directions lacked game-character presence and expressive poses. This study follows the existing Eliza portrait's hard pixel contours, sculptural shading clusters, substantial fabric folds, and slightly animated character proportions. “Detailed, semi-realistic game pixel portrait” is a descriptive direction, not a formal genre label.

| 角色 / Character | 动作 / Acting | 朝向 / Facing |
|---|---|---|
| Hamilton | 身体前倾，一手靠近胸口，另一手向对方递出论证；专注、急切。 / Lean forward, one hand near the chest, the other offering an argument; focused and urgent. | 右 / Right |
| Lafayette | 挺胸、下巴略抬，一手撑腰，另一手摊开邀请行动；自信、舒展。 / Open chest, chin slightly raised, one hand at the waist and an inviting open palm; assured and expansive. | 左 / Left |

每张 1536 × 1024，按三列排列：闭口蓄势、普通开口、强调开口并增加手势。页面用前两帧表现普通说话，第三帧用于短暂强调；不把手势变化循环成每个音节的挥手。

Each 1536 × 1024 sheet contains three columns: closed/ready, ordinary speech, and emphasized speech with a larger gesture. The preview alternates the first two during ordinary speech and briefly uses the third for emphasis.

`index.html` 为独立的左右对话动作预览，非游戏正式素材替换。预览尚未连接配音；后续若选定此稿，正式游戏仍应由实际语音播放状态触发动作，新句子和语音开始时一起出现，语音结束时收口。生成帧有少量轮廓与位置差异，正式接入前应继续检查帧间稳定性。

`index.html` is a standalone dialogue-motion review, not a production asset replacement. No voice is attached to this preview. If selected, the production animation should follow actual voice playback: begin with the new line and voice, then close the mouth when speech ends. Generated frames contain small contour and position differences that need review before production integration.

人物无烘焙文字。纯品红为页面渲染使用的色键背景；页面展示时移除，文件原件保留。最初带棋盘格的生成结果仅在 `source/` 留档。完整提示词、来源与编辑记录见 `prompts.json`。

No text is baked into the character art. Solid magenta is keyed out by the review renderer while the originals remain intact. Initial checkerboard outputs are archived in `source/`. See `prompts.json` for prompts, provenance, and the background-edit record.
