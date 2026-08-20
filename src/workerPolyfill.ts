if (typeof self !== 'undefined') {
  if (typeof (self as any).window === 'undefined') {
    (self as any).window = self;
  }
  if (typeof (self as any).document === 'undefined') {
    (self as any).document = {
      createElement: (tag: string) => {
        if (tag === 'canvas' && typeof OffscreenCanvas !== 'undefined') {
          return new OffscreenCanvas(300, 150);
        }
        return { getContext: () => null, setAttribute: () => {}, style: {} };
      },
      createElementNS: (_ns: string, tag: string) => {
        if (tag === 'canvas' && typeof OffscreenCanvas !== 'undefined') {
          return new OffscreenCanvas(300, 150);
        }
        return { getContext: () => null, setAttribute: () => {}, style: {} };
      },
      getElementsByTagName: () => [],
      head: { appendChild: () => {} },
      body: { appendChild: () => {} },
      location: typeof location !== 'undefined' ? location : { href: '' },
    };
  }
}
export {};
