export type ArtVariant = 'a' | 'b' | 'c';
export type VisualCharacterId = 'hamilton' | 'burr' | 'washington' | 'laurens' | 'lafayette' | 'mulligan' | 'loyalist' | 'newsboy' | 'citizen' | 'revolutionary' | 'soldier';
export const visualCharacters: VisualCharacterId[] = ['hamilton', 'burr', 'washington', 'laurens', 'lafayette', 'mulligan', 'loyalist', 'newsboy', 'citizen', 'revolutionary', 'soldier'];
export const artScenes = ['opening', 'arrival', 'tavern', 'debate', 'washington', 'yorktown'] as const;
export const artVariant: ArtVariant = (['a', 'b', 'c'] as const).find((id) => new URLSearchParams(location.search).get('art') === id) ?? 'a';
export const portraitPath = (id: VisualCharacterId, variant = artVariant) => `/art/portraits/${id}-${variant}.png`;
export const spritePath = (id: VisualCharacterId, variant = artVariant) => `/art/sprites/${id}-${variant}.svg`;
export const backgroundPath = (id: string, variant = artVariant) => `/art/backgrounds/${id.toLowerCase()}-${variant}.png`;
