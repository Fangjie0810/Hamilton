# v7：两条多镜头源视频后端

本版本独立于 v6，保留 v6 文件不变。它读取本目录上级的 `manifest.json`（version 7），按 `jobs` 的顺序生成两条源视频：A01 为 30 秒人物线，B01 为 20 秒环境线。后续剪辑再按 `edit_timeline` 交叉使用两条源视频中的片段。

当前阶段只准备和检查，不提交付费视频。用户确认本版并明确下令后，由代理运行生成、查询、下载和剪辑流程；用户无需自己操作终端或重新填写密钥。

## 请求与参考图

当前方案使用 `doubao-seedance-2-5-260628`，720p，16:9，MP4，`generate_audio: false`，`omni_reference_task_type: reference`。画质等规格来自已审阅 manifest，命令行不提供临时覆盖。

每条请求的 `content` 依次为：

1. `prompts/A01.txt` 或 `prompts/B01.txt` 的完整文字。
2. 按 `image_index` 从小到大排列的参考图，均使用 `type: image_url`、`role: reference_image`。

A01 使用 7 张人物或场景参考图（第 2 张为已补制的 N02 无人空房间），B01 使用 6 张环境参考图。提示词中的 `@图片1` 对应请求内第 1 张图片，以此类推；编号分别在每条请求内从 1 开始。这是多参考图请求，不混入 `first_frame` 或首尾帧参数。参考 ID 接受大写字母加两位数字（例如 S01、E01、N02）；本版 13 张均为目标场景参考，N02 的 `scope: empty_room_scene` 与额外说明也由完整 manifest 散列绑定。

所有图像均读取 `references/` 中的原始 PNG 字节，再进行 Base64 编码，不重编码图像、不截图、不剥除来源信息。每条请求最多 30 张图，实际 UTF-8 JSON 请求体（包括 Base64 膨胀和提示词）不得超过 64 MiB；超限会停止，不自动压缩或替换参考图。

后端检查每条源视频的 `segments` 从 0 开始连续覆盖所请求的全部时长，不得重叠、留空或越界；每段的 `reference_index` 和 `id` 必须与该请求中的参考图一致。它也检查提示词中出现的 `@图片N` 编号是否存在。

这些检查保证提交数据与方案一致。模型是否严格按秒切镜、参考图能否通过审核以及生成画面的实际效果，仍须在用户授权后的生成结果中检查。

## 离线准备

以下命令由代理在 `art-direction/cg-video-production-v7-two-clips/` 内执行：

```sh
python3 api/ark_batch.py validate
python3 api/ark_batch.py prepare
python3 api/ark_batch.py run
```

`validate` 检查文件、散列、参考图映射、源视频分段和实际请求体大小。`prepare` 创建 `review-lock.json` 与 `review-summary.json`。`run` 未带 `--execute` 时只显示摘要，不读取密钥、不联网、不创建生产账本。

`review-lock.json` 中的 `plan_sha256` 绑定以下内容：

- 完整 manifest 字节，包括后续交叉剪辑的 `edit_timeline`；
- 两条提示词文件的 SHA-256；
- 每张原始 PNG 的 SHA-256、编号及身份映射；
- 模型、画质、音频、参考模式、时长等规格；
- 每条完整 API 请求的 SHA-256 和实际编码字节数。

摘要的列表字段为 `jobs`，每条包含 `reference_count`、`references`、`segments`、`encoded_request_bytes` 和 `payload_sha256`，不会保存 Base64 图片或密钥。

未发生任何生成时，重新审阅后的方案可使用 `prepare --replace-review` 更新锁；已经存在生产账本的版本禁止覆盖，后续变更须保留为新版本。

## 只读后端连接检查

```sh
python3 api/ark_batch.py preflight --execute
```

