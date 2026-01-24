declare module 'react-simple-maps' {
  import type { ComponentType, ReactNode, CSSProperties } from 'react';

  export interface ProjectionConfig {
    scale?: number;
    center?: [number, number];
    rotate?: [number, number, number];
    parallels?: [number, number];
  }

  export interface ComposableMapProps {
    projection?: string;
    projectionConfig?: ProjectionConfig;
    width?: number;
    height?: number;
    style?: CSSProperties;
    children?: ReactNode;
  }

  export interface GeographiesProps {
    geography: string | object;
    children: (data: { geographies: GeographyType[] }) => ReactNode;
  }

  export interface GeographyType {
    rsmKey: string;
    properties: Record<string, unknown>;
    geometry: object;
  }

  export interface GeographyStyleProps {
    default?: CSSProperties;
    hover?: CSSProperties;
    pressed?: CSSProperties;
  }

  export interface GeographyProps {
    geography: GeographyType;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    style?: GeographyStyleProps;
    onClick?: () => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
  }

  export interface MarkerProps {
    coordinates: [number, number];
    children?: ReactNode;
    onClick?: () => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    style?: CSSProperties;
  }

  export interface ZoomableGroupProps {
    center?: [number, number];
    zoom?: number;
    minZoom?: number;
    maxZoom?: number;
    translateExtent?: [[number, number], [number, number]];
    onMoveStart?: () => void;
    onMove?: () => void;
    onMoveEnd?: () => void;
    children?: ReactNode;
  }

  export const ComposableMap: ComponentType<ComposableMapProps>;
  export const Geographies: ComponentType<GeographiesProps>;
  export const Geography: ComponentType<GeographyProps>;
  export const Marker: ComponentType<MarkerProps>;
  export const Line: ComponentType<unknown>;
  export const Sphere: ComponentType<unknown>;
  export const Graticule: ComponentType<unknown>;
  export const ZoomableGroup: ComponentType<ZoomableGroupProps>;
}
