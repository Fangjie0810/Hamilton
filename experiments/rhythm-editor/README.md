# Hamilton 谱面编辑器

本地入口：http://127.0.0.1:1787/ 。运行 `npm run editor:dev`；静态构建 `npm run editor:build`；测试 `npm run editor:test`。

## 编辑流程

1. 选择 Alexander Hamilton、My Shot 或 Helpless；选择四键 **S D / K L** 或六键 **S D F / J K L**。歌曲与键位组合各自保存草稿。
2. 选单击工具点击轨道放置音符；选长按工具从落点向上拖出尾端。选择工具可双击空白添加单击。拖动音符改变落点与轨道，拖动长按尾端改变时长。
3. 音符左侧箭头的中心指向精确落点。同轨密集音符会自动缩窄、按时间先后阶梯排列，仍可逐个点击或拖动；这里只调整显示位置与宽度，工程中每个音符的时间、数量与轨道保留。右侧选择 A/B 色、单击/长按、按键。时间采用毫秒，可直接输入，也可用 ±1 / ±10 / ±50 微调。关闭吸附或拖动时按 Shift 可自由放置。
4. 点击总波形定位，滚轮浏览谱面，空格试听；可慢放、循环，或“试听此音符”。黄线为当前播放位置，可抓住黄线或左侧时间标签上下拖动；定位时谱面保持原位，松开后停在所选时间。开启跟随播放后，继续试听会沿用拖动后的黄线高度。勾选键盘录入后，边播放边按对应按键；持续至少 180 ms 记为长按。
5. 填写制谱人，导出 `.hamchart.json` 发回邀请你制谱的人。默认不包含音频，内置歌曲通过校验值自动匹配；替换为自己的音频时可勾选“包含音频”。再导入即可继续编辑，导入后可撤销回上一份谱面。

键盘：V 选择、T 单击、H 长按、E 擦除、A/B 新音符颜色、↑↓ 调整所选音符 10 ms（Shift 为 1 ms）、Delete 删除、⌘/Ctrl Z 撤销。

My Shot 四键初始提供原实验的 639 音符示例，按轨道顺序改为 S/D/K/L，保留原分析落点；其他组合默认空白。六键可主动载入 My Shot 示例，外侧轨道映射 S/D/K/L，F/J 留给追加编排。示例不是最终审定谱；Alexander Hamilton 与 Helpless 的网格默认 120 BPM，仅是编辑网格起点，不是测定曲速。

## 工程格式 v1

JSON 标识：`format: "hamilton-rhythm-project"`，`version: 1`。所有音符时间均为**解码后音频起点的整数毫秒**，无需增加 MP3 容器的 start_time。播放器以 Web Audio 输出时钟为准，慢放不改变工程时间。

| 字段 | 含义 |
|---|---|
| `author` | 可选制谱人或昵称，也用于导出文件名 |
| `trackId` | `alexander-hamilton`、`my-shot`、`helpless` |
| `keyMode` / `keys` | `4k`: `["S","D","K","L"]`；`6k`: `["S","D","F","J","K","L"]` |
| `units` / `laneIndexBase` | 固定为 `milliseconds` / `0` |
| `audio` | 文件名、SHA-256、字节数、MIME、时长；可选 `dataUrl` 包含完整音频 |
| `grid` | BPM、首拍偏移毫秒、吸附音符分母（1/2/4/8/16） |
| `palette` | A 与 B 的六位 HEX 色值 |
| `notes[].id` | 稳定音符 ID，二次修改应保留 |
| `notes[].lane` / `key` | 从左至右 0 开始的轨道序号及对应按键；须一致 |
| `notes[].color` | A 或 B，独立于轨道 |
| `notes[].kind` | tap 或 hold |
| `notes[].atMs` | 音符落到判定线、需要按下的时间 |
| `notes[].durationMs` | tap 固定 0；hold 至少 1；松开时间为 atMs + durationMs |

例如一个六键 F 轨的 B 色长按：

```json
{"id":"note-001","lane":2,"key":"F","color":"B","kind":"hold","atMs":1234,"durationMs":731}
```

结束时间为 1965 ms。工程还记录名称、工程 ID 与创建/修改时间。解析器会拒绝不支持的版本、重复 ID、错配按键、无效时间和超出音频时长的音符。重叠音符保留并在界面提示，以便创作者修正。时长未加载时允许 `audio.durationMs: null`，加载后补全；无法识别的非内置音频需重新选择文件。

草稿以歌曲+键位为索引存在当前浏览器 localStorage，替换音频缓存于 IndexedDB；切换浏览器或清除站点数据不会保留草稿，应导出工程。没有嵌入音频的工程通过 SHA-256 匹配内置音频或本机缓存。导入外部工程不会读取任意网络音频地址。

## 音频来源

用户提供的本地副本，均复制到 `public/audio/`，校验值见 `assets.json`：

- Alexander Hamilton：`/Users/fangjie/Downloads/Alexander Hamilton.mp3`（本次指定的人声版）。
- My Shot：此前用户提供的 `M500003HqURx4Nxj0t.mp3`，复用 `experiments/my-shot-rhythm/public/my-shot.mp3`。
- Helpless：`/Users/fangjie/Downloads/helpless.mp3`。

本编辑器为独立本地实验，不改变三维主流程、旧试玩或线上版本。当前提供编辑、自动播放预览和按键录入；工程接入主游戏的判定及成绩流程另行处理。

## 发给别人使用

运行 `npm run editor:pack`，会在 `artifacts/rhythm-editor/<UTC 时间戳>/` 生成 `Hamilton-Chart-Editor-Offline.zip`。压缩包只有自包含 HTML 和中英文使用说明，三首音频与程序全部内嵌。接收人无需安装 Node、Python 或启动本地服务。

协作流程：发 ZIP → 对方解压并用电脑浏览器打开 `Hamilton-Editor.html` → 填写制谱人并编谱 → 导出 JSON 发回 → 你用“导入工程”打开、试听或继续调整。每个 JSON 对应一首歌的一套键位；原版 v1 JSON 继续支持，新增 `author` 为可选字段。