这一步只请求官方 `GET /api/v3/models`，报告写入 `reports/preflight.json`。它不会创建视频任务或提升“已获生成授权”的状态。报告区分连接成功、模型出现在返回列表和模型权限未知；列表查询不证明具体多参考图请求可以生成或通过审核。

密钥只从项目根目录 `.env.ark.local` 的 `ARK_API_KEY` 读取，不进入命令行、审阅文件、请求摘要或日志。需要显式指定其他配置位置时，全局 `--key-file` 应放在子命令之前；不接受在命令中直接传入密钥值。

## 用户下令后的生产命令

代理确认用户审阅的是当前版本，读取 `review-lock.json` 的完整 `plan_sha256` 后运行：

```sh
python3 api/ark_batch.py run --execute --approved-plan-sha256 <当前已审阅plan_sha256>
```

完整绝对路径形式为：

```sh
python3 '/Users/fangjie/Documents/Codex 项目/Hamilton/art-direction/cg-video-production-v7-two-clips/api/ark_batch.py' run --execute --approved-plan-sha256 <当前已审阅plan_sha256>
```

尖括号内容是说明用占位，代理会替换为已审阅的真实散列。`plan_sha256` 不是 manifest 文件自身的散列。

运行顺序固定为先完成并下载 A01，再提交 B01，使用并发 1。每个新付费请求前重新验证全部文件、审批散列及请求体大小。若 manifest 设置了 `pricing.review_before`，报价复核期限到达后暂停创建任务，先核对新价格；已生成任务仍可查询和下载。

## 恢复、下载与费用账本

固定账本路径为 `runs/<plan_sha256前16位>/run.json`，账本列表字段为 `jobs`；源视频保存于同级 `videos/`。签名下载地址仅保存在私有账本中，不显示到终端或审阅资料。账本保留任务 ID、状态、数值 usage、结果规格、文件大小和 SHA-256，供费用与原片核对。

恢复整批生产时运行同一条带批准散列的 `run` 命令。已成功下载且散列正确的源视频会跳过；已提交任务继续查询；尚未提交的任务按顺序继续。只查看和下载既有任务、不继续提交下一条时使用：

```sh
python3 api/ark_batch.py watch --execute
```

保护和恢复行为如下：

- POST 前先把 `intent` 写入磁盘，拿到任务 ID 后立即保存。
- 每个 POST 只尝试一次，包括 429。超时、5xx 或缺失任务 ID 记为 `unknown`，整批停止；发现任何未解决的 `intent/unknown` 都不会继续调用或重新提交，由代理核对方舟任务记录。
- 明确失败、取消或过期时停止后续付费任务，保留错误代码，不自动修改提示词、替换图片或另付费重做。
- 只读 GET 可以对暂时错误有限重试；默认间隔 10 秒、最多 360 次，达到上限后保存状态退出，之后可以恢复。
- 下载使用独立请求，不携带 Ark Authorization。先写临时文件，检查长度（响应提供时）、MP4 文件头、大小与 SHA-256 后再原子保存。
- 下载地址过期或本地原片损坏时，通过原任务 ID 获取地址并重新下载，不创建新任务。单次下载失败后还允许刷新地址并重试一次下载。
- 异常退出遗留的 `.lock` 由代理先确认进程已结束再清理；不要删除账本来重新生产。

## 离线验证

```sh
python3 -m unittest discover -s api -p 'test_*.py' -v
```

测试使用临时假密钥、假 PNG 与模拟 HTTP 响应，不接触实际 Key 或网络。覆盖多参考图排序与原始字节、30 张与 64 MiB 上限、源片分段完整性、提示词编号映射、审批变更拦截、无音轨请求、断点恢复、未知提交不重复、错误脱敏、只读预检以及下载恢复。

交付包应排除 `.env.ark.local`、`runs/`、临时锁和缓存。数据链条为：审阅两条源片方案及 13 张参考图 → 固定请求散列 → 用户下令 → 两个生成任务及持久账本 → 原片下载检查 → 按交叉剪辑表组成 CG。
