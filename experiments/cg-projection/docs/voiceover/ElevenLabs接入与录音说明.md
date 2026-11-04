# Hamilton · ElevenLabs 接入与录音说明

更新日期：2026-09-10。已生成全部 10 个说话角色的英文台词，George 仅限剧情对话框内旁白。实际批量生成通过 ElevenLabs 官方 CLI 完成；已接入唯一三维主线自动播放，标题页与游戏设置支持持久化语音开关。

## 账号与连接状态

此前已在 ElevenLabs 网页个人资料核实 `httx.810@gmail.com`，工作区为 Fangjie’s Workspace。官方 CLI 正常 OAuth 登录后读到了相同六个克隆音色和 George 的真实 ID，记录在 `voice-map.json`。`Larence` 对应游戏 Laurens，沿用用户提供的音色合集。

Codex 已配置远程 MCP：`https://api.us.elevenlabs.io/v1/mcp`，原生 `codex mcp login elevenlabs` 成功，登录状态为 OAuth。但当前任务没有热加载 ElevenLabs MCP 工具，所以不能宣称本批音频由 MCP 工具生成。ElevenLabs 网页无需出现名为 MCP 的工作界面：MCP 是供 Codex 等客户端连接的接口，授权记录在「设置 → 已连接应用」。重新打开 Codex 后可再检查工具是否加载。

