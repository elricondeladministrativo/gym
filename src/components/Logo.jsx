import React from 'react';
import Svg, { Ellipse, G, Path, Rect } from 'react-native-svg';

/**
 * Logo placeholder: mancuerna + hamburguesa.
 * - Los discos de la mancuerna son los laterales.
 * - La barra central se transforma en una hamburguesa (pan + lechuga + carne).
 * Pensado para leerse bien en tamaños chicos (ícono de app incluido).
 */
export default function Logo({ size = 96, style }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      style={style}
      accessibilityRole="image"
      accessibilityLabel="Logo de GymApp: mancuerna y hamburguesa"
    >
      <G>
        {/* Barra de la mancuerna */}
        <Rect x={76} y={248} width={360} height={18} rx={9} fill="#B0B0B0" />
        <Rect x={76} y={248} width={360} height={6} rx={3} fill="#D9D9D9" />

        {/* Discos izquierda */}
        <Rect x={54} y={186} width={36} height={140} rx={12} fill="#457B9D" />
        <Rect x={94} y={208} width={26} height={96} rx={9} fill="#1D3557" />

        {/* Discos derecha */}
        <Rect x={422} y={186} width={36} height={140} rx={12} fill="#457B9D" />
        <Rect x={392} y={208} width={26} height={96} rx={9} fill="#1D3557" />

        {/* Pan superior */}
        <Path
          d="M136 238 C136 188 190 158 256 158 C322 158 376 188 376 238 Z"
          fill="#FF6B35"
        />
        <Path
          d="M150 228 C158 194 202 174 256 174 C310 174 354 194 362 228 Z"
          fill="#FF8B5E"
          opacity={0.55}
        />

        {/* Semillas de sésamo */}
        <Ellipse cx={216} cy={202} rx={9} ry={4.5} fill="#FFE3D3" transform="rotate(-18 216 202)" />
        <Ellipse cx={258} cy={190} rx={9} ry={4.5} fill="#FFE3D3" transform="rotate(6 258 190)" />
        <Ellipse cx={300} cy={204} rx={9} ry={4.5} fill="#FFE3D3" transform="rotate(18 300 204)" />
        <Ellipse cx={236} cy={218} rx={7} ry={3.6} fill="#FFE3D3" transform="rotate(-8 236 218)" />
        <Ellipse cx={278} cy={218} rx={7} ry={3.6} fill="#FFE3D3" transform="rotate(8 278 218)" />

        {/* Lechuga */}
        <Path
          d="M132 238 C146 226 158 250 172 238 C186 226 198 250 212 238 C226 226 238 250 252 238 C266 226 278 250 292 238 C306 226 318 250 332 238 C346 226 358 250 372 238 L378 258 L126 258 Z"
          fill="#457B9D"
        />

        {/* Carne */}
        <Rect x={134} y={254} width={244} height={36} rx={18} fill="#1D3557" />
        <Rect x={146} y={262} width={220} height={8} rx={4} fill="#457B9D" opacity={0.85} />

        {/* Pan inferior */}
        <Path
          d="M136 288 L376 288 L376 300 C376 344 322 368 256 368 C190 368 136 344 136 300 Z"
          fill="#FF6B35"
        />
        <Path
          d="M150 320 C186 344 326 344 362 320 C352 352 308 368 256 368 C204 368 160 352 150 320 Z"
          fill="#E85A28"
          opacity={0.65}
        />
      </G>
    </Svg>
  );
}
