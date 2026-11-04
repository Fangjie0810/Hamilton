import { bi } from '../i18n/text';
import type { CharacterId, DialogueLine } from './types';
import type { GameState } from '../core/GameState';
import { newspaperReturned } from './inventory';

export type SmallTalkCharacter = Exclude<CharacterId, 'hamilton' | 'narrator'>;

/** Ordinary remarks never modify choices or award rewards. */
export const smallTalk: Record<SmallTalkCharacter, DialogueLine> = {
  newsboy: { speaker: 'newsboy', text: bi('报纸被风吹走了好多页，这下赚不到钱了......', 'The wind blew away so many pages. Now I will not earn any money......') },
  citizen: { speaker: 'citizen', text: bi('码头的风总能钻进袖口里。', 'The wind off the harbor always finds its way up my sleeves.') },
  loyalist: { speaker: 'loyalist', text: bi('我刚把纸理齐，风又把它们吹乱了。', 'I had just put my papers in order, and the wind scattered them again.') },
  burr: { speaker: 'burr', text: bi('难得有一会儿安静。让我把这杯茶喝完。', 'A quiet moment at last. Let me finish this cup of tea.') },
  laurens: { speaker: 'laurens', text: bi('这张桌子有点晃。也许垫一张折好的纸就行。', 'This table wobbles a little. A folded piece of paper might do the trick.') },
  lafayette: { speaker: 'lafayette', text: bi('这里的面包很硬，不过蘸进汤里就好多了。', 'The bread here is rather hard, but it is much better dipped in soup.') },
  mulligan: { speaker: 'mulligan', text: bi('袖口松了线就来找我，别等它整片掉下来。', 'Come see me if your cuff comes loose. Do not wait for the whole thing to fall off.') },
  washington: { speaker: 'washington', text: bi('咖啡又凉了。这里的杯子似乎从来留不住热气。', 'The coffee has gone cold again. These cups never seem to hold their warmth.') },
};

export const newsboyThanks: DialogueLine = {
  speaker: 'newsboy', text: bi('谢谢您先生！我会记住您的名字', 'Thank you, sir! I will remember your name'),
};

export function smallTalkLine(character: SmallTalkCharacter, state: GameState): DialogueLine {
  return character === 'newsboy' && newspaperReturned(state) ? newsboyThanks : smallTalk[character];
}
