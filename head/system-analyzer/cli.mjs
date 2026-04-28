// Copyright 2026 the V8 project authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

const printErr = globalThis.printErr;
globalThis.console = {
  warn: (...args) => printErr('console.warn:', ...args),
  log: (...args) => printErr('console.log:', ...args),
  error: (...args) => printErr('console.error:', ...args)
};

import {Processor} from './processor.mjs';
import {Profile} from '../profile.mjs';

class EventFilter {
  constructor() {
    this.script = null;
    this.scriptId = null;
    this.functionName = null;
    this.file = null;
    this.lineRange = null;
    this.timeRange = null;
    this.line = undefined;
    this.column = undefined;
  }

  static get help() {
    return `Filter Options:
  --script=<name>      Filter by script URL or name
  --script-id=<id>     Filter by script ID
  --file=<path>[:line[:col]] Filter by file path and optional line/column
  --function=<name>    Filter by function name
  --time=<range>       Filter by time range (e.g., 1000..5000, 1000:5000)`;
  }

  parse(args) {
    for (const arg of args) {
      if (this.parseScript(arg)) continue;
      if (this.parseScriptId(arg)) continue;
      if (this.parseFile(arg)) continue;
      if (this.parseFunctionName(arg)) continue;
      if (this.parseTimeRange(arg)) continue;
    }
  }

  hasFilters() {
    return this.script !== null || this.scriptId !== null ||
        this.functionName !== null || this.file !== null ||
        this.lineRange !== null || this.timeRange !== null ||
        this.line !== undefined || this.column !== undefined;
  }

  parseScript(arg) {
    if (!arg.startsWith('--script=')) return false;
    if (this.file || this.scriptId !== null) {
      throw new Error('Cannot use both --script and --file or --script-id');
    }
    this.script = arg.substring('--script='.length);
    return true;
  }

  parseScriptId(arg) {
    if (!arg.startsWith('--script-id=')) return false;
    if (this.script || this.file) {
      throw new Error('Cannot use both --script-id and --script or --file');
    }
    this.scriptId = parseInt(arg.substring('--script-id='.length));
    return true;
  }

  parseFile(arg) {
    if (!arg.startsWith('--file=')) return false;
    if (this.script || this.scriptId !== null) {
      throw new Error('Cannot use both --file and --script or --script-id');
    }
    const filter = arg.substring('--file='.length);

    // Check for path:line:column
    let match = filter.match(/(.+):(\d+):(\d+)$/);
    if (match) {
      this.file = match[1];
      this.line = parseInt(match[2]);
      this.column = parseInt(match[3]);
      return true;
    }

    // Check for path:range
    match = filter.match(/(.+):(\d+[:.\s-]{1,3}\d+)$/);
    if (match) {
      this.file = match[1];
      this.lineRange = this.parseRange(match[2], 'line');
      return true;
    }

    // Check for path:line
    match = filter.match(/(.+):(\d+)$/);
    if (match) {
      this.file = match[1];
      this.line = parseInt(match[2]);
      return true;
    }

    // Fallback to just path
    this.file = filter;
    return true;
  }

  parseFunctionName(arg) {
    if (!arg.startsWith('--function=')) return false;
    this.functionName = arg.substring('--function='.length);
    return true;
  }

  parseTimeRange(arg) {
    if (!arg.startsWith('--time=')) return false;
    const timeVal = arg.substring('--time='.length);
    this.timeRange = this.parseRange(timeVal, 'time');
    return true;
  }

  parseRange(str, name) {
    const match = str.match(/^(\d+)[:.\s-]{1,3}(\d+)$/);
    if (!match) {
      throw new Error(`Invalid ${name} range: ${
          str}. Format: start..end, start:end, or "start end"`);
    }

    let start = parseInt(match[1]);
    let end = parseInt(match[2]);

    if (start > end) {
      [start, end] = [end, start];
    }

    return {start, end};
  }

  filterCode(entry, processor) {
    const profileEntry = entry.entry;
    const script =
        profileEntry ? processor.getProfileEntryScript(profileEntry) : null;
    return this._matchesCommon(entry, script);
  }

