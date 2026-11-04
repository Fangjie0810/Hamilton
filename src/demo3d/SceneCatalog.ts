import { bi, type BiText } from '../i18n/text';
import type { Point } from './Navigation';
import type { SceneWorld } from './SceneWorld';
import { StreetWorld } from './World';
import { TavernWorld } from './TavernWorld';
import { SquareWorld } from './SquareWorld';
import { CampWorld } from './CampWorld';
import { YorktownWorld } from './YorktownWorld';
import { MIN_CAMERA_PITCH } from './CameraOrbit';

export const SCENE_IDS = ['street', 'tavern', 'square', 'camp', 'yorktown'] as const;
export type SceneId = typeof SCENE_IDS[number];
export interface ScenePoint { id: string; position: Point; title: BiText; body: BiText }
export interface SceneExit { id: string; position: Point; to: SceneId; title: BiText }
export interface SceneDefinition {
  id: SceneId; title: BiText; kicker: BiText; subtitle: BiText; intro: BiText;
  spawn: Point; camera: { yaw: number; pitch: number; radius: number; min: number; max: number };
  light: { sky: number; ground: number; ambient: number; sun: number; power: number; fog: number; density: number; exposure: number; sunPosition?: [number, number, number] };
  points: ScenePoint[]; exits: SceneExit[];
}
const day = { sky: 0xdce7dd, ground: 0x73624c, ambient: 1.35, sun: 0xffecd0, power: 3.1, fog: 0xaebfa3, density: .007, exposure: 1.07 };
const streetDusk: SceneDefinition['light'] = {
  sky: 0x8e9bbc, ground: 0x3b3546, ambient: .9,
  sun: 0xf6a66f, power: .78, sunPosition: [-24, 7, 16],
  fog: 0x354153, density: .019, exposure: .98,
};
export const SCENES: Record<SceneId, SceneDefinition> = {
  street: {
    id: 'street', title: bi('纽约，街角', 'A corner of New York'), kicker: bi('第一幕 · 初到纽约', 'ACT I · ARRIVAL'), subtitle: bi('1776 · 一个名字尚未被记住的夏天', '1776 · A summer before the world knew his name'),
    intro: bi('沿石路寻找伯尔；酒馆门前可以进入下一处场景。', 'Find Burr along the cobblestones; the tavern entrance leads to the next scene.'),
    spawn: { x: 0, z: 5 }, camera: { yaw: .48, pitch: MIN_CAMERA_PITCH, radius: 25, min: 17, max: 35 }, light: streetDusk,
    points: [
      { id: 'burr', position: { x: -3.2, z: 1.5 }, title: bi('街口 · 相识', 'Crossroads · An introduction'), body: bi('伯尔站在街口，打量着往来的人。', 'Burr stands at the crossroads, watching the passersby.') },
      { id: 'tavern', position: { x: -8, z: -2.2 }, title: bi('酒馆 · 城市的声音', 'Tavern · Voices of the city'), body: bi('门内的杯盏声里，夹着关于独立的争论。', 'Between the clinking cups, voices argue about independence.') },
      { id: 'waterfront', position: { x: 13, z: 5 }, title: bi('水岸 · 新世界的入口', 'Waterfront · A door to the new world'), body: bi('船带来货物，也带来旧世界的消息。', 'Ships bring cargo, and news from the old world.') },
    ],
    exits: [{ id: 'tavern-door', position: { x: -8, z: -2.2 }, to: 'tavern', title: bi('进入酒馆', 'Enter the tavern') }],
  },
  tavern: {
    id: 'tavern', title: bi('酒馆，未熄的火', 'The tavern, a fire still burning'), kicker: bi('第二幕 · 革命的同伴', 'ACT II · COMPANY OF REVOLUTION'), subtitle: bi('1776 · 举杯之前，先交换一个念头', '1776 · Before a toast, an exchange of ideas'),
    intro: bi('绕过长桌，看看炉火、手稿与杯盏。靠近标记按 E 查看。', 'Walk among the tables, hearth and manuscripts. Press E near a marker to inspect.'),
    spawn: { x: 0, z: 6 }, camera: { yaw: .38, pitch: MIN_CAMERA_PITCH, radius: 21, min: 16, max: 28 },
    light: { sky: 0xe8c599, ground: 0x554138, ambient: 1.05, sun: 0xffcf90, power: 1.1, fog: 0x302a25, density: .008, exposure: 1.15 },
    points: [
      { id: 'companions', position: { x: 0, z: -.2 }, title: bi('长桌 · 同伴的席位', 'The long table · Seats for companions'), body: bi('四只杯子围着摊开的报纸。劳伦斯、拉法耶特与穆里根的座位还空着；这一桌将把各自的雄心，变成共同的行动。', 'Four cups surround an open newspaper. The seats of Laurens, Lafayette and Mulligan are still empty; around this table, separate ambitions will become a common cause.') },
      { id: 'hearth', position: { x: 6, z: -4 }, title: bi('炉火 · 城里的传闻', 'The hearth · Rumors in the city'), body: bi('柴火在砖炉里燃烧。港口封锁、军需短缺、独立的消息，都曾在这里被低声重复，再被带到街上。', 'Logs burn in the brick hearth. Word of blockades, shortages and independence has passed quietly through this room before reaching the streets.') },
      { id: 'manuscript', position: { x: 2, z: -4.7 }, title: bi('手稿 · 尚未发出的声音', 'The manuscript · A voice not yet heard'), body: bi('蜡烛照着未写完的段落。把激动写成一句能说服人的话，比高声喊出它更难。一页草稿，也许就是明天街头争论的开始。', 'A candle lights an unfinished paragraph. Turning conviction into a persuasive sentence is harder than shouting it. A draft on this desk may begin tomorrow’s argument in the streets.') },
    ],
    exits: [
      { id: 'street-door', position: { x: 0, z: 7.5 }, to: 'street', title: bi('回到纽约街角', 'Return to the New York street') },
      { id: 'square-door', position: { x: 8, z: 6 }, to: 'square', title: bi('前往辩论广场', 'Continue to the debate square') },
    ],
  },
  square: {
    id: 'square', title: bi('广场，众声之中', 'The square, among many voices'), kicker: bi('第三幕 · 公开辩论', 'ACT III · PUBLIC DEBATE'), subtitle: bi('1776 · 让一句话穿过整座广场', '1776 · Let a sentence carry across the square'),
    intro: bi('从印刷摊绕到讲台前，广场另一侧的路通往军营。', 'Explore the print stall and the speaking platform. A road on the far side leads to camp.'),
    spawn: { x: 0, z: 10 }, camera: { yaw: .55, pitch: MIN_CAMERA_PITCH, radius: 24, min: 20, max: 38 }, light: { ...day, sun: 0xffe0ae, fog: 0xc2baa0, power: 2.8 },
    points: [
      { id: 'platform', position: { x: 5, z: -2.2 }, title: bi('讲台 · 公开的立场', 'The platform · A public position'), body: bi('木台略高于人群的视线。支持者和反对者将从两侧聚拢：论点必须清楚，停顿也必须有分量。', 'The timber platform stands just above the crowd’s eye line. Supporters and opponents will gather on either side: arguments must be clear, and pauses must carry weight.') },
      { id: 'printing', position: { x: -8.5, z: 4 }, title: bi('印刷摊 · 纸上的战场', 'The print stall · A battlefield on paper'), body: bi('铅字、纸张与墨，把一个人的意见变成许多人手中的传单。街头的辩论在这里获得第二种声音。', 'Type, paper and ink turn one person’s opinion into leaflets carried by many. Here, a street debate acquires a second voice.') },
      { id: 'notices', position: { x: 6, z: 6 }, title: bi('告示板 · 人群将去向何处', 'The noticeboard · Where people will go'), body: bi('招募与集会的告示一层盖着一层。从这里向外走，城市的争论逐渐变成军营里的命令。', 'Recruitment and meeting notices overlap on the board. Beyond this square, the city’s arguments begin to become orders in a military camp.') },
    ],
    exits: [{ id: 'tavern-road', position: { x: 0, z: 12 }, to: 'tavern', title: bi('返回酒馆', 'Return to the tavern') }, { id: 'camp-road', position: { x: 12, z: 10 }, to: 'camp', title: bi('前往华盛顿军营', 'Continue to Washington’s camp') }],
  },
  camp: {
    id: 'camp', title: bi('军营，暮色下的命令', 'The camp, orders at dusk'), kicker: bi('第四幕 · 华盛顿的副官', 'ACT IV · WASHINGTON’S AIDE'), subtitle: bi('1777 · 墨水与火药之间', '1777 · Between ink and gunpowder'),
    intro: bi('沿营地通道查看指挥帐、补给和篝火，再前往约克镇。', 'Follow the camp paths to the command tent, supplies and fire, then continue to Yorktown.'),
    spawn: { x: 0, z: 11 }, camera: { yaw: .48, pitch: MIN_CAMERA_PITCH, radius: 28, min: 19, max: 38 },
    light: { sky: 0xd9bd98, ground: 0x655943, ambient: 1.2, sun: 0xffb972, power: 2.3, fog: 0xb29c7f, density: .012, exposure: 1.05 },
    points: [
      { id: 'command', position: { x: -7, z: -3.3 }, title: bi('指挥帐 · 一纸军令', 'The command tent · Orders on paper'), body: bi('地图被镇纸压住，路线停在烛光下。副官需要把将军的判断写成清晰的命令，让远处的部队也能准确执行。', 'Paperweights hold the map still, its routes caught in candlelight. An aide must turn the general’s judgment into clear orders that distant units can carry out precisely.') },
      { id: 'supplies', position: { x: -10, z: 2.8 }, title: bi('辎重 · 战线的另一端', 'Supplies · The other end of the line'), body: bi('车轮、粮桶与成排的木箱决定部队能走多远。每一次调动，都先是一道补给问题。', 'Wheels, provision barrels and rows of crates determine how far the army can move. Every maneuver begins as a question of supply.') },
      { id: 'campfire', position: { x: 4, z: 5.5 }, title: bi('篝火 · 等待天亮', 'The campfire · Waiting for dawn'), body: bi('帐篷之间留着一道暖光。信件从这里出发，也在这里被拆开；下一道命令到来之前，营地短暂地安静下来。', 'A warm glow remains between the tents. Letters leave from here and are opened here; before the next orders arrive, the camp briefly falls quiet.') },
    ],
    exits: [{ id: 'square-road', position: { x: 0, z: 13 }, to: 'square', title: bi('返回辩论广场', 'Return to the debate square') }, { id: 'yorktown-road', position: { x: 12, z: 10 }, to: 'yorktown', title: bi('前往约克镇', 'Continue to Yorktown') }],
  },
  yorktown: {
    id: 'yorktown', title: bi('约克镇，夜色中的突破口', 'Yorktown, an opening in the night'), kicker: bi('第五幕 · 最后的冲锋', 'ACT V · THE FINAL ASSAULT'), subtitle: bi('1781 · 越过工事，走向黎明', '1781 · Beyond the earthworks, toward dawn'),
    intro: bi('沿战壕穿过炮位与工事缺口。中央通道可以进入堡垒内侧。', 'Follow the trench past the battery and through the earthworks. The central passage reaches the inner redoubt.'),
    spawn: { x: 0, z: 13 }, camera: { yaw: .48, pitch: MIN_CAMERA_PITCH, radius: 29.5, min: 20, max: 39 },
    light: { sky: 0xa8bdd4, ground: 0x39443f, ambient: 1.4, sun: 0xb2c9ed, power: 2, fog: 0x424f5c, density: .013, exposure: 1.15 },
    points: [
      { id: 'assembly', position: { x: 0, z: 8 }, title: bi('集结处 · 屏息等待', 'The assembly point · Holding a breath'), body: bi('队伍将在这里压低声音，等待出击的信号。前方的两道通路把掩体、炮位与堡垒连接起来。', 'The troops will gather here in hushed voices, waiting for the signal. Two routes ahead connect cover, batteries and the redoubt.') },
      { id: 'battery', position: { x: -8, z: 1 }, title: bi('炮位 · 火光后的间隙', 'The battery · A pause after the flash'), body: bi('炮轮陷在泥里，弹药堆在手边。炮声之间的短暂间隙，决定何时能够离开掩体。', 'Gun wheels sink into the mud, ammunition stacked within reach. The brief intervals between shots determine when it is possible to leave cover.') },
      { id: 'redoubt', position: { x: 0, z: -9 }, title: bi('堡垒内侧 · 突破之后', 'Inside the redoubt · After the breach'), body: bi('木桩与土墙不再挡住前路。从集结处到这里，路线已贯通；胜负将取决于每一步能否与同伴的行动一致。', 'Timber stakes and earth walls no longer block the way. The route from the assembly point is open; success will depend on each step matching the actions of others.') },
    ],
    exits: [{ id: 'camp-road', position: { x: 0, z: 15 }, to: 'camp', title: bi('返回华盛顿军营', 'Return to Washington’s camp') }],
  },
};

export function sceneId(value: string | null): SceneId { return SCENE_IDS.includes(value as SceneId) ? value as SceneId : 'street'; }
export async function createWorld(id: SceneId): Promise<SceneWorld> {
  if (id === 'street') { const world = new StreetWorld(); await world.addFoliage(); return world; }
  return id === 'tavern' ? new TavernWorld() : id === 'square' ? new SquareWorld() : id === 'camp' ? new CampWorld() : new YorktownWorld();
}
