// src/theme/fontScale.ts — global font-size multiplier applied app-wide.
// Monkeypatches Text/TextInput once so every rendered font size is scaled by a
// user-controlled multiplier (Settings → Text Size). Because all our styles use
// explicit numeric fontSize, we scale it at render time.
import { Text, TextInput, StyleSheet } from 'react-native';

export const FONT_SCALE_OPTIONS = [
  { key: 'small',  label: 'Small',  scale: 0.9 },
  { key: 'normal', label: 'Normal', scale: 1.0 },
  { key: 'large',  label: 'Large',  scale: 1.15 },
  { key: 'xl',     label: 'Extra',  scale: 1.3 },
] as const;

export type FontScaleKey = typeof FONT_SCALE_OPTIONS[number]['key'];

let globalScale = 1;
export function getGlobalFontScale() { return globalScale; }
export function setGlobalFontScale(s: number) { globalScale = s; }
export function scaleForKey(key: FontScaleKey): number {
  return FONT_SCALE_OPTIONS.find(o => o.key === key)?.scale ?? 1;
}

let patched = false;
export function enableGlobalFontScaling() {
  if (patched) return;
  patched = true;
  for (const Comp of [Text, TextInput] as any[]) {
    const origRender = Comp.render;
    if (typeof origRender !== 'function') continue;
    // Patch the INPUT props before the original render runs, instead of
    // inspecting the returned element — Text's render returns a
    // <TextAncestor.Provider> wrapper first, so its own `style` prop is
    // always undefined and post-render inspection silently does nothing.
    Comp.render = function (props: any, ref: any) {
      if (globalScale !== 1 && props?.style) {
        const flat = StyleSheet.flatten(props.style) || {};
        if (typeof flat.fontSize === 'number') {
          props = {
            ...props,
            style: [props.style, { fontSize: Math.round(flat.fontSize * globalScale) }],
          };
        }
      }
      return origRender(props, ref);
    };
  }
}
