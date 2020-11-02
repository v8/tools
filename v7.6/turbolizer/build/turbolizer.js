(function () {
  'use strict';

  // Copyright 2015 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  function anyToString(x) {
      return "" + x;
  }
  function computeScrollTop(container, element) {
      const height = container.offsetHeight;
      const margin = Math.floor(height / 4);
      const pos = element.offsetTop;
      const currentScrollTop = container.scrollTop;
      if (pos < currentScrollTop + margin) {
          return Math.max(0, pos - margin);
      }
      else if (pos > (currentScrollTop + 3 * margin)) {
          return Math.max(0, pos - 3 * margin);
      }
      return pos;
  }
  class ViewElements {
      constructor(container) {
          this.container = container;
          this.scrollTop = undefined;
      }
      consider(element, doConsider) {
          if (!doConsider)
              return;
          const newScrollTop = computeScrollTop(this.container, element);
          if (isNaN(newScrollTop)) {
              console.log("NOO");
          }
          if (this.scrollTop === undefined) {
              this.scrollTop = newScrollTop;
          }
          else {
              this.scrollTop = Math.min(this.scrollTop, newScrollTop);
          }
      }
      apply(doApply) {
          if (!doApply || this.scrollTop === undefined)
              return;
          this.container.scrollTop = this.scrollTop;
      }
  }
  function sortUnique(arr, f, equal) {
      if (arr.length == 0)
          return arr;
      arr = arr.sort(f);
      const ret = [arr[0]];
      for (let i = 1; i < arr.length; i++) {
          if (!equal(arr[i - 1], arr[i])) {
              ret.push(arr[i]);
          }
      }
      return ret;
  }
  // Partial application without binding the receiver
  function partial(f, ...arguments1) {
      return function (...arguments2) {
          f.apply(this, [...arguments1, ...arguments2]);
      };
  }
  function isIterable(obj) {
      return obj != null && obj != undefined
          && typeof obj != 'string' && typeof obj[Symbol.iterator] === 'function';
  }
  function alignUp(raw, multiple) {
      return Math.floor((raw + multiple - 1) / multiple) * multiple;
  }
  function measureText(text) {
      const textMeasure = document.getElementById('text-measure');
      if (textMeasure instanceof SVGTSpanElement) {
          textMeasure.textContent = text;
          return {
              width: textMeasure.getBBox().width,
              height: textMeasure.getBBox().height,
          };
      }
      return { width: 0, height: 0 };
  }
  // Interpolate between the given start and end values by a fraction of val/max.
  function interpolate(val, max, start, end) {
      return start + (end - start) * (val / max);
  }

  // Copyright 2019 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  function formatOrigin(origin) {
      if (origin.nodeId) {
          return `#${origin.nodeId} in phase ${origin.phase}/${origin.reducer}`;
      }
      if (origin.bytecodePosition) {
          return `Bytecode line ${origin.bytecodePosition} in phase ${origin.phase}/${origin.reducer}`;
      }
      return "unknown origin";
  }
  class NodeLabel {
      constructor(id, label, title, live, properties, sourcePosition, origin, opcode, control, opinfo, type) {
          this.id = id;
          this.label = label;
          this.title = title;
          this.live = live;
          this.properties = properties;
          this.sourcePosition = sourcePosition;
          this.origin = origin;
          this.opcode = opcode;
          this.control = control;
          this.opinfo = opinfo;
          this.type = type;
          this.inplaceUpdatePhase = null;
      }
      equals(that) {
          if (!that)
              return false;
          if (this.id != that.id)
              return false;
          if (this.label != that.label)
              return false;
          if (this.title != that.title)
              return false;
          if (this.live != that.live)
              return false;
          if (this.properties != that.properties)
              return false;
          if (this.opcode != that.opcode)
              return false;
          if (this.control != that.control)
              return false;
          if (this.opinfo != that.opinfo)
              return false;
          if (this.type != that.type)
              return false;
          return true;
      }
      getTitle() {
          let propsString = "";
          if (this.properties === "") {
              propsString = "no properties";
          }
          else {
              propsString = "[" + this.properties + "]";
          }
          let title = this.title + "\n" + propsString + "\n" + this.opinfo;
          if (this.origin) {
              title += `\nOrigin: ${formatOrigin(this.origin)}`;
          }
          if (this.inplaceUpdatePhase) {
              title += `\nInplace update in phase: ${this.inplaceUpdatePhase}`;
          }
          return title;
      }
      getDisplayLabel() {
          const result = `${this.id}: ${this.label}`;
          if (result.length > 40) {
              return `${this.id}: ${this.opcode}`;
          }
          return result;
      }
      setInplaceUpdatePhase(name) {
          this.inplaceUpdatePhase = name;
      }
  }

  // Copyright 2018 the V8 project authors. All rights reserved.
  function sourcePositionLe(a, b) {
      if (a.inliningId == b.inliningId) {
          return a.scriptOffset - b.scriptOffset;
      }
      return a.inliningId - b.inliningId;
  }
  function sourcePositionEq(a, b) {
      return a.inliningId == b.inliningId &&
          a.scriptOffset == b.scriptOffset;
  }
  function sourcePositionToStringKey(sourcePosition) {
      if (!sourcePosition)
          return "undefined";
      if ('inliningId' in sourcePosition && 'scriptOffset' in sourcePosition) {
          return "SP:" + sourcePosition.inliningId + ":" + sourcePosition.scriptOffset;
      }
      if (sourcePosition.bytecodePosition) {
          return "BCP:" + sourcePosition.bytecodePosition;
      }
      return "undefined";
  }
  function sourcePositionValid(l) {
      return (typeof l.scriptOffset !== undefined
          && typeof l.inliningId !== undefined) || typeof l.bytecodePosition != undefined;
  }
  class SourceResolver {
      constructor() {
          // Maps node ids to source positions.
          this.nodePositionMap = [];
          // Maps source ids to source objects.
          this.sources = [];
          // Maps inlining ids to inlining objects.
          this.inlinings = [];
          // Maps source position keys to inlinings.
          this.inliningsMap = new Map();
          // Maps source position keys to node ids.
          this.positionToNodes = new Map();
          // Maps phase ids to phases.
          this.phases = [];
          // Maps phase names to phaseIds.
          this.phaseNames = new Map();
          // The disassembly phase is stored separately.
          this.disassemblyPhase = undefined;
          // Maps line numbers to source positions
          this.lineToSourcePositions = new Map();
          // Maps node ids to instruction ranges.
          this.nodeIdToInstructionRange = [];
          // Maps block ids to instruction ranges.
          this.blockIdToInstructionRange = [];
          // Maps instruction numbers to PC offsets.
          this.instructionToPCOffset = [];
          // Maps PC offsets to instructions.
          this.pcOffsetToInstructions = new Map();
          this.pcOffsets = [];
      }
      setSources(sources, mainBackup) {
          if (sources) {
              for (const [sourceId, source] of Object.entries(sources)) {
                  this.sources[sourceId] = source;
                  this.sources[sourceId].sourcePositions = [];
              }
          }
          // This is a fallback if the JSON is incomplete (e.g. due to compiler crash).
          if (!this.sources[-1]) {
              this.sources[-1] = mainBackup;
              this.sources[-1].sourcePositions = [];
          }
      }
      setInlinings(inlinings) {
          if (inlinings) {
              for (const [inliningId, inlining] of Object.entries(inlinings)) {
                  this.inlinings[inliningId] = inlining;
                  this.inliningsMap.set(sourcePositionToStringKey(inlining.inliningPosition), inlining);
              }
          }
          // This is a default entry for the script itself that helps
          // keep other code more uniform.
          this.inlinings[-1] = { sourceId: -1, inliningPosition: null };
      }
      setNodePositionMap(map) {
          if (!map)
              return;
          if (typeof map[0] != 'object') {
              const alternativeMap = {};
              for (const [nodeId, scriptOffset] of Object.entries(map)) {
                  alternativeMap[nodeId] = { scriptOffset: scriptOffset, inliningId: -1 };
              }
              map = alternativeMap;
          }
          for (const [nodeId, sourcePosition] of Object.entries(map)) {
              if (sourcePosition == undefined) {
                  console.log("Warning: undefined source position ", sourcePosition, " for nodeId ", nodeId);
              }
              const inliningId = sourcePosition.inliningId;
              const inlining = this.inlinings[inliningId];
              if (inlining) {
                  const sourceId = inlining.sourceId;
                  this.sources[sourceId].sourcePositions.push(sourcePosition);
              }
              this.nodePositionMap[nodeId] = sourcePosition;
              const key = sourcePositionToStringKey(sourcePosition);
              if (!this.positionToNodes.has(key)) {
                  this.positionToNodes.set(key, []);
              }
              this.positionToNodes.get(key).push(nodeId);
          }
          for (const [, source] of Object.entries(this.sources)) {
              source.sourcePositions = sortUnique(source.sourcePositions, sourcePositionLe, sourcePositionEq);
          }
      }
      sourcePositionsToNodeIds(sourcePositions) {
          const nodeIds = new Set();
          for (const sp of sourcePositions) {
              const key = sourcePositionToStringKey(sp);
              const nodeIdsForPosition = this.positionToNodes.get(key);
              if (!nodeIdsForPosition)
                  continue;
              for (const nodeId of nodeIdsForPosition) {
                  nodeIds.add(nodeId);
              }
          }
          return nodeIds;
      }
      nodeIdsToSourcePositions(nodeIds) {
          const sourcePositions = new Map();
          for (const nodeId of nodeIds) {
              const sp = this.nodePositionMap[nodeId];
              const key = sourcePositionToStringKey(sp);
              sourcePositions.set(key, sp);
          }
          const sourcePositionArray = [];
          for (const sp of sourcePositions.values()) {
              sourcePositionArray.push(sp);
          }
          return sourcePositionArray;
      }
      forEachSource(f) {
          this.sources.forEach(f);
      }
      translateToSourceId(sourceId, location) {
          for (const position of this.getInlineStack(location)) {
              const inlining = this.inlinings[position.inliningId];
              if (!inlining)
                  continue;
              if (inlining.sourceId == sourceId) {
                  return position;
              }
          }
          return location;
      }
      addInliningPositions(sourcePosition, locations) {
          const inlining = this.inliningsMap.get(sourcePositionToStringKey(sourcePosition));
          if (!inlining)
              return;
          const sourceId = inlining.sourceId;
          const source = this.sources[sourceId];
          for (const sp of source.sourcePositions) {
              locations.push(sp);
              this.addInliningPositions(sp, locations);
          }
      }
      getInliningForPosition(sourcePosition) {
          return this.inliningsMap.get(sourcePositionToStringKey(sourcePosition));
      }
      getSource(sourceId) {
          return this.sources[sourceId];
      }
      getSourceName(sourceId) {
          const source = this.sources[sourceId];
          return `${source.sourceName}:${source.functionName}`;
      }
      sourcePositionFor(sourceId, scriptOffset) {
          if (!this.sources[sourceId]) {
              return null;
          }
          const list = this.sources[sourceId].sourcePositions;
          for (let i = 0; i < list.length; i++) {
              const sourcePosition = list[i];
              const position = sourcePosition.scriptOffset;
              const nextPosition = list[Math.min(i + 1, list.length - 1)].scriptOffset;
              if ((position <= scriptOffset && scriptOffset < nextPosition)) {
                  return sourcePosition;
              }
          }
          return null;
      }
      sourcePositionsInRange(sourceId, start, end) {
          if (!this.sources[sourceId])
              return [];
          const res = [];
          const list = this.sources[sourceId].sourcePositions;
          for (const sourcePosition of list) {
              if (start <= sourcePosition.scriptOffset && sourcePosition.scriptOffset < end) {
                  res.push(sourcePosition);
              }
          }
          return res;
      }
      getInlineStack(sourcePosition) {
          if (!sourcePosition)
              return [];
          const inliningStack = [];
          let cur = sourcePosition;
          while (cur && cur.inliningId != -1) {
              inliningStack.push(cur);
              const inlining = this.inlinings[cur.inliningId];
              if (!inlining) {
                  break;
              }
              cur = inlining.inliningPosition;
          }
          if (cur && cur.inliningId == -1) {
              inliningStack.push(cur);
          }
          return inliningStack;
      }
      recordOrigins(phase) {
          if (phase.type != "graph")
              return;
          for (const node of phase.data.nodes) {
              phase.highestNodeId = Math.max(phase.highestNodeId, node.id);
              if (node.origin != undefined &&
                  node.origin.bytecodePosition != undefined) {
                  const position = { bytecodePosition: node.origin.bytecodePosition };
                  this.nodePositionMap[node.id] = position;
                  const key = sourcePositionToStringKey(position);
                  if (!this.positionToNodes.has(key)) {
                      this.positionToNodes.set(key, []);
                  }
                  const A = this.positionToNodes.get(key);
                  if (!A.includes(node.id))
                      A.push(`${node.id}`);
              }
              // Backwards compatibility.
              if (typeof node.pos === "number") {
                  node.sourcePosition = { scriptOffset: node.pos, inliningId: -1 };
              }
          }
      }
      readNodeIdToInstructionRange(nodeIdToInstructionRange) {
          for (const [nodeId, range] of Object.entries(nodeIdToInstructionRange)) {
              this.nodeIdToInstructionRange[nodeId] = range;
          }
      }
      readBlockIdToInstructionRange(blockIdToInstructionRange) {
          for (const [blockId, range] of Object.entries(blockIdToInstructionRange)) {
              this.blockIdToInstructionRange[blockId] = range;
          }
      }
      getInstruction(nodeId) {
          const X = this.nodeIdToInstructionRange[nodeId];
          if (X === undefined)
              return [-1, -1];
          return X;
      }
      getInstructionRangeForBlock(blockId) {
          const X = this.blockIdToInstructionRange[blockId];
          if (X === undefined)
              return [-1, -1];
          return X;
      }
      readInstructionOffsetToPCOffset(instructionToPCOffset) {
          for (const [instruction, offset] of Object.entries(instructionToPCOffset)) {
              this.instructionToPCOffset[instruction] = offset;
              if (!this.pcOffsetToInstructions.has(offset)) {
                  this.pcOffsetToInstructions.set(offset, []);
              }
              this.pcOffsetToInstructions.get(offset).push(Number(instruction));
          }
          this.pcOffsets = Array.from(this.pcOffsetToInstructions.keys()).sort((a, b) => b - a);
      }
      hasPCOffsets() {
          return this.pcOffsetToInstructions.size > 0;
      }
      getKeyPcOffset(offset) {
          if (this.pcOffsets.length === 0)
              return -1;
          for (const key of this.pcOffsets) {
              if (key <= offset) {
                  return key;
              }
          }
          return -1;
      }
      instructionRangeToKeyPcOffsets([start, end]) {
          if (start == end)
              return [this.instructionToPCOffset[start]];
          return this.instructionToPCOffset.slice(start, end);
      }
      instructionsToKeyPcOffsets(instructionIds) {
          const keyPcOffsets = [];
          for (const instructionId of instructionIds) {
              keyPcOffsets.push(this.instructionToPCOffset[instructionId]);
          }
          return keyPcOffsets;
      }
      nodesToKeyPcOffsets(nodes) {
          let offsets = [];
          for (const node of nodes) {
              const range = this.nodeIdToInstructionRange[node];
              if (!range)
                  continue;
              offsets = offsets.concat(this.instructionRangeToKeyPcOffsets(range));
          }
          return offsets;
      }
      nodesForPCOffset(offset) {
          if (this.pcOffsets.length === 0)
              return [[], []];
          for (const key of this.pcOffsets) {
              if (key <= offset) {
                  const instrs = this.pcOffsetToInstructions.get(key);
                  const nodes = [];
                  const blocks = [];
                  for (const instr of instrs) {
                      for (const [nodeId, range] of this.nodeIdToInstructionRange.entries()) {
                          if (!range)
                              continue;
                          const [start, end] = range;
                          if (start == end && instr == start) {
                              nodes.push("" + nodeId);
                          }
                          if (start <= instr && instr < end) {
                              nodes.push("" + nodeId);
                          }
                      }
                  }
                  return [nodes, blocks];
              }
          }
          return [[], []];
      }
      parsePhases(phases) {
          const nodeLabelMap = [];
          for (const [, phase] of Object.entries(phases)) {
              switch (phase.type) {
                  case 'disassembly':
                      this.disassemblyPhase = phase;
                      break;
                  case 'schedule':
                      this.phaseNames.set(phase.name, this.phases.length);
                      this.phases.push(this.parseSchedule(phase));
                      break;
                  case 'sequence':
                      this.phaseNames.set(phase.name, this.phases.length);
                      this.phases.push(this.parseSequence(phase));
                      break;
                  case 'instructions':
                      if (phase.nodeIdToInstructionRange) {
                          this.readNodeIdToInstructionRange(phase.nodeIdToInstructionRange);
                      }
                      if (phase.blockIdtoInstructionRange) {
                          this.readBlockIdToInstructionRange(phase.blockIdtoInstructionRange);
                      }
                      if (phase.instructionOffsetToPCOffset) {
                          this.readInstructionOffsetToPCOffset(phase.instructionOffsetToPCOffset);
                      }
                      break;
                  case 'graph':
                      const graphPhase = Object.assign(phase, { highestNodeId: 0 });
                      this.phaseNames.set(graphPhase.name, this.phases.length);
                      this.phases.push(graphPhase);
                      this.recordOrigins(graphPhase);
                      this.internNodeLabels(graphPhase, nodeLabelMap);
                      graphPhase.nodeLabelMap = nodeLabelMap.slice();
                      break;
                  default:
                      throw "Unsupported phase type";
              }
          }
      }
      internNodeLabels(phase, nodeLabelMap) {
          for (const n of phase.data.nodes) {
              const label = new NodeLabel(n.id, n.label, n.title, n.live, n.properties, n.sourcePosition, n.origin, n.opcode, n.control, n.opinfo, n.type);
              const previous = nodeLabelMap[label.id];
              if (!label.equals(previous)) {
                  if (previous != undefined) {
                      label.setInplaceUpdatePhase(phase.name);
                  }
                  nodeLabelMap[label.id] = label;
              }
              n.nodeLabel = nodeLabelMap[label.id];
          }
      }
      repairPhaseId(anyPhaseId) {
          return Math.max(0, Math.min(anyPhaseId | 0, this.phases.length - 1));
      }
      getPhase(phaseId) {
          return this.phases[phaseId];
      }
      getPhaseIdByName(phaseName) {
          return this.phaseNames.get(phaseName);
      }
      forEachPhase(f) {
          this.phases.forEach(f);
      }
      addAnyPositionToLine(lineNumber, sourcePosition) {
          const lineNumberString = anyToString(lineNumber);
          if (!this.lineToSourcePositions.has(lineNumberString)) {
              this.lineToSourcePositions.set(lineNumberString, []);
          }
          const A = this.lineToSourcePositions.get(lineNumberString);
          if (!A.includes(sourcePosition))
              A.push(sourcePosition);
      }
      setSourceLineToBytecodePosition(sourceLineToBytecodePosition) {
          if (!sourceLineToBytecodePosition)
              return;
          sourceLineToBytecodePosition.forEach((pos, i) => {
              this.addAnyPositionToLine(i, { bytecodePosition: pos });
          });
      }
      linetoSourcePositions(lineNumber) {
          const positions = this.lineToSourcePositions.get(anyToString(lineNumber));
          if (positions === undefined)
              return [];
          return positions;
      }
      parseSchedule(phase) {
          function createNode(state, match) {
              let inputs = [];
              if (match.groups.args) {
                  const nodeIdsString = match.groups.args.replace(/\s/g, '');
                  const nodeIdStrings = nodeIdsString.split(',');
                  inputs = nodeIdStrings.map(n => Number.parseInt(n, 10));
              }
              const node = {
                  id: Number.parseInt(match.groups.id, 10),
                  label: match.groups.label,
                  inputs: inputs
              };
              if (match.groups.blocks) {
                  const nodeIdsString = match.groups.blocks.replace(/\s/g, '').replace(/B/g, '');
                  const nodeIdStrings = nodeIdsString.split(',');
                  const successors = nodeIdStrings.map(n => Number.parseInt(n, 10));
                  state.currentBlock.succ = successors;
              }
              state.nodes[node.id] = node;
              state.currentBlock.nodes.push(node);
          }
          function createBlock(state, match) {
              let predecessors = [];
              if (match.groups.in) {
                  const blockIdsString = match.groups.in.replace(/\s/g, '').replace(/B/g, '');
                  const blockIdStrings = blockIdsString.split(',');
                  predecessors = blockIdStrings.map(n => Number.parseInt(n, 10));
              }
              const block = {
                  id: Number.parseInt(match.groups.id, 10),
                  isDeferred: match.groups.deferred != undefined,
                  pred: predecessors.sort(),
                  succ: [],
                  nodes: []
              };
              state.blocks[block.id] = block;
              state.currentBlock = block;
          }
          function setGotoSuccessor(state, match) {
              state.currentBlock.succ = [Number.parseInt(match.groups.successor.replace(/\s/g, ''), 10)];
          }
          const rules = [
              {
                  lineRegexps: [/^\s*(?<id>\d+):\ (?<label>.*)\((?<args>.*)\)$/,
                      /^\s*(?<id>\d+):\ (?<label>.*)\((?<args>.*)\)\ ->\ (?<blocks>.*)$/,
                      /^\s*(?<id>\d+):\ (?<label>.*)$/
                  ],
                  process: createNode
              },
              {
                  lineRegexps: [/^\s*---\s*BLOCK\ B(?<id>\d+)\s*(?<deferred>\(deferred\))?(\ <-\ )?(?<in>[^-]*)?\ ---$/
                  ],
                  process: createBlock
              },
              {
                  lineRegexps: [/^\s*Goto\s*->\s*B(?<successor>\d+)\s*$/
                  ],
                  process: setGotoSuccessor
              }
          ];
          const lines = phase.data.split(/[\n]/);
          const state = { currentBlock: undefined, blocks: [], nodes: [] };
          nextLine: for (const line of lines) {
              for (const rule of rules) {
                  for (const lineRegexp of rule.lineRegexps) {
                      const match = line.match(lineRegexp);
                      if (match) {
                          rule.process(state, match);
                          continue nextLine;
                      }
                  }
              }
              console.log("Warning: unmatched schedule line \"" + line + "\"");
          }
          phase.schedule = state;
          return phase;
      }
      parseSequence(phase) {
          phase.sequence = { blocks: phase.blocks };
          return phase;
      }
  }

  // Copyright 2015 the V8 project authors. All rights reserved.
  class SelectionBroker {
      constructor(sourceResolver) {
          this.allHandlers = [];
          this.sourcePositionHandlers = [];
          this.nodeHandlers = [];
          this.blockHandlers = [];
          this.instructionHandlers = [];
          this.sourceResolver = sourceResolver;
      }
      addSourcePositionHandler(handler) {
          this.allHandlers.push(handler);
          this.sourcePositionHandlers.push(handler);
      }
      addNodeHandler(handler) {
          this.allHandlers.push(handler);
          this.nodeHandlers.push(handler);
      }
      addBlockHandler(handler) {
          this.allHandlers.push(handler);
          this.blockHandlers.push(handler);
      }
      addInstructionHandler(handler) {
          this.allHandlers.push(handler);
          this.instructionHandlers.push(handler);
      }
      broadcastInstructionSelect(from, instructionOffsets, selected) {
          for (const b of this.instructionHandlers) {
              if (b != from)
                  b.brokeredInstructionSelect(instructionOffsets, selected);
          }
      }
      broadcastSourcePositionSelect(from, sourcePositions, selected) {
          sourcePositions = sourcePositions.filter(l => {
              if (!sourcePositionValid(l)) {
                  console.log("Warning: invalid source position");
                  return false;
              }
              return true;
          });
          for (const b of this.sourcePositionHandlers) {
              if (b != from)
                  b.brokeredSourcePositionSelect(sourcePositions, selected);
          }
          const nodes = this.sourceResolver.sourcePositionsToNodeIds(sourcePositions);
          for (const b of this.nodeHandlers) {
              if (b != from)
                  b.brokeredNodeSelect(nodes, selected);
          }
      }
      broadcastNodeSelect(from, nodes, selected) {
          for (const b of this.nodeHandlers) {
              if (b != from)
                  b.brokeredNodeSelect(nodes, selected);
          }
          const sourcePositions = this.sourceResolver.nodeIdsToSourcePositions(nodes);
          for (const b of this.sourcePositionHandlers) {
              if (b != from)
                  b.brokeredSourcePositionSelect(sourcePositions, selected);
          }
      }
      broadcastBlockSelect(from, blocks, selected) {
          for (const b of this.blockHandlers) {
              if (b != from)
                  b.brokeredBlockSelect(blocks, selected);
          }
      }
      broadcastClear(from) {
          this.allHandlers.forEach(function (b) {
              if (b != from)
                  b.brokeredClear();
          });
      }
  }

  // Copyright 2014 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  const MAX_RANK_SENTINEL = 0;
  const SOURCE_PANE_ID = 'left';
  const SOURCE_COLLAPSE_ID = 'source-shrink';
  const SOURCE_EXPAND_ID = 'source-expand';
  const INTERMEDIATE_PANE_ID = 'middle';
  const GENERATED_PANE_ID = 'right';
  const DISASSEMBLY_COLLAPSE_ID = 'disassembly-shrink';
  const DISASSEMBLY_EXPAND_ID = 'disassembly-expand';
  const UNICODE_BLOCK = '&#9611;';
  const PROF_COLS = [
      { perc: 0, col: { r: 255, g: 255, b: 255 } },
      { perc: 0.5, col: { r: 255, g: 255, b: 128 } },
      { perc: 5, col: { r: 255, g: 128, b: 0 } },
      { perc: 15, col: { r: 255, g: 0, b: 0 } },
      { perc: 100, col: { r: 0, g: 0, b: 0 } }
  ];

  // Copyright 2015 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  class View {
      constructor(idOrContainer) {
          this.container = typeof idOrContainer == "string" ? document.getElementById(idOrContainer) : idOrContainer;
          this.divNode = this.createViewElement();
      }
      show() {
          this.container.appendChild(this.divNode);
      }
      hide() {
          this.container.removeChild(this.divNode);
      }
  }
  class PhaseView extends View {
      constructor(idOrContainer) {
          super(idOrContainer);
      }
      isScrollable() {
          return false;
      }
  }

  // Copyright 2015 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  class MySelection {
      constructor(stringKeyFnc) {
          this.selection = new Map();
          this.stringKey = stringKeyFnc;
      }
      isEmpty() {
          return this.selection.size == 0;
      }
      clear() {
          this.selection = new Map();
      }
      select(s, isSelected) {
          for (const i of s) {
              if (!i)
                  continue;
              if (isSelected == undefined) {
                  isSelected = !this.selection.has(this.stringKey(i));
              }
              if (isSelected) {
                  this.selection.set(this.stringKey(i), i);
              }
              else {
                  this.selection.delete(this.stringKey(i));
              }
          }
      }
      isSelected(i) {
          return this.selection.has(this.stringKey(i));
      }
      isKeySelected(key) {
          return this.selection.has(key);
      }
      selectedKeys() {
          const result = new Set();
          for (const i of this.selection.keys()) {
              result.add(i);
          }
          return result;
      }
      detachSelection() {
          const result = this.selectedKeys();
          this.clear();
          return result;
      }
      [Symbol.iterator]() { return this.selection.values(); }
  }

  // Copyright 2015 the V8 project authors. All rights reserved.
  class TextView extends PhaseView {
      constructor(id, broker) {
          super(id);
          const view = this;
          view.textListNode = view.divNode.getElementsByTagName('ul')[0];
          view.patterns = null;
          view.nodeIdToHtmlElementsMap = new Map();
          view.blockIdToHtmlElementsMap = new Map();
          view.blockIdtoNodeIds = new Map();
          view.nodeIdToBlockId = [];
          view.selection = new MySelection(anyToString);
          view.blockSelection = new MySelection(anyToString);
          view.broker = broker;
          view.sourceResolver = broker.sourceResolver;
          const selectionHandler = {
              clear: function () {
                  view.selection.clear();
                  view.updateSelection();
                  broker.broadcastClear(selectionHandler);
              },
              select: function (nodeIds, selected) {
                  view.selection.select(nodeIds, selected);
                  view.updateSelection();
                  broker.broadcastNodeSelect(selectionHandler, view.selection.selectedKeys(), selected);
              },
              brokeredNodeSelect: function (nodeIds, selected) {
                  const firstSelect = view.blockSelection.isEmpty();
                  view.selection.select(nodeIds, selected);
                  view.updateSelection(firstSelect);
              },
              brokeredClear: function () {
                  view.selection.clear();
                  view.updateSelection();
              }
          };
          this.selectionHandler = selectionHandler;
          broker.addNodeHandler(selectionHandler);
          view.divNode.addEventListener('click', e => {
              if (!e.shiftKey) {
                  view.selectionHandler.clear();
              }
              e.stopPropagation();
          });
          const blockSelectionHandler = {
              clear: function () {
                  view.blockSelection.clear();
                  view.updateSelection();
                  broker.broadcastClear(blockSelectionHandler);
              },
              select: function (blockIds, selected) {
                  view.blockSelection.select(blockIds, selected);
                  view.updateSelection();
                  broker.broadcastBlockSelect(blockSelectionHandler, blockIds, selected);
              },
              brokeredBlockSelect: function (blockIds, selected) {
                  const firstSelect = view.blockSelection.isEmpty();
                  view.blockSelection.select(blockIds, selected);
                  view.updateSelection(firstSelect);
              },
              brokeredClear: function () {
                  view.blockSelection.clear();
                  view.updateSelection();
              }
          };
          this.blockSelectionHandler = blockSelectionHandler;
          broker.addBlockHandler(blockSelectionHandler);
      }
      addHtmlElementForNodeId(anyNodeId, htmlElement) {
          const nodeId = anyToString(anyNodeId);
          if (!this.nodeIdToHtmlElementsMap.has(nodeId)) {
              this.nodeIdToHtmlElementsMap.set(nodeId, []);
          }
          this.nodeIdToHtmlElementsMap.get(nodeId).push(htmlElement);
      }
      addHtmlElementForBlockId(anyBlockId, htmlElement) {
          const blockId = anyToString(anyBlockId);
          if (!this.blockIdToHtmlElementsMap.has(blockId)) {
              this.blockIdToHtmlElementsMap.set(blockId, []);
          }
          this.blockIdToHtmlElementsMap.get(blockId).push(htmlElement);
      }
      addNodeIdToBlockId(anyNodeId, anyBlockId) {
          const blockId = anyToString(anyBlockId);
          if (!this.blockIdtoNodeIds.has(blockId)) {
              this.blockIdtoNodeIds.set(blockId, []);
          }
          this.blockIdtoNodeIds.get(blockId).push(anyToString(anyNodeId));
          this.nodeIdToBlockId[anyNodeId] = blockId;
      }
      blockIdsForNodeIds(nodeIds) {
          const blockIds = [];
          for (const nodeId of nodeIds) {
              const blockId = this.nodeIdToBlockId[nodeId];
              if (blockId == undefined)
                  continue;
              blockIds.push(blockId);
          }
          return blockIds;
      }
      updateSelection(scrollIntoView = false) {
          if (this.divNode.parentNode == null)
              return;
          const mkVisible = new ViewElements(this.divNode.parentNode);
          const view = this;
          for (const [blockId, elements] of this.blockIdToHtmlElementsMap.entries()) {
              const isSelected = view.blockSelection.isSelected(blockId);
              for (const element of elements) {
                  mkVisible.consider(element, isSelected);
                  element.classList.toggle("selected", isSelected);
              }
          }
          const elementsToSelect = view.divNode.querySelectorAll(`[data-pc-offset]`);
          for (const el of elementsToSelect) {
              el.classList.toggle("selected", false);
          }
          for (const key of this.nodeIdToHtmlElementsMap.keys()) {
              for (const element of this.nodeIdToHtmlElementsMap.get(key)) {
                  element.classList.toggle("selected", false);
              }
          }
          for (const nodeId of view.selection.selectedKeys()) {
              const elements = this.nodeIdToHtmlElementsMap.get(nodeId);
              if (!elements)
                  continue;
              for (const element of elements) {
                  mkVisible.consider(element, true);
                  element.classList.toggle("selected", true);
              }
          }
          mkVisible.apply(scrollIntoView);
      }
      setPatterns(patterns) {
          this.patterns = patterns;
      }
      clearText() {
          while (this.textListNode.firstChild) {
              this.textListNode.removeChild(this.textListNode.firstChild);
          }
      }
      createFragment(text, style) {
          const fragment = document.createElement("SPAN");
          if (typeof style.associateData == 'function') {
              style.associateData(text, fragment);
          }
          else {
              if (style.css != undefined) {
                  const css = isIterable(style.css) ? style.css : [style.css];
                  for (const cls of css) {
                      fragment.classList.add(cls);
                  }
              }
              fragment.innerText = text;
          }
          return fragment;
      }
      processLine(line) {
          const view = this;
          const result = [];
          let patternSet = 0;
          while (true) {
              const beforeLine = line;
              for (const pattern of view.patterns[patternSet]) {
                  const matches = line.match(pattern[0]);
                  if (matches != null) {
                      if (matches[0] != '') {
                          const style = pattern[1] != null ? pattern[1] : {};
                          const text = matches[0];
                          if (text != '') {
                              const fragment = view.createFragment(matches[0], style);
                              result.push(fragment);
                          }
                          line = line.substr(matches[0].length);
                      }
                      let nextPatternSet = patternSet;
                      if (pattern.length > 2) {
                          nextPatternSet = pattern[2];
                      }
                      if (line == "") {
                          if (nextPatternSet != -1) {
                              throw ("illegal parsing state in text-view in patternSet" + patternSet);
                          }
                          return result;
                      }
                      patternSet = nextPatternSet;
                      break;
                  }
              }
              if (beforeLine == line) {
                  throw ("input not consumed in text-view in patternSet" + patternSet);
              }
          }
      }
      processText(text) {
          const view = this;
          const textLines = text.split(/[\n]/);
          let lineNo = 0;
          for (const line of textLines) {
              const li = document.createElement("LI");
              li.className = "nolinenums";
              li.dataset.lineNo = "" + lineNo++;
              const fragments = view.processLine(line);
              for (const fragment of fragments) {
                  li.appendChild(fragment);
              }
              view.textListNode.appendChild(li);
          }
      }
      initializeContent(data, rememberedSelection) {
          this.clearText();
          this.processText(data);
          this.show();
      }
      onresize() { }
      isScrollable() {
          return true;
      }
  }

  // Copyright 2015 the V8 project authors. All rights reserved.
  const toolboxHTML = `<div id="disassembly-toolbox">
<form>
  <label><input id="show-instruction-address" type="checkbox" name="instruction-address">Show addresses</label>
  <label><input id="show-instruction-binary" type="checkbox" name="instruction-binary">Show binary literal</label>
</form>
</div>`;
  class DisassemblyView extends TextView {
      createViewElement() {
          const pane = document.createElement('div');
          pane.setAttribute('id', "disassembly");
          pane.innerHTML =
              `<pre id='disassembly-text-pre' class='prettyprint prettyprinted'>
       <ul id='disassembly-list' class='nolinenums noindent'>
       </ul>
     </pre>`;
          return pane;
      }
      constructor(parentId, broker) {
          super(parentId, broker);
          const view = this;
          const ADDRESS_STYLE = {
              associateData: (text, fragment) => {
                  const matches = text.match(/(?<address>0?x?[0-9a-fA-F]{8,16})(?<addressSpace>\s+)(?<offset>[0-9a-f]+)(?<offsetSpace>\s*)/);
                  const offset = Number.parseInt(matches.groups["offset"], 16);
                  const addressElement = document.createElement("SPAN");
                  addressElement.className = "instruction-address";
                  addressElement.innerText = matches.groups["address"];
                  const offsetElement = document.createElement("SPAN");
                  offsetElement.innerText = matches.groups["offset"];
                  fragment.appendChild(addressElement);
                  fragment.appendChild(document.createTextNode(matches.groups["addressSpace"]));
                  fragment.appendChild(offsetElement);
                  fragment.appendChild(document.createTextNode(matches.groups["offsetSpace"]));
                  fragment.classList.add('tag');
                  if (!Number.isNaN(offset)) {
                      const pcOffset = view.sourceResolver.getKeyPcOffset(offset);
                      fragment.dataset.pcOffset = `${pcOffset}`;
                      addressElement.classList.add('linkable-text');
                      offsetElement.classList.add('linkable-text');
                  }
              }
          };
          const UNCLASSIFIED_STYLE = {
              css: 'com'
          };
          const NUMBER_STYLE = {
              css: ['instruction-binary', 'lit']
          };
          const COMMENT_STYLE = {
              css: 'com'
          };
          const OPCODE_ARGS = {
              associateData: function (text, fragment) {
                  fragment.innerHTML = text;
                  const replacer = (match, hexOffset) => {
                      const offset = Number.parseInt(hexOffset, 16);
                      const keyOffset = view.sourceResolver.getKeyPcOffset(offset);
                      return `<span class="tag linkable-text" data-pc-offset="${keyOffset}">${match}</span>`;
                  };
                  const html = text.replace(/<.0?x?([0-9a-fA-F]+)>/g, replacer);
                  fragment.innerHTML = html;
              }
          };
          const OPCODE_STYLE = {
              css: 'kwd'
          };
          const BLOCK_HEADER_STYLE = {
              associateData: function (text, fragment) {
                  const matches = /\d+/.exec(text);
                  if (!matches)
                      return;
                  const blockId = matches[0];
                  fragment.dataset.blockId = blockId;
                  fragment.innerHTML = text;
                  fragment.className = "com block";
              }
          };
          const SOURCE_POSITION_HEADER_STYLE = {
              css: 'com'
          };
          view.SOURCE_POSITION_HEADER_REGEX = /^\s*--[^<]*<.*(not inlined|inlined\((\d+)\)):(\d+)>\s*--/;
          const patterns = [
              [
                  [/^0?x?[0-9a-fA-F]{8,16}\s+[0-9a-f]+\s+/, ADDRESS_STYLE, 1],
                  [view.SOURCE_POSITION_HEADER_REGEX, SOURCE_POSITION_HEADER_STYLE, -1],
                  [/^\s+-- B\d+ start.*/, BLOCK_HEADER_STYLE, -1],
                  [/^.*/, UNCLASSIFIED_STYLE, -1]
              ],
              [
                  [/^\s*[0-9a-f]+\s+/, NUMBER_STYLE, 2],
                  [/^\s*[0-9a-f]+\s+[0-9a-f]+\s+/, NUMBER_STYLE, 2],
                  [/^.*/, null, -1]
              ],
              [
                  [/^REX.W \S+\s+/, OPCODE_STYLE, 3],
                  [/^\S+\s+/, OPCODE_STYLE, 3],
                  [/^\S+$/, OPCODE_STYLE, -1],
                  [/^.*/, null, -1]
              ],
              [
                  [/^\s+/, null],
                  [/^[^;]+$/, OPCODE_ARGS, -1],
                  [/^[^;]+/, OPCODE_ARGS, 4],
                  [/^;/, COMMENT_STYLE, 5]
              ],
              [
                  [/^.+$/, COMMENT_STYLE, -1]
              ]
          ];
          view.setPatterns(patterns);
          const linkHandler = (e) => {
              if (!(e.target instanceof HTMLElement))
                  return;
              const offsetAsString = e.target.dataset.pcOffset ? e.target.dataset.pcOffset : e.target.parentElement.dataset.pcOffset;
              const offset = Number.parseInt(offsetAsString, 10);
              if ((typeof offsetAsString) != "undefined" && !Number.isNaN(offset)) {
                  view.offsetSelection.select([offset], true);
                  const nodes = view.sourceResolver.nodesForPCOffset(offset)[0];
                  if (nodes.length > 0) {
                      e.stopPropagation();
                      if (!e.shiftKey) {
                          view.selectionHandler.clear();
                      }
                      view.selectionHandler.select(nodes, true);
                  }
                  else {
                      view.updateSelection();
                  }
              }
              return undefined;
          };
          view.divNode.addEventListener('click', linkHandler);
          const linkHandlerBlock = e => {
              const blockId = e.target.dataset.blockId;
              if (typeof blockId != "undefined" && !Number.isNaN(blockId)) {
                  e.stopPropagation();
                  if (!e.shiftKey) {
                      view.selectionHandler.clear();
                  }
                  view.blockSelectionHandler.select([blockId], true);
              }
          };
          view.divNode.addEventListener('click', linkHandlerBlock);
          this.offsetSelection = new MySelection(anyToString);
          const instructionSelectionHandler = {
              clear: function () {
                  view.offsetSelection.clear();
                  view.updateSelection();
                  broker.broadcastClear(instructionSelectionHandler);
              },
              select: function (instructionIds, selected) {
                  view.offsetSelection.select(instructionIds, selected);
                  view.updateSelection();
                  broker.broadcastBlockSelect(instructionSelectionHandler, instructionIds, selected);
              },
              brokeredInstructionSelect: function (instructionIds, selected) {
                  const firstSelect = view.offsetSelection.isEmpty();
                  const keyPcOffsets = view.sourceResolver.instructionsToKeyPcOffsets(instructionIds);
                  view.offsetSelection.select(keyPcOffsets, selected);
                  view.updateSelection(firstSelect);
              },
              brokeredClear: function () {
                  view.offsetSelection.clear();
                  view.updateSelection();
              }
          };
          this.instructionSelectionHandler = instructionSelectionHandler;
          broker.addInstructionHandler(instructionSelectionHandler);
          const toolbox = document.createElement("div");
          toolbox.id = "toolbox-anchor";
          toolbox.innerHTML = toolboxHTML;
          view.divNode.insertBefore(toolbox, view.divNode.firstChild);
          const instructionAddressInput = view.divNode.querySelector("#show-instruction-address");
          const lastShowInstructionAddress = window.sessionStorage.getItem("show-instruction-address");
          instructionAddressInput.checked = lastShowInstructionAddress == 'true';
          const showInstructionAddressHandler = () => {
              window.sessionStorage.setItem("show-instruction-address", `${instructionAddressInput.checked}`);
              for (const el of view.divNode.querySelectorAll(".instruction-address")) {
                  el.classList.toggle("invisible", !instructionAddressInput.checked);
              }
          };
          instructionAddressInput.addEventListener("change", showInstructionAddressHandler);
          this.showInstructionAddressHandler = showInstructionAddressHandler;
          const instructionBinaryInput = view.divNode.querySelector("#show-instruction-binary");
          const lastShowInstructionBinary = window.sessionStorage.getItem("show-instruction-binary");
          instructionBinaryInput.checked = lastShowInstructionBinary == 'true';
          const showInstructionBinaryHandler = () => {
              window.sessionStorage.setItem("show-instruction-binary", `${instructionBinaryInput.checked}`);
              for (const el of view.divNode.querySelectorAll(".instruction-binary")) {
                  el.classList.toggle("invisible", !instructionBinaryInput.checked);
              }
          };
          instructionBinaryInput.addEventListener("change", showInstructionBinaryHandler);
          this.showInstructionBinaryHandler = showInstructionBinaryHandler;
      }
      updateSelection(scrollIntoView = false) {
          super.updateSelection(scrollIntoView);
          const keyPcOffsets = this.sourceResolver.nodesToKeyPcOffsets(this.selection.selectedKeys());
          if (this.offsetSelection) {
              for (const key of this.offsetSelection.selectedKeys()) {
                  keyPcOffsets.push(Number(key));
              }
          }
          for (const keyPcOffset of keyPcOffsets) {
              const elementsToSelect = this.divNode.querySelectorAll(`[data-pc-offset='${keyPcOffset}']`);
              for (const el of elementsToSelect) {
                  el.classList.toggle("selected", true);
              }
          }
      }
      initializeCode(sourceText, sourcePosition = 0) {
          const view = this;
          view.addrEventCounts = null;
          view.totalEventCounts = null;
          view.maxEventCounts = null;
          view.posLines = new Array();
          // Comment lines for line 0 include sourcePosition already, only need to
          // add sourcePosition for lines > 0.
          view.posLines[0] = sourcePosition;
          if (sourceText && sourceText != "") {
              const base = sourcePosition;
              let current = 0;
              const sourceLines = sourceText.split("\n");
              for (let i = 1; i < sourceLines.length; i++) {
                  // Add 1 for newline character that is split off.
                  current += sourceLines[i - 1].length + 1;
                  view.posLines[i] = base + current;
              }
          }
      }
      initializePerfProfile(eventCounts) {
          const view = this;
          if (eventCounts !== undefined) {
              view.addrEventCounts = eventCounts;
              view.totalEventCounts = {};
              view.maxEventCounts = {};
              for (const evName in view.addrEventCounts) {
                  if (view.addrEventCounts.hasOwnProperty(evName)) {
                      const keys = Object.keys(view.addrEventCounts[evName]);
                      const values = keys.map(key => view.addrEventCounts[evName][key]);
                      view.totalEventCounts[evName] = values.reduce((a, b) => a + b);
                      view.maxEventCounts[evName] = values.reduce((a, b) => Math.max(a, b));
                  }
              }
          }
          else {
              view.addrEventCounts = null;
              view.totalEventCounts = null;
              view.maxEventCounts = null;
          }
      }
      showContent(data) {
          console.time("disassembly-view");
          super.initializeContent(data, null);
          this.showInstructionAddressHandler();
          this.showInstructionBinaryHandler();
          console.timeEnd("disassembly-view");
      }
      // Shorten decimals and remove trailing zeroes for readability.
      humanize(num) {
          return num.toFixed(3).replace(/\.?0+$/, "") + "%";
      }
      processLine(line) {
          const view = this;
          let fragments = super.processLine(line);
          // Add profiling data per instruction if available.
          if (view.totalEventCounts) {
              const matches = /^(0x[0-9a-fA-F]+)\s+\d+\s+[0-9a-fA-F]+/.exec(line);
              if (matches) {
                  const newFragments = [];
                  for (const event in view.addrEventCounts) {
                      if (!view.addrEventCounts.hasOwnProperty(event))
                          continue;
                      const count = view.addrEventCounts[event][matches[1]];
                      let str = " ";
                      const cssCls = "prof";
                      if (count !== undefined) {
                          const perc = count / view.totalEventCounts[event] * 100;
                          let col = { r: 255, g: 255, b: 255 };
                          for (let i = 0; i < PROF_COLS.length; i++) {
                              if (perc === PROF_COLS[i].perc) {
                                  col = PROF_COLS[i].col;
                                  break;
                              }
                              else if (perc > PROF_COLS[i].perc && perc < PROF_COLS[i + 1].perc) {
                                  const col1 = PROF_COLS[i].col;
                                  const col2 = PROF_COLS[i + 1].col;
                                  const val = perc - PROF_COLS[i].perc;
                                  const max = PROF_COLS[i + 1].perc - PROF_COLS[i].perc;
                                  col.r = Math.round(interpolate(val, max, col1.r, col2.r));
                                  col.g = Math.round(interpolate(val, max, col1.g, col2.g));
                                  col.b = Math.round(interpolate(val, max, col1.b, col2.b));
                                  break;
                              }
                          }
                          str = UNICODE_BLOCK;
                          const fragment = view.createFragment(str, cssCls);
                          fragment.title = event + ": " + view.humanize(perc) + " (" + count + ")";
                          fragment.style.color = "rgb(" + col.r + ", " + col.g + ", " + col.b + ")";
                          newFragments.push(fragment);
                      }
                      else {
                          newFragments.push(view.createFragment(str, cssCls));
                      }
                  }
                  fragments = newFragments.concat(fragments);
              }
          }
          return fragments;
      }
      detachSelection() { return null; }
      searchInputAction(searchInput, e, onlyVisible) {
          throw new Error("Method not implemented.");
      }
  }

  function ascending(a, b) {
    return a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
  }

  function bisector(compare) {
    if (compare.length === 1) compare = ascendingComparator(compare);
    return {
      left: function(a, x, lo, hi) {
        if (lo == null) lo = 0;
        if (hi == null) hi = a.length;
        while (lo < hi) {
          var mid = lo + hi >>> 1;
          if (compare(a[mid], x) < 0) lo = mid + 1;
          else hi = mid;
        }
        return lo;
      },
      right: function(a, x, lo, hi) {
        if (lo == null) lo = 0;
        if (hi == null) hi = a.length;
        while (lo < hi) {
          var mid = lo + hi >>> 1;
          if (compare(a[mid], x) > 0) hi = mid;
          else lo = mid + 1;
        }
        return lo;
      }
    };
  }

  function ascendingComparator(f) {
    return function(d, x) {
      return ascending(f(d), x);
    };
  }

  var ascendingBisect = bisector(ascending);

  var noop = {value: function() {}};

  function dispatch() {
    for (var i = 0, n = arguments.length, _ = {}, t; i < n; ++i) {
      if (!(t = arguments[i] + "") || (t in _)) throw new Error("illegal type: " + t);
      _[t] = [];
    }
    return new Dispatch(_);
  }

  function Dispatch(_) {
    this._ = _;
  }

  function parseTypenames(typenames, types) {
    return typenames.trim().split(/^|\s+/).map(function(t) {
      var name = "", i = t.indexOf(".");
      if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
      if (t && !types.hasOwnProperty(t)) throw new Error("unknown type: " + t);
      return {type: t, name: name};
    });
  }

  Dispatch.prototype = dispatch.prototype = {
    constructor: Dispatch,
    on: function(typename, callback) {
      var _ = this._,
          T = parseTypenames(typename + "", _),
          t,
          i = -1,
          n = T.length;

      // If no callback was specified, return the callback of the given type and name.
      if (arguments.length < 2) {
        while (++i < n) if ((t = (typename = T[i]).type) && (t = get(_[t], typename.name))) return t;
        return;
      }

      // If a type was specified, set the callback for the given type and name.
      // Otherwise, if a null callback was specified, remove callbacks of the given name.
      if (callback != null && typeof callback !== "function") throw new Error("invalid callback: " + callback);
      while (++i < n) {
        if (t = (typename = T[i]).type) _[t] = set(_[t], typename.name, callback);
        else if (callback == null) for (t in _) _[t] = set(_[t], typename.name, null);
      }

      return this;
    },
    copy: function() {
      var copy = {}, _ = this._;
      for (var t in _) copy[t] = _[t].slice();
      return new Dispatch(copy);
    },
    call: function(type, that) {
      if ((n = arguments.length - 2) > 0) for (var args = new Array(n), i = 0, n, t; i < n; ++i) args[i] = arguments[i + 2];
      if (!this._.hasOwnProperty(type)) throw new Error("unknown type: " + type);
      for (t = this._[type], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
    },
    apply: function(type, that, args) {
      if (!this._.hasOwnProperty(type)) throw new Error("unknown type: " + type);
      for (var t = this._[type], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
    }
  };

  function get(type, name) {
    for (var i = 0, n = type.length, c; i < n; ++i) {
      if ((c = type[i]).name === name) {
        return c.value;
      }
    }
  }

  function set(type, name, callback) {
    for (var i = 0, n = type.length; i < n; ++i) {
      if (type[i].name === name) {
        type[i] = noop, type = type.slice(0, i).concat(type.slice(i + 1));
        break;
      }
    }
    if (callback != null) type.push({name: name, value: callback});
    return type;
  }

  var xhtml = "http://www.w3.org/1999/xhtml";

  var namespaces = {
    svg: "http://www.w3.org/2000/svg",
    xhtml: xhtml,
    xlink: "http://www.w3.org/1999/xlink",
    xml: "http://www.w3.org/XML/1998/namespace",
    xmlns: "http://www.w3.org/2000/xmlns/"
  };

  function namespace(name) {
    var prefix = name += "", i = prefix.indexOf(":");
    if (i >= 0 && (prefix = name.slice(0, i)) !== "xmlns") name = name.slice(i + 1);
    return namespaces.hasOwnProperty(prefix) ? {space: namespaces[prefix], local: name} : name;
  }

  function creatorInherit(name) {
    return function() {
      var document = this.ownerDocument,
          uri = this.namespaceURI;
      return uri === xhtml && document.documentElement.namespaceURI === xhtml
          ? document.createElement(name)
          : document.createElementNS(uri, name);
    };
  }

  function creatorFixed(fullname) {
    return function() {
      return this.ownerDocument.createElementNS(fullname.space, fullname.local);
    };
  }

  function creator(name) {
    var fullname = namespace(name);
    return (fullname.local
        ? creatorFixed
        : creatorInherit)(fullname);
  }

  function none() {}

  function selector(selector) {
    return selector == null ? none : function() {
      return this.querySelector(selector);
    };
  }

  function selection_select(select) {
    if (typeof select !== "function") select = selector(select);

    for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, subgroup = subgroups[j] = new Array(n), node, subnode, i = 0; i < n; ++i) {
        if ((node = group[i]) && (subnode = select.call(node, node.__data__, i, group))) {
          if ("__data__" in node) subnode.__data__ = node.__data__;
          subgroup[i] = subnode;
        }
      }
    }

    return new Selection(subgroups, this._parents);
  }

  function empty() {
    return [];
  }

  function selectorAll(selector) {
    return selector == null ? empty : function() {
      return this.querySelectorAll(selector);
    };
  }

  function selection_selectAll(select) {
    if (typeof select !== "function") select = selectorAll(select);

    for (var groups = this._groups, m = groups.length, subgroups = [], parents = [], j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
        if (node = group[i]) {
          subgroups.push(select.call(node, node.__data__, i, group));
          parents.push(node);
        }
      }
    }

    return new Selection(subgroups, parents);
  }

  var matcher = function(selector) {
    return function() {
      return this.matches(selector);
    };
  };

  if (typeof document !== "undefined") {
    var element = document.documentElement;
    if (!element.matches) {
      var vendorMatches = element.webkitMatchesSelector
          || element.msMatchesSelector
          || element.mozMatchesSelector
          || element.oMatchesSelector;
      matcher = function(selector) {
        return function() {
          return vendorMatches.call(this, selector);
        };
      };
    }
  }

  var matcher$1 = matcher;

  function selection_filter(match) {
    if (typeof match !== "function") match = matcher$1(match);

    for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, subgroup = subgroups[j] = [], node, i = 0; i < n; ++i) {
        if ((node = group[i]) && match.call(node, node.__data__, i, group)) {
          subgroup.push(node);
        }
      }
    }

    return new Selection(subgroups, this._parents);
  }

  function sparse(update) {
    return new Array(update.length);
  }

  function selection_enter() {
    return new Selection(this._enter || this._groups.map(sparse), this._parents);
  }

  function EnterNode(parent, datum) {
    this.ownerDocument = parent.ownerDocument;
    this.namespaceURI = parent.namespaceURI;
    this._next = null;
    this._parent = parent;
    this.__data__ = datum;
  }

  EnterNode.prototype = {
    constructor: EnterNode,
    appendChild: function(child) { return this._parent.insertBefore(child, this._next); },
    insertBefore: function(child, next) { return this._parent.insertBefore(child, next); },
    querySelector: function(selector) { return this._parent.querySelector(selector); },
    querySelectorAll: function(selector) { return this._parent.querySelectorAll(selector); }
  };

  function constant$1(x) {
    return function() {
      return x;
    };
  }

  var keyPrefix = "$"; // Protect against keys like “__proto__”.

  function bindIndex(parent, group, enter, update, exit, data) {
    var i = 0,
        node,
        groupLength = group.length,
        dataLength = data.length;

    // Put any non-null nodes that fit into update.
    // Put any null nodes into enter.
    // Put any remaining data into enter.
    for (; i < dataLength; ++i) {
      if (node = group[i]) {
        node.__data__ = data[i];
        update[i] = node;
      } else {
        enter[i] = new EnterNode(parent, data[i]);
      }
    }

    // Put any non-null nodes that don’t fit into exit.
    for (; i < groupLength; ++i) {
      if (node = group[i]) {
        exit[i] = node;
      }
    }
  }

  function bindKey(parent, group, enter, update, exit, data, key) {
    var i,
        node,
        nodeByKeyValue = {},
        groupLength = group.length,
        dataLength = data.length,
        keyValues = new Array(groupLength),
        keyValue;

    // Compute the key for each node.
    // If multiple nodes have the same key, the duplicates are added to exit.
    for (i = 0; i < groupLength; ++i) {
      if (node = group[i]) {
        keyValues[i] = keyValue = keyPrefix + key.call(node, node.__data__, i, group);
        if (keyValue in nodeByKeyValue) {
          exit[i] = node;
        } else {
          nodeByKeyValue[keyValue] = node;
        }
      }
    }

    // Compute the key for each datum.
    // If there a node associated with this key, join and add it to update.
    // If there is not (or the key is a duplicate), add it to enter.
    for (i = 0; i < dataLength; ++i) {
      keyValue = keyPrefix + key.call(parent, data[i], i, data);
      if (node = nodeByKeyValue[keyValue]) {
        update[i] = node;
        node.__data__ = data[i];
        nodeByKeyValue[keyValue] = null;
      } else {
        enter[i] = new EnterNode(parent, data[i]);
      }
    }

    // Add any remaining nodes that were not bound to data to exit.
    for (i = 0; i < groupLength; ++i) {
      if ((node = group[i]) && (nodeByKeyValue[keyValues[i]] === node)) {
        exit[i] = node;
      }
    }
  }

  function selection_data(value, key) {
    if (!value) {
      data = new Array(this.size()), j = -1;
      this.each(function(d) { data[++j] = d; });
      return data;
    }

    var bind = key ? bindKey : bindIndex,
        parents = this._parents,
        groups = this._groups;

    if (typeof value !== "function") value = constant$1(value);

    for (var m = groups.length, update = new Array(m), enter = new Array(m), exit = new Array(m), j = 0; j < m; ++j) {
      var parent = parents[j],
          group = groups[j],
          groupLength = group.length,
          data = value.call(parent, parent && parent.__data__, j, parents),
          dataLength = data.length,
          enterGroup = enter[j] = new Array(dataLength),
          updateGroup = update[j] = new Array(dataLength),
          exitGroup = exit[j] = new Array(groupLength);

      bind(parent, group, enterGroup, updateGroup, exitGroup, data, key);

      // Now connect the enter nodes to their following update node, such that
      // appendChild can insert the materialized enter node before this node,
      // rather than at the end of the parent node.
      for (var i0 = 0, i1 = 0, previous, next; i0 < dataLength; ++i0) {
        if (previous = enterGroup[i0]) {
          if (i0 >= i1) i1 = i0 + 1;
          while (!(next = updateGroup[i1]) && ++i1 < dataLength);
          previous._next = next || null;
        }
      }
    }

    update = new Selection(update, parents);
    update._enter = enter;
    update._exit = exit;
    return update;
  }

  function selection_exit() {
    return new Selection(this._exit || this._groups.map(sparse), this._parents);
  }

  function selection_merge(selection$$1) {

    for (var groups0 = this._groups, groups1 = selection$$1._groups, m0 = groups0.length, m1 = groups1.length, m = Math.min(m0, m1), merges = new Array(m0), j = 0; j < m; ++j) {
      for (var group0 = groups0[j], group1 = groups1[j], n = group0.length, merge = merges[j] = new Array(n), node, i = 0; i < n; ++i) {
        if (node = group0[i] || group1[i]) {
          merge[i] = node;
        }
      }
    }

    for (; j < m0; ++j) {
      merges[j] = groups0[j];
    }

    return new Selection(merges, this._parents);
  }

  function selection_order() {

    for (var groups = this._groups, j = -1, m = groups.length; ++j < m;) {
      for (var group = groups[j], i = group.length - 1, next = group[i], node; --i >= 0;) {
        if (node = group[i]) {
          if (next && next !== node.nextSibling) next.parentNode.insertBefore(node, next);
          next = node;
        }
      }
    }

    return this;
  }

  function selection_sort(compare) {
    if (!compare) compare = ascending$1;

    function compareNode(a, b) {
      return a && b ? compare(a.__data__, b.__data__) : !a - !b;
    }

    for (var groups = this._groups, m = groups.length, sortgroups = new Array(m), j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, sortgroup = sortgroups[j] = new Array(n), node, i = 0; i < n; ++i) {
        if (node = group[i]) {
          sortgroup[i] = node;
        }
      }
      sortgroup.sort(compareNode);
    }

    return new Selection(sortgroups, this._parents).order();
  }

  function ascending$1(a, b) {
    return a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
  }

  function selection_call() {
    var callback = arguments[0];
    arguments[0] = this;
    callback.apply(null, arguments);
    return this;
  }

  function selection_nodes() {
    var nodes = new Array(this.size()), i = -1;
    this.each(function() { nodes[++i] = this; });
    return nodes;
  }

  function selection_node() {

    for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) {
      for (var group = groups[j], i = 0, n = group.length; i < n; ++i) {
        var node = group[i];
        if (node) return node;
      }
    }

    return null;
  }

  function selection_size() {
    var size = 0;
    this.each(function() { ++size; });
    return size;
  }

  function selection_empty() {
    return !this.node();
  }

  function selection_each(callback) {

    for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) {
      for (var group = groups[j], i = 0, n = group.length, node; i < n; ++i) {
        if (node = group[i]) callback.call(node, node.__data__, i, group);
      }
    }

    return this;
  }

  function attrRemove(name) {
    return function() {
      this.removeAttribute(name);
    };
  }

  function attrRemoveNS(fullname) {
    return function() {
      this.removeAttributeNS(fullname.space, fullname.local);
    };
  }

  function attrConstant(name, value) {
    return function() {
      this.setAttribute(name, value);
    };
  }

  function attrConstantNS(fullname, value) {
    return function() {
      this.setAttributeNS(fullname.space, fullname.local, value);
    };
  }

  function attrFunction(name, value) {
    return function() {
      var v = value.apply(this, arguments);
      if (v == null) this.removeAttribute(name);
      else this.setAttribute(name, v);
    };
  }

  function attrFunctionNS(fullname, value) {
    return function() {
      var v = value.apply(this, arguments);
      if (v == null) this.removeAttributeNS(fullname.space, fullname.local);
      else this.setAttributeNS(fullname.space, fullname.local, v);
    };
  }

  function selection_attr(name, value) {
    var fullname = namespace(name);

    if (arguments.length < 2) {
      var node = this.node();
      return fullname.local
          ? node.getAttributeNS(fullname.space, fullname.local)
          : node.getAttribute(fullname);
    }

    return this.each((value == null
        ? (fullname.local ? attrRemoveNS : attrRemove) : (typeof value === "function"
        ? (fullname.local ? attrFunctionNS : attrFunction)
        : (fullname.local ? attrConstantNS : attrConstant)))(fullname, value));
  }

  function defaultView(node) {
    return (node.ownerDocument && node.ownerDocument.defaultView) // node is a Node
        || (node.document && node) // node is a Window
        || node.defaultView; // node is a Document
  }

  function styleRemove(name) {
    return function() {
      this.style.removeProperty(name);
    };
  }

  function styleConstant(name, value, priority) {
    return function() {
      this.style.setProperty(name, value, priority);
    };
  }

  function styleFunction(name, value, priority) {
    return function() {
      var v = value.apply(this, arguments);
      if (v == null) this.style.removeProperty(name);
      else this.style.setProperty(name, v, priority);
    };
  }

  function selection_style(name, value, priority) {
    return arguments.length > 1
        ? this.each((value == null
              ? styleRemove : typeof value === "function"
              ? styleFunction
              : styleConstant)(name, value, priority == null ? "" : priority))
        : styleValue(this.node(), name);
  }

  function styleValue(node, name) {
    return node.style.getPropertyValue(name)
        || defaultView(node).getComputedStyle(node, null).getPropertyValue(name);
  }

  function propertyRemove(name) {
    return function() {
      delete this[name];
    };
  }

  function propertyConstant(name, value) {
    return function() {
      this[name] = value;
    };
  }

  function propertyFunction(name, value) {
    return function() {
      var v = value.apply(this, arguments);
      if (v == null) delete this[name];
      else this[name] = v;
    };
  }

  function selection_property(name, value) {
    return arguments.length > 1
        ? this.each((value == null
            ? propertyRemove : typeof value === "function"
            ? propertyFunction
            : propertyConstant)(name, value))
        : this.node()[name];
  }

  function classArray(string) {
    return string.trim().split(/^|\s+/);
  }

  function classList(node) {
    return node.classList || new ClassList(node);
  }

  function ClassList(node) {
    this._node = node;
    this._names = classArray(node.getAttribute("class") || "");
  }

  ClassList.prototype = {
    add: function(name) {
      var i = this._names.indexOf(name);
      if (i < 0) {
        this._names.push(name);
        this._node.setAttribute("class", this._names.join(" "));
      }
    },
    remove: function(name) {
      var i = this._names.indexOf(name);
      if (i >= 0) {
        this._names.splice(i, 1);
        this._node.setAttribute("class", this._names.join(" "));
      }
    },
    contains: function(name) {
      return this._names.indexOf(name) >= 0;
    }
  };

  function classedAdd(node, names) {
    var list = classList(node), i = -1, n = names.length;
    while (++i < n) list.add(names[i]);
  }

  function classedRemove(node, names) {
    var list = classList(node), i = -1, n = names.length;
    while (++i < n) list.remove(names[i]);
  }

  function classedTrue(names) {
    return function() {
      classedAdd(this, names);
    };
  }

  function classedFalse(names) {
    return function() {
      classedRemove(this, names);
    };
  }

  function classedFunction(names, value) {
    return function() {
      (value.apply(this, arguments) ? classedAdd : classedRemove)(this, names);
    };
  }

  function selection_classed(name, value) {
    var names = classArray(name + "");

    if (arguments.length < 2) {
      var list = classList(this.node()), i = -1, n = names.length;
      while (++i < n) if (!list.contains(names[i])) return false;
      return true;
    }

    return this.each((typeof value === "function"
        ? classedFunction : value
        ? classedTrue
        : classedFalse)(names, value));
  }

  function textRemove() {
    this.textContent = "";
  }

  function textConstant(value) {
    return function() {
      this.textContent = value;
    };
  }

  function textFunction(value) {
    return function() {
      var v = value.apply(this, arguments);
      this.textContent = v == null ? "" : v;
    };
  }

  function selection_text(value) {
    return arguments.length
        ? this.each(value == null
            ? textRemove : (typeof value === "function"
            ? textFunction
            : textConstant)(value))
        : this.node().textContent;
  }

  function htmlRemove() {
    this.innerHTML = "";
  }

  function htmlConstant(value) {
    return function() {
      this.innerHTML = value;
    };
  }

  function htmlFunction(value) {
    return function() {
      var v = value.apply(this, arguments);
      this.innerHTML = v == null ? "" : v;
    };
  }

  function selection_html(value) {
    return arguments.length
        ? this.each(value == null
            ? htmlRemove : (typeof value === "function"
            ? htmlFunction
            : htmlConstant)(value))
        : this.node().innerHTML;
  }

  function raise() {
    if (this.nextSibling) this.parentNode.appendChild(this);
  }

  function selection_raise() {
    return this.each(raise);
  }

  function lower() {
    if (this.previousSibling) this.parentNode.insertBefore(this, this.parentNode.firstChild);
  }

  function selection_lower() {
    return this.each(lower);
  }

  function selection_append(name) {
    var create = typeof name === "function" ? name : creator(name);
    return this.select(function() {
      return this.appendChild(create.apply(this, arguments));
    });
  }

  function constantNull() {
    return null;
  }

  function selection_insert(name, before) {
    var create = typeof name === "function" ? name : creator(name),
        select = before == null ? constantNull : typeof before === "function" ? before : selector(before);
    return this.select(function() {
      return this.insertBefore(create.apply(this, arguments), select.apply(this, arguments) || null);
    });
  }

  function remove() {
    var parent = this.parentNode;
    if (parent) parent.removeChild(this);
  }

  function selection_remove() {
    return this.each(remove);
  }

  function selection_cloneShallow() {
    return this.parentNode.insertBefore(this.cloneNode(false), this.nextSibling);
  }

  function selection_cloneDeep() {
    return this.parentNode.insertBefore(this.cloneNode(true), this.nextSibling);
  }

  function selection_clone(deep) {
    return this.select(deep ? selection_cloneDeep : selection_cloneShallow);
  }

  function selection_datum(value) {
    return arguments.length
        ? this.property("__data__", value)
        : this.node().__data__;
  }

  var filterEvents = {};

  var event = null;

  if (typeof document !== "undefined") {
    var element$1 = document.documentElement;
    if (!("onmouseenter" in element$1)) {
      filterEvents = {mouseenter: "mouseover", mouseleave: "mouseout"};
    }
  }

  function filterContextListener(listener, index, group) {
    listener = contextListener(listener, index, group);
    return function(event) {
      var related = event.relatedTarget;
      if (!related || (related !== this && !(related.compareDocumentPosition(this) & 8))) {
        listener.call(this, event);
      }
    };
  }

  function contextListener(listener, index, group) {
    return function(event1) {
      var event0 = event; // Events can be reentrant (e.g., focus).
      event = event1;
      try {
        listener.call(this, this.__data__, index, group);
      } finally {
        event = event0;
      }
    };
  }

  function parseTypenames$1(typenames) {
    return typenames.trim().split(/^|\s+/).map(function(t) {
      var name = "", i = t.indexOf(".");
      if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
      return {type: t, name: name};
    });
  }

  function onRemove(typename) {
    return function() {
      var on = this.__on;
      if (!on) return;
      for (var j = 0, i = -1, m = on.length, o; j < m; ++j) {
        if (o = on[j], (!typename.type || o.type === typename.type) && o.name === typename.name) {
          this.removeEventListener(o.type, o.listener, o.capture);
        } else {
          on[++i] = o;
        }
      }
      if (++i) on.length = i;
      else delete this.__on;
    };
  }

  function onAdd(typename, value, capture) {
    var wrap = filterEvents.hasOwnProperty(typename.type) ? filterContextListener : contextListener;
    return function(d, i, group) {
      var on = this.__on, o, listener = wrap(value, i, group);
      if (on) for (var j = 0, m = on.length; j < m; ++j) {
        if ((o = on[j]).type === typename.type && o.name === typename.name) {
          this.removeEventListener(o.type, o.listener, o.capture);
          this.addEventListener(o.type, o.listener = listener, o.capture = capture);
          o.value = value;
          return;
        }
      }
      this.addEventListener(typename.type, listener, capture);
      o = {type: typename.type, name: typename.name, value: value, listener: listener, capture: capture};
      if (!on) this.__on = [o];
      else on.push(o);
    };
  }

  function selection_on(typename, value, capture) {
    var typenames = parseTypenames$1(typename + ""), i, n = typenames.length, t;

    if (arguments.length < 2) {
      var on = this.node().__on;
      if (on) for (var j = 0, m = on.length, o; j < m; ++j) {
        for (i = 0, o = on[j]; i < n; ++i) {
          if ((t = typenames[i]).type === o.type && t.name === o.name) {
            return o.value;
          }
        }
      }
      return;
    }

    on = value ? onAdd : onRemove;
    if (capture == null) capture = false;
    for (i = 0; i < n; ++i) this.each(on(typenames[i], value, capture));
    return this;
  }

  function customEvent(event1, listener, that, args) {
    var event0 = event;
    event1.sourceEvent = event;
    event = event1;
    try {
      return listener.apply(that, args);
    } finally {
      event = event0;
    }
  }

  function dispatchEvent(node, type, params) {
    var window = defaultView(node),
        event = window.CustomEvent;

    if (typeof event === "function") {
      event = new event(type, params);
    } else {
      event = window.document.createEvent("Event");
      if (params) event.initEvent(type, params.bubbles, params.cancelable), event.detail = params.detail;
      else event.initEvent(type, false, false);
    }

    node.dispatchEvent(event);
  }

  function dispatchConstant(type, params) {
    return function() {
      return dispatchEvent(this, type, params);
    };
  }

  function dispatchFunction(type, params) {
    return function() {
      return dispatchEvent(this, type, params.apply(this, arguments));
    };
  }

  function selection_dispatch(type, params) {
    return this.each((typeof params === "function"
        ? dispatchFunction
        : dispatchConstant)(type, params));
  }

  var root = [null];

  function Selection(groups, parents) {
    this._groups = groups;
    this._parents = parents;
  }

  function selection() {
    return new Selection([[document.documentElement]], root);
  }

  Selection.prototype = selection.prototype = {
    constructor: Selection,
    select: selection_select,
    selectAll: selection_selectAll,
    filter: selection_filter,
    data: selection_data,
    enter: selection_enter,
    exit: selection_exit,
    merge: selection_merge,
    order: selection_order,
    sort: selection_sort,
    call: selection_call,
    nodes: selection_nodes,
    node: selection_node,
    size: selection_size,
    empty: selection_empty,
    each: selection_each,
    attr: selection_attr,
    style: selection_style,
    property: selection_property,
    classed: selection_classed,
    text: selection_text,
    html: selection_html,
    raise: selection_raise,
    lower: selection_lower,
    append: selection_append,
    insert: selection_insert,
    remove: selection_remove,
    clone: selection_clone,
    datum: selection_datum,
    on: selection_on,
    dispatch: selection_dispatch
  };

  function select(selector) {
    return typeof selector === "string"
        ? new Selection([[document.querySelector(selector)]], [document.documentElement])
        : new Selection([[selector]], root);
  }

  function sourceEvent() {
    var current = event, source;
    while (source = current.sourceEvent) current = source;
    return current;
  }

  function point(node, event) {
    var svg = node.ownerSVGElement || node;

    if (svg.createSVGPoint) {
      var point = svg.createSVGPoint();
      point.x = event.clientX, point.y = event.clientY;
      point = point.matrixTransform(node.getScreenCTM().inverse());
      return [point.x, point.y];
    }

    var rect = node.getBoundingClientRect();
    return [event.clientX - rect.left - node.clientLeft, event.clientY - rect.top - node.clientTop];
  }

  function mouse(node) {
    var event = sourceEvent();
    if (event.changedTouches) event = event.changedTouches[0];
    return point(node, event);
  }

  function selectAll(selector) {
    return typeof selector === "string"
        ? new Selection([document.querySelectorAll(selector)], [document.documentElement])
        : new Selection([selector == null ? [] : selector], root);
  }

  function touch(node, touches, identifier) {
    if (arguments.length < 3) identifier = touches, touches = sourceEvent().changedTouches;

    for (var i = 0, n = touches ? touches.length : 0, touch; i < n; ++i) {
      if ((touch = touches[i]).identifier === identifier) {
        return point(node, touch);
      }
    }

    return null;
  }

  function nopropagation() {
    event.stopImmediatePropagation();
  }

  function noevent() {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function dragDisable(view) {
    var root = view.document.documentElement,
        selection$$1 = select(view).on("dragstart.drag", noevent, true);
    if ("onselectstart" in root) {
      selection$$1.on("selectstart.drag", noevent, true);
    } else {
      root.__noselect = root.style.MozUserSelect;
      root.style.MozUserSelect = "none";
    }
  }

  function yesdrag(view, noclick) {
    var root = view.document.documentElement,
        selection$$1 = select(view).on("dragstart.drag", null);
    if (noclick) {
      selection$$1.on("click.drag", noevent, true);
      setTimeout(function() { selection$$1.on("click.drag", null); }, 0);
    }
    if ("onselectstart" in root) {
      selection$$1.on("selectstart.drag", null);
    } else {
      root.style.MozUserSelect = root.__noselect;
      delete root.__noselect;
    }
  }

  function constant$2(x) {
    return function() {
      return x;
    };
  }

  function DragEvent(target, type, subject, id, active, x, y, dx, dy, dispatch) {
    this.target = target;
    this.type = type;
    this.subject = subject;
    this.identifier = id;
    this.active = active;
    this.x = x;
    this.y = y;
    this.dx = dx;
    this.dy = dy;
    this._ = dispatch;
  }

  DragEvent.prototype.on = function() {
    var value = this._.on.apply(this._, arguments);
    return value === this._ ? this : value;
  };

  // Ignore right-click, since that should open the context menu.
  function defaultFilter() {
    return !event.button;
  }

  function defaultContainer() {
    return this.parentNode;
  }

  function defaultSubject(d) {
    return d == null ? {x: event.x, y: event.y} : d;
  }

  function defaultTouchable() {
    return "ontouchstart" in this;
  }

  function drag() {
    var filter = defaultFilter,
        container = defaultContainer,
        subject = defaultSubject,
        touchable = defaultTouchable,
        gestures = {},
        listeners = dispatch("start", "drag", "end"),
        active = 0,
        mousedownx,
        mousedowny,
        mousemoving,
        touchending,
        clickDistance2 = 0;

    function drag(selection$$1) {
      selection$$1
          .on("mousedown.drag", mousedowned)
        .filter(touchable)
          .on("touchstart.drag", touchstarted)
          .on("touchmove.drag", touchmoved)
          .on("touchend.drag touchcancel.drag", touchended)
          .style("touch-action", "none")
          .style("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
    }

    function mousedowned() {
      if (touchending || !filter.apply(this, arguments)) return;
      var gesture = beforestart("mouse", container.apply(this, arguments), mouse, this, arguments);
      if (!gesture) return;
      select(event.view).on("mousemove.drag", mousemoved, true).on("mouseup.drag", mouseupped, true);
      dragDisable(event.view);
      nopropagation();
      mousemoving = false;
      mousedownx = event.clientX;
      mousedowny = event.clientY;
      gesture("start");
    }

    function mousemoved() {
      noevent();
      if (!mousemoving) {
        var dx = event.clientX - mousedownx, dy = event.clientY - mousedowny;
        mousemoving = dx * dx + dy * dy > clickDistance2;
      }
      gestures.mouse("drag");
    }

    function mouseupped() {
      select(event.view).on("mousemove.drag mouseup.drag", null);
      yesdrag(event.view, mousemoving);
      noevent();
      gestures.mouse("end");
    }

    function touchstarted() {
      if (!filter.apply(this, arguments)) return;
      var touches$$1 = event.changedTouches,
          c = container.apply(this, arguments),
          n = touches$$1.length, i, gesture;

      for (i = 0; i < n; ++i) {
        if (gesture = beforestart(touches$$1[i].identifier, c, touch, this, arguments)) {
          nopropagation();
          gesture("start");
        }
      }
    }

    function touchmoved() {
      var touches$$1 = event.changedTouches,
          n = touches$$1.length, i, gesture;

      for (i = 0; i < n; ++i) {
        if (gesture = gestures[touches$$1[i].identifier]) {
          noevent();
          gesture("drag");
        }
      }
    }

    function touchended() {
      var touches$$1 = event.changedTouches,
          n = touches$$1.length, i, gesture;

      if (touchending) clearTimeout(touchending);
      touchending = setTimeout(function() { touchending = null; }, 500); // Ghost clicks are delayed!
      for (i = 0; i < n; ++i) {
        if (gesture = gestures[touches$$1[i].identifier]) {
          nopropagation();
          gesture("end");
        }
      }
    }

    function beforestart(id, container, point$$1, that, args) {
      var p = point$$1(container, id), s, dx, dy,
          sublisteners = listeners.copy();

      if (!customEvent(new DragEvent(drag, "beforestart", s, id, active, p[0], p[1], 0, 0, sublisteners), function() {
        if ((event.subject = s = subject.apply(that, args)) == null) return false;
        dx = s.x - p[0] || 0;
        dy = s.y - p[1] || 0;
        return true;
      })) return;

      return function gesture(type) {
        var p0 = p, n;
        switch (type) {
          case "start": gestures[id] = gesture, n = active++; break;
          case "end": delete gestures[id], --active; // nobreak
          case "drag": p = point$$1(container, id), n = active; break;
        }
        customEvent(new DragEvent(drag, type, s, id, n, p[0] + dx, p[1] + dy, p[0] - p0[0], p[1] - p0[1], sublisteners), sublisteners.apply, sublisteners, [type, that, args]);
      };
    }

    drag.filter = function(_) {
      return arguments.length ? (filter = typeof _ === "function" ? _ : constant$2(!!_), drag) : filter;
    };

    drag.container = function(_) {
      return arguments.length ? (container = typeof _ === "function" ? _ : constant$2(_), drag) : container;
    };

    drag.subject = function(_) {
      return arguments.length ? (subject = typeof _ === "function" ? _ : constant$2(_), drag) : subject;
    };

    drag.touchable = function(_) {
      return arguments.length ? (touchable = typeof _ === "function" ? _ : constant$2(!!_), drag) : touchable;
    };

    drag.on = function() {
      var value = listeners.on.apply(listeners, arguments);
      return value === listeners ? drag : value;
    };

    drag.clickDistance = function(_) {
      return arguments.length ? (clickDistance2 = (_ = +_) * _, drag) : Math.sqrt(clickDistance2);
    };

    return drag;
  }

  function define(constructor, factory, prototype) {
    constructor.prototype = factory.prototype = prototype;
    prototype.constructor = constructor;
  }

  function extend(parent, definition) {
    var prototype = Object.create(parent.prototype);
    for (var key in definition) prototype[key] = definition[key];
    return prototype;
  }

  function Color() {}

  var darker = 0.7;
  var brighter = 1 / darker;

  var reI = "\\s*([+-]?\\d+)\\s*",
      reN = "\\s*([+-]?\\d*\\.?\\d+(?:[eE][+-]?\\d+)?)\\s*",
      reP = "\\s*([+-]?\\d*\\.?\\d+(?:[eE][+-]?\\d+)?)%\\s*",
      reHex3 = /^#([0-9a-f]{3})$/,
      reHex6 = /^#([0-9a-f]{6})$/,
      reRgbInteger = new RegExp("^rgb\\(" + [reI, reI, reI] + "\\)$"),
      reRgbPercent = new RegExp("^rgb\\(" + [reP, reP, reP] + "\\)$"),
      reRgbaInteger = new RegExp("^rgba\\(" + [reI, reI, reI, reN] + "\\)$"),
      reRgbaPercent = new RegExp("^rgba\\(" + [reP, reP, reP, reN] + "\\)$"),
      reHslPercent = new RegExp("^hsl\\(" + [reN, reP, reP] + "\\)$"),
      reHslaPercent = new RegExp("^hsla\\(" + [reN, reP, reP, reN] + "\\)$");

  var named = {
    aliceblue: 0xf0f8ff,
    antiquewhite: 0xfaebd7,
    aqua: 0x00ffff,
    aquamarine: 0x7fffd4,
    azure: 0xf0ffff,
    beige: 0xf5f5dc,
    bisque: 0xffe4c4,
    black: 0x000000,
    blanchedalmond: 0xffebcd,
    blue: 0x0000ff,
    blueviolet: 0x8a2be2,
    brown: 0xa52a2a,
    burlywood: 0xdeb887,
    cadetblue: 0x5f9ea0,
    chartreuse: 0x7fff00,
    chocolate: 0xd2691e,
    coral: 0xff7f50,
    cornflowerblue: 0x6495ed,
    cornsilk: 0xfff8dc,
    crimson: 0xdc143c,
    cyan: 0x00ffff,
    darkblue: 0x00008b,
    darkcyan: 0x008b8b,
    darkgoldenrod: 0xb8860b,
    darkgray: 0xa9a9a9,
    darkgreen: 0x006400,
    darkgrey: 0xa9a9a9,
    darkkhaki: 0xbdb76b,
    darkmagenta: 0x8b008b,
    darkolivegreen: 0x556b2f,
    darkorange: 0xff8c00,
    darkorchid: 0x9932cc,
    darkred: 0x8b0000,
    darksalmon: 0xe9967a,
    darkseagreen: 0x8fbc8f,
    darkslateblue: 0x483d8b,
    darkslategray: 0x2f4f4f,
    darkslategrey: 0x2f4f4f,
    darkturquoise: 0x00ced1,
    darkviolet: 0x9400d3,
    deeppink: 0xff1493,
    deepskyblue: 0x00bfff,
    dimgray: 0x696969,
    dimgrey: 0x696969,
    dodgerblue: 0x1e90ff,
    firebrick: 0xb22222,
    floralwhite: 0xfffaf0,
    forestgreen: 0x228b22,
    fuchsia: 0xff00ff,
    gainsboro: 0xdcdcdc,
    ghostwhite: 0xf8f8ff,
    gold: 0xffd700,
    goldenrod: 0xdaa520,
    gray: 0x808080,
    green: 0x008000,
    greenyellow: 0xadff2f,
    grey: 0x808080,
    honeydew: 0xf0fff0,
    hotpink: 0xff69b4,
    indianred: 0xcd5c5c,
    indigo: 0x4b0082,
    ivory: 0xfffff0,
    khaki: 0xf0e68c,
    lavender: 0xe6e6fa,
    lavenderblush: 0xfff0f5,
    lawngreen: 0x7cfc00,
    lemonchiffon: 0xfffacd,
    lightblue: 0xadd8e6,
    lightcoral: 0xf08080,
    lightcyan: 0xe0ffff,
    lightgoldenrodyellow: 0xfafad2,
    lightgray: 0xd3d3d3,
    lightgreen: 0x90ee90,
    lightgrey: 0xd3d3d3,
    lightpink: 0xffb6c1,
    lightsalmon: 0xffa07a,
    lightseagreen: 0x20b2aa,
    lightskyblue: 0x87cefa,
    lightslategray: 0x778899,
    lightslategrey: 0x778899,
    lightsteelblue: 0xb0c4de,
    lightyellow: 0xffffe0,
    lime: 0x00ff00,
    limegreen: 0x32cd32,
    linen: 0xfaf0e6,
    magenta: 0xff00ff,
    maroon: 0x800000,
    mediumaquamarine: 0x66cdaa,
    mediumblue: 0x0000cd,
    mediumorchid: 0xba55d3,
    mediumpurple: 0x9370db,
    mediumseagreen: 0x3cb371,
    mediumslateblue: 0x7b68ee,
    mediumspringgreen: 0x00fa9a,
    mediumturquoise: 0x48d1cc,
    mediumvioletred: 0xc71585,
    midnightblue: 0x191970,
    mintcream: 0xf5fffa,
    mistyrose: 0xffe4e1,
    moccasin: 0xffe4b5,
    navajowhite: 0xffdead,
    navy: 0x000080,
    oldlace: 0xfdf5e6,
    olive: 0x808000,
    olivedrab: 0x6b8e23,
    orange: 0xffa500,
    orangered: 0xff4500,
    orchid: 0xda70d6,
    palegoldenrod: 0xeee8aa,
    palegreen: 0x98fb98,
    paleturquoise: 0xafeeee,
    palevioletred: 0xdb7093,
    papayawhip: 0xffefd5,
    peachpuff: 0xffdab9,
    peru: 0xcd853f,
    pink: 0xffc0cb,
    plum: 0xdda0dd,
    powderblue: 0xb0e0e6,
    purple: 0x800080,
    rebeccapurple: 0x663399,
    red: 0xff0000,
    rosybrown: 0xbc8f8f,
    royalblue: 0x4169e1,
    saddlebrown: 0x8b4513,
    salmon: 0xfa8072,
    sandybrown: 0xf4a460,
    seagreen: 0x2e8b57,
    seashell: 0xfff5ee,
    sienna: 0xa0522d,
    silver: 0xc0c0c0,
    skyblue: 0x87ceeb,
    slateblue: 0x6a5acd,
    slategray: 0x708090,
    slategrey: 0x708090,
    snow: 0xfffafa,
    springgreen: 0x00ff7f,
    steelblue: 0x4682b4,
    tan: 0xd2b48c,
    teal: 0x008080,
    thistle: 0xd8bfd8,
    tomato: 0xff6347,
    turquoise: 0x40e0d0,
    violet: 0xee82ee,
    wheat: 0xf5deb3,
    white: 0xffffff,
    whitesmoke: 0xf5f5f5,
    yellow: 0xffff00,
    yellowgreen: 0x9acd32
  };

  define(Color, color, {
    displayable: function() {
      return this.rgb().displayable();
    },
    hex: function() {
      return this.rgb().hex();
    },
    toString: function() {
      return this.rgb() + "";
    }
  });

  function color(format) {
    var m;
    format = (format + "").trim().toLowerCase();
    return (m = reHex3.exec(format)) ? (m = parseInt(m[1], 16), new Rgb((m >> 8 & 0xf) | (m >> 4 & 0x0f0), (m >> 4 & 0xf) | (m & 0xf0), ((m & 0xf) << 4) | (m & 0xf), 1)) // #f00
        : (m = reHex6.exec(format)) ? rgbn(parseInt(m[1], 16)) // #ff0000
        : (m = reRgbInteger.exec(format)) ? new Rgb(m[1], m[2], m[3], 1) // rgb(255, 0, 0)
        : (m = reRgbPercent.exec(format)) ? new Rgb(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, 1) // rgb(100%, 0%, 0%)
        : (m = reRgbaInteger.exec(format)) ? rgba(m[1], m[2], m[3], m[4]) // rgba(255, 0, 0, 1)
        : (m = reRgbaPercent.exec(format)) ? rgba(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, m[4]) // rgb(100%, 0%, 0%, 1)
        : (m = reHslPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, 1) // hsl(120, 50%, 50%)
        : (m = reHslaPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, m[4]) // hsla(120, 50%, 50%, 1)
        : named.hasOwnProperty(format) ? rgbn(named[format])
        : format === "transparent" ? new Rgb(NaN, NaN, NaN, 0)
        : null;
  }

  function rgbn(n) {
    return new Rgb(n >> 16 & 0xff, n >> 8 & 0xff, n & 0xff, 1);
  }

  function rgba(r, g, b, a) {
    if (a <= 0) r = g = b = NaN;
    return new Rgb(r, g, b, a);
  }

  function rgbConvert(o) {
    if (!(o instanceof Color)) o = color(o);
    if (!o) return new Rgb;
    o = o.rgb();
    return new Rgb(o.r, o.g, o.b, o.opacity);
  }

  function rgb(r, g, b, opacity) {
    return arguments.length === 1 ? rgbConvert(r) : new Rgb(r, g, b, opacity == null ? 1 : opacity);
  }

  function Rgb(r, g, b, opacity) {
    this.r = +r;
    this.g = +g;
    this.b = +b;
    this.opacity = +opacity;
  }

  define(Rgb, rgb, extend(Color, {
    brighter: function(k) {
      k = k == null ? brighter : Math.pow(brighter, k);
      return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
    },
    darker: function(k) {
      k = k == null ? darker : Math.pow(darker, k);
      return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
    },
    rgb: function() {
      return this;
    },
    displayable: function() {
      return (0 <= this.r && this.r <= 255)
          && (0 <= this.g && this.g <= 255)
          && (0 <= this.b && this.b <= 255)
          && (0 <= this.opacity && this.opacity <= 1);
    },
    hex: function() {
      return "#" + hex(this.r) + hex(this.g) + hex(this.b);
    },
    toString: function() {
      var a = this.opacity; a = isNaN(a) ? 1 : Math.max(0, Math.min(1, a));
      return (a === 1 ? "rgb(" : "rgba(")
          + Math.max(0, Math.min(255, Math.round(this.r) || 0)) + ", "
          + Math.max(0, Math.min(255, Math.round(this.g) || 0)) + ", "
          + Math.max(0, Math.min(255, Math.round(this.b) || 0))
          + (a === 1 ? ")" : ", " + a + ")");
    }
  }));

  function hex(value) {
    value = Math.max(0, Math.min(255, Math.round(value) || 0));
    return (value < 16 ? "0" : "") + value.toString(16);
  }

  function hsla(h, s, l, a) {
    if (a <= 0) h = s = l = NaN;
    else if (l <= 0 || l >= 1) h = s = NaN;
    else if (s <= 0) h = NaN;
    return new Hsl(h, s, l, a);
  }

  function hslConvert(o) {
    if (o instanceof Hsl) return new Hsl(o.h, o.s, o.l, o.opacity);
    if (!(o instanceof Color)) o = color(o);
    if (!o) return new Hsl;
    if (o instanceof Hsl) return o;
    o = o.rgb();
    var r = o.r / 255,
        g = o.g / 255,
        b = o.b / 255,
        min = Math.min(r, g, b),
        max = Math.max(r, g, b),
        h = NaN,
        s = max - min,
        l = (max + min) / 2;
    if (s) {
      if (r === max) h = (g - b) / s + (g < b) * 6;
      else if (g === max) h = (b - r) / s + 2;
      else h = (r - g) / s + 4;
      s /= l < 0.5 ? max + min : 2 - max - min;
      h *= 60;
    } else {
      s = l > 0 && l < 1 ? 0 : h;
    }
    return new Hsl(h, s, l, o.opacity);
  }

  function hsl(h, s, l, opacity) {
    return arguments.length === 1 ? hslConvert(h) : new Hsl(h, s, l, opacity == null ? 1 : opacity);
  }

  function Hsl(h, s, l, opacity) {
    this.h = +h;
    this.s = +s;
    this.l = +l;
    this.opacity = +opacity;
  }

  define(Hsl, hsl, extend(Color, {
    brighter: function(k) {
      k = k == null ? brighter : Math.pow(brighter, k);
      return new Hsl(this.h, this.s, this.l * k, this.opacity);
    },
    darker: function(k) {
      k = k == null ? darker : Math.pow(darker, k);
      return new Hsl(this.h, this.s, this.l * k, this.opacity);
    },
    rgb: function() {
      var h = this.h % 360 + (this.h < 0) * 360,
          s = isNaN(h) || isNaN(this.s) ? 0 : this.s,
          l = this.l,
          m2 = l + (l < 0.5 ? l : 1 - l) * s,
          m1 = 2 * l - m2;
      return new Rgb(
        hsl2rgb(h >= 240 ? h - 240 : h + 120, m1, m2),
        hsl2rgb(h, m1, m2),
        hsl2rgb(h < 120 ? h + 240 : h - 120, m1, m2),
        this.opacity
      );
    },
    displayable: function() {
      return (0 <= this.s && this.s <= 1 || isNaN(this.s))
          && (0 <= this.l && this.l <= 1)
          && (0 <= this.opacity && this.opacity <= 1);
    }
  }));

  /* From FvD 13.37, CSS Color Module Level 3 */
  function hsl2rgb(h, m1, m2) {
    return (h < 60 ? m1 + (m2 - m1) * h / 60
        : h < 180 ? m2
        : h < 240 ? m1 + (m2 - m1) * (240 - h) / 60
        : m1) * 255;
  }

  var deg2rad = Math.PI / 180;
  var rad2deg = 180 / Math.PI;

  // https://beta.observablehq.com/@mbostock/lab-and-rgb
  var K = 18,
      Xn = 0.96422,
      Yn = 1,
      Zn = 0.82521,
      t0 = 4 / 29,
      t1 = 6 / 29,
      t2 = 3 * t1 * t1,
      t3 = t1 * t1 * t1;

  function labConvert(o) {
    if (o instanceof Lab) return new Lab(o.l, o.a, o.b, o.opacity);
    if (o instanceof Hcl) {
      if (isNaN(o.h)) return new Lab(o.l, 0, 0, o.opacity);
      var h = o.h * deg2rad;
      return new Lab(o.l, Math.cos(h) * o.c, Math.sin(h) * o.c, o.opacity);
    }
    if (!(o instanceof Rgb)) o = rgbConvert(o);
    var r = rgb2lrgb(o.r),
        g = rgb2lrgb(o.g),
        b = rgb2lrgb(o.b),
        y = xyz2lab((0.2225045 * r + 0.7168786 * g + 0.0606169 * b) / Yn), x, z;
    if (r === g && g === b) x = z = y; else {
      x = xyz2lab((0.4360747 * r + 0.3850649 * g + 0.1430804 * b) / Xn);
      z = xyz2lab((0.0139322 * r + 0.0971045 * g + 0.7141733 * b) / Zn);
    }
    return new Lab(116 * y - 16, 500 * (x - y), 200 * (y - z), o.opacity);
  }

  function lab(l, a, b, opacity) {
    return arguments.length === 1 ? labConvert(l) : new Lab(l, a, b, opacity == null ? 1 : opacity);
  }

  function Lab(l, a, b, opacity) {
    this.l = +l;
    this.a = +a;
    this.b = +b;
    this.opacity = +opacity;
  }

  define(Lab, lab, extend(Color, {
    brighter: function(k) {
      return new Lab(this.l + K * (k == null ? 1 : k), this.a, this.b, this.opacity);
    },
    darker: function(k) {
      return new Lab(this.l - K * (k == null ? 1 : k), this.a, this.b, this.opacity);
    },
    rgb: function() {
      var y = (this.l + 16) / 116,
          x = isNaN(this.a) ? y : y + this.a / 500,
          z = isNaN(this.b) ? y : y - this.b / 200;
      x = Xn * lab2xyz(x);
      y = Yn * lab2xyz(y);
      z = Zn * lab2xyz(z);
      return new Rgb(
        lrgb2rgb( 3.1338561 * x - 1.6168667 * y - 0.4906146 * z),
        lrgb2rgb(-0.9787684 * x + 1.9161415 * y + 0.0334540 * z),
        lrgb2rgb( 0.0719453 * x - 0.2289914 * y + 1.4052427 * z),
        this.opacity
      );
    }
  }));

  function xyz2lab(t) {
    return t > t3 ? Math.pow(t, 1 / 3) : t / t2 + t0;
  }

  function lab2xyz(t) {
    return t > t1 ? t * t * t : t2 * (t - t0);
  }

  function lrgb2rgb(x) {
    return 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
  }

  function rgb2lrgb(x) {
    return (x /= 255) <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  }

  function hclConvert(o) {
    if (o instanceof Hcl) return new Hcl(o.h, o.c, o.l, o.opacity);
    if (!(o instanceof Lab)) o = labConvert(o);
    if (o.a === 0 && o.b === 0) return new Hcl(NaN, 0, o.l, o.opacity);
    var h = Math.atan2(o.b, o.a) * rad2deg;
    return new Hcl(h < 0 ? h + 360 : h, Math.sqrt(o.a * o.a + o.b * o.b), o.l, o.opacity);
  }

  function hcl(h, c, l, opacity) {
    return arguments.length === 1 ? hclConvert(h) : new Hcl(h, c, l, opacity == null ? 1 : opacity);
  }

  function Hcl(h, c, l, opacity) {
    this.h = +h;
    this.c = +c;
    this.l = +l;
    this.opacity = +opacity;
  }

  define(Hcl, hcl, extend(Color, {
    brighter: function(k) {
      return new Hcl(this.h, this.c, this.l + K * (k == null ? 1 : k), this.opacity);
    },
    darker: function(k) {
      return new Hcl(this.h, this.c, this.l - K * (k == null ? 1 : k), this.opacity);
    },
    rgb: function() {
      return labConvert(this).rgb();
    }
  }));

  var A = -0.14861,
      B = +1.78277,
      C = -0.29227,
      D = -0.90649,
      E = +1.97294,
      ED = E * D,
      EB = E * B,
      BC_DA = B * C - D * A;

  function cubehelixConvert(o) {
    if (o instanceof Cubehelix) return new Cubehelix(o.h, o.s, o.l, o.opacity);
    if (!(o instanceof Rgb)) o = rgbConvert(o);
    var r = o.r / 255,
        g = o.g / 255,
        b = o.b / 255,
        l = (BC_DA * b + ED * r - EB * g) / (BC_DA + ED - EB),
        bl = b - l,
        k = (E * (g - l) - C * bl) / D,
        s = Math.sqrt(k * k + bl * bl) / (E * l * (1 - l)), // NaN if l=0 or l=1
        h = s ? Math.atan2(k, bl) * rad2deg - 120 : NaN;
    return new Cubehelix(h < 0 ? h + 360 : h, s, l, o.opacity);
  }

  function cubehelix(h, s, l, opacity) {
    return arguments.length === 1 ? cubehelixConvert(h) : new Cubehelix(h, s, l, opacity == null ? 1 : opacity);
  }

  function Cubehelix(h, s, l, opacity) {
    this.h = +h;
    this.s = +s;
    this.l = +l;
    this.opacity = +opacity;
  }

  define(Cubehelix, cubehelix, extend(Color, {
    brighter: function(k) {
      k = k == null ? brighter : Math.pow(brighter, k);
      return new Cubehelix(this.h, this.s, this.l * k, this.opacity);
    },
    darker: function(k) {
      k = k == null ? darker : Math.pow(darker, k);
      return new Cubehelix(this.h, this.s, this.l * k, this.opacity);
    },
    rgb: function() {
      var h = isNaN(this.h) ? 0 : (this.h + 120) * deg2rad,
          l = +this.l,
          a = isNaN(this.s) ? 0 : this.s * l * (1 - l),
          cosh = Math.cos(h),
          sinh = Math.sin(h);
      return new Rgb(
        255 * (l + a * (A * cosh + B * sinh)),
        255 * (l + a * (C * cosh + D * sinh)),
        255 * (l + a * (E * cosh)),
        this.opacity
      );
    }
  }));

  function basis(t1, v0, v1, v2, v3) {
    var t2 = t1 * t1, t3 = t2 * t1;
    return ((1 - 3 * t1 + 3 * t2 - t3) * v0
        + (4 - 6 * t2 + 3 * t3) * v1
        + (1 + 3 * t1 + 3 * t2 - 3 * t3) * v2
        + t3 * v3) / 6;
  }

  function basis$1(values) {
    var n = values.length - 1;
    return function(t) {
      var i = t <= 0 ? (t = 0) : t >= 1 ? (t = 1, n - 1) : Math.floor(t * n),
          v1 = values[i],
          v2 = values[i + 1],
          v0 = i > 0 ? values[i - 1] : 2 * v1 - v2,
          v3 = i < n - 1 ? values[i + 2] : 2 * v2 - v1;
      return basis((t - i / n) * n, v0, v1, v2, v3);
    };
  }

  function constant$3(x) {
    return function() {
      return x;
    };
  }

  function linear(a, d) {
    return function(t) {
      return a + t * d;
    };
  }

  function exponential(a, b, y) {
    return a = Math.pow(a, y), b = Math.pow(b, y) - a, y = 1 / y, function(t) {
      return Math.pow(a + t * b, y);
    };
  }

  function hue(a, b) {
    var d = b - a;
    return d ? linear(a, d > 180 || d < -180 ? d - 360 * Math.round(d / 360) : d) : constant$3(isNaN(a) ? b : a);
  }

  function gamma(y) {
    return (y = +y) === 1 ? nogamma : function(a, b) {
      return b - a ? exponential(a, b, y) : constant$3(isNaN(a) ? b : a);
    };
  }

  function nogamma(a, b) {
    var d = b - a;
    return d ? linear(a, d) : constant$3(isNaN(a) ? b : a);
  }

  var interpolateRgb = (function rgbGamma(y) {
    var color$$1 = gamma(y);

    function rgb$$1(start, end) {
      var r = color$$1((start = rgb(start)).r, (end = rgb(end)).r),
          g = color$$1(start.g, end.g),
          b = color$$1(start.b, end.b),
          opacity = nogamma(start.opacity, end.opacity);
      return function(t) {
        start.r = r(t);
        start.g = g(t);
        start.b = b(t);
        start.opacity = opacity(t);
        return start + "";
      };
    }

    rgb$$1.gamma = rgbGamma;

    return rgb$$1;
  })(1);

  function rgbSpline(spline) {
    return function(colors) {
      var n = colors.length,
          r = new Array(n),
          g = new Array(n),
          b = new Array(n),
          i, color$$1;
      for (i = 0; i < n; ++i) {
        color$$1 = rgb(colors[i]);
        r[i] = color$$1.r || 0;
        g[i] = color$$1.g || 0;
        b[i] = color$$1.b || 0;
      }
      r = spline(r);
      g = spline(g);
      b = spline(b);
      color$$1.opacity = 1;
      return function(t) {
        color$$1.r = r(t);
        color$$1.g = g(t);
        color$$1.b = b(t);
        return color$$1 + "";
      };
    };
  }

  var rgbBasis = rgbSpline(basis$1);

  function interpolateNumber(a, b) {
    return a = +a, b -= a, function(t) {
      return a + b * t;
    };
  }

  var reA = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g,
      reB = new RegExp(reA.source, "g");

  function zero(b) {
    return function() {
      return b;
    };
  }

  function one(b) {
    return function(t) {
      return b(t) + "";
    };
  }

  function interpolateString(a, b) {
    var bi = reA.lastIndex = reB.lastIndex = 0, // scan index for next number in b
        am, // current match in a
        bm, // current match in b
        bs, // string preceding current number in b, if any
        i = -1, // index in s
        s = [], // string constants and placeholders
        q = []; // number interpolators

    // Coerce inputs to strings.
    a = a + "", b = b + "";

    // Interpolate pairs of numbers in a & b.
    while ((am = reA.exec(a))
        && (bm = reB.exec(b))) {
      if ((bs = bm.index) > bi) { // a string precedes the next number in b
        bs = b.slice(bi, bs);
        if (s[i]) s[i] += bs; // coalesce with previous string
        else s[++i] = bs;
      }
      if ((am = am[0]) === (bm = bm[0])) { // numbers in a & b match
        if (s[i]) s[i] += bm; // coalesce with previous string
        else s[++i] = bm;
      } else { // interpolate non-matching numbers
        s[++i] = null;
        q.push({i: i, x: interpolateNumber(am, bm)});
      }
      bi = reB.lastIndex;
    }

    // Add remains of b.
    if (bi < b.length) {
      bs = b.slice(bi);
      if (s[i]) s[i] += bs; // coalesce with previous string
      else s[++i] = bs;
    }

    // Special optimization for only a single match.
    // Otherwise, interpolate each of the numbers and rejoin the string.
    return s.length < 2 ? (q[0]
        ? one(q[0].x)
        : zero(b))
        : (b = q.length, function(t) {
            for (var i = 0, o; i < b; ++i) s[(o = q[i]).i] = o.x(t);
            return s.join("");
          });
  }

  var degrees = 180 / Math.PI;

  var identity$2 = {
    translateX: 0,
    translateY: 0,
    rotate: 0,
    skewX: 0,
    scaleX: 1,
    scaleY: 1
  };

  function decompose(a, b, c, d, e, f) {
    var scaleX, scaleY, skewX;
    if (scaleX = Math.sqrt(a * a + b * b)) a /= scaleX, b /= scaleX;
    if (skewX = a * c + b * d) c -= a * skewX, d -= b * skewX;
    if (scaleY = Math.sqrt(c * c + d * d)) c /= scaleY, d /= scaleY, skewX /= scaleY;
    if (a * d < b * c) a = -a, b = -b, skewX = -skewX, scaleX = -scaleX;
    return {
      translateX: e,
      translateY: f,
      rotate: Math.atan2(b, a) * degrees,
      skewX: Math.atan(skewX) * degrees,
      scaleX: scaleX,
      scaleY: scaleY
    };
  }

  var cssNode,
      cssRoot,
      cssView,
      svgNode;

  function parseCss(value) {
    if (value === "none") return identity$2;
    if (!cssNode) cssNode = document.createElement("DIV"), cssRoot = document.documentElement, cssView = document.defaultView;
    cssNode.style.transform = value;
    value = cssView.getComputedStyle(cssRoot.appendChild(cssNode), null).getPropertyValue("transform");
    cssRoot.removeChild(cssNode);
    value = value.slice(7, -1).split(",");
    return decompose(+value[0], +value[1], +value[2], +value[3], +value[4], +value[5]);
  }

  function parseSvg(value) {
    if (value == null) return identity$2;
    if (!svgNode) svgNode = document.createElementNS("http://www.w3.org/2000/svg", "g");
    svgNode.setAttribute("transform", value);
    if (!(value = svgNode.transform.baseVal.consolidate())) return identity$2;
    value = value.matrix;
    return decompose(value.a, value.b, value.c, value.d, value.e, value.f);
  }

  function interpolateTransform(parse, pxComma, pxParen, degParen) {

    function pop(s) {
      return s.length ? s.pop() + " " : "";
    }

    function translate(xa, ya, xb, yb, s, q) {
      if (xa !== xb || ya !== yb) {
        var i = s.push("translate(", null, pxComma, null, pxParen);
        q.push({i: i - 4, x: interpolateNumber(xa, xb)}, {i: i - 2, x: interpolateNumber(ya, yb)});
      } else if (xb || yb) {
        s.push("translate(" + xb + pxComma + yb + pxParen);
      }
    }

    function rotate(a, b, s, q) {
      if (a !== b) {
        if (a - b > 180) b += 360; else if (b - a > 180) a += 360; // shortest path
        q.push({i: s.push(pop(s) + "rotate(", null, degParen) - 2, x: interpolateNumber(a, b)});
      } else if (b) {
        s.push(pop(s) + "rotate(" + b + degParen);
      }
    }

    function skewX(a, b, s, q) {
      if (a !== b) {
        q.push({i: s.push(pop(s) + "skewX(", null, degParen) - 2, x: interpolateNumber(a, b)});
      } else if (b) {
        s.push(pop(s) + "skewX(" + b + degParen);
      }
    }

    function scale(xa, ya, xb, yb, s, q) {
      if (xa !== xb || ya !== yb) {
        var i = s.push(pop(s) + "scale(", null, ",", null, ")");
        q.push({i: i - 4, x: interpolateNumber(xa, xb)}, {i: i - 2, x: interpolateNumber(ya, yb)});
      } else if (xb !== 1 || yb !== 1) {
        s.push(pop(s) + "scale(" + xb + "," + yb + ")");
      }
    }

    return function(a, b) {
      var s = [], // string constants and placeholders
          q = []; // number interpolators
      a = parse(a), b = parse(b);
      translate(a.translateX, a.translateY, b.translateX, b.translateY, s, q);
      rotate(a.rotate, b.rotate, s, q);
      skewX(a.skewX, b.skewX, s, q);
      scale(a.scaleX, a.scaleY, b.scaleX, b.scaleY, s, q);
      a = b = null; // gc
      return function(t) {
        var i = -1, n = q.length, o;
        while (++i < n) s[(o = q[i]).i] = o.x(t);
        return s.join("");
      };
    };
  }

  var interpolateTransformCss = interpolateTransform(parseCss, "px, ", "px)", "deg)");
  var interpolateTransformSvg = interpolateTransform(parseSvg, ", ", ")", ")");

  var rho = Math.SQRT2,
      rho2 = 2,
      rho4 = 4,
      epsilon2 = 1e-12;

  function cosh(x) {
    return ((x = Math.exp(x)) + 1 / x) / 2;
  }

  function sinh(x) {
    return ((x = Math.exp(x)) - 1 / x) / 2;
  }

  function tanh(x) {
    return ((x = Math.exp(2 * x)) - 1) / (x + 1);
  }

  // p0 = [ux0, uy0, w0]
  // p1 = [ux1, uy1, w1]
  function interpolateZoom(p0, p1) {
    var ux0 = p0[0], uy0 = p0[1], w0 = p0[2],
        ux1 = p1[0], uy1 = p1[1], w1 = p1[2],
        dx = ux1 - ux0,
        dy = uy1 - uy0,
        d2 = dx * dx + dy * dy,
        i,
        S;

    // Special case for u0 ≅ u1.
    if (d2 < epsilon2) {
      S = Math.log(w1 / w0) / rho;
      i = function(t) {
        return [
          ux0 + t * dx,
          uy0 + t * dy,
          w0 * Math.exp(rho * t * S)
        ];
      };
    }

    // General case.
    else {
      var d1 = Math.sqrt(d2),
          b0 = (w1 * w1 - w0 * w0 + rho4 * d2) / (2 * w0 * rho2 * d1),
          b1 = (w1 * w1 - w0 * w0 - rho4 * d2) / (2 * w1 * rho2 * d1),
          r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0),
          r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
      S = (r1 - r0) / rho;
      i = function(t) {
        var s = t * S,
            coshr0 = cosh(r0),
            u = w0 / (rho2 * d1) * (coshr0 * tanh(rho * s + r0) - sinh(r0));
        return [
          ux0 + u * dx,
          uy0 + u * dy,
          w0 * coshr0 / cosh(rho * s + r0)
        ];
      };
    }

    i.duration = S * 1000;

    return i;
  }

  function cubehelix$1(hue$$1) {
    return (function cubehelixGamma(y) {
      y = +y;

      function cubehelix$$1(start, end) {
        var h = hue$$1((start = cubehelix(start)).h, (end = cubehelix(end)).h),
            s = nogamma(start.s, end.s),
            l = nogamma(start.l, end.l),
            opacity = nogamma(start.opacity, end.opacity);
        return function(t) {
          start.h = h(t);
          start.s = s(t);
          start.l = l(Math.pow(t, y));
          start.opacity = opacity(t);
          return start + "";
        };
      }

      cubehelix$$1.gamma = cubehelixGamma;

      return cubehelix$$1;
    })(1);
  }

  cubehelix$1(hue);
  var cubehelixLong = cubehelix$1(nogamma);

  var frame = 0, // is an animation frame pending?
      timeout = 0, // is a timeout pending?
      interval = 0, // are any timers active?
      pokeDelay = 1000, // how frequently we check for clock skew
      taskHead,
      taskTail,
      clockLast = 0,
      clockNow = 0,
      clockSkew = 0,
      clock = typeof performance === "object" && performance.now ? performance : Date,
      setFrame = typeof window === "object" && window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function(f) { setTimeout(f, 17); };

  function now() {
    return clockNow || (setFrame(clearNow), clockNow = clock.now() + clockSkew);
  }

  function clearNow() {
    clockNow = 0;
  }

  function Timer() {
    this._call =
    this._time =
    this._next = null;
  }

  Timer.prototype = timer.prototype = {
    constructor: Timer,
    restart: function(callback, delay, time) {
      if (typeof callback !== "function") throw new TypeError("callback is not a function");
      time = (time == null ? now() : +time) + (delay == null ? 0 : +delay);
      if (!this._next && taskTail !== this) {
        if (taskTail) taskTail._next = this;
        else taskHead = this;
        taskTail = this;
      }
      this._call = callback;
      this._time = time;
      sleep();
    },
    stop: function() {
      if (this._call) {
        this._call = null;
        this._time = Infinity;
        sleep();
      }
    }
  };

  function timer(callback, delay, time) {
    var t = new Timer;
    t.restart(callback, delay, time);
    return t;
  }

  function timerFlush() {
    now(); // Get the current time, if not already set.
    ++frame; // Pretend we’ve set an alarm, if we haven’t already.
    var t = taskHead, e;
    while (t) {
      if ((e = clockNow - t._time) >= 0) t._call.call(null, e);
      t = t._next;
    }
    --frame;
  }

  function wake() {
    clockNow = (clockLast = clock.now()) + clockSkew;
    frame = timeout = 0;
    try {
      timerFlush();
    } finally {
      frame = 0;
      nap();
      clockNow = 0;
    }
  }

  function poke() {
    var now = clock.now(), delay = now - clockLast;
    if (delay > pokeDelay) clockSkew -= delay, clockLast = now;
  }

  function nap() {
    var t0, t1 = taskHead, t2, time = Infinity;
    while (t1) {
      if (t1._call) {
        if (time > t1._time) time = t1._time;
        t0 = t1, t1 = t1._next;
      } else {
        t2 = t1._next, t1._next = null;
        t1 = t0 ? t0._next = t2 : taskHead = t2;
      }
    }
    taskTail = t0;
    sleep(time);
  }

  function sleep(time) {
    if (frame) return; // Soonest alarm already set, or will be.
    if (timeout) timeout = clearTimeout(timeout);
    var delay = time - clockNow; // Strictly less than if we recomputed clockNow.
    if (delay > 24) {
      if (time < Infinity) timeout = setTimeout(wake, time - clock.now() - clockSkew);
      if (interval) interval = clearInterval(interval);
    } else {
      if (!interval) clockLast = clock.now(), interval = setInterval(poke, pokeDelay);
      frame = 1, setFrame(wake);
    }
  }

  function timeout$1(callback, delay, time) {
    var t = new Timer;
    delay = delay == null ? 0 : +delay;
    t.restart(function(elapsed) {
      t.stop();
      callback(elapsed + delay);
    }, delay, time);
    return t;
  }

  var emptyOn = dispatch("start", "end", "interrupt");
  var emptyTween = [];

  var CREATED = 0;
  var SCHEDULED = 1;
  var STARTING = 2;
  var STARTED = 3;
  var RUNNING = 4;
  var ENDING = 5;
  var ENDED = 6;

  function schedule(node, name, id, index, group, timing) {
    var schedules = node.__transition;
    if (!schedules) node.__transition = {};
    else if (id in schedules) return;
    create$1(node, id, {
      name: name,
      index: index, // For context during callback.
      group: group, // For context during callback.
      on: emptyOn,
      tween: emptyTween,
      time: timing.time,
      delay: timing.delay,
      duration: timing.duration,
      ease: timing.ease,
      timer: null,
      state: CREATED
    });
  }

  function init(node, id) {
    var schedule = get$1(node, id);
    if (schedule.state > CREATED) throw new Error("too late; already scheduled");
    return schedule;
  }

  function set$1(node, id) {
    var schedule = get$1(node, id);
    if (schedule.state > STARTING) throw new Error("too late; already started");
    return schedule;
  }

  function get$1(node, id) {
    var schedule = node.__transition;
    if (!schedule || !(schedule = schedule[id])) throw new Error("transition not found");
    return schedule;
  }

  function create$1(node, id, self) {
    var schedules = node.__transition,
        tween;

    // Initialize the self timer when the transition is created.
    // Note the actual delay is not known until the first callback!
    schedules[id] = self;
    self.timer = timer(schedule, 0, self.time);

    function schedule(elapsed) {
      self.state = SCHEDULED;
      self.timer.restart(start, self.delay, self.time);

      // If the elapsed delay is less than our first sleep, start immediately.
      if (self.delay <= elapsed) start(elapsed - self.delay);
    }

    function start(elapsed) {
      var i, j, n, o;

      // If the state is not SCHEDULED, then we previously errored on start.
      if (self.state !== SCHEDULED) return stop();

      for (i in schedules) {
        o = schedules[i];
        if (o.name !== self.name) continue;

        // While this element already has a starting transition during this frame,
        // defer starting an interrupting transition until that transition has a
        // chance to tick (and possibly end); see d3/d3-transition#54!
        if (o.state === STARTED) return timeout$1(start);

        // Interrupt the active transition, if any.
        // Dispatch the interrupt event.
        if (o.state === RUNNING) {
          o.state = ENDED;
          o.timer.stop();
          o.on.call("interrupt", node, node.__data__, o.index, o.group);
          delete schedules[i];
        }

        // Cancel any pre-empted transitions. No interrupt event is dispatched
        // because the cancelled transitions never started. Note that this also
        // removes this transition from the pending list!
        else if (+i < id) {
          o.state = ENDED;
          o.timer.stop();
          delete schedules[i];
        }
      }

      // Defer the first tick to end of the current frame; see d3/d3#1576.
      // Note the transition may be canceled after start and before the first tick!
      // Note this must be scheduled before the start event; see d3/d3-transition#16!
      // Assuming this is successful, subsequent callbacks go straight to tick.
      timeout$1(function() {
        if (self.state === STARTED) {
          self.state = RUNNING;
          self.timer.restart(tick, self.delay, self.time);
          tick(elapsed);
        }
      });

      // Dispatch the start event.
      // Note this must be done before the tween are initialized.
      self.state = STARTING;
      self.on.call("start", node, node.__data__, self.index, self.group);
      if (self.state !== STARTING) return; // interrupted
      self.state = STARTED;

      // Initialize the tween, deleting null tween.
      tween = new Array(n = self.tween.length);
      for (i = 0, j = -1; i < n; ++i) {
        if (o = self.tween[i].value.call(node, node.__data__, self.index, self.group)) {
          tween[++j] = o;
        }
      }
      tween.length = j + 1;
    }

    function tick(elapsed) {
      var t = elapsed < self.duration ? self.ease.call(null, elapsed / self.duration) : (self.timer.restart(stop), self.state = ENDING, 1),
          i = -1,
          n = tween.length;

      while (++i < n) {
        tween[i].call(null, t);
      }

      // Dispatch the end event.
      if (self.state === ENDING) {
        self.on.call("end", node, node.__data__, self.index, self.group);
        stop();
      }
    }

    function stop() {
      self.state = ENDED;
      self.timer.stop();
      delete schedules[id];
      for (var i in schedules) return; // eslint-disable-line no-unused-vars
      delete node.__transition;
    }
  }

  function interrupt(node, name) {
    var schedules = node.__transition,
        schedule$$1,
        active,
        empty = true,
        i;

    if (!schedules) return;

    name = name == null ? null : name + "";

    for (i in schedules) {
      if ((schedule$$1 = schedules[i]).name !== name) { empty = false; continue; }
      active = schedule$$1.state > STARTING && schedule$$1.state < ENDING;
      schedule$$1.state = ENDED;
      schedule$$1.timer.stop();
      if (active) schedule$$1.on.call("interrupt", node, node.__data__, schedule$$1.index, schedule$$1.group);
      delete schedules[i];
    }

    if (empty) delete node.__transition;
  }

  function selection_interrupt(name) {
    return this.each(function() {
      interrupt(this, name);
    });
  }

  function tweenRemove(id, name) {
    var tween0, tween1;
    return function() {
      var schedule$$1 = set$1(this, id),
          tween = schedule$$1.tween;

      // If this node shared tween with the previous node,
      // just assign the updated shared tween and we’re done!
      // Otherwise, copy-on-write.
      if (tween !== tween0) {
        tween1 = tween0 = tween;
        for (var i = 0, n = tween1.length; i < n; ++i) {
          if (tween1[i].name === name) {
            tween1 = tween1.slice();
            tween1.splice(i, 1);
            break;
          }
        }
      }

      schedule$$1.tween = tween1;
    };
  }

  function tweenFunction(id, name, value) {
    var tween0, tween1;
    if (typeof value !== "function") throw new Error;
    return function() {
      var schedule$$1 = set$1(this, id),
          tween = schedule$$1.tween;

      // If this node shared tween with the previous node,
      // just assign the updated shared tween and we’re done!
      // Otherwise, copy-on-write.
      if (tween !== tween0) {
        tween1 = (tween0 = tween).slice();
        for (var t = {name: name, value: value}, i = 0, n = tween1.length; i < n; ++i) {
          if (tween1[i].name === name) {
            tween1[i] = t;
            break;
          }
        }
        if (i === n) tween1.push(t);
      }

      schedule$$1.tween = tween1;
    };
  }

  function transition_tween(name, value) {
    var id = this._id;

    name += "";

    if (arguments.length < 2) {
      var tween = get$1(this.node(), id).tween;
      for (var i = 0, n = tween.length, t; i < n; ++i) {
        if ((t = tween[i]).name === name) {
          return t.value;
        }
      }
      return null;
    }

    return this.each((value == null ? tweenRemove : tweenFunction)(id, name, value));
  }

  function tweenValue(transition, name, value) {
    var id = transition._id;

    transition.each(function() {
      var schedule$$1 = set$1(this, id);
      (schedule$$1.value || (schedule$$1.value = {}))[name] = value.apply(this, arguments);
    });

    return function(node) {
      return get$1(node, id).value[name];
    };
  }

  function interpolate$1(a, b) {
    var c;
    return (typeof b === "number" ? interpolateNumber
        : b instanceof color ? interpolateRgb
        : (c = color(b)) ? (b = c, interpolateRgb)
        : interpolateString)(a, b);
  }

  function attrRemove$1(name) {
    return function() {
      this.removeAttribute(name);
    };
  }

  function attrRemoveNS$1(fullname) {
    return function() {
      this.removeAttributeNS(fullname.space, fullname.local);
    };
  }

  function attrConstant$1(name, interpolate, value1) {
    var value00,
        interpolate0;
    return function() {
      var value0 = this.getAttribute(name);
      return value0 === value1 ? null
          : value0 === value00 ? interpolate0
          : interpolate0 = interpolate(value00 = value0, value1);
    };
  }

  function attrConstantNS$1(fullname, interpolate, value1) {
    var value00,
        interpolate0;
    return function() {
      var value0 = this.getAttributeNS(fullname.space, fullname.local);
      return value0 === value1 ? null
          : value0 === value00 ? interpolate0
          : interpolate0 = interpolate(value00 = value0, value1);
    };
  }

  function attrFunction$1(name, interpolate, value) {
    var value00,
        value10,
        interpolate0;
    return function() {
      var value0, value1 = value(this);
      if (value1 == null) return void this.removeAttribute(name);
      value0 = this.getAttribute(name);
      return value0 === value1 ? null
          : value0 === value00 && value1 === value10 ? interpolate0
          : interpolate0 = interpolate(value00 = value0, value10 = value1);
    };
  }

  function attrFunctionNS$1(fullname, interpolate, value) {
    var value00,
        value10,
        interpolate0;
    return function() {
      var value0, value1 = value(this);
      if (value1 == null) return void this.removeAttributeNS(fullname.space, fullname.local);
      value0 = this.getAttributeNS(fullname.space, fullname.local);
      return value0 === value1 ? null
          : value0 === value00 && value1 === value10 ? interpolate0
          : interpolate0 = interpolate(value00 = value0, value10 = value1);
    };
  }

  function transition_attr(name, value) {
    var fullname = namespace(name), i = fullname === "transform" ? interpolateTransformSvg : interpolate$1;
    return this.attrTween(name, typeof value === "function"
        ? (fullname.local ? attrFunctionNS$1 : attrFunction$1)(fullname, i, tweenValue(this, "attr." + name, value))
        : value == null ? (fullname.local ? attrRemoveNS$1 : attrRemove$1)(fullname)
        : (fullname.local ? attrConstantNS$1 : attrConstant$1)(fullname, i, value + ""));
  }

  function attrTweenNS(fullname, value) {
    function tween() {
      var node = this, i = value.apply(node, arguments);
      return i && function(t) {
        node.setAttributeNS(fullname.space, fullname.local, i(t));
      };
    }
    tween._value = value;
    return tween;
  }

  function attrTween(name, value) {
    function tween() {
      var node = this, i = value.apply(node, arguments);
      return i && function(t) {
        node.setAttribute(name, i(t));
      };
    }
    tween._value = value;
    return tween;
  }

  function transition_attrTween(name, value) {
    var key = "attr." + name;
    if (arguments.length < 2) return (key = this.tween(key)) && key._value;
    if (value == null) return this.tween(key, null);
    if (typeof value !== "function") throw new Error;
    var fullname = namespace(name);
    return this.tween(key, (fullname.local ? attrTweenNS : attrTween)(fullname, value));
  }

  function delayFunction(id, value) {
    return function() {
      init(this, id).delay = +value.apply(this, arguments);
    };
  }

  function delayConstant(id, value) {
    return value = +value, function() {
      init(this, id).delay = value;
    };
  }

  function transition_delay(value) {
    var id = this._id;

    return arguments.length
        ? this.each((typeof value === "function"
            ? delayFunction
            : delayConstant)(id, value))
        : get$1(this.node(), id).delay;
  }

  function durationFunction(id, value) {
    return function() {
      set$1(this, id).duration = +value.apply(this, arguments);
    };
  }

  function durationConstant(id, value) {
    return value = +value, function() {
      set$1(this, id).duration = value;
    };
  }

  function transition_duration(value) {
    var id = this._id;

    return arguments.length
        ? this.each((typeof value === "function"
            ? durationFunction
            : durationConstant)(id, value))
        : get$1(this.node(), id).duration;
  }

  function easeConstant(id, value) {
    if (typeof value !== "function") throw new Error;
    return function() {
      set$1(this, id).ease = value;
    };
  }

  function transition_ease(value) {
    var id = this._id;

    return arguments.length
        ? this.each(easeConstant(id, value))
        : get$1(this.node(), id).ease;
  }

  function transition_filter(match) {
    if (typeof match !== "function") match = matcher$1(match);

    for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, subgroup = subgroups[j] = [], node, i = 0; i < n; ++i) {
        if ((node = group[i]) && match.call(node, node.__data__, i, group)) {
          subgroup.push(node);
        }
      }
    }

    return new Transition(subgroups, this._parents, this._name, this._id);
  }

  function transition_merge(transition$$1) {
    if (transition$$1._id !== this._id) throw new Error;

    for (var groups0 = this._groups, groups1 = transition$$1._groups, m0 = groups0.length, m1 = groups1.length, m = Math.min(m0, m1), merges = new Array(m0), j = 0; j < m; ++j) {
      for (var group0 = groups0[j], group1 = groups1[j], n = group0.length, merge = merges[j] = new Array(n), node, i = 0; i < n; ++i) {
        if (node = group0[i] || group1[i]) {
          merge[i] = node;
        }
      }
    }

    for (; j < m0; ++j) {
      merges[j] = groups0[j];
    }

    return new Transition(merges, this._parents, this._name, this._id);
  }

  function start(name) {
    return (name + "").trim().split(/^|\s+/).every(function(t) {
      var i = t.indexOf(".");
      if (i >= 0) t = t.slice(0, i);
      return !t || t === "start";
    });
  }

  function onFunction(id, name, listener) {
    var on0, on1, sit = start(name) ? init : set$1;
    return function() {
      var schedule$$1 = sit(this, id),
          on = schedule$$1.on;

      // If this node shared a dispatch with the previous node,
      // just assign the updated shared dispatch and we’re done!
      // Otherwise, copy-on-write.
      if (on !== on0) (on1 = (on0 = on).copy()).on(name, listener);

      schedule$$1.on = on1;
    };
  }

  function transition_on(name, listener) {
    var id = this._id;

    return arguments.length < 2
        ? get$1(this.node(), id).on.on(name)
        : this.each(onFunction(id, name, listener));
  }

  function removeFunction(id) {
    return function() {
      var parent = this.parentNode;
      for (var i in this.__transition) if (+i !== id) return;
      if (parent) parent.removeChild(this);
    };
  }

  function transition_remove() {
    return this.on("end.remove", removeFunction(this._id));
  }

  function transition_select(select$$1) {
    var name = this._name,
        id = this._id;

    if (typeof select$$1 !== "function") select$$1 = selector(select$$1);

    for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, subgroup = subgroups[j] = new Array(n), node, subnode, i = 0; i < n; ++i) {
        if ((node = group[i]) && (subnode = select$$1.call(node, node.__data__, i, group))) {
          if ("__data__" in node) subnode.__data__ = node.__data__;
          subgroup[i] = subnode;
          schedule(subgroup[i], name, id, i, subgroup, get$1(node, id));
        }
      }
    }

    return new Transition(subgroups, this._parents, name, id);
  }

  function transition_selectAll(select$$1) {
    var name = this._name,
        id = this._id;

    if (typeof select$$1 !== "function") select$$1 = selectorAll(select$$1);

    for (var groups = this._groups, m = groups.length, subgroups = [], parents = [], j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
        if (node = group[i]) {
          for (var children = select$$1.call(node, node.__data__, i, group), child, inherit = get$1(node, id), k = 0, l = children.length; k < l; ++k) {
            if (child = children[k]) {
              schedule(child, name, id, k, children, inherit);
            }
          }
          subgroups.push(children);
          parents.push(node);
        }
      }
    }

    return new Transition(subgroups, parents, name, id);
  }

  var Selection$1 = selection.prototype.constructor;

  function transition_selection() {
    return new Selection$1(this._groups, this._parents);
  }

  function styleRemove$1(name, interpolate) {
    var value00,
        value10,
        interpolate0;
    return function() {
      var value0 = styleValue(this, name),
          value1 = (this.style.removeProperty(name), styleValue(this, name));
      return value0 === value1 ? null
          : value0 === value00 && value1 === value10 ? interpolate0
          : interpolate0 = interpolate(value00 = value0, value10 = value1);
    };
  }

  function styleRemoveEnd(name) {
    return function() {
      this.style.removeProperty(name);
    };
  }

  function styleConstant$1(name, interpolate, value1) {
    var value00,
        interpolate0;
    return function() {
      var value0 = styleValue(this, name);
      return value0 === value1 ? null
          : value0 === value00 ? interpolate0
          : interpolate0 = interpolate(value00 = value0, value1);
    };
  }

  function styleFunction$1(name, interpolate, value) {
    var value00,
        value10,
        interpolate0;
    return function() {
      var value0 = styleValue(this, name),
          value1 = value(this);
      if (value1 == null) value1 = (this.style.removeProperty(name), styleValue(this, name));
      return value0 === value1 ? null
          : value0 === value00 && value1 === value10 ? interpolate0
          : interpolate0 = interpolate(value00 = value0, value10 = value1);
    };
  }

  function transition_style(name, value, priority) {
    var i = (name += "") === "transform" ? interpolateTransformCss : interpolate$1;
    return value == null ? this
            .styleTween(name, styleRemove$1(name, i))
            .on("end.style." + name, styleRemoveEnd(name))
        : this.styleTween(name, typeof value === "function"
            ? styleFunction$1(name, i, tweenValue(this, "style." + name, value))
            : styleConstant$1(name, i, value + ""), priority);
  }

  function styleTween(name, value, priority) {
    function tween() {
      var node = this, i = value.apply(node, arguments);
      return i && function(t) {
        node.style.setProperty(name, i(t), priority);
      };
    }
    tween._value = value;
    return tween;
  }

  function transition_styleTween(name, value, priority) {
    var key = "style." + (name += "");
    if (arguments.length < 2) return (key = this.tween(key)) && key._value;
    if (value == null) return this.tween(key, null);
    if (typeof value !== "function") throw new Error;
    return this.tween(key, styleTween(name, value, priority == null ? "" : priority));
  }

  function textConstant$1(value) {
    return function() {
      this.textContent = value;
    };
  }

  function textFunction$1(value) {
    return function() {
      var value1 = value(this);
      this.textContent = value1 == null ? "" : value1;
    };
  }

  function transition_text(value) {
    return this.tween("text", typeof value === "function"
        ? textFunction$1(tweenValue(this, "text", value))
        : textConstant$1(value == null ? "" : value + ""));
  }

  function transition_transition() {
    var name = this._name,
        id0 = this._id,
        id1 = newId();

    for (var groups = this._groups, m = groups.length, j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
        if (node = group[i]) {
          var inherit = get$1(node, id0);
          schedule(node, name, id1, i, group, {
            time: inherit.time + inherit.delay + inherit.duration,
            delay: 0,
            duration: inherit.duration,
            ease: inherit.ease
          });
        }
      }
    }

    return new Transition(groups, this._parents, name, id1);
  }

  var id = 0;

  function Transition(groups, parents, name, id) {
    this._groups = groups;
    this._parents = parents;
    this._name = name;
    this._id = id;
  }

  function transition(name) {
    return selection().transition(name);
  }

  function newId() {
    return ++id;
  }

  var selection_prototype = selection.prototype;

  Transition.prototype = transition.prototype = {
    constructor: Transition,
    select: transition_select,
    selectAll: transition_selectAll,
    filter: transition_filter,
    merge: transition_merge,
    selection: transition_selection,
    transition: transition_transition,
    call: selection_prototype.call,
    nodes: selection_prototype.nodes,
    node: selection_prototype.node,
    size: selection_prototype.size,
    empty: selection_prototype.empty,
    each: selection_prototype.each,
    on: transition_on,
    attr: transition_attr,
    attrTween: transition_attrTween,
    style: transition_style,
    styleTween: transition_styleTween,
    text: transition_text,
    remove: transition_remove,
    tween: transition_tween,
    delay: transition_delay,
    duration: transition_duration,
    ease: transition_ease
  };

  function cubicInOut(t) {
    return ((t *= 2) <= 1 ? t * t * t : (t -= 2) * t * t + 2) / 2;
  }

  var pi = Math.PI;

  var tau = 2 * Math.PI;

  var defaultTiming = {
    time: null, // Set on use.
    delay: 0,
    duration: 250,
    ease: cubicInOut
  };

  function inherit(node, id) {
    var timing;
    while (!(timing = node.__transition) || !(timing = timing[id])) {
      if (!(node = node.parentNode)) {
        return defaultTiming.time = now(), defaultTiming;
      }
    }
    return timing;
  }

  function selection_transition(name) {
    var id,
        timing;

    if (name instanceof Transition) {
      id = name._id, name = name._name;
    } else {
      id = newId(), (timing = defaultTiming).time = now(), name = name == null ? null : name + "";
    }

    for (var groups = this._groups, m = groups.length, j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
        if (node = group[i]) {
          schedule(node, name, id, i, group, timing || inherit(node, id));
        }
      }
    }

    return new Transition(groups, this._parents, name, id);
  }

  selection.prototype.interrupt = selection_interrupt;
  selection.prototype.transition = selection_transition;

  var pi$1 = Math.PI;

  var pi$2 = Math.PI;

  var prefix = "$";

  function Map$1() {}

  Map$1.prototype = map$1.prototype = {
    constructor: Map$1,
    has: function(key) {
      return (prefix + key) in this;
    },
    get: function(key) {
      return this[prefix + key];
    },
    set: function(key, value) {
      this[prefix + key] = value;
      return this;
    },
    remove: function(key) {
      var property = prefix + key;
      return property in this && delete this[property];
    },
    clear: function() {
      for (var property in this) if (property[0] === prefix) delete this[property];
    },
    keys: function() {
      var keys = [];
      for (var property in this) if (property[0] === prefix) keys.push(property.slice(1));
      return keys;
    },
    values: function() {
      var values = [];
      for (var property in this) if (property[0] === prefix) values.push(this[property]);
      return values;
    },
    entries: function() {
      var entries = [];
      for (var property in this) if (property[0] === prefix) entries.push({key: property.slice(1), value: this[property]});
      return entries;
    },
    size: function() {
      var size = 0;
      for (var property in this) if (property[0] === prefix) ++size;
      return size;
    },
    empty: function() {
      for (var property in this) if (property[0] === prefix) return false;
      return true;
    },
    each: function(f) {
      for (var property in this) if (property[0] === prefix) f(this[property], property.slice(1), this);
    }
  };

  function map$1(object, f) {
    var map = new Map$1;

    // Copy constructor.
    if (object instanceof Map$1) object.each(function(value, key) { map.set(key, value); });

    // Index array by numeric index or specified key function.
    else if (Array.isArray(object)) {
      var i = -1,
          n = object.length,
          o;

      if (f == null) while (++i < n) map.set(i, object[i]);
      else while (++i < n) map.set(f(o = object[i], i, object), o);
    }

    // Convert object to map.
    else if (object) for (var key in object) map.set(key, object[key]);

    return map;
  }

  function Set$1() {}

  var proto = map$1.prototype;

  Set$1.prototype = set$2.prototype = {
    constructor: Set$1,
    has: proto.has,
    add: function(value) {
      value += "";
      this[prefix + value] = value;
      return this;
    },
    remove: proto.remove,
    clear: proto.clear,
    values: proto.keys,
    size: proto.size,
    empty: proto.empty,
    each: proto.each
  };

  function set$2(object, f) {
    var set = new Set$1;

    // Copy constructor.
    if (object instanceof Set$1) object.each(function(value) { set.add(value); });

    // Otherwise, assume it’s an array.
    else if (object) {
      var i = -1, n = object.length;
      if (f == null) while (++i < n) set.add(object[i]);
      else while (++i < n) set.add(f(object[i], i, object));
    }

    return set;
  }

  // TODO Optimize edge cases.

  var EOL = {},
      EOF = {},
      QUOTE = 34,
      NEWLINE = 10,
      RETURN = 13;

  function objectConverter(columns) {
    return new Function("d", "return {" + columns.map(function(name, i) {
      return JSON.stringify(name) + ": d[" + i + "]";
    }).join(",") + "}");
  }

  function customConverter(columns, f) {
    var object = objectConverter(columns);
    return function(row, i) {
      return f(object(row), i, columns);
    };
  }

  // Compute unique columns in order of discovery.
  function inferColumns(rows) {
    var columnSet = Object.create(null),
        columns = [];

    rows.forEach(function(row) {
      for (var column in row) {
        if (!(column in columnSet)) {
          columns.push(columnSet[column] = column);
        }
      }
    });

    return columns;
  }

  function dsvFormat(delimiter) {
    var reFormat = new RegExp("[\"" + delimiter + "\n\r]"),
        DELIMITER = delimiter.charCodeAt(0);

    function parse(text, f) {
      var convert, columns, rows = parseRows(text, function(row, i) {
        if (convert) return convert(row, i - 1);
        columns = row, convert = f ? customConverter(row, f) : objectConverter(row);
      });
      rows.columns = columns || [];
      return rows;
    }

    function parseRows(text, f) {
      var rows = [], // output rows
          N = text.length,
          I = 0, // current character index
          n = 0, // current line number
          t, // current token
          eof = N <= 0, // current token followed by EOF?
          eol = false; // current token followed by EOL?

      // Strip the trailing newline.
      if (text.charCodeAt(N - 1) === NEWLINE) --N;
      if (text.charCodeAt(N - 1) === RETURN) --N;

      function token() {
        if (eof) return EOF;
        if (eol) return eol = false, EOL;

        // Unescape quotes.
        var i, j = I, c;
        if (text.charCodeAt(j) === QUOTE) {
          while (I++ < N && text.charCodeAt(I) !== QUOTE || text.charCodeAt(++I) === QUOTE);
          if ((i = I) >= N) eof = true;
          else if ((c = text.charCodeAt(I++)) === NEWLINE) eol = true;
          else if (c === RETURN) { eol = true; if (text.charCodeAt(I) === NEWLINE) ++I; }
          return text.slice(j + 1, i - 1).replace(/""/g, "\"");
        }

        // Find next delimiter or newline.
        while (I < N) {
          if ((c = text.charCodeAt(i = I++)) === NEWLINE) eol = true;
          else if (c === RETURN) { eol = true; if (text.charCodeAt(I) === NEWLINE) ++I; }
          else if (c !== DELIMITER) continue;
          return text.slice(j, i);
        }

        // Return last token before EOF.
        return eof = true, text.slice(j, N);
      }

      while ((t = token()) !== EOF) {
        var row = [];
        while (t !== EOL && t !== EOF) row.push(t), t = token();
        if (f && (row = f(row, n++)) == null) continue;
        rows.push(row);
      }

      return rows;
    }

    function format(rows, columns) {
      if (columns == null) columns = inferColumns(rows);
      return [columns.map(formatValue).join(delimiter)].concat(rows.map(function(row) {
        return columns.map(function(column) {
          return formatValue(row[column]);
        }).join(delimiter);
      })).join("\n");
    }

    function formatRows(rows) {
      return rows.map(formatRow).join("\n");
    }

    function formatRow(row) {
      return row.map(formatValue).join(delimiter);
    }

    function formatValue(text) {
      return text == null ? ""
          : reFormat.test(text += "") ? "\"" + text.replace(/"/g, "\"\"") + "\""
          : text;
    }

    return {
      parse: parse,
      parseRows: parseRows,
      format: format,
      formatRows: formatRows
    };
  }

  var csv = dsvFormat(",");

  var tsv = dsvFormat("\t");

  function tree_add(d) {
    var x = +this._x.call(null, d),
        y = +this._y.call(null, d);
    return add(this.cover(x, y), x, y, d);
  }

  function add(tree, x, y, d) {
    if (isNaN(x) || isNaN(y)) return tree; // ignore invalid points

    var parent,
        node = tree._root,
        leaf = {data: d},
        x0 = tree._x0,
        y0 = tree._y0,
        x1 = tree._x1,
        y1 = tree._y1,
        xm,
        ym,
        xp,
        yp,
        right,
        bottom,
        i,
        j;

    // If the tree is empty, initialize the root as a leaf.
    if (!node) return tree._root = leaf, tree;

    // Find the existing leaf for the new point, or add it.
    while (node.length) {
      if (right = x >= (xm = (x0 + x1) / 2)) x0 = xm; else x1 = xm;
      if (bottom = y >= (ym = (y0 + y1) / 2)) y0 = ym; else y1 = ym;
      if (parent = node, !(node = node[i = bottom << 1 | right])) return parent[i] = leaf, tree;
    }

    // Is the new point is exactly coincident with the existing point?
    xp = +tree._x.call(null, node.data);
    yp = +tree._y.call(null, node.data);
    if (x === xp && y === yp) return leaf.next = node, parent ? parent[i] = leaf : tree._root = leaf, tree;

    // Otherwise, split the leaf node until the old and new point are separated.
    do {
      parent = parent ? parent[i] = new Array(4) : tree._root = new Array(4);
      if (right = x >= (xm = (x0 + x1) / 2)) x0 = xm; else x1 = xm;
      if (bottom = y >= (ym = (y0 + y1) / 2)) y0 = ym; else y1 = ym;
    } while ((i = bottom << 1 | right) === (j = (yp >= ym) << 1 | (xp >= xm)));
    return parent[j] = node, parent[i] = leaf, tree;
  }

  function addAll(data) {
    var d, i, n = data.length,
        x,
        y,
        xz = new Array(n),
        yz = new Array(n),
        x0 = Infinity,
        y0 = Infinity,
        x1 = -Infinity,
        y1 = -Infinity;

    // Compute the points and their extent.
    for (i = 0; i < n; ++i) {
      if (isNaN(x = +this._x.call(null, d = data[i])) || isNaN(y = +this._y.call(null, d))) continue;
      xz[i] = x;
      yz[i] = y;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }

    // If there were no (valid) points, inherit the existing extent.
    if (x1 < x0) x0 = this._x0, x1 = this._x1;
    if (y1 < y0) y0 = this._y0, y1 = this._y1;

    // Expand the tree to cover the new points.
    this.cover(x0, y0).cover(x1, y1);

    // Add the new points.
    for (i = 0; i < n; ++i) {
      add(this, xz[i], yz[i], data[i]);
    }

    return this;
  }

  function tree_cover(x, y) {
    if (isNaN(x = +x) || isNaN(y = +y)) return this; // ignore invalid points

    var x0 = this._x0,
        y0 = this._y0,
        x1 = this._x1,
        y1 = this._y1;

    // If the quadtree has no extent, initialize them.
    // Integer extent are necessary so that if we later double the extent,
    // the existing quadrant boundaries don’t change due to floating point error!
    if (isNaN(x0)) {
      x1 = (x0 = Math.floor(x)) + 1;
      y1 = (y0 = Math.floor(y)) + 1;
    }

    // Otherwise, double repeatedly to cover.
    else if (x0 > x || x > x1 || y0 > y || y > y1) {
      var z = x1 - x0,
          node = this._root,
          parent,
          i;

      switch (i = (y < (y0 + y1) / 2) << 1 | (x < (x0 + x1) / 2)) {
        case 0: {
          do parent = new Array(4), parent[i] = node, node = parent;
          while (z *= 2, x1 = x0 + z, y1 = y0 + z, x > x1 || y > y1);
          break;
        }
        case 1: {
          do parent = new Array(4), parent[i] = node, node = parent;
          while (z *= 2, x0 = x1 - z, y1 = y0 + z, x0 > x || y > y1);
          break;
        }
        case 2: {
          do parent = new Array(4), parent[i] = node, node = parent;
          while (z *= 2, x1 = x0 + z, y0 = y1 - z, x > x1 || y0 > y);
          break;
        }
        case 3: {
          do parent = new Array(4), parent[i] = node, node = parent;
          while (z *= 2, x0 = x1 - z, y0 = y1 - z, x0 > x || y0 > y);
          break;
        }
      }

      if (this._root && this._root.length) this._root = node;
    }

    // If the quadtree covers the point already, just return.
    else return this;

    this._x0 = x0;
    this._y0 = y0;
    this._x1 = x1;
    this._y1 = y1;
    return this;
  }

  function tree_data() {
    var data = [];
    this.visit(function(node) {
      if (!node.length) do data.push(node.data); while (node = node.next)
    });
    return data;
  }

  function tree_extent(_) {
    return arguments.length
        ? this.cover(+_[0][0], +_[0][1]).cover(+_[1][0], +_[1][1])
        : isNaN(this._x0) ? undefined : [[this._x0, this._y0], [this._x1, this._y1]];
  }

  function Quad(node, x0, y0, x1, y1) {
    this.node = node;
    this.x0 = x0;
    this.y0 = y0;
    this.x1 = x1;
    this.y1 = y1;
  }

  function tree_find(x, y, radius) {
    var data,
        x0 = this._x0,
        y0 = this._y0,
        x1,
        y1,
        x2,
        y2,
        x3 = this._x1,
        y3 = this._y1,
        quads = [],
        node = this._root,
        q,
        i;

    if (node) quads.push(new Quad(node, x0, y0, x3, y3));
    if (radius == null) radius = Infinity;
    else {
      x0 = x - radius, y0 = y - radius;
      x3 = x + radius, y3 = y + radius;
      radius *= radius;
    }

    while (q = quads.pop()) {

      // Stop searching if this quadrant can’t contain a closer node.
      if (!(node = q.node)
          || (x1 = q.x0) > x3
          || (y1 = q.y0) > y3
          || (x2 = q.x1) < x0
          || (y2 = q.y1) < y0) continue;

      // Bisect the current quadrant.
      if (node.length) {
        var xm = (x1 + x2) / 2,
            ym = (y1 + y2) / 2;

        quads.push(
          new Quad(node[3], xm, ym, x2, y2),
          new Quad(node[2], x1, ym, xm, y2),
          new Quad(node[1], xm, y1, x2, ym),
          new Quad(node[0], x1, y1, xm, ym)
        );

        // Visit the closest quadrant first.
        if (i = (y >= ym) << 1 | (x >= xm)) {
          q = quads[quads.length - 1];
          quads[quads.length - 1] = quads[quads.length - 1 - i];
          quads[quads.length - 1 - i] = q;
        }
      }

      // Visit this point. (Visiting coincident points isn’t necessary!)
      else {
        var dx = x - +this._x.call(null, node.data),
            dy = y - +this._y.call(null, node.data),
            d2 = dx * dx + dy * dy;
        if (d2 < radius) {
          var d = Math.sqrt(radius = d2);
          x0 = x - d, y0 = y - d;
          x3 = x + d, y3 = y + d;
          data = node.data;
        }
      }
    }

    return data;
  }

  function tree_remove(d) {
    if (isNaN(x = +this._x.call(null, d)) || isNaN(y = +this._y.call(null, d))) return this; // ignore invalid points

    var parent,
        node = this._root,
        retainer,
        previous,
        next,
        x0 = this._x0,
        y0 = this._y0,
        x1 = this._x1,
        y1 = this._y1,
        x,
        y,
        xm,
        ym,
        right,
        bottom,
        i,
        j;

    // If the tree is empty, initialize the root as a leaf.
    if (!node) return this;

    // Find the leaf node for the point.
    // While descending, also retain the deepest parent with a non-removed sibling.
    if (node.length) while (true) {
      if (right = x >= (xm = (x0 + x1) / 2)) x0 = xm; else x1 = xm;
      if (bottom = y >= (ym = (y0 + y1) / 2)) y0 = ym; else y1 = ym;
      if (!(parent = node, node = node[i = bottom << 1 | right])) return this;
      if (!node.length) break;
      if (parent[(i + 1) & 3] || parent[(i + 2) & 3] || parent[(i + 3) & 3]) retainer = parent, j = i;
    }

    // Find the point to remove.
    while (node.data !== d) if (!(previous = node, node = node.next)) return this;
    if (next = node.next) delete node.next;

    // If there are multiple coincident points, remove just the point.
    if (previous) return (next ? previous.next = next : delete previous.next), this;

    // If this is the root point, remove it.
    if (!parent) return this._root = next, this;

    // Remove this leaf.
    next ? parent[i] = next : delete parent[i];

    // If the parent now contains exactly one leaf, collapse superfluous parents.
    if ((node = parent[0] || parent[1] || parent[2] || parent[3])
        && node === (parent[3] || parent[2] || parent[1] || parent[0])
        && !node.length) {
      if (retainer) retainer[j] = node;
      else this._root = node;
    }

    return this;
  }

  function removeAll(data) {
    for (var i = 0, n = data.length; i < n; ++i) this.remove(data[i]);
    return this;
  }

  function tree_root() {
    return this._root;
  }

  function tree_size() {
    var size = 0;
    this.visit(function(node) {
      if (!node.length) do ++size; while (node = node.next)
    });
    return size;
  }

  function tree_visit(callback) {
    var quads = [], q, node = this._root, child, x0, y0, x1, y1;
    if (node) quads.push(new Quad(node, this._x0, this._y0, this._x1, this._y1));
    while (q = quads.pop()) {
      if (!callback(node = q.node, x0 = q.x0, y0 = q.y0, x1 = q.x1, y1 = q.y1) && node.length) {
        var xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
        if (child = node[3]) quads.push(new Quad(child, xm, ym, x1, y1));
        if (child = node[2]) quads.push(new Quad(child, x0, ym, xm, y1));
        if (child = node[1]) quads.push(new Quad(child, xm, y0, x1, ym));
        if (child = node[0]) quads.push(new Quad(child, x0, y0, xm, ym));
      }
    }
    return this;
  }

  function tree_visitAfter(callback) {
    var quads = [], next = [], q;
    if (this._root) quads.push(new Quad(this._root, this._x0, this._y0, this._x1, this._y1));
    while (q = quads.pop()) {
      var node = q.node;
      if (node.length) {
        var child, x0 = q.x0, y0 = q.y0, x1 = q.x1, y1 = q.y1, xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
        if (child = node[0]) quads.push(new Quad(child, x0, y0, xm, ym));
        if (child = node[1]) quads.push(new Quad(child, xm, y0, x1, ym));
        if (child = node[2]) quads.push(new Quad(child, x0, ym, xm, y1));
        if (child = node[3]) quads.push(new Quad(child, xm, ym, x1, y1));
      }
      next.push(q);
    }
    while (q = next.pop()) {
      callback(q.node, q.x0, q.y0, q.x1, q.y1);
    }
    return this;
  }

  function defaultX$1(d) {
    return d[0];
  }

  function tree_x(_) {
    return arguments.length ? (this._x = _, this) : this._x;
  }

  function defaultY$1(d) {
    return d[1];
  }

  function tree_y(_) {
    return arguments.length ? (this._y = _, this) : this._y;
  }

  function quadtree(nodes, x, y) {
    var tree = new Quadtree(x == null ? defaultX$1 : x, y == null ? defaultY$1 : y, NaN, NaN, NaN, NaN);
    return nodes == null ? tree : tree.addAll(nodes);
  }

  function Quadtree(x, y, x0, y0, x1, y1) {
    this._x = x;
    this._y = y;
    this._x0 = x0;
    this._y0 = y0;
    this._x1 = x1;
    this._y1 = y1;
    this._root = undefined;
  }

  function leaf_copy(leaf) {
    var copy = {data: leaf.data}, next = copy;
    while (leaf = leaf.next) next = next.next = {data: leaf.data};
    return copy;
  }

  var treeProto = quadtree.prototype = Quadtree.prototype;

  treeProto.copy = function() {
    var copy = new Quadtree(this._x, this._y, this._x0, this._y0, this._x1, this._y1),
        node = this._root,
        nodes,
        child;

    if (!node) return copy;

    if (!node.length) return copy._root = leaf_copy(node), copy;

    nodes = [{source: node, target: copy._root = new Array(4)}];
    while (node = nodes.pop()) {
      for (var i = 0; i < 4; ++i) {
        if (child = node.source[i]) {
          if (child.length) nodes.push({source: child, target: node.target[i] = new Array(4)});
          else node.target[i] = leaf_copy(child);
        }
      }
    }

    return copy;
  };

  treeProto.add = tree_add;
  treeProto.addAll = addAll;
  treeProto.cover = tree_cover;
  treeProto.data = tree_data;
  treeProto.extent = tree_extent;
  treeProto.find = tree_find;
  treeProto.remove = tree_remove;
  treeProto.removeAll = removeAll;
  treeProto.root = tree_root;
  treeProto.size = tree_size;
  treeProto.visit = tree_visit;
  treeProto.visitAfter = tree_visitAfter;
  treeProto.x = tree_x;
  treeProto.y = tree_y;

  var initialAngle = Math.PI * (3 - Math.sqrt(5));

  // Computes the decimal coefficient and exponent of the specified number x with
  // significant digits p, where x is positive and p is in [1, 21] or undefined.
  // For example, formatDecimal(1.23) returns ["123", 0].
  function formatDecimal(x, p) {
    if ((i = (x = p ? x.toExponential(p - 1) : x.toExponential()).indexOf("e")) < 0) return null; // NaN, ±Infinity
    var i, coefficient = x.slice(0, i);

    // The string returned by toExponential either has the form \d\.\d+e[-+]\d+
    // (e.g., 1.2e+3) or the form \de[-+]\d+ (e.g., 1e+3).
    return [
      coefficient.length > 1 ? coefficient[0] + coefficient.slice(2) : coefficient,
      +x.slice(i + 1)
    ];
  }

  function exponent$1(x) {
    return x = formatDecimal(Math.abs(x)), x ? x[1] : NaN;
  }

  function formatGroup(grouping, thousands) {
    return function(value, width) {
      var i = value.length,
          t = [],
          j = 0,
          g = grouping[0],
          length = 0;

      while (i > 0 && g > 0) {
        if (length + g + 1 > width) g = Math.max(1, width - length);
        t.push(value.substring(i -= g, i + g));
        if ((length += g + 1) > width) break;
        g = grouping[j = (j + 1) % grouping.length];
      }

      return t.reverse().join(thousands);
    };
  }

  function formatNumerals(numerals) {
    return function(value) {
      return value.replace(/[0-9]/g, function(i) {
        return numerals[+i];
      });
    };
  }

  // [[fill]align][sign][symbol][0][width][,][.precision][~][type]
  var re = /^(?:(.)?([<>=^]))?([+\-( ])?([$#])?(0)?(\d+)?(,)?(\.\d+)?(~)?([a-z%])?$/i;

  function formatSpecifier(specifier) {
    return new FormatSpecifier(specifier);
  }

  formatSpecifier.prototype = FormatSpecifier.prototype; // instanceof

  function FormatSpecifier(specifier) {
    if (!(match = re.exec(specifier))) throw new Error("invalid format: " + specifier);
    var match;
    this.fill = match[1] || " ";
    this.align = match[2] || ">";
    this.sign = match[3] || "-";
    this.symbol = match[4] || "";
    this.zero = !!match[5];
    this.width = match[6] && +match[6];
    this.comma = !!match[7];
    this.precision = match[8] && +match[8].slice(1);
    this.trim = !!match[9];
    this.type = match[10] || "";
  }

  FormatSpecifier.prototype.toString = function() {
    return this.fill
        + this.align
        + this.sign
        + this.symbol
        + (this.zero ? "0" : "")
        + (this.width == null ? "" : Math.max(1, this.width | 0))
        + (this.comma ? "," : "")
        + (this.precision == null ? "" : "." + Math.max(0, this.precision | 0))
        + (this.trim ? "~" : "")
        + this.type;
  };

  // Trims insignificant zeros, e.g., replaces 1.2000k with 1.2k.
  function formatTrim(s) {
    out: for (var n = s.length, i = 1, i0 = -1, i1; i < n; ++i) {
      switch (s[i]) {
        case ".": i0 = i1 = i; break;
        case "0": if (i0 === 0) i0 = i; i1 = i; break;
        default: if (i0 > 0) { if (!+s[i]) break out; i0 = 0; } break;
      }
    }
    return i0 > 0 ? s.slice(0, i0) + s.slice(i1 + 1) : s;
  }

  var prefixExponent;

  function formatPrefixAuto(x, p) {
    var d = formatDecimal(x, p);
    if (!d) return x + "";
    var coefficient = d[0],
        exponent = d[1],
        i = exponent - (prefixExponent = Math.max(-8, Math.min(8, Math.floor(exponent / 3))) * 3) + 1,
        n = coefficient.length;
    return i === n ? coefficient
        : i > n ? coefficient + new Array(i - n + 1).join("0")
        : i > 0 ? coefficient.slice(0, i) + "." + coefficient.slice(i)
        : "0." + new Array(1 - i).join("0") + formatDecimal(x, Math.max(0, p + i - 1))[0]; // less than 1y!
  }

  function formatRounded(x, p) {
    var d = formatDecimal(x, p);
    if (!d) return x + "";
    var coefficient = d[0],
        exponent = d[1];
    return exponent < 0 ? "0." + new Array(-exponent).join("0") + coefficient
        : coefficient.length > exponent + 1 ? coefficient.slice(0, exponent + 1) + "." + coefficient.slice(exponent + 1)
        : coefficient + new Array(exponent - coefficient.length + 2).join("0");
  }

  var formatTypes = {
    "%": function(x, p) { return (x * 100).toFixed(p); },
    "b": function(x) { return Math.round(x).toString(2); },
    "c": function(x) { return x + ""; },
    "d": function(x) { return Math.round(x).toString(10); },
    "e": function(x, p) { return x.toExponential(p); },
    "f": function(x, p) { return x.toFixed(p); },
    "g": function(x, p) { return x.toPrecision(p); },
    "o": function(x) { return Math.round(x).toString(8); },
    "p": function(x, p) { return formatRounded(x * 100, p); },
    "r": formatRounded,
    "s": formatPrefixAuto,
    "X": function(x) { return Math.round(x).toString(16).toUpperCase(); },
    "x": function(x) { return Math.round(x).toString(16); }
  };

  function identity$3(x) {
    return x;
  }

  var prefixes = ["y","z","a","f","p","n","µ","m","","k","M","G","T","P","E","Z","Y"];

  function formatLocale(locale) {
    var group = locale.grouping && locale.thousands ? formatGroup(locale.grouping, locale.thousands) : identity$3,
        currency = locale.currency,
        decimal = locale.decimal,
        numerals = locale.numerals ? formatNumerals(locale.numerals) : identity$3,
        percent = locale.percent || "%";

    function newFormat(specifier) {
      specifier = formatSpecifier(specifier);

      var fill = specifier.fill,
          align = specifier.align,
          sign = specifier.sign,
          symbol = specifier.symbol,
          zero = specifier.zero,
          width = specifier.width,
          comma = specifier.comma,
          precision = specifier.precision,
          trim = specifier.trim,
          type = specifier.type;

      // The "n" type is an alias for ",g".
      if (type === "n") comma = true, type = "g";

      // The "" type, and any invalid type, is an alias for ".12~g".
      else if (!formatTypes[type]) precision == null && (precision = 12), trim = true, type = "g";

      // If zero fill is specified, padding goes after sign and before digits.
      if (zero || (fill === "0" && align === "=")) zero = true, fill = "0", align = "=";

      // Compute the prefix and suffix.
      // For SI-prefix, the suffix is lazily computed.
      var prefix = symbol === "$" ? currency[0] : symbol === "#" && /[boxX]/.test(type) ? "0" + type.toLowerCase() : "",
          suffix = symbol === "$" ? currency[1] : /[%p]/.test(type) ? percent : "";

      // What format function should we use?
      // Is this an integer type?
      // Can this type generate exponential notation?
      var formatType = formatTypes[type],
          maybeSuffix = /[defgprs%]/.test(type);

      // Set the default precision if not specified,
      // or clamp the specified precision to the supported range.
      // For significant precision, it must be in [1, 21].
      // For fixed precision, it must be in [0, 20].
      precision = precision == null ? 6
          : /[gprs]/.test(type) ? Math.max(1, Math.min(21, precision))
          : Math.max(0, Math.min(20, precision));

      function format(value) {
        var valuePrefix = prefix,
            valueSuffix = suffix,
            i, n, c;

        if (type === "c") {
          valueSuffix = formatType(value) + valueSuffix;
          value = "";
        } else {
          value = +value;

          // Perform the initial formatting.
          var valueNegative = value < 0;
          value = formatType(Math.abs(value), precision);

          // Trim insignificant zeros.
          if (trim) value = formatTrim(value);

          // If a negative value rounds to zero during formatting, treat as positive.
          if (valueNegative && +value === 0) valueNegative = false;

          // Compute the prefix and suffix.
          valuePrefix = (valueNegative ? (sign === "(" ? sign : "-") : sign === "-" || sign === "(" ? "" : sign) + valuePrefix;
          valueSuffix = (type === "s" ? prefixes[8 + prefixExponent / 3] : "") + valueSuffix + (valueNegative && sign === "(" ? ")" : "");

          // Break the formatted value into the integer “value” part that can be
          // grouped, and fractional or exponential “suffix” part that is not.
          if (maybeSuffix) {
            i = -1, n = value.length;
            while (++i < n) {
              if (c = value.charCodeAt(i), 48 > c || c > 57) {
                valueSuffix = (c === 46 ? decimal + value.slice(i + 1) : value.slice(i)) + valueSuffix;
                value = value.slice(0, i);
                break;
              }
            }
          }
        }

        // If the fill character is not "0", grouping is applied before padding.
        if (comma && !zero) value = group(value, Infinity);

        // Compute the padding.
        var length = valuePrefix.length + value.length + valueSuffix.length,
            padding = length < width ? new Array(width - length + 1).join(fill) : "";

        // If the fill character is "0", grouping is applied after padding.
        if (comma && zero) value = group(padding + value, padding.length ? width - valueSuffix.length : Infinity), padding = "";

        // Reconstruct the final output based on the desired alignment.
        switch (align) {
          case "<": value = valuePrefix + value + valueSuffix + padding; break;
          case "=": value = valuePrefix + padding + value + valueSuffix; break;
          case "^": value = padding.slice(0, length = padding.length >> 1) + valuePrefix + value + valueSuffix + padding.slice(length); break;
          default: value = padding + valuePrefix + value + valueSuffix; break;
        }

        return numerals(value);
      }

      format.toString = function() {
        return specifier + "";
      };

      return format;
    }

    function formatPrefix(specifier, value) {
      var f = newFormat((specifier = formatSpecifier(specifier), specifier.type = "f", specifier)),
          e = Math.max(-8, Math.min(8, Math.floor(exponent$1(value) / 3))) * 3,
          k = Math.pow(10, -e),
          prefix = prefixes[8 + e / 3];
      return function(value) {
        return f(k * value) + prefix;
      };
    }

    return {
      format: newFormat,
      formatPrefix: formatPrefix
    };
  }

  var locale;
  var format;
  var formatPrefix;

  defaultLocale({
    decimal: ".",
    thousands: ",",
    grouping: [3],
    currency: ["$", ""]
  });

  function defaultLocale(definition) {
    locale = formatLocale(definition);
    format = locale.format;
    formatPrefix = locale.formatPrefix;
    return locale;
  }

  // Adds floating point numbers with twice the normal precision.
  // Reference: J. R. Shewchuk, Adaptive Precision Floating-Point Arithmetic and
  // Fast Robust Geometric Predicates, Discrete & Computational Geometry 18(3)
  // 305–363 (1997).
  // Code adapted from GeographicLib by Charles F. F. Karney,
  // http://geographiclib.sourceforge.net/

  function adder() {
    return new Adder;
  }

  function Adder() {
    this.reset();
  }

  Adder.prototype = {
    constructor: Adder,
    reset: function() {
      this.s = // rounded value
      this.t = 0; // exact error
    },
    add: function(y) {
      add$1(temp, y, this.t);
      add$1(this, temp.s, this.s);
      if (this.s) this.t += temp.t;
      else this.s = temp.t;
    },
    valueOf: function() {
      return this.s;
    }
  };

  var temp = new Adder;

  function add$1(adder, a, b) {
    var x = adder.s = a + b,
        bv = x - a,
        av = x - bv;
    adder.t = (a - av) + (b - bv);
  }

  var pi$3 = Math.PI;

  var areaRingSum = adder();

  var areaSum = adder();

  var deltaSum = adder();

  var sum$1 = adder();

  var lengthSum = adder();

  var areaSum$1 = adder(),
      areaRingSum$1 = adder();

  var lengthSum$1 = adder();

  // Returns the 2D cross product of AB and AC vectors, i.e., the z-component of

  var t0$1 = new Date,
      t1$1 = new Date;

  function newInterval(floori, offseti, count, field) {

    function interval(date) {
      return floori(date = new Date(+date)), date;
    }

    interval.floor = interval;

    interval.ceil = function(date) {
      return floori(date = new Date(date - 1)), offseti(date, 1), floori(date), date;
    };

    interval.round = function(date) {
      var d0 = interval(date),
          d1 = interval.ceil(date);
      return date - d0 < d1 - date ? d0 : d1;
    };

    interval.offset = function(date, step) {
      return offseti(date = new Date(+date), step == null ? 1 : Math.floor(step)), date;
    };

    interval.range = function(start, stop, step) {
      var range = [], previous;
      start = interval.ceil(start);
      step = step == null ? 1 : Math.floor(step);
      if (!(start < stop) || !(step > 0)) return range; // also handles Invalid Date
      do range.push(previous = new Date(+start)), offseti(start, step), floori(start);
      while (previous < start && start < stop);
      return range;
    };

    interval.filter = function(test) {
      return newInterval(function(date) {
        if (date >= date) while (floori(date), !test(date)) date.setTime(date - 1);
      }, function(date, step) {
        if (date >= date) {
          if (step < 0) while (++step <= 0) {
            while (offseti(date, -1), !test(date)) {} // eslint-disable-line no-empty
          } else while (--step >= 0) {
            while (offseti(date, +1), !test(date)) {} // eslint-disable-line no-empty
          }
        }
      });
    };

    if (count) {
      interval.count = function(start, end) {
        t0$1.setTime(+start), t1$1.setTime(+end);
        floori(t0$1), floori(t1$1);
        return Math.floor(count(t0$1, t1$1));
      };

      interval.every = function(step) {
        step = Math.floor(step);
        return !isFinite(step) || !(step > 0) ? null
            : !(step > 1) ? interval
            : interval.filter(field
                ? function(d) { return field(d) % step === 0; }
                : function(d) { return interval.count(0, d) % step === 0; });
      };
    }

    return interval;
  }

  var millisecond = newInterval(function() {
    // noop
  }, function(date, step) {
    date.setTime(+date + step);
  }, function(start, end) {
    return end - start;
  });

  // An optimized implementation for this simple case.
  millisecond.every = function(k) {
    k = Math.floor(k);
    if (!isFinite(k) || !(k > 0)) return null;
    if (!(k > 1)) return millisecond;
    return newInterval(function(date) {
      date.setTime(Math.floor(date / k) * k);
    }, function(date, step) {
      date.setTime(+date + step * k);
    }, function(start, end) {
      return (end - start) / k;
    });
  };
  var milliseconds = millisecond.range;

  var durationSecond = 1e3;
  var durationMinute = 6e4;
  var durationHour = 36e5;
  var durationDay = 864e5;
  var durationWeek = 6048e5;

  var second = newInterval(function(date) {
    date.setTime(Math.floor(date / durationSecond) * durationSecond);
  }, function(date, step) {
    date.setTime(+date + step * durationSecond);
  }, function(start, end) {
    return (end - start) / durationSecond;
  }, function(date) {
    return date.getUTCSeconds();
  });
  var seconds = second.range;

  var minute = newInterval(function(date) {
    date.setTime(Math.floor(date / durationMinute) * durationMinute);
  }, function(date, step) {
    date.setTime(+date + step * durationMinute);
  }, function(start, end) {
    return (end - start) / durationMinute;
  }, function(date) {
    return date.getMinutes();
  });
  var minutes = minute.range;

  var hour = newInterval(function(date) {
    var offset = date.getTimezoneOffset() * durationMinute % durationHour;
    if (offset < 0) offset += durationHour;
    date.setTime(Math.floor((+date - offset) / durationHour) * durationHour + offset);
  }, function(date, step) {
    date.setTime(+date + step * durationHour);
  }, function(start, end) {
    return (end - start) / durationHour;
  }, function(date) {
    return date.getHours();
  });
  var hours = hour.range;

  var day = newInterval(function(date) {
    date.setHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setDate(date.getDate() + step);
  }, function(start, end) {
    return (end - start - (end.getTimezoneOffset() - start.getTimezoneOffset()) * durationMinute) / durationDay;
  }, function(date) {
    return date.getDate() - 1;
  });
  var days = day.range;

  function weekday(i) {
    return newInterval(function(date) {
      date.setDate(date.getDate() - (date.getDay() + 7 - i) % 7);
      date.setHours(0, 0, 0, 0);
    }, function(date, step) {
      date.setDate(date.getDate() + step * 7);
    }, function(start, end) {
      return (end - start - (end.getTimezoneOffset() - start.getTimezoneOffset()) * durationMinute) / durationWeek;
    });
  }

  var sunday = weekday(0);
  var monday = weekday(1);
  var tuesday = weekday(2);
  var wednesday = weekday(3);
  var thursday = weekday(4);
  var friday = weekday(5);
  var saturday = weekday(6);

  var sundays = sunday.range;

  var month = newInterval(function(date) {
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setMonth(date.getMonth() + step);
  }, function(start, end) {
    return end.getMonth() - start.getMonth() + (end.getFullYear() - start.getFullYear()) * 12;
  }, function(date) {
    return date.getMonth();
  });
  var months = month.range;

  var year = newInterval(function(date) {
    date.setMonth(0, 1);
    date.setHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setFullYear(date.getFullYear() + step);
  }, function(start, end) {
    return end.getFullYear() - start.getFullYear();
  }, function(date) {
    return date.getFullYear();
  });

  // An optimized implementation for this simple case.
  year.every = function(k) {
    return !isFinite(k = Math.floor(k)) || !(k > 0) ? null : newInterval(function(date) {
      date.setFullYear(Math.floor(date.getFullYear() / k) * k);
      date.setMonth(0, 1);
      date.setHours(0, 0, 0, 0);
    }, function(date, step) {
      date.setFullYear(date.getFullYear() + step * k);
    });
  };
  var years = year.range;

  var utcMinute = newInterval(function(date) {
    date.setUTCSeconds(0, 0);
  }, function(date, step) {
    date.setTime(+date + step * durationMinute);
  }, function(start, end) {
    return (end - start) / durationMinute;
  }, function(date) {
    return date.getUTCMinutes();
  });
  var utcMinutes = utcMinute.range;

  var utcHour = newInterval(function(date) {
    date.setUTCMinutes(0, 0, 0);
  }, function(date, step) {
    date.setTime(+date + step * durationHour);
  }, function(start, end) {
    return (end - start) / durationHour;
  }, function(date) {
    return date.getUTCHours();
  });
  var utcHours = utcHour.range;

  var utcDay = newInterval(function(date) {
    date.setUTCHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setUTCDate(date.getUTCDate() + step);
  }, function(start, end) {
    return (end - start) / durationDay;
  }, function(date) {
    return date.getUTCDate() - 1;
  });
  var utcDays = utcDay.range;

  function utcWeekday(i) {
    return newInterval(function(date) {
      date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 7 - i) % 7);
      date.setUTCHours(0, 0, 0, 0);
    }, function(date, step) {
      date.setUTCDate(date.getUTCDate() + step * 7);
    }, function(start, end) {
      return (end - start) / durationWeek;
    });
  }

  var utcSunday = utcWeekday(0);
  var utcMonday = utcWeekday(1);
  var utcTuesday = utcWeekday(2);
  var utcWednesday = utcWeekday(3);
  var utcThursday = utcWeekday(4);
  var utcFriday = utcWeekday(5);
  var utcSaturday = utcWeekday(6);

  var utcSundays = utcSunday.range;

  var utcMonth = newInterval(function(date) {
    date.setUTCDate(1);
    date.setUTCHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setUTCMonth(date.getUTCMonth() + step);
  }, function(start, end) {
    return end.getUTCMonth() - start.getUTCMonth() + (end.getUTCFullYear() - start.getUTCFullYear()) * 12;
  }, function(date) {
    return date.getUTCMonth();
  });
  var utcMonths = utcMonth.range;

  var utcYear = newInterval(function(date) {
    date.setUTCMonth(0, 1);
    date.setUTCHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setUTCFullYear(date.getUTCFullYear() + step);
  }, function(start, end) {
    return end.getUTCFullYear() - start.getUTCFullYear();
  }, function(date) {
    return date.getUTCFullYear();
  });

  // An optimized implementation for this simple case.
  utcYear.every = function(k) {
    return !isFinite(k = Math.floor(k)) || !(k > 0) ? null : newInterval(function(date) {
      date.setUTCFullYear(Math.floor(date.getUTCFullYear() / k) * k);
      date.setUTCMonth(0, 1);
      date.setUTCHours(0, 0, 0, 0);
    }, function(date, step) {
      date.setUTCFullYear(date.getUTCFullYear() + step * k);
    });
  };
  var utcYears = utcYear.range;

  function localDate(d) {
    if (0 <= d.y && d.y < 100) {
      var date = new Date(-1, d.m, d.d, d.H, d.M, d.S, d.L);
      date.setFullYear(d.y);
      return date;
    }
    return new Date(d.y, d.m, d.d, d.H, d.M, d.S, d.L);
  }

  function utcDate(d) {
    if (0 <= d.y && d.y < 100) {
      var date = new Date(Date.UTC(-1, d.m, d.d, d.H, d.M, d.S, d.L));
      date.setUTCFullYear(d.y);
      return date;
    }
    return new Date(Date.UTC(d.y, d.m, d.d, d.H, d.M, d.S, d.L));
  }

  function newYear(y) {
    return {y: y, m: 0, d: 1, H: 0, M: 0, S: 0, L: 0};
  }

  function formatLocale$1(locale) {
    var locale_dateTime = locale.dateTime,
        locale_date = locale.date,
        locale_time = locale.time,
        locale_periods = locale.periods,
        locale_weekdays = locale.days,
        locale_shortWeekdays = locale.shortDays,
        locale_months = locale.months,
        locale_shortMonths = locale.shortMonths;

    var periodRe = formatRe(locale_periods),
        periodLookup = formatLookup(locale_periods),
        weekdayRe = formatRe(locale_weekdays),
        weekdayLookup = formatLookup(locale_weekdays),
        shortWeekdayRe = formatRe(locale_shortWeekdays),
        shortWeekdayLookup = formatLookup(locale_shortWeekdays),
        monthRe = formatRe(locale_months),
        monthLookup = formatLookup(locale_months),
        shortMonthRe = formatRe(locale_shortMonths),
        shortMonthLookup = formatLookup(locale_shortMonths);

    var formats = {
      "a": formatShortWeekday,
      "A": formatWeekday,
      "b": formatShortMonth,
      "B": formatMonth,
      "c": null,
      "d": formatDayOfMonth,
      "e": formatDayOfMonth,
      "f": formatMicroseconds,
      "H": formatHour24,
      "I": formatHour12,
      "j": formatDayOfYear,
      "L": formatMilliseconds,
      "m": formatMonthNumber,
      "M": formatMinutes,
      "p": formatPeriod,
      "Q": formatUnixTimestamp,
      "s": formatUnixTimestampSeconds,
      "S": formatSeconds,
      "u": formatWeekdayNumberMonday,
      "U": formatWeekNumberSunday,
      "V": formatWeekNumberISO,
      "w": formatWeekdayNumberSunday,
      "W": formatWeekNumberMonday,
      "x": null,
      "X": null,
      "y": formatYear,
      "Y": formatFullYear,
      "Z": formatZone,
      "%": formatLiteralPercent
    };

    var utcFormats = {
      "a": formatUTCShortWeekday,
      "A": formatUTCWeekday,
      "b": formatUTCShortMonth,
      "B": formatUTCMonth,
      "c": null,
      "d": formatUTCDayOfMonth,
      "e": formatUTCDayOfMonth,
      "f": formatUTCMicroseconds,
      "H": formatUTCHour24,
      "I": formatUTCHour12,
      "j": formatUTCDayOfYear,
      "L": formatUTCMilliseconds,
      "m": formatUTCMonthNumber,
      "M": formatUTCMinutes,
      "p": formatUTCPeriod,
      "Q": formatUnixTimestamp,
      "s": formatUnixTimestampSeconds,
      "S": formatUTCSeconds,
      "u": formatUTCWeekdayNumberMonday,
      "U": formatUTCWeekNumberSunday,
      "V": formatUTCWeekNumberISO,
      "w": formatUTCWeekdayNumberSunday,
      "W": formatUTCWeekNumberMonday,
      "x": null,
      "X": null,
      "y": formatUTCYear,
      "Y": formatUTCFullYear,
      "Z": formatUTCZone,
      "%": formatLiteralPercent
    };

    var parses = {
      "a": parseShortWeekday,
      "A": parseWeekday,
      "b": parseShortMonth,
      "B": parseMonth,
      "c": parseLocaleDateTime,
      "d": parseDayOfMonth,
      "e": parseDayOfMonth,
      "f": parseMicroseconds,
      "H": parseHour24,
      "I": parseHour24,
      "j": parseDayOfYear,
      "L": parseMilliseconds,
      "m": parseMonthNumber,
      "M": parseMinutes,
      "p": parsePeriod,
      "Q": parseUnixTimestamp,
      "s": parseUnixTimestampSeconds,
      "S": parseSeconds,
      "u": parseWeekdayNumberMonday,
      "U": parseWeekNumberSunday,
      "V": parseWeekNumberISO,
      "w": parseWeekdayNumberSunday,
      "W": parseWeekNumberMonday,
      "x": parseLocaleDate,
      "X": parseLocaleTime,
      "y": parseYear,
      "Y": parseFullYear,
      "Z": parseZone,
      "%": parseLiteralPercent
    };

    // These recursive directive definitions must be deferred.
    formats.x = newFormat(locale_date, formats);
    formats.X = newFormat(locale_time, formats);
    formats.c = newFormat(locale_dateTime, formats);
    utcFormats.x = newFormat(locale_date, utcFormats);
    utcFormats.X = newFormat(locale_time, utcFormats);
    utcFormats.c = newFormat(locale_dateTime, utcFormats);

    function newFormat(specifier, formats) {
      return function(date) {
        var string = [],
            i = -1,
            j = 0,
            n = specifier.length,
            c,
            pad,
            format;

        if (!(date instanceof Date)) date = new Date(+date);

        while (++i < n) {
          if (specifier.charCodeAt(i) === 37) {
            string.push(specifier.slice(j, i));
            if ((pad = pads[c = specifier.charAt(++i)]) != null) c = specifier.charAt(++i);
            else pad = c === "e" ? " " : "0";
            if (format = formats[c]) c = format(date, pad);
            string.push(c);
            j = i + 1;
          }
        }

        string.push(specifier.slice(j, i));
        return string.join("");
      };
    }

    function newParse(specifier, newDate) {
      return function(string) {
        var d = newYear(1900),
            i = parseSpecifier(d, specifier, string += "", 0),
            week, day$$1;
        if (i != string.length) return null;

        // If a UNIX timestamp is specified, return it.
        if ("Q" in d) return new Date(d.Q);

        // The am-pm flag is 0 for AM, and 1 for PM.
        if ("p" in d) d.H = d.H % 12 + d.p * 12;

        // Convert day-of-week and week-of-year to day-of-year.
        if ("V" in d) {
          if (d.V < 1 || d.V > 53) return null;
          if (!("w" in d)) d.w = 1;
          if ("Z" in d) {
            week = utcDate(newYear(d.y)), day$$1 = week.getUTCDay();
            week = day$$1 > 4 || day$$1 === 0 ? utcMonday.ceil(week) : utcMonday(week);
            week = utcDay.offset(week, (d.V - 1) * 7);
            d.y = week.getUTCFullYear();
            d.m = week.getUTCMonth();
            d.d = week.getUTCDate() + (d.w + 6) % 7;
          } else {
            week = newDate(newYear(d.y)), day$$1 = week.getDay();
            week = day$$1 > 4 || day$$1 === 0 ? monday.ceil(week) : monday(week);
            week = day.offset(week, (d.V - 1) * 7);
            d.y = week.getFullYear();
            d.m = week.getMonth();
            d.d = week.getDate() + (d.w + 6) % 7;
          }
        } else if ("W" in d || "U" in d) {
          if (!("w" in d)) d.w = "u" in d ? d.u % 7 : "W" in d ? 1 : 0;
          day$$1 = "Z" in d ? utcDate(newYear(d.y)).getUTCDay() : newDate(newYear(d.y)).getDay();
          d.m = 0;
          d.d = "W" in d ? (d.w + 6) % 7 + d.W * 7 - (day$$1 + 5) % 7 : d.w + d.U * 7 - (day$$1 + 6) % 7;
        }

        // If a time zone is specified, all fields are interpreted as UTC and then
        // offset according to the specified time zone.
        if ("Z" in d) {
          d.H += d.Z / 100 | 0;
          d.M += d.Z % 100;
          return utcDate(d);
        }

        // Otherwise, all fields are in local time.
        return newDate(d);
      };
    }

    function parseSpecifier(d, specifier, string, j) {
      var i = 0,
          n = specifier.length,
          m = string.length,
          c,
          parse;

      while (i < n) {
        if (j >= m) return -1;
        c = specifier.charCodeAt(i++);
        if (c === 37) {
          c = specifier.charAt(i++);
          parse = parses[c in pads ? specifier.charAt(i++) : c];
          if (!parse || ((j = parse(d, string, j)) < 0)) return -1;
        } else if (c != string.charCodeAt(j++)) {
          return -1;
        }
      }

      return j;
    }

    function parsePeriod(d, string, i) {
      var n = periodRe.exec(string.slice(i));
      return n ? (d.p = periodLookup[n[0].toLowerCase()], i + n[0].length) : -1;
    }

    function parseShortWeekday(d, string, i) {
      var n = shortWeekdayRe.exec(string.slice(i));
      return n ? (d.w = shortWeekdayLookup[n[0].toLowerCase()], i + n[0].length) : -1;
    }

    function parseWeekday(d, string, i) {
      var n = weekdayRe.exec(string.slice(i));
      return n ? (d.w = weekdayLookup[n[0].toLowerCase()], i + n[0].length) : -1;
    }

    function parseShortMonth(d, string, i) {
      var n = shortMonthRe.exec(string.slice(i));
      return n ? (d.m = shortMonthLookup[n[0].toLowerCase()], i + n[0].length) : -1;
    }

    function parseMonth(d, string, i) {
      var n = monthRe.exec(string.slice(i));
      return n ? (d.m = monthLookup[n[0].toLowerCase()], i + n[0].length) : -1;
    }

    function parseLocaleDateTime(d, string, i) {
      return parseSpecifier(d, locale_dateTime, string, i);
    }

    function parseLocaleDate(d, string, i) {
      return parseSpecifier(d, locale_date, string, i);
    }

    function parseLocaleTime(d, string, i) {
      return parseSpecifier(d, locale_time, string, i);
    }

    function formatShortWeekday(d) {
      return locale_shortWeekdays[d.getDay()];
    }

    function formatWeekday(d) {
      return locale_weekdays[d.getDay()];
    }

    function formatShortMonth(d) {
      return locale_shortMonths[d.getMonth()];
    }

    function formatMonth(d) {
      return locale_months[d.getMonth()];
    }

    function formatPeriod(d) {
      return locale_periods[+(d.getHours() >= 12)];
    }

    function formatUTCShortWeekday(d) {
      return locale_shortWeekdays[d.getUTCDay()];
    }

    function formatUTCWeekday(d) {
      return locale_weekdays[d.getUTCDay()];
    }

    function formatUTCShortMonth(d) {
      return locale_shortMonths[d.getUTCMonth()];
    }

    function formatUTCMonth(d) {
      return locale_months[d.getUTCMonth()];
    }

    function formatUTCPeriod(d) {
      return locale_periods[+(d.getUTCHours() >= 12)];
    }

    return {
      format: function(specifier) {
        var f = newFormat(specifier += "", formats);
        f.toString = function() { return specifier; };
        return f;
      },
      parse: function(specifier) {
        var p = newParse(specifier += "", localDate);
        p.toString = function() { return specifier; };
        return p;
      },
      utcFormat: function(specifier) {
        var f = newFormat(specifier += "", utcFormats);
        f.toString = function() { return specifier; };
        return f;
      },
      utcParse: function(specifier) {
        var p = newParse(specifier, utcDate);
        p.toString = function() { return specifier; };
        return p;
      }
    };
  }

  var pads = {"-": "", "_": " ", "0": "0"},
      numberRe = /^\s*\d+/, // note: ignores next directive
      percentRe = /^%/,
      requoteRe = /[\\^$*+?|[\]().{}]/g;

  function pad(value, fill, width) {
    var sign = value < 0 ? "-" : "",
        string = (sign ? -value : value) + "",
        length = string.length;
    return sign + (length < width ? new Array(width - length + 1).join(fill) + string : string);
  }

  function requote(s) {
    return s.replace(requoteRe, "\\$&");
  }

  function formatRe(names) {
    return new RegExp("^(?:" + names.map(requote).join("|") + ")", "i");
  }

  function formatLookup(names) {
    var map = {}, i = -1, n = names.length;
    while (++i < n) map[names[i].toLowerCase()] = i;
    return map;
  }

  function parseWeekdayNumberSunday(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 1));
    return n ? (d.w = +n[0], i + n[0].length) : -1;
  }

  function parseWeekdayNumberMonday(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 1));
    return n ? (d.u = +n[0], i + n[0].length) : -1;
  }

  function parseWeekNumberSunday(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.U = +n[0], i + n[0].length) : -1;
  }

  function parseWeekNumberISO(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.V = +n[0], i + n[0].length) : -1;
  }

  function parseWeekNumberMonday(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.W = +n[0], i + n[0].length) : -1;
  }

  function parseFullYear(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 4));
    return n ? (d.y = +n[0], i + n[0].length) : -1;
  }

  function parseYear(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.y = +n[0] + (+n[0] > 68 ? 1900 : 2000), i + n[0].length) : -1;
  }

  function parseZone(d, string, i) {
    var n = /^(Z)|([+-]\d\d)(?::?(\d\d))?/.exec(string.slice(i, i + 6));
    return n ? (d.Z = n[1] ? 0 : -(n[2] + (n[3] || "00")), i + n[0].length) : -1;
  }

  function parseMonthNumber(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.m = n[0] - 1, i + n[0].length) : -1;
  }

  function parseDayOfMonth(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.d = +n[0], i + n[0].length) : -1;
  }

  function parseDayOfYear(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 3));
    return n ? (d.m = 0, d.d = +n[0], i + n[0].length) : -1;
  }

  function parseHour24(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.H = +n[0], i + n[0].length) : -1;
  }

  function parseMinutes(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.M = +n[0], i + n[0].length) : -1;
  }

  function parseSeconds(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.S = +n[0], i + n[0].length) : -1;
  }

  function parseMilliseconds(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 3));
    return n ? (d.L = +n[0], i + n[0].length) : -1;
  }

  function parseMicroseconds(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 6));
    return n ? (d.L = Math.floor(n[0] / 1000), i + n[0].length) : -1;
  }

  function parseLiteralPercent(d, string, i) {
    var n = percentRe.exec(string.slice(i, i + 1));
    return n ? i + n[0].length : -1;
  }

  function parseUnixTimestamp(d, string, i) {
    var n = numberRe.exec(string.slice(i));
    return n ? (d.Q = +n[0], i + n[0].length) : -1;
  }

  function parseUnixTimestampSeconds(d, string, i) {
    var n = numberRe.exec(string.slice(i));
    return n ? (d.Q = (+n[0]) * 1000, i + n[0].length) : -1;
  }

  function formatDayOfMonth(d, p) {
    return pad(d.getDate(), p, 2);
  }

  function formatHour24(d, p) {
    return pad(d.getHours(), p, 2);
  }

  function formatHour12(d, p) {
    return pad(d.getHours() % 12 || 12, p, 2);
  }

  function formatDayOfYear(d, p) {
    return pad(1 + day.count(year(d), d), p, 3);
  }

  function formatMilliseconds(d, p) {
    return pad(d.getMilliseconds(), p, 3);
  }

  function formatMicroseconds(d, p) {
    return formatMilliseconds(d, p) + "000";
  }

  function formatMonthNumber(d, p) {
    return pad(d.getMonth() + 1, p, 2);
  }

  function formatMinutes(d, p) {
    return pad(d.getMinutes(), p, 2);
  }

  function formatSeconds(d, p) {
    return pad(d.getSeconds(), p, 2);
  }

  function formatWeekdayNumberMonday(d) {
    var day$$1 = d.getDay();
    return day$$1 === 0 ? 7 : day$$1;
  }

  function formatWeekNumberSunday(d, p) {
    return pad(sunday.count(year(d), d), p, 2);
  }

  function formatWeekNumberISO(d, p) {
    var day$$1 = d.getDay();
    d = (day$$1 >= 4 || day$$1 === 0) ? thursday(d) : thursday.ceil(d);
    return pad(thursday.count(year(d), d) + (year(d).getDay() === 4), p, 2);
  }

  function formatWeekdayNumberSunday(d) {
    return d.getDay();
  }

  function formatWeekNumberMonday(d, p) {
    return pad(monday.count(year(d), d), p, 2);
  }

  function formatYear(d, p) {
    return pad(d.getFullYear() % 100, p, 2);
  }

  function formatFullYear(d, p) {
    return pad(d.getFullYear() % 10000, p, 4);
  }

  function formatZone(d) {
    var z = d.getTimezoneOffset();
    return (z > 0 ? "-" : (z *= -1, "+"))
        + pad(z / 60 | 0, "0", 2)
        + pad(z % 60, "0", 2);
  }

  function formatUTCDayOfMonth(d, p) {
    return pad(d.getUTCDate(), p, 2);
  }

  function formatUTCHour24(d, p) {
    return pad(d.getUTCHours(), p, 2);
  }

  function formatUTCHour12(d, p) {
    return pad(d.getUTCHours() % 12 || 12, p, 2);
  }

  function formatUTCDayOfYear(d, p) {
    return pad(1 + utcDay.count(utcYear(d), d), p, 3);
  }

  function formatUTCMilliseconds(d, p) {
    return pad(d.getUTCMilliseconds(), p, 3);
  }

  function formatUTCMicroseconds(d, p) {
    return formatUTCMilliseconds(d, p) + "000";
  }

  function formatUTCMonthNumber(d, p) {
    return pad(d.getUTCMonth() + 1, p, 2);
  }

  function formatUTCMinutes(d, p) {
    return pad(d.getUTCMinutes(), p, 2);
  }

  function formatUTCSeconds(d, p) {
    return pad(d.getUTCSeconds(), p, 2);
  }

  function formatUTCWeekdayNumberMonday(d) {
    var dow = d.getUTCDay();
    return dow === 0 ? 7 : dow;
  }

  function formatUTCWeekNumberSunday(d, p) {
    return pad(utcSunday.count(utcYear(d), d), p, 2);
  }

  function formatUTCWeekNumberISO(d, p) {
    var day$$1 = d.getUTCDay();
    d = (day$$1 >= 4 || day$$1 === 0) ? utcThursday(d) : utcThursday.ceil(d);
    return pad(utcThursday.count(utcYear(d), d) + (utcYear(d).getUTCDay() === 4), p, 2);
  }

  function formatUTCWeekdayNumberSunday(d) {
    return d.getUTCDay();
  }

  function formatUTCWeekNumberMonday(d, p) {
    return pad(utcMonday.count(utcYear(d), d), p, 2);
  }

  function formatUTCYear(d, p) {
    return pad(d.getUTCFullYear() % 100, p, 2);
  }

  function formatUTCFullYear(d, p) {
    return pad(d.getUTCFullYear() % 10000, p, 4);
  }

  function formatUTCZone() {
    return "+0000";
  }

  function formatLiteralPercent() {
    return "%";
  }

  function formatUnixTimestamp(d) {
    return +d;
  }

  function formatUnixTimestampSeconds(d) {
    return Math.floor(+d / 1000);
  }

  var locale$1;
  var timeFormat;
  var timeParse;
  var utcFormat;
  var utcParse;

  defaultLocale$1({
    dateTime: "%x, %X",
    date: "%-m/%-d/%Y",
    time: "%-I:%M:%S %p",
    periods: ["AM", "PM"],
    days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    shortDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    shortMonths: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  });

  function defaultLocale$1(definition) {
    locale$1 = formatLocale$1(definition);
    timeFormat = locale$1.format;
    timeParse = locale$1.parse;
    utcFormat = locale$1.utcFormat;
    utcParse = locale$1.utcParse;
    return locale$1;
  }

  var isoSpecifier = "%Y-%m-%dT%H:%M:%S.%LZ";

  function formatIsoNative(date) {
    return date.toISOString();
  }

  var formatIso = Date.prototype.toISOString
      ? formatIsoNative
      : utcFormat(isoSpecifier);

  function parseIsoNative(string) {
    var date = new Date(string);
    return isNaN(date) ? null : date;
  }

  var parseIso = +new Date("2000-01-01T00:00:00.000Z")
      ? parseIsoNative
      : utcParse(isoSpecifier);

  function colors(specifier) {
    var n = specifier.length / 6 | 0, colors = new Array(n), i = 0;
    while (i < n) colors[i] = "#" + specifier.slice(i * 6, ++i * 6);
    return colors;
  }

  colors("1f77b4ff7f0e2ca02cd627289467bd8c564be377c27f7f7fbcbd2217becf");

  colors("7fc97fbeaed4fdc086ffff99386cb0f0027fbf5b17666666");

  colors("1b9e77d95f027570b3e7298a66a61ee6ab02a6761d666666");

  colors("a6cee31f78b4b2df8a33a02cfb9a99e31a1cfdbf6fff7f00cab2d66a3d9affff99b15928");

  colors("fbb4aeb3cde3ccebc5decbe4fed9a6ffffcce5d8bdfddaecf2f2f2");

  colors("b3e2cdfdcdaccbd5e8f4cae4e6f5c9fff2aef1e2cccccccc");

  colors("e41a1c377eb84daf4a984ea3ff7f00ffff33a65628f781bf999999");

  colors("66c2a5fc8d628da0cbe78ac3a6d854ffd92fe5c494b3b3b3");

  colors("8dd3c7ffffb3bebadafb807280b1d3fdb462b3de69fccde5d9d9d9bc80bdccebc5ffed6f");

  function ramp(scheme) {
    return rgbBasis(scheme[scheme.length - 1]);
  }

  var scheme = new Array(3).concat(
    "d8b365f5f5f55ab4ac",
    "a6611adfc27d80cdc1018571",
    "a6611adfc27df5f5f580cdc1018571",
    "8c510ad8b365f6e8c3c7eae55ab4ac01665e",
    "8c510ad8b365f6e8c3f5f5f5c7eae55ab4ac01665e",
    "8c510abf812ddfc27df6e8c3c7eae580cdc135978f01665e",
    "8c510abf812ddfc27df6e8c3f5f5f5c7eae580cdc135978f01665e",
    "5430058c510abf812ddfc27df6e8c3c7eae580cdc135978f01665e003c30",
    "5430058c510abf812ddfc27df6e8c3f5f5f5c7eae580cdc135978f01665e003c30"
  ).map(colors);

  ramp(scheme);

  var scheme$1 = new Array(3).concat(
    "af8dc3f7f7f77fbf7b",
    "7b3294c2a5cfa6dba0008837",
    "7b3294c2a5cff7f7f7a6dba0008837",
    "762a83af8dc3e7d4e8d9f0d37fbf7b1b7837",
    "762a83af8dc3e7d4e8f7f7f7d9f0d37fbf7b1b7837",
    "762a839970abc2a5cfe7d4e8d9f0d3a6dba05aae611b7837",
    "762a839970abc2a5cfe7d4e8f7f7f7d9f0d3a6dba05aae611b7837",
    "40004b762a839970abc2a5cfe7d4e8d9f0d3a6dba05aae611b783700441b",
    "40004b762a839970abc2a5cfe7d4e8f7f7f7d9f0d3a6dba05aae611b783700441b"
  ).map(colors);

  ramp(scheme$1);

  var scheme$2 = new Array(3).concat(
    "e9a3c9f7f7f7a1d76a",
    "d01c8bf1b6dab8e1864dac26",
    "d01c8bf1b6daf7f7f7b8e1864dac26",
    "c51b7de9a3c9fde0efe6f5d0a1d76a4d9221",
    "c51b7de9a3c9fde0eff7f7f7e6f5d0a1d76a4d9221",
    "c51b7dde77aef1b6dafde0efe6f5d0b8e1867fbc414d9221",
    "c51b7dde77aef1b6dafde0eff7f7f7e6f5d0b8e1867fbc414d9221",
    "8e0152c51b7dde77aef1b6dafde0efe6f5d0b8e1867fbc414d9221276419",
    "8e0152c51b7dde77aef1b6dafde0eff7f7f7e6f5d0b8e1867fbc414d9221276419"
  ).map(colors);

  ramp(scheme$2);

  var scheme$3 = new Array(3).concat(
    "998ec3f7f7f7f1a340",
    "5e3c99b2abd2fdb863e66101",
    "5e3c99b2abd2f7f7f7fdb863e66101",
    "542788998ec3d8daebfee0b6f1a340b35806",
    "542788998ec3d8daebf7f7f7fee0b6f1a340b35806",
    "5427888073acb2abd2d8daebfee0b6fdb863e08214b35806",
    "5427888073acb2abd2d8daebf7f7f7fee0b6fdb863e08214b35806",
    "2d004b5427888073acb2abd2d8daebfee0b6fdb863e08214b358067f3b08",
    "2d004b5427888073acb2abd2d8daebf7f7f7fee0b6fdb863e08214b358067f3b08"
  ).map(colors);

  ramp(scheme$3);

  var scheme$4 = new Array(3).concat(
    "ef8a62f7f7f767a9cf",
    "ca0020f4a58292c5de0571b0",
    "ca0020f4a582f7f7f792c5de0571b0",
    "b2182bef8a62fddbc7d1e5f067a9cf2166ac",
    "b2182bef8a62fddbc7f7f7f7d1e5f067a9cf2166ac",
    "b2182bd6604df4a582fddbc7d1e5f092c5de4393c32166ac",
    "b2182bd6604df4a582fddbc7f7f7f7d1e5f092c5de4393c32166ac",
    "67001fb2182bd6604df4a582fddbc7d1e5f092c5de4393c32166ac053061",
    "67001fb2182bd6604df4a582fddbc7f7f7f7d1e5f092c5de4393c32166ac053061"
  ).map(colors);

  ramp(scheme$4);

  var scheme$5 = new Array(3).concat(
    "ef8a62ffffff999999",
    "ca0020f4a582bababa404040",
    "ca0020f4a582ffffffbababa404040",
    "b2182bef8a62fddbc7e0e0e09999994d4d4d",
    "b2182bef8a62fddbc7ffffffe0e0e09999994d4d4d",
    "b2182bd6604df4a582fddbc7e0e0e0bababa8787874d4d4d",
    "b2182bd6604df4a582fddbc7ffffffe0e0e0bababa8787874d4d4d",
    "67001fb2182bd6604df4a582fddbc7e0e0e0bababa8787874d4d4d1a1a1a",
    "67001fb2182bd6604df4a582fddbc7ffffffe0e0e0bababa8787874d4d4d1a1a1a"
  ).map(colors);

  ramp(scheme$5);

  var scheme$6 = new Array(3).concat(
    "fc8d59ffffbf91bfdb",
    "d7191cfdae61abd9e92c7bb6",
    "d7191cfdae61ffffbfabd9e92c7bb6",
    "d73027fc8d59fee090e0f3f891bfdb4575b4",
    "d73027fc8d59fee090ffffbfe0f3f891bfdb4575b4",
    "d73027f46d43fdae61fee090e0f3f8abd9e974add14575b4",
    "d73027f46d43fdae61fee090ffffbfe0f3f8abd9e974add14575b4",
    "a50026d73027f46d43fdae61fee090e0f3f8abd9e974add14575b4313695",
    "a50026d73027f46d43fdae61fee090ffffbfe0f3f8abd9e974add14575b4313695"
  ).map(colors);

  ramp(scheme$6);

  var scheme$7 = new Array(3).concat(
    "fc8d59ffffbf91cf60",
    "d7191cfdae61a6d96a1a9641",
    "d7191cfdae61ffffbfa6d96a1a9641",
    "d73027fc8d59fee08bd9ef8b91cf601a9850",
    "d73027fc8d59fee08bffffbfd9ef8b91cf601a9850",
    "d73027f46d43fdae61fee08bd9ef8ba6d96a66bd631a9850",
    "d73027f46d43fdae61fee08bffffbfd9ef8ba6d96a66bd631a9850",
    "a50026d73027f46d43fdae61fee08bd9ef8ba6d96a66bd631a9850006837",
    "a50026d73027f46d43fdae61fee08bffffbfd9ef8ba6d96a66bd631a9850006837"
  ).map(colors);

  ramp(scheme$7);

  var scheme$8 = new Array(3).concat(
    "fc8d59ffffbf99d594",
    "d7191cfdae61abdda42b83ba",
    "d7191cfdae61ffffbfabdda42b83ba",
    "d53e4ffc8d59fee08be6f59899d5943288bd",
    "d53e4ffc8d59fee08bffffbfe6f59899d5943288bd",
    "d53e4ff46d43fdae61fee08be6f598abdda466c2a53288bd",
    "d53e4ff46d43fdae61fee08bffffbfe6f598abdda466c2a53288bd",
    "9e0142d53e4ff46d43fdae61fee08be6f598abdda466c2a53288bd5e4fa2",
    "9e0142d53e4ff46d43fdae61fee08bffffbfe6f598abdda466c2a53288bd5e4fa2"
  ).map(colors);

  ramp(scheme$8);

  var scheme$9 = new Array(3).concat(
    "e5f5f999d8c92ca25f",
    "edf8fbb2e2e266c2a4238b45",
    "edf8fbb2e2e266c2a42ca25f006d2c",
    "edf8fbccece699d8c966c2a42ca25f006d2c",
    "edf8fbccece699d8c966c2a441ae76238b45005824",
    "f7fcfde5f5f9ccece699d8c966c2a441ae76238b45005824",
    "f7fcfde5f5f9ccece699d8c966c2a441ae76238b45006d2c00441b"
  ).map(colors);

  ramp(scheme$9);

  var scheme$a = new Array(3).concat(
    "e0ecf49ebcda8856a7",
    "edf8fbb3cde38c96c688419d",
    "edf8fbb3cde38c96c68856a7810f7c",
    "edf8fbbfd3e69ebcda8c96c68856a7810f7c",
    "edf8fbbfd3e69ebcda8c96c68c6bb188419d6e016b",
    "f7fcfde0ecf4bfd3e69ebcda8c96c68c6bb188419d6e016b",
    "f7fcfde0ecf4bfd3e69ebcda8c96c68c6bb188419d810f7c4d004b"
  ).map(colors);

  ramp(scheme$a);

  var scheme$b = new Array(3).concat(
    "e0f3dba8ddb543a2ca",
    "f0f9e8bae4bc7bccc42b8cbe",
    "f0f9e8bae4bc7bccc443a2ca0868ac",
    "f0f9e8ccebc5a8ddb57bccc443a2ca0868ac",
    "f0f9e8ccebc5a8ddb57bccc44eb3d32b8cbe08589e",
    "f7fcf0e0f3dbccebc5a8ddb57bccc44eb3d32b8cbe08589e",
    "f7fcf0e0f3dbccebc5a8ddb57bccc44eb3d32b8cbe0868ac084081"
  ).map(colors);

  ramp(scheme$b);

  var scheme$c = new Array(3).concat(
    "fee8c8fdbb84e34a33",
    "fef0d9fdcc8afc8d59d7301f",
    "fef0d9fdcc8afc8d59e34a33b30000",
    "fef0d9fdd49efdbb84fc8d59e34a33b30000",
    "fef0d9fdd49efdbb84fc8d59ef6548d7301f990000",
    "fff7ecfee8c8fdd49efdbb84fc8d59ef6548d7301f990000",
    "fff7ecfee8c8fdd49efdbb84fc8d59ef6548d7301fb300007f0000"
  ).map(colors);

  ramp(scheme$c);

  var scheme$d = new Array(3).concat(
    "ece2f0a6bddb1c9099",
    "f6eff7bdc9e167a9cf02818a",
    "f6eff7bdc9e167a9cf1c9099016c59",
    "f6eff7d0d1e6a6bddb67a9cf1c9099016c59",
    "f6eff7d0d1e6a6bddb67a9cf3690c002818a016450",
    "fff7fbece2f0d0d1e6a6bddb67a9cf3690c002818a016450",
    "fff7fbece2f0d0d1e6a6bddb67a9cf3690c002818a016c59014636"
  ).map(colors);

  ramp(scheme$d);

  var scheme$e = new Array(3).concat(
    "ece7f2a6bddb2b8cbe",
    "f1eef6bdc9e174a9cf0570b0",
    "f1eef6bdc9e174a9cf2b8cbe045a8d",
    "f1eef6d0d1e6a6bddb74a9cf2b8cbe045a8d",
    "f1eef6d0d1e6a6bddb74a9cf3690c00570b0034e7b",
    "fff7fbece7f2d0d1e6a6bddb74a9cf3690c00570b0034e7b",
    "fff7fbece7f2d0d1e6a6bddb74a9cf3690c00570b0045a8d023858"
  ).map(colors);

  ramp(scheme$e);

  var scheme$f = new Array(3).concat(
    "e7e1efc994c7dd1c77",
    "f1eef6d7b5d8df65b0ce1256",
    "f1eef6d7b5d8df65b0dd1c77980043",
    "f1eef6d4b9dac994c7df65b0dd1c77980043",
    "f1eef6d4b9dac994c7df65b0e7298ace125691003f",
    "f7f4f9e7e1efd4b9dac994c7df65b0e7298ace125691003f",
    "f7f4f9e7e1efd4b9dac994c7df65b0e7298ace125698004367001f"
  ).map(colors);

  ramp(scheme$f);

  var scheme$g = new Array(3).concat(
    "fde0ddfa9fb5c51b8a",
    "feebe2fbb4b9f768a1ae017e",
    "feebe2fbb4b9f768a1c51b8a7a0177",
    "feebe2fcc5c0fa9fb5f768a1c51b8a7a0177",
    "feebe2fcc5c0fa9fb5f768a1dd3497ae017e7a0177",
    "fff7f3fde0ddfcc5c0fa9fb5f768a1dd3497ae017e7a0177",
    "fff7f3fde0ddfcc5c0fa9fb5f768a1dd3497ae017e7a017749006a"
  ).map(colors);

  ramp(scheme$g);

  var scheme$h = new Array(3).concat(
    "edf8b17fcdbb2c7fb8",
    "ffffcca1dab441b6c4225ea8",
    "ffffcca1dab441b6c42c7fb8253494",
    "ffffccc7e9b47fcdbb41b6c42c7fb8253494",
    "ffffccc7e9b47fcdbb41b6c41d91c0225ea80c2c84",
    "ffffd9edf8b1c7e9b47fcdbb41b6c41d91c0225ea80c2c84",
    "ffffd9edf8b1c7e9b47fcdbb41b6c41d91c0225ea8253494081d58"
  ).map(colors);

  ramp(scheme$h);

  var scheme$i = new Array(3).concat(
    "f7fcb9addd8e31a354",
    "ffffccc2e69978c679238443",
    "ffffccc2e69978c67931a354006837",
    "ffffccd9f0a3addd8e78c67931a354006837",
    "ffffccd9f0a3addd8e78c67941ab5d238443005a32",
    "ffffe5f7fcb9d9f0a3addd8e78c67941ab5d238443005a32",
    "ffffe5f7fcb9d9f0a3addd8e78c67941ab5d238443006837004529"
  ).map(colors);

  ramp(scheme$i);

  var scheme$j = new Array(3).concat(
    "fff7bcfec44fd95f0e",
    "ffffd4fed98efe9929cc4c02",
    "ffffd4fed98efe9929d95f0e993404",
    "ffffd4fee391fec44ffe9929d95f0e993404",
    "ffffd4fee391fec44ffe9929ec7014cc4c028c2d04",
    "ffffe5fff7bcfee391fec44ffe9929ec7014cc4c028c2d04",
    "ffffe5fff7bcfee391fec44ffe9929ec7014cc4c02993404662506"
  ).map(colors);

  ramp(scheme$j);

  var scheme$k = new Array(3).concat(
    "ffeda0feb24cf03b20",
    "ffffb2fecc5cfd8d3ce31a1c",
    "ffffb2fecc5cfd8d3cf03b20bd0026",
    "ffffb2fed976feb24cfd8d3cf03b20bd0026",
    "ffffb2fed976feb24cfd8d3cfc4e2ae31a1cb10026",
    "ffffccffeda0fed976feb24cfd8d3cfc4e2ae31a1cb10026",
    "ffffccffeda0fed976feb24cfd8d3cfc4e2ae31a1cbd0026800026"
  ).map(colors);

  ramp(scheme$k);

  var scheme$l = new Array(3).concat(
    "deebf79ecae13182bd",
    "eff3ffbdd7e76baed62171b5",
    "eff3ffbdd7e76baed63182bd08519c",
    "eff3ffc6dbef9ecae16baed63182bd08519c",
    "eff3ffc6dbef9ecae16baed64292c62171b5084594",
    "f7fbffdeebf7c6dbef9ecae16baed64292c62171b5084594",
    "f7fbffdeebf7c6dbef9ecae16baed64292c62171b508519c08306b"
  ).map(colors);

  ramp(scheme$l);

  var scheme$m = new Array(3).concat(
    "e5f5e0a1d99b31a354",
    "edf8e9bae4b374c476238b45",
    "edf8e9bae4b374c47631a354006d2c",
    "edf8e9c7e9c0a1d99b74c47631a354006d2c",
    "edf8e9c7e9c0a1d99b74c47641ab5d238b45005a32",
    "f7fcf5e5f5e0c7e9c0a1d99b74c47641ab5d238b45005a32",
    "f7fcf5e5f5e0c7e9c0a1d99b74c47641ab5d238b45006d2c00441b"
  ).map(colors);

  ramp(scheme$m);

  var scheme$n = new Array(3).concat(
    "f0f0f0bdbdbd636363",
    "f7f7f7cccccc969696525252",
    "f7f7f7cccccc969696636363252525",
    "f7f7f7d9d9d9bdbdbd969696636363252525",
    "f7f7f7d9d9d9bdbdbd969696737373525252252525",
    "fffffff0f0f0d9d9d9bdbdbd969696737373525252252525",
    "fffffff0f0f0d9d9d9bdbdbd969696737373525252252525000000"
  ).map(colors);

  ramp(scheme$n);

  var scheme$o = new Array(3).concat(
    "efedf5bcbddc756bb1",
    "f2f0f7cbc9e29e9ac86a51a3",
    "f2f0f7cbc9e29e9ac8756bb154278f",
    "f2f0f7dadaebbcbddc9e9ac8756bb154278f",
    "f2f0f7dadaebbcbddc9e9ac8807dba6a51a34a1486",
    "fcfbfdefedf5dadaebbcbddc9e9ac8807dba6a51a34a1486",
    "fcfbfdefedf5dadaebbcbddc9e9ac8807dba6a51a354278f3f007d"
  ).map(colors);

  ramp(scheme$o);

  var scheme$p = new Array(3).concat(
    "fee0d2fc9272de2d26",
    "fee5d9fcae91fb6a4acb181d",
    "fee5d9fcae91fb6a4ade2d26a50f15",
    "fee5d9fcbba1fc9272fb6a4ade2d26a50f15",
    "fee5d9fcbba1fc9272fb6a4aef3b2ccb181d99000d",
    "fff5f0fee0d2fcbba1fc9272fb6a4aef3b2ccb181d99000d",
    "fff5f0fee0d2fcbba1fc9272fb6a4aef3b2ccb181da50f1567000d"
  ).map(colors);

  ramp(scheme$p);

  var scheme$q = new Array(3).concat(
    "fee6cefdae6be6550d",
    "feeddefdbe85fd8d3cd94701",
    "feeddefdbe85fd8d3ce6550da63603",
    "feeddefdd0a2fdae6bfd8d3ce6550da63603",
    "feeddefdd0a2fdae6bfd8d3cf16913d948018c2d04",
    "fff5ebfee6cefdd0a2fdae6bfd8d3cf16913d948018c2d04",
    "fff5ebfee6cefdd0a2fdae6bfd8d3cf16913d94801a636037f2704"
  ).map(colors);

  ramp(scheme$q);

  cubehelixLong(cubehelix(300, 0.5, 0.0), cubehelix(-240, 0.5, 1.0));

  var warm = cubehelixLong(cubehelix(-100, 0.75, 0.35), cubehelix(80, 1.50, 0.8));

  var cool = cubehelixLong(cubehelix(260, 0.75, 0.35), cubehelix(80, 1.50, 0.8));

  var c = cubehelix();

  var c$1 = rgb(),
      pi_1_3 = Math.PI / 3,
      pi_2_3 = Math.PI * 2 / 3;

  function ramp$1(range) {
    var n = range.length;
    return function(t) {
      return range[Math.max(0, Math.min(n - 1, Math.floor(t * n)))];
    };
  }

  ramp$1(colors("44015444025645045745055946075a46085c460a5d460b5e470d60470e6147106347116447136548146748166848176948186a481a6c481b6d481c6e481d6f481f70482071482173482374482475482576482677482878482979472a7a472c7a472d7b472e7c472f7d46307e46327e46337f463480453581453781453882443983443a83443b84433d84433e85423f854240864241864142874144874045884046883f47883f48893e49893e4a893e4c8a3d4d8a3d4e8a3c4f8a3c508b3b518b3b528b3a538b3a548c39558c39568c38588c38598c375a8c375b8d365c8d365d8d355e8d355f8d34608d34618d33628d33638d32648e32658e31668e31678e31688e30698e306a8e2f6b8e2f6c8e2e6d8e2e6e8e2e6f8e2d708e2d718e2c718e2c728e2c738e2b748e2b758e2a768e2a778e2a788e29798e297a8e297b8e287c8e287d8e277e8e277f8e27808e26818e26828e26828e25838e25848e25858e24868e24878e23888e23898e238a8d228b8d228c8d228d8d218e8d218f8d21908d21918c20928c20928c20938c1f948c1f958b1f968b1f978b1f988b1f998a1f9a8a1e9b8a1e9c891e9d891f9e891f9f881fa0881fa1881fa1871fa28720a38620a48621a58521a68522a78522a88423a98324aa8325ab8225ac8226ad8127ad8128ae8029af7f2ab07f2cb17e2db27d2eb37c2fb47c31b57b32b67a34b67935b77937b87838b9773aba763bbb753dbc743fbc7340bd7242be7144bf7046c06f48c16e4ac16d4cc26c4ec36b50c46a52c56954c56856c66758c7655ac8645cc8635ec96260ca6063cb5f65cb5e67cc5c69cd5b6ccd5a6ece5870cf5773d05675d05477d1537ad1517cd2507fd34e81d34d84d44b86d54989d5488bd6468ed64590d74393d74195d84098d83e9bd93c9dd93ba0da39a2da37a5db36a8db34aadc32addc30b0dd2fb2dd2db5de2bb8de29bade28bddf26c0df25c2df23c5e021c8e020cae11fcde11dd0e11cd2e21bd5e21ad8e219dae319dde318dfe318e2e418e5e419e7e419eae51aece51befe51cf1e51df4e61ef6e620f8e621fbe723fde725"));

  var magma = ramp$1(colors("00000401000501010601010802010902020b02020d03030f03031204041405041606051806051a07061c08071e0907200a08220b09240c09260d0a290e0b2b100b2d110c2f120d31130d34140e36150e38160f3b180f3d19103f1a10421c10441d11471e114920114b21114e22115024125325125527125829115a2a115c2c115f2d11612f116331116533106734106936106b38106c390f6e3b0f703d0f713f0f72400f74420f75440f764510774710784910784a10794c117a4e117b4f127b51127c52137c54137d56147d57157e59157e5a167e5c167f5d177f5f187f601880621980641a80651a80671b80681c816a1c816b1d816d1d816e1e81701f81721f817320817521817621817822817922827b23827c23827e24828025828125818326818426818627818827818928818b29818c29818e2a81902a81912b81932b80942c80962c80982d80992d809b2e7f9c2e7f9e2f7fa02f7fa1307ea3307ea5317ea6317da8327daa337dab337cad347cae347bb0357bb2357bb3367ab5367ab73779b83779ba3878bc3978bd3977bf3a77c03a76c23b75c43c75c53c74c73d73c83e73ca3e72cc3f71cd4071cf4070d0416fd2426fd3436ed5446dd6456cd8456cd9466bdb476adc4869de4968df4a68e04c67e24d66e34e65e44f64e55064e75263e85362e95462ea5661eb5760ec5860ed5a5fee5b5eef5d5ef05f5ef1605df2625df2645cf3655cf4675cf4695cf56b5cf66c5cf66e5cf7705cf7725cf8745cf8765cf9785df9795df97b5dfa7d5efa7f5efa815ffb835ffb8560fb8761fc8961fc8a62fc8c63fc8e64fc9065fd9266fd9467fd9668fd9869fd9a6afd9b6bfe9d6cfe9f6dfea16efea36ffea571fea772fea973feaa74feac76feae77feb078feb27afeb47bfeb67cfeb77efeb97ffebb81febd82febf84fec185fec287fec488fec68afec88cfeca8dfecc8ffecd90fecf92fed194fed395fed597fed799fed89afdda9cfddc9efddea0fde0a1fde2a3fde3a5fde5a7fde7a9fde9aafdebacfcecaefceeb0fcf0b2fcf2b4fcf4b6fcf6b8fcf7b9fcf9bbfcfbbdfcfdbf"));

  var inferno = ramp$1(colors("00000401000501010601010802010a02020c02020e03021004031204031405041706041907051b08051d09061f0a07220b07240c08260d08290e092b10092d110a30120a32140b34150b37160b39180c3c190c3e1b0c411c0c431e0c451f0c48210c4a230c4c240c4f260c51280b53290b552b0b572d0b592f0a5b310a5c320a5e340a5f3609613809623909633b09643d09653e0966400a67420a68440a68450a69470b6a490b6a4a0c6b4c0c6b4d0d6c4f0d6c510e6c520e6d540f6d550f6d57106e59106e5a116e5c126e5d126e5f136e61136e62146e64156e65156e67166e69166e6a176e6c186e6d186e6f196e71196e721a6e741a6e751b6e771c6d781c6d7a1d6d7c1d6d7d1e6d7f1e6c801f6c82206c84206b85216b87216b88226a8a226a8c23698d23698f24699025689225689326679526679727669827669a28659b29649d29649f2a63a02a63a22b62a32c61a52c60a62d60a82e5fa92e5eab2f5ead305dae305cb0315bb1325ab3325ab43359b63458b73557b93556ba3655bc3754bd3853bf3952c03a51c13a50c33b4fc43c4ec63d4dc73e4cc83f4bca404acb4149cc4248ce4347cf4446d04545d24644d34743d44842d54a41d74b3fd84c3ed94d3dda4e3cdb503bdd513ade5238df5337e05536e15635e25734e35933e45a31e55c30e65d2fe75e2ee8602de9612bea632aeb6429eb6628ec6726ed6925ee6a24ef6c23ef6e21f06f20f1711ff1731df2741cf3761bf37819f47918f57b17f57d15f67e14f68013f78212f78410f8850ff8870ef8890cf98b0bf98c0af98e09fa9008fa9207fa9407fb9606fb9706fb9906fb9b06fb9d07fc9f07fca108fca309fca50afca60cfca80dfcaa0ffcac11fcae12fcb014fcb216fcb418fbb61afbb81dfbba1ffbbc21fbbe23fac026fac228fac42afac62df9c72ff9c932f9cb35f8cd37f8cf3af7d13df7d340f6d543f6d746f5d949f5db4cf4dd4ff4df53f4e156f3e35af3e55df2e661f2e865f2ea69f1ec6df1ed71f1ef75f1f179f2f27df2f482f3f586f3f68af4f88ef5f992f6fa96f8fb9af9fc9dfafda1fcffa4"));

  var plasma = ramp$1(colors("0d088710078813078916078a19068c1b068d1d068e20068f2206902406912605912805922a05932c05942e05952f059631059733059735049837049938049a3a049a3c049b3e049c3f049c41049d43039e44039e46039f48039f4903a04b03a14c02a14e02a25002a25102a35302a35502a45601a45801a45901a55b01a55c01a65e01a66001a66100a76300a76400a76600a76700a86900a86a00a86c00a86e00a86f00a87100a87201a87401a87501a87701a87801a87a02a87b02a87d03a87e03a88004a88104a78305a78405a78606a68707a68808a68a09a58b0aa58d0ba58e0ca48f0da4910ea3920fa39410a29511a19613a19814a099159f9a169f9c179e9d189d9e199da01a9ca11b9ba21d9aa31e9aa51f99a62098a72197a82296aa2395ab2494ac2694ad2793ae2892b02991b12a90b22b8fb32c8eb42e8db52f8cb6308bb7318ab83289ba3388bb3488bc3587bd3786be3885bf3984c03a83c13b82c23c81c33d80c43e7fc5407ec6417dc7427cc8437bc9447aca457acb4679cc4778cc4977cd4a76ce4b75cf4c74d04d73d14e72d24f71d35171d45270d5536fd5546ed6556dd7566cd8576bd9586ada5a6ada5b69db5c68dc5d67dd5e66de5f65de6164df6263e06363e16462e26561e26660e3685fe4695ee56a5de56b5de66c5ce76e5be76f5ae87059e97158e97257ea7457eb7556eb7655ec7754ed7953ed7a52ee7b51ef7c51ef7e50f07f4ff0804ef1814df1834cf2844bf3854bf3874af48849f48948f58b47f58c46f68d45f68f44f79044f79143f79342f89441f89540f9973ff9983ef99a3efa9b3dfa9c3cfa9e3bfb9f3afba139fba238fca338fca537fca636fca835fca934fdab33fdac33fdae32fdaf31fdb130fdb22ffdb42ffdb52efeb72dfeb82cfeba2cfebb2bfebd2afebe2afec029fdc229fdc328fdc527fdc627fdc827fdca26fdcb26fccd25fcce25fcd025fcd225fbd324fbd524fbd724fad824fada24f9dc24f9dd25f8df25f8e125f7e225f7e425f6e626f6e826f5e926f5eb27f4ed27f3ee27f3f027f2f227f1f426f1f525f0f724f0f921"));

  var pi$4 = Math.PI;

  function sign$1(x) {
    return x < 0 ? -1 : 1;
  }

  // Calculate the slopes of the tangents (Hermite-type interpolation) based on
  // the following paper: Steffen, M. 1990. A Simple Method for Monotonic
  // Interpolation in One Dimension. Astronomy and Astrophysics, Vol. 239, NO.
  // NOV(II), P. 443, 1990.
  function slope3(that, x2, y2) {
    var h0 = that._x1 - that._x0,
        h1 = x2 - that._x1,
        s0 = (that._y1 - that._y0) / (h0 || h1 < 0 && -0),
        s1 = (y2 - that._y1) / (h1 || h0 < 0 && -0),
        p = (s0 * h1 + s1 * h0) / (h0 + h1);
    return (sign$1(s0) + sign$1(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0;
  }

  // Calculate a one-sided slope.
  function slope2(that, t) {
    var h = that._x1 - that._x0;
    return h ? (3 * (that._y1 - that._y0) / h - t) / 2 : t;
  }

  // According to https://en.wikipedia.org/wiki/Cubic_Hermite_spline#Representations
  // "you can express cubic Hermite interpolation in terms of cubic Bézier curves
  // with respect to the four values p0, p0 + m0 / 3, p1 - m1 / 3, p1".
  function point$5(that, t0, t1) {
    var x0 = that._x0,
        y0 = that._y0,
        x1 = that._x1,
        y1 = that._y1,
        dx = (x1 - x0) / 3;
    that._context.bezierCurveTo(x0 + dx, y0 + dx * t0, x1 - dx, y1 - dx * t1, x1, y1);
  }

  function MonotoneX(context) {
    this._context = context;
  }

  MonotoneX.prototype = {
    areaStart: function() {
      this._line = 0;
    },
    areaEnd: function() {
      this._line = NaN;
    },
    lineStart: function() {
      this._x0 = this._x1 =
      this._y0 = this._y1 =
      this._t0 = NaN;
      this._point = 0;
    },
    lineEnd: function() {
      switch (this._point) {
        case 2: this._context.lineTo(this._x1, this._y1); break;
        case 3: point$5(this, this._t0, slope2(this, this._t0)); break;
      }
      if (this._line || (this._line !== 0 && this._point === 1)) this._context.closePath();
      this._line = 1 - this._line;
    },
    point: function(x, y) {
      var t1 = NaN;

      x = +x, y = +y;
      if (x === this._x1 && y === this._y1) return; // Ignore coincident points.
      switch (this._point) {
        case 0: this._point = 1; this._line ? this._context.lineTo(x, y) : this._context.moveTo(x, y); break;
        case 1: this._point = 2; break;
        case 2: this._point = 3; point$5(this, slope2(this, t1 = slope3(this, x, y)), t1); break;
        default: point$5(this, this._t0, t1 = slope3(this, x, y)); break;
      }

      this._x0 = this._x1, this._x1 = x;
      this._y0 = this._y1, this._y1 = y;
      this._t0 = t1;
    }
  };

  function MonotoneY(context) {
    this._context = new ReflectContext(context);
  }

  (MonotoneY.prototype = Object.create(MonotoneX.prototype)).point = function(x, y) {
    MonotoneX.prototype.point.call(this, y, x);
  };

  function ReflectContext(context) {
    this._context = context;
  }

  ReflectContext.prototype = {
    moveTo: function(x, y) { this._context.moveTo(y, x); },
    closePath: function() { this._context.closePath(); },
    lineTo: function(x, y) { this._context.lineTo(y, x); },
    bezierCurveTo: function(x1, y1, x2, y2, x, y) { this._context.bezierCurveTo(y1, x1, y2, x2, y, x); }
  };

  function constant$d(x) {
    return function() {
      return x;
    };
  }

  function ZoomEvent(target, type, transform) {
    this.target = target;
    this.type = type;
    this.transform = transform;
  }

  function Transform(k, x, y) {
    this.k = k;
    this.x = x;
    this.y = y;
  }

  Transform.prototype = {
    constructor: Transform,
    scale: function(k) {
      return k === 1 ? this : new Transform(this.k * k, this.x, this.y);
    },
    translate: function(x, y) {
      return x === 0 & y === 0 ? this : new Transform(this.k, this.x + this.k * x, this.y + this.k * y);
    },
    apply: function(point) {
      return [point[0] * this.k + this.x, point[1] * this.k + this.y];
    },
    applyX: function(x) {
      return x * this.k + this.x;
    },
    applyY: function(y) {
      return y * this.k + this.y;
    },
    invert: function(location) {
      return [(location[0] - this.x) / this.k, (location[1] - this.y) / this.k];
    },
    invertX: function(x) {
      return (x - this.x) / this.k;
    },
    invertY: function(y) {
      return (y - this.y) / this.k;
    },
    rescaleX: function(x) {
      return x.copy().domain(x.range().map(this.invertX, this).map(x.invert, x));
    },
    rescaleY: function(y) {
      return y.copy().domain(y.range().map(this.invertY, this).map(y.invert, y));
    },
    toString: function() {
      return "translate(" + this.x + "," + this.y + ") scale(" + this.k + ")";
    }
  };

  var identity$8 = new Transform(1, 0, 0);

  transform$1.prototype = Transform.prototype;

  function transform$1(node) {
    return node.__zoom || identity$8;
  }

  function nopropagation$2() {
    event.stopImmediatePropagation();
  }

  function noevent$2() {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  // Ignore right-click, since that should open the context menu.
  function defaultFilter$2() {
    return !event.button;
  }

  function defaultExtent$1() {
    var e = this, w, h;
    if (e instanceof SVGElement) {
      e = e.ownerSVGElement || e;
      w = e.width.baseVal.value;
      h = e.height.baseVal.value;
    } else {
      w = e.clientWidth;
      h = e.clientHeight;
    }
    return [[0, 0], [w, h]];
  }

  function defaultTransform() {
    return this.__zoom || identity$8;
  }

  function defaultWheelDelta() {
    return -event.deltaY * (event.deltaMode ? 120 : 1) / 500;
  }

  function defaultTouchable$1() {
    return "ontouchstart" in this;
  }

  function defaultConstrain(transform, extent, translateExtent) {
    var dx0 = transform.invertX(extent[0][0]) - translateExtent[0][0],
        dx1 = transform.invertX(extent[1][0]) - translateExtent[1][0],
        dy0 = transform.invertY(extent[0][1]) - translateExtent[0][1],
        dy1 = transform.invertY(extent[1][1]) - translateExtent[1][1];
    return transform.translate(
      dx1 > dx0 ? (dx0 + dx1) / 2 : Math.min(0, dx0) || Math.max(0, dx1),
      dy1 > dy0 ? (dy0 + dy1) / 2 : Math.min(0, dy0) || Math.max(0, dy1)
    );
  }

  function zoom() {
    var filter = defaultFilter$2,
        extent = defaultExtent$1,
        constrain = defaultConstrain,
        wheelDelta = defaultWheelDelta,
        touchable = defaultTouchable$1,
        scaleExtent = [0, Infinity],
        translateExtent = [[-Infinity, -Infinity], [Infinity, Infinity]],
        duration = 250,
        interpolate = interpolateZoom,
        gestures = [],
        listeners = dispatch("start", "zoom", "end"),
        touchstarting,
        touchending,
        touchDelay = 500,
        wheelDelay = 150,
        clickDistance2 = 0;

    function zoom(selection$$1) {
      selection$$1
          .property("__zoom", defaultTransform)
          .on("wheel.zoom", wheeled)
          .on("mousedown.zoom", mousedowned)
          .on("dblclick.zoom", dblclicked)
        .filter(touchable)
          .on("touchstart.zoom", touchstarted)
          .on("touchmove.zoom", touchmoved)
          .on("touchend.zoom touchcancel.zoom", touchended)
          .style("touch-action", "none")
          .style("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
    }

    zoom.transform = function(collection, transform) {
      var selection$$1 = collection.selection ? collection.selection() : collection;
      selection$$1.property("__zoom", defaultTransform);
      if (collection !== selection$$1) {
        schedule(collection, transform);
      } else {
        selection$$1.interrupt().each(function() {
          gesture(this, arguments)
              .start()
              .zoom(null, typeof transform === "function" ? transform.apply(this, arguments) : transform)
              .end();
        });
      }
    };

    zoom.scaleBy = function(selection$$1, k) {
      zoom.scaleTo(selection$$1, function() {
        var k0 = this.__zoom.k,
            k1 = typeof k === "function" ? k.apply(this, arguments) : k;
        return k0 * k1;
      });
    };

    zoom.scaleTo = function(selection$$1, k) {
      zoom.transform(selection$$1, function() {
        var e = extent.apply(this, arguments),
            t0 = this.__zoom,
            p0 = centroid(e),
            p1 = t0.invert(p0),
            k1 = typeof k === "function" ? k.apply(this, arguments) : k;
        return constrain(translate(scale(t0, k1), p0, p1), e, translateExtent);
      });
    };

    zoom.translateBy = function(selection$$1, x, y) {
      zoom.transform(selection$$1, function() {
        return constrain(this.__zoom.translate(
          typeof x === "function" ? x.apply(this, arguments) : x,
          typeof y === "function" ? y.apply(this, arguments) : y
        ), extent.apply(this, arguments), translateExtent);
      });
    };

    zoom.translateTo = function(selection$$1, x, y) {
      zoom.transform(selection$$1, function() {
        var e = extent.apply(this, arguments),
            t = this.__zoom,
            p = centroid(e);
        return constrain(identity$8.translate(p[0], p[1]).scale(t.k).translate(
          typeof x === "function" ? -x.apply(this, arguments) : -x,
          typeof y === "function" ? -y.apply(this, arguments) : -y
        ), e, translateExtent);
      });
    };

    function scale(transform, k) {
      k = Math.max(scaleExtent[0], Math.min(scaleExtent[1], k));
      return k === transform.k ? transform : new Transform(k, transform.x, transform.y);
    }

    function translate(transform, p0, p1) {
      var x = p0[0] - p1[0] * transform.k, y = p0[1] - p1[1] * transform.k;
      return x === transform.x && y === transform.y ? transform : new Transform(transform.k, x, y);
    }

    function centroid(extent) {
      return [(+extent[0][0] + +extent[1][0]) / 2, (+extent[0][1] + +extent[1][1]) / 2];
    }

    function schedule(transition$$1, transform, center) {
      transition$$1
          .on("start.zoom", function() { gesture(this, arguments).start(); })
          .on("interrupt.zoom end.zoom", function() { gesture(this, arguments).end(); })
          .tween("zoom", function() {
            var that = this,
                args = arguments,
                g = gesture(that, args),
                e = extent.apply(that, args),
                p = center || centroid(e),
                w = Math.max(e[1][0] - e[0][0], e[1][1] - e[0][1]),
                a = that.__zoom,
                b = typeof transform === "function" ? transform.apply(that, args) : transform,
                i = interpolate(a.invert(p).concat(w / a.k), b.invert(p).concat(w / b.k));
            return function(t) {
              if (t === 1) t = b; // Avoid rounding error on end.
              else { var l = i(t), k = w / l[2]; t = new Transform(k, p[0] - l[0] * k, p[1] - l[1] * k); }
              g.zoom(null, t);
            };
          });
    }

    function gesture(that, args) {
      for (var i = 0, n = gestures.length, g; i < n; ++i) {
        if ((g = gestures[i]).that === that) {
          return g;
        }
      }
      return new Gesture(that, args);
    }

    function Gesture(that, args) {
      this.that = that;
      this.args = args;
      this.index = -1;
      this.active = 0;
      this.extent = extent.apply(that, args);
    }

    Gesture.prototype = {
      start: function() {
        if (++this.active === 1) {
          this.index = gestures.push(this) - 1;
          this.emit("start");
        }
        return this;
      },
      zoom: function(key, transform) {
        if (this.mouse && key !== "mouse") this.mouse[1] = transform.invert(this.mouse[0]);
        if (this.touch0 && key !== "touch") this.touch0[1] = transform.invert(this.touch0[0]);
        if (this.touch1 && key !== "touch") this.touch1[1] = transform.invert(this.touch1[0]);
        this.that.__zoom = transform;
        this.emit("zoom");
        return this;
      },
      end: function() {
        if (--this.active === 0) {
          gestures.splice(this.index, 1);
          this.index = -1;
          this.emit("end");
        }
        return this;
      },
      emit: function(type) {
        customEvent(new ZoomEvent(zoom, type, this.that.__zoom), listeners.apply, listeners, [type, this.that, this.args]);
      }
    };

    function wheeled() {
      if (!filter.apply(this, arguments)) return;
      var g = gesture(this, arguments),
          t = this.__zoom,
          k = Math.max(scaleExtent[0], Math.min(scaleExtent[1], t.k * Math.pow(2, wheelDelta.apply(this, arguments)))),
          p = mouse(this);

      // If the mouse is in the same location as before, reuse it.
      // If there were recent wheel events, reset the wheel idle timeout.
      if (g.wheel) {
        if (g.mouse[0][0] !== p[0] || g.mouse[0][1] !== p[1]) {
          g.mouse[1] = t.invert(g.mouse[0] = p);
        }
        clearTimeout(g.wheel);
      }

      // If this wheel event won’t trigger a transform change, ignore it.
      else if (t.k === k) return;

      // Otherwise, capture the mouse point and location at the start.
      else {
        g.mouse = [p, t.invert(p)];
        interrupt(this);
        g.start();
      }

      noevent$2();
      g.wheel = setTimeout(wheelidled, wheelDelay);
      g.zoom("mouse", constrain(translate(scale(t, k), g.mouse[0], g.mouse[1]), g.extent, translateExtent));

      function wheelidled() {
        g.wheel = null;
        g.end();
      }
    }

    function mousedowned() {
      if (touchending || !filter.apply(this, arguments)) return;
      var g = gesture(this, arguments),
          v = select(event.view).on("mousemove.zoom", mousemoved, true).on("mouseup.zoom", mouseupped, true),
          p = mouse(this),
          x0 = event.clientX,
          y0 = event.clientY;

      dragDisable(event.view);
      nopropagation$2();
      g.mouse = [p, this.__zoom.invert(p)];
      interrupt(this);
      g.start();

      function mousemoved() {
        noevent$2();
        if (!g.moved) {
          var dx = event.clientX - x0, dy = event.clientY - y0;
          g.moved = dx * dx + dy * dy > clickDistance2;
        }
        g.zoom("mouse", constrain(translate(g.that.__zoom, g.mouse[0] = mouse(g.that), g.mouse[1]), g.extent, translateExtent));
      }

      function mouseupped() {
        v.on("mousemove.zoom mouseup.zoom", null);
        yesdrag(event.view, g.moved);
        noevent$2();
        g.end();
      }
    }

    function dblclicked() {
      if (!filter.apply(this, arguments)) return;
      var t0 = this.__zoom,
          p0 = mouse(this),
          p1 = t0.invert(p0),
          k1 = t0.k * (event.shiftKey ? 0.5 : 2),
          t1 = constrain(translate(scale(t0, k1), p0, p1), extent.apply(this, arguments), translateExtent);

      noevent$2();
      if (duration > 0) select(this).transition().duration(duration).call(schedule, t1, p0);
      else select(this).call(zoom.transform, t1);
    }

    function touchstarted() {
      if (!filter.apply(this, arguments)) return;
      var g = gesture(this, arguments),
          touches$$1 = event.changedTouches,
          started,
          n = touches$$1.length, i, t, p;

      nopropagation$2();
      for (i = 0; i < n; ++i) {
        t = touches$$1[i], p = touch(this, touches$$1, t.identifier);
        p = [p, this.__zoom.invert(p), t.identifier];
        if (!g.touch0) g.touch0 = p, started = true;
        else if (!g.touch1) g.touch1 = p;
      }

      // If this is a dbltap, reroute to the (optional) dblclick.zoom handler.
      if (touchstarting) {
        touchstarting = clearTimeout(touchstarting);
        if (!g.touch1) {
          g.end();
          p = select(this).on("dblclick.zoom");
          if (p) p.apply(this, arguments);
          return;
        }
      }

      if (started) {
        touchstarting = setTimeout(function() { touchstarting = null; }, touchDelay);
        interrupt(this);
        g.start();
      }
    }

    function touchmoved() {
      var g = gesture(this, arguments),
          touches$$1 = event.changedTouches,
          n = touches$$1.length, i, t, p, l;

      noevent$2();
      if (touchstarting) touchstarting = clearTimeout(touchstarting);
      for (i = 0; i < n; ++i) {
        t = touches$$1[i], p = touch(this, touches$$1, t.identifier);
        if (g.touch0 && g.touch0[2] === t.identifier) g.touch0[0] = p;
        else if (g.touch1 && g.touch1[2] === t.identifier) g.touch1[0] = p;
      }
      t = g.that.__zoom;
      if (g.touch1) {
        var p0 = g.touch0[0], l0 = g.touch0[1],
            p1 = g.touch1[0], l1 = g.touch1[1],
            dp = (dp = p1[0] - p0[0]) * dp + (dp = p1[1] - p0[1]) * dp,
            dl = (dl = l1[0] - l0[0]) * dl + (dl = l1[1] - l0[1]) * dl;
        t = scale(t, Math.sqrt(dp / dl));
        p = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
        l = [(l0[0] + l1[0]) / 2, (l0[1] + l1[1]) / 2];
      }
      else if (g.touch0) p = g.touch0[0], l = g.touch0[1];
      else return;
      g.zoom("touch", constrain(translate(t, p, l), g.extent, translateExtent));
    }

    function touchended() {
      var g = gesture(this, arguments),
          touches$$1 = event.changedTouches,
          n = touches$$1.length, i, t;

      nopropagation$2();
      if (touchending) clearTimeout(touchending);
      touchending = setTimeout(function() { touchending = null; }, touchDelay);
      for (i = 0; i < n; ++i) {
        t = touches$$1[i];
        if (g.touch0 && g.touch0[2] === t.identifier) delete g.touch0;
        else if (g.touch1 && g.touch1[2] === t.identifier) delete g.touch1;
      }
      if (g.touch1 && !g.touch0) g.touch0 = g.touch1, delete g.touch1;
      if (g.touch0) g.touch0[1] = this.__zoom.invert(g.touch0[0]);
      else g.end();
    }

    zoom.wheelDelta = function(_) {
      return arguments.length ? (wheelDelta = typeof _ === "function" ? _ : constant$d(+_), zoom) : wheelDelta;
    };

    zoom.filter = function(_) {
      return arguments.length ? (filter = typeof _ === "function" ? _ : constant$d(!!_), zoom) : filter;
    };

    zoom.touchable = function(_) {
      return arguments.length ? (touchable = typeof _ === "function" ? _ : constant$d(!!_), zoom) : touchable;
    };

    zoom.extent = function(_) {
      return arguments.length ? (extent = typeof _ === "function" ? _ : constant$d([[+_[0][0], +_[0][1]], [+_[1][0], +_[1][1]]]), zoom) : extent;
    };

    zoom.scaleExtent = function(_) {
      return arguments.length ? (scaleExtent[0] = +_[0], scaleExtent[1] = +_[1], zoom) : [scaleExtent[0], scaleExtent[1]];
    };

    zoom.translateExtent = function(_) {
      return arguments.length ? (translateExtent[0][0] = +_[0][0], translateExtent[1][0] = +_[1][0], translateExtent[0][1] = +_[0][1], translateExtent[1][1] = +_[1][1], zoom) : [[translateExtent[0][0], translateExtent[0][1]], [translateExtent[1][0], translateExtent[1][1]]];
    };

    zoom.constrain = function(_) {
      return arguments.length ? (constrain = _, zoom) : constrain;
    };

    zoom.duration = function(_) {
      return arguments.length ? (duration = +_, zoom) : duration;
    };

    zoom.interpolate = function(_) {
      return arguments.length ? (interpolate = _, zoom) : interpolate;
    };

    zoom.on = function() {
      var value = listeners.on.apply(listeners, arguments);
      return value === listeners ? zoom : value;
    };

    zoom.clickDistance = function(_) {
      return arguments.length ? (clickDistance2 = (_ = +_) * _, zoom) : Math.sqrt(clickDistance2);
    };

    return zoom;
  }

  // Copyright 2014 the V8 project authors. All rights reserved.
  const DEFAULT_NODE_BUBBLE_RADIUS = 12;
  const NODE_INPUT_WIDTH = 50;
  const MINIMUM_NODE_OUTPUT_APPROACH = 15;
  const MINIMUM_NODE_INPUT_APPROACH = 15 + 2 * DEFAULT_NODE_BUBBLE_RADIUS;
  class GNode {
      constructor(nodeLabel) {
          this.id = nodeLabel.id;
          this.nodeLabel = nodeLabel;
          this.displayLabel = nodeLabel.getDisplayLabel();
          this.inputs = [];
          this.outputs = [];
          this.visible = false;
          this.x = 0;
          this.y = 0;
          this.rank = MAX_RANK_SENTINEL;
          this.outputApproach = MINIMUM_NODE_OUTPUT_APPROACH;
          // Every control node is a CFG node.
          this.cfg = nodeLabel.control;
          this.labelbbox = measureText(this.displayLabel);
          const typebbox = measureText(this.getDisplayType());
          const innerwidth = Math.max(this.labelbbox.width, typebbox.width);
          this.width = alignUp(innerwidth + NODE_INPUT_WIDTH * 2, NODE_INPUT_WIDTH);
          const innerheight = Math.max(this.labelbbox.height, typebbox.height);
          this.normalheight = innerheight + 20;
          this.visitOrderWithinRank = 0;
      }
      isControl() {
          return this.nodeLabel.control;
      }
      isInput() {
          return this.nodeLabel.opcode == 'Parameter' || this.nodeLabel.opcode.endsWith('Constant');
      }
      isLive() {
          return this.nodeLabel.live !== false;
      }
      isJavaScript() {
          return this.nodeLabel.opcode.startsWith('JS');
      }
      isSimplified() {
          if (this.isJavaScript())
              return false;
          const opcode = this.nodeLabel.opcode;
          return opcode.endsWith('Phi') ||
              opcode.startsWith('Boolean') ||
              opcode.startsWith('Number') ||
              opcode.startsWith('String') ||
              opcode.startsWith('Change') ||
              opcode.startsWith('Object') ||
              opcode.startsWith('Reference') ||
              opcode.startsWith('Any') ||
              opcode.endsWith('ToNumber') ||
              (opcode == 'AnyToBoolean') ||
              (opcode.startsWith('Load') && opcode.length > 4) ||
              (opcode.startsWith('Store') && opcode.length > 5);
      }
      isMachine() {
          return !(this.isControl() || this.isInput() ||
              this.isJavaScript() || this.isSimplified());
      }
      getTotalNodeWidth() {
          const inputWidth = this.inputs.length * NODE_INPUT_WIDTH;
          return Math.max(inputWidth, this.width);
      }
      getTitle() {
          return this.nodeLabel.getTitle();
      }
      getDisplayLabel() {
          return this.nodeLabel.getDisplayLabel();
      }
      getType() {
          return this.nodeLabel.type;
      }
      getDisplayType() {
          let typeString = this.nodeLabel.type;
          if (typeString == undefined)
              return "";
          if (typeString.length > 24) {
              typeString = typeString.substr(0, 25) + "...";
          }
          return typeString;
      }
      deepestInputRank() {
          let deepestRank = 0;
          this.inputs.forEach(function (e) {
              if (e.isVisible() && !e.isBackEdge()) {
                  if (e.source.rank > deepestRank) {
                      deepestRank = e.source.rank;
                  }
              }
          });
          return deepestRank;
      }
      areAnyOutputsVisible() {
          let visibleCount = 0;
          this.outputs.forEach(function (e) { if (e.isVisible())
              ++visibleCount; });
          if (this.outputs.length == visibleCount)
              return 2;
          if (visibleCount != 0)
              return 1;
          return 0;
      }
      setOutputVisibility(v) {
          let result = false;
          this.outputs.forEach(function (e) {
              e.visible = v;
              if (v) {
                  if (!e.target.visible) {
                      e.target.visible = true;
                      result = true;
                  }
              }
          });
          return result;
      }
      setInputVisibility(i, v) {
          const edge = this.inputs[i];
          edge.visible = v;
          if (v) {
              if (!edge.source.visible) {
                  edge.source.visible = true;
                  return true;
              }
          }
          return false;
      }
      getInputApproach(index) {
          return this.y - MINIMUM_NODE_INPUT_APPROACH -
              (index % 4) * MINIMUM_EDGE_SEPARATION - DEFAULT_NODE_BUBBLE_RADIUS;
      }
      getNodeHeight(showTypes) {
          if (showTypes) {
              return this.normalheight + this.labelbbox.height;
          }
          else {
              return this.normalheight;
          }
      }
      getOutputApproach(showTypes) {
          return this.y + this.outputApproach + this.getNodeHeight(showTypes) +
              +DEFAULT_NODE_BUBBLE_RADIUS;
      }
      getInputX(index) {
          const result = this.getTotalNodeWidth() - (NODE_INPUT_WIDTH / 2) +
              (index - this.inputs.length + 1) * NODE_INPUT_WIDTH;
          return result;
      }
      getOutputX() {
          return this.getTotalNodeWidth() - (NODE_INPUT_WIDTH / 2);
      }
      hasBackEdges() {
          return (this.nodeLabel.opcode == "Loop") ||
              ((this.nodeLabel.opcode == "Phi" || this.nodeLabel.opcode == "EffectPhi" || this.nodeLabel.opcode == "InductionVariablePhi") &&
                  this.inputs[this.inputs.length - 1].source.nodeLabel.opcode == "Loop");
      }
  }
  const nodeToStr = (n) => "N" + n.id;

  // Copyright 2014 the V8 project authors. All rights reserved.
  const MINIMUM_EDGE_SEPARATION = 20;
  class Edge {
      constructor(target, index, source, type) {
          this.target = target;
          this.source = source;
          this.index = index;
          this.type = type;
          this.backEdgeNumber = 0;
          this.visible = false;
      }
      stringID() {
          return this.source.id + "," + this.index + "," + this.target.id;
      }
      isVisible() {
          return this.visible && this.source.visible && this.target.visible;
      }
      getInputHorizontalPosition(graph, showTypes) {
          if (this.backEdgeNumber > 0) {
              return graph.maxGraphNodeX + this.backEdgeNumber * MINIMUM_EDGE_SEPARATION;
          }
          const source = this.source;
          const target = this.target;
          const index = this.index;
          const inputX = target.x + target.getInputX(index);
          const inputApproach = target.getInputApproach(this.index);
          const outputApproach = source.getOutputApproach(showTypes);
          if (inputApproach > outputApproach) {
              return inputX;
          }
          else {
              const inputOffset = MINIMUM_EDGE_SEPARATION * (index + 1);
              return (target.x < source.x)
                  ? (target.x + target.getTotalNodeWidth() + inputOffset)
                  : (target.x - inputOffset);
          }
      }
      generatePath(graph, showTypes) {
          const target = this.target;
          const source = this.source;
          const inputX = target.x + target.getInputX(this.index);
          const arrowheadHeight = 7;
          const inputY = target.y - 2 * DEFAULT_NODE_BUBBLE_RADIUS - arrowheadHeight;
          const outputX = source.x + source.getOutputX();
          const outputY = source.y + source.getNodeHeight(showTypes) + DEFAULT_NODE_BUBBLE_RADIUS;
          let inputApproach = target.getInputApproach(this.index);
          const outputApproach = source.getOutputApproach(showTypes);
          const horizontalPos = this.getInputHorizontalPosition(graph, showTypes);
          let result = "M" + outputX + "," + outputY +
              "L" + outputX + "," + outputApproach +
              "L" + horizontalPos + "," + outputApproach;
          if (horizontalPos != inputX) {
              result += "L" + horizontalPos + "," + inputApproach;
          }
          else {
              if (inputApproach < outputApproach) {
                  inputApproach = outputApproach;
              }
          }
          result += "L" + inputX + "," + inputApproach +
              "L" + inputX + "," + inputY;
          return result;
      }
      isBackEdge() {
          return this.target.hasBackEdges() && (this.target.rank < this.source.rank);
      }
  }
  const edgeToStr = (e) => e.stringID();

  // Copyright 2015 the V8 project authors. All rights reserved.
  const DEFAULT_NODE_ROW_SEPARATION = 130;
  function newGraphOccupation(graph) {
      const isSlotFilled = [];
      let nodeOccupation = [];
      function slotToIndex(slot) {
          if (slot >= 0) {
              return slot * 2;
          }
          else {
              return slot * 2 + 1;
          }
      }
      function positionToSlot(pos) {
          return Math.floor(pos / NODE_INPUT_WIDTH);
      }
      function slotToLeftPosition(slot) {
          return slot * NODE_INPUT_WIDTH;
      }
      function findSpace(pos, width, direction) {
          const widthSlots = Math.floor((width + NODE_INPUT_WIDTH - 1) /
              NODE_INPUT_WIDTH);
          const currentSlot = positionToSlot(pos + width / 2);
          let currentScanSlot = currentSlot;
          let widthSlotsRemainingLeft = widthSlots;
          let widthSlotsRemainingRight = widthSlots;
          let slotsChecked = 0;
          while (true) {
              const mod = slotsChecked++ % 2;
              currentScanSlot = currentSlot + (mod ? -1 : 1) * (slotsChecked >> 1);
              if (!isSlotFilled[slotToIndex(currentScanSlot)]) {
                  if (mod) {
                      if (direction <= 0)
                          --widthSlotsRemainingLeft;
                  }
                  else {
                      if (direction >= 0)
                          --widthSlotsRemainingRight;
                  }
                  if (widthSlotsRemainingLeft == 0 ||
                      widthSlotsRemainingRight == 0 ||
                      (widthSlotsRemainingLeft + widthSlotsRemainingRight) == widthSlots &&
                          (widthSlots == slotsChecked)) {
                      if (mod) {
                          return [currentScanSlot, widthSlots];
                      }
                      else {
                          return [currentScanSlot - widthSlots + 1, widthSlots];
                      }
                  }
              }
              else {
                  if (mod) {
                      widthSlotsRemainingLeft = widthSlots;
                  }
                  else {
                      widthSlotsRemainingRight = widthSlots;
                  }
              }
          }
      }
      function setIndexRange(from, to, value) {
          if (to < from) {
              throw ("illegal slot range");
          }
          while (from <= to) {
              isSlotFilled[slotToIndex(from++)] = value;
          }
      }
      function occupySlotRange(from, to) {
          setIndexRange(from, to, true);
      }
      function clearSlotRange(from, to) {
          setIndexRange(from, to, false);
      }
      function occupyPositionRange(from, to) {
          occupySlotRange(positionToSlot(from), positionToSlot(to - 1));
      }
      function clearPositionRange(from, to) {
          clearSlotRange(positionToSlot(from), positionToSlot(to - 1));
      }
      function occupyPositionRangeWithMargin(from, to, margin) {
          const fromMargin = from - Math.floor(margin);
          const toMargin = to + Math.floor(margin);
          occupyPositionRange(fromMargin, toMargin);
      }
      function clearPositionRangeWithMargin(from, to, margin) {
          const fromMargin = from - Math.floor(margin);
          const toMargin = to + Math.floor(margin);
          clearPositionRange(fromMargin, toMargin);
      }
      const occupation = {
          occupyNodeInputs: function (node, showTypes) {
              for (let i = 0; i < node.inputs.length; ++i) {
                  if (node.inputs[i].isVisible()) {
                      const edge = node.inputs[i];
                      if (!edge.isBackEdge()) {
                          const horizontalPos = edge.getInputHorizontalPosition(graph, showTypes);
                          occupyPositionRangeWithMargin(horizontalPos, horizontalPos, NODE_INPUT_WIDTH / 2);
                      }
                  }
              }
          },
          occupyNode: function (node) {
              const getPlacementHint = function (n) {
                  let pos = 0;
                  let direction = -1;
                  let outputEdges = 0;
                  let inputEdges = 0;
                  for (const outputEdge of n.outputs) {
                      if (outputEdge.isVisible()) {
                          const output = outputEdge.target;
                          for (let l = 0; l < output.inputs.length; ++l) {
                              if (output.rank > n.rank) {
                                  const inputEdge = output.inputs[l];
                                  if (inputEdge.isVisible()) {
                                      ++inputEdges;
                                  }
                                  if (output.inputs[l].source == n) {
                                      pos += output.x + output.getInputX(l) + NODE_INPUT_WIDTH / 2;
                                      outputEdges++;
                                      if (l >= (output.inputs.length / 2)) {
                                          direction = 1;
                                      }
                                  }
                              }
                          }
                      }
                  }
                  if (outputEdges != 0) {
                      pos = pos / outputEdges;
                  }
                  if (outputEdges > 1 || inputEdges == 1) {
                      direction = 0;
                  }
                  return [direction, pos];
              };
              const width = node.getTotalNodeWidth();
              const margin = MINIMUM_EDGE_SEPARATION;
              const paddedWidth = width + 2 * margin;
              const placementHint = getPlacementHint(node);
              const x = placementHint[1] - paddedWidth + margin;
              const placement = findSpace(x, paddedWidth, placementHint[0]);
              const firstSlot = placement[0];
              const slotWidth = placement[1];
              const endSlotExclusive = firstSlot + slotWidth - 1;
              occupySlotRange(firstSlot, endSlotExclusive);
              nodeOccupation.push([firstSlot, endSlotExclusive]);
              if (placementHint[0] < 0) {
                  return slotToLeftPosition(firstSlot + slotWidth) - width - margin;
              }
              else if (placementHint[0] > 0) {
                  return slotToLeftPosition(firstSlot) + margin;
              }
              else {
                  return slotToLeftPosition(firstSlot + slotWidth / 2) - (width / 2);
              }
          },
          clearOccupiedNodes: function () {
              nodeOccupation.forEach(([firstSlot, endSlotExclusive]) => {
                  clearSlotRange(firstSlot, endSlotExclusive);
              });
              nodeOccupation = [];
          },
          clearNodeOutputs: function (source, showTypes) {
              source.outputs.forEach(function (edge) {
                  if (edge.isVisible()) {
                      const target = edge.target;
                      for (const inputEdge of target.inputs) {
                          if (inputEdge.source === source) {
                              const horizontalPos = edge.getInputHorizontalPosition(graph, showTypes);
                              clearPositionRangeWithMargin(horizontalPos, horizontalPos, NODE_INPUT_WIDTH / 2);
                          }
                      }
                  }
              });
          },
          print: function () {
              let s = "";
              for (let currentSlot = -40; currentSlot < 40; ++currentSlot) {
                  if (currentSlot != 0) {
                      s += " ";
                  }
                  else {
                      s += "|";
                  }
              }
              console.log(s);
              s = "";
              for (let currentSlot2 = -40; currentSlot2 < 40; ++currentSlot2) {
                  if (isSlotFilled[slotToIndex(currentSlot2)]) {
                      s += "*";
                  }
                  else {
                      s += " ";
                  }
              }
              console.log(s);
          }
      };
      return occupation;
  }
  function layoutNodeGraph(graph, showTypes) {
      // First determine the set of nodes that have no outputs. Those are the
      // basis for bottom-up DFS to determine rank and node placement.
      const start = performance.now();
      const endNodesHasNoOutputs = [];
      const startNodesHasNoInputs = [];
      for (const n of graph.nodes()) {
          endNodesHasNoOutputs[n.id] = true;
          startNodesHasNoInputs[n.id] = true;
      }
      graph.forEachEdge((e) => {
          endNodesHasNoOutputs[e.source.id] = false;
          startNodesHasNoInputs[e.target.id] = false;
      });
      // Finialize the list of start and end nodes.
      const endNodes = [];
      const startNodes = [];
      let visited = [];
      const rank = [];
      for (const n of graph.nodes()) {
          if (endNodesHasNoOutputs[n.id]) {
              endNodes.push(n);
          }
          if (startNodesHasNoInputs[n.id]) {
              startNodes.push(n);
          }
          visited[n.id] = false;
          rank[n.id] = -1;
          n.rank = 0;
          n.visitOrderWithinRank = 0;
          n.outputApproach = MINIMUM_NODE_OUTPUT_APPROACH;
      }
      let maxRank = 0;
      visited = [];
      let visitOrderWithinRank = 0;
      const worklist = startNodes.slice();
      while (worklist.length != 0) {
          const n = worklist.pop();
          let changed = false;
          if (n.rank == MAX_RANK_SENTINEL) {
              n.rank = 1;
              changed = true;
          }
          let begin = 0;
          let end = n.inputs.length;
          if (n.nodeLabel.opcode == 'Phi' ||
              n.nodeLabel.opcode == 'EffectPhi' ||
              n.nodeLabel.opcode == 'InductionVariablePhi') {
              // Keep with merge or loop node
              begin = n.inputs.length - 1;
          }
          else if (n.hasBackEdges()) {
              end = 1;
          }
          for (let l = begin; l < end; ++l) {
              const input = n.inputs[l].source;
              if (input.visible && input.rank >= n.rank) {
                  n.rank = input.rank + 1;
                  changed = true;
              }
          }
          if (changed) {
              const hasBackEdges = n.hasBackEdges();
              for (let l = n.outputs.length - 1; l >= 0; --l) {
                  if (hasBackEdges && (l != 0)) {
                      worklist.unshift(n.outputs[l].target);
                  }
                  else {
                      worklist.push(n.outputs[l].target);
                  }
              }
          }
          if (n.rank > maxRank) {
              maxRank = n.rank;
          }
      }
      visited = [];
      function dfsFindRankLate(n) {
          if (visited[n.id])
              return;
          visited[n.id] = true;
          const originalRank = n.rank;
          let newRank = n.rank;
          let isFirstInput = true;
          for (const outputEdge of n.outputs) {
              const output = outputEdge.target;
              dfsFindRankLate(output);
              const outputRank = output.rank;
              if (output.visible && (isFirstInput || outputRank <= newRank) &&
                  (outputRank > originalRank)) {
                  newRank = outputRank - 1;
              }
              isFirstInput = false;
          }
          if (n.nodeLabel.opcode != "Start" && n.nodeLabel.opcode != "Phi" && n.nodeLabel.opcode != "EffectPhi" && n.nodeLabel.opcode != "InductionVariablePhi") {
              n.rank = newRank;
          }
      }
      startNodes.forEach(dfsFindRankLate);
      visited = [];
      function dfsRankOrder(n) {
          if (visited[n.id])
              return;
          visited[n.id] = true;
          for (const outputEdge of n.outputs) {
              if (outputEdge.isVisible()) {
                  const output = outputEdge.target;
                  dfsRankOrder(output);
              }
          }
          if (n.visitOrderWithinRank == 0) {
              n.visitOrderWithinRank = ++visitOrderWithinRank;
          }
      }
      startNodes.forEach(dfsRankOrder);
      endNodes.forEach(function (n) {
          n.rank = maxRank + 1;
      });
      const rankSets = [];
      // Collect sets for each rank.
      for (const n of graph.nodes()) {
          n.y = n.rank * (DEFAULT_NODE_ROW_SEPARATION + n.getNodeHeight(showTypes) +
              2 * DEFAULT_NODE_BUBBLE_RADIUS);
          if (n.visible) {
              if (rankSets[n.rank] === undefined) {
                  rankSets[n.rank] = [n];
              }
              else {
                  rankSets[n.rank].push(n);
              }
          }
      }
      // Iterate backwards from highest to lowest rank, placing nodes so that they
      // spread out from the "center" as much as possible while still being
      // compact and not overlapping live input lines.
      const occupation = newGraphOccupation(graph);
      rankSets.reverse().forEach(function (rankSet) {
          for (const node of rankSet) {
              occupation.clearNodeOutputs(node, showTypes);
          }
          let placedCount = 0;
          rankSet = rankSet.sort((a, b) => {
              if (a.visitOrderWithinRank < b.visitOrderWithinRank) {
                  return -1;
              }
              else if (a.visitOrderWithinRank == b.visitOrderWithinRank) {
                  return 0;
              }
              else {
                  return 1;
              }
          });
          for (const nodeToPlace of rankSet) {
              if (nodeToPlace.visible) {
                  nodeToPlace.x = occupation.occupyNode(nodeToPlace);
                  const staggeredFlooredI = Math.floor(placedCount++ % 3);
                  const delta = MINIMUM_EDGE_SEPARATION * staggeredFlooredI;
                  nodeToPlace.outputApproach += delta;
              }
              else {
                  nodeToPlace.x = 0;
              }
          }
          occupation.clearOccupiedNodes();
          for (const node of rankSet) {
              occupation.occupyNodeInputs(node, showTypes);
          }
      });
      graph.maxBackEdgeNumber = 0;
      graph.forEachEdge((e) => {
          if (e.isBackEdge()) {
              e.backEdgeNumber = ++graph.maxBackEdgeNumber;
          }
          else {
              e.backEdgeNumber = 0;
          }
      });
  }

  class Graph {
      constructor(data) {
          this.nodeMap = [];
          this.minGraphX = 0;
          this.maxGraphX = 1;
          this.minGraphY = 0;
          this.maxGraphY = 1;
          this.width = 1;
          this.height = 1;
          data.nodes.forEach((jsonNode) => {
              this.nodeMap[jsonNode.id] = new GNode(jsonNode.nodeLabel);
          });
          data.edges.forEach((e) => {
              const t = this.nodeMap[e.target];
              const s = this.nodeMap[e.source];
              const newEdge = new Edge(t, e.index, s, e.type);
              t.inputs.push(newEdge);
              s.outputs.push(newEdge);
              if (e.type == 'control') {
                  // Every source of a control edge is a CFG node.
                  s.cfg = true;
              }
          });
      }
      *nodes(p = (n) => true) {
          for (const node of this.nodeMap) {
              if (!node || !p(node))
                  continue;
              yield node;
          }
      }
      *filteredEdges(p) {
          for (const node of this.nodes()) {
              for (const edge of node.inputs) {
                  if (p(edge))
                      yield edge;
              }
          }
      }
      forEachEdge(p) {
          for (const node of this.nodeMap) {
              if (!node)
                  continue;
              for (const edge of node.inputs) {
                  p(edge);
              }
          }
      }
      redetermineGraphBoundingBox(showTypes) {
          this.minGraphX = 0;
          this.maxGraphNodeX = 1;
          this.maxGraphX = undefined; // see below
          this.minGraphY = 0;
          this.maxGraphY = 1;
          for (const node of this.nodes()) {
              if (!node.visible) {
                  continue;
              }
              if (node.x < this.minGraphX) {
                  this.minGraphX = node.x;
              }
              if ((node.x + node.getTotalNodeWidth()) > this.maxGraphNodeX) {
                  this.maxGraphNodeX = node.x + node.getTotalNodeWidth();
              }
              if ((node.y - 50) < this.minGraphY) {
                  this.minGraphY = node.y - 50;
              }
              if ((node.y + node.getNodeHeight(showTypes) + 50) > this.maxGraphY) {
                  this.maxGraphY = node.y + node.getNodeHeight(showTypes) + 50;
              }
          }
          this.maxGraphX = this.maxGraphNodeX +
              this.maxBackEdgeNumber * MINIMUM_EDGE_SEPARATION;
          this.width = this.maxGraphX - this.minGraphX;
          this.height = this.maxGraphY - this.minGraphY;
          const extent = [
              [this.minGraphX - this.width / 2, this.minGraphY - this.height / 2],
              [this.maxGraphX + this.width / 2, this.maxGraphY + this.height / 2]
          ];
          return extent;
      }
  }

  // Copyright 2015 the V8 project authors. All rights reserved.
  function nodeToStringKey(n) {
      return "" + n.id;
  }
  class GraphView extends PhaseView {
      createViewElement() {
          const pane = document.createElement('div');
          pane.setAttribute('id', "graph");
          return pane;
      }
      constructor(idOrContainer, broker, showPhaseByName, toolbox) {
          super(idOrContainer);
          const view = this;
          this.broker = broker;
          this.showPhaseByName = showPhaseByName;
          this.divElement = select(this.divNode);
          this.phaseName = "";
          this.toolbox = toolbox;
          const svg$$1 = this.divElement.append("svg")
              .attr('version', '2.0')
              .attr("width", "100%")
              .attr("height", "100%");
          svg$$1.on("click", function (d) {
              view.selectionHandler.clear();
          });
          // Listen for key events. Note that the focus handler seems
          // to be important even if it does nothing.
          svg$$1
              .attr("focusable", false)
              .on("focus", e => { })
              .on("keydown", e => { view.svgKeyDown(); });
          view.svg = svg$$1;
          this.state = {
              selection: null,
              mouseDownNode: null,
              justDragged: false,
              justScaleTransGraph: false,
              showTypes: false,
              hideDead: false
          };
          this.selectionHandler = {
              clear: function () {
                  view.state.selection.clear();
                  broker.broadcastClear(this);
                  view.updateGraphVisibility();
              },
              select: function (nodes, selected) {
                  const locations = [];
                  for (const node of nodes) {
                      if (node.nodeLabel.sourcePosition) {
                          locations.push(node.nodeLabel.sourcePosition);
                      }
                      if (node.nodeLabel.origin && node.nodeLabel.origin.bytecodePosition) {
                          locations.push({ bytecodePosition: node.nodeLabel.origin.bytecodePosition });
                      }
                  }
                  view.state.selection.select(nodes, selected);
                  broker.broadcastSourcePositionSelect(this, locations, selected);
                  view.updateGraphVisibility();
              },
              brokeredNodeSelect: function (locations, selected) {
                  if (!view.graph)
                      return;
                  const selection$$1 = view.graph.nodes(n => {
                      return locations.has(nodeToStringKey(n))
                          && (!view.state.hideDead || n.isLive());
                  });
                  view.state.selection.select(selection$$1, selected);
                  // Update edge visibility based on selection.
                  for (const n of view.graph.nodes()) {
                      if (view.state.selection.isSelected(n)) {
                          n.visible = true;
                          n.inputs.forEach(e => {
                              e.visible = e.visible || view.state.selection.isSelected(e.source);
                          });
                          n.outputs.forEach(e => {
                              e.visible = e.visible || view.state.selection.isSelected(e.target);
                          });
                      }
                  }
                  view.updateGraphVisibility();
              },
              brokeredClear: function () {
                  view.state.selection.clear();
                  view.updateGraphVisibility();
              }
          };
          view.state.selection = new MySelection(nodeToStringKey);
          const defs = svg$$1.append('svg:defs');
          defs.append('svg:marker')
              .attr('id', 'end-arrow')
              .attr('viewBox', '0 -4 8 8')
              .attr('refX', 2)
              .attr('markerWidth', 2.5)
              .attr('markerHeight', 2.5)
              .attr('orient', 'auto')
              .append('svg:path')
              .attr('d', 'M0,-4L8,0L0,4');
          this.graphElement = svg$$1.append("g");
          view.visibleEdges = this.graphElement.append("g");
          view.visibleNodes = this.graphElement.append("g");
          view.drag = drag()
              .on("drag", function (d) {
              d.x += event.dx;
              d.y += event.dy;
              view.updateGraphVisibility();
          });
          function zoomed() {
              if (event.shiftKey)
                  return false;
              view.graphElement.attr("transform", event.transform);
              return true;
          }
          const zoomSvg = zoom()
              .scaleExtent([0.2, 40])
              .on("zoom", zoomed)
              .on("start", function () {
              if (event.shiftKey)
                  return;
              select('body').style("cursor", "move");
          })
              .on("end", function () {
              select('body').style("cursor", "auto");
          });
          svg$$1.call(zoomSvg).on("dblclick.zoom", null);
          view.panZoom = zoomSvg;
      }
      getEdgeFrontier(nodes, inEdges, edgeFilter) {
          const frontier = new Set();
          for (const n of nodes) {
              const edges = inEdges ? n.inputs : n.outputs;
              let edgeNumber = 0;
              edges.forEach((edge) => {
                  if (edgeFilter == undefined || edgeFilter(edge, edgeNumber)) {
                      frontier.add(edge);
                  }
                  ++edgeNumber;
              });
          }
          return frontier;
      }
      getNodeFrontier(nodes, inEdges, edgeFilter) {
          const view = this;
          const frontier = new Set();
          let newState = true;
          const edgeFrontier = view.getEdgeFrontier(nodes, inEdges, edgeFilter);
          // Control key toggles edges rather than just turning them on
          if (event.ctrlKey) {
              edgeFrontier.forEach(function (edge) {
                  if (edge.visible) {
                      newState = false;
                  }
              });
          }
          edgeFrontier.forEach(function (edge) {
              edge.visible = newState;
              if (newState) {
                  const node = inEdges ? edge.source : edge.target;
                  node.visible = true;
                  frontier.add(node);
              }
          });
          view.updateGraphVisibility();
          if (newState) {
              return frontier;
          }
          else {
              return undefined;
          }
      }
      initializeContent(data, rememberedSelection) {
          this.show();
          function createImgInput(id, title, onClick) {
              const input = document.createElement("input");
              input.setAttribute("id", id);
              input.setAttribute("type", "image");
              input.setAttribute("title", title);
              input.setAttribute("src", `img/${id}-icon.png`);
              input.className = "button-input graph-toolbox-item";
              input.addEventListener("click", onClick);
              return input;
          }
          this.toolbox.appendChild(createImgInput("layout", "layout graph", partial(this.layoutAction, this)));
          this.toolbox.appendChild(createImgInput("show-all", "show all nodes", partial(this.showAllAction, this)));
          this.toolbox.appendChild(createImgInput("show-control", "show all nodes", partial(this.showControlAction, this)));
          this.toolbox.appendChild(createImgInput("toggle-hide-dead", "show only live nodes", partial(this.toggleHideDead, this)));
          this.toolbox.appendChild(createImgInput("hide-unselected", "show only live nodes", partial(this.hideUnselectedAction, this)));
          this.toolbox.appendChild(createImgInput("hide-selected", "show only live nodes", partial(this.hideSelectedAction, this)));
          this.toolbox.appendChild(createImgInput("zoom-selection", "show only live nodes", partial(this.zoomSelectionAction, this)));
          this.toolbox.appendChild(createImgInput("toggle-types", "show only live nodes", partial(this.toggleTypesAction, this)));
          this.phaseName = data.name;
          this.createGraph(data.data, rememberedSelection);
          this.broker.addNodeHandler(this.selectionHandler);
          if (rememberedSelection != null && rememberedSelection.size > 0) {
              this.attachSelection(rememberedSelection);
              this.connectVisibleSelectedNodes();
              this.viewSelection();
          }
          else {
              this.viewWholeGraph();
          }
      }
      deleteContent() {
          for (const item of this.toolbox.querySelectorAll(".graph-toolbox-item")) {
              item.parentElement.removeChild(item);
          }
          for (const n of this.graph.nodes()) {
              n.visible = false;
          }
          this.graph.forEachEdge((e) => {
              e.visible = false;
          });
          this.updateGraphVisibility();
      }
      hide() {
          super.hide();
          this.deleteContent();
      }
      createGraph(data, rememberedSelection) {
          this.graph = new Graph(data);
          this.showControlAction(this);
          if (rememberedSelection != undefined) {
              for (const n of this.graph.nodes()) {
                  n.visible = n.visible || rememberedSelection.has(nodeToStringKey(n));
              }
          }
          this.graph.forEachEdge(e => e.visible = e.source.visible && e.target.visible);
          this.layoutGraph();
          this.updateGraphVisibility();
      }
      connectVisibleSelectedNodes() {
          const view = this;
          for (const n of view.state.selection) {
              n.inputs.forEach(function (edge) {
                  if (edge.source.visible && edge.target.visible) {
                      edge.visible = true;
                  }
              });
              n.outputs.forEach(function (edge) {
                  if (edge.source.visible && edge.target.visible) {
                      edge.visible = true;
                  }
              });
          }
      }
      updateInputAndOutputBubbles() {
          const view = this;
          const g = this.graph;
          const s = this.visibleBubbles;
          s.classed("filledBubbleStyle", function (c) {
              const components = this.id.split(',');
              if (components[0] == "ib") {
                  const edge = g.nodeMap[components[3]].inputs[components[2]];
                  return edge.isVisible();
              }
              else {
                  return g.nodeMap[components[1]].areAnyOutputsVisible() == 2;
              }
          }).classed("halfFilledBubbleStyle", function (c) {
              const components = this.id.split(',');
              if (components[0] == "ib") {
                  return false;
              }
              else {
                  return g.nodeMap[components[1]].areAnyOutputsVisible() == 1;
              }
          }).classed("bubbleStyle", function (c) {
              const components = this.id.split(',');
              if (components[0] == "ib") {
                  const edge = g.nodeMap[components[3]].inputs[components[2]];
                  return !edge.isVisible();
              }
              else {
                  return g.nodeMap[components[1]].areAnyOutputsVisible() == 0;
              }
          });
          s.each(function (c) {
              const components = this.id.split(',');
              if (components[0] == "ob") {
                  const from = g.nodeMap[components[1]];
                  const x = from.getOutputX();
                  const y = from.getNodeHeight(view.state.showTypes) + DEFAULT_NODE_BUBBLE_RADIUS;
                  const transform$$1 = "translate(" + x + "," + y + ")";
                  this.setAttribute('transform', transform$$1);
              }
          });
      }
      attachSelection(s) {
          if (!(s instanceof Set))
              return;
          this.selectionHandler.clear();
          const selected = [...this.graph.nodes(n => s.has(this.state.selection.stringKey(n)) && (!this.state.hideDead || n.isLive()))];
          this.selectionHandler.select(selected, true);
      }
      detachSelection() {
          return this.state.selection.detachSelection();
      }
      selectAllNodes() {
          if (!event.shiftKey) {
              this.state.selection.clear();
          }
          const allVisibleNodes = [...this.graph.nodes(n => n.visible)];
          this.state.selection.select(allVisibleNodes, true);
          this.updateGraphVisibility();
      }
      layoutAction(graph) {
          graph.layoutGraph();
          graph.updateGraphVisibility();
          graph.viewWholeGraph();
      }
      showAllAction(view) {
          for (const n of view.graph.nodes()) {
              n.visible = !view.state.hideDead || n.isLive();
          }
          view.graph.forEachEdge((e) => {
              e.visible = e.source.visible || e.target.visible;
          });
          view.updateGraphVisibility();
          view.viewWholeGraph();
      }
      showControlAction(view) {
          for (const n of view.graph.nodes()) {
              n.visible = n.cfg && (!view.state.hideDead || n.isLive());
          }
          view.graph.forEachEdge((e) => {
              e.visible = e.type == 'control' && e.source.visible && e.target.visible;
          });
          view.updateGraphVisibility();
          view.viewWholeGraph();
      }
      toggleHideDead(view) {
          view.state.hideDead = !view.state.hideDead;
          if (view.state.hideDead)
              view.hideDead();
          const element = document.getElementById('toggle-hide-dead');
          element.classList.toggle('button-input-toggled', view.state.hideDead);
      }
      hideDead() {
          for (const n of this.graph.nodes()) {
              if (!n.isLive()) {
                  n.visible = false;
                  this.state.selection.select([n], false);
              }
          }
          this.updateGraphVisibility();
      }
      hideUnselectedAction(view) {
          for (const n of view.graph.nodes()) {
              if (!view.state.selection.isSelected(n)) {
                  n.visible = false;
              }
          }
          view.updateGraphVisibility();
      }
      hideSelectedAction(view) {
          for (const n of view.graph.nodes()) {
              if (view.state.selection.isSelected(n)) {
                  n.visible = false;
              }
          }
          view.selectionHandler.clear();
      }
      zoomSelectionAction(view) {
          view.viewSelection();
      }
      toggleTypesAction(view) {
          view.toggleTypes();
      }
      searchInputAction(searchBar, e, onlyVisible) {
          if (e.keyCode == 13) {
              this.selectionHandler.clear();
              const query = searchBar.value;
              window.sessionStorage.setItem("lastSearch", query);
              if (query.length == 0)
                  return;
              const reg = new RegExp(query);
              const filterFunction = (n) => {
                  return (reg.exec(n.getDisplayLabel()) != null ||
                      (this.state.showTypes && reg.exec(n.getDisplayType())) ||
                      (reg.exec(n.getTitle())) ||
                      reg.exec(n.nodeLabel.opcode) != null);
              };
              const selection$$1 = [...this.graph.nodes(n => {
                      if ((e.ctrlKey || n.visible || !onlyVisible) && filterFunction(n)) {
                          if (e.ctrlKey || !onlyVisible)
                              n.visible = true;
                          return true;
                      }
                      return false;
                  })];
              this.selectionHandler.select(selection$$1, true);
              this.connectVisibleSelectedNodes();
              this.updateGraphVisibility();
              searchBar.blur();
              this.viewSelection();
          }
          e.stopPropagation();
      }
      svgKeyDown() {
          const view = this;
          const state = this.state;
          const showSelectionFrontierNodes = (inEdges, filter, doSelect) => {
              const frontier = view.getNodeFrontier(state.selection, inEdges, filter);
              if (frontier != undefined && frontier.size) {
                  if (doSelect) {
                      if (!event.shiftKey) {
                          state.selection.clear();
                      }
                      state.selection.select([...frontier], true);
                  }
                  view.updateGraphVisibility();
              }
          };
          let eventHandled = true; // unless the below switch defaults
          switch (event.keyCode) {
              case 49:
              case 50:
              case 51:
              case 52:
              case 53:
              case 54:
              case 55:
              case 56:
              case 57:
                  // '1'-'9'
                  showSelectionFrontierNodes(true, (edge, index) => index == (event.keyCode - 49), !event.ctrlKey);
                  break;
              case 97:
              case 98:
              case 99:
              case 100:
              case 101:
              case 102:
              case 103:
              case 104:
              case 105:
                  // 'numpad 1'-'numpad 9'
                  showSelectionFrontierNodes(true, (edge, index) => index == (event.keyCode - 97), !event.ctrlKey);
                  break;
              case 67:
                  // 'c'
                  showSelectionFrontierNodes(event.altKey, (edge, index) => edge.type == 'control', true);
                  break;
              case 69:
                  // 'e'
                  showSelectionFrontierNodes(event.altKey, (edge, index) => edge.type == 'effect', true);
                  break;
              case 79:
                  // 'o'
                  showSelectionFrontierNodes(false, undefined, false);
                  break;
              case 73:
                  // 'i'
                  if (!event.ctrlKey && !event.shiftKey) {
                      showSelectionFrontierNodes(true, undefined, false);
                  }
                  else {
                      eventHandled = false;
                  }
                  break;
              case 65:
                  // 'a'
                  view.selectAllNodes();
                  break;
              case 38:
              // UP
              case 40: {
                  // DOWN
                  showSelectionFrontierNodes(event.keyCode == 38, undefined, true);
                  break;
              }
              case 82:
                  // 'r'
                  if (!event.ctrlKey && !event.shiftKey) {
                      this.layoutAction(this);
                  }
                  else {
                      eventHandled = false;
                  }
                  break;
              case 83:
                  // 's'
                  view.selectOrigins();
                  break;
              default:
                  eventHandled = false;
                  break;
          }
          if (eventHandled) {
              event.preventDefault();
          }
      }
      layoutGraph() {
          console.time("layoutGraph");
          layoutNodeGraph(this.graph, this.state.showTypes);
          const extent$$1 = this.graph.redetermineGraphBoundingBox(this.state.showTypes);
          this.panZoom.translateExtent(extent$$1);
          this.minScale();
          console.timeEnd("layoutGraph");
      }
      selectOrigins() {
          const state = this.state;
          const origins = [];
          let phase = this.phaseName;
          const selection$$1 = new Set();
          for (const n of state.selection) {
              const origin = n.nodeLabel.origin;
              if (origin) {
                  phase = origin.phase;
                  const node = this.graph.nodeMap[origin.nodeId];
                  if (phase === this.phaseName && node) {
                      origins.push(node);
                  }
                  else {
                      selection$$1.add(`${origin.nodeId}`);
                  }
              }
          }
          // Only go through phase reselection if we actually need
          // to display another phase.
          if (selection$$1.size > 0 && phase !== this.phaseName) {
              this.showPhaseByName(phase, selection$$1);
          }
          else if (origins.length > 0) {
              this.selectionHandler.clear();
              this.selectionHandler.select(origins, true);
          }
      }
      // call to propagate changes to graph
      updateGraphVisibility() {
          const view = this;
          const graph = this.graph;
          const state = this.state;
          if (!graph)
              return;
          const filteredEdges = [...graph.filteredEdges(function (e) {
                  return e.source.visible && e.target.visible;
              })];
          const selEdges = view.visibleEdges.selectAll("path").data(filteredEdges, edgeToStr);
          // remove old links
          selEdges.exit().remove();
          // add new paths
          const newEdges = selEdges.enter()
              .append('path');
          newEdges.style('marker-end', 'url(#end-arrow)')
              .attr("id", function (edge) { return "e," + edge.stringID(); })
              .on("click", function (edge) {
              event.stopPropagation();
              if (!event.shiftKey) {
                  view.selectionHandler.clear();
              }
              view.selectionHandler.select([edge.source, edge.target], true);
          })
              .attr("adjacentToHover", "false")
              .classed('value', function (e) {
              return e.type == 'value' || e.type == 'context';
          }).classed('control', function (e) {
              return e.type == 'control';
          }).classed('effect', function (e) {
              return e.type == 'effect';
          }).classed('frame-state', function (e) {
              return e.type == 'frame-state';
          }).attr('stroke-dasharray', function (e) {
              if (e.type == 'frame-state')
                  return "10,10";
              return (e.type == 'effect') ? "5,5" : "";
          });
          const newAndOldEdges = newEdges.merge(selEdges);
          newAndOldEdges.classed('hidden', e => !e.isVisible());
          // select existing nodes
          const filteredNodes = [...graph.nodes(n => n.visible)];
          const allNodes = view.visibleNodes.selectAll("g");
          const selNodes = allNodes.data(filteredNodes, nodeToStr);
          // remove old nodes
          selNodes.exit().remove();
          // add new nodes
          const newGs = selNodes.enter()
              .append("g");
          newGs.classed("turbonode", function (n) { return true; })
              .classed("control", function (n) { return n.isControl(); })
              .classed("live", function (n) { return n.isLive(); })
              .classed("dead", function (n) { return !n.isLive(); })
              .classed("javascript", function (n) { return n.isJavaScript(); })
              .classed("input", function (n) { return n.isInput(); })
              .classed("simplified", function (n) { return n.isSimplified(); })
              .classed("machine", function (n) { return n.isMachine(); })
              .on('mouseenter', function (node) {
              const visibleEdges = view.visibleEdges.selectAll('path');
              const adjInputEdges = visibleEdges.filter(e => e.target === node);
              const adjOutputEdges = visibleEdges.filter(e => e.source === node);
              adjInputEdges.attr('relToHover', "input");
              adjOutputEdges.attr('relToHover', "output");
              const adjInputNodes = adjInputEdges.data().map(e => e.source);
              const visibleNodes = view.visibleNodes.selectAll("g");
              visibleNodes.data(adjInputNodes, nodeToStr).attr('relToHover', "input");
              const adjOutputNodes = adjOutputEdges.data().map(e => e.target);
              visibleNodes.data(adjOutputNodes, nodeToStr).attr('relToHover', "output");
              view.updateGraphVisibility();
          })
              .on('mouseleave', function (node) {
              const visibleEdges = view.visibleEdges.selectAll('path');
              const adjEdges = visibleEdges.filter(e => e.target === node || e.source === node);
              adjEdges.attr('relToHover', "none");
              const adjNodes = adjEdges.data().map(e => e.target).concat(adjEdges.data().map(e => e.source));
              const visibleNodes = view.visibleNodes.selectAll("g");
              visibleNodes.data(adjNodes, nodeToStr).attr('relToHover', "none");
              view.updateGraphVisibility();
          })
              .on("click", d => {
              if (!event.shiftKey)
                  view.selectionHandler.clear();
              view.selectionHandler.select([d], undefined);
              event.stopPropagation();
          })
              .call(view.drag);
          newGs.append("rect")
              .attr("rx", 10)
              .attr("ry", 10)
              .attr('width', function (d) {
              return d.getTotalNodeWidth();
          })
              .attr('height', function (d) {
              return d.getNodeHeight(view.state.showTypes);
          });
          function appendInputAndOutputBubbles(g, d) {
              for (let i = 0; i < d.inputs.length; ++i) {
                  const x = d.getInputX(i);
                  const y = -DEFAULT_NODE_BUBBLE_RADIUS;
                  g.append('circle')
                      .classed("filledBubbleStyle", function (c) {
                      return d.inputs[i].isVisible();
                  })
                      .classed("bubbleStyle", function (c) {
                      return !d.inputs[i].isVisible();
                  })
                      .attr("id", "ib," + d.inputs[i].stringID())
                      .attr("r", DEFAULT_NODE_BUBBLE_RADIUS)
                      .attr("transform", function (d) {
                      return "translate(" + x + "," + y + ")";
                  })
                      .on("click", function (d) {
                      const components = this.id.split(',');
                      const node = graph.nodeMap[components[3]];
                      const edge = node.inputs[components[2]];
                      const visible = !edge.isVisible();
                      node.setInputVisibility(components[2], visible);
                      event.stopPropagation();
                      view.updateGraphVisibility();
                  });
              }
              if (d.outputs.length != 0) {
                  const x = d.getOutputX();
                  const y = d.getNodeHeight(view.state.showTypes) + DEFAULT_NODE_BUBBLE_RADIUS;
                  g.append('circle')
                      .classed("filledBubbleStyle", function (c) {
                      return d.areAnyOutputsVisible() == 2;
                  })
                      .classed("halFilledBubbleStyle", function (c) {
                      return d.areAnyOutputsVisible() == 1;
                  })
                      .classed("bubbleStyle", function (c) {
                      return d.areAnyOutputsVisible() == 0;
                  })
                      .attr("id", "ob," + d.id)
                      .attr("r", DEFAULT_NODE_BUBBLE_RADIUS)
                      .attr("transform", function (d) {
                      return "translate(" + x + "," + y + ")";
                  })
                      .on("click", function (d) {
                      d.setOutputVisibility(d.areAnyOutputsVisible() == 0);
                      event.stopPropagation();
                      view.updateGraphVisibility();
                  });
              }
          }
          newGs.each(function (d) {
              appendInputAndOutputBubbles(select(this), d);
          });
          newGs.each(function (d) {
              select(this).append("text")
                  .classed("label", true)
                  .attr("text-anchor", "right")
                  .attr("dx", 5)
                  .attr("dy", 5)
                  .append('tspan')
                  .text(function (l) {
                  return d.getDisplayLabel();
              })
                  .append("title")
                  .text(function (l) {
                  return d.getTitle();
              });
              if (d.nodeLabel.type != undefined) {
                  select(this).append("text")
                      .classed("label", true)
                      .classed("type", true)
                      .attr("text-anchor", "right")
                      .attr("dx", 5)
                      .attr("dy", d.labelbbox.height + 5)
                      .append('tspan')
                      .text(function (l) {
                      return d.getDisplayType();
                  })
                      .append("title")
                      .text(function (l) {
                      return d.getType();
                  });
              }
          });
          const newAndOldNodes = newGs.merge(selNodes);
          newAndOldNodes.select('.type').each(function (d) {
              this.setAttribute('visibility', view.state.showTypes ? 'visible' : 'hidden');
          });
          newAndOldNodes
              .classed("selected", function (n) {
              if (state.selection.isSelected(n))
                  return true;
              return false;
          })
              .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; })
              .select('rect')
              .attr('height', function (d) { return d.getNodeHeight(view.state.showTypes); });
          view.visibleBubbles = selectAll('circle');
          view.updateInputAndOutputBubbles();
          graph.maxGraphX = graph.maxGraphNodeX;
          newAndOldEdges.attr("d", function (edge) {
              return edge.generatePath(graph, view.state.showTypes);
          });
      }
      getSvgViewDimensions() {
          return [this.container.clientWidth, this.container.clientHeight];
      }
      getSvgExtent() {
          return [[0, 0], [this.container.clientWidth, this.container.clientHeight]];
      }
      minScale() {
          const dimensions = this.getSvgViewDimensions();
          const minXScale = dimensions[0] / (2 * this.graph.width);
          const minYScale = dimensions[1] / (2 * this.graph.height);
          const minScale = Math.min(minXScale, minYScale);
          this.panZoom.scaleExtent([minScale, 40]);
          return minScale;
      }
      onresize() {
          const trans = transform$1(this.svg.node());
          const ctrans = this.panZoom.constrain()(trans, this.getSvgExtent(), this.panZoom.translateExtent());
          this.panZoom.transform(this.svg, ctrans);
      }
      toggleTypes() {
          const view = this;
          view.state.showTypes = !view.state.showTypes;
          const element = document.getElementById('toggle-types');
          element.classList.toggle('button-input-toggled', view.state.showTypes);
          view.updateGraphVisibility();
      }
      viewSelection() {
          const view = this;
          let minX;
          let maxX;
          let minY;
          let maxY;
          let hasSelection = false;
          view.visibleNodes.selectAll("g").each(function (n) {
              if (view.state.selection.isSelected(n)) {
                  hasSelection = true;
                  minX = minX ? Math.min(minX, n.x) : n.x;
                  maxX = maxX ? Math.max(maxX, n.x + n.getTotalNodeWidth()) :
                      n.x + n.getTotalNodeWidth();
                  minY = minY ? Math.min(minY, n.y) : n.y;
                  maxY = maxY ? Math.max(maxY, n.y + n.getNodeHeight(view.state.showTypes)) :
                      n.y + n.getNodeHeight(view.state.showTypes);
              }
          });
          if (hasSelection) {
              view.viewGraphRegion(minX - NODE_INPUT_WIDTH, minY - 60, maxX + NODE_INPUT_WIDTH, maxY + 60);
          }
      }
      viewGraphRegion(minX, minY, maxX, maxY) {
          const [width, height] = this.getSvgViewDimensions();
          const dx = maxX - minX;
          const dy = maxY - minY;
          const x = (minX + maxX) / 2;
          const y = (minY + maxY) / 2;
          const scale = Math.min(width / (1.1 * dx), height / (1.1 * dy));
          this.svg
              .transition().duration(300).call(this.panZoom.translateTo, x, y)
              .transition().duration(300).call(this.panZoom.scaleTo, scale)
              .transition().duration(300).call(this.panZoom.translateTo, x, y);
      }
      viewWholeGraph() {
          this.panZoom.scaleTo(this.svg, 0);
          this.panZoom.translateTo(this.svg, this.graph.minGraphX + this.graph.width / 2, this.graph.minGraphY + this.graph.height / 2);
      }
  }

  // Copyright 2015 the V8 project authors. All rights reserved.
  class ScheduleView extends TextView {
      createViewElement() {
          const pane = document.createElement('div');
          pane.setAttribute('id', "schedule");
          return pane;
      }
      constructor(parentId, broker) {
          super(parentId, broker);
          this.sourceResolver = broker.sourceResolver;
      }
      attachSelection(s) {
          const view = this;
          if (!(s instanceof Set))
              return;
          view.selectionHandler.clear();
          view.blockSelectionHandler.clear();
          const selected = new Array();
          for (const key of s)
              selected.push(key);
          view.selectionHandler.select(selected, true);
      }
      detachSelection() {
          this.blockSelection.clear();
          return this.selection.detachSelection();
      }
      initializeContent(data, rememberedSelection) {
          this.divNode.innerHTML = '';
          this.schedule = data.schedule;
          this.addBlocks(data.schedule.blocks);
          this.attachSelection(rememberedSelection);
          this.show();
      }
      createElementFromString(htmlString) {
          const div = document.createElement('div');
          div.innerHTML = htmlString.trim();
          return div.firstChild;
      }
      elementForBlock(block) {
          const view = this;
          function createElement(tag, cls, content) {
              const el = document.createElement(tag);
              el.className = cls;
              if (content != undefined)
                  el.innerHTML = content;
              return el;
          }
          function mkNodeLinkHandler(nodeId) {
              return function (e) {
                  e.stopPropagation();
                  if (!e.shiftKey) {
                      view.selectionHandler.clear();
                  }
                  view.selectionHandler.select([nodeId], true);
              };
          }
          function getMarker(start, end) {
              if (start != end) {
                  return ["&#8857;", `This node generated instructions in range [${start},${end}). ` +
                          `This is currently unreliable for constants.`];
              }
              if (start != -1) {
                  return ["&#183;", `The instruction selector did not generate instructions ` +
                          `for this node, but processed the node at instruction ${start}. ` +
                          `This usually means that this node was folded into another node; ` +
                          `the highlighted machine code is a guess.`];
              }
              return ["", `This not is not in the final schedule.`];
          }
          function createElementForNode(node) {
              const nodeEl = createElement("div", "node");
              const [start, end] = view.sourceResolver.getInstruction(node.id);
              const [marker, tooltip] = getMarker(start, end);
              const instrMarker = createElement("div", "instr-marker com", marker);
              instrMarker.setAttribute("title", tooltip);
              instrMarker.onclick = mkNodeLinkHandler(node.id);
              nodeEl.appendChild(instrMarker);
              const nodeId = createElement("div", "node-id tag clickable", node.id);
              nodeId.onclick = mkNodeLinkHandler(node.id);
              view.addHtmlElementForNodeId(node.id, nodeId);
              nodeEl.appendChild(nodeId);
              const nodeLabel = createElement("div", "node-label", node.label);
              nodeEl.appendChild(nodeLabel);
              if (node.inputs.length > 0) {
                  const nodeParameters = createElement("div", "parameter-list comma-sep-list");
                  for (const param of node.inputs) {
                      const paramEl = createElement("div", "parameter tag clickable", param);
                      nodeParameters.appendChild(paramEl);
                      paramEl.onclick = mkNodeLinkHandler(param);
                      view.addHtmlElementForNodeId(param, paramEl);
                  }
                  nodeEl.appendChild(nodeParameters);
              }
              return nodeEl;
          }
          function mkBlockLinkHandler(blockId) {
              return function (e) {
                  e.stopPropagation();
                  if (!e.shiftKey) {
                      view.blockSelectionHandler.clear();
                  }
                  view.blockSelectionHandler.select(["" + blockId], true);
              };
          }
          const scheduleBlock = createElement("div", "schedule-block");
          scheduleBlock.classList.toggle("deferred", block.isDeferred);
          const [start, end] = view.sourceResolver.getInstructionRangeForBlock(block.id);
          const instrMarker = createElement("div", "instr-marker com", "&#8857;");
          instrMarker.setAttribute("title", `Instructions range for this block is [${start}, ${end})`);
          instrMarker.onclick = mkBlockLinkHandler(block.id);
          scheduleBlock.appendChild(instrMarker);
          const blockId = createElement("div", "block-id com clickable", block.id);
          blockId.onclick = mkBlockLinkHandler(block.id);
          scheduleBlock.appendChild(blockId);
          const blockPred = createElement("div", "predecessor-list block-list comma-sep-list");
          for (const pred of block.pred) {
              const predEl = createElement("div", "block-id com clickable", pred);
              predEl.onclick = mkBlockLinkHandler(pred);
              blockPred.appendChild(predEl);
          }
          if (block.pred.length)
              scheduleBlock.appendChild(blockPred);
          const nodes = createElement("div", "nodes");
          for (const node of block.nodes) {
              nodes.appendChild(createElementForNode(node));
          }
          scheduleBlock.appendChild(nodes);
          const blockSucc = createElement("div", "successor-list block-list comma-sep-list");
          for (const succ of block.succ) {
              const succEl = createElement("div", "block-id com clickable", succ);
              succEl.onclick = mkBlockLinkHandler(succ);
              blockSucc.appendChild(succEl);
          }
          if (block.succ.length)
              scheduleBlock.appendChild(blockSucc);
          this.addHtmlElementForBlockId(block.id, scheduleBlock);
          return scheduleBlock;
      }
      addBlocks(blocks) {
          for (const block of blocks) {
              const blockEl = this.elementForBlock(block);
              this.divNode.appendChild(blockEl);
          }
      }
      lineString(node) {
          return `${node.id}: ${node.label}(${node.inputs.join(", ")})`;
      }
      searchInputAction(searchBar, e, onlyVisible) {
          e.stopPropagation();
          this.selectionHandler.clear();
          const query = searchBar.value;
          if (query.length == 0)
              return;
          const select = [];
          window.sessionStorage.setItem("lastSearch", query);
          const reg = new RegExp(query);
          for (const node of this.schedule.nodes) {
              if (node === undefined)
                  continue;
              if (reg.exec(this.lineString(node)) != null) {
                  select.push(node.id);
              }
          }
          this.selectionHandler.select(select, true);
      }
  }

  // Copyright 2018 the V8 project authors. All rights reserved.
  class SequenceView extends TextView {
      createViewElement() {
          const pane = document.createElement('div');
          pane.setAttribute('id', "sequence");
          return pane;
      }
      constructor(parentId, broker) {
          super(parentId, broker);
      }
      attachSelection(s) {
          const view = this;
          if (!(s instanceof Set))
              return;
          view.selectionHandler.clear();
          view.blockSelectionHandler.clear();
          const selected = new Array();
          for (const key of s)
              selected.push(key);
          view.selectionHandler.select(selected, true);
      }
      detachSelection() {
          this.blockSelection.clear();
          return this.selection.detachSelection();
      }
      initializeContent(data, rememberedSelection) {
          this.divNode.innerHTML = '';
          this.sequence = data.sequence;
          this.searchInfo = [];
          this.divNode.addEventListener('click', (e) => {
              if (!(e.target instanceof HTMLElement))
                  return;
              const instructionId = Number.parseInt(e.target.dataset.instructionId, 10);
              if (!instructionId)
                  return;
              if (!e.shiftKey)
                  this.broker.broadcastClear(null);
              this.broker.broadcastInstructionSelect(null, [instructionId], true);
          });
          this.addBlocks(this.sequence.blocks);
          this.attachSelection(rememberedSelection);
          this.show();
      }
      elementForBlock(block) {
          const view = this;
          function createElement(tag, cls, content) {
              const el = document.createElement(tag);
              if (isIterable(cls)) {
                  for (const c of cls)
                      el.classList.add(c);
              }
              else {
                  el.classList.add(cls);
              }
              if (content != undefined)
                  el.innerHTML = content;
              return el;
          }
          function mkLinkHandler(id, handler) {
              return function (e) {
                  e.stopPropagation();
                  if (!e.shiftKey) {
                      handler.clear();
                  }
                  handler.select(["" + id], true);
              };
          }
          function mkBlockLinkHandler(blockId) {
              return mkLinkHandler(blockId, view.blockSelectionHandler);
          }
          function mkOperandLinkHandler(text) {
              return mkLinkHandler(text, view.selectionHandler);
          }
          function elementForOperand(operand, searchInfo) {
              const text = operand.text;
              const operandEl = createElement("div", ["parameter", "tag", "clickable", operand.type], text);
              if (operand.tooltip) {
                  operandEl.setAttribute("title", operand.tooltip);
              }
              operandEl.onclick = mkOperandLinkHandler(text);
              searchInfo.push(text);
              view.addHtmlElementForNodeId(text, operandEl);
              return operandEl;
          }
          function elementForInstruction(instruction, searchInfo) {
              const instNodeEl = createElement("div", "instruction-node");
              const instId = createElement("div", "instruction-id", instruction.id);
              instId.classList.add("clickable");
              instId.dataset.instructionId = instruction.id;
              instNodeEl.appendChild(instId);
              const instContentsEl = createElement("div", "instruction-contents");
              instNodeEl.appendChild(instContentsEl);
              // Print gap moves.
              const gapEl = createElement("div", "gap", "gap");
              instContentsEl.appendChild(gapEl);
              for (const gap of instruction.gaps) {
                  const moves = createElement("div", ["comma-sep-list", "gap-move"]);
                  for (const move of gap) {
                      const moveEl = createElement("div", "move");
                      const destinationEl = elementForOperand(move[0], searchInfo);
                      moveEl.appendChild(destinationEl);
                      const assignEl = createElement("div", "assign", "=");
                      moveEl.appendChild(assignEl);
                      const sourceEl = elementForOperand(move[1], searchInfo);
                      moveEl.appendChild(sourceEl);
                      moves.appendChild(moveEl);
                  }
                  gapEl.appendChild(moves);
              }
              const instEl = createElement("div", "instruction");
              instContentsEl.appendChild(instEl);
              if (instruction.outputs.length > 0) {
                  const outputs = createElement("div", ["comma-sep-list", "input-output-list"]);
                  for (const output of instruction.outputs) {
                      const outputEl = elementForOperand(output, searchInfo);
                      outputs.appendChild(outputEl);
                  }
                  instEl.appendChild(outputs);
                  const assignEl = createElement("div", "assign", "=");
                  instEl.appendChild(assignEl);
              }
              const text = instruction.opcode + instruction.flags;
              const instLabel = createElement("div", "node-label", text);
              searchInfo.push(text);
              view.addHtmlElementForNodeId(text, instLabel);
              instEl.appendChild(instLabel);
              if (instruction.inputs.length > 0) {
                  const inputs = createElement("div", ["comma-sep-list", "input-output-list"]);
                  for (const input of instruction.inputs) {
                      const inputEl = elementForOperand(input, searchInfo);
                      inputs.appendChild(inputEl);
                  }
                  instEl.appendChild(inputs);
              }
              if (instruction.temps.length > 0) {
                  const temps = createElement("div", ["comma-sep-list", "input-output-list", "temps"]);
                  for (const temp of instruction.temps) {
                      const tempEl = elementForOperand(temp, searchInfo);
                      temps.appendChild(tempEl);
                  }
                  instEl.appendChild(temps);
              }
              return instNodeEl;
          }
          const sequenceBlock = createElement("div", "schedule-block");
          sequenceBlock.classList.toggle("deferred", block.deferred);
          const blockId = createElement("div", ["block-id", "com", "clickable"], block.id);
          blockId.onclick = mkBlockLinkHandler(block.id);
          sequenceBlock.appendChild(blockId);
          const blockPred = createElement("div", ["predecessor-list", "block-list", "comma-sep-list"]);
          for (const pred of block.predecessors) {
              const predEl = createElement("div", ["block-id", "com", "clickable"], pred);
              predEl.onclick = mkBlockLinkHandler(pred);
              blockPred.appendChild(predEl);
          }
          if (block.predecessors.length > 0)
              sequenceBlock.appendChild(blockPred);
          const phis = createElement("div", "phis");
          sequenceBlock.appendChild(phis);
          const phiLabel = createElement("div", "phi-label", "phi:");
          phis.appendChild(phiLabel);
          const phiContents = createElement("div", "phi-contents");
          phis.appendChild(phiContents);
          for (const phi of block.phis) {
              const phiEl = createElement("div", "phi");
              phiContents.appendChild(phiEl);
              const outputEl = elementForOperand(phi.output, this.searchInfo);
              phiEl.appendChild(outputEl);
              const assignEl = createElement("div", "assign", "=");
              phiEl.appendChild(assignEl);
              for (const input of phi.operands) {
                  const inputEl = createElement("div", ["parameter", "tag", "clickable"], input);
                  phiEl.appendChild(inputEl);
              }
          }
          const instructions = createElement("div", "instructions");
          for (const instruction of block.instructions) {
              instructions.appendChild(elementForInstruction(instruction, this.searchInfo));
          }
          sequenceBlock.appendChild(instructions);
          const blockSucc = createElement("div", ["successor-list", "block-list", "comma-sep-list"]);
          for (const succ of block.successors) {
              const succEl = createElement("div", ["block-id", "com", "clickable"], succ);
              succEl.onclick = mkBlockLinkHandler(succ);
              blockSucc.appendChild(succEl);
          }
          if (block.successors.length > 0)
              sequenceBlock.appendChild(blockSucc);
          this.addHtmlElementForBlockId(block.id, sequenceBlock);
          return sequenceBlock;
      }
      addBlocks(blocks) {
          for (const block of blocks) {
              const blockEl = this.elementForBlock(block);
              this.divNode.appendChild(blockEl);
          }
      }
      searchInputAction(searchBar, e) {
          e.stopPropagation();
          this.selectionHandler.clear();
          const query = searchBar.value;
          if (query.length == 0)
              return;
          const select = [];
          window.sessionStorage.setItem("lastSearch", query);
          const reg = new RegExp(query);
          for (const item of this.searchInfo) {
              if (reg.exec(item) != null) {
                  select.push(item);
              }
          }
          this.selectionHandler.select(select, true);
      }
  }

  // Copyright 2018 the V8 project authors. All rights reserved.
  const multiviewID = "multiview";
  const toolboxHTML$1 = `
<div class="graph-toolbox">
  <select id="phase-select">
    <option disabled selected>(please open a file)</option>
  </select>
  <input id="search-input" type="text" title="search nodes for regex" alt="search node for regex" class="search-input"
    placeholder="find with regexp&hellip;">
  <label><input id="search-only-visible" type="checkbox" name="instruction-address" alt="Apply search to visible nodes only">only visible</label>
</div>`;
  class GraphMultiView extends View {
      createViewElement() {
          const pane = document.createElement("div");
          pane.setAttribute("id", multiviewID);
          pane.className = "viewpane";
          return pane;
      }
      constructor(id, selectionBroker, sourceResolver) {
          super(id);
          const view = this;
          view.sourceResolver = sourceResolver;
          view.selectionBroker = selectionBroker;
          const toolbox = document.createElement("div");
          toolbox.className = "toolbox-anchor";
          toolbox.innerHTML = toolboxHTML$1;
          view.divNode.appendChild(toolbox);
          const searchInput = toolbox.querySelector("#search-input");
          const onlyVisibleCheckbox = toolbox.querySelector("#search-only-visible");
          searchInput.addEventListener("keyup", e => {
              if (!view.currentPhaseView)
                  return;
              view.currentPhaseView.searchInputAction(searchInput, e, onlyVisibleCheckbox.checked);
          });
          view.divNode.addEventListener("keyup", (e) => {
              if (e.keyCode == 191) { // keyCode == '/'
                  searchInput.focus();
              }
          });
          searchInput.setAttribute("value", window.sessionStorage.getItem("lastSearch") || "");
          this.graph = new GraphView(this.divNode, selectionBroker, view.displayPhaseByName.bind(this), toolbox.querySelector(".graph-toolbox"));
          this.schedule = new ScheduleView(this.divNode, selectionBroker);
          this.sequence = new SequenceView(this.divNode, selectionBroker);
          this.selectMenu = toolbox.querySelector("#phase-select");
      }
      initializeSelect() {
          const view = this;
          view.selectMenu.innerHTML = "";
          view.sourceResolver.forEachPhase(phase => {
              const optionElement = document.createElement("option");
              let maxNodeId = "";
              if (phase.type == "graph" && phase.highestNodeId != 0) {
                  maxNodeId = ` ${phase.highestNodeId}`;
              }
              optionElement.text = `${phase.name}${maxNodeId}`;
              view.selectMenu.add(optionElement);
          });
          this.selectMenu.onchange = function () {
              const phaseIndex = this.selectedIndex;
              window.sessionStorage.setItem("lastSelectedPhase", phaseIndex.toString());
              view.displayPhase(view.sourceResolver.getPhase(phaseIndex));
          };
      }
      show() {
          super.show();
          this.initializeSelect();
          const lastPhaseIndex = +window.sessionStorage.getItem("lastSelectedPhase");
          const initialPhaseIndex = this.sourceResolver.repairPhaseId(lastPhaseIndex);
          this.selectMenu.selectedIndex = initialPhaseIndex;
          this.displayPhase(this.sourceResolver.getPhase(initialPhaseIndex));
      }
      displayPhase(phase, selection) {
          if (phase.type == "graph") {
              this.displayPhaseView(this.graph, phase, selection);
          }
          else if (phase.type == "schedule") {
              this.displayPhaseView(this.schedule, phase, selection);
          }
          else if (phase.type == "sequence") {
              this.displayPhaseView(this.sequence, phase, selection);
          }
      }
      displayPhaseView(view, data, selection) {
          const rememberedSelection = selection ? selection : this.hideCurrentPhase();
          view.initializeContent(data, rememberedSelection);
          this.divNode.classList.toggle("scrollable", view.isScrollable());
          this.currentPhaseView = view;
      }
      displayPhaseByName(phaseName, selection) {
          const phaseId = this.sourceResolver.getPhaseIdByName(phaseName);
          this.selectMenu.selectedIndex = phaseId;
          this.displayPhase(this.sourceResolver.getPhase(phaseId), selection);
      }
      hideCurrentPhase() {
          let rememberedSelection = null;
          if (this.currentPhaseView != null) {
              rememberedSelection = this.currentPhaseView.detachSelection();
              this.currentPhaseView.hide();
              this.currentPhaseView = null;
          }
          return rememberedSelection;
      }
      onresize() {
          if (this.currentPhaseView)
              this.currentPhaseView.onresize();
      }
      detachSelection() {
          return null;
      }
  }

  // Copyright 2015 the V8 project authors. All rights reserved.
  var CodeMode;
  (function (CodeMode) {
      CodeMode["MAIN_SOURCE"] = "main function";
      CodeMode["INLINED_SOURCE"] = "inlined function";
  })(CodeMode || (CodeMode = {}));
  class CodeView extends View {
      createViewElement() {
          const sourceContainer = document.createElement("div");
          sourceContainer.classList.add("source-container");
          return sourceContainer;
      }
      constructor(parent, broker, sourceResolver, sourceFunction, codeMode) {
          super(parent);
          const view = this;
          view.broker = broker;
          view.sourceResolver = sourceResolver;
          view.source = sourceFunction;
          view.codeMode = codeMode;
          this.sourcePositionToHtmlElement = new Map();
          this.showAdditionalInliningPosition = false;
          const selectionHandler = {
              clear: function () {
                  view.selection.clear();
                  view.updateSelection();
                  broker.broadcastClear(this);
              },
              select: function (sourcePositions, selected) {
                  const locations = [];
                  for (const sourcePosition of sourcePositions) {
                      locations.push(sourcePosition);
                      sourceResolver.addInliningPositions(sourcePosition, locations);
                  }
                  if (locations.length == 0)
                      return;
                  view.selection.select(locations, selected);
                  view.updateSelection();
                  broker.broadcastSourcePositionSelect(this, locations, selected);
              },
              brokeredSourcePositionSelect: function (locations, selected) {
                  const firstSelect = view.selection.isEmpty();
                  for (const location of locations) {
                      const translated = sourceResolver.translateToSourceId(view.source.sourceId, location);
                      if (!translated)
                          continue;
                      view.selection.select([translated], selected);
                  }
                  view.updateSelection(firstSelect);
              },
              brokeredClear: function () {
                  view.selection.clear();
                  view.updateSelection();
              },
          };
          view.selection = new MySelection(sourcePositionToStringKey);
          broker.addSourcePositionHandler(selectionHandler);
          this.selectionHandler = selectionHandler;
          this.initializeCode();
      }
      addHtmlElementToSourcePosition(sourcePosition, element) {
          const key = sourcePositionToStringKey(sourcePosition);
          if (this.sourcePositionToHtmlElement.has(key)) {
              console.log("Warning: duplicate source position", sourcePosition);
          }
          this.sourcePositionToHtmlElement.set(key, element);
      }
      getHtmlElementForSourcePosition(sourcePosition) {
          const key = sourcePositionToStringKey(sourcePosition);
          return this.sourcePositionToHtmlElement.get(key);
      }
      updateSelection(scrollIntoView = false) {
          const mkVisible = new ViewElements(this.divNode.parentNode);
          for (const [sp, el] of this.sourcePositionToHtmlElement.entries()) {
              const isSelected = this.selection.isKeySelected(sp);
              mkVisible.consider(el, isSelected);
              el.classList.toggle("selected", isSelected);
          }
          mkVisible.apply(scrollIntoView);
      }
      getCodeHtmlElementName() {
          return `source-pre-${this.source.sourceId}`;
      }
      getCodeHeaderHtmlElementName() {
          return `source-pre-${this.source.sourceId}-header`;
      }
      getHtmlCodeLines() {
          const ordereList = this.divNode.querySelector(`#${this.getCodeHtmlElementName()} ol`);
          return ordereList.childNodes;
      }
      onSelectLine(lineNumber, doClear) {
          if (doClear) {
              this.selectionHandler.clear();
          }
          const positions = this.sourceResolver.linetoSourcePositions(lineNumber - 1);
          if (positions !== undefined) {
              this.selectionHandler.select(positions, undefined);
          }
      }
      onSelectSourcePosition(sourcePosition, doClear) {
          if (doClear) {
              this.selectionHandler.clear();
          }
          this.selectionHandler.select([sourcePosition], undefined);
      }
      initializeCode() {
          const view = this;
          const source = this.source;
          const sourceText = source.sourceText;
          if (!sourceText)
              return;
          const sourceContainer = view.divNode;
          if (this.codeMode == CodeMode.MAIN_SOURCE) {
              sourceContainer.classList.add("main-source");
          }
          else {
              sourceContainer.classList.add("inlined-source");
          }
          const codeHeader = document.createElement("div");
          codeHeader.setAttribute("id", this.getCodeHeaderHtmlElementName());
          codeHeader.classList.add("code-header");
          const codeFileFunction = document.createElement("div");
          codeFileFunction.classList.add("code-file-function");
          codeFileFunction.innerHTML = `${source.sourceName}:${source.functionName}`;
          codeHeader.appendChild(codeFileFunction);
          const codeModeDiv = document.createElement("div");
          codeModeDiv.classList.add("code-mode");
          codeModeDiv.innerHTML = `${this.codeMode}`;
          codeHeader.appendChild(codeModeDiv);
          const clearDiv = document.createElement("div");
          clearDiv.style.clear = "both";
          codeHeader.appendChild(clearDiv);
          sourceContainer.appendChild(codeHeader);
          const codePre = document.createElement("pre");
          codePre.setAttribute("id", this.getCodeHtmlElementName());
          codePre.classList.add("prettyprint");
          sourceContainer.appendChild(codePre);
          codeHeader.onclick = function myFunction() {
              if (codePre.style.display === "none") {
                  codePre.style.display = "block";
              }
              else {
                  codePre.style.display = "none";
              }
          };
          if (sourceText != "") {
              codePre.classList.add("linenums");
              codePre.textContent = sourceText;
              try {
                  // Wrap in try to work when offline.
                  PR.prettyPrint(undefined, sourceContainer);
              }
              catch (e) {
                  console.log(e);
              }
              view.divNode.onclick = function (e) {
                  if (e.target instanceof Element && e.target.tagName == "DIV") {
                      const targetDiv = e.target;
                      if (targetDiv.classList.contains("line-number")) {
                          e.stopPropagation();
                          view.onSelectLine(Number(targetDiv.dataset.lineNumber), !e.shiftKey);
                      }
                  }
                  else {
                      view.selectionHandler.clear();
                  }
              };
              const base = source.startPosition;
              let current = 0;
              const lineListDiv = this.getHtmlCodeLines();
              let newlineAdjust = 0;
              for (let i = 0; i < lineListDiv.length; i++) {
                  // Line numbers are not zero-based.
                  const lineNumber = i + 1;
                  const currentLineElement = lineListDiv[i];
                  currentLineElement.id = "li" + i;
                  currentLineElement.dataset.lineNumber = "" + lineNumber;
                  const spans = currentLineElement.childNodes;
                  for (const currentSpan of spans) {
                      if (currentSpan instanceof HTMLSpanElement) {
                          const pos = base + current;
                          const end = pos + currentSpan.textContent.length;
                          current += currentSpan.textContent.length;
                          this.insertSourcePositions(currentSpan, lineNumber, pos, end, newlineAdjust);
                          newlineAdjust = 0;
                      }
                  }
                  this.insertLineNumber(currentLineElement, lineNumber);
                  while ((current < sourceText.length) &&
                      (sourceText[current] == '\n' || sourceText[current] == '\r')) {
                      ++current;
                      ++newlineAdjust;
                  }
              }
          }
      }
      insertSourcePositions(currentSpan, lineNumber, pos, end, adjust) {
          const view = this;
          const sps = this.sourceResolver.sourcePositionsInRange(this.source.sourceId, pos - adjust, end);
          let offset = 0;
          for (const sourcePosition of sps) {
              this.sourceResolver.addAnyPositionToLine(lineNumber, sourcePosition);
              const textnode = currentSpan.tagName == 'SPAN' ? currentSpan.lastChild : currentSpan;
              if (!(textnode instanceof Text))
                  continue;
              const splitLength = Math.max(0, sourcePosition.scriptOffset - pos - offset);
              offset += splitLength;
              const replacementNode = textnode.splitText(splitLength);
              const span = document.createElement('span');
              span.setAttribute("scriptOffset", sourcePosition.scriptOffset);
              span.classList.add("source-position");
              const marker = document.createElement('span');
              marker.classList.add("marker");
              span.appendChild(marker);
              const inlining = this.sourceResolver.getInliningForPosition(sourcePosition);
              if (inlining != undefined && view.showAdditionalInliningPosition) {
                  const sourceName = this.sourceResolver.getSourceName(inlining.sourceId);
                  const inliningMarker = document.createElement('span');
                  inliningMarker.classList.add("inlining-marker");
                  inliningMarker.setAttribute("data-descr", `${sourceName} was inlined here`);
                  span.appendChild(inliningMarker);
              }
              span.onclick = function (e) {
                  e.stopPropagation();
                  view.onSelectSourcePosition(sourcePosition, !e.shiftKey);
              };
              view.addHtmlElementToSourcePosition(sourcePosition, span);
              textnode.parentNode.insertBefore(span, replacementNode);
          }
      }
      insertLineNumber(lineElement, lineNumber) {
          const view = this;
          const lineNumberElement = document.createElement("div");
          lineNumberElement.classList.add("line-number");
          lineNumberElement.dataset.lineNumber = `${lineNumber}`;
          lineNumberElement.innerText = `${lineNumber}`;
          lineElement.insertBefore(lineNumberElement, lineElement.firstChild);
          // Don't add lines to source positions of not in backwardsCompatibility mode.
          if (this.source.backwardsCompatibility === true) {
              for (const sourcePosition of this.sourceResolver.linetoSourcePositions(lineNumber - 1)) {
                  view.addHtmlElementToSourcePosition(sourcePosition, lineElement);
              }
          }
      }
  }

  class Tabs {
      mkTabBar(container) {
          container.classList.add("nav-tabs-container");
          this.tabBar = document.createElement("ul");
          this.tabBar.id = `tab-bar-${container.id}`;
          this.tabBar.className = "nav-tabs";
          this.tabBar.ondrop = this.tabBarOnDrop.bind(this);
          this.tabBar.ondragover = this.tabBarOnDragover.bind(this);
          this.tabBar.onclick = this.tabBarOnClick.bind(this);
          const defaultDiv = document.createElement("div");
          defaultDiv.className = "tab-content tab-default";
          defaultDiv.id = `tab-content-${container.id}-default`;
          container.insertBefore(defaultDiv, container.firstChild);
          container.insertBefore(this.tabBar, container.firstChild);
      }
      constructor(container) {
          this.container = container;
          this.nextTabId = 0;
          this.mkTabBar(container);
      }
      activateTab(tab) {
          if (typeof tab.dataset.divid !== "string")
              return;
          for (const li of this.tabBar.querySelectorAll("li.active")) {
              li.classList.remove("active");
              this.showTab(li, false);
          }
          tab.classList.add("active");
          this.showTab(tab, true);
      }
      clearTabsAndContent() {
          for (const tab of this.tabBar.querySelectorAll(".nav-tabs > li")) {
              if (!(tab instanceof HTMLLIElement))
                  continue;
              if (tab.classList.contains("persistent-tab"))
                  continue;
              const tabDiv = document.getElementById(tab.dataset.divid);
              tabDiv.parentNode.removeChild(tabDiv);
              tab.parentNode.removeChild(tab);
          }
      }
      showTab(li, show = true) {
          const tabDiv = document.getElementById(li.dataset.divid);
          tabDiv.style.display = show ? "block" : "none";
      }
      addTab(caption) {
          const newTab = document.createElement("li");
          newTab.innerHTML = caption;
          newTab.id = `tab-header-${this.container.id}-${this.nextTabId++}`;
          const lastTab = this.tabBar.querySelector("li.last-tab");
          this.tabBar.insertBefore(newTab, lastTab);
          return newTab;
      }
      addTabAndContent(caption) {
          const contentDiv = document.createElement("div");
          contentDiv.className = "tab-content tab-default";
          contentDiv.id = `tab-content-${this.container.id}-${this.nextTabId++}`;
          contentDiv.style.display = "none";
          this.container.appendChild(contentDiv);
          const newTab = this.addTab(caption);
          newTab.dataset.divid = contentDiv.id;
          newTab.draggable = true;
          newTab.ondragstart = this.tabOnDragStart.bind(this);
          const lastTab = this.tabBar.querySelector("li.last-tab");
          this.tabBar.insertBefore(newTab, lastTab);
          return [newTab, contentDiv];
      }
      moveTabDiv(tab) {
          const tabDiv = document.getElementById(tab.dataset.divid);
          tabDiv.style.display = "none";
          tab.classList.remove("active");
          this.tabBar.parentNode.appendChild(tabDiv);
      }
      tabBarOnDrop(e) {
          if (!(e.target instanceof HTMLElement))
              return;
          e.preventDefault();
          const tabId = e.dataTransfer.getData("text");
          const tab = document.getElementById(tabId);
          if (tab.parentNode != this.tabBar) {
              this.moveTabDiv(tab);
          }
          const dropTab = e.target.parentNode == this.tabBar
              ? e.target : this.tabBar.querySelector("li.last-tab");
          this.tabBar.insertBefore(tab, dropTab);
          this.activateTab(tab);
      }
      tabBarOnDragover(e) {
          e.preventDefault();
      }
      tabOnDragStart(e) {
          if (!(e.target instanceof HTMLElement))
              return;
          e.dataTransfer.setData("text", e.target.id);
      }
      tabBarOnClick(e) {
          const li = e.target;
          this.activateTab(li);
      }
  }

  // Copyright 2019 the V8 project authors. All rights reserved.
  class Snapper {
      constructor(resizer) {
          this.resizer = resizer;
          this.sourceExpand = document.getElementById(SOURCE_EXPAND_ID);
          this.sourceCollapse = document.getElementById(SOURCE_COLLAPSE_ID);
          this.disassemblyExpand = document.getElementById(DISASSEMBLY_EXPAND_ID);
          this.disassemblyCollapse = document.getElementById(DISASSEMBLY_COLLAPSE_ID);
          document.getElementById("source-collapse").addEventListener("click", () => {
              this.setSourceExpanded(!this.sourceExpand.classList.contains("invisible"));
              this.resizer.updatePanes();
          });
          document.getElementById("disassembly-collapse").addEventListener("click", () => {
              this.setDisassemblyExpanded(!this.disassemblyExpand.classList.contains("invisible"));
              this.resizer.updatePanes();
          });
      }
      restoreExpandedState() {
          this.setSourceExpanded(this.getLastExpandedState("source", true));
          this.setDisassemblyExpanded(this.getLastExpandedState("disassembly", false));
      }
      getLastExpandedState(type, defaultState) {
          const state = window.sessionStorage.getItem("expandedState-" + type);
          if (state === null)
              return defaultState;
          return state === 'true';
      }
      sourceExpandUpdate(newState) {
          window.sessionStorage.setItem("expandedState-source", `${newState}`);
          this.sourceExpand.classList.toggle("invisible", newState);
          this.sourceCollapse.classList.toggle("invisible", !newState);
      }
      setSourceExpanded(newState) {
          if (this.sourceExpand.classList.contains("invisible") === newState)
              return;
          const resizer = this.resizer;
          this.sourceExpandUpdate(newState);
          if (newState) {
              resizer.sepLeft = resizer.sepLeftSnap;
              resizer.sepLeftSnap = 0;
          }
          else {
              resizer.sepLeftSnap = resizer.sepLeft;
              resizer.sepLeft = 0;
          }
      }
      disassemblyExpandUpdate(newState) {
          window.sessionStorage.setItem("expandedState-disassembly", `${newState}`);
          this.disassemblyExpand.classList.toggle("invisible", newState);
          this.disassemblyCollapse.classList.toggle("invisible", !newState);
      }
      setDisassemblyExpanded(newState) {
          if (this.disassemblyExpand.classList.contains("invisible") === newState)
              return;
          const resizer = this.resizer;
          this.disassemblyExpandUpdate(newState);
          if (newState) {
              resizer.sepRight = resizer.sepRightSnap;
              resizer.sepRightSnap = resizer.clientWidth;
          }
          else {
              resizer.sepRightSnap = resizer.sepRight;
              resizer.sepRight = resizer.clientWidth;
          }
      }
      panesUpdated() {
          this.sourceExpandUpdate(this.resizer.sepLeft > this.resizer.deadWidth);
          this.disassemblyExpandUpdate(this.resizer.sepRight <
              (this.resizer.clientWidth - this.resizer.deadWidth));
      }
  }
  class Resizer {
      constructor(panesUpdatedCallback, deadWidth) {
          const resizer = this;
          resizer.panesUpdatedCallback = panesUpdatedCallback;
          resizer.deadWidth = deadWidth;
          resizer.left = document.getElementById(SOURCE_PANE_ID);
          resizer.middle = document.getElementById(INTERMEDIATE_PANE_ID);
          resizer.right = document.getElementById(GENERATED_PANE_ID);
          resizer.resizerLeft = select('#resizer-left');
          resizer.resizerRight = select('#resizer-right');
          resizer.sepLeftSnap = 0;
          resizer.sepRightSnap = 0;
          // Offset to prevent resizers from sliding slightly over one another.
          resizer.sepWidthOffset = 7;
          this.updateWidths();
          const dragResizeLeft = drag()
              .on('drag', function () {
              const x = mouse(this.parentElement)[0];
              resizer.sepLeft = Math.min(Math.max(0, x), resizer.sepRight - resizer.sepWidthOffset);
              resizer.updatePanes();
          })
              .on('start', function () {
              resizer.resizerLeft.classed("dragged", true);
              const x = mouse(this.parentElement)[0];
              if (x > deadWidth) {
                  resizer.sepLeftSnap = resizer.sepLeft;
              }
          })
              .on('end', function () {
              if (!resizer.isRightSnapped()) {
                  window.sessionStorage.setItem("source-pane-width", `${resizer.sepLeft / resizer.clientWidth}`);
              }
              resizer.resizerLeft.classed("dragged", false);
          });
          resizer.resizerLeft.call(dragResizeLeft);
          const dragResizeRight = drag()
              .on('drag', function () {
              const x = mouse(this.parentElement)[0];
              resizer.sepRight = Math.max(resizer.sepLeft + resizer.sepWidthOffset, Math.min(x, resizer.clientWidth));
              resizer.updatePanes();
          })
              .on('start', function () {
              resizer.resizerRight.classed("dragged", true);
              const x = mouse(this.parentElement)[0];
              if (x < (resizer.clientWidth - deadWidth)) {
                  resizer.sepRightSnap = resizer.sepRight;
              }
          })
              .on('end', function () {
              if (!resizer.isRightSnapped()) {
                  console.log(`disassembly-pane-width ${resizer.sepRight}`);
                  window.sessionStorage.setItem("disassembly-pane-width", `${resizer.sepRight / resizer.clientWidth}`);
              }
              resizer.resizerRight.classed("dragged", false);
          });
          resizer.resizerRight.call(dragResizeRight);
          window.onresize = function () {
              resizer.updateWidths();
              resizer.updatePanes();
          };
          resizer.snapper = new Snapper(resizer);
          resizer.snapper.restoreExpandedState();
      }
      isLeftSnapped() {
          return this.sepLeft === 0;
      }
      isRightSnapped() {
          return this.sepRight >= this.clientWidth - 1;
      }
      updatePanes() {
          const leftSnapped = this.isLeftSnapped();
          const rightSnapped = this.isRightSnapped();
          this.resizerLeft.classed("snapped", leftSnapped);
          this.resizerRight.classed("snapped", rightSnapped);
          this.left.style.width = this.sepLeft + 'px';
          this.middle.style.width = (this.sepRight - this.sepLeft) + 'px';
          this.right.style.width = (this.clientWidth - this.sepRight) + 'px';
          this.resizerLeft.style('left', this.sepLeft + 'px');
          this.resizerRight.style('right', (this.clientWidth - this.sepRight - 1) + 'px');
          this.snapper.panesUpdated();
          this.panesUpdatedCallback();
      }
      updateWidths() {
          this.clientWidth = document.body.getBoundingClientRect().width;
          const sepLeft = window.sessionStorage.getItem("source-pane-width");
          this.sepLeft = this.clientWidth * (sepLeft ? Number.parseFloat(sepLeft) : (1 / 3));
          const sepRight = window.sessionStorage.getItem("disassembly-pane-width");
          this.sepRight = this.clientWidth * (sepRight ? Number.parseFloat(sepRight) : (2 / 3));
      }
  }

  class InfoView extends View {
      constructor(idOrContainer) {
          super(idOrContainer);
          fetch("info-view.html")
              .then(response => response.text())
              .then(htmlText => this.divNode.innerHTML = htmlText);
      }
      createViewElement() {
          const infoContainer = document.createElement("div");
          infoContainer.classList.add("info-container");
          return infoContainer;
      }
  }

  // Copyright 2017 the V8 project authors. All rights reserved.
  window.onload = function () {
      let multiview = null;
      let disassemblyView = null;
      let sourceViews = [];
      let selectionBroker = null;
      let sourceResolver = null;
      const resizer = new Resizer(panesUpdatedCallback, 100);
      const sourceTabsContainer = document.getElementById(SOURCE_PANE_ID);
      const sourceTabs = new Tabs(sourceTabsContainer);
      sourceTabs.addTab("&#x2b;").classList.add("last-tab", "persistent-tab");
      const disassemblyTabsContainer = document.getElementById(GENERATED_PANE_ID);
      const disassemblyTabs = new Tabs(disassemblyTabsContainer);
      disassemblyTabs.addTab("&#x2b;").classList.add("last-tab", "persistent-tab");
      const [infoTab, infoContainer] = sourceTabs.addTabAndContent("Info");
      infoTab.classList.add("persistent-tab");
      infoContainer.classList.add("viewpane", "scrollable");
      const infoView = new InfoView(infoContainer);
      infoView.show();
      sourceTabs.activateTab(infoTab);
      function panesUpdatedCallback() {
          if (multiview)
              multiview.onresize();
      }
      function loadFile(txtRes) {
          sourceTabs.clearTabsAndContent();
          disassemblyTabs.clearTabsAndContent();
          // If the JSON isn't properly terminated, assume compiler crashed and
          // add best-guess empty termination
          if (txtRes[txtRes.length - 2] == ',') {
              txtRes += '{"name":"disassembly","type":"disassembly","data":""}]}';
          }
          try {
              sourceViews.forEach(sv => sv.hide());
              if (multiview)
                  multiview.hide();
              multiview = null;
              if (disassemblyView)
                  disassemblyView.hide();
              sourceViews = [];
              sourceResolver = new SourceResolver();
              selectionBroker = new SelectionBroker(sourceResolver);
              const jsonObj = JSON.parse(txtRes);
              let fnc = null;
              // Backwards compatibility.
              if (typeof jsonObj.function == 'string') {
                  fnc = {
                      functionName: fnc,
                      sourceId: -1,
                      startPosition: jsonObj.sourcePosition,
                      endPosition: jsonObj.sourcePosition + jsonObj.source.length,
                      sourceText: jsonObj.source,
                      backwardsCompatibility: true
                  };
              }
              else {
                  fnc = Object.assign(jsonObj.function, { backwardsCompatibility: false });
              }
              sourceResolver.setInlinings(jsonObj.inlinings);
              sourceResolver.setSourceLineToBytecodePosition(jsonObj.sourceLineToBytecodePosition);
              sourceResolver.setSources(jsonObj.sources, fnc);
              sourceResolver.setNodePositionMap(jsonObj.nodePositions);
              sourceResolver.parsePhases(jsonObj.phases);
              const [sourceTab, sourceContainer] = sourceTabs.addTabAndContent("Source");
              sourceContainer.classList.add("viewpane", "scrollable");
              sourceTabs.activateTab(sourceTab);
              const sourceView = new CodeView(sourceContainer, selectionBroker, sourceResolver, fnc, CodeMode.MAIN_SOURCE);
              sourceView.show();
              sourceViews.push(sourceView);
              sourceResolver.forEachSource(source => {
                  const sourceView = new CodeView(sourceContainer, selectionBroker, sourceResolver, source, CodeMode.INLINED_SOURCE);
                  sourceView.show();
                  sourceViews.push(sourceView);
              });
              const [disassemblyTab, disassemblyContainer] = disassemblyTabs.addTabAndContent("Disassembly");
              disassemblyContainer.classList.add("viewpane", "scrollable");
              disassemblyTabs.activateTab(disassemblyTab);
              disassemblyView = new DisassemblyView(disassemblyContainer, selectionBroker);
              disassemblyView.initializeCode(fnc.sourceText);
              if (sourceResolver.disassemblyPhase) {
                  disassemblyView.initializePerfProfile(jsonObj.eventCounts);
                  disassemblyView.showContent(sourceResolver.disassemblyPhase.data);
                  disassemblyView.show();
              }
              multiview = new GraphMultiView(INTERMEDIATE_PANE_ID, selectionBroker, sourceResolver);
              multiview.show();
          }
          catch (err) {
              if (window.confirm("Error: Exception during load of TurboFan JSON file:\n" +
                  "error: " + err.message + "\nDo you want to clear session storage?")) {
                  window.sessionStorage.clear();
              }
              return;
          }
      }
      function initializeUploadHandlers() {
          // The <input> form #upload-helper with type file can't be a picture.
          // We hence keep it hidden, and forward the click from the picture
          // button #upload.
          document.getElementById("upload").addEventListener("click", e => {
              document.getElementById("upload-helper").click();
              e.stopPropagation();
          });
          document.getElementById("upload-helper").addEventListener("change", function () {
              const uploadFile = this.files && this.files[0];
              if (uploadFile) {
                  const filereader = new FileReader();
                  filereader.onload = () => {
                      const txtRes = filereader.result;
                      if (typeof txtRes == 'string') {
                          loadFile(txtRes);
                      }
                  };
                  filereader.readAsText(uploadFile);
              }
          });
          window.addEventListener("keydown", (e) => {
              if (e.keyCode == 76 && e.ctrlKey) { // CTRL + L
                  document.getElementById("upload-helper").click();
                  e.stopPropagation();
                  e.preventDefault();
              }
          });
      }
      initializeUploadHandlers();
      resizer.updatePanes();
  };

}());
//# sourceMappingURL=turbolizer.js.map
