# 方舟视频后端：审阅后待命

这套后端已经实现本方案的离线检查、请求锁定、逐条提交、查询、下载和断点恢复。当前交付阶段只运行离线检查及只读连接检查；没有提交视频任务。真实生成仍以用户后续明确指令为准。

你不需要自己运行代码或重新填写 Key。收到“按这版生成全部视频”后，由代理执行下面的生产命令，并持续查询、下载和检查结果。

## 固定输入与生成规格

- 唯一输入方案为上级目录的 `manifest.json`。镜头顺序、模型、画质、时长、首帧与提示词均来自这份方案。
- 首帧读取 `firstframes/` 中的原始 PNG 字节，经 Base64 传入 `image_url`、`role: first_frame`；不截图、不重编码、不剥除来源信息。
- 提示词读取 `prompts/`，请求使用 `generate_audio: false`、`ratio: adaptive`、`output_format: mp4`。
- 没有命令行模型覆盖、画质覆盖或临时选取镜头的开关。修改素材或参数后必须重新准备可审阅版本，不能沿用旧批准散列。
- 本地密钥只从项目根目录 `.env.ark.local` 中读取 `ARK_API_KEY`。密钥不进入命令行、审阅文件、请求摘要或日志。

## 本轮准备命令

以下命令均由代理执行。示例工作目录为 `art-direction/cg-video-production-v6/`。

```sh
python3 api/ark_batch.py validate
python3 api/ark_batch.py prepare
python3 api/ark_batch.py run
```

`validate` 检查方案、PNG 头、素材与提示词 SHA-256、镜头时间范围。`prepare` 写出 `review-lock.json` 和 `review-summary.json`，其中只有文件位置、参数和散列，不含 Base64 图片。`run` 不带 `--execute` 时仅展示提交摘要，不读取密钥、不联网、不创建生产账本。

`review-lock.json` 的 `plan_sha256` 绑定完整 manifest 字节、所有首帧与提示词散列、每条实际 API 请求散列及后端请求契约版本。任何改动都会使旧批准失效。

在尚未生成过视频时，如方案经过再次审阅，可由代理运行 `prepare --replace-review` 更新锁。只要已经存在生产账本，该版本就禁止覆盖审阅锁，后续修改应保存为另一份版本。

只读连接检查：

```sh
python3 api/ark_batch.py preflight --execute
```

这一步仅访问官方 `GET /api/v3/models`，保存 `reports/preflight.json`。结果区分“连接成功”“模型出现在返回列表”“模型权限未知”；不会把列表查询成功表述为视频生成已实测，也不证明具体首帧能通过审核。

## 用户下令后实际生成

代理读取本次已审阅 `review-lock.json` 中的完整 `plan_sha256`，填入下列命令。这个值不是 `manifest.json` 文件本身的散列。

```sh
python3 api/ark_batch.py run --execute --approved-plan-sha256 <本次审阅的完整64位plan_sha256>
```

全局路径选项必须放在子命令之前。例如从任意工作目录运行：

```sh
python3 '/Users/fangjie/Documents/Codex 项目/Hamilton/art-direction/cg-video-production-v6/api/ark_batch.py' run --execute --approved-plan-sha256 <本次审阅的完整64位plan_sha256>
```

执行时按 manifest 顺序使用并发 1：先完成并下载当前镜头，再提交下一个镜头。每次新的付费请求前都会再次检查整份方案及素材散列。若方案包含 `pricing.review_before`，到达该时间后会停止创建任务，先重新核对报价；已生成结果仍可使用 `watch` 下载。

## 账本、恢复与失败

生产账本固定保存为 `runs/<plan_sha256前16位>/run.json`。原片在同目录 `videos/` 下。签名下载地址只存在私有账本内，不输出到终端或审阅文件；账本还保留任务 ID、状态、数值 usage、结果规格以及下载大小和 SHA-256，供费用和素材核对。

恢复整批生成时，仍运行相同的 `run --execute --approved-plan-sha256 …` 命令：已经下载并通过大小与散列检查的镜头会跳过；已提交镜头继续查询；未提交镜头按顺序继续生成。没有新的运行目录参数，因此同一批准版本不会因为换目录而重复提交。

只查询和下载既有任务、暂不继续后续镜头：

```sh
python3 api/ark_batch.py watch --execute
```

- 每个 POST 前先把 `intent` 落盘；收到任务 ID 后立即再次落盘。
- 所有 POST 都只尝试一次，包括 HTTP 429。网络超时、5xx、缺少任务 ID 等结果记为 `unknown`；发现任何 `intent/unknown` 时停止整批，不自动重发。由代理对照方舟任务记录核实后处理。
- 服务端明确失败、取消或过期时停止后续提交，保留当前任务与错误代码。不会自动追加付费重试，也不会悄悄更改提示词或首帧。
- GET 查询可对暂时错误有限重试；默认每 10 秒轮询，最多 360 次，达到次数后保留任务并退出，之后可恢复。
- 下载独立使用无 Authorization 的请求，先写临时文件，再检查 Content-Length（存在时）、MP4 文件头、大小与 SHA-256，最后原子移动到成片目录。
- 成功但尚未下载的任务先重新查询，获取当前下载地址；下载失败还允许再次查询并重试一次下载。重启后的本地文件损坏也会重新下载既有结果，不创建新视频任务。
- 若进程异常退出留下 `.lock`，由代理先确认旧进程已结束，再移除失效锁。不要删除生产账本来“重新开始”。

## 验证范围

离线测试只使用临时假 Key、假 PNG 和模拟 API 响应，不接触真实凭据或网络。覆盖环境镜头、首帧原始字节、无声音轨参数、散列变更拦截、批准与报价期限、未知提交禁止重复、顺序恢复、错误信息脱敏、GET-only 预检、下载过期刷新与损坏重取等。

```sh
python3 -m unittest discover -s api -p 'test_*.py' -v
```

后端测试与只读连接检查能够确认请求构造和恢复机制；具体图像审核、视频动作、画面一致性与成片质量，仍需在用户授权后的生成结果中确认。

交付包排除 `.env.ark.local`、`runs/`、临时锁与缓存。数据链条为：审阅方案及素材 → 固定请求散列 → 用户明确生成指令 → 持久化任务账本 → 顺序生成和下载 → 原片检查及剪辑。