  filterCodeBasic(entry, processor) {
    const profileEntry = entry.entry;
    const script =
        profileEntry ? processor.getProfileEntryScript(profileEntry) : null;

    if (this.script) {
      if (!script || !script.url.includes(this.script)) return false;
    }
    if (this.scriptId !== null) {
      if (!script || script.id !== this.scriptId) return false;
    }
    if (this.functionName) {
      const fnName = entry.fnName || entry.functionName || '';
      if (!fnName.includes(this.functionName)) return false;
    }
    if (this.file) {
      if (!script || !script.url.includes(this.file)) return false;
    }
    if (this.timeRange) {
      if (entry.time < this.timeRange.start || entry.time > this.timeRange.end)
        return false;
    }
    return true;
  }

  filterIc(entry, processor) {
    const script = processor.getProfileEntryScript(entry.codeEntry);
    return this._matchesCommon(entry, script);
  }

  filterScript(script) {
    if (this.file && !script.url.includes(this.file)) return false;
    if (this.scriptId !== null && script.id !== this.scriptId) return false;
    if (this.script && !script.url.includes(this.script)) return false;
    return true;
  }

  filterFunction(info) {
    if (this.file && !info.script.includes(this.file)) return false;
    if (this.scriptId !== null && info.scriptId !== this.scriptId) return false;

    if (this.line !== undefined) {
      if (!info.sourcePosition || info.sourcePosition.line !== this.line)
        return false;
    }
    if (this.column !== undefined) {
      if (!info.sourcePosition || info.sourcePosition.column !== this.column)
        return false;
    }
    if (this.lineRange) {
      if (!info.sourcePosition ||
          info.sourcePosition.line < this.lineRange.start ||
          info.sourcePosition.line > this.lineRange.end)
        return false;
    }
    return true;
  }

  _matchesCommon(entry, script) {
    if (this.script) {
      if (!script || !script.url.includes(this.script)) return false;
    }
    if (this.scriptId !== null) {
      if (!script || script.id !== this.scriptId) return false;
    }
    if (this.functionName) {
      const fnName = entry.fnName || entry.functionName || '';
      if (!fnName.includes(this.functionName)) return false;
    }
    if (this.file) {
      if (!script || !script.url.includes(this.file)) return false;

      if (this.line !== undefined) {
        if (entry.line !== this.line) return false;
      }
      if (this.column !== undefined) {
        if (entry.column !== this.column) return false;
      }
      if (this.lineRange) {
        if (entry.line < this.lineRange.start ||
            entry.line > this.lineRange.end)
          return false;
      }
    }
    if (this.timeRange) {
      if (entry.time < this.timeRange.start || entry.time > this.timeRange.end)
        return false;
    }
    return true;
  }
}

const VALID_CODE_KINDS = Profile.CODE_KIND_NAMES.filter(k => k !== undefined);

// Specific Filter for Code and Function commands
class CodeFilter extends EventFilter {
  constructor() {
    super();
    this.codeKind = null;
  }

  static get help() {
    return EventFilter.help +
        `\n  --code-kind=<kind>   Filter by code kind (valid: ${
               VALID_CODE_KINDS.join(', ')})`;
  }

  parse(args) {
    super.parse(args);
    for (const arg of args) {
      if (!arg.startsWith('--code-kind=')) continue;

      const kind = arg.substring('--code-kind='.length);
      const matchedKind =
          VALID_CODE_KINDS.find(k => k.toLowerCase() === kind.toLowerCase());

      if (!matchedKind) {
        throw new Error(`Invalid code kind: ${kind}. Valid kinds are: ${
            VALID_CODE_KINDS.join(', ')}`);
      }
      this.codeKind = matchedKind;
    }
  }

  matchesCodeKind(entry) {
    if (this.codeKind) {
      return entry.kindName === this.codeKind;
    }
    return true;
  }
}

// Specific Filter for Deopt command
class DeoptFilter extends EventFilter {
  constructor() {
    super();
    this.deoptType = null;
  }

  static get help() {
    return EventFilter.help +
        `\n  --deopt-type=<type>  Filter by deopt type (e.g., deopt-eager, dependency-change)`;
  }

  parse(args) {
    super.parse(args);
    for (const arg of args) {
      if (!arg.startsWith('--deopt-type=')) continue;

      this.deoptType = arg.substring('--deopt-type='.length);
    }
  }

  matchesDeoptType(entry) {
    if (this.deoptType) {
      return entry.type === this.deoptType;
    }
    return true;
  }
}

