#!/usr/bin/env node
import procedure from 'src/procedure';
import hashFile from 'src/hash-file';
import mapFormat from 'src/map-format';
import reader from 'src/map-format/reader';
import { serializeDepTrees } from 'src/dep-tree';
import { OptionsValue } from 'src/map-format/types';

let command = process.argv[2];
let mapPaths = process.argv.splice(3);
let cachePath = '.spritemap-cache';
let procedureData = { mapPaths, cachePath };

let helpStr = `Usage: smg [option]... <command> [map]...
[option]

<command>
  test                       validates format of each map
  generate                   generates the output of each map
  hash                       generates dependency tree of each map

[map]                        a file path to a map
`;

let readerFunc = reader(cachePath);
let hashFunc = hashFile(true);

switch (command) {
    case 'test':
        procedure.test(procedureData);
        break;
    case 'generate':
        procedure.generate(procedureData);
        break;
    case 'hash':
        Promise.resolve(serializeDepTrees<OptionsValue>(mapPaths, mapFormat, readerFunc, hashFunc))
            .then(n => console.log(JSON.stringify(n, undefined, 2)));
        break;
    default:
        console.log(helpStr);
        break;
}