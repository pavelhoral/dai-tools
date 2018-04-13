#!/usr/bin/env node
"use strict";
var path = require('path');
var fs = require('fs');
var CSV = require('csv')
var XLSX = require('xlsx');
var unescape = require('unescape');

if (process.argv.length < 4) {
    console.error(`Usage: ${path.basename(process.argv[1])} <xlsx> <csv>`);
    process.exit(1);
}

var aggregate = {};

function fixFormat(text) {
    return unescape(unescape(text)).trim().replace(/\\n/g, '[/n]');
}

function processRow(row) {
    var index = row['B'];
    aggregate[index] = {
        id: index,
        en: fixFormat(row['D']),
        cs: fixFormat(row['E']),
        comment: row['G']
    };
}

var workbook = XLSX.readFile(process.argv[2]);
workbook.SheetNames.filter(name => /^L[0-9]+$/.test(name)).forEach(name => {
    var rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: "A" });
    var count = 0;
    for (let i = 1; i < rows.length; i += 1) {
        if (rows[i]['B']) {
            processRow(rows[i]);
            count++;
        }
    }
    console.error(`DEBUG Processed ${count} rows from ${name}.`);
});

//console.log(JSON.stringify(aggregate, null, '  '));


var source = aggregate;
var output = [];

function processString(string) {
    var trans = source[string.id];
    if (!trans || !string.en) {
        return;
    }
    string.cs = trans.cs;
    string.mismatch = trans.en !== string.en ? '1' : '';
    output.push(string);
}

var parser = CSV.parse(fs.readFileSync(process.argv[3]), { delimiter: ';', columns: true });
parser.on('readable', function() {
    var string;
    while (string = parser.read()) {
        processString(string);
    }
});
parser.on('finish', function() {
    var columns = ['id', 'tag', 'key', 'en', '#en', 'pl', '#pl', 'cs', 'mismatch'];
    var writer = CSV.stringify({ header: true, columns: columns, delimiter: ';'});
    writer.pipe(process.stdout);
    output.forEach(string => {
        writer.write(string);
    });
    writer.end();
});