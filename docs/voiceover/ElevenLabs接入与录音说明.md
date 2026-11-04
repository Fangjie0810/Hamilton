# Hamilton · ElevenLabs 接入与录音说明

更新日期：2026-09-14。当前共 202 条 cue、201 个唯一 MP3，待生成 0。按用户要求，8 句剧情旁白已从 George 全部替换为 Sarah 温暖、成熟的女性声音，配合 Eliza 伏案记录往事的形象；见 [Eliza 旁白交付](./2026-09-14-eliza-narrator-delivery.md)。其他角色的 193 个 MP3 均与此前逐文件哈希一致。批量生成通过官方 CLI 完成；仅在唯一三维主线的剧情对话内播放，标题页与游戏设置支持持久化语音开关。

## 账号与连接状态

此前已在 ElevenLabs 网页个人资料核实 `httx.810@gmail.com`，工作区为 Fangjie’s Workspace。官方 CLI 正常 OAuth 登录后读到了相同六个克隆音色和 George 的真实 ID，记录在 `voice-map.json`。`Larence` 对应游戏 Laurens，沿用用户提供的音色合集。

Codex 已配置远程 MCP：`https://api.us.elevenlabs.io/v1/mcp`，登录状态为 OAuth。2026-09-14 已实际调用 `creative_list_voices` 核实 Sarah 音色，批量音频仍由官方 CLI 生成。此前 2026-09-13 的任务未热加载 MCP 工具，其生成记录保留在当日交付文档中。ElevenLabs 网页无需出现名为 MCP 的工作界面：MCP 是供 Codex 等客户端连接的接口，授权记录在「设置 → 已连接应用」。

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
| Eliza 形象旁白 | Sarah - Mature, Reassuring, Confident | EXAVITQu4vr4xnSDxMaL |
| 报童 | VALF - Child, Young, Playful & Sarcastic | loY1uopAz31XyhAEhNSa |
| 市民 | Chris - Charming, Down-to-Earth | iP95p4xoKVk53GoZ742B |
| 保皇派 | Daniel - Steady Broadcaster | onwK4e9ZLuTAKqWW03F9 |

2026-09-13 按用户要求，将报童从成年 Liam 替换为连接器目录标题明确标为 Child 的 VALF。其描述明确适用于儿童角色与调皮男孩，语言为美式英语。连接器查询原名为 `VALF - Child, Young, Playful & Sarcastic`；官方 CLI 共享库同一 voice ID 的当前名称为 `Valf - Young, Playful & Sarcastic`。账号收藏沿用连接器查询时的原名，两种目录返回的证据记录于 `newsboy-child-voice-selection.json`。旧 Liam MP3 保留，原映射归档于 `archived-newsboy-liam-manifest.json`。

2026-09-13 的报童替换批次用官方 CLI 生成原报童台词和 8 句固定闲聊，共 9 个 MP3、716 英文字符。当时 George 仅有 6 句剧情旁白；当日成长更新扩充至 8 句，2026-09-14 全部改为 Sarah。所有闲聊均由角色本人朗读，Chris 自然朴实，Daniel 成熟正式，六位主要角色继续沿用原音色。具体描述与匹配理由记录于 `voice-map.json`。开发漫游 Demo 的 22 条不纳入主线。

## 本批生成规则

采用 `eleven_multilingual_v2`，沿用 Hamilton 试听设置：speed 1、stability 0.5、similarity_boost 0.75、style 0、use_speaker_boost true；MP3 44.1 kHz / 128 kbps。

当前生效范围为 202 条固定台词映射、201 个 MP3，全部完成，无待生成项。包括六位主要角色、三个配角以及 8 句剧情旁白。2026-09-13 新增 60 个 MP3；2026-09-14 将其中所有 8 句剧情旁白替换为 Sarah，其余声音、模型与设置保持一致。George 的 8 句原剧情音频保留于 `archived-narrator-george-manifest.json` 对应哈希路径。先前生成的 249 个界面旁白 MP3 保留为历史素材，索引转存 `archived-ui-narration-manifest.json`，不再接入游戏。

Eliza 形象的女性旁白仅限源码 `kind: dialogue` 且 `speaker: narrator` 的剧情台词。章节标题、选择问题、小游戏说明／规则／操作提示、成绩反馈、结局页面均不播旁白。生成脚本也执行此过滤，后续续跑不会重新生成这些内容。辩论论点／回应、军令片段和突击指令保留各自角色声音。

- `src/data/voiceover-catalog.json`：由生成脚本同步维护的运行时精简索引，仅含音频匹配所需字段，供三维播放器导入。
- `public/audio/en/manifest.json`：cue ID → 双语原稿、英文音频 URL、说话人和生成状态；仅包含当前可播放台词。
- `generation-en-status.json`：每个文件的状态、voice ID、请求签名、音频 SHA-256、字节数、时长和完成时间。
- `generation-en-plan.json`：最近一次检查时的完成数量、待生成数量、按角色数量。
- `dynamic-variants.json`：历史界面旁白参数审计，当前不参与生成和播放。

批量脚本现已改为串行调用官方 CLI，避免共享 OAuth 凭据同时刷新；文本、音色、模型、设置相同的文件复用。每个成功文件用 macOS `afinfo` 验证 MP3 格式与有效时长，并记录哈希。超时或失败标为 uncertain 并停止；没有自动重试付费请求。遇到 uncertain 时应先核对 ElevenLabs 历史，不能直接删除状态重跑。CLI 的结构化 stdout 错误会被捕获并脱敏；生成结束会同步最终剩余统计。

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

## 原版本台本整理记录（本次新增清单见交付记录）

- `全流程台本.md`：按剧情流程排列，每条含唯一 ID、说话人、中英文、触发条件和源代码位置。
- `manifest.json`：机器可读清单，便于后续生成队列、音频命名和游戏映射。
- `voice-map.example.json`：10 个角色的中文／英文 `voice_id` 映射模板；null 表示尚未选择，不能当作默认声音。
- `all-bilingual-source.json`：src 中 626 处静态 `bi()` 原文的审计库存，包括按钮、HUD、教程、提示和开发页面。不是待批量录音队列。
- `scripts/export-voiceover.ts`：从源代码重新导出的脚本，由开发代理运行 `node --import tsx scripts/export-voiceover.ts`。

清单保留游戏现有原文。主线及固定闲聊 228 条候选，加开发漫游附录 22 条，共 250 条双语条目；其中 6 条是带参数模板，不能直接提交 TTS。这是所有分支的制作清单，不是单次游玩台词数量。

| 类型 | 双语条目数 | 制作处理 |
| --- | ---: | --- |
| 剧情对话（含全部替换分支、回复、超时及固定闲聊） | 67 | 按源码角色录音 |
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
| 合计 | 250 | 双语库存；本次只生成英文角色台词 |

核心录音范围是前两项，共 97 条；双语各一版为 194 段音频。核心中文 2,665 个字符，英文 9,068 个字符，计数含空格和标点，只用于规模估算；不能直接换算成实际积分或价格。

## 10 个声音角色

| 角色 ID | 角色 | 核心台词数 |
| --- | --- | ---: |
| hamilton | 亚历山大·汉密尔顿 | 40 |
| burr | 阿伦·伯尔 | 7 |
| washington | 乔治·华盛顿 | 11 |
| laurens | 约翰·劳伦斯 | 7 |
| lafayette | 拉法耶特 | 6 |
| mulligan | 赫拉克勒斯·穆利根 | 6 |
| loyalist | 保皇派撰稿人 | 9 |
| newsboy | 报童 | 2 |
| citizen | 纽约市民 | 3 |
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
