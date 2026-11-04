import { bi, type BiText } from '../i18n/text';
import type { Point } from '../demo3d/Navigation';

export const EXPERIENCE_IDS = ['street', 'tavern', 'ballroom'] as const;
export type ExperienceId = typeof EXPERIENCE_IDS[number];
export type RelicShape = 'book' | 'seal' | 'scissors' | 'token' | 'letter' | 'ribbon' | 'thimble' | 'quill' | 'fan' | 'locket' | 'card' | 'button';
export interface Relic {
  id: string; scene: ExperienceId; name: BiText; owner: BiText; text: BiText;
  shape: RelicShape; color: number; position: Point; height: number; stand: Point;
  /** Authored hooks only: no ending or branch is resolved by the review page. */
  storyTags: readonly string[];
}
export interface Place { id: string; name: BiText; position: Point }
export const EXPERIENCE: Record<ExperienceId, { name: BiText; subtitle: BiText; spawn: Point; bounds: { width: number; depth: number }; places: Place[] }> = {
  street: { name: bi('纽约 · 未完的街道', 'New York · Unfinished streets'), subtitle: bi('穿过店门，走进这座城的日常。', 'Through an open door, into the life of the city.'), spawn: { x: 0, z: 10 }, bounds: { width: 64, depth: 50 }, places: [
    { id: 'print', name: bi('印刷店', 'Print shop'), position: { x: -16, z: -6 } },
    { id: 'cloth', name: bi('布料铺', 'Cloth shop'), position: { x: 5, z: -8 } },
    { id: 'warehouse', name: bi('港口仓库', 'Harbor warehouse'), position: { x: 22, z: 14 } },
    { id: 'market', name: bi('街角集市', 'Corner market'), position: { x: -16, z: 13 } },
  ] },
  tavern: { name: bi('酒馆 · 同一张桌子', 'Tavern · At the same table'), subtitle: bi('前厅的喧闹，后室的秘密。', 'A noisy room. A quieter story behind it.'), spawn: { x: 0, z: 10 }, bounds: { width: 40, depth: 32 }, places: [
    { id: 'table', name: bi('同伴长桌', 'Companions’ table'), position: { x: -2, z: 3 } },
    { id: 'cellar', name: bi('储酒间', 'Wine store'), position: { x: -10, z: -9 } },
    { id: 'study', name: bi('后室书桌', 'Back-room desk'), position: { x: 10, z: -9 } },
    { id: 'floor', name: bi('演出空地', 'Open performance floor'), position: { x: 10, z: 1 } },
  ] },
  ballroom: { name: bi('舞会 · 在灯光之间', 'Ballroom · Between the lights'), subtitle: bi('让出一片空地，容下一次相遇。', 'A space in the crowd for two people to meet.'), spawn: { x: 0, z: 14 }, bounds: { width: 48, depth: 38 }, places: [
    { id: 'dance', name: bi('中央舞池', 'Central dance floor'), position: { x: 0, z: 0 } },
    { id: 'salon', name: bi('西侧会客室', 'West salon'), position: { x: -14, z: -13.5 } },
    { id: 'dressing', name: bi('东侧准备室', 'East dressing room'), position: { x: 14, z: -13.5 } },
    { id: 'guests', name: bi('宾客侧廊', 'Guest aisle'), position: { x: -17, z: 5 } },
  ] },
};

