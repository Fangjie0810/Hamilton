let bundledImages: Readonly<Record<string, string>> | undefined;

/** The standalone HTML supplies the same source sheets without file or network requests. */
export function configureBundledImages(images?: Readonly<Record<string, string>>) {
  bundledImages = images ? Object.freeze({ ...images }) : undefined;
}

export function imageAsset(path: string): string {
  if (!bundledImages) return path;
  const image = bundledImages[path];
  if (!image?.startsWith('data:image/png;base64,')) throw new Error(`Missing bundled image: ${path}`);
  return image;
}
