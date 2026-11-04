import type { GameState } from '../core/GameState';
import type { GrowthAttributeId } from '../data/growth';
import {
  COMPASS_CENTER as CENTER, COMPASS_INNER_RADIUS as INNER, COMPASS_OUTER_RADIUS as OUTER,
  COMPASS_SECTORS, compassPoint, compassProgressRadius, compassSector, relationshipSplit,
} from './CompassGeometry';

type Attributes = Record<string, string | number>;
type CompassState = Pick<GameState, GrowthAttributeId>;
type OuterStat = typeof COMPASS_SECTORS[number]['key'];
type GradientStop = [offset: string | number, color: string, opacity?: number];

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Attributes = {}): SVGElementTagNameMap[K] {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  return node;
}

interface OuterPart {
  group: SVGGElement;
  surface: SVGPathElement;
  progress: SVGGElement;
  fill: SVGPathElement;
  lip: SVGPathElement;
  lipShadow: SVGPathElement;
  hatching: SVGPathElement;
  bands: SVGGElement;
  icon: SVGGElement;
  iconPath: SVGPathElement;
  value: SVGTextElement;
  start: number;
  end: number;
}

const icons: Record<OuterStat, string> = {
  momentum: 'M0-6 4 0 1-1v7h-2v-7l-3 1Z',
  influence: 'm-6 4 1-8 4 4 2-6 2 6 4-4 1 8ZM-5 6H5',
  washingtonTrust: 'M0-6 6-3 5 3 0 7-5 3-6-3ZM-2 0l2 2 3-4',
};
const lockIcon = 'M-3-2v-2a3 3 0 0 1 6 0v2M-5-2H5v8H-5ZM0 1v2';
const positions: Record<OuterStat, { x: number; y: number; ix: number; iy: number }> = {
  momentum: { x: 120, y: 43, ix: 120, iy: 25 },
  influence: { x: 188, y: 166, ix: 188, iy: 145 },
  washingtonTrust: { x: 52, y: 166, ix: 52, iy: 145 },
};

/** The approved C study, kept as persistent SVG nodes so updates never replace focus targets. */
export class CampaignCompass {
  readonly element = svg('svg', { viewBox: '0 0 240 240', class: 's3-campaign-compass' });
  readonly parts: ReadonlyMap<GrowthAttributeId, SVGGElement>;
  private readonly interactiveParts = new Map<GrowthAttributeId, SVGGElement>();
  private readonly outerParts = new Map<OuterStat, OuterPart>();
  private readonly values = new Map<GrowthAttributeId, SVGTextElement>();
  private readonly defs = svg('defs');
  private readonly upperClip = svg('rect', { x: 68, y: 68, width: 104, height: 52 });
  private readonly lowerClip = svg('rect', { x: 68, y: 120, width: 104, height: 52 });
  private readonly seam = svg('path', { stroke: '#10221e', 'stroke-width': 1.5, 'pointer-events': 'none' });
  private readonly seamLight = svg('path', { stroke: '#c2d0c7', 'stroke-opacity': .5, 'stroke-width': .65, 'pointer-events': 'none' });

  constructor(private readonly uid: string) {
    this.parts = this.interactiveParts;
    this.buildMaterials();
    this.clip('core', svg('circle', { cx: CENTER, cy: CENTER, r: INNER }));
    this.clip('upper', this.upperClip);
    this.clip('lower', this.lowerClip);
    this.element.append(this.defs);
    for (const { key, start, end } of COMPASS_SECTORS) this.buildOuter(key, start, end);
    this.buildCenter();
    this.buildEdges();
    this.update({ momentum: 0, influence: 0, washingtonTrust: 0, burrRivalry: 0, burrRespect: 0 }, true);
  }

  private id(name: string) { return `${this.uid}-tactical-${name}`; }
  private url(name: string) { return `url(#${this.id(name)})`; }

  private clip(name: string, shape: SVGElement) {
    const clip = svg('clipPath', { id: this.id(name) });
    clip.append(shape);
    this.defs.append(clip);
  }

  private gradient(tag: 'radialGradient' | 'linearGradient', name: string, attributes: Attributes, stops: GradientStop[]) {
    const gradient = svg(tag, { id: this.id(name), ...attributes });
    for (const [offset, color, opacity] of stops) {
      const stop = svg('stop', { offset, 'stop-color': color });
      if (opacity !== undefined) stop.setAttribute('stop-opacity', String(opacity));
      gradient.append(stop);
    }
    this.defs.append(gradient);
  }

