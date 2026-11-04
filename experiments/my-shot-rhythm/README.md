# My Shot · 单页音游实验

使用用户提供的完整《My Shot》MP3。面向熟悉原声带的剧迷，验证键盘音游的节奏与读谱体验。

## 启动

在 Hamilton 项目根目录运行：

```sh
npm run rhythm:dev
```

打开 http://127.0.0.1:1786/ 。源码入口是 `main.ts`，该页面与剧情入口独立。

```sh
npm run rhythm:test
npm run rhythm:build
```

构建输出在本目录 `dist/`，可由任意静态 HTTP 服务提供；不要用 `file://` 直接打开带模块的页面。本次仅在本地开发与预览，没有部署或升级主游戏版本。没有新增运行时依赖，复用根目录工具链。

## 试玩

- D / F / J / K 对应四轨。单击即可，首版谱面没有长按。
- 下落式：音符到金线时按键。圆点式：外圈与目标圆重合时按圆内字母；同一轨仍对应同一字母。
- 两种模式使用相同音符时刻与成绩计算，可在演奏中切换比较。
- 完整歌为 5:33；也可选择开场 45 秒或 13 个信号分段之一。
- 入门 341 音符，标准 639 音符。标准增加八分切分及 23 次双押。
- 「先看演示」自动命中，用来理解谱面与音乐。页面明确标为演示，不能作为个人成绩。
- 空格暂停/继续，Esc 暂停，R 重新开始。离开窗口或标签页自动暂停；恢复有预备时间。
- 「手感调整」提供音量、输入校准、音符预告时间和节拍参考音。正校准值抵消偏晚输入，负值抵消偏早输入；不会修改谱面。输入校准在一局中锁定。
- 保留项目四种语言模式。这里是非对话界面，因此只显示主语言；切换语言不重置歌曲或成绩。
- 窄屏改为上方设置、下方演奏区；屏幕按键也支持指针点击。设计重点仍是外接键盘。

## 谱面与音乐依据

详细分析见 `../../docs/designs/2026-10-28-my-shot-rhythm-music.md`。

音频约 91 BPM，先分析分频起音，再做受限连续节拍跟踪，得到 503 个逐拍时间。将可重复的四拍手型与有起音支持的八分音符组合，稀疏段留白。`chart.json` 的每个 `note.time` 都是相对于解码音频起点的绝对秒数；不能简单用单一 BPM 替代，也不要额外加 MP3 包起始偏移。

`chart.json` 保留 `beat`、`source`、`strength` 等编谱证据；`tempoMap` 是局部估计，并非原作出版乐谱。段落标题基于音频织体，仅为练习导航，不是已确认的角色/歌词边界。

```sh
# 只校验当前谱面，不需要安装信号处理库
python3 experiments/my-shot-rhythm/analysis/validate_chart.py

# 重建谱面：在根目录执行，ffmpeg 需可用（也支持 --ffmpeg 指定路径）
python3 -m venv experiments/my-shot-rhythm/analysis/.venv
experiments/my-shot-rhythm/analysis/.venv/bin/pip install -r experiments/my-shot-rhythm/analysis/requirements.txt
experiments/my-shot-rhythm/analysis/.venv/bin/python experiments/my-shot-rhythm/analysis/build_chart.py --plot
```

`analysis/evidence.json` 保存数据证据；`analysis/timing-report.png` 展示能量、局部拍速、谱面密度和起音对齐。

这是信号分析辅助的实验编谱，尚未完成逐句人工听审。起音峰可能包含人声，起音邻近不等同于音乐正确；四拍分组也未与出版乐谱小节逐一核对。下一轮应实际弹奏标记“听起来该打但没打”和“无重音却要求打”的位置，再人工修谱。

## 时钟与判定

Web Audio 完整解码原文件，音频设备输出时间驱动音符位置、输入判定和结束。`requestAnimationFrame` 只负责显示，不累计节拍。优先用 `getOutputTimestamp()` 对齐输出，缺失时使用音频上下文与延迟回退。参考：[MDN](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/getOutputTimestamp)。

- 完美 ±45 ms，准确 ±90 ms，命中 ±140 ms。
- 一局上限 1,000,000 分，权重依次为 1 / 0.8 / 0.5 / 0。
- 空按断连并扣 1/4 音符权重；系统按键重复不会刷分。
- 准确率以已判定音符计算，并扣空按惩罚；结算时所有未击中音符计错过。
- 分段只选择范围内音符，并在结束边界后保留晚击窗口；音频播放停止于所选段落尾部宽限或文件结尾。
- 暂停冻结音乐与判定时钟，继续不会把暂停时间算成错过。异步加载/开始可被离开窗口或返回准备取消。

## English quick start

Run `npm run rhythm:dev` from the Hamilton root and open http://127.0.0.1:1786/ . Play with D/F/J/K. Choose Falling notes or Approach circles, Beginner or Standard, and the full track or a practice section. Space pauses/resumes, Esc pauses, and R restarts. Autoplay demonstrates the same chart without claiming a personal result. Language changes preserve the run.

This is a local, signal-guided prototype using the supplied 5:33 recording. It contains 341 Beginner and 639 Standard tap notes. Beat tracking and onset evidence guide the arrangement; phrase-by-phrase human musical review remains pending.
