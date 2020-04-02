#!/usr/bin/env node
import procedure from './procedure';
import hashFile from './util/hash-file';
import reader from './map-format/reader';
import { serializeDepTrees } from './util/dep-tree';
import { OptionsValue } from './map-format/types';

let command = process.argv[2];
let mapPaths = process.argv.splice(3);
let procedureData = { mapPaths };

let helpStr = `Usage: smg [option]... <command> [map]...
[option]

<command>
  test                       validates format of each map
  generate                   generates the output of each map
  hash                       generates dependency tree of each map

[map]                        a file path to a map
`;

switch (command) {
    case 'test':
        procedure.test(procedureData);
        break;
    case 'generate':
        procedure.generate(procedureData);
        break;
    case 'hash':
        Promise.resolve(serializeDepTrees<OptionsValue>(mapPaths, reader('.spritemap-cache'), hashFile))
            .then(n => console.log(JSON.stringify(n, undefined, 2)));
        break;
    default:
        console.log(helpStr);
        break;
}