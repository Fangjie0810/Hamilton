import type { ExperienceId } from './data';

export const SCENE_LIGHTING: Record<ExperienceId,{
  background:number;fog:number;sky:number;ground:number;ambient:number;
  key:number;keyIntensity:number;exposure:number;
}> = {
  street:{background:0x0b111d,fog:.018,sky:0x7892b7,ground:0x1b201c,ambient:.50,key:0x7b97c9,keyIntensity:.50,exposure:1.08},
  tavern:{background:0x100d0b,fog:.020,sky:0x9c8873,ground:0x29170e,ambient:.68,key:0xbb9572,keyIntensity:.45,exposure:1.10},
  ballroom:{background:0x101a32,fog:.016,sky:0x8cacec,ground:0x263655,ambient:.72,key:0x719df6,keyIntensity:1.0,exposure:1.08},
};
