import * as fse from 'fs-extra';
import * as path from 'path';

import { DependencyDataOutput, DependencyDataFunc } from '../util/dep-tree';
import { OptionsValue, SpriteBlockEntry, MapBlockEntry, BlockBlockEntry } from './types';

export default function getReaderFunction(cachePath: string): DependencyDataFunc<OptionsValue> {
    let resolvedCachePath = path.relative('./', path.resolve(cachePath));
    return async (filePath: string): Promise<DependencyDataOutput<OptionsValue>> => {
        if (filePath.endsWith('.json')) { // Read map file to find dependencies
            let mapPath = path.resolve(filePath);
            let basePath = path.relative('./', path.dirname(mapPath)); // All file paths within a map file are relative to itself
            // Read the options file
            let options = await fse.readJson(mapPath) as OptionsValue;
            let format = options.input.format;
            let inputBasePath = path.join(basePath, options.input.path);
            let outputBasePath = path.join(resolvedCachePath, `${options.output.path}.${options.output.format}`);

            let dependencies: Array<string> = [];
            let adjustedBlocks = options.blocks.map(blk => {
                if ((blk as SpriteBlockEntry).src) {
                    let sbe = blk as SpriteBlockEntry;
                    let src = path.join(inputBasePath, `${sbe.src}.${format}`);
                    sbe.src = src;
                    dependencies.push(src);
                    return sbe;
                } else if ((blk as MapBlockEntry).map) {
                    let mbe = blk as MapBlockEntry;
                    let src = path.join(inputBasePath, mbe.map);
                    mbe.map = src;
                    dependencies.push(src);
                    return mbe;
                } else if ((blk as BlockBlockEntry).blockSrc) {
                    let bbe = blk as BlockBlockEntry;
                    let srcs = bbe.blockSrc.map(src => path.join(inputBasePath, `${src}.${format}`));
                    bbe.blockSrc = srcs;
                    dependencies.push(...srcs);
                    return bbe;
                }
                return blk;
            });
            options.output.path = outputBasePath;
            options.blocks = adjustedBlocks;
            return { data: options, dependencies };
        } else { // Rendered images have no dependencies
            return { data: null, dependencies: [] };
        }
    }
}