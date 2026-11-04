import { bi, f, cat, type Text, type BiText } from '../i18n/text';
export const orders = ['HOLD', 'ADVANCE', 'FLANK'] as const;
export type Order = typeof orders[number];
export const orderNames: Record<Order, BiText> = { HOLD: bi("待命", "Hold"), ADVANCE: bi("推进", "Advance"), FLANK: bi("包抄", "Flank") };
export const squads = [
  { name: bi("一队 · 正面", "Squad 1 · Front"), hint: bi("正面牵制守军，让他们无法转向两翼。", "Keep the defenders occupied at the front so they cannot turn toward the flanks."), best: 'ADVANCE', x: 48, y: 72 },
  { name: bi("二队 · 左翼", "Squad 2 · Left"), hint: bi("左侧通道已打开，绕至守军侧后。", "The left passage is open. Move around the defenders' side."), best: 'FLANK', x: 18, y: 62 },
  { name: bi("三队 · 右翼", "Squad 3 · Right"), hint: bi("右侧仍有巡逻，先留作预备队接应。", "Patrols remain on the right. Stay in reserve to support the others."), best: 'HOLD', x: 78, y: 62 },
] as const;
export const approachWidth = 1280;
export const guards = [340, 720, 1100];
export const covers = [230, 610, 990];
export const assaultCommands = [
  { key: ' ', label: bi("推进", "ADVANCE · Move forward") }, { key: 's', label: bi("稳住阵形", "HOLD · Steady the formation") },
  { key: 'a', label: bi("左翼包抄", "LEFT FLANK · Circle left") }, { key: ' ', label: bi("推进", "ADVANCE · Move forward") },
  { key: 'd', label: bi("右翼支援", "RIGHT FLANK · Support the right") }, { key: 's', label: bi("等待友军", "HOLD · Wait for allied troops") },
  { key: 'a', label: bi("侧翼接应", "LEFT FLANK · Support the flank") }, { key: ' ', label: bi("越过土垒", "ADVANCE · Cross the earthworks") },
  { key: 'd', label: bi("保持联系", "RIGHT FLANK · Maintain contact") }, { key: 's', label: bi("重新集结", "HOLD · Regroup") },
  { key: ' ', label: bi("进入堡垒", "ADVANCE · Enter the redoubt") }, { key: 's', label: bi("守住阵地", "HOLD · Secure the position") },
];
