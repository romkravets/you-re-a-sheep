// Minimal typings for the part of d3-delaunay we use (the package ships no types).
declare module 'd3-delaunay' {
  export class Voronoi {
    cellPolygon(i: number): [number, number][] | null;
  }
  export class Delaunay {
    static from(points: ArrayLike<[number, number]>): Delaunay;
    voronoi(bounds: [number, number, number, number]): Voronoi;
  }
}
