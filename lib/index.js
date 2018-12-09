#!/usr/bin/env node
const procedure = require('./procedure');

let executable = process.argv[0];
let entry = process.argv[1];
let command = process.argv[2];
let maps = process.argv.splice(3);
let procedureData = { maps };

let helpStr = `Usage: smg [option]... <command> [map]...
[option]

<command>
  test                       validates format of each map
  test-files                 checks for input files of each map
  generate                    generates the output of each map

[map]                        a file path to a map
`;

switch (command) {
    case 'test':
        procedure.test(procedureData);
        break;
    case 'generate':
        procedure.generate(procedureData);
        break;
    default:
        console.log(helpStr);
        break;
}