export const RELICS: readonly Relic[] = [
  { id: 'street-hamilton-notebook', scene: 'street', shape: 'book', color: 0x34464c, name: bi('写到页边的账簿', 'The ledger with no margins'), owner: bi('亚历山大·汉密尔顿', 'Alexander Hamilton'), position: { x: -18, z: -10 }, height: 1.23, stand: { x: -18, z: -8.3 }, storyTags: ['hamilton:ambition', 'printing:promise'], text: bi('货价写在中间，句子挤在四周。他说纸太贵；印刷工却发现，空白越少，他想说的话越多。最后一页留着一个未填的收件人。', 'Prices occupy the middle; sentences crowd the edges. He says paper is expensive. The printer notices that the less space remains, the more he has to say. On the last page, a recipient’s name is still missing.') },
  { id: 'street-burr-seal', scene: 'street', shape: 'seal', color: 0x934434, name: bi('没有落下的封印', 'The unused seal'), owner: bi('阿伦·伯尔', 'Aaron Burr'), position: { x: 7, z: -14 }, height: 1.23, stand: { x: 7, z: -12.3 }, storyTags: ['burr:restraint', 'letter:unsent'], text: bi('一封信折得整齐，封蜡却没有按下去。伯尔把印章放在一旁，像给尚未出口的话留一条退路。信封上没有地址。', 'The letter is neatly folded, but its wax is untouched. Burr has set the seal aside, leaving his unwritten decision a way back. There is no address on the envelope.') },
  { id: 'street-mulligan-scissors', scene: 'street', shape: 'scissors', color: 0xbca47b, name: bi('裁缝的另一把剪刀', 'The tailor’s other scissors'), owner: bi('赫丘利·穆里根', 'Hercules Mulligan'), position: { x: 0, z: -7 }, height: 1.23, stand: { x: 1.6, z: -7 }, storyTags: ['mulligan:network', 'city:trust'], text: bi('剪刀压住一条量过两遍的缎带。纸上只记了衣长，没有客人的名字。穆里根说，有些人更在意衣服是否合身，有些人更在意谁记住了他们。', 'The scissors weigh down a ribbon measured twice. The note records a length, but no customer’s name. Mulligan says some people care about the fit; others care about who remembers them.') },
  { id: 'street-laurens-token', scene: 'street', shape: 'token', color: 0xac7844, name: bi('退回的货签', 'The returned cargo token'), owner: bi('约翰·劳伦斯', 'John Laurens'), position: { x: 24, z: 7 }, height: 1.23, stand: { x: 22.3, z: 7 }, storyTags: ['laurens:justice', 'harbor:witness'], text: bi('木牌背后划掉了一个编号，换成一个人的名字。没人肯收回这块货签。劳伦斯仍把它留下，像留下一句还没有得到回答的问题。', 'A number has been scratched out on the back and replaced with a person’s name. No one will take the token back. Laurens keeps it, like a question still waiting for an answer.') },
  { id: 'tavern-laurens-letter', scene: 'tavern', shape: 'letter', color: 0xe6d0a4, name: bi('折了三次的家书', 'A letter folded three times'), owner: bi('约翰·劳伦斯', 'John Laurens'), position: { x: -10, z: -12 }, height: 1.23, stand: { x: -10, z: -10.3 }, storyTags: ['laurens:family', 'companions:promise'], text: bi('开头谈天气，后来忽然谈到勇气。最激烈的一行被划去了，纸背却留着笔尖压出的痕。收信的人会看见哪一面？', 'It begins with the weather and turns abruptly to courage. The fiercest line is crossed out, but the pressure of the pen remains on the reverse. Which side will its reader see?') },
  { id: 'tavern-lafayette-ribbon', scene: 'tavern', shape: 'ribbon', color: 0x53799f, name: bi('跨海的蓝缎带', 'A blue ribbon across the sea'), owner: bi('拉法耶特', 'Lafayette'), position: { x: -3, z: 0 }, height: 1.23, stand: { x: -3, z: 2.2 }, storyTags: ['lafayette:belonging', 'companions:promise'], text: bi('缎带被系在杯柄上，结法一看就不是本地习惯。他教了同伴两次，第三次索性笑着替他们系好。今晚，远方似乎没有那么远。', 'The ribbon is tied around a mug in an unfamiliar knot. He teaches his friends twice, then laughs and ties it for them. Tonight, the far side of the ocean feels a little closer.') },
  { id: 'tavern-mulligan-thimble', scene: 'tavern', shape: 'thimble', color: 0xb4a78e, name: bi('磨亮的顶针', 'The polished thimble'), owner: bi('赫丘利·穆里根', 'Hercules Mulligan'), position: { x: -15, z: 1 }, height: 1.53, stand: { x: -12.8, z: 1 }, storyTags: ['mulligan:care', 'companions:repair'], text: bi('同伴的袖口破了，顶针便留在酒杯旁。穆里根一边听他们争论，一边把裂口收拢。有些承诺不用举杯，也已经做下了。', 'A friend’s cuff is torn, so the thimble rests beside a glass. Mulligan listens to the argument while closing the seam. Some promises are kept without a toast.') },
  { id: 'tavern-hamilton-quill', scene: 'tavern', shape: 'quill', color: 0xe7d2a0, name: bi('不肯停下的羽笔', 'The restless quill'), owner: bi('亚历山大·汉密尔顿', 'Alexander Hamilton'), position: { x: 10, z: -12 }, height: 1.23, stand: { x: 10, z: -10.3 }, storyTags: ['hamilton:voice', 'printing:promise'], text: bi('羽笔的尖端已经分叉，墨瓶却还满着。他在一张酒账的背面写下第一句，又停住了：这一回，要把谁的声音写进去？', 'The nib has split, but the inkwell is full. He writes a first sentence on the back of a tavern bill, then pauses. Whose voice belongs on this page?') },
  { id: 'ballroom-angelica-fan', scene: 'ballroom', shape: 'fan', color: 0xb98668, name: bi('扇骨间的批注', 'Notes between the fan ribs'), owner: bi('安吉莉卡·斯凯勒', 'Angelica Schuyler'), position: { x: -14, z: -16 }, height: 1.23, stand: { x: -14, z: -14.3 }, storyTags: ['angelica:insight', 'ballroom:unspoken'], text: bi('扇面只画了花，扇骨内侧却有一行极小的字。她听见一句聪明话，记下的却是说话人停顿的地方。', 'Flowers cover the fan; a tiny line of writing hides inside its ribs. She has heard something clever, but records the place where its speaker hesitated.') },
  { id: 'ballroom-eliza-locket', scene: 'ballroom', shape: 'locket', color: 0x7cabb7, name: bi('尚未放入肖像的坠盒', 'A locket awaiting a portrait'), owner: bi('伊丽莎·斯凯勒', 'Eliza Schuyler'), position: { x: 14, z: -16 }, height: 1.23, stand: { x: 14, z: -14.3 }, storyTags: ['eliza:memory', 'family:keepsake'], text: bi('坠盒里没有肖像，只有一小块浅蓝布。伊丽莎把它合上时没有许愿。她想先记住，今天灯光落在谁的肩上。', 'There is no portrait inside, only a small piece of pale blue cloth. Eliza closes it without making a wish. First, she wants to remember whose shoulders caught the light tonight.') },
  { id: 'ballroom-burr-card', scene: 'ballroom', shape: 'card', color: 0xd6bf92, name: bi('留白的舞会名单', 'The dance list with a blank'), owner: bi('阿伦·伯尔', 'Aaron Burr'), position: { x: -20, z: 5 }, height: 1.23, stand: { x: -18.3, z: 5 }, storyTags: ['burr:opportunity', 'ballroom:unspoken'], text: bi('名字排得很整齐，最后一个位置仍然空着。他说还没决定把时间留给谁。也许他只是想知道，谁会先来问。', 'The names form a neat column, with one space still empty. He says he has not decided whom to save the time for. Perhaps he is waiting to see who asks first.') },
  { id: 'ballroom-hamilton-button', scene: 'ballroom', shape: 'button', color: 0xc0a469, name: bi('重新缝上的铜扣', 'The brass button sewn back on'), owner: bi('亚历山大·汉密尔顿', 'Alexander Hamilton'), position: { x: 20, z: 7 }, height: 1.23, stand: { x: 18.3, z: 7 }, storyTags: ['hamilton:vulnerability', 'family:keepsake'], text: bi('线的颜色和外套并不相配，针脚却很牢。这个晚上，他准备了许多漂亮的话，最后最先被注意到的，是一枚差点掉下来的扣子。', 'The thread does not match the coat, but the stitches hold. He prepared so many beautiful things to say tonight. What someone notices first is a button that nearly fell off.') },
];

export function experienceId(value: string | null): ExperienceId { return EXPERIENCE_IDS.includes(value as ExperienceId) ? value as ExperienceId : 'street'; }
