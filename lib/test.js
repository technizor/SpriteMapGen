const fse = require('fs-extra');
const v = require('./validator');
const s = require('./map-format');

let executable = process.argv[0];
let entry = process.argv[1];
let command = process.argv[2];
let maps = process.argv.splice(3);

let helpStr = `Usage: smg [option]... <command> [map]...
[option]

<command>
  test                       validates format of each map
  test-files                 checks for input files of each map
  process                    generates the output of each map

[map]                        a file path to a map
`;

switch (command) {
    case 'test':
        console.log('"test" command not implemented');
        break;
    case 'test-files':
        console.log('"test-files" command not implemented');
        break;
    case 'process':
        procedure(maps);
        break;
    default:
        console.log(helpStr)
        break;
}

// Custom stuff
console.log(s.test(fse.readJsonSync('example-map.json')));