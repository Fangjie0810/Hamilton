# v7 两条视频：多镜头 API 依据

核实日期：**2026-09-11，北京时间**。本报告只读取官方公开资料；未读取 API Key、当前账户账单或资源包，未创建视频、未执行付费 POST，未修改 manifest 或后端。v6 保留，v7 为独立准备方案。

## 已核实可用的模式

| 项目 | v7 可采用的原生 Ark 行为 |
| --- | --- |
| 模型 | `doubao-seedance-2-5-260628` |
| 任务 | 全模态参考中的“参考生视频”，本次只用文本＋图片。 |
| A 段／B 段 | A 为 30 秒人物叙事；B 为约 20 秒环境段。单次允许 4–30 秒。 |
| 图片对象 | `type: "image_url"`，`image_url.url` 放公网 URL 或原始图片 Data URI，`role: "reference_image"`。 |
| 图片上限 | 最多 30 张；本次无需上传视频或音频。所有参考媒体总上限 50 个是 30 图＋10 视频＋10 音频，不能误写成 50 张图。 |
| 比例 | 参考生视频允许 `ratio: "16:9"`，不受首帧模式的 `adaptive` 限制。 |
| 任务引导 | 可显式 `omni_reference_task_type: "reference"`，便于前置部分参数校验；不是包通过的开关。 |
| 当前规格 | `resolution: "720p"`、`generate_audio: false`、`output_format: "mp4"`。 |

