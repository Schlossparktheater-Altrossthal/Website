/* eslint-disable @typescript-eslint/no-explicit-any */
declare module "d3-cloud" {
  export type Word = any;

  export interface CloudLayout<T = any> {
    size(size: [number, number]): CloudLayout<T>;
    words(words: T[]): CloudLayout<T>;
    padding(padding: number): CloudLayout<T>;
    rotate(rotate: (datum: T, index?: number) => number): CloudLayout<T>;
    font(font: string | ((datum: T) => string)): CloudLayout<T>;
    fontStyle(style: string | ((datum: T) => string)): CloudLayout<T>;
    fontWeight(weight: string | number | ((datum: T) => string | number)): CloudLayout<T>;
    fontSize(fontSize: (datum: T) => number): CloudLayout<T>;
    spiral(
      name: string | ((size: [number, number]) => (theta: number) => [number, number]),
    ): CloudLayout<T>;
    random(random: number | (() => number)): CloudLayout<T>;
    on(event: string, listener: (words: T[], bounds?: [number, number]) => void): CloudLayout<T>;
    start(): CloudLayout<T>;
    stop(): CloudLayout<T>;
  }

  const cloud: <T = any>() => CloudLayout<T>;
  export default cloud;
}