// Class Hierarchy for Commands
class Command {
  constructor(processor = null) {
    this.processor = processor;
    this.filter = new EventFilter();
    this.format = 'json';  // Default to json
    this.details = false;
    this.sortField = null;
    this.sortAscending = false;  // Default to descending
    this.limit = 0;
    this.limitStart = undefined;
    this.limitEnd = undefined;
    this.limitLast = 0;
    this.verbose = false;
  }

  static get help() {
    throw new Error('Subclass responsibility');
  }

  execute(args) {
    // Assume parseArgs and filter.parse have been called!
    let results = this.run(args);

    if (Array.isArray(results)) {
      this.applySort(results);
      this.applyLimit(results);

      // Reduce to basic keys if not detailed and format is JSON
      if (!this.details && this.format === 'json') {
        results = this.reduceToBasic(results);
      }
    }

    if (this.format === 'json') {
      print(JSON.stringify(results, null, 2));
    } else if (this.format === 'count') {
      if (Array.isArray(results)) {
        print(results.length);
      } else if (typeof results === 'object') {
        print(Object.keys(results).length);
      } else {
        print(1);
      }
    } else {
      this.printText(results);
    }
  }

  parseArgs(args) {
    this.filter.parse(args);
    for (const arg of args) {
      if (arg.startsWith('--sort=')) {
        this.parseSort(arg);
        continue;
      }
      if (arg.startsWith('--limit=')) {
        this.parseLimit(arg);
        continue;
      }
      if (arg.startsWith('--format=')) {
        this.parseFormat(arg);
        continue;
      }
      if (arg === '--count') {
        this.parseCount(arg);
        continue;
      }
      if (arg === '--details' || arg === '--detail') {
        this.details = true;
        continue;
      }

      if (arg === '--verbose') {
        this.verbose = true;
        continue;
      }
    }
  }

  parseSort(arg) {
    const sortVal = arg.substring('--sort='.length);
    if (sortVal.startsWith('+')) {
      this.sortField = sortVal.substring(1);
      this.sortAscending = true;
    } else if (sortVal.startsWith('-')) {
      this.sortField = sortVal.substring(1);
      this.sortAscending = false;
    } else {
      this.sortField = sortVal;
      this.sortAscending = false;  // Default to descending
    }
  }

  parseLimit(arg) {
    const limitVal = arg.substring('--limit='.length);
    const match = limitVal.match(/^(-?\d+)[:.]{1,3}(-?\d+)$/);
    if (match) {
      this.limitStart = parseInt(match[1]);
      this.limitEnd = parseInt(match[2]);
    } else if (limitVal.startsWith('-')) {
      this.limitLast = parseInt(limitVal.substring(1));
    } else {
      this.limit = parseInt(limitVal);
    }
  }

  parseFormat(arg) {
    const formatVal = arg.substring('--format='.length);
    if (this.format !== 'json' && this.format !== formatVal) {
      throw new Error('Flags --format and --count are mutually exclusive!');
    }
    this.format = formatVal;
  }

  parseCount(arg) {
    if (this.format !== 'json' && this.format !== 'count') {
      throw new Error('Flags --format and --count are mutually exclusive!');
    }
    this.format = 'count';
  }

  applySort(results) {
    if (!this.sortField) return;
    const pathParts = this.sortField.split('.');
    const ascending = this.sortAscending;
    let getSortKey;

    if (pathParts.length === 1) {
      getSortKey = (obj) => obj[this.sortField];
    } else {
      // Allow sorting by nested properties: --sort=stats.code
      getSortKey = (obj) =>
          pathParts.reduce((acc, part) => (acc ? acc[part] : undefined), obj);
    }

    results.sort((a, b) => {
      const valA = getSortKey(a);
      const valB = getSortKey(b);
      if (valA === undefined || valB === undefined) return 0;
      if (valA < valB) return ascending ? -1 : 1;
      if (valA > valB) return ascending ? 1 : -1;
      return 0;
    });
  }

  applyLimit(results) {
    if (this.limitLast > 0) {
      results.splice(0, results.length - this.limitLast);
    } else if (this.limitStart !== undefined && this.limitEnd !== undefined) {
      const start = this.limitStart;
      const end = this.limitEnd;
      if (end < results.length) {
        results.splice(end);
      }
      if (start > 0) {
        results.splice(0, start);
      }
    } else if (this.limit > 0) {
      results.splice(this.limit);
    }
  }