本次采用 [ElevenLabs 官方推荐给 Codex 的 CLI](https://elevenlabs.io/mcp) 承接生成。官方 `elevenlabs auth login` 已成功，认证由 CLI 和 macOS 钥匙串管理，批量脚本不读取或保存令牌。无需用户复制 API Key。

## 音色映射

| 游戏角色 | ElevenLabs 音色 | voice_id |
| --- | --- | --- |
| Hamilton | Hamilton by Lin | ZkIh9CGBiVNOeuNezDX9 |
| Burr | Burr from Hamilton | g4v6fhF5YaxHMMMGmqBa |
| Washington | Washington from Hamilton | C8sDvT2KOApAaKPGigC0 |
| Lafayette | Lafayette from Hamilton | ZcB091leTaOIbyDOaQr9 |
| Mulligan | muligen from hamilton | uIKWpbqY1EpzFTHusIp4 |
| Laurens | Larence | vXOqiB9d7xy2Q2wzZrO8 |
| 旁白 | George - Warm, Captivating Storyteller | JBFqnCBsd6RMkjVDRZzb |
| 报童 | Liam - Energetic, Social Media Creator | TX3LPaxmHKxFdv7VOQHJ |
| 市民 | Chris - Charming, Down-to-Earth | iP95p4xoKVk53GoZ742B |
| 保皇派 | Daniel - Steady Broadcaster | onwK4e9ZLuTAKqWW03F9 |

三个配角由用户授权按描述选择：Liam 年轻有活力，Chris 自然朴实，Daniel 成熟正式、具有英式播报的力度。2026-09-10 通过已登录的官方 CLI 查询账号可用音色描述，并生成 11 句、1359 英文字符；具体描述与匹配理由记录于 `voice-map.json`。开发漫游 Demo 的 22 条不纳入主线。

## 本批生成规则

采用 `eleven_multilingual_v2`，沿用 Hamilton 试听设置：speed 1、stability 0.5、similarity_boost 0.75、style 0、use_speaker_boost true；MP3 44.1 kHz / 128 kbps。

当前生效范围为 134 条固定台词映射、133 个 MP3，全部完成，无待生成项。包括六位主要角色、三个配角以及 6 句剧情旁白。先前生成的 249 个界面旁白 MP3 保留为历史素材，索引转存 `archived-ui-narration-manifest.json`，不再接入游戏。

George 仅限源码 `kind: dialogue` 且 `speaker: narrator` 的剧情台词。章节标题、选择问题、小游戏说明／规则／操作提示、成绩反馈、结局页面均不播旁白。生成脚本也执行此过滤，后续续跑不会重新生成这些内容。辩论论点／回应、军令片段和突击指令保留各自角色声音。

- `src/data/voiceover-catalog.json`：由生成脚本同步维护的运行时精简索引，仅含音频匹配所需字段，供三维播放器导入。
- `public/audio/en/manifest.json`：cue ID → 双语原稿、英文音频 URL、说话人和生成状态；仅包含当前可播放台词。
- `generation-en-status.json`：每个文件的状态、voice ID、请求签名、音频 SHA-256、字节数、时长和完成时间。
- `generation-en-plan.json`：最近一次检查时的完成数量、待生成数量、按角色数量。
- `dynamic-variants.json`：历史界面旁白参数审计，当前不参与生成和播放。

批量脚本并发为 2，文本、音色、模型、设置相同的文件复用。每个成功文件用 macOS `afinfo` 验证 MP3 格式与有效时长，并记录哈希。超时或失败标为 uncertain 并停止；没有自动重试付费请求。遇到 uncertain 时应先核对 ElevenLabs 历史，不能直接删除状态重跑。

## 后续更新与续跑

以下命令由开发代理执行。默认检查不发送生成请求，只有 `--generate` 会调用官方 CLI。

```sh
node --import tsx scripts/export-voiceover.ts
node --import tsx scripts/expand-voiceover-variants.ts
node scripts/generate-voiceover.mjs
node scripts/generate-voiceover.mjs --generate
```

如果官方 CLI 不在 PATH，可通过官方 npm 包执行 `npm exec --yes --package @elevenlabs/cli@1.2.0 -- node scripts/generate-voiceover.mjs --generate`；需要重新认证时运行 `npm exec --yes --package @elevenlabs/cli@1.2.0 -- elevenlabs auth login`。

脚本默认调用 PATH 中的 `elevenlabs`；可用 `HAMILTON_ELEVENLABS_CLI` 指定官方二进制路径。本次官方 `@elevenlabs/cli` 1.2.0 安装在临时 npm 缓存中；缓存清除后可重新通过官方 npm 包运行，凭据仍由官方客户端处理。台词更新后必须先重新导出台本与动态变量，检查新增数量，再执行生成。

## 已整理的台本

- `全流程台本.md`：按剧情流程排列，每条含唯一 ID、说话人、中英文、触发条件和源代码位置。
- `manifest.json`：机器可读清单，便于后续生成队列、音频命名和游戏映射。
- `voice-map.example.json`：10 个角色的中文／英文 `voice_id` 映射模板；null 表示尚未选择，不能当作默认声音。
- `all-bilingual-source.json`：src 中 600 处静态 `bi()` 原文的审计库存，包括按钮、HUD、教程、提示和开发页面。不是待批量录音队列。
- `scripts/export-voiceover.ts`：从源代码重新导出的脚本，由开发代理运行 `node --import tsx scripts/export-voiceover.ts`。

清单保留游戏现有原文。主线 220 条候选，加开发漫游附录 22 条，共 242 条双语条目；其中 6 条是带参数模板，不能直接提交 TTS。这是所有分支的制作清单，不是单次游玩台词数量。

| 类型 | 双语条目数 | 制作处理 |
| --- | ---: | --- |
| 剧情对话（含全部替换分支、回复及超时） | 59 | 按源码角色录音 |
| 辩论论点与回应 | 30 | 保皇派 6 句；Hamilton 24 种回应 |
| 幕间标题／副标题 | 12 | 仅字幕，禁止旁白 |
| 主线问题 | 6 | 仅字幕，禁止旁白 |
| 主线玩家选项 | 18 | 若录音，建议只在选中后朗读 |
| 辩论策略提示 | 6 | 仅字幕，禁止旁白 |
| 玩法提示、反馈与战术态势 | 36 | 仅文字，禁止旁白；含 2 条历史模板 |
| 军令碎片 | 15 | 纸面文字；建议由 Hamilton 朗读，校对稿复用 |
| 突击指令 | 12 | 建议 Hamilton；“推进”重复一条可按表演需要复用 |
| 个人侧写／结局／尾声 | 26 | 仅文字，禁止旁白；含 4 条历史模板 |
| 开发漫游：环境／伯尔／选项 | 22 | 独立附录，主线不调用 |
| 合计 | 242 | 双语库存；本次只生成英文角色台词 |

核心录音范围是前两项，共 89 条；双语各一版为 178 段音频。核心中文 2,525 个字符，英文 8,542 个字符，计数含空格和标点，只用于规模估算；不能直接换算成实际积分或价格。

## 10 个声音角色

| 角色 ID | 角色 | 核心台词数 |
| --- | --- | ---: |
| hamilton | 亚历山大·汉密尔顿 | 40 |
| burr | 阿伦·伯尔 | 6 |
| washington | 乔治·华盛顿 | 10 |
| laurens | 约翰·劳伦斯 | 6 |
| lafayette | 拉法耶特 | 5 |
| mulligan | 赫拉克勒斯·穆利根 | 5 |
| loyalist | 保皇派撰稿人 | 8 |
| newsboy | 报童 | 1 |
| citizen | 纽约市民 | 2 |
| narrator | 旁白 | 6 |

这些是 10 个说话角色，不代表必须创建 10 个新音色。会优先匹配账号已有克隆声音；配角是否共用声音可在匹配时决定。界面提示和结局不配音；军令使用 Hamilton 音色。

## 分支与播放注意事项

- 纽约初见伯尔、酒馆三人、华盛顿职位、约克镇首次指令，共六组主线选择、18 个选项；每个回复均已收录。
- 酒馆超时的原文相同，但分别由 Laurens、Lafayette、Mulligan 说出，需要三个声音版本。
- 华盛顿提议：`influence >= 30` 时整段替换。约克镇授予指挥权：`washingtonTrust >= 18` 时整段替换。默认段与替换段都要录。
- 辩论最多六轮，胜利可提前结束；每轮四种回应只播放选中的一种，反馈页再次显示同句时不应重复播放。
- 结局包含四种标题，以及选择、信任、尊重、竞争和成绩分支。仅显示玩家实际分支，不使用旁白。
- 六条 `{0}` 模板涉及校对数量、哨岗编号和成绩。已用实际游戏系统枚举为 169 条完整英文句子；对应值、模板 ID 和双语文本见 `dynamic-variants.json`；这些历史界面素材现已退出生成与播放。
- 双语字幕不意味着同时播两种语言。语音语言应有明确选择，中文字幕和英文字幕仍同步显示；本次用户已选择先生成英文。
- 三维游戏接入已处理继续／跳过、暂停、重开和旧音频停止。酒馆问题不再朗读；辩论论点在玩家点准备之前播放，回应在踩拍后播放。军令和突击指令沿用已有朗读计时保护。幕间保持现有 550 ms 渐入／渐出和 2875 ms 标题等待，不播放语音。


数据链：游戏源代码 → 双语台本与分支 ID → 已匹配 voice_id → 角色台词／对话框旁白范围过滤 → 英文固定文本 → 官方 CLI 生成与校验 → 静态音频映射 → 三维游戏生命周期内自动播放。
