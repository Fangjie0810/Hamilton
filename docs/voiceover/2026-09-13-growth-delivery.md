# 成长与地图探索更新 · 英文配音交付

完成并验证于：2026-09-13 21:31（北京时间）。

本次新增 **60 段英文音频、4,844 个字符**，全部完成；原有 141 个 MP3 复用。当前三维主线索引共 **202 条 cue、201 个唯一 MP3，待生成 0**。新增音频合计 255.791 秒、4,120,348 字节；当前可播放素材合计 887.824 秒、14,314,134 字节。以上包含所有可选分支与复看台词，不能视为一次游玩的时长。

## 声音与范围

沿用 `eleven_multilingual_v2`、stability 0.5、similarity_boost 0.75、style 0、speed 1、use_speaker_boost true；MP3 44.1 kHz / 128 kbps。

| 角色 | 本次新增 | 当前唯一音频 |
| --- | ---: | ---: |
| Hamilton | 34 | 118 |
| Burr | 10 | 17 |
| Washington | 6 | 17 |
| George 剧情旁白 | 2 | 8 |
| 报童 VALF | 2 | 4 |
| 市民 Chris | 6 | 9 |
| 其他四位原声音角色 | 0 | 28 |
| 合计 | 60 | 201 |

六位主要角色继续使用已有克隆声音，报童使用 VALF 儿童角色音色。George 的 8 条映射全部为实际剧情 `dialogue`；属性教程、奖励提示、小游戏规则、成绩及结局均不生成旁白。

## 未确认请求的处理

`hamilton-71c6538f59d21e2613d2.mp3`（`discovery-letter-name-base-2`）的首次 CLI 请求在 `2026-09-13T13:08:36.055Z` 开始，随后以状态 2 退出。当时脚本未捕获 stdout，因此首先保留 uncertain，未盲目重复生成。

排查发现官方 CLI OAuth 凭据缺失。恢复默认 OAuth 范围最初被自动审批拒绝；用户随后明确允许恢复官方 CLI 登录及其默认范围，并限定用于此次配音与历史核对。已通过官方网页和 localhost 回调完成登录，凭据仍只由官方 CLI 与 macOS 钥匙串管理，没有读取或输出令牌。

恢复后读取 Hamilton **全部 84 条官方历史，`has_more: false`**；精确文本匹配为 0，最新记录也早于本次请求。核对证据、原 uncertain 记录、查询结果哈希保存于 [growth-uncertain-resolution.json](./growth-uncertain-resolution.json)。因此无需下载复用历史音频，该条在确认后与其他 58 条一起串行生成一次，均成功。没有通过 MCP 重发或更换生成参数。

## 脚本可靠性与验证

`scripts/generate-voiceover.mjs` 已改为：

1. 捕获官方 CLI 在 stdout 返回的结构化错误，记录 code／reason／message；不保存请求正文或原始调试输出，并对凭据形态内容脱敏。
2. 顺序调用 CLI，防止两个进程同时刷新共享 OAuth 凭据。此前的并发刷新是否造成凭据丢失尚未证实。
3. 生成结束后同步实际剩余计划。
4. 保留 uncertain 强制停止，必须先核对历史，不能自动重试付费请求。

已通过 `node --check` 及无网络 mock 的 5 项验证：结构化错误捕获、凭据形态脱敏、首错停批、未确认请求阻止重复调用、余量统计准确。

生成后重新检查 **全部 201 个当前 MP3**：`afinfo` 格式／44.1 kHz／有效时长验证通过；独立核对每个文件 SHA-256、字节数及 voice ID 与声音映射一致；全部 202 条运行时 cue 均为 `generated: true`。验证明细见 [growth-voiceover-verification.json](./growth-voiceover-verification.json)。

`public/audio/en/manifest.json`、`src/data/voiceover-catalog.json`、`generation-en-status.json`、`generation-en-plan.json` 已同步。历史界面旁白仍只归档，不计入当前 201 个可播放素材，也不恢复播放。

数据链：双语源台词 → 角色与范围过滤 → 原声音／模型／参数签名 → 官方历史去重确认 → 串行英文生成 → 格式／时长／哈希验证 → 202 条 cue 映射至 201 个静态 MP3。
