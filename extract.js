#!/usr/bin/env node
"use strict";
var path = require('path');
var fs = require('fs');
var csv = require('csv')

if (process.argv.length < 3) {
    console.error(`Usage: ${path.basename(process.argv[1])} <directory...>`);
    process.exit(1);
}

var aggregate = {};

function processDir(directory) {
    fs.readdirSync(directory).map(file => path.join(directory, file)).forEach(file => {
        var stat = fs.statSync(file);
        if (stat.isDirectory()) {
            processDir(file);
        } else if (file.endsWith('.txt')) {
            processFile(file, path.basename(file));
        }
    });
}

function processFile(file, name) {
    var content = fs.readFileSync(file, 'UTF-16LE').replace(/^\uFEFF/, '');
    content.split('\n').forEach(line => {
        var parts = line.split('=', 2);
        if (parts.length > 1) {
            processLine(parts[0], parts[1].trim(), name.replace('_win32.bin_VB.txt', ''));
        }
    });
}

var buffer = Buffer.alloc(4);

function processLine(key, value, context) {
    var parts = key.trim().split('-');
    buffer.writeUInt32BE(parseInt(parts[1]));
    var stringId = buffer.toString('hex').toUpperCase();
    var index = stringId + parts[0];
    if (!aggregate[index]) {
        aggregate[index] = {
            id: stringId,
            tag: key[0],
            value: value,
            context: [context]
        };
    } else {
        aggregate[index].context.push(context);
    }
}

for (let i = 2; i < process.argv.length; i += 1) {
    processDir(process.argv[i]);
}

var writer = csv.stringify({ header: true, columns: ['id', 'tag', 'value'], delimiter: ';'});
writer.pipe(process.stdout);
Object.keys(aggregate).sort().map(key => aggregate[key]).forEach(string => {
    writer.write(string);
});
writer.end();
