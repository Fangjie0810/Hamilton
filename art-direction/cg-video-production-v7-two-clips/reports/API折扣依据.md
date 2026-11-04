# Seedance 2.5：1080p API 折扣核查

核查日期：**2026-09-11，北京时间**。11:49 完成初轮取证，随后补充官方专门活动规则及 2.5 专属提示词指南。只读取公开官方文档；未读取 API Key、账户账单或资源包，未创建视频、未调用付费 POST，未修改锁定的 manifest。

## 结论与证据强度

**已找到直接官方活动规则：72 折适用于方舟原生 API 的按量后付费在线推理，满足条件时自动生效，无需领取。** 活动页的参与步骤明确要求开通模型在线推理，并直接链接 Video Generation API；这不是仅控制台体验的促销。只有 1080p 参加，资源包抵扣用量不参与，时间按**出账时间**判定。[官方专门活动规则](https://ark.volcengine.com/region:cn-beijing/docs/82379/2630943?lang=zh)

**尚未核实当前账户的真实扣款。** 本次没有读取账户模型开通状态、协议价、资源包、节省计划或已出账结果。活动有计费方式与账户开通条件，不能写成所有账户无条件按 72 折实付，也不能把公开预算当成当前账户账单。

## 可复查的原文与所在位置

来源均为官方文档，以下是短引与对应上下文，不采用社区文章或第三方代理报价。

| 官方位置 | 原文短片段／可核对数据 | 对本次问题的意义 |
| --- | --- | --- |
| 《Seedance 模型限时折扣活动规则》→ 活动概览 | “自动生效，无需手动领取或申请” | 明确不需要领券、报名或额外申请折扣。 |
| 同页 → 参与方式 | 开通模型在线推理即可享受活动折扣，下一步直接链接 Video Generation API。 | 将折扣与官方 API 在线推理直接关联。 |
| 同页 → 活动时间 | “活动生效时间以出账时间为准。” | 截止前提交不保证截止后出账仍享折扣。 |
| 《模型价格》→ 视频生成模型 → 限时优惠 | “1080p 分辨率按刊例价 72 折计费” | 活动条件明确限定模型、分辨率及时间，未写成体验中心专属券。 |
| 同页 → 按 token 单价 → 在线推理 | 1080p：输入不含视频，原价 77.00，标注限时 72 折；输入包含视频，原价 46.00，同样标注限时 72 折。单位均为元／百万 token。 | 折扣直接进入模型在线推理计价表，而非只出现在控制台宣传横幅。 |
| 同页 → 视频 token 估算说明 | “调用 API 后返回的 usage.completion_tokens” | 该价格章节明确使用 API 生成任务的返回用量结算，形成 API 适用证据链。 |
| 《模型服务计费说明》→ 按 token 后付费 | 实时推理按消耗 token 统计并后付费，单价链接到上述《模型价格》。 | 确认普通 API 在线推理与该公开价格表的计费关系。 |

来源：[专门活动规则](https://ark.volcengine.com/region:cn-beijing/docs/82379/2630943?lang=zh)、[模型价格](https://ark.volcengine.com/region:cn-beijing/docs/82379/1544106?lang=zh#2864f00a)、[模型服务计费说明](https://ark.volcengine.com/region:cn-beijing/docs/82379/1544681?lang=zh#9be44658)。

活动完整条件的转述：**Seedance 2.5、1080p、2026-08-14 14:00 至 2026-09-17 14:00，北京时间（UTC+8）**；480p、720p 不参与该优惠。公开规则按输出分辨率及输入是否包含视频区分价格，没有按是否生成声音区分 2.5 单价。[官方优惠及价格](https://ark.volcengine.com/region:cn-beijing/docs/82379/1544106?lang=zh)

## 账户、渠道、领取及资源包边界

| 条件 | 本次核实结果 |
| --- | --- |
| API 与体验中心 | 专门活动页参与方式直接链接 API；优惠覆盖按量后付费在线推理，非仅体验中心。 |
| 新客／指定账户／企业身份 | 活动未限定仅新客或企业用户；但开通模型本身有 200 元级资金／计划／资源包门槛，见下文。 |
| 领取、报名、兑换券 | 官方明确自动生效，无需手动领取或申请。 |
| 特定 API Key、Model ID／Endpoint ID、接入渠道 | 本次优惠条款没有列出指定 Key、指定接入点或指定客户端的条件。这里只覆盖方舟原生 API 公开在线推理，不能承诺第三方代理或其他平台沿用该价格。 |
| 资源包 | 不必买资源包。资源包优先抵扣 token，属于预付费，**不参与本次折扣**；包用完后或未购买包时走后付费的用量才按活动价出账。 |
| 节省计划／合同折扣 | 节省计划抵扣后付费账单，采用模型活动折扣、节省计划内置折扣、模型合同折扣中的最低值；不是将几个折扣相乘。其他代金券的具体适用情况本次未核实。 |
| 账户余额 | 支付模型按量后付费订单，参与本次活动。自动抵扣顺序为资源包 → 节省计划 → 账户余额。 |
| 截止时间附近跨时段任务如何适用 | **按后付费订单出账时间判定**；活动结束后出账的用量恢复刊例价。 |

上述抵扣与自动生效规则来自[活动专页](https://ark.volcengine.com/region:cn-beijing/docs/82379/2630943?lang=zh)，不是从“未列限制”推导的。活动另保留对违规参与取消资格及调整规则的条款；本次没有读取当前账户资格判定。

**模型开通门槛与折扣是两件事。** 专门开通说明列出任一条件：账户可用余额达到 200 元；200 元及以上专属递减型节省计划且仍有余额；200 元及以上对应模型资源包且仍有余量。活动页与 2.5 教程将余额门槛写为 **>200 元**，而开通说明写“达到 200 元”；两处存在边界措辞差异，本次不对余额恰好 200 元的账户资格作承诺。资源包可以满足开通条件，但它抵扣的用量不参与后付费折扣。[模型开通、使用与退订说明](https://ark.volcengine.com/region:cn-beijing/docs/82379/2637911?lang=zh)、[活动参与条件](https://ark.volcengine.com/region:cn-beijing/docs/82379/2630943?lang=zh)

## 本项目公开 API 预算

计划使用图片首帧，没有输入视频，故对应 **77 × 0.72 = 55.44 元／百万 token**。不是 46 元那一档；后者适用于输入含视频的请求。

```text
138 秒 × 1920 × 1080 × 24 fps ÷ 1024 = 6,706,800 token（估算）
6,706,800 ÷ 1,000,000 × 55.44 = 371.824992 元 ≈ ¥371.82
同样用量按 77 元刊例价：¥516.42
```

以上是按官方公式计算的公开 API 预算，不是已经发生的账单。实际生成用量以 `usage.completion_tokens` 为准；成功重拍会额外计费；账户抵扣、专属价格和实付以账单为准。[官方公式及优惠](https://ark.volcengine.com/region:cn-beijing/docs/82379/1544106?lang=zh#sd25_price)

## 需要核实当前账户时的只读入口

1. **费用中心 → 账单管理／账单明细**：[官方只读账单入口](https://console.volcengine.com/finance/bill/detail/)。选择对应日期、字节跳动大模型服务及 Seedance 2.5 的相关计费项，核对用量、价格、优惠／抵扣和应付金额，以当前页面实际字段为准。本次没有打开账户账单。
2. **如按 Endpoint ID 调用**：在同一费用中心选择“分账账单”，统计周期设为“明细”，按“分拆项 ID”输入实际 Endpoint ID。该操作路径有官方 FAQ 说明；使用 Model ID 的请求不要虚构 Endpoint ID。[官方分账说明](https://ark.volcengine.com/region:cn-beijing/docs/82379/1359411?lang=zh#d53174f8)
3. **资源包适用范围与剩余量**：[方舟费用中心 → 资源包管理](https://console.volcengine.com/ark/region:cn-beijing/finance/resource-package)。核对是否有覆盖该模型和计费项的资源包，不能从仅有余额或模型列表推断优惠已生效。[官方资源包入口依据](https://ark.volcengine.com/region:cn-beijing/docs/82379/1544681?lang=zh#66abf1da)
4. **节省计划与余额**：[节省计划](https://console.volcengine.com/finance/saving-plan)、[账号总览](https://console.volcengine.com/finance/account-overview)，只读核对已有计划、余额与有效期。[官方入口依据](https://ark.volcengine.com/region:cn-beijing/docs/82379/2637911?lang=zh)

若账户尚无 Seedance 2.5 的对应账单，则只能确认公开 API 价格，不能证明未来一条任务的实付；**本轮不通过创建付费测试来补这项证据**。官方说明 2.0／2.5 出账周期自 2026-07-01 缩短为 30 秒，但实际展示仍可能延迟，应以已出账记录为准。[官方出账周期](https://ark.volcengine.com/region:cn-beijing/docs/82379/1544681?lang=zh#6c8214b9)

## 抓取审计记录

用户提供的[模型详情页](https://console.volcengine.com/ark/region:cn-beijing/model/detail?name=doubao-seedance-2-5)本次公开网页读取返回前端页面壳，没有可解析的价格条款；未将其当成当前账户优惠已生效的证据。公开活动路径 `https://www.volcengine.com/activity/seedance25` 同样只返回需运行 JavaScript 的页面壳，未获得额外活动规则，未用该路径补充推断。

以下官方正文通过无登录态公开文档接口获取，取其 `Result.MDContent` 的 UTF-8 字节计算 SHA-256；哈希用于识别本次读到的版本，不代表文档未来不会更新。

```text
公开正文接口：
https://docs.volcengine.com/api/doc/getDocDetail?LibraryID=82379&DocumentID=<ID>&type=online

统一取证时间：2026-09-11T03:49:29Z（北京时间 11:49:29）

DocumentID 1544106（模型价格）
官方 UpdatedTime：2026-09-04T12:25:30Z
MDContent SHA-256：7ffb5c472d21687efeafeaf250b0be498536b1093771f4ee660503deb574a0da
关键位置：MDContent 第 253、285–287、305 行。

DocumentID 1544681（模型服务计费说明）
官方 UpdatedTime：2026-09-02T10:58:37Z
MDContent SHA-256：06d81f27d4cc9dd0e9ae8147daadfe6e22cc74739b2689a67a44a15082295fe8
关键位置：MDContent 第 26–33、60–62、161、207 行。

DocumentID 1359411（计费 FAQ）
官方 UpdatedTime：2026-09-07T17:14:11Z
MDContent SHA-256：8d1256727e11e7d6933dfa3950c0f285a45b1e7e528ed20ed7b52bffe1ad004f
关键位置：MDContent 第 71–84、97 行。

后续补充取证（2026-09-11）：

DocumentID 2630943（Seedance 模型限时折扣活动规则）
官方 UpdatedTime：2026-09-04T12:25:30Z
MDContent SHA-256：afc4d5702d599648fa06d55bafc242d70063b59b0540eaa139083c25c986ddea
关键位置：MDContent 第 7、18–21、28–36、52–55、69、83–85、104–116 行。

DocumentID 2607688（2.5 专属教程）
官方 UpdatedTime：2026-09-09T07:48:44Z
MDContent SHA-256：36685e20dbbcca74e51e606f540733108522df684f3913dbb96a857599eb7cf1

DocumentID 2607689（2.5 专属提示词指南）
官方 UpdatedTime：2026-09-07T17:17:53Z
MDContent SHA-256：ecd390ec4c4d083acaf2f7b4b1b8ab49cac2f9c7d31152bf585fc38be6f32c22

DocumentID 1520757（创建视频任务 API）
官方 UpdatedTime：2026-09-09T11:08:06Z
MDContent SHA-256：83af18893175ab2a99d64dc57b25a16b54e64c46819e9d0c0671e6c1c70ac91d
```

## 补充：v7 两段多镜头参考生视频的协议

本节仅核实新方案可采用的原生 Ark 协议，保留 v6 方案和锁定 manifest，不创建视频。

- **单次可做 30 秒、多镜头叙事。** 2.5 专属指南明确支持单段 30 秒、故事板／多关键帧参考，并要求按时间戳或“镜头 N”逐段描述；官方例子展示全景固定机位、中景过肩、人物特写等分镜。2.5 教程的 API 示例也明确包含切特写与快节奏剪辑。因此不能将 30 秒能力限定为一镜到底；逐镜时点、叙事完整性和人物一致性的实际效果仍须生成后审阅。[2.5 专属提示词指南](https://ark.volcengine.com/region:cn-beijing/docs/82379/2607689?lang=zh)、[2.5 教程](https://ark.volcengine.com/region:cn-beijing/docs/82379/2607688?lang=zh)
- **素材按上传顺序编号并用文字绑定职责。** 2.5 指南明确“图 1／视频 1／音频 1”按上传顺序对应，示例使用 `@图片1`、`@图片2` 等；2.5 教程也推荐这一写法。v7 宜统一 `@图片1`…，并使 `content` 中图片顺序与提示词映射一致。不需要把 ChatCut 包装的 `@Image1` 当成原生 API 强制语法，也没有额外必填的图片标签字段。[2.5 素材映射规则](https://ark.volcengine.com/region:cn-beijing/docs/82379/2607689?lang=zh)
- **最多 30 张图片参考；首帧模式互斥。** 全模态参考可放最多 30 个 `role: "reference_image"` 图片对象。不得在同一任务混入 `first_frame`／`last_frame`。可以在文字中指定参考图承担开始画面，但这不等同于严格首帧锁定。多图 Data URI 仍须满足完整请求体不超过 64 MB 的限制。[原生 API 支持范围与互斥规则](https://ark.volcengine.com/region:cn-beijing/docs/82379/1520757?lang=zh)

v7 的核心顶层配置可用：

```json
{
  "model": "doubao-seedance-2-5-260628",
  "content": [
    {"type": "text", "text": "素材绑定与各镜头时间轴；使用 @图片1、@图片2 等对应下方上传顺序。"},
    {"type": "image_url", "image_url": {"url": "<第一张原始图片URL或Data URI>"}, "role": "reference_image"},
    {"type": "image_url", "image_url": {"url": "<第二张原始图片URL或Data URI>"}, "role": "reference_image"}
  ],
  "omni_reference_task_type": "reference",
  "resolution": "720p",
  "ratio": "16:9",
  "duration": 30,
  "generate_audio": false,
  "output_format": "mp4"
}
```

该示例只展示两个参考项的结构；实际按已审定的完整图片清单扩展。A 段 30 秒，B 段将 `duration` 设为 20。`omni_reference_task_type: "reference"` 是 2.5 官方支持的显式任务引导，可前置部分参数校验，但不会保证实际效果或所有异步校验通过。[任务引导字段](https://ark.volcengine.com/region:cn-beijing/docs/82379/1520757?lang=zh)

**仅图文参考、无输入视频，50 秒、720p、16:9 的公开预算为 ¥75.60**：`50 × 1280 × 720 × 24 ÷ 1024 = 1,080,000 token`，再乘 `70 元／百万 token`。720p 不享本次 1080p 折扣；增加图片数量本身不把任务改成“输入包含视频”的价格类别。具体费用仍以实际用量和抵扣账单为准。[视频计费公式](https://ark.volcengine.com/region:cn-beijing/docs/82379/1544106?lang=zh)

**视频编辑是另一个已支持的模式，但本次 v7 不使用它。** 编辑需至少一个 `reference_video`；可显式 `omni_reference_task_type: "edit"`，输入视频 4–30 秒，`ratio: "adaptive"`、`duration: -1`，输出时长大体保持输入，可能略短不超过 0.4 秒。计费估算包含**输入视频秒数＋输出视频秒数**，采用“输入含视频”的单价，并可能受最低 token 用量约束，不能只算输出秒数。1080p 本次活动的含视频单价为 33.12 元／百万 token，720p 含视频单价为 42 元／百万 token。[编辑规则](https://ark.volcengine.com/region:cn-beijing/docs/82379/2607688?lang=zh#2.5_edit)、[API 编辑限制](https://ark.volcengine.com/region:cn-beijing/docs/82379/1520757?lang=zh)、[计费公式与最低用量](https://ark.volcengine.com/region:cn-beijing/docs/82379/1544106?lang=zh)

证据链：**官方优惠通知 → 在线推理单价表 → API 用量计量 → 公开预算；当前账户协议／资源包 → 已出账明细 → 实际扣款确认**。前一条已核实，后一条本次未读取。
