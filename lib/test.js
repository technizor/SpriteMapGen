#!/usr/bin / env node

const fse = require('fs-extra');
const v = require('./validator');
const s = require('./map-format');
const p = require('./processor');
const procedure = require('./procedure');

// Custom stuff
console.log(s.test(fse.readJsonSync('example-map.json')));