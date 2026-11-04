# Seedance 2.5 方舟批量工具

仅使用 Python 标准库，建议 Python 3.9 或更新版本。默认读取上一级 `manifest.json`，路径字段相对 manifest 所在目录解析。工具没有内置密钥，也不会在校验或 dry-run 时读取 API Key。

工具刻意采用**顺序提交 → 查询 → 下载 → 下一条**，同时处理最多一条，低于个人账号公开并发上限 3。可靠性优先于吞吐。遇到失败、未知提交结果或轮询时间上限时停止批次，后续镜头尚未提交。

## 离线验证

在 `art-direction/cg-final-prep-v3` 目录运行：

```sh
python3 api/ark_batch.py validate
python3 -B -m unittest discover -s api -p 'test_ark_batch.py' -v
```

`validate` 检查 manifest 版本与字段、镜头 ID、时长、剪辑取用区间、UTF-8 提示词文件、PNG 头部与尺寸、文件大小和路径范围。PNG 检查属于文件头与规格检查，不代替解码器或视觉验收。它不联网，也不能判断人物图能否通过方舟输入审核、账号是否开通模型、实际配额或余额。

工具按本项目生产规格接受 720p 和 1080p；官方 2.5 也支持 480p，但本工具没有开放该选项。默认 `generate_audio=false`、`ratio=adaptive`、`output_format=mp4`，不包含 `camera_fixed`、`seed`、`draft` 或 `flex`。支持情况见[官方核实记录](../ark-official-verification.md)。

## 预览与执行

```sh
python3 api/ark_batch.py submit --ids S05
python3 api/ark_batch.py submit --ids all --resolution 1080p --run runs/production-1080p.json
```

以上命令仅打印镜头 ID、规格与请求指纹，不上传图片、不发请求、不创建 run 文件。不会打印完整提示词或 Base64 图片。

API Key 必须由使用者在运行环境中设置为 `ARK_API_KEY`。不要把它写进脚本、manifest、命令行参数、共享日志或聊天。模型默认 `doubao-seedance-2-5-260628`；如需使用已开通的推理接入点，可用环境变量 `ARK_MODEL_ID` 指定实际 Endpoint ID。工具不提供自定义 API Base URL，始终使用官方北京方舟地址。

明确执行普通付费生成时，添加 `--execute`：

```sh
python3 api/ark_batch.py submit --ids S05 --run runs/test-S05-720p.json --execute
python3 api/ark_batch.py submit --ids all --resolution 1080p --run runs/production-1080p.json --execute
```

`--ids` 支持 `all`、空格分隔的多个 ID 或逗号分隔的 ID。按 manifest 镜头顺序处理。首轮应先在控制台确认素材接收和单条动作，再执行 API 批次；不要把新建 run 文件当成无成本操作。

如 manifest 不在默认位置：

```sh
python3 api/ark_batch.py --manifest /absolute/path/manifest.json validate
python3 api/ark_batch.py --manifest /absolute/path/manifest.json submit --ids S05 --execute
```

`--manifest` 放在子命令之前。没有显式 `--run` 时，运行记录位于 manifest 目录下的 `runs/ark-run.json`。

## 持久化与恢复

每个 POST 之前先原子写入 `intent`、镜头 ID、参数摘要、请求 SHA-256 和时间。POST 返回可用任务 ID 后立即保存，再进行轮询和下载。run 文件不保存密钥、完整图片或完整提示词；会保存任务 ID 和成功时的短期视频 URL，应保留在本地。

同一 run 文件中已有记录的镜头不会再次 POST：

- 已完成且下载文件校验一致：跳过。
- 已提交或运行中：用原任务 ID 恢复查询。
- `intent` 或 `unknown`：停止，先到控制台核对任务是否已经创建。
- `failed`、`cancelled`、`expired`：停止，不自动重新付费生成。
- 同一镜头的提示词、图片、时长、分辨率或模型改变导致指纹不一致：停止，要求明确选择新的 run。

恢复查询前可先做本地预览：

```sh
python3 api/ark_batch.py watch --run runs/test-S05-720p.json
python3 api/ark_batch.py watch --run runs/test-S05-720p.json --execute
```

`watch --execute` 只查询已有任务和下载已有结果，不创建新任务。查询间隔默认 10 秒，最低 10 秒。默认最多 360 轮；达到上限保留记录并退出，不会取消远程任务：

```sh
python3 api/ark_batch.py watch --run runs/production-1080p.json --interval 15 --max-polls 240 --execute
```

显式 HTTP 429 最多重试 3 次，等待 2、4、8 秒。POST 超时、连接异常、5xx、408、不可解析响应或缺失任务 ID 都记为 `unknown`，绝不自动重提。POST 其他明确 4xx 拒绝记为创建失败。查询失败保留已有任务 ID，之后恢复 watch 即可。

创建或查询遇到 API 错误时，仅提取 `error.code`，通过检查后保存为 run 中的 `error_code`，并在提示中指出可查询此代码。查询返回的任务失败代码同样保留。例如 `InvalidParameter.Content` 可用于查官方错误说明，再区分输入审核、模型权限或余额问题；工具不会只凭 HTTP 400 自动判断具体原因。代码须为 1–128 个 ASCII 字符、以字母开头，其余仅允许字母、数字、点、下划线和连字符；包含当前 API Key 的值也会丢弃。HTTP 错误正文最多读取 64 KiB 进行解析，超限、格式错误或无有效代码时保留原有通用错误行为。不会输出或保存 API 的 `message`、原始正文、响应头或密钥。

`intent` 的存在只能证明提交意图已落盘，不能证明远程任务是否创建。进程若恰在收到 ID 前后崩溃，可能留下没有 ID 的 `intent`；工具按未知结果处理。应核对方舟控制台后再决定是否创建新的 run，不能通过删除旧记录跳过审查。

工具用 `<run>.lock` 阻止多个进程操作同一运行记录。异常强制终止可能留下锁文件；先确认没有同一批次进程仍在运行，再检查 run 和控制台状态，最后手动删除该锁文件。不要删除仍有活跃进程持有的锁。

## 下载和状态

成功视频立即下载到 run 文件同级的 `videos/<shot>-<task-id>.mp4`。下载使用单独请求，不向视频 CDN 发送 Ark API Key；先写临时文件，核对存在的 Content-Length 与 MP4 文件头后原子改名，并保存字节数与 SHA-256。重复 watch 会核对已有文件，避免重复下载。下载失败保留 `succeeded` 云状态，下一次 watch 重试下载同一结果。

`succeeded`、`failed`、`cancelled`、`expired` 均视为云端终态。`unknown` 和中断的 `intent` 不循环轮询。退出码 `0` 表示验证／dry-run 成功，或选中镜头全部成功并已下载；`2` 表示需处理错误、未知结果或未完成任务；用户中断返回 `130`。

官方 URL 仅短期有效，尽快下载；文件的画面、时长、帧率、实际声音、编码与可剪辑性仍需另行验收。这里没有自动剪辑、自动重生成、自动上传、自动开通模型或取消任务功能。官方 running 任务不支持取消，停止本地程序不代表远程生成停止。

## 本地测试范围

测试使用临时 manifest、临时 PNG 和模拟客户端，覆盖原生字段生成、dry-run 零请求、intent 先落盘、未知 POST 不重发、429 有限重试、任务 ID 及时保存、成功下载去重、全部终态退出、轮询间隔限制，以及错误代码过滤、持久化和不回显错误消息／密钥。测试不读取真实 API Key、不调用真实服务、不生成付费任务。
