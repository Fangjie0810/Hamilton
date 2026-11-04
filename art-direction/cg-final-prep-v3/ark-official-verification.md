# 火山方舟 Seedance 2.5 官方核实记录

核实日期：2026-09-09。范围：火山方舟原生 API 与官方文档，未提交视频任务、未读取账号密钥或实际配额。本记录没有采用第三方代理、开发者社区文章、ChatCut 封装或 Seedance 2.0 参数作为 2.5 的依据。

文档网页正文由前端动态加载。本次从火山引擎文档中心公开正文接口读取对应 DocumentID，未使用登录态。以下链接均指向官方阅读页面；创建、查询、取消页面正文更新时间为 2026-09-09，2.5 教程为 2026-09-09，人像教程为 2026-09-08。

## 1. 人物图片的实际接入边界

官方[便利创作含肖像视频](https://ark.volcengine.com/region:cn-beijing/docs/82379/2608626?lang=zh)说明，Seedance 2.5 不支持直接上传含真人人脸的参考图或视频，并提供受信任模型产物、预置虚拟人像和已授权真人素材三种路径。

受信任产物说明中的原文短引：

> 仅信任方舟平台的产物，不支持跨平台使用。

完整规则的含义如下：

- 受信任豁免针对同一方舟账号近 30 天内生成的原始产物。
- 列明的产物包括 Seedream 5.0 lite/pro **文生图**所得含人脸图片，以及 Seedance 2.5、2.0 系列生成的含人脸视频和对应尾帧。
- 跨平台、跨账号、超出有效期或经过二次剪辑的产物不在该豁免范围；压缩和转发也可能使信任失效。官方建议将原始产物直接转存到 TOS。
- 豁免处理的是输入人脸审核，输出仍可能被审核拒绝；不含人脸的素材不受上述人脸信任条件限制。[官方人像教程](https://ark.volcengine.com/region:cn-beijing/docs/82379/2608626?lang=zh#trust-model-output)

**尚未核实的边界：**以上公开页面没有明确定义“外部 AI 生成的写实虚构人脸”是否一律被归入“真人人脸”，也没有承诺其可直接上传。因此，不能把现有 image_gen 参考图一概判定为禁止，也不能保证它们能通过方舟输入审核。可以确定的是，它们不享受“本方舟账号原始模型产物”的受信任豁免。

本项目宜先在控制台测试现有单幅首帧的接收情况。若可接收，继续当前图片流程；若命中人脸输入审核，再采用官方备选路径：**Seedream 5.0 lite/pro 文生图 → 保留同账号原始产物 → 在有效期内输入 Seedance 2.5**。这意味着重新准备并验收首帧，不能保证自动恢复本批角色的精确脸型。官方表格只明确列出文生图，不应把“上传现有图片后图生图”写成已核实享受相同豁免的流程。

预置虚拟人像和已授权真人素材使用 `asset://<ASSET_ID>`。虚拟人像库不等于任意外部 AI 人像的自动入库许可；真人授权流程也不适用于为虚构角色冒造真人授权。[官方人像教程](https://ark.volcengine.com/region:cn-beijing/docs/82379/2608626?lang=zh)

## 2. 模型、入口和鉴权

| 项目 | 已核实结果 |
| --- | --- |
| 模型 ID | `doubao-seedance-2-5-260628` |
| 控制台试用 | [Seedance 2.5 体验中心](https://ark.volcengine.com/region:cn-beijing/experience/vision?modelId=doubao-seedance-2-5-260628&tab=GenVideo) |
| 模型详情 | [Seedance 2.5 模型详情](https://ark.volcengine.com/region:cn-beijing/model/detail?Id=doubao-seedance-2-5&projectName=default) |
| API Base URL | `https://ark.cn-beijing.volces.com/api/v3` |
| API Key 鉴权 | HTTP Header：`Authorization: Bearer <ARK_API_KEY>` |
| 接入点 | `model` 也可填写账号中实际存在的 Endpoint ID；本次没有查询用户接入点，不提供虚构的 `ep-...` 值。 |

模型 ID 与体验入口来自[2.5 官方教程](https://ark.volcengine.com/region:cn-beijing/docs/82379/2607688?lang=zh)。Endpoint ID 用法来自[创建任务参数](https://ark.volcengine.com/region:cn-beijing/docs/82379/1520757?lang=zh)，鉴权方式来自[Base URL 及鉴权](https://ark.volcengine.com/region:cn-beijing/docs/82379/1298459?lang=zh)。账号是否已开通模型、资源包和实际 Endpoint 配额未核实。

## 3. 首帧、参考图与输出规格

| 项目 | Seedance 2.5 方舟原生行为 |
| --- | --- |
| 图片内容字段 | `content` 数组内使用 `type: "image_url"`、`image_url: {"url": "..."}`。 |
| 首帧 | 单张图片，`role: "first_frame"`；官方也允许单图首帧不填 role，本项目建议显式填写。 |
| 首尾帧 | 两张图分别使用 `role: "first_frame"` 与 `role: "last_frame"`。 |
| 参考图 | 每张使用 `role: "reference_image"`，全模态参考场景支持 1–30 张图片。 |
| 能否并用 | 首帧、首尾帧、全模态参考是互斥场景，不能把 `first_frame` 与 `reference_image` 混在同一任务中。 |
| 间接组合 | 全模态参考可在提示词中要求某张参考图承担起始画面，但其首帧一致性不等同于严格的首帧模式。 |
| 首帧比例 | `ratio` 默认且仅支持 `"adaptive"`，跟随首帧图片；不能在 2.5 首帧请求中另外指定 `"16:9"`。 |
| 文生视频／参考生视频比例 | 可用 `16:9`、`4:3`、`1:1`、`3:4`、`9:16`、`21:9`、`adaptive`。 |
| 时长 | `duration` 为整数，支持 4–30 秒，或 `-1` 自动选择；2.5 默认 `-1`。本项目最终为 S01–S05 各 12 秒、S06–S07 各 15 秒。 |
| 分辨率 | 默认 `720p`，可选 `480p`、`720p`、`1080p`。当前官方 2.5 列表不含 `4k`。 |
| 关闭声音 | `generate_audio: false` 输出无声视频；该字段默认 `true`，不能仅靠“无配音”提示词代替关闭。 |
| 输出格式 | `mp4`、`mov`；本项目试拍可用 `mp4`。 |

上述字段及互斥限制已在[创建视频任务](https://ark.volcengine.com/region:cn-beijing/docs/82379/1520757?lang=zh)与[2.5 教程](https://ark.volcengine.com/region:cn-beijing/docs/82379/2607688?lang=zh)中交叉核实。1080p 的 2.5 输出采用 10bit、H.265/HEVC，播放器兼容性需实测；720p 可作为首轮测试规格。

图片可使用公网 URL、Base64 Data URL 或素材 ID。单图小于 30 MB，请求体不超过 64 MB；单边像素范围为 300–6000，宽高比为 0.4–2.5。参考图总数增加不改变首帧模式的单图限制。[创建任务图片字段](https://ark.volcengine.com/region:cn-beijing/docs/82379/1520757?lang=zh)

**与本项目直接相关：**将人物三视图用于制作并验收单幅首帧，随后只把单幅首帧传给 Seedance 2.5。首帧本身应具有目标画幅；不要让模型从三视图拼版开始，也不要要求首帧视频入口同时继承多张身份板。

## 4. 可供实现参考的最小请求体

以下仅为按官方字段组合的示例，未实际提交。`FIRST_FRAME_URL_OR_ASSET_ID` 必须替换为通过素材检查的真实输入。

```json
{
  "model": "doubao-seedance-2-5-260628",
  "content": [
    {
      "type": "text",
      "text": "在已验收首帧上继续本镜头动作。保持固定机位、构图和焦点。按该镜头脚本执行；无对白、独白、口型表演、歌唱或字幕。"
    },
    {
      "type": "image_url",
      "image_url": {
        "url": "FIRST_FRAME_URL_OR_ASSET_ID"
      },
      "role": "first_frame"
    }
  ],
  "resolution": "720p",
  "ratio": "adaptive",
  "duration": 12,
  "generate_audio": false,
  "output_format": "mp4"
}
```

S06、S07 把 `duration` 改为 `15`；其余镜头为 `12`。最终按 S01→S07 顺叙剪辑，原始素材共 90 秒，目标取用 68 秒。声音关闭也意味着生成环境声和拟音一并关闭，后期另做声音。

**不要加入未经 2.5 支持的通用字段。**当前创建文档的 `camera_fixed` 和 `seed` 支持列表仅列 1.x，`draft` 仅列 1.5 pro；2.5 教程也明确不支持样片模式和离线推理。因此本项目的“控制台试拍”应是普通生成测试，不能转换成 `draft: true`，也不应设置 `service_tier: "flex"`。固定机位写入提示词并通过看片验收。[创建任务支持列表](https://ark.volcengine.com/region:cn-beijing/docs/82379/1520757?lang=zh)

## 5. 创建、查询与取消

| 操作 | HTTP 方法与路径 | 行为 |
| --- | --- | --- |
| 创建 | `POST /contents/generations/tasks` | 异步返回任务 `id`，不代表视频已完成。 |
| 查询 | `GET /contents/generations/tasks/{id}` | 查询状态，成功后读取 `content.video_url`。 |
| 取消／删除 | `DELETE /contents/generations/tasks/{id}` | `queued` 可取消；`running` 不支持取消。成功、失败、过期状态下调用是删除记录，之后无法查询。 |

来源：[创建任务](https://ark.volcengine.com/region:cn-beijing/docs/82379/1520757?lang=zh)、[查询任务](https://ark.volcengine.com/region:cn-beijing/docs/82379/1521309?lang=zh)、[取消或删除任务](https://ark.volcengine.com/region:cn-beijing/docs/82379/1521720?lang=zh)。DELETE 成功 HTTP 状态码为 200。不能向用户承诺已经开始运行的任务随时可撤销。

任务记录保存 7 天；输出 URL 有效期 24 小时，2.5 视频下载上限为 100 次。成功后应及时下载一次并保存本地文件与任务元数据，避免将临时 URL 当成长期交付地址。[查询任务](https://ark.volcengine.com/region:cn-beijing/docs/82379/1521309?lang=zh)

创建文档另有 `execution_expires_after`：默认 172800 秒，允许 3600–259200 秒，从创建时间起计算，超时进入 `expired`。客户端轮询应处理 `queued`、`running`、`succeeded`、`failed`、`cancelled` 和 `expired`；不要只在成功和失败时退出。

## 6. 限流与批量生产建议

2.5 教程当前公开配额如下。同一主账号下同一模型的请求共享限制，不区分模型版本；这不是本次查询到的用户账户实际配额。

| 用户类型／接口 | 官方公开上限 |
| --- | --- |
| 个人用户创建任务 | 180 RPM；最多 3 个同时处理的任务 |
| 企业用户创建任务 | 600 RPM；最多 10 个同时处理的任务 |
| 查询单个任务 | 账号维度 20 QPS |
| 取消／删除任务 | 账号维度 20 QPS |
| 查询任务列表 | 账号维度 1 QPS |

达到并发上限后新任务进入队列；超过请求频率限制会返回 429。[2.5 教程限流说明](https://ark.volcengine.com/region:cn-beijing/docs/82379/2607688?lang=zh)

本项目的工程建议：

- 首轮一条一条测试，输入接受性、动作与画质通过后，再按账号实际配额设置有界并发。
- 单任务以约 10 秒间隔轮询可作为起点；这是官方教程示例的节奏，不是服务 SLA。批量轮询应错开时间。
- 429 使用有上限的指数退避和抖动；这是客户端实现建议，不是已核实的 2.5 专用字段。
- 提交成功立即保存任务 ID。POST 若超时且是否创建成功不明，不要无条件重复提交，避免重复任务；本次未核实到创建接口的幂等键保证。
- 依据现有任务 ID 查询状态，减少高频扫描列表；下载成功后记录实际时长、尺寸、编码和是否含音轨。

链条：**先验证当前图片能否被方舟接受 → 明确 2.5 首帧参数 → 单条控制台测试 → 看片确认动作与无声输出 → 保存确定的配置 → API 有界并发生成与下载。**