  reduceToBasic(results) {
    const keys = this.constructor.basicKeys;
    if (!keys) return results;

    return results.map(entry => {
      const reduced = {__proto__: null};
      keys.forEach(key => {
        reduced[key] = entry[key];
      });
      return reduced;
    });
  }

  async processStdInLog(rawArgs) {
    const processor = new Processor();
    processor.verbose = this.verbose;

    printErr('Processing log from stdin...');

    let line;
    let count = 0;
    while (line = readline()) {
      await processor.processLogLine(line);
      count++;
      if (count % 100000 === 0) {
        printErr(`Processed ${count} lines...`);
      }
    }

    await processor.finalize();

    printErr('Processing complete.');

    this.processor = processor;
    this.execute(rawArgs);
  }

  run(args) {
    throw new Error('Subclass responsibility');
  }

  printText(results) {
    if (!Array.isArray(results)) {
      throw new Error('Generic printText only supports arrays of results.');
    }
    const fields = this.constructor.basicKeys;
    if (!fields) {
      throw new Error(`Subclass ${
          this.constructor
              .name} must define static get basicKeys to use generic printText`);
    }

    print(`\n--- ${this.constructor.name.replace('Command', 's')} ---`);
    results.forEach(entry => {
      // 1. Print the basic line
      print(this.formatTextBasicLine(entry));

      // 2. Print details if requested
      if (this.details) {
        this.printTextDetails(entry);
      }
    });
  }

  formatTextBasicLine(entry) {
    const keys = this.constructor.basicKeys;
    return keys.map(key => `${key}: ${this.formatTextValue(entry[key])}`)
        .join(', ');
  }

  formatTextValue(val) {
    if (val === undefined || val === null) return '<none>';

    if (typeof val === 'object' && !Array.isArray(val)) {
      // Handle position-like objects duck-typed
      if (val.line !== undefined && val.column !== undefined) {
        return `${val.line}:${val.column}`;
      }
      // Handle stats-like maps (like the 'code' field in FunctionCommand)
      return `{ ${
          Object.entries(val).map(([k, v]) => `${k} x ${v}`).join(', ')} }`;
    }
    return val;
  }

  printTextDetails(entry) {
    // Subclasses can override printCustomTextDetails(entry)
    if (typeof this.printCustomTextDetails === 'function') {
      this.printCustomTextDetails(entry);
      return;
    }

    // Fallback to safe defaults for common shapes
    if (entry.sourceLines || entry.source) {
      const lines = entry.sourceLines || entry.source;
      print(`  source:`);
      lines.forEach(l => print(`    ${l}`));
    }
  }
}

const STATS_PADDING = 22;

class StatsCommand extends Command {
  static get commandName() {
    return 'stats';
  }
  static get aliases() {
    return ['stat'];
  }

  static get help() {
    return 'Print statistics of all events found in the log.\n\n' +
        'Prints aggregated statistics of all events found in the log, ' +
        'including the total number of loaded scripts, compiled functions, ' +
        'code objects created, Inline Cache (IC) events, maps, ' +
        'deoptimizations, profiler ticks, and timers.\n\n' + EventFilter.help;
  }

  run(args) {
    if (!this.filter.hasFilters()) {
      let functions = 0;
      this.processor.codeTimeline.forEach(entry => {
        if (!entry.isScript && !entry.isBuiltinKind) {
          functions++;
        }
      });

      return {
        scripts: this.processor.scripts.length,
        functions: functions,
        codeObjects: this.processor.codeTimeline.length,
        ics: this.processor.icTimeline.length,
        maps: this.processor.mapTimeline.length,
        deopts: this.processor.deoptTimeline.length,
        ticks: this.processor.tickTimeline.length,
        timers: this.processor.timerTimeline.length
      };
    }

    const stats = {
      scripts: 0,
      functions: 0,
      codeObjects: 0,
      ics: 0,
      maps: 0,
      deopts: 0,
      ticks: 0,
      timers: 0
    };

    this.processor.scripts.forEach(script => {
      if (this.filter.filterScript(script)) stats.scripts++;
    });

    this.processor.codeTimeline.forEach(entry => {
      if (!this.filter.filterCode(entry, this.processor)) return;
      stats.codeObjects++;
      if (!entry.isScript && !entry.isBuiltinKind) {
        stats.functions++;
      }
    });

    this.processor.icTimeline.forEach(entry => {
      if (this.filter.filterIc(entry, this.processor)) stats.ics++;
    });

    this.processor.mapTimeline.forEach(entry => {
      if (this.filter._matchesCommon(entry, null)) stats.maps++;
    });

    this.processor.deoptTimeline.forEach(entry => {
      const script = this.processor.getProfileEntryScript(entry.entry);
      if (this.filter._matchesCommon(entry, script)) stats.deopts++;
    });

    this.processor.tickTimeline.forEach(entry => {
      stats.ticks++;
    });

    this.processor.timerTimeline.forEach(entry => {
      stats.timers++;
    });

    return stats;
  }

