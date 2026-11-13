import type { COMPONENT_TYPES, PIECE_TYPES, STONE_KINDS, STONE_SHAPES } from "@jewelry/shared";
import type { ReactNode } from "react";
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, Polygon, Rect, Stop } from "react-native-svg";

/**
 * Line-art illustrations drawn in the theme's gold. They are decorative:
 * every place that shows one also shows its name as text.
 */

type GlyphProps = { size?: number; color: string; strokeWidth?: number };

const hidden = { accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" } as const;

function Frame({ size = 48, viewBox = 64, children }: { size?: number; viewBox?: number; children: ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${viewBox} ${viewBox}`} {...hidden}>
      {children}
    </Svg>
  );
}

// ── Jewelry types ──────────────────────────────────────────────────────

type JewelryType = (typeof PIECE_TYPES.values)[number] | (typeof COMPONENT_TYPES.values)[number];

function RingArt({ color, sw }: { color: string; sw: number }) {
  return (
    <G stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Circle cx={32} cy={41} r={16} />
      <Circle cx={32} cy={41} r={12.5} strokeOpacity={0.45} />
      <Path d="M27 25.5 L29 21 H35 L37 25.5" />
      <Path d="M23 15 L27 9 H37 L41 15 L32 24 Z" fill={color} fillOpacity={0.12} />
      <Path d="M23 15 H41 M27 9 L30 15 L32 24 M37 9 L34 15 L32 24" strokeOpacity={0.7} />
    </G>
  );
}

function EarringsArt({ color, sw }: { color: string; sw: number }) {
  const one = (x: number) => (
    <G key={x}>
      <Circle cx={x} cy={12} r={4} />
      <Line x1={x} y1={16} x2={x} y2={26} />
      <Path d={`M${x} 28 C${x - 7} 37 ${x - 7} 46 ${x} 49 C${x + 7} 46 ${x + 7} 37 ${x} 28 Z`} fill={color} fillOpacity={0.12} />
      <Path d={`M${x} 33 V44`} strokeOpacity={0.5} />
    </G>
  );
  return (
    <G stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none">
      {one(19)}
      {one(45)}
    </G>
  );
}

function PendantArt({ color, sw }: { color: string; sw: number }) {
  return (
    <G stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Path d="M6 6 Q32 40 58 6" strokeDasharray="1 4" />
      <Circle cx={32} cy={26} r={3} />
      <Path d="M32 30 L43 42 L32 58 L21 42 Z" fill={color} fillOpacity={0.12} />
      <Path d="M21 42 L32 46 L43 42 M32 30 V46" strokeOpacity={0.6} />
    </G>
  );
}

function ChainArt({ color, sw }: { color: string; sw: number }) {
  const links = [0, 1, 2, 3, 4];
  return (
    <G stroke={color} strokeWidth={sw} fill="none" transform="rotate(-35 32 32)">
      {links.map((i) => (
        <Ellipse key={i} cx={8 + i * 12} cy={32} rx={8} ry={i % 2 ? 2.5 : 5.5} strokeOpacity={i % 2 ? 1 : 0.9} />
      ))}
    </G>
  );
}

function BraceletArt({ color, sw }: { color: string; sw: number }) {
  return (
    <G stroke={color} strokeWidth={sw} strokeLinecap="round" fill="none">
      <Ellipse cx={32} cy={34} rx={26} ry={14} />
      <Ellipse cx={32} cy={31} rx={20} ry={9} strokeOpacity={0.45} />
      {[16, 24, 32, 40, 48].map((x, i) => (
        <Circle key={x} cx={x} cy={[44, 47, 48, 47, 44][i]} r={2.2} fill={color} />
      ))}
    </G>
  );
}

function SetArt({ color, sw }: { color: string; sw: number }) {
  return (
    <>
      <G transform="translate(-4 14) scale(0.62)">
        <RingArt color={color} sw={sw / 0.62} />
      </G>
      <G transform="translate(28 2) scale(0.62)">
        <PendantArt color={color} sw={sw / 0.62} />
      </G>
    </>
  );
}

const JEWELRY_ART: Record<JewelryType, (p: { color: string; sw: number }) => ReactNode> = {
  ring: RingArt,
  earrings: EarringsArt,
  pendant: PendantArt,
  necklace: PendantArt,
  chain: ChainArt,
  bracelet: BraceletArt,
  set: SetArt,
};

export function JewelryGlyph({ type, size = 48, color, strokeWidth = 2.5 }: GlyphProps & { type: JewelryType }) {
  const Art = JEWELRY_ART[type];
  return (
    <Frame size={size}>
      <Art color={color} sw={strokeWidth} />
    </Frame>
  );
}

// ── Stone shapes (seen from above) ─────────────────────────────────────

type StoneShape = (typeof STONE_SHAPES.values)[number];

/** Brilliant-style facets: a table polygon joined to the outline at the same angles. */
function brilliant(cx: number, cy: number, rx: number, ry: number, sides = 8) {
  const pts = Array.from({ length: sides }, (_, i) => {
    const a = (Math.PI * 2 * i) / sides + Math.PI / sides;
    return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry, ox: cx + Math.cos(a) * rx * 2, oy: cy + Math.sin(a) * ry * 2 };
  });
  return {
    table: pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" "),
    rays: pts.map((p) => `M${p.x.toFixed(1)} ${p.y.toFixed(1)} L${p.ox.toFixed(1)} ${p.oy.toFixed(1)}`).join(" "),
  };
}

function ShapeArt({ shape, color, fill }: { shape: StoneShape; color: string; fill: string }) {
  const body = { fill, fillOpacity: 0.55, stroke: color };
  const facet = { stroke: color, strokeOpacity: 0.55, fill: "none" };
  switch (shape) {
    case "round": {
      const b = brilliant(24, 24, 9, 9);
      return (
        <>
          <Circle cx={24} cy={24} r={18} {...body} />
          <Polygon points={b.table} {...facet} />
          <Path d={b.rays} {...facet} />
        </>
      );
    }
    case "oval": {
      const b = brilliant(24, 24, 6.5, 9);
      return (
        <>
          <Ellipse cx={24} cy={24} rx={13} ry={18} {...body} />
          <Polygon points={b.table} {...facet} />
          <Path d={b.rays} {...facet} />
        </>
      );
    }
    case "princess":
      return (
        <>
          <Rect x={7} y={7} width={34} height={34} {...body} />
          <Rect x={16} y={16} width={16} height={16} {...facet} />
          <Path d="M7 7 L16 16 M41 7 L32 16 M7 41 L16 32 M41 41 L32 32" {...facet} />
        </>
      );
    case "cushion":
      return (
        <>
          <Rect x={7} y={7} width={34} height={34} rx={10} {...body} />
          <Rect x={15} y={15} width={18} height={18} rx={4} {...facet} />
          <Path d="M10 10 L15 15 M38 10 L33 15 M10 38 L15 33 M38 38 L33 33" {...facet} />
        </>
      );
    case "emerald":
      return (
        <>
          <Polygon points="16,4 32,4 38,10 38,38 32,44 16,44 10,38 10,10" {...body} />
          <Polygon points="19,10 29,10 32,13 32,35 29,38 19,38 16,35 16,13" {...facet} />
          <Polygon points="21,15 27,15 27,33 21,33" {...facet} />
        </>
      );
    case "asscher":
      return (
        <>
          <Polygon points="16,7 32,7 41,16 41,32 32,41 16,41 7,32 7,16" {...body} />
          <Polygon points="19,13 29,13 35,19 35,29 29,35 19,35 13,29 13,19" {...facet} />
          <Path d="M16 7 L19 13 M32 7 L29 13 M41 16 L35 19 M41 32 L35 29 M32 41 L29 35 M16 41 L19 35 M7 32 L13 29 M7 16 L13 19" {...facet} />
        </>
      );
    case "radiant":
      return (
        <>
          <Polygon points="15,5 33,5 39,11 39,37 33,43 15,43 9,37 9,11" {...body} />
          <Path d="M15 5 L33 43 M33 5 L15 43 M9 24 H39 M24 5 V43" {...facet} />
        </>
      );
    case "baguette":
      return (
        <>
          <Rect x={15} y={5} width={18} height={38} {...body} />
          <Rect x={20} y={11} width={8} height={26} {...facet} />
          <Path d="M15 5 L20 11 M33 5 L28 11 M15 43 L20 37 M33 43 L28 37" {...facet} />
        </>
      );
    case "pear":
      return (
        <>
          <Path d="M24 4 C33 14 40 22 40 30 A16 16 0 0 1 8 30 C8 22 15 14 24 4 Z" {...body} />
          <Path d="M24 12 L31 28 L24 38 L17 28 Z M24 4 V12 M8 30 L17 28 M40 30 L31 28 M24 46 V38" {...facet} />
        </>
      );
    case "marquise":
      return (
        <>
          <Path d="M24 3 Q44 24 24 45 Q4 24 24 3 Z" {...body} />
          <Path d="M24 12 L30 24 L24 36 L18 24 Z M24 3 V12 M24 45 V36 M15 24 H18 M33 24 H30" {...facet} />
        </>
      );
    case "heart":
      return (
        <>
          <Path d="M24 42 C10 32 4 24 4 16 A10 10 0 0 1 24 12 A10 10 0 0 1 44 16 C44 24 38 32 24 42 Z" {...body} />
          <Path d="M24 18 L32 22 L24 34 L16 22 Z M24 12 V18" {...facet} />
        </>
      );
    case "trillion":
      return (
        <>
          <Path d="M24 5 Q34 24 43 40 Q24 44 5 40 Q14 24 24 5 Z" {...body} />
          <Polygon points="24,17 33,34 15,34" {...facet} />
          <Path d="M24 5 V17 M43 40 L33 34 M5 40 L15 34" {...facet} />
        </>
      );
    case "cabochon":
      return (
        <>
          <Ellipse cx={24} cy={24} rx={15} ry={19} {...body} />
          <Path d="M15 16 Q19 9 26 9" stroke={color} strokeOpacity={0.8} fill="none" strokeLinecap="round" />
        </>
      );
    case "other":
      return (
        <Path
          d="M24 4 L28 20 L44 24 L28 28 L24 44 L20 28 L4 24 L20 20 Z"
          {...body}
        />
      );
  }
}

export function StoneShapeGlyph({
  shape,
  size = 40,
  color,
  fill,
  strokeWidth = 1.6,
}: GlyphProps & { shape: StoneShape; fill: string }) {
  return (
    <Frame size={size} viewBox={48}>
      <G strokeWidth={strokeWidth} strokeLinejoin="round">
        <ShapeArt shape={shape} color={color} fill={fill} />
      </G>
    </Frame>
  );
}

/** Representative tints for stone kinds. */
export const STONE_TINTS: Record<(typeof STONE_KINDS.values)[number], string> = {
  natural_diamond: "#E8F1F8",
  lab_grown_diamond: "#D9ECFA",
  moissanite: "#E7E2F7",
  cubic_zirconia: "#F4F4F4",
  gemstone: "#C7344A",
  other: "#9C8E7A",
};

// ── Metal swatches ─────────────────────────────────────────────────────

type MetalLook = "yellow" | "white" | "rose" | "two_tone" | "silver" | "other";

const METAL_STOPS: Record<Exclude<MetalLook, "two_tone">, [string, string, string]> = {
  yellow: ["#FBE7A1", "#D9AE45", "#9C7421"],
  white: ["#FAFAF8", "#D3D5D8", "#9EA2A8"],
  rose: ["#F9D3C1", "#DB9475", "#A9614A"],
  silver: ["#F3F5F7", "#BFC4CB", "#7F868F"],
  other: ["#D8CCB8", "#A39079", "#6F604E"],
};

/** A polished-metal disc for the metal and gold-colour pickers. */
export function MetalSwatch({ look, size = 40, ring }: { look: MetalLook; size?: number; ring: string }) {
  const id = `metal-${look}`;
  const stops = (k: Exclude<MetalLook, "two_tone">, gid: string) => (
    <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
      <Stop offset="0" stopColor={METAL_STOPS[k][0]} />
      <Stop offset="0.5" stopColor={METAL_STOPS[k][1]} />
      <Stop offset="1" stopColor={METAL_STOPS[k][2]} />
    </LinearGradient>
  );
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" {...hidden}>
      <Defs>
        {look === "two_tone" ? (
          <>
            {stops("yellow", `${id}-a`)}
            {stops("white", `${id}-b`)}
          </>
        ) : (
          stops(look, id)
        )}
      </Defs>
      {look === "two_tone" ? (
        <>
          <Path d="M20 2 A18 18 0 0 0 20 38 Z" fill={`url(#${id}-a)`} />
          <Path d="M20 2 A18 18 0 0 1 20 38 Z" fill={`url(#${id}-b)`} />
        </>
      ) : (
        <Circle cx={20} cy={20} r={18} fill={`url(#${id})`} />
      )}
      <Circle cx={20} cy={20} r={18} fill="none" stroke={ring} strokeWidth={1.5} />
      <Path d="M10 14 Q14 8 21 7" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={2} fill="none" strokeLinecap="round" />
    </Svg>
  );
}
