#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

import Table from 'cli-table3';
import prettyBytes from 'pretty-bytes';
import yargs from 'yargs';
import { hashFilename, JagArchive } from './index.js';
import { hideBin } from 'yargs/helpers';

const pkg = JSON.parse(fs.readFileSync('./package.json'));

yargs(hideBin(process.argv))
    .scriptName('rsc-archiver')
    .version(pkg.version)
    .command(
        ['x <archive> <files..>', 'extract'],
        'extract a file from an archive',
        (yargs) => {
            yargs.positional('archive', {
                description: 'the .jag or .mem archive file',
                type: 'string'
            });

            yargs.positional('files', {
                description: 'the filenames or hashes within the archive',
                type: 'array'
            });

            yargs.option('output', {
                alias: 'o',
                description: 'the filenames to write to',
                type: 'array'
            });
        },
        async (argv) => {
            const archive = new JagArchive();

            await archive.init();

            const outputNames =
                argv.output && argv.output.length ? argv.output : argv.files;

            if (
                outputNames.length &&
                outputNames.length !== argv.files.length
            ) {
                process.errorCode = 1;
                console.error(
                    'invalid number of output names: ' +
                        `${argv.files.length} (files) != ` +
                        `${outputNames.length} (output)`
                );
                return;
            }

            try {
                archive.readArchive(await fs.promises.readFile(argv.archive));

                for (let i = 0; i < argv.files.length; i += 1) {
                    const file = archive.getEntry(argv.files[i]);
                    await fs.promises.writeFile(outputNames[i], file);
                }
            } catch (e) {
                process.errorCode = 1;
                console.error(e);
            }
        }
    )
    .command(
        ['a <archive> <files..>', 'add'],
        'add files to an archive',
        (yargs) => {
            yargs.positional('archive', {
                description: 'the .jag or .mem archive file',
                type: 'string'
            });

            yargs.positional('files', {
                description: 'the file you would like to add',
                type: 'array'
            });

            yargs.option('g', {
                alias: 'group',
                description:
                    'compress files in one block rather than individually',
                type: 'boolean',
                default: false
            });
        },
        async (argv) => {
            const archive = new JagArchive();

            await archive.init();

            try {
                archive.readArchive(await fs.promises.readFile(argv.archive));
            } catch (e) {
                // file doesn't exist, but writeFile will create it
            }

            try {
                for (const file of argv.files) {
                    const filename = path.basename(file);

                    archive.putEntry(
                        filename,
                        await fs.promises.readFile(file)
                    );

                    await fs.promises.writeFile(
                        argv.archive,
                        archive.toArchive(!argv.g)
                    );
                }
            } catch (e) {
                process.exitCode = 1;
                console.error(e);
            }
        }
    )
    .command(
        ['d <archive> <files..>', 'delete'],
        'remove files from an archive',
        (yargs) => {
            yargs.positional('archive', {
                description: 'the .jag or .mem archive file',
                type: 'string'
            });

            yargs.positional('files', {
                description: 'the filenames or hashes within the archive',
                type: 'array'
            });
        },
        async (argv) => {
            const archive = new JagArchive();

            await archive.init();

            try {
                archive.readArchive(await fs.promises.readFile(argv.archive));

                for (const name of argv.files) {
                    archive.removeEntry(name);
                }

                await fs.promises.writeFile(argv.archive, archive.toArchive());
            } catch (e) {
                process.exitCode = 1;
                console.error(e);
            }
        }
    )
    .command(
        ['l <archive>', 'list'],
        'list hashes and file sizes in an archive',
        (yargs) => {
            yargs.positional('archive', {
                description: 'the .jag or .mem archive file',
                type: 'string'
            });

            yargs.option('h', {
                alias: 'human',
                description: 'human readable file sizes',
                type: 'boolean',
                default: false
            });
        },
        async (argv) => {
            const archive = new JagArchive();

            await archive.init();

            try {
                archive.readArchive(await fs.promises.readFile(argv.archive));
            } catch (e) {
                process.exitCode = 1;
                console.error(e);
                return;
            }

            const table = new Table({ head: ['hash', 'size'] });

            for (const [hash, entry] of archive.entries) {
                const size = argv.human
                    ? prettyBytes(entry.length)
                    : entry.length;

                table.push([hash, size]);
            }

            console.log(table.toString());
        }
    )
    .command(
        ['h <name>', 'hash'],
        'return the integer hash of a filename string',
        (yargs) => {
            yargs.positional('name', {
                description: 'the string to hash',
                type: 'string'
            });
        },
        (argv) => console.log(hashFilename(argv.name))
    )
    .demandCommand()
    .example([
        ['$0 l ./cache/config85.jag', 'list the hashes in config85.jag'],
        ['$0 a ./cache/jagex.jag logo.tga', 'add logo.tga to jagex.jag']
    ]).argv;