  printText(stats) {
    print('\n--- Event Statistics ---');
    print(`scripts:`.padEnd(STATS_PADDING) + stats.scripts);
    print(`functions (compiled):`.padEnd(STATS_PADDING) + stats.functions);
    print(`code objects:`.padEnd(STATS_PADDING) + stats.codeObjects);
    print(`ics:`.padEnd(STATS_PADDING) + stats.ics);
    print(`maps:`.padEnd(STATS_PADDING) + stats.maps);
    print(`deopts:`.padEnd(STATS_PADDING) + stats.deopts);
    print(`ticks:`.padEnd(STATS_PADDING) + stats.ticks);
    print(`timers:`.padEnd(STATS_PADDING) + stats.timers);
  }
}

class IcListCommand extends Command {
  static get commandName() {
    return 'ic-list';
  }
  static get aliases() {
    return [];
  }

  static get help() {
    return 'List detailed information about individual Inline Cache events.\n\n' +
        'ICs are used by V8 to optimize property accesses. The output shows ' +
        'the time of the event, the type of operation, the function name, ' +
        'the state transition (e.g., monomorphic to polymorphic), the key ' +
        'accessed, and the map ID.\n\n' + EventFilter.help;
  }

  static get basicKeys() {
    return ['time', 'type', 'functionName', 'state', 'key', 'map'];
  }

  run(args) {
    const events = [];

    this.processor.icTimeline.forEach(entry => {
      if (!this.filter.filterIc(entry, this.processor)) return;
      events.push(entry.toDetailJSON());
    });

    return events;
  }
}

class ScriptCommand extends Command {
  static get commandName() {
    return 'script';
  }
  static get aliases() {
    return ['scripts'];
  }

  static get help() {
    return 'List all loaded scripts.\n\n' +
        'The output shows the unique script ID, the URL or filename, and ' +
        'the size of the source code in characters. In details mode, it ' +
        'also lists the source code lines.\n\n' + EventFilter.help;
  }

  static get basicKeys() {
    return ['id', 'name', 'size', 'stats'];
  }

  run(args) {
    const results = [];
    this.processor.scripts.forEach(script => {
      if (!this.filter.filterScript(script)) return;
      const detail = script.toDetailJSON();

      const stats = {__proto__: null};
      script.entries.forEach(entry => {
        const key = entry.typeName;
        stats[key] = (stats[key] || 0) + 1;
      });

      detail.stats = stats;
      results.push(detail);
    });

    return results;
  }
}

class CodeCommand extends Command {
  static get commandName() {
    return 'code';
  }
  static get aliases() {
    return ['codes'];
  }

  constructor(processor = null) {
    super(processor);
    this.filter = new CodeFilter();
  }

  static get help() {
    return 'List all created code objects.\n\n' +
        'Lists all code objects created by V8 (e.g., full code, bytecode, ' +
        'handlers). The output shows the time of creation, the event type, ' +
        'the optimization tier (kind), the function or handler name, the ' +
        'size in bytes, and the script ID.\n\n' + CodeFilter.help;
  }

  static get basicKeys() {
    return ['time', 'type', 'kindName', 'name', 'size', 'scriptId'];
  }