来源：[Seedance 2.5 官方教程](https://ark.volcengine.com/region:cn-beijing/docs/82379/2607688?lang=zh)、[创建视频任务 API](https://ark.volcengine.com/region:cn-beijing/docs/82379/1520757?lang=zh)。

## 30 秒支持分镜与切镜，不限于一镜到底

2.5 专属提示词指南明确支持单段 30 秒、故事板／宫格分镜参考及多关键帧参考；推荐以时间戳或“镜头 N”组织每段画面、动作与机位。其正式示例按镜头列出全景固定机位、中景过肩及人物特写等不同景别。2.5 教程的 API 例子也包含切特写、快节奏剪辑，并将运镜／切镜列入提示词结构。因此可以用 A、B 两次生成测试模型的多镜头叙事能力，不能将 30 秒直出解释为只支持连续长镜头。[2.5 专属提示词指南](https://ark.volcengine.com/region:cn-beijing/docs/82379/2607689?lang=zh)、[2.5 教程](https://ark.volcengine.com/region:cn-beijing/docs/82379/2607688?lang=zh)

这确认的是模型能力与官方推荐写法，不能保证一次生成便精确执行所有剪切时点、覆盖所有场景或完全保持人物一致；这些是批准生成后需要由制作方审阅的实际效果。

## 参考图编号：统一采用 @图片1、@图片2

**按图片上传顺序编号，并在提示词中写明每张图的用途。** 2.5 指南明确要求按上传顺序对应“图 1／视频 1／音频 1”，并用文字绑定；官方示例直接使用 `@图片1`、`@图片2` 等。2.5 教程也推荐 `@图片1`、`@视频1`、`@音频1`。[素材映射规则与示例](https://ark.volcengine.com/region:cn-beijing/docs/82379/2607689?lang=zh)、[2.5 提示词规则](https://ark.volcengine.com/region:cn-beijing/docs/82379/2607688?lang=zh)

v7 应固定每段的参考图清单与顺序，再以 `@图片1`…逐一说明人物年龄、身份、服装、场景或道具职责。`content` 前面的文本项不占图片编号；编号跟随图片素材的先后顺序。API 图片对象没有需要额外填写的自定义标签字段，也没有官方要求必须用 ChatCut 包装中的 `@Image1`。不要只在图片上写角色名，再期待模型自动理解身份映射。

**多参考模式与首帧模式互斥。** 这两段任务的所有图片都使用 `reference_image`，不要夹带 `first_frame`／`last_frame`。可以在提示词中要求某张图作为开始或结束画面，但其约束不同于严格的首帧／首尾帧模式。单图须小于 30 MB，完整请求体不超过 64 MB；多图 Base64 应按编码后整个请求检查体积。[官方互斥及输入限制](https://ark.volcengine.com/region:cn-beijing/docs/82379/1520757?lang=zh)

仅供核对的请求结构：

```json
{
  "model": "doubao-seedance-2-5-260628",
  "content": [
    {"type": "text", "text": "素材绑定：@图片1提供……；@图片2提供……。随后填写已审定的镜头顺序或时间轴。无对白、独白、歌唱、字幕。"},
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

示例仅展示两个参考项的结构，实际按该段审定清单扩展。B 段把 `duration` 改为 `20`。`omni_reference_task_type` 是官方 2.5 字段；若实际提示词意图与指定类型不一致，仍可能返回异步错误。[任务引导字段](https://ark.volcengine.com/region:cn-beijing/docs/82379/1520757?lang=zh)

## 50 秒成本与折扣条件

**从单张首帧改成多张图片参考，仍属于“输入不含视频”。** 本方案不传 `video_url`，所以不能使用“输入包含视频”的另一档单价；图片数量本身不会改变该类别。以下为 50 秒生成总量、16:9、24 fps 的公开预算：

| 规格 | 估算 token | 单价（元／百万 token） | A 30 秒 | B 20 秒 | 合计 |
| --- | ---: | ---: | ---: | ---: | ---: |
| **当前 720p** | 1,080,000 | 70.00 | ¥45.36 | ¥30.24 | **¥75.60** |
| 1080p，活动后付费价 | 2,430,000 | 55.44 | ¥80.83 | ¥53.89 | **¥134.72** |

```text
token = 输出秒数 × 输出宽 × 输出高 × 24 ÷ 1024
720p：50 × 1280 × 720 × 24 ÷ 1024 ÷ 1,000,000 × 70 = 75.60 元
1080p：50 × 1920 × 1080 × 24 ÷ 1024 ÷ 1,000,000 × (77 × 0.72) = 134.7192 元
```

720p 不参与此次 1080p 活动。1080p 7.2 折适用于**按量后付费、出账时间在 2026-08-14 14:00 至 2026-09-17 14:00 北京时间内**的用量，自动生效，无需领取。资源包优先抵扣且不参与该后付费折扣；节省计划采用活动／内置／合同折扣中的最低值。实际用量取 `usage.completion_tokens`，扣款以账户实际账单为准。[模型价格及公式](https://ark.volcengine.com/region:cn-beijing/docs/82379/1544106?lang=zh)、[官方活动规则](https://ark.volcengine.com/region:cn-beijing/docs/82379/2630943?lang=zh)

## 模型开通条件不等于折扣资格

开通说明要求满足任一项：200 元级账户可用余额；购买 200 元及以上专属节省计划且仍有余额；购买 200 元及以上对应模型资源包且仍有余量。活动页将余额条件写为 `>200 元`，开通说明写“达到 200 元”；本报告不对余额恰好 200 元时的账户资格作承诺。本轮没有读取用户余额、计划、资源包或模型开通状态。[模型开通说明](https://ark.volcengine.com/region:cn-beijing/docs/82379/2637911?lang=zh)

资源包可满足开通门槛，但其已抵扣的 token 不享本次后付费 7.2 折。已开通模型、GET 模型目录可见、活动价格公开和具体账单享受折扣，是不同的证据，不能相互替代。[活动与计费方式关系](https://ark.volcengine.com/region:cn-beijing/docs/82379/2630943?lang=zh)

## 视频编辑能力与费用边界

2.5 支持视频编辑：至少输入一个 `reference_video`，可用 `omni_reference_task_type: "edit"`；参考视频 4–30 秒，`ratio: "adaptive"`、`duration: -1`。输出大体保持输入时长，可能略短不超过 0.4 秒。[2.5 编辑说明](https://ark.volcengine.com/region:cn-beijing/docs/82379/2607688?lang=zh#2.5_edit)

编辑或参考视频输入的预算需计算**输入视频秒数＋输出视频秒数**，采用“输入包含视频”单价，并考虑最低 token 用量限制。不能把“修改已有视频”理解为免费修补。v7 当前两条请求只含图片和文字，不使用该模式。[官方视频计费公式](https://ark.volcengine.com/region:cn-beijing/docs/82379/1544106?lang=zh)

协议链：**固定每段参考图顺序 → 用 @图片N 明确职责 → 编写镜头时间轴 → reference 模式生成 30 秒／20 秒 → 下载后审阅切镜与场景覆盖**。本轮仅完成方案与接口准备，待用户批准后才创建视频。
