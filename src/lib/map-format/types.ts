export type FormatValue = 'png' | 'jpeg' | 'webp' | 'tiff' | 'raw' | 'tile';
export type DirectionValue = 'row' | 'col';

export interface IOValue {
    path: string;
    format: FormatValue;
}
export interface GridValue {
    basisX: number;
    basisY: number;
    sizeX: number;
    sizeY: number;
}

export interface BaseBlockEntry {
    sizeX: number;
    sizeY: number;
    x: number;
    y: number;
}
export interface SpriteBlockEntry extends BaseBlockEntry {
    src: string;
}
export interface BlockBlockEntry extends BaseBlockEntry {
    blockSrc: Array<string>;
    blockX: number;
    blockY: number;
    blockDir: DirectionValue;
}
export interface MapBlockEntry extends BaseBlockEntry {
    map: string;
}
export type BlockEntry = SpriteBlockEntry | BlockBlockEntry | MapBlockEntry;

export interface OptionsValue {
    input: IOValue;
    output: IOValue;
    grid: GridValue;
    blocks: Array<BlockEntry>;
}