  private buildMaterials() {
    this.gradient('radialGradient', 'recess', { cx: '34%', cy: '24%', r: '90%' }, [[0, '#e4eced', .41], [.58, '#c0cbd0', .34], [1, '#71827f', .4]]);
    this.gradient('radialGradient', 'locked', { cx: '32%', cy: '20%', r: '100%' }, [[0, '#666e72'], [.6, '#41494d'], [1, '#222a2d']]);
    const pattern = svg('pattern', { id: this.id('hatching'), patternUnits: 'userSpaceOnUse', width: 7, height: 7, patternTransform: 'rotate(35)' });
    pattern.append(svg('path', { d: 'M0 0V7', stroke: '#171e20', 'stroke-width': 1.6 }), svg('path', { d: 'M2 0V7', stroke: '#b6bfc1', 'stroke-width': .55, 'stroke-opacity': .3 }));
    this.defs.append(pattern);
    const radial = { cx: CENTER, cy: CENTER, r: OUTER, gradientUnits: 'userSpaceOnUse' };
    this.gradient('radialGradient', 'momentum', radial, [[.45, '#856019'], [.62, '#c39c30'], [.88, '#dfbf50'], [1, '#f3d16d']]);
    this.gradient('linearGradient', 'momentum-lip', { x1: 0, y1: 0, x2: .7, y2: 1 }, [[0, '#fff5b1'], [1, '#b78e2d']]);
    this.gradient('radialGradient', 'influence', radial, [[.45, '#050607'], [.65, '#15191b'], [.87, '#2b3135'], [1, '#121719']]);
    this.gradient('linearGradient', 'influence-lip', { x1: 0, y1: 0, x2: 1, y2: 1 }, [[0, '#b2bec3'], [.5, '#718087'], [1, '#39474d']]);
    this.gradient('radialGradient', 'washingtonTrust', radial, [[.45, '#0a2922'], [.68, '#124338'], [.9, '#246650'], [1, '#174d3e']]);
    this.gradient('linearGradient', 'washingtonTrust-lip', { x1: 0, y1: 0, x2: 1, y2: 1 }, [[0, '#a0d0a5'], [1, '#3b8061']]);
    this.gradient('linearGradient', 'forged-edge', { x1: .14, y1: 0, x2: .86, y2: 1 }, [[0, '#d5c493'], [.17, '#717465'], [.45, '#2b3831'], [.71, '#101a15'], [.87, '#4b5b4b'], [1, '#17211a']]);
    this.gradient('radialGradient', 'red', { cx: '28%', cy: '18%', r: '90%' }, [[0, '#d0715b'], [.46, '#a4453a'], [1, '#56241f']]);
    this.gradient('radialGradient', 'blue', { cx: '27%', cy: '15%', r: '100%' }, [[0, '#789ea9'], [.44, '#456d80'], [1, '#193b50']]);
    this.gradient('radialGradient', 'core-relief', { cx: '43%', cy: '37%', r: '65%' }, [[.55, '#06100c', 0], [.87, '#06100c', .09], [1, '#06100c', .58]]);
  }

  private part(stat: GrowthAttributeId) {
    const group = svg('g', { class: 's3-compass-part', 'data-stat': stat, role: 'button', tabindex: 0 });
    this.interactiveParts.set(stat, group);
    return group;
  }

  private value(x: number, y: number, size: number, fill: string) {
    return svg('text', {
      x, y, 'text-anchor': 'middle', 'dominant-baseline': 'middle', fill, stroke: '#151b18',
      'stroke-width': 3.2, 'paint-order': 'stroke fill', 'font-size': size, 'font-weight': 800,
      'font-family': "Georgia, 'Times New Roman', serif", 'pointer-events': 'none',
      style: 'font-variant-numeric:tabular-nums',
    });
  }

  private buildOuter(key: OuterStat, start: number, end: number) {
    const { x, y, ix, iy } = positions[key];
    const shape = compassSector(INNER, OUTER, start, end);
    this.clip(`sector-${key}`, svg('path', { d: shape }));
    const group = this.part(key);
    const surface = svg('path', { class: 'part-surface', d: shape, fill: this.url('recess'), 'pointer-events': 'all' });
    const progress = svg('g', { 'pointer-events': 'none' });
    const fill = svg('path', { fill: this.url(key) });
    const lip = svg('path', { fill: this.url(`${key}-lip`), opacity: .88 });
    const lipShadow = svg('path', { fill: '#0b100c', opacity: .2 });
    progress.append(fill, lip, lipShadow);
    const hatching = svg('path', { d: shape, fill: this.url('hatching'), opacity: .62, 'pointer-events': 'none' });
    const bands = svg('g', { 'clip-path': this.url(`sector-${key}`), 'pointer-events': 'none' });
    for (const radius of [66, 81, 95]) bands.append(svg('circle', { cx: CENTER, cy: CENTER, r: radius, fill: 'none', stroke: '#e8eef0', 'stroke-opacity': .095, 'stroke-width': .8 }));
    const hover = svg('path', { class: 'part-hover', d: shape, fill: '#fff8db', opacity: 0, 'pointer-events': 'none' });
    const icon = svg('g', { transform: `translate(${ix} ${iy})`, fill: 'none', stroke: '#f3e4bf', 'stroke-width': 1.45, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: .95, 'pointer-events': 'none' });
    const iconPath = svg('path', { d: icons[key] });
    icon.append(iconPath);
    const value = this.value(x, y, 26, '#fff3d4');
    group.append(surface, progress, hatching, bands, hover, icon, value);
    this.element.append(group);
    this.values.set(key, value);
    this.outerParts.set(key, { group, surface, progress, fill, lip, lipShadow, hatching, bands, icon, iconPath, value, start, end });
  }

