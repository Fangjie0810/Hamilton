# Eliza 形象旁白 · 女性英文配音交付

完成于 2026-09-14。已将全部 **8 句剧情旁白** 替换为账号已有的 **Sarah - Mature, Reassuring, Confident** 女声；声音温暖、成熟、令人安心，配合 Eliza 伏案记录往事的形象。并非特定演员声音的复刻。选型证据见 [音色记录](./eliza-narrator-voice-selection.json)。

本批 1,068 个英文字符，生成 8 个 MP3，合计 **66.638367 秒、1,069,904 字节**。当前主线仍为 **202 条 cue、201 个唯一 MP3，待生成 0**。其他角色的 **193 个文件** 与 2026-09-13 交付记录逐文件 SHA-256 一致；旧 George 的 8 个 MP3 原路径及哈希完整保留，声音映射和台词链接见 [George 归档](./archived-narrator-george-manifest.json)。

沿用原生成模型与设置：`eleven_multilingual_v2`、stability 0.5、similarity_boost 0.75、style 0、speed 1、use_speaker_boost true；MP3 44.1 kHz / 128 kbps。只改变 `narrator` 的声音映射，其他角色继续使用原声音。

| 台词 ID | 时长（秒） | 女声试听 |
| --- | ---: | --- |
| opening-letter-base-1 | 7.967347 | [播放](../../public/audio/en/narrator-78cb6c04613aec6f4c52.mp3) |
| opening-letter-base-2 | 7.784490 | [播放](../../public/audio/en/narrator-29877dfe3610fdfca9c1.mp3) |
| yorktown-command-base-1 | 9.926531 | [播放](../../public/audio/en/narrator-f849c69d1f1e66042a94.mp3) |
| yorktown-command-variant-1-1 | 9.090612 | [播放](../../public/audio/en/narrator-4372534d59cf9872d1fd.mp3) |
| yorktown-surrender-base-1 | 7.105306 | [播放](../../public/audio/en/narrator-c46dd65fa5e4e5de7566.mp3) |
| yorktown-surrender-base-2 | 10.292245 | [播放](../../public/audio/en/narrator-f1b22e22628022f29c5a.mp3) |
| discovery-letter-name-base-1 | 7.758367 | [播放](../../public/audio/en/narrator-95349bc3f147f93dc1af.mp3) |
| discovery-tavern-unfinished-draft-base-1 | 6.713469 | [播放](../../public/audio/en/narrator-b605aac5a153cf8807ec.mp3) |

旁白范围仍严格限定 `speaker: narrator` 且 `kind: dialogue`。章节标题、选项问题、界面、小游戏说明、规则、操作提示、状态反馈、成绩和结局均无旁白。所有双语原文、台词 ID 及剧情触发点保持原样，每句音频与对应对话一起开始；立绘动作依照真实音频的 `playing`、`waiting`、`pause`、`ended` 生命周期变化。游戏对话由玩家推进，不将音频塞入固定长度的视觉窗口。

全部 201 个当前 MP3 已通过 `afinfo` 格式、44.1 kHz、有效时长以及独立 SHA-256、字节数、声音 ID 核验；全部 8 个旧 George 文件也再次核验。验证结果见 [逐文件记录](./eliza-narrator-verification.json)。运行时索引与公开音频清单均为 `generated: true`，配音系统 11 项单元测试通过。

生成流程由官方 CLI 串行执行，未重试任何付费请求。声音历史只返回 8 条 Sarah 记录，`has_more: false`；每句文本恰好匹配一次，单条历史积分变化合计 1,068，见 [历史核验](./eliza-narrator-history-verification.json)。即时账户快照的使用量由 37,726 变为 38,696（差值 970）；该快照与逐条记录存在差异，单独保留，不把可能延迟的额度读数当成最终计费额。

首次自动审批以“非公开台词未获外发授权”为由拒绝，未执行或计费。随后只读获取已经公开的游戏音频清单，确认全部 8 句台词和旧音频路径与线上版本完全一致；公开来源证据见 [发布核验](./eliza-narrator-public-source-check.json)。补充这一证据后审批通过，完成本批生成。

同时修复旧试听音频的缓存复用条件：除了台词相同，必须匹配原 `voiceId`，防止把旧 George 试听拷贝到女声的新哈希路径下。

数据链：现有双语剧情 → 8 句对话旁白筛选 → Sarah 声音映射 → 串行生成与历史核验 → MP3 格式／时长／哈希验证 → 每句剧情的语音播放与人物动作。