  run(args) {
    const results = [];
    this.processor.codeTimeline.forEach(entry => {
      if (!this.filter.filterCodeBasic(entry, this.processor)) return;
      if (!this.filter.matchesCodeKind(entry)) return;

      // Apply line/col filters if active
      if (this.filter.line !== undefined || this.filter.column !== undefined ||
          this.filter.lineRange) {
        if (!entry.entry || !entry.entry.sfi) return;
        const sfi = entry.entry.sfi;
        const name = sfi.getName();
        const match = name.match(/:(\d+):(\d+)$/);
        if (!match) return;

        const line = parseInt(match[1]);
        const column = parseInt(match[2]);

        if (this.filter.line !== undefined && line !== this.filter.line) return;
        if (this.filter.column !== undefined && column !== this.filter.column)
          return;
        if (this.filter.lineRange) {
          if (line < this.filter.lineRange.start ||
              line > this.filter.lineRange.end)
            return;
        }
      }

      results.push(entry.toDetailJSON());
    });

    return results;
  }

  printCustomTextDetails(entry) {
    if (entry.deopts) {
      print(`  deopts:`);
      entry.deopts.forEach(
          d => print(`    reason: ${d.reason}, location: ${d.location}`));
    }
  }
}

class DeoptCommand extends Command {
  static get commandName() {
    return 'deopt';
  }
  static get aliases() {
    return ['deopts'];
  }

  constructor(processor = null) {
    super(processor);
    this.filter = new DeoptFilter();
  }

  static get help() {
    return 'List all deoptimizations.\n\n' +
        'Deoptimizations happen when V8\'s optimistic assumptions are ' +
        'violated, forcing it to fall back to less optimized code. The ' +
        'output shows the time, the deopt type (e.g., eager, lazy), the ' +
        'reason, the location in the source file, the function name, and ' +
        'the script ID.\n\n' + EventFilter.help;
  }

  static get basicKeys() {
    return ['time', 'type', 'reason', 'location', 'functionName', 'scriptId'];
  }

  run(args) {
    const results = [];
    this.processor.deoptTimeline.forEach(entry => {
      const script = this.processor.getProfileEntryScript(entry.entry);
      if (!this.filter._matchesCommon(entry, script)) return;
      if (!this.filter.matchesDeoptType(entry)) return;

      results.push(entry.toDetailJSON());
    });

    return results;
  }
}

class FunctionCommand extends Command {
  static get commandName() {
    return 'function';
  }
  static get aliases() {
    return ['functions'];
  }

  constructor(processor = null) {
    super(processor);
    this.filter = new CodeFilter();
  }

  static get help() {
    return 'List all compiled functions.\n\n' +
        'A function can have multiple code variants (e.g., bytecode and ' +
        'optimized machine code). The output shows the pure function name, ' +
        'the script ID, the number of variants, and a breakdown of the ' +
        'code types created for it.\n\n' + CodeFilter.help;
  }

  static get basicKeys() {
    return ['name', 'scriptId', 'variants', 'code'];
  }

  run(args) {
    const uniqueSFIs = new Map();
    this.processor.codeTimeline.forEach(entry => {
      if (!this.filter.filterCodeBasic(entry, this.processor)) return;
      if (!this.filter.matchesCodeKind(entry)) return;
      if (!entry.entry || !entry.entry.sfi) return;

      const sfi = entry.entry.sfi;
      if (uniqueSFIs.has(sfi)) return;

      const script = this.processor.getProfileEntryScript(entry.entry);

      const info = sfi.toDetailJSON(script);

      if (!this.filter.filterFunction(info)) return;

      uniqueSFIs.set(sfi, info);
    });

    const results = [];
    uniqueSFIs.forEach((info, sfi) => {
      results.push(info);
    });

    return results;
  }
}

class IcCommand extends Command {
  static get commandName() {
    return 'ic';
  }
  static get aliases() {
    return ['ics', 'ic-stats'];
  }

  static get help() {
    return 'Print statistics of Inline Cache events.\n\n' +
        'Aggregates IC events by specified keys (default: functionName) ' +
        'and shows counts for other keys.\n\n' + EventFilter.help + '\n' +
        '  --group-by=<key1,key2,...> Keys to group by (valid: type, ' +
        'functionName, state, key, map)';
  }

  static VALID_KEYS = ['type', 'state', 'functionName', 'key', 'map'];
  static NON_DETAILS_LIMIT = 10;

  static get basicKeys() {
    return ['count', ...this.VALID_KEYS];
  }

