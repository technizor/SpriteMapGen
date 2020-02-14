#!/usr/bin / env node

import * as fse from 'fs-extra';
//import vf from '../lib/validator';
import mf from '../lib/map-format';
//import pc from '../lib/processor';
//import pd from '../lib/procedure';

// Custom stuff
console.log(mf.test(fse.readJsonSync('./example-map.json')));