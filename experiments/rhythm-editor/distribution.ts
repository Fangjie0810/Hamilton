import {bi} from '../../src/i18n/text';
export const portableGuide = [
  bi('Hamilton 谱面编辑器 · 离线工具', 'Hamilton Chart Editor · Offline tool'),
  bi('1. 先解压整个 ZIP，然后用电脑浏览器打开 Hamilton-Editor.html。无需安装软件、联网或启动服务。', '1. Extract the ZIP, then open Hamilton-Editor.html in a desktop web browser. No installation, network connection or server is needed.'),
  bi('2. 选择歌曲、四键或六键，填写制谱人或昵称，开始编辑。My Shot 自带示例；另外两首可从空白开始。', '2. Choose a song and four or six keys, enter your name or nickname, and edit. My Shot includes an example; the other songs start blank.'),
  bi('3. 用左侧工具添加单击或长按，右侧修改按键、A/B 色、落点和时长。拖动黄线定位，空格试听；支持慢放、循环和键盘录入。', '3. Add taps or holds with the tools. Edit keys, A/B color, hit times and lengths on the right. Drag the gold line to seek; press Space to play. Slow playback, loops and keyboard recording are available.'),
  bi('4. 完成后点击“导出谱面 JSON”，把下载的 .hamchart.json 文件发回邀请你制谱的人。每首歌、每种键位分别导出。', '4. Click “Export chart JSON” and send the downloaded .hamchart.json file back to the person who invited you. Export each song and key layout separately.'),
  bi('默认 JSON 仅包含谱面与音频标识，体积较小。内置三首歌曲无需再次发送音频；若换成了自己的音频，导出时勾选“包含音频”。', 'The default JSON contains chart data and audio identity only, keeping it small. Built-in recordings do not need to be sent again. If you use your own audio, enable “Include audio” when exporting.'),
  bi('继续修改：打开同一个工具，点击“导入工程”选择已保存的 JSON。收到别人返回的 JSON 也用这个入口导入、试听；导入后可撤销回上一份谱面。', 'To continue editing, open the tool and use “Import project” to select your saved JSON. Use the same control to import and audition a returned chart; Undo restores the previous chart.'),
  bi('草稿保存在当前浏览器；请在关闭前导出 JSON 留存。移动 HTML 或更换浏览器时，以导出的 JSON 为准。', 'Drafts are saved in the current browser. Export JSON before closing to keep a copy. Use the exported JSON when moving the HTML or switching browsers.'),
  bi('本工具不会自动上传或发送文件。请通过你们约定的聊天或邮件方式返回 JSON。', 'This tool does not upload or send files automatically. Return the JSON through your agreed chat or email channel.'),
];