  run(args) {
    const VALID_KEYS = this.constructor.VALID_KEYS;
    let groupBy = VALID_KEYS[0];
    for (const arg of args) {
      if (arg.startsWith('--group-by=')) {
        groupBy = arg.substring('--group-by='.length);
      }
    }

    const groupByKeys = [...new Set(groupBy.split(',').map(s => s.trim()))];

    groupByKeys.forEach(k => {
      if (!VALID_KEYS.includes(k)) {
        throw new Error(`Invalid group-by key: ${k}. Valid keys are: ${
            VALID_KEYS.join(', ')}`);
      }
    });

    const stats = new Map();

    this.processor.icTimeline.forEach(entry => {
      if (!this.filter.filterIc(entry, this.processor)) return;

      const detail = entry.toDetailJSON();

      const groupValues = groupByKeys.map(k => detail[k] || '<unknown>');
      const groupKey = JSON.stringify(groupValues);

      let groupStats = stats.get(groupKey);
      if (!groupStats) {
        groupStats = {__proto__: null, count: 0};
        groupByKeys.forEach((k, i) => {
          groupStats[k] = groupValues[i];
        });
        VALID_KEYS.forEach(k => {
          if (!groupByKeys.includes(k)) {
            groupStats[k] = {__proto__: null};
          }
        });
        stats.set(groupKey, groupStats);
      }

      groupStats.count++;

      VALID_KEYS.forEach(k => {
        if (!groupByKeys.includes(k)) {
          const val = detail[k] || '<unknown>';
          groupStats[k][val] = (groupStats[k][val] || 0) + 1;
        }
      });
    });

    let results = Array.from(stats.values());

    // Default sort by count descending if no sort specified
    if (!this.sortField) {
      results.sort((a, b) => b.count - a.count);
    }

    // Apply details logic
    if (!this.details) {
      results = results.map(group => {
        const reducedGroup = {__proto__: null, count: group.count};
        groupByKeys.forEach(k => {
          reducedGroup[k] = group[k];
        });

        VALID_KEYS.forEach(k => {
          if (!groupByKeys.includes(k)) {
            const subMap = group[k];
            const sortedEntries =
                Object.entries(subMap)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, this.constructor.NON_DETAILS_LIMIT);

            const reducedSubMap = {__proto__: null};
            sortedEntries.forEach(([key, val]) => {
              reducedSubMap[key] = val;
            });
            reducedGroup[k] = reducedSubMap;
          }
        });
        return reducedGroup;
      });
    }

    return results;
  }
}

const COMMANDS = Object.freeze([
  StatsCommand,
  ScriptCommand,
  CodeCommand,
  FunctionCommand,
  DeoptCommand,
  IcCommand,
  IcListCommand,
]);

const COMMANDS_LOOKUP = {
  __proto__: null
};
for (const cls of COMMANDS) {
  COMMANDS_LOOKUP[cls.commandName] = cls;
  for (const alias of cls.aliases) {
    COMMANDS_LOOKUP[alias] = cls;
  }
}
Object.freeze(COMMANDS_LOOKUP);

function handleHelp(commandName, args) {
  const CommandClass = COMMANDS_LOOKUP[commandName];
  if (CommandClass) {
    print(CommandClass.help);
    return;
  }

  print('Usage: tools/logviewer <command> <v8.log> [options]');
  print('\nCommands:');
  for (const cls of COMMANDS) {
    print(`  ${cls.commandName.padEnd(10)} ${cls.help.split('\n')[0]}`);
  }
  print('\n' + EventFilter.help);
}

export async function main(args = []) {
  const commandName = args[0];
  if (!commandName) {
    throw new Error(`No subcommand provided. Valid commands are: ${
        COMMANDS.map(c => c.commandName).join(', ')}`);
  }

  if (commandName === 'help' || commandName === '--help') {
    handleHelp(args[1], args);
    return;
  }

  const CommandClass = COMMANDS_LOOKUP[commandName];
  if (!CommandClass) {
    throw new Error(
        `Invalid subcommand: '${commandName}'. Valid commands are: ${
            COMMANDS.map(c => c.commandName).join(', ')}`);
  }

  const cmd = new CommandClass();
  const rawArgs = Array.prototype.slice.call(args, 1);
  cmd.parseArgs(rawArgs);
  await cmd.processStdInLog(rawArgs);
}

if (globalThis.arguments) {
  main(globalThis.arguments);
}

export {
  StatsCommand,
  ScriptCommand,
  CodeCommand,
  DeoptCommand,
  FunctionCommand,
  IcCommand,
  IcListCommand,
  COMMANDS,
  COMMANDS_LOOKUP
};
