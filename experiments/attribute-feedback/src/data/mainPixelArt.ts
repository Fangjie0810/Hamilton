import type { CharacterId } from './types';

export type PortraitPose = 'assertive' | 'reflect' | 'approve' | 'concern' | 'command' | 'calm' | 'challenge' | 'amused' | 'write' | 'turn';
export interface DialoguePerformance { speaking: PortraitPose; settled: PortraitPose; listener: PortraitPose; emphasis: boolean }
export interface MainPixelArt {
  path: string; columns: number; rows: number; frameCount: number; facing: 'left' | 'right'; key: string;
  frameOverscan?: number;
  poses: Partial<Record<PortraitPose, number>>; talkFrames: readonly [number, number, number]; defaultPose: PortraitPose; listenPose: PortraitPose;
}
/** Authored dialogue art, separate from the in-world chibi character atlases. */
export const MAIN_PIXEL_ART: Record<CharacterId, MainPixelArt> = {
  "hamilton": {
    "frameOverscan": 20,
    "columns": 4,
    "rows": 2,
    "frameCount": 8,
    "facing": "right",
    "poses": {
      "assertive": 0,
      "reflect": 3,
      "approve": 4,
      "concern": 5,
      "command": 6,
      "calm": 7
    },
    "talkFrames": [
      0,
      1,
      2
    ],
    "defaultPose": "assertive",
    "listenPose": "calm",
    "key": "#00ff00",
    "path": "/art/main-pixel/v1/hamilton.png"
  },
  "burr": {
    "columns": 4,
    "rows": 2,
    "frameCount": 7,
    "facing": "right",
    "poses": {
      "calm": 0,
      "reflect": 3,
      "approve": 4,
      "concern": 5,
      "challenge": 6
    },
    "talkFrames": [
      0,
      1,
      2
    ],
    "defaultPose": "calm",
    "listenPose": "calm",
    "key": "#00ff00",
    "path": "/art/main-pixel/v1/burr.png"
  },
  "washington": {
    "columns": 4,
    "rows": 2,
    "frameCount": 7,
    "facing": "right",
    "poses": {
      "calm": 0,
      "command": 3,
      "approve": 4,
      "concern": 5,
      "reflect": 6
    },
    "talkFrames": [
      0,
      1,
      2
    ],
    "defaultPose": "calm",
    "listenPose": "calm",
    "key": "#00ff00",
    "path": "/art/main-pixel/v1/washington.png"
  },
  "laurens": {
    "columns": 3,
    "rows": 2,
    "frameCount": 6,
    "facing": "right",
    "poses": {
      "assertive": 0,
      "concern": 3,
      "approve": 4,
      "calm": 5
    },
    "talkFrames": [
      0,
      1,
      2
    ],
    "defaultPose": "assertive",
    "listenPose": "calm",
    "key": "#00ff00",
    "path": "/art/main-pixel/v1/laurens.png"
  },
  "lafayette": {
    "frameOverscan": 24,
    "columns": 4,
    "rows": 2,
    "frameCount": 7,
    "facing": "left",
    "poses": {
      "assertive": 0,
      "reflect": 3,
      "approve": 4,
      "calm": 5,
      "amused": 6
    },
    "talkFrames": [
      0,
      1,
      2
    ],
    "defaultPose": "assertive",
    "listenPose": "calm",
    "key": "#00ff00",
    "path": "/art/main-pixel/v1/lafayette.png"
  },
  "mulligan": {
    "columns": 3,
    "rows": 2,
    "frameCount": 6,
    "facing": "right",
    "poses": {
      "assertive": 0,
      "approve": 3,
      "concern": 4,
      "calm": 5
    },
    "talkFrames": [
      0,
      1,
      2
    ],
    "defaultPose": "assertive",
    "listenPose": "calm",
    "key": "#00ff00",
    "path": "/art/main-pixel/v1/mulligan.png"
  },
  "loyalist": {
    "columns": 3,
    "rows": 2,
    "frameCount": 5,
    "facing": "right",
    "poses": {
      "assertive": 0,
      "challenge": 3,
      "calm": 4
    },
    "talkFrames": [
      0,
      1,
      2
    ],
    "defaultPose": "assertive",
    "listenPose": "challenge",
    "key": "#00ff00",
    "path": "/art/main-pixel/v1/loyalist.png"
  },
  "newsboy": {
    "columns": 3,
    "rows": 2,
    "frameCount": 5,
    "facing": "left",
    "poses": {
      "assertive": 0,
      "approve": 3,
      "calm": 4
    },
    "talkFrames": [
      0,
      1,
      2
    ],
    "defaultPose": "assertive",
    "listenPose": "calm",
    "key": "#00ff00",
    "path": "/art/main-pixel/v1/newsboy.png"
  },
  "citizen": {
    "columns": 3,
    "rows": 2,
    "frameCount": 5,
    "facing": "right",
    "poses": {
      "concern": 0,
      "approve": 3,
      "calm": 4
    },
    "talkFrames": [
      0,
      1,
      2
    ],
    "defaultPose": "concern",
    "listenPose": "calm",
    "key": "#00ff00",
    "path": "/art/main-pixel/v1/citizen.png"
  },
  "narrator": {
    "frameOverscan": 24,
    "columns": 3,
    "rows": 1,
    "frameCount": 3,
    "facing": "right",
    "poses": {
      "write": 0,
      "reflect": 1,
      "turn": 2
    },
    "talkFrames": [
      0,
      1,
      2
    ],
    "defaultPose": "write",
    "listenPose": "reflect",
    "key": "#00ff00",
    "path": "/art/main-pixel/v1/narrator.png"
  }
};

export const MAIN_PIXEL_FRAME_COUNT = Object.values(MAIN_PIXEL_ART).reduce((total, art) => total + art.frameCount, 0);