  private buildCenter() {
    const center = svg('g', { 'clip-path': this.url('core') });
    for (const [key, color, half, highlight, textColor] of [
      ['burrRivalry', 'red', 'upper', '#fff0d2', '#fff0de'],
      ['burrRespect', 'blue', 'lower', '#e7f4ff', '#eaf7f5'],
    ] as const) {
      const group = this.part(key);
      group.setAttribute('clip-path', this.url(half));
      const surface = svg('circle', { class: 'part-surface', cx: CENTER, cy: CENTER, r: INNER, fill: this.url(color), 'pointer-events': 'all' });
      const hover = svg('circle', { class: 'part-hover', cx: CENTER, cy: CENTER, r: INNER, fill: highlight, opacity: 0, 'pointer-events': 'none' });
      const value = this.value(CENTER, CENTER, 24, textColor);
      group.append(surface, hover, value);
      center.append(group);
      this.values.set(key, value);
    }
    center.append(this.seam, this.seamLight, svg('circle', { cx: CENTER, cy: CENTER, r: INNER, fill: this.url('core-relief'), 'pointer-events': 'none' }));
    this.element.append(center);
  }

  private buildEdges() {
    const edges = svg('g', { 'pointer-events': 'none' });
    for (const { start } of COMPASS_SECTORS) {
      const a = compassPoint(INNER, start), b = compassPoint(OUTER, start);
      edges.append(svg('path', { d: `M${a.x} ${a.y}L${b.x} ${b.y}`, stroke: '#131b16', 'stroke-width': 1.25, 'stroke-opacity': .92 }));
    }
    const circle = (radius: number, attributes: Attributes) => svg('circle', { cx: CENTER, cy: CENTER, r: radius, fill: 'none', ...attributes });
    edges.append(
      circle(INNER, { stroke: '#10221a', 'stroke-width': 1.35 }),
      circle(51.2, { stroke: '#e3d5ad', 'stroke-opacity': .26, 'stroke-width': .65 }),
      circle(OUTER, { stroke: '#09130d', 'stroke-width': 4 }),
      circle(OUTER, { stroke: this.url('forged-edge'), 'stroke-width': 3 }),
      circle(105.7, { stroke: '#edf1ce', 'stroke-opacity': .36, 'stroke-width': .7 }),
    );
    for (const { start } of COMPASS_SECTORS) {
      const p = compassPoint(OUTER, start);
      edges.append(
        svg('circle', { cx: p.x, cy: p.y, r: 2.6, fill: '#4d5846', stroke: '#19261b', 'stroke-width': .7 }),
        svg('path', { d: `M${p.x - .8} ${p.y - .8}l1.6 1.6`, stroke: '#c8be94', 'stroke-opacity': .76, 'stroke-width': .6 }),
      );
    }
    this.element.append(edges);
  }

  update(state: CompassState, locked: boolean): number {
    for (const [key, part] of this.outerParts) {
      const isLocked = key === 'washingtonTrust' && locked;
      const radius = isLocked ? INNER : compassProgressRadius(state[key]);
      part.group.dataset.radius = String(radius);
      part.group.dataset.locked = String(isLocked);
      part.surface.setAttribute('fill', this.url(isLocked ? 'locked' : 'recess'));
      part.progress.setAttribute('display', isLocked ? 'none' : 'inline');
      part.hatching.setAttribute('display', isLocked ? 'inline' : 'none');
      part.bands.setAttribute('display', isLocked ? 'none' : 'inline');
      part.fill.setAttribute('d', compassSector(INNER, radius, part.start, part.end));
      part.lip.setAttribute('d', compassSector(Math.max(INNER, radius - 2.3), radius, part.start, part.end));
      part.lipShadow.setAttribute('d', compassSector(Math.max(INNER, radius - 4), Math.max(INNER, radius - 2.5), part.start, part.end));
      part.iconPath.setAttribute('d', isLocked ? lockIcon : icons[key]);
      part.icon.setAttribute('stroke', isLocked ? '#cbd1d2' : '#f3e4bf');
      part.value.setAttribute('fill', isLocked ? '#c0c7c8' : '#fff3d4');
    }
    for (const [key, group] of this.interactiveParts) {
      group.dataset.value = String(Math.round(state[key]));
      this.values.get(key)!.textContent = key === 'washingtonTrust' && locked ? '—' : String(Math.round(state[key]));
    }
    const split = relationshipSplit(state.burrRivalry, state.burrRespect);
    this.upperClip.setAttribute('height', String(split - 68));
    this.lowerClip.setAttribute('y', String(split));
    this.lowerClip.setAttribute('height', String(172 - split));
    this.values.get('burrRivalry')!.setAttribute('y', String((68 + split) / 2 + 1));
    this.values.get('burrRespect')!.setAttribute('y', String((split + 172) / 2 + 1));
    this.seam.setAttribute('d', `M68 ${split}H172`);
    this.seamLight.setAttribute('d', `M68 ${split + 1.2}H172`);
    return split;
  }
}
