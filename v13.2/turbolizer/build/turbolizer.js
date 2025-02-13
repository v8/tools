(function () {
  'use strict';

  // Copyright 2014 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  const MAX_RANK_SENTINEL = 0;
  const BEZIER_CONSTANT = 0.3;
  const TURBOSHAFT_NODE_X_INDENT = 25;
  const TURBOSHAFT_COLLAPSE_ICON_X_INDENT = 20;
  const TURBOSHAFT_BLOCK_BORDER_RADIUS = 35;
  const TURBOSHAFT_BLOCK_ROW_SEPARATION = 200;
  const ARROW_HEAD_HEIGHT = 7;
  const DEFAULT_NODE_BUBBLE_RADIUS = 12;
  const NODE_INPUT_WIDTH = 50;
  const MINIMUM_NODE_OUTPUT_APPROACH = 15;
  const MINIMUM_EDGE_SEPARATION = 20;
  const MINIMUM_NODE_INPUT_APPROACH = 15 + 2 * DEFAULT_NODE_BUBBLE_RADIUS;
  const DEFAULT_NODE_ROW_SEPARATION = 150;
  const SOURCE_PANE_DEFAULT_PERCENT = 1 / 4;
  const DISASSEMBLY_PANE_DEFAULT_PERCENT = 3 / 4;
  const RANGES_PANE_HEIGHT_DEFAULT_PERCENT = 3 / 4;
  const RANGES_PANE_WIDTH_DEFAULT_PERCENT = 1 / 2;
  const HISTORY_DEFAULT_HEIGHT_PERCENT = 1 / 3.5;
  const HISTORY_CONTENT_INDENT = 8;
  const HISTORY_SCROLLBAR_WIDTH = 6;
  const RESIZER_RANGES_HEIGHT_BUFFER_PERCENTAGE = 5;
  const ROW_GROUP_SIZE = 20;
  const POSITIONS_PER_INSTRUCTION = 4;
  const FIXED_REGISTER_LABEL_WIDTH = 6;
  const FLIPPED_REGISTER_WIDTH_BUFFER = 5;
  // Required due to the css grid-template-rows and grid-template-columns being limited
  // to 1000 places. Regardless of this, a limit is required at some point due
  // to performance issues.
  const MAX_NUM_POSITIONS = 999;
  const RANGES_NUM_POS_HEADER_ROWS = 3;
  const RANGES_BLOCK_GRID_ROW = -RANGES_NUM_POS_HEADER_ROWS;
  const RANGES_INSTR_GRID_ROW = RANGES_BLOCK_GRID_ROW + 1;
  const RANGES_POS_GRID_ROW = RANGES_INSTR_GRID_ROW + 1;
  const SESSION_STORAGE_PREFIX = "ranges-setting-";
  const INTERVAL_TEXT_FOR_NONE = "none";
  const INTERVAL_TEXT_FOR_CONST = "const";
  const INTERVAL_TEXT_FOR_STACK = "stack:";
  const VIRTUAL_REGISTER_ID_PREFIX = "virt_";
  const HISTORY_ID = "history";
  const MULTIVIEW_ID = "multiview";
  const RESIZER_RANGES_ID = "resizer-ranges";
  const SHOW_HIDE_RANGES_ID = "show-hide-ranges";
  const SHOW_HIDE_SOURCE_ID = "show-hide-source";
  const SHOW_HIDE_DISASSEMBLY_ID = "show-hide-disassembly";
  const SOURCE_PANE_ID = "left";
  const SOURCE_COLLAPSE_ID = "source-shrink";
  const SOURCE_EXPAND_ID = "source-expand";
  const INTERMEDIATE_PANE_ID = "middle";
  const GRAPH_PANE_ID = "graph";
  const SCHEDULE_PANE_ID = "schedule";
  const SEQUENCE_PANE_ID = "sequence";
  const GENERATED_PANE_ID = "right";
  const DISASSEMBLY_PANE_ID = "disassembly";
  const DISASSEMBLY_COLLAPSE_ID = "disassembly-shrink";
  const DISASSEMBLY_EXPAND_ID = "disassembly-expand";
  const RANGES_PANE_ID = "ranges";
  const RANGES_COLLAPSE_VERT_ID = "ranges-shrink-vert";
  const RANGES_EXPAND_VERT_ID = "ranges-expand-vert";
  const RANGES_COLLAPSE_HOR_ID = "ranges-shrink-hor";
  const RANGES_EXPAND_HOR_ID = "ranges-expand-hor";
  const UNICODE_BLOCK = "&#9611;";
  const PROF_COLS = [
      { perc: 0, col: { r: 255, g: 255, b: 255 } },
      { perc: 0.5, col: { r: 255, g: 255, b: 128 } },
      { perc: 5, col: { r: 255, g: 128, b: 0 } },
      { perc: 15, col: { r: 255, g: 0, b: 0 } },
      { perc: 100, col: { r: 0, g: 0, b: 0 } }
  ];
  const RANGE_BACKGROUND_BORDER_COLOR = "#6D6B6B";
  const RANGE_BACKGROUND_SELECT_COLOR = "#FFFF33";
  const RANGE_BACKGROUND_FOCUS_COLOR = "#2D7ECA";
  const RANGE_POSITION_BORDER_WIDTH = 1;
  const RANGE_REGISTER_BORDER_WIDTH = 1;
  const RANGE_REGISTER_BORDER_WIDTH_X2 = 2 * RANGE_REGISTER_BORDER_WIDTH;

  // Copyright 2015 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  function snakeToCamel(str) {
      return str.toLowerCase().replace(/([-_][a-z])/g, group => group
          .toUpperCase()
          .replace('-', '')
          .replace('_', ''));
  }
  function camelize(obj) {
      if (Array.isArray(obj)) {
          return obj.map(value => camelize(value));
      }
      else if (obj !== null && obj.constructor === Object) {
          return Object.keys(obj).reduce((result, key) => ({
              ...result,
              [snakeToCamel(key)]: camelize(obj[key])
          }), {});
      }
      return obj;
  }
  function sortUnique(arr, comparator, equals) {
      if (arr.length == 0)
          return arr;
      arr = arr.sort(comparator);
      const uniqueArr = [arr[0]];
      for (let i = 1; i < arr.length; i++) {
          if (!equals(arr[i - 1], arr[i])) {
              uniqueArr.push(arr[i]);
          }
      }
      return uniqueArr;
  }
  // Partial application without binding the receiver
  function partial(func, ...arguments1) {
      return function (...arguments2) {
          func.apply(this, [...arguments1, ...arguments2]);
      };
  }
  function isIterable(obj) {
      return obj !== null && obj !== undefined
          && typeof obj !== "string" && typeof obj[Symbol.iterator] === "function";
  }
  function alignUp(raw, multiple) {
      return Math.floor((raw + multiple - 1) / multiple) * multiple;
  }
  function measureText(text, coefficient = 1) {
      const textMeasure = document.getElementById("text-measure");
      if (textMeasure instanceof SVGTSpanElement) {
          textMeasure.textContent = text;
          return {
              width: textMeasure.getBBox().width * coefficient,
              height: textMeasure.getBBox().height * coefficient,
          };
      }
      return { width: 0, height: 0 };
  }
  // Interpolate between the given start and end values by a fraction of val/max.
  function interpolate$1(val, max, start, end) {
      return start + (end - start) * (val / max);
  }
  function createElement(tag, cls, content) {
      const el = document.createElement(tag);
      el.className = cls;
      if (content !== undefined)
          el.innerText = content;
      return el;
  }
  function storageGetItem(key, defaultValue, parse = true) {
      let value = window.sessionStorage.getItem(key);
      if (parse)
          value = JSON.parse(value);
      return value === null ? defaultValue : value;
  }
  function storageSetItem(key, value) {
      window.sessionStorage.setItem(key, value);
  }
  function storageSetIfIsNotExist(key, toSet) {
      if (storageGetItem(key, null, false) === null)
          storageSetItem(key, toSet);
  }
  function copyToClipboard(text) {
      if (!text || text.length == 0)
          return;
      navigator.clipboard.writeText(text);
  }
  function getNumericCssValue(varName) {
      const propertyValue = getComputedStyle(document.body).getPropertyValue(varName);
      return parseFloat(propertyValue.match(/[+-]?\d+(\.\d+)?/g)[0]);
  }
  function setCssValue(varName, value) {
      document.body.style.setProperty(varName, value);
  }

  // Copyright 2022 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  class Phase {
      constructor(name, type) {
          this.name = name;
          this.type = type;
      }
      isGraph() {
          return this.type == PhaseType.Graph || this.type == PhaseType.TurboshaftGraph;
      }
      isDynamic() {
          return this.isGraph() || this.type == PhaseType.Schedule || this.type == PhaseType.Sequence;
      }
  }
  var PhaseType;
  (function (PhaseType) {
      PhaseType["Graph"] = "graph";
      PhaseType["TurboshaftGraph"] = "turboshaft_graph";
      PhaseType["TurboshaftCustomData"] = "turboshaft_custom_data";
      PhaseType["Disassembly"] = "disassembly";
      PhaseType["Instructions"] = "instructions";
      PhaseType["Sequence"] = "sequence";
      PhaseType["Schedule"] = "schedule";
  })(PhaseType || (PhaseType = {}));
  var GraphStateType$1;
  (function (GraphStateType) {
      GraphStateType[GraphStateType["NeedToFullRebuild"] = 0] = "NeedToFullRebuild";
      GraphStateType[GraphStateType["Cached"] = 1] = "Cached";
  })(GraphStateType$1 || (GraphStateType$1 = {}));

  // Copyright 2019 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  class NodeLabel {
      constructor(id, label, title, live, properties, sourcePosition, bytecodePosition, origin, opcode, control, opinfo, type) {
          this.id = id;
          this.label = label;
          this.title = title;
          this.live = live;
          this.properties = properties;
          this.sourcePosition = sourcePosition;
          this.bytecodePosition = bytecodePosition;
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
          if (this.id !== that.id)
              return false;
          if (this.label !== that.label)
              return false;
          if (this.title !== that.title)
              return false;
          if (this.live !== that.live)
              return false;
          if (this.properties !== that.properties)
              return false;
          if (this.opcode !== that.opcode)
              return false;
          if (this.control !== that.control)
              return false;
          if (this.opinfo !== that.opinfo)
              return false;
          return this.type === that.type;
      }
      getTitle() {
          const propsString = this.properties.length == 0 ? "no properties" : `[${this.properties}]`;
          let title = `${this.title}\n${propsString}\n${this.opinfo}`;
          if (this.origin) {
              title += `\nOrigin: ${this.origin.toString()}`;
          }
          if (this.inplaceUpdatePhase) {
              title += `\nInplace update in phase: ${this.inplaceUpdatePhase}`;
          }
          return title;
      }
      getDisplayLabel() {
          const label = `${this.id}: ${this.label}`;
          return label.length > 40 ? `${this.id}: ${this.opcode}` : label;
      }
      setInplaceUpdatePhase(name) {
          this.inplaceUpdatePhase = name;
      }
  }

  // Copyright 2022 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  class Origin {
      constructor(phase, reducer) {
          this.phase = phase;
          this.reducer = reducer;
      }
  }
  class NodeOrigin extends Origin {
      constructor(nodeId, node, phase, reducer) {
          super(phase, reducer);
          this.nodeId = nodeId;
          this.node = node;
      }
      identifier() {
          return `${this.nodeId}`;
      }
      toString() {
          return `#${this.nodeId} in phase '${this.phase}/${this.reducer}'`;
      }
  }
  class BytecodeOrigin extends Origin {
      constructor(bytecodePosition, phase, reducer) {
          super(phase, reducer);
          this.bytecodePosition = bytecodePosition;
      }
      identifier() {
          return `${this.bytecodePosition}`;
      }
      toString() {
          return `Bytecode line ${this.bytecodePosition} in phase '${this.phase}/${this.reducer}'`;
      }
  }

  // Copyright 2014 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  let Node$1 = class Node {
      constructor(id, displayLabel) {
          this.id = id;
          this.displayLabel = displayLabel;
          this.inputs = new Array();
          this.outputs = new Array();
          this.visible = false;
          this.outputApproach = MINIMUM_NODE_OUTPUT_APPROACH;
          this.visitOrderWithinRank = 0;
          this.rank = MAX_RANK_SENTINEL;
          this.x = 0;
          this.y = 0;
          if (displayLabel)
              this.labelBox = measureText(this.displayLabel);
      }
      areAnyOutputsVisible() {
          let visibleCount = 0;
          for (const edge of this.outputs) {
              if (edge.isVisible()) {
                  ++visibleCount;
              }
          }
          if (this.outputs.length == visibleCount) {
              return OutputVisibilityType.AllNodesVisible;
          }
          if (visibleCount != 0) {
              return OutputVisibilityType.SomeNodesVisible;
          }
          return OutputVisibilityType.NoVisibleNodes;
      }
      setOutputVisibility(visibility) {
          let result = false;
          for (const edge of this.outputs) {
              edge.visible = visibility;
              if (visibility && !edge.target.visible) {
                  edge.target.visible = true;
                  result = true;
              }
          }
          return result;
      }
      setInputVisibility(edgeIdx, visibility) {
          const edge = this.inputs[edgeIdx];
          edge.visible = visibility;
          if (visibility && !edge.source.visible) {
              edge.source.visible = true;
              return true;
          }
          return false;
      }
      getInputX(index) {
          return this.getWidth() - (NODE_INPUT_WIDTH / 2) +
              (index - this.inputs.length + 1) * NODE_INPUT_WIDTH;
      }
      getOutputX() {
          return this.getWidth() - (NODE_INPUT_WIDTH / 2);
      }
      getInputApproach(index) {
          return this.y - MINIMUM_NODE_INPUT_APPROACH -
              (index % 4) * MINIMUM_EDGE_SEPARATION - DEFAULT_NODE_BUBBLE_RADIUS;
      }
      getOutputApproach(extendHeight) {
          return this.y + this.outputApproach + this.getHeight(extendHeight, false) +
              +DEFAULT_NODE_BUBBLE_RADIUS;
      }
      compare(other) {
          if (this.visitOrderWithinRank < other.visitOrderWithinRank) {
              return -1;
          }
          else if (this.visitOrderWithinRank == other.visitOrderWithinRank) {
              return 0;
          }
          return 1;
      }
      identifier() {
          return `${this.id}`;
      }
      toString() {
          return `N${this.id}`;
      }
  };
  var OutputVisibilityType;
  (function (OutputVisibilityType) {
      OutputVisibilityType[OutputVisibilityType["NoVisibleNodes"] = 0] = "NoVisibleNodes";
      OutputVisibilityType[OutputVisibilityType["SomeNodesVisible"] = 1] = "SomeNodesVisible";
      OutputVisibilityType[OutputVisibilityType["AllNodesVisible"] = 2] = "AllNodesVisible";
  })(OutputVisibilityType || (OutputVisibilityType = {}));

  // Copyright 2022 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  class GraphNode extends Node$1 {
      constructor(nodeLabel) {
          super(nodeLabel.id, nodeLabel.getDisplayLabel());
          this.nodeLabel = nodeLabel;
          // Every control node is a CFG node.
          this.cfg = nodeLabel.control;
          const typeBox = measureText(this.getDisplayType());
          const innerWidth = Math.max(this.labelBox.width, typeBox.width);
          this.width = alignUp(innerWidth + NODE_INPUT_WIDTH * 2, NODE_INPUT_WIDTH);
          const innerHeight = Math.max(this.labelBox.height, typeBox.height);
          this.normalHeight = innerHeight + 20;
      }
      getHeight(showTypes) {
          if (showTypes) {
              return this.normalHeight + this.labelBox.height;
          }
          return this.normalHeight;
      }
      getWidth() {
          return Math.max(this.inputs.length * NODE_INPUT_WIDTH, this.width);
      }
      isControl() {
          return this.nodeLabel.control;
      }
      isInput() {
          return this.nodeLabel.opcode === "Parameter" || this.nodeLabel.opcode.endsWith("Constant");
      }
      isLive() {
          return this.nodeLabel.live !== false;
      }
      isJavaScript() {
          return this.nodeLabel.opcode.startsWith("JS");
      }
      isSimplified() {
          if (this.isJavaScript())
              return false;
          const opcode = this.nodeLabel.opcode;
          return opcode.endsWith("Phi") ||
              opcode.startsWith("Boolean") ||
              opcode.startsWith("Number") ||
              opcode.startsWith("String") ||
              opcode.startsWith("Change") ||
              opcode.startsWith("Object") ||
              opcode.startsWith("Reference") ||
              opcode.startsWith("Any") ||
              opcode.endsWith("ToNumber") ||
              (opcode === "AnyToBoolean") ||
              (opcode.startsWith("Load") && opcode.length > 4) ||
              (opcode.startsWith("Store") && opcode.length > 5);
      }
      isMachine() {
          return !(this.isControl() || this.isInput() ||
              this.isJavaScript() || this.isSimplified());
      }
      getTitle() {
          return this.nodeLabel.getTitle();
      }
      getHistoryLabel() {
          return `${this.id} ${this.nodeLabel.opcode}`;
      }
      getNodeOrigin() {
          const origin = this.nodeLabel.origin;
          return origin instanceof NodeOrigin ? origin : null;
      }
      getInplaceUpdatePhase() {
          return this?.nodeLabel?.inplaceUpdatePhase;
      }
      getDisplayLabel() {
          return this.nodeLabel.getDisplayLabel();
      }
      getType() {
          return this.nodeLabel.type;
      }
      getDisplayType() {
          const typeString = this.nodeLabel.type;
          if (typeString == undefined)
              return "";
          return typeString.length > 24 ? `${typeString.slice(0, 25)}...` : typeString;
      }
      deepestInputRank() {
          let deepestRank = 0;
          for (const edge of this.inputs) {
              if ((edge.isVisible() && !edge.isBackEdge()) && edge.source.rank > deepestRank) {
                  deepestRank = edge.source.rank;
              }
          }
          return deepestRank;
      }
      hasBackEdges() {
          return (this.nodeLabel.opcode === "Loop") ||
              ((this.nodeLabel.opcode === "Phi" || this.nodeLabel.opcode === "EffectPhi" ||
                  this.nodeLabel.opcode === "InductionVariablePhi") &&
                  this.inputs[this.inputs.length - 1].source.nodeLabel.opcode === "Loop");
      }
      equals(that) {
          if (!that)
              return false;
          return this.nodeLabel.equals(that.nodeLabel);
      }
  }

  // Copyright 2014 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  class Edge {
      constructor(target, index, source) {
          this.target = target;
          this.index = index;
          this.source = source;
          this.backEdgeNumber = 0;
          this.visible = false;
      }
      getInputHorizontalPosition(graph, extendHeight) {
          if (graph.graphPhase.rendered && this.backEdgeNumber > 0) {
              return graph.maxGraphNodeX + this.backEdgeNumber * MINIMUM_EDGE_SEPARATION;
          }
          const source = this.source;
          const target = this.target;
          const index = this.index;
          const inputX = target.x + target.getInputX(index);
          const inputApproach = target.getInputApproach(this.index);
          const outputApproach = source.getOutputApproach(extendHeight);
          if (inputApproach > outputApproach)
              return inputX;
          const inputOffset = MINIMUM_EDGE_SEPARATION * (index + 1);
          return target.x < source.x
              ? target.x + target.getWidth() + inputOffset
              : target.x - inputOffset;
      }
      generatePath(graph, extendHeight, compactView = false) {
          const target = this.target;
          const source = this.source;
          const inputX = target.x + target.getInputX(this.index);
          const inputY = target.y - 2 * DEFAULT_NODE_BUBBLE_RADIUS - ARROW_HEAD_HEIGHT;
          const outputX = source.x + source.getOutputX();
          const outputY = source.y + source.getHeight(extendHeight, compactView) + DEFAULT_NODE_BUBBLE_RADIUS;
          let inputApproach = target.getInputApproach(this.index);
          const outputApproach = source.getOutputApproach(extendHeight);
          const horizontalPos = this.getInputHorizontalPosition(graph, extendHeight);
          let path;
          if (inputY < outputY) {
              path = `M ${outputX} ${outputY}\nL ${outputX} ${outputApproach}\nL ${horizontalPos} ${outputApproach}`;
              if (horizontalPos !== inputX) {
                  path += `L ${horizontalPos} ${inputApproach}`;
              }
              else if (inputApproach < outputApproach) {
                  inputApproach = outputApproach;
              }
              path += `L ${inputX} ${inputApproach}\nL ${inputX} ${inputY}`;
          }
          else {
              const controlY = outputY + (inputY - outputY) * BEZIER_CONSTANT;
              path = `M ${outputX} ${outputY}\nC ${outputX} ${controlY},\n${inputX} ${outputY},\n${inputX} ${inputY}`;
          }
          return path;
      }
      isVisible() {
          return this.visible && this.source.visible && this.target.visible;
      }
      toString() {
          return `${this.source.id},${this.index},${this.target.id}`;
      }
  }

  // Copyright 2022 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  class GraphEdge extends Edge {
      constructor(target, index, source, type) {
          super(target, index, source);
          this.type = type;
      }
      isBackEdge() {
          return this.target.hasBackEdges() && (this.target.rank < this.source.rank);
      }
  }

  // Copyright 2022 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  class InstructionsPhase extends Phase {
      constructor(name = "") {
          super(name, PhaseType.Instructions);
          this.nodeIdToInstructionRange = new Array();
          this.blockIdToInstructionRange = new Array();
          this.instructionToPCOffset = new Array();
          this.pcOffsetToInstructions = new Map();
          this.pcOffsets = new Array();
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
      merge(other) {
          if (!other)
              return;
          if (this.name == "")
              this.name = "merged data";
          this.nodeIdToInstructionRange = new Array();
          this.blockIdToInstructionRange = other.blockIdToInstructionRange;
          this.instructionOffsetToPCOffset = other.instructionOffsetToPCOffset;
          this.codeOffsetsInfo = other.codeOffsetsInfo;
          this.instructionToPCOffset = other.instructionToPCOffset;
          this.pcOffsetToInstructions = other.pcOffsetToInstructions;
          this.pcOffsets = other.pcOffsets;
      }
      instructionToPcOffsets(instruction) {
          return this.instructionToPCOffset[instruction];
      }
      instructionsToKeyPcOffsets(instructionIds) {
          const keyPcOffsets = new Array();
          for (const instructionId of instructionIds) {
              const pcOffset = this.instructionToPCOffset[instructionId];
              if (pcOffset !== undefined)
                  keyPcOffsets.push(pcOffset.gap);
          }
          return keyPcOffsets;
      }
      instructionsForPCOffset(offset) {
          if (this.pcOffsets.length === 0)
              return new Array();
          for (const key of this.pcOffsets) {
              if (key <= offset) {
                  return this.pcOffsetToInstructions.get(key);
              }
          }
          return new Array();
      }
      nodesForInstructions(instructionIds) {
          const nodes = new Array();
          for (const instruction of instructionIds) {
              for (const [nodeId, range] of this.nodeIdToInstructionRange.entries()) {
                  if (!range)
                      continue;
                  const [start, end] = range;
                  if (start == end && instruction == start) {
                      nodes.push(String(nodeId));
                  }
                  if (start <= instruction && instruction < end) {
                      nodes.push(String(nodeId));
                  }
              }
          }
          return nodes;
      }
      nodesForPCOffset(offset) {
          return this.nodesForInstructions(this.instructionsForPCOffset(offset));
      }
      nodesToKeyPcOffsets(nodeIds) {
          let offsets = new Array();
          for (const nodeId of nodeIds) {
              const range = this.nodeIdToInstructionRange[nodeId];
              if (!range)
                  continue;
              offsets = offsets.concat(this.instructionRangeToKeyPcOffsets(range));
          }
          return offsets;
      }
      getInstruction(nodeId) {
          return this.nodeIdToInstructionRange[nodeId] ?? [-1, -1];
      }
      getInstructionRangeForBlock(blockId) {
          return this.blockIdToInstructionRange[blockId] ?? [-1, -1];
      }
      getInstructionMarker(start, end) {
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
      getInstructionKindForPCOffset(offset) {
          if (this.codeOffsetsInfo) {
              if (offset >= this.codeOffsetsInfo.deoptimizationExits) {
                  if (offset >= this.codeOffsetsInfo.pools) {
                      return InstructionKind.Pools;
                  }
                  else if (offset >= this.codeOffsetsInfo.jumpTables) {
                      return InstructionKind.JumpTables;
                  }
                  else {
                      return InstructionKind.DeoptimizationExits;
                  }
              }
              if (offset < this.codeOffsetsInfo.deoptCheck) {
                  return InstructionKind.CodeStartRegister;
              }
              else if (offset < this.codeOffsetsInfo.initPoison) {
                  return InstructionKind.DeoptCheck;
              }
              else if (offset < this.codeOffsetsInfo.blocksStart) {
                  return InstructionKind.InitPoison;
              }
          }
          const keyOffset = this.getKeyPcOffset(offset);
          if (keyOffset != -1) {
              const infos = this.pcOffsetToInstructions.get(keyOffset)
                  .map(instrId => this.instructionToPCOffset[instrId])
                  .filter(info => info.gap !== info.condition);
              if (infos.length > 0) {
                  const info = infos[0];
                  if (!info || info.gap == info.condition)
                      return InstructionKind.Unknown;
                  if (offset < info.arch)
                      return InstructionKind.Gap;
                  if (offset < info.condition)
                      return InstructionKind.Arch;
                  return InstructionKind.Condition;
              }
          }
          return InstructionKind.Unknown;
      }
      instructionKindToReadableName(instructionKind) {
          switch (instructionKind) {
              case InstructionKind.CodeStartRegister:
                  return "Check code register for right value";
              case InstructionKind.DeoptCheck:
                  return "Check if function was marked for deoptimization";
              case InstructionKind.InitPoison:
                  return "Initialization of poison register";
              case InstructionKind.Gap:
                  return "Instruction implementing a gap move";
              case InstructionKind.Arch:
                  return "Instruction implementing the actual machine operation";
              case InstructionKind.Condition:
                  return "Code implementing conditional after instruction";
              case InstructionKind.Pools:
                  return "Data in a pool (e.g. constant pool)";
              case InstructionKind.JumpTables:
                  return "Part of a jump table";
              case InstructionKind.DeoptimizationExits:
                  return "Jump to deoptimization exit";
          }
          return null;
      }
      parseNodeIdToInstructionRangeFromJSON(nodeIdToInstructionJson) {
          if (!nodeIdToInstructionJson)
              return;
          for (const [nodeId, range] of Object.entries(nodeIdToInstructionJson)) {
              this.nodeIdToInstructionRange[nodeId] = range;
          }
      }
      parseBlockIdToInstructionRangeFromJSON(blockIdToInstructionRangeJson) {
          if (!blockIdToInstructionRangeJson)
              return;
          for (const [blockId, range] of Object.entries(blockIdToInstructionRangeJson)) {
              this.blockIdToInstructionRange[blockId] = range;
          }
      }
      parseInstructionOffsetToPCOffsetFromJSON(instructionOffsetToPCOffsetJson) {
          if (!instructionOffsetToPCOffsetJson)
              return;
          for (const [instruction, numberOrInfo] of Object.entries(instructionOffsetToPCOffsetJson)) {
              let info = null;
              if (typeof numberOrInfo === "number") {
                  info = new TurbolizerInstructionStartInfo(numberOrInfo, numberOrInfo, numberOrInfo);
              }
              else {
                  info = new TurbolizerInstructionStartInfo(numberOrInfo.gap, numberOrInfo.arch, numberOrInfo.condition);
              }
              this.instructionToPCOffset[instruction] = info;
              if (!this.pcOffsetToInstructions.has(info.gap)) {
                  this.pcOffsetToInstructions.set(info.gap, new Array());
              }
              this.pcOffsetToInstructions.get(info.gap).push(Number(instruction));
          }
          this.pcOffsets = Array.from(this.pcOffsetToInstructions.keys()).sort((a, b) => b - a);
      }
      parseCodeOffsetsInfoFromJSON(codeOffsetsInfoJson) {
          if (!codeOffsetsInfoJson)
              return;
          this.codeOffsetsInfo = new CodeOffsetsInfo(codeOffsetsInfoJson.codeStartRegisterCheck, codeOffsetsInfoJson.deoptCheck, codeOffsetsInfoJson.initPoison, codeOffsetsInfoJson.blocksStart, codeOffsetsInfoJson.outOfLineCode, codeOffsetsInfoJson.deoptimizationExits, codeOffsetsInfoJson.pools, codeOffsetsInfoJson.jumpTables);
      }
      instructionRangeToKeyPcOffsets([start, end]) {
          if (start == end)
              return [this.instructionToPCOffset[start]];
          return this.instructionToPCOffset.slice(start, end);
      }
  }
  class CodeOffsetsInfo {
      constructor(codeStartRegisterCheck, deoptCheck, initPoison, blocksStart, outOfLineCode, deoptimizationExits, pools, jumpTables) {
          this.codeStartRegisterCheck = codeStartRegisterCheck;
          this.deoptCheck = deoptCheck;
          this.initPoison = initPoison;
          this.blocksStart = blocksStart;
          this.outOfLineCode = outOfLineCode;
          this.deoptimizationExits = deoptimizationExits;
          this.pools = pools;
          this.jumpTables = jumpTables;
      }
  }
  class TurbolizerInstructionStartInfo {
      constructor(gap, arch, condition) {
          this.gap = gap;
          this.arch = arch;
          this.condition = condition;
      }
  }
  var InstructionKind;
  (function (InstructionKind) {
      InstructionKind["Pools"] = "pools";
      InstructionKind["JumpTables"] = "jump-tables";
      InstructionKind["DeoptimizationExits"] = "deoptimization-exits";
      InstructionKind["CodeStartRegister"] = "code-start-register";
      InstructionKind["DeoptCheck"] = "deopt-check";
      InstructionKind["InitPoison"] = "init-poison";
      InstructionKind["Gap"] = "gap";
      InstructionKind["Arch"] = "arch";
      InstructionKind["Condition"] = "condition";
      InstructionKind["Unknown"] = "unknown";
  })(InstructionKind || (InstructionKind = {}));

  // Copyright 2022 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  class InliningPosition {
      constructor(sourceId, inliningPosition) {
          this.sourceId = sourceId;
          this.inliningPosition = inliningPosition;
      }
  }
  class SourcePosition {
      constructor(scriptOffset, inliningId) {
          this.scriptOffset = scriptOffset;
          this.inliningId = inliningId;
      }
      lessOrEquals(other) {
          if (this.inliningId == other.inliningId) {
              return this.scriptOffset - other.scriptOffset;
          }
          return this.inliningId - other.inliningId;
      }
      equals(other) {
          return this.inliningId == other.inliningId && this.scriptOffset == other.scriptOffset;
      }
      isValid() {
          return typeof this.scriptOffset !== undefined && typeof this.inliningId !== undefined;
      }
      toString() {
          return `SP:${this.inliningId}:${this.scriptOffset}`;
      }
  }
  class BytecodePosition {
      constructor(bytecodePosition, inliningId) {
          this.bytecodePosition = bytecodePosition;
          this.inliningId = inliningId;
      }
      isValid() {
          return typeof this.bytecodePosition !== undefined;
      }
      toString() {
          return `BCP:${this.inliningId}:${this.bytecodePosition}`;
      }
  }
  class PositionsContainer {
      constructor() {
          this.nodeIdToSourcePositionMap = new Array();
          this.nodeIdToBytecodePositionMap = new Array();
          this.sourcePositionToNodes = new Map();
          this.bytecodePositionToNodes = new Map();
      }
      addSourcePosition(nodeIdentifier, sourcePosition) {
          this.nodeIdToSourcePositionMap[nodeIdentifier] = sourcePosition;
          const key = sourcePosition.toString();
          if (!this.sourcePositionToNodes.has(key)) {
              this.sourcePositionToNodes.set(key, new Array());
          }
          const nodes = this.sourcePositionToNodes.get(key);
          if (!nodes.includes(nodeIdentifier))
              nodes.push(nodeIdentifier);
      }
      addBytecodePosition(nodeIdentifier, bytecodePosition) {
          this.nodeIdToBytecodePositionMap[nodeIdentifier] = bytecodePosition;
          const key = bytecodePosition.toString();
          if (!this.bytecodePositionToNodes.has(key)) {
              this.bytecodePositionToNodes.set(key, new Array());
          }
          const nodes = this.bytecodePositionToNodes.get(key);
          if (!nodes.includes(nodeIdentifier))
              nodes.push(nodeIdentifier);
      }
      merge(nodes, replacements) {
          for (const node of nodes) {
              const sourcePosition = node.sourcePosition;
              const bytecodePosition = node.bytecodePosition;
              const nodeId = replacements.has(node.id) ? replacements.get(node.id) : node.id;
              if (sourcePosition && !this.nodeIdToSourcePositionMap[nodeId]) {
                  this.addSourcePosition(String(nodeId), sourcePosition);
              }
              if (bytecodePosition && !this.nodeIdToBytecodePositionMap[nodeId]) {
                  this.addBytecodePosition(String(nodeId), bytecodePosition);
              }
          }
      }
  }

  // Copyright 2022 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  class GraphPhase extends Phase {
      constructor(name, dataJson, nodeMap, sources, inlinings) {
          super(name, PhaseType.Graph);
          this.data = new GraphData();
          this.stateType = GraphStateType.NeedToFullRebuild;
          this.instructionsPhase = new InstructionsPhase();
          this.nodeIdToNodeMap = new Array();
          this.originIdToNodesMap = new Map();
          this.positions = new PositionsContainer();
          this.highestNodeId = 0;
          this.rendered = false;
          this.parseDataFromJSON(dataJson, nodeMap, sources, inlinings);
      }
      parseDataFromJSON(dataJson, nodeMap, sources, inlinings) {
          this.data = new GraphData();
          this.parseNodesFromJSON(dataJson.nodes, nodeMap, sources, inlinings);
          this.parseEdgesFromJSON(dataJson.edges);
      }
      parseNodesFromJSON(nodesJSON, nodeMap, sources, inlinings) {
          for (const node of nodesJSON) {
              let sourcePosition = null;
              const sourcePositionJson = node.sourcePosition;
              if (sourcePositionJson) {
                  const scriptOffset = sourcePositionJson.scriptOffset;
                  const inliningId = sourcePositionJson.inliningId;
                  sourcePosition = new SourcePosition(scriptOffset, inliningId);
              }
              let origin = null;
              let bytecodePosition = null;
              const originJson = node.origin;
              if (originJson) {
                  const nodeId = originJson.nodeId;
                  if (nodeId) {
                      origin = new NodeOrigin(nodeId, nodeMap[nodeId], originJson.phase, originJson.reducer);
                      bytecodePosition = nodeMap[nodeId]?.nodeLabel.bytecodePosition;
                  }
                  else {
                      origin = new BytecodeOrigin(originJson.bytecodePosition, originJson.phase, originJson.reducer);
                      const inliningId = sourcePosition ? sourcePosition.inliningId : -1;
                      bytecodePosition = new BytecodePosition(originJson.bytecodePosition, inliningId);
                  }
              }
              const label = new NodeLabel(node.id, node.label, node.title, node.live, node.properties, sourcePosition, bytecodePosition, origin, node.opcode, node.control, node.opinfo, node.type);
              const newNode = new GraphNode(label);
              this.data.nodes.push(newNode);
              this.highestNodeId = Math.max(this.highestNodeId, newNode.id);
              this.nodeIdToNodeMap[newNode.identifier()] = newNode;
              const previous = nodeMap[newNode.id];
              if (!newNode.equals(previous)) {
                  if (previous)
                      newNode.nodeLabel.setInplaceUpdatePhase(this.name);
                  nodeMap[newNode.id] = newNode;
              }
              if (origin && origin instanceof NodeOrigin) {
                  const identifier = origin.identifier();
                  if (!this.originIdToNodesMap.has(identifier)) {
                      this.originIdToNodesMap.set(identifier, new Array());
                  }
                  this.originIdToNodesMap.get(identifier).push(newNode);
              }
              if (sourcePosition) {
                  const inlining = inlinings[sourcePosition.inliningId];
                  if (inlining)
                      sources[inlining.sourceId].sourcePositions.push(sourcePosition);
                  this.positions.addSourcePosition(newNode.identifier(), sourcePosition);
              }
              if (bytecodePosition) {
                  this.positions.addBytecodePosition(newNode.identifier(), bytecodePosition);
              }
          }
      }
      parseEdgesFromJSON(edgesJSON) {
          for (const edge of edgesJSON) {
              const target = this.nodeIdToNodeMap[edge.target];
              const source = this.nodeIdToNodeMap[edge.source];
              const newEdge = new GraphEdge(target, edge.index, source, edge.type);
              this.data.edges.push(newEdge);
              target.inputs.push(newEdge);
              source.outputs.push(newEdge);
              if (edge.type === "control") {
                  source.cfg = true;
              }
          }
      }
  }
  class GraphData {
      constructor() {
          this.nodes = new Array();
          this.edges = new Array();
      }
  }
  var GraphStateType;
  (function (GraphStateType) {
      GraphStateType[GraphStateType["NeedToFullRebuild"] = 0] = "NeedToFullRebuild";
      GraphStateType[GraphStateType["Cached"] = 1] = "Cached";
  })(GraphStateType || (GraphStateType = {}));

  // Copyright 2022 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  class DisassemblyPhase extends Phase {
      constructor(name, data, blockIdToOffsetJson) {
          super(name, PhaseType.Disassembly);
          this.data = data;
          this.blockIdToOffset = new Array();
          this.blockStartPCtoBlockIds = new Map();
          this.parseBlockIdToOffsetFromJSON(blockIdToOffsetJson);
      }
      hasBlockStartInfo() {
          return this.blockIdToOffset.length > 0;
      }
      getBlockIdsForOffset(offset) {
          return this.blockStartPCtoBlockIds.get(offset);
      }
      parseBlockIdToOffsetFromJSON(blockIdToOffsetJson) {
          if (!blockIdToOffsetJson)
              return;
          for (const [blockId, offset] of Object.entries(blockIdToOffsetJson)) {
              this.blockIdToOffset[blockId] = offset;
              if (!this.blockStartPCtoBlockIds.has(offset)) {
                  this.blockStartPCtoBlockIds.set(offset, new Array());
              }
              this.blockStartPCtoBlockIds.get(offset).push(Number(blockId));
          }
      }
  }

  // Copyright 2022 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  class SchedulePhase extends Phase {
      constructor(name, dataJson) {
          super(name, PhaseType.Schedule);
          this.createNode = match => {
              let inputs = new Array();
              if (match.groups.args) {
                  const nodeIdsString = match.groups.args.replace(/\s/g, "");
                  const nodeIdStrings = nodeIdsString.split(",");
                  inputs = nodeIdStrings.map(n => Number.parseInt(n, 10));
              }
              const nodeId = Number.parseInt(match.groups.id, 10);
              const node = new ScheduleNode(nodeId, match.groups.label, inputs);
              if (match.groups.blocks) {
                  const nodeIdsString = match.groups.blocks.replace(/\s/g, "").replace(/B/g, "");
                  const nodeIdStrings = nodeIdsString.split(",");
                  this.data.lastBlock().successors = nodeIdStrings.map(n => Number.parseInt(n, 10));
              }
              this.data.nodes[node.id] = node;
              this.data.lastBlock().nodes.push(node);
          };
          this.createBlock = match => {
              let predecessors = new Array();
              if (match.groups.in) {
                  const blockIdsString = match.groups.in.replace(/\s/g, "").replace(/B/g, "");
                  const blockIdStrings = blockIdsString.split(",");
                  predecessors = blockIdStrings.map(n => Number.parseInt(n, 10));
              }
              const blockRpo = Number.parseInt(match.groups.rpo, 10);
              const blockId = Number.parseInt(match.groups.id, 10);
              let blockCount = -1;
              if (match.groups.count !== undefined) {
                  blockCount = Number.parseInt(match.groups.count, 10);
              }
              const block = new ScheduleBlock(blockRpo, blockId, blockCount, match.groups.deferred !== undefined, predecessors.sort());
              this.data.blocksRpo[block.rpo] = block;
          };
          this.setGotoSuccessor = match => {
              this.data.lastBlock().successors =
                  [Number.parseInt(match.groups.successor.replace(/\s/g, ""), 10)];
          };
          this.parsingRules = [
              {
                  lineRegexps: [
                      /^\s*(?<id>\d+):\ (?<label>.*)\((?<args>.*)\)$/,
                      /^\s*(?<id>\d+):\ (?<label>.*)\((?<args>.*)\)\ ->\ (?<blocks>.*)$/,
                      /^\s*(?<id>\d+):\ (?<label>.*)$/
                  ],
                  process: this.createNode
              },
              {
                  lineRegexps: [
                      /^\s*---\s*BLOCK\ B(?<rpo>\d+)\ id(?<id>\d+)\ PGO Execution Count:(?<count>\d+)\s*(?<deferred>\(deferred\))?(\ <-\ )?(?<in>[^-]*)?\ ---$/,
                      /^\s*---\s*BLOCK\ B(?<rpo>\d+)\ id(?<id>\d+)\s*(?<deferred>\(deferred\))?(\ <-\ )?(?<in>[^-]*)?\ ---$/,
                      /^\s*---\s*BLOCK\ B(?<rpo>\d+)\s*(?<deferred>\(deferred\))?(\ <-\ )?(?<in>[^-]*)?\ ---$/
                  ],
                  process: this.createBlock
              },
              {
                  lineRegexps: [/^\s*Goto\s*->\s*B(?<successor>\d+)\s*$/],
                  process: this.setGotoSuccessor
              }
          ];
          this.data = new ScheduleData();
          this.instructionsPhase = new InstructionsPhase();
          this.positions = new PositionsContainer();
          this.parseScheduleFromJSON(dataJson);
      }
      parseScheduleFromJSON(dataJson) {
          const lines = dataJson.split(/[\n]/);
          nextLine: for (const line of lines) {
              for (const rule of this.parsingRules) {
                  for (const lineRegexp of rule.lineRegexps) {
                      const match = line.match(lineRegexp);
                      if (match) {
                          rule.process(match);
                          continue nextLine;
                      }
                  }
              }
              console.warn(`Unmatched schedule line \"${line}\"`);
          }
      }
  }
  class ScheduleNode {
      constructor(id, label, inputs) {
          this.id = id;
          this.label = label;
          this.inputs = inputs;
      }
      toString() {
          return `${this.id}: ${this.label}(${this.inputs.join(", ")})`;
      }
  }
  class ScheduleBlock {
      constructor(rpo, id, count, deferred, predecessors) {
          this.rpo = rpo;
          this.id = id;
          this.count = count;
          this.deferred = deferred;
          this.predecessors = predecessors;
          this.successors = new Array();
          this.nodes = new Array();
      }
  }
  class ScheduleData {
      constructor() {
          this.nodes = new Array();
          this.blocksRpo = new Array();
      }
      lastBlock() {
          if (this.blocksRpo.length == 0)
              return null;
          return this.blocksRpo[this.blocksRpo.length - 1];
      }
  }

  // Copyright 2022 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  class SequencePhase extends Phase {
      constructor(name, blocksJSON, registerAllocationJSON) {
          super(name, PhaseType.Sequence);
          this.instructionsPhase = new InstructionsPhase();
          this.positions = new PositionsContainer();
          this.parseBlocksFromJSON(blocksJSON);
          this.parseRegisterAllocationFromJSON(registerAllocationJSON);
      }
      getNumInstructions() {
          const lastBlock = this.lastBlock();
          return lastBlock.instructions[lastBlock.instructions.length - 1].id + 1;
      }
      lastBlock() {
          if (this.blocks.length == 0)
              return null;
          return this.blocks[this.blocks.length - 1];
      }
      parseBlocksFromJSON(blocksJSON) {
          if (!blocksJSON || blocksJSON.length == 0)
              return;
          this.blocks = new Array();
          this.instructions = new Array();
          for (const block of blocksJSON) {
              const newBlock = new SequenceBlock(block.id, block.deferred, block.loopHeader, block.loopEnd, block.predecessors, block.successors);
              this.blocks.push(newBlock);
              this.parseBlockInstructions(block.instructions);
              this.parseBlockPhis(block.phis);
          }
      }
      parseBlockInstructions(instructionsJSON) {
          if (!instructionsJSON || instructionsJSON.length == 0)
              return;
          for (const instruction of instructionsJSON) {
              const newInstruction = new SequenceBlockInstruction(instruction.id, instruction.opcode, instruction.flags, instruction.temps);
              for (const input of instruction.inputs) {
                  newInstruction.inputs.push(this.parseOperandFromJSON(input));
              }
              for (const output of instruction.outputs) {
                  newInstruction.outputs.push(this.parseOperandFromJSON(output));
              }
              for (const gap of instruction.gaps) {
                  const newGap = new Array();
                  for (const [destination, source] of gap) {
                      newGap.push([this.parseOperandFromJSON(destination), this.parseOperandFromJSON(source)]);
                  }
                  newInstruction.gaps.push(newGap);
              }
              this.lastBlock().instructions.push(newInstruction);
              this.instructions.push(newInstruction);
          }
      }
      parseBlockPhis(phisJSON) {
          if (!phisJSON || phisJSON.length == 0)
              return;
          for (const phi of phisJSON) {
              const newBlockPhi = new SequenceBlockPhi(phi.operands, this.parseOperandFromJSON(phi.output));
              this.lastBlock().phis.push(newBlockPhi);
          }
      }
      parseRegisterAllocationFromJSON(registerAllocationJSON) {
          if (!registerAllocationJSON)
              return;
          this.registerAllocation = new RegisterAllocation();
          this.registerAllocation.fixedDoubleLiveRanges =
              this.parseRangesFromJSON(registerAllocationJSON.fixedDoubleLiveRanges);
          this.registerAllocation.fixedLiveRanges =
              this.parseRangesFromJSON(registerAllocationJSON.fixedLiveRanges);
          this.registerAllocation.liveRanges =
              this.parseRangesFromJSON(registerAllocationJSON.liveRanges);
      }
      parseRangesFromJSON(rangesJSON) {
          if (!rangesJSON)
              return null;
          const parsedRanges = new Array();
          for (const [idx, range] of Object.entries(rangesJSON)) {
              const newRange = new Range(range.isDeferred, range.instructionRange);
              for (const childRange of range.childRanges) {
                  let operand = null;
                  if (childRange.op) {
                      if (typeof childRange.op === "string") {
                          operand = childRange.op;
                      }
                      else {
                          operand = this.parseOperandFromJSON(childRange.op);
                      }
                  }
                  const newChildRange = new ChildRange(childRange.id, childRange.type, operand, childRange.intervals, childRange.uses);
                  newRange.childRanges.push(newChildRange);
              }
              parsedRanges[idx] = newRange;
          }
          return parsedRanges;
      }
      parseOperandFromJSON(operandJSON) {
          return new SequenceBlockOperand(operandJSON.type, operandJSON.text, operandJSON.tooltip);
      }
  }
  class SequenceBlock {
      constructor(id, deferred, loopHeader, loopEnd, predecessors, successors) {
          this.id = id;
          this.deferred = deferred;
          this.loopHeader = loopHeader;
          this.loopEnd = loopEnd;
          this.predecessors = predecessors;
          this.successors = successors;
          this.instructions = new Array();
          this.phis = new Array();
      }
  }
  class SequenceBlockInstruction {
      constructor(id, opcode, flags, temps) {
          this.id = id;
          this.opcode = opcode;
          this.flags = flags;
          this.inputs = new Array();
          this.outputs = new Array();
          this.gaps = new Array();
          this.temps = temps;
      }
  }
  class SequenceBlockPhi {
      constructor(operands, output) {
          this.operands = operands;
          this.output = output;
      }
  }
  class RegisterAllocation {
      constructor() {
          this.fixedDoubleLiveRanges = new Array();
          this.fixedLiveRanges = new Array();
          this.liveRanges = new Array();
      }
  }
  class Range {
      constructor(isDeferred, instructionRange) {
          this.isDeferred = isDeferred;
          this.instructionRange = instructionRange;
          this.childRanges = new Array();
      }
      fixedRegisterName() {
          const operation = this.childRanges[0].op;
          if (operation instanceof SequenceBlockOperand) {
              return operation.text;
          }
          return operation;
      }
  }
  class ChildRange {
      constructor(id, type, op, intervals, uses) {
          this.id = id;
          this.type = type;
          this.op = op;
          this.intervals = intervals;
          this.uses = uses;
      }
      getTooltip(registerIndex) {
          switch (this.type) {
              case "none":
                  return new RangeToolTip(INTERVAL_TEXT_FOR_NONE, false);
              case "spill_range":
                  return new RangeToolTip(`${INTERVAL_TEXT_FOR_STACK}${registerIndex}`, true);
              default:
                  if (this.op instanceof SequenceBlockOperand && this.op.type == "constant") {
                      return new RangeToolTip(INTERVAL_TEXT_FOR_CONST, false);
                  }
                  else {
                      if (this.op instanceof SequenceBlockOperand && this.op.text) {
                          return new RangeToolTip(this.op.text, true);
                      }
                      else if (typeof this.op === "string") {
                          return new RangeToolTip(this.op, true);
                      }
                  }
          }
          return new RangeToolTip("", false);
      }
      isFloatingPoint() {
          return this.op instanceof SequenceBlockOperand && this.op.tooltip.includes("Float");
      }
  }
  class RangeToolTip {
      constructor(text, isId) {
          this.text = text;
          this.isId = isId;
      }
  }
  class SequenceBlockOperand {
      constructor(type, text, tooltip) {
          this.type = type;
          this.text = text;
          this.tooltip = tooltip;
      }
  }

  // Copyright 2022 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  class Source {
      constructor(sourceName, functionName, sourceText, sourceId, backwardsCompatibility, startPosition, endPosition) {
          this.sourceName = sourceName;
          this.functionName = functionName;
          this.sourceText = sourceText;
          this.sourceId = sourceId;
          this.backwardsCompatibility = backwardsCompatibility;
          this.startPosition = startPosition;
          this.endPosition = endPosition;
          this.sourcePositions = new Array();
      }
      toString() {
          return `${this.sourceName}:${this.functionName}`;
      }
  }
  class BytecodeSource {
      constructor(sourceId, inliningIds, functionName, data, constantPool) {
          this.sourceId = sourceId;
          this.inliningIds = inliningIds;
          this.functionName = functionName;
          this.data = data;
          this.constantPool = constantPool;
      }
  }
  class BytecodeSourceData {
      constructor(offset, disassembly) {
          this.offset = offset;
          this.disassembly = disassembly;
      }
  }

  // Copyright 2022 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  class TurboshaftCustomDataPhase extends Phase {
      constructor(name, dataTarget, dataJSON) {
          super(name, PhaseType.TurboshaftCustomData);
          this.dataTarget = dataTarget;
          this.data = new Array();
          this.parseDataFromJSON(dataJSON);
      }
      parseDataFromJSON(dataJSON) {
          if (!dataJSON)
              return;
          for (const item of dataJSON) {
              this.data[item.key] = item.value;
          }
      }
  }
  var DataTarget;
  (function (DataTarget) {
      DataTarget["Nodes"] = "operations";
      DataTarget["Blocks"] = "blocks";
  })(DataTarget || (DataTarget = {}));

  // Copyright 2022 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  const SUBSCRIPT_DY = "50px";
  var Opcode;
  (function (Opcode) {
      Opcode["Constant"] = "Constant";
      Opcode["WordBinop"] = "WordBinop";
      Opcode["Comparison"] = "Comparison";
      Opcode["Shift"] = "Shift";
      Opcode["Load"] = "Load";
      Opcode["Store"] = "Store";
      Opcode["DeoptimizeIf"] = "DeoptimizeIf";
      Opcode["Goto"] = "Goto";
      Opcode["Branch"] = "Branch";
  })(Opcode || (Opcode = {}));
  var BranchHint;
  (function (BranchHint) {
      BranchHint["None"] = "None";
      BranchHint["True"] = "True";
      BranchHint["False"] = "False";
  })(BranchHint || (BranchHint = {}));
  var RegisterRepresentation;
  (function (RegisterRepresentation) {
      RegisterRepresentation["Word32"] = "Word32";
      RegisterRepresentation["Word64"] = "Word64";
      RegisterRepresentation["Float32"] = "Float32";
      RegisterRepresentation["Float64"] = "Float64";
      RegisterRepresentation["Tagged"] = "Tagged";
      RegisterRepresentation["Compressed"] = "Compressed";
      RegisterRepresentation["Simd128"] = "Simd128";
      RegisterRepresentation["Simd256"] = "Simd256";
  })(RegisterRepresentation || (RegisterRepresentation = {}));
  function escapeHTML(str) {
      return str
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
  }
  function rrString(rep) {
      switch (rep) {
          case RegisterRepresentation.Word32: return "w32";
          case RegisterRepresentation.Word64: return "w64";
          case RegisterRepresentation.Float32: return "f32";
          case RegisterRepresentation.Float64: return "f64";
          case RegisterRepresentation.Tagged: return "t";
          case RegisterRepresentation.Compressed: return "c";
          case RegisterRepresentation.Simd128: return "s128";
          case RegisterRepresentation.Simd256: return "s256";
      }
  }
  var WordRepresentation;
  (function (WordRepresentation) {
      WordRepresentation["Word32"] = "Word32";
      WordRepresentation["Word64"] = "Word64";
  })(WordRepresentation || (WordRepresentation = {}));
  function wrString(rep) {
      switch (rep) {
          case WordRepresentation.Word32: return "w32";
          case WordRepresentation.Word64: return "w64";
      }
  }
  var MemoryRepresentation;
  (function (MemoryRepresentation) {
      MemoryRepresentation["Int8"] = "Int8";
      MemoryRepresentation["Uint8"] = "Uint8";
      MemoryRepresentation["Int16"] = "Int16";
      MemoryRepresentation["Uint16"] = "Uint16";
      MemoryRepresentation["Int32"] = "Int32";
      MemoryRepresentation["Uint32"] = "Uint32";
      MemoryRepresentation["Int64"] = "Int64";
      MemoryRepresentation["Uint64"] = "Uint64";
      MemoryRepresentation["Float16"] = "Float16";
      MemoryRepresentation["Float32"] = "Float32";
      MemoryRepresentation["Float64"] = "Float64";
      MemoryRepresentation["AnyTagged"] = "AnyTagged";
      MemoryRepresentation["TaggedPointer"] = "TaggedPointer";
      MemoryRepresentation["TaggedSigned"] = "TaggedSigned";
      MemoryRepresentation["UncompressedTaggedPointer"] = "UncompressedTaggedPointer";
      MemoryRepresentation["ProtectedPointer"] = "ProtectedPointer";
      MemoryRepresentation["IndirectPointer"] = "IndirectPointer";
      MemoryRepresentation["SandboxedPointer"] = "SandboxedPointer";
      MemoryRepresentation["Simd128"] = "Simd128";
      MemoryRepresentation["Simd256"] = "Simd256";
  })(MemoryRepresentation || (MemoryRepresentation = {}));
  function mrString(rep) {
      switch (rep) {
          case MemoryRepresentation.Int8: return "i8";
          case MemoryRepresentation.Uint8: return "u8";
          case MemoryRepresentation.Int16: return "i16";
          case MemoryRepresentation.Uint16: return "u16";
          case MemoryRepresentation.Int32: return "i32";
          case MemoryRepresentation.Uint32: return "u32";
          case MemoryRepresentation.Int64: return "i64";
          case MemoryRepresentation.Uint64: return "u64";
          case MemoryRepresentation.Float16: return "f16";
          case MemoryRepresentation.Float32: return "f32";
          case MemoryRepresentation.Float64: return "f64";
          case MemoryRepresentation.AnyTagged: return "t";
          case MemoryRepresentation.TaggedPointer: return "tp";
          case MemoryRepresentation.TaggedSigned: return "ts";
          case MemoryRepresentation.UncompressedTaggedPointer: return "utp";
          case MemoryRepresentation.ProtectedPointer: return "pp";
          case MemoryRepresentation.IndirectPointer: return "ip";
          case MemoryRepresentation.SandboxedPointer: return "sp";
          case MemoryRepresentation.Simd128: return "s128";
          case MemoryRepresentation.Simd256: return "s256";
      }
  }
  function toEnum(type, option) {
      for (const key of Object.keys(type)) {
          if (option === type[key]) {
              const r = (type[key]);
              return r;
          }
      }
      throw new CompactOperationError(`Option "${option}" not recognized as ${type}`);
  }
  function chooseOption(option, otherwise, ...candidates) {
      for (var i = 0; i < candidates.length; ++i) {
          if (option === candidates[i])
              return i;
      }
      if (otherwise !== undefined)
          return otherwise;
      throw new CompactOperationError(`Option "${option}" is unexpected. Expecing any of: ${candidates}`);
  }
  class CompactOperationError {
      constructor(message) {
          this.message = message;
      }
  }
  class CompactOperationPrinter {
      constructor(operation) {
          this.operation = operation;
      }
      IsFullyInlined() { return false; }
      PrintInLine() { return ""; }
      GetInputCount() {
          return this.operation.inputs.length;
      }
      parseOptions(properties, expectedCount = -1) {
          if (!properties.startsWith("[") || !properties.endsWith("]")) {
              throw new CompactOperationError(`Unexpected options format: "${properties}"`);
          }
          const options = properties.substring(1, properties.length - 1)
              .split(",")
              .map(o => o.trim());
          if (expectedCount > -1) {
              if (options.length != expectedCount) {
                  throw new CompactOperationError(`Unexpected option count: ${options} (expected ${expectedCount})`);
              }
          }
          return options;
      }
      sub(text) {
          return `<tspan class="subscript" dy="${SUBSCRIPT_DY}">${text}</tspan><tspan dy="-${SUBSCRIPT_DY}"> </tspan>`;
      }
  }
  var Constant_Kind;
  (function (Constant_Kind) {
      Constant_Kind["Word32"] = "word32";
      Constant_Kind["Word64"] = "word64";
      Constant_Kind["HeapObject"] = "heap object";
      Constant_Kind["External"] = "external";
  })(Constant_Kind || (Constant_Kind = {}));
  class CompactOperationPrinter_Constant extends CompactOperationPrinter {
      constructor(operation, properties) {
          super(operation);
          const options = this.parseOptions(properties, 1);
          // Format of {options[0]} is "kind: value".
          let [key, value] = options[0].split(":").map(x => x.trim());
          this.kind = toEnum(Constant_Kind, key);
          this.value = value;
          // We try to strip the address away if we have something else.
          let index = this.value.search(/\s|</);
          if (this.value.startsWith("0x") && index > 0) {
              this.value = this.value.substring(index);
          }
      }
      IsFullyInlined() {
          return this.kind == Constant_Kind.Word32 || this.kind == Constant_Kind.Word64;
      }
      Print(id, input) {
          switch (this.kind) {
              case Constant_Kind.Word32:
              case Constant_Kind.Word64:
                  // Those are fully inlined.
                  return "";
              case Constant_Kind.HeapObject:
              case Constant_Kind.External:
                  return `v${id} = ${escapeHTML(this.value)}`;
          }
      }
      PrintInLine() {
          switch (this.kind) {
              case Constant_Kind.Word32: return `${this.value}${this.sub("w32")}`;
              case Constant_Kind.Word64: return `${this.value}${this.sub("w64")}`;
              case Constant_Kind.HeapObject:
              case Constant_Kind.External:
                  // Not inlined.
                  return "";
          }
      }
  }
  class CompactOperationPrinter_Goto_Branch extends CompactOperationPrinter {
      constructor(operation, properties) {
          super(operation);
          this.opcode = toEnum(Opcode, operation.title);
          if (this.opcode == Opcode.Goto) {
              const options = this.parseOptions(properties, 2);
              this.true_block = options[0];
              // options[1] is back_edge flag and we don't use it here.
          }
          else {
              const options = this.parseOptions(properties, 3);
              this.true_block = options[0];
              this.false_block = options[1];
              this.hint = toEnum(BranchHint, options[2]);
          }
      }
      Print(id, input) {
          if (this.opcode == Opcode.Goto) {
              return `${id}: Goto ${this.true_block}`;
          }
          else {
              switch (this.hint) {
                  case BranchHint.None:
                      return `${id}: Branch(${input(0)}) ${this.true_block}, ${this.false_block}`;
                  case BranchHint.True:
                      return `${id}: Branch(${input(0)}) [${this.true_block}], ${this.false_block}`;
                  case BranchHint.False:
                      return `${id}: Branch(${input(0)}) ${this.true_block}, [${this.false_block}]`;
              }
          }
      }
  }
  class CompactOperationPrinter_DeoptimizeIf extends CompactOperationPrinter {
      constructor(operation, properties) {
          super(operation);
          const options = this.parseOptions(properties);
          this.negated = options[0] == "negated";
      }
      Print(id, input) {
          return `${id}: DeoptimizeIf(${this.negated ? "!" : ""}${input(0)}, ${input(1)})`;
      }
  }
  var Shift_Kind;
  (function (Shift_Kind) {
      Shift_Kind["ShiftRightArithmeticShiftOutZeros"] = "ShiftRightArithmeticShiftOutZeros";
      Shift_Kind["ShiftRightArithmetic"] = "ShiftRightArithmetic";
      Shift_Kind["ShiftRightLogical"] = "ShiftRightLogical";
      Shift_Kind["ShiftLeft"] = "ShiftLeft";
      Shift_Kind["RotateRight"] = "RotateRight";
      Shift_Kind["RotateLeft"] = "RotateLeft";
  })(Shift_Kind || (Shift_Kind = {}));
  class CompactOperationPrinter_Shift extends CompactOperationPrinter {
      constructor(operation, properties) {
          super(operation);
          const options = this.parseOptions(properties, 2);
          this.kind = toEnum(Shift_Kind, options[0]);
          this.rep = toEnum(WordRepresentation, options[1]);
      }
      Print(id, input) {
          let symbol;
          let subscript = "";
          switch (this.kind) {
              case Shift_Kind.ShiftRightArithmeticShiftOutZeros:
                  symbol = ">>";
                  subscript = "a0";
                  break;
              case Shift_Kind.ShiftRightArithmetic:
                  symbol = ">>";
                  subscript = "a";
                  break;
              case Shift_Kind.ShiftRightLogical:
                  symbol = ">>";
                  subscript = "l";
                  break;
              case Shift_Kind.ShiftLeft:
                  symbol = "<<";
                  subscript = "l";
                  break;
              case Shift_Kind.RotateRight:
                  symbol = ">>";
                  subscript = "ror";
                  break;
              case Shift_Kind.RotateLeft:
                  symbol = "<<";
                  subscript = "rol";
                  break;
          }
          if (subscript.length > 0)
              subscript += ",";
          switch (this.rep) {
              case WordRepresentation.Word32:
                  subscript += "w32";
                  break;
              case WordRepresentation.Word64:
                  subscript += "w64";
                  break;
          }
          return `v${id} = ${input(0)} ${symbol}${this.sub(subscript)} ${input(1)}`;
      }
  }
  var WordBinop_Kind;
  (function (WordBinop_Kind) {
      WordBinop_Kind["Add"] = "Add";
      WordBinop_Kind["Mul"] = "Mul";
      WordBinop_Kind["SignedMulOverflownBits"] = "SignedMulOverflownBits";
      WordBinop_Kind["UnsignedMulOverflownBits"] = "UnsignedMulOverflownBits";
      WordBinop_Kind["BitwiseAnd"] = "BitwiseAnd";
      WordBinop_Kind["BitwiseOr"] = "BitwiseOr";
      WordBinop_Kind["BitwiseXor"] = "BitwiseXor";
      WordBinop_Kind["Sub"] = "Sub";
      WordBinop_Kind["SignedDiv"] = "SignedDiv";
      WordBinop_Kind["UnsignedDiv"] = "UnsignedDiv";
      WordBinop_Kind["SignedMod"] = "SignedMod";
      WordBinop_Kind["UnsignedMod"] = "UnsignedMod";
  })(WordBinop_Kind || (WordBinop_Kind = {}));
  class CompactOperationPrinter_WordBinop extends CompactOperationPrinter {
      constructor(operation, properties) {
          super(operation);
          const options = this.parseOptions(properties, 2);
          this.kind = toEnum(WordBinop_Kind, options[0]);
          this.rep = toEnum(WordRepresentation, options[1]);
      }
      Print(id, input) {
          let symbol;
          let subscript = "";
          switch (this.kind) {
              case WordBinop_Kind.Add:
                  symbol = "+";
                  break;
              case WordBinop_Kind.Mul:
                  symbol = "*";
                  break;
              case WordBinop_Kind.SignedMulOverflownBits:
                  symbol = "*";
                  subscript = "s,of";
                  break;
              case WordBinop_Kind.UnsignedMulOverflownBits:
                  symbol = "*";
                  subscript = "u,of";
                  break;
              case WordBinop_Kind.BitwiseAnd:
                  symbol = "&";
                  break;
              case WordBinop_Kind.BitwiseOr:
                  symbol = "|";
                  break;
              case WordBinop_Kind.BitwiseXor:
                  symbol = "^";
                  break;
              case WordBinop_Kind.Sub:
                  symbol = "-";
                  break;
              case WordBinop_Kind.SignedDiv:
                  symbol = "/";
                  subscript = "s";
                  break;
              case WordBinop_Kind.UnsignedDiv:
                  symbol = "/";
                  subscript = "u";
                  break;
              case WordBinop_Kind.SignedMod:
                  symbol = "%";
                  subscript = "s";
                  break;
              case WordBinop_Kind.UnsignedMod:
                  symbol = "%";
                  subscript = "u";
                  break;
          }
          if (subscript.length > 0)
              subscript += ",";
          subscript += wrString(this.rep);
          return `v${id} = ${input(0)} ${symbol}${this.sub(subscript)} ${input(1)}`;
      }
  }
  var Comparison_Kind;
  (function (Comparison_Kind) {
      Comparison_Kind["Equal"] = "Equal";
      Comparison_Kind["SignedLessThan"] = "SignedLessThan";
      Comparison_Kind["SignedLessThanOrEqual"] = "SignedLessThanOrEqual";
      Comparison_Kind["UnsignedLessThan"] = "UnsignedLessThan";
      Comparison_Kind["UnsignedLessThanOrEqual"] = "UnsignedLessThanOrEqual";
  })(Comparison_Kind || (Comparison_Kind = {}));
  class CompactOperationPrinter_Comparison extends CompactOperationPrinter {
      constructor(operation, properties) {
          super(operation);
          const options = this.parseOptions(properties, 2);
          this.kind = toEnum(Comparison_Kind, options[0]);
          this.rep = toEnum(RegisterRepresentation, options[1]);
      }
      Print(id, input) {
          let symbol;
          let subscript = "";
          switch (this.kind) {
              case Comparison_Kind.Equal:
                  symbol = "==";
                  break;
              case Comparison_Kind.SignedLessThan:
                  symbol = "<";
                  subscript = "s";
                  break;
              case Comparison_Kind.SignedLessThanOrEqual:
                  symbol = "<=";
                  subscript = "s";
                  break;
              case Comparison_Kind.UnsignedLessThan:
                  symbol = "<";
                  subscript = "u";
                  break;
              case Comparison_Kind.UnsignedLessThanOrEqual:
                  symbol = "<=";
                  subscript = "u";
                  break;
          }
          if (subscript.length > 0)
              subscript += ",";
          subscript += rrString(this.rep);
          return `v${id} = ${input(0)} ${symbol}${this.sub(subscript)} ${input(1)}`;
      }
  }
  class CompactOperationPrinter_Load extends CompactOperationPrinter {
      constructor(operation, properties) {
          super(operation);
          this.maybeUnaligned = false;
          this.withTrapHandler = false;
          this.elementSizeLog2 = 0;
          this.offset = 0;
          const options = this.parseOptions(properties);
          let idx = 0;
          this.taggedBase = chooseOption(options[idx++], undefined, "tagged base", "raw") === 0;
          if (chooseOption(options[idx], 1, "unaligned") === 0) {
              this.maybeUnaligned = true;
              ++idx;
          }
          if (chooseOption(options[idx], 1, "protected") === 0) {
              this.withTrapHandler = true;
              ++idx;
          }
          this.loadedRep = toEnum(MemoryRepresentation, options[idx++]);
          this.resultRep = toEnum(RegisterRepresentation, options[idx++]);
          if (idx < options.length && options[idx].startsWith("element size: 2^")) {
              this.elementSizeLog2 = parseInt(options[idx].substring("element size: 2^".length));
              ++idx;
          }
          if (idx < options.length) {
              if (!options[idx].startsWith("offset: ")) {
                  throw new CompactOperationError(`Option "${options[idx]}" expected to start with "offset: "`);
              }
              this.offset = parseInt(options[idx].substring("offset: ".length));
          }
      }
      Print(id, input) {
          const prefix = `v${id} =${this.sub(rrString(this.resultRep))}`;
          let offsetStr = "";
          if (this.offset > 0)
              offsetStr = ` + ${this.offset}`;
          else if (this.offset < 0)
              offsetStr = ` - ${-this.offset}`;
          if (this.GetInputCount() === 1) {
              return prefix + ` [${input(0)}${this.sub(this.taggedBase ? "t" : "r")}${offsetStr}]${this.sub(mrString(this.loadedRep))}`;
          }
          else if (this.GetInputCount() === 2) {
              let indexStr = `+ ${input(1)}`;
              if (this.elementSizeLog2 > 0)
                  indexStr += `*${2 ** this.elementSizeLog2}`;
              return prefix + ` [${input(0)}${this.sub(this.taggedBase ? "t" : "r")}${indexStr}${offsetStr}]${this.sub(mrString(this.loadedRep))}`;
          }
          else {
              throw new CompactOperationError("Unexpected input count in Load operation");
          }
      }
  }
  var WriteBarrierKind;
  (function (WriteBarrierKind) {
      WriteBarrierKind["NoWriteBarrier"] = "NoWriteBarrier";
      WriteBarrierKind["AssertNoWriteBarrier"] = "AssertNoWriteBarrier";
      WriteBarrierKind["MapWriteBarrier"] = "MapWriteBarrier";
      WriteBarrierKind["PointerWriteBarrier"] = "PointerWriteBarrier";
      WriteBarrierKind["IndirectPointerWriteBarrier"] = "IndirectPointerWriteBarrier";
      WriteBarrierKind["EphemeronKeyWriteBarrier"] = "EphemeronKeyWriteBarrier";
      WriteBarrierKind["FullWriteBarrier"] = "FullWriteBarrier";
  })(WriteBarrierKind || (WriteBarrierKind = {}));
  class CompactOperationPrinter_Store extends CompactOperationPrinter {
      constructor(operation, properties) {
          super(operation);
          this.maybeUnaligned = false;
          this.withTrapHandler = false;
          this.elementSizeLog2 = 0;
          this.offset = 0;
          this.maybeInitializingOrTransitioning = false;
          const options = this.parseOptions(properties);
          let idx = 0;
          this.taggedBase = chooseOption(options[idx++], undefined, "tagged base", "raw") === 0;
          if (chooseOption(options[idx], 1, "unaligned") === 0) {
              this.maybeUnaligned = true;
              ++idx;
          }
          if (chooseOption(options[idx], 1, "protected") === 0) {
              this.withTrapHandler = true;
              ++idx;
          }
          this.storedRep = toEnum(MemoryRepresentation, options[idx++]);
          this.writeBarrier = toEnum(WriteBarrierKind, options[idx++]);
          if (idx < options.length && options[idx].startsWith("element size: 2^")) {
              this.elementSizeLog2 = parseInt(options[idx].substring("element size: 2^".length));
              ++idx;
          }
          if (idx < options.length && options[idx].startsWith("offset: ")) {
              this.offset = parseInt(options[idx++].substring("offset: ".length));
          }
          if (idx < options.length) {
              if (options[idx] !== "initializing") {
                  throw new CompactOperationError(`Option "${options[idx]}" expected to be "initializing`);
              }
              this.maybeInitializingOrTransitioning = true;
          }
      }
      Print(id, input) {
          let prefix = `${id}: [${input(0)}${this.sub(this.taggedBase ? "t" : "r")}`;
          let offsetStr = "";
          if (this.offset > 0)
              offsetStr = ` + ${this.offset}`;
          else if (this.offset < 0)
              offsetStr = ` - ${-this.offset}`;
          if (this.GetInputCount() === 2) {
              return prefix + `${offsetStr}]${this.sub(mrString(this.storedRep))} = ${input(1)}`;
          }
          else if (this.GetInputCount() === 3) {
              let indexStr = `+ ${input(1)}`;
              if (this.elementSizeLog2 > 0)
                  indexStr += `*${2 ** this.elementSizeLog2}`;
              return prefix + `${indexStr}${offsetStr}]${this.sub(mrString(this.storedRep))} = ${input(2)}`;
          }
          else {
              throw new CompactOperationError("Unexpected input count in Store operation");
          }
      }
  }
  class TurboshaftGraphOperation extends Node$1 {
      constructor(id, title, block, sourcePosition, bytecodePosition, origin, opEffects) {
          super(id);
          this.title = title;
          this.block = block;
          this.sourcePosition = sourcePosition;
          this.bytecodePosition = bytecodePosition;
          this.origin = origin;
          this.opEffects = opEffects;
          this.visible = true;
          this.compactPrinter = null;
      }
      propertiesChanged(customData) {
          // The properties have been parsed from the JSON, we need to update
          // operation printing.
          const properties = customData.data[this.id];
          this.compactPrinter = this.parseOperationForCompactRepresentation(properties);
      }
      getHeight(showCustomData, compactView) {
          if (compactView && this.compactPrinter?.IsFullyInlined())
              return 0;
          return showCustomData ? this.labelBox.height * 2 : this.labelBox.height;
      }
      getWidth() {
          return Math.max(this.inputs.length * NODE_INPUT_WIDTH, this.labelBox.width);
      }
      initDisplayLabel() {
          this.displayLabel = this.getNonCompactedOperationText();
          this.labelBox = measureText(this.displayLabel);
      }
      getTitle() {
          let title = `${this.id} ${this.title}`;
          title += `\nEffects: ${this.opEffects}`;
          if (this.origin) {
              title += `\nOrigin: ${this.origin.toString()}`;
          }
          if (this.inputs.length > 0) {
              title += `\nInputs: ${this.inputs.map(i => formatInput(i.source)).join(", ")}`;
          }
          if (this.outputs.length > 0) {
              title += `\nOutputs: ${this.outputs.map(i => i.target.id).join(", ")}`;
          }
          return title;
          function formatInput(input) {
              return `[${input.block}] ${input.displayLabel}`;
          }
      }
      getHistoryLabel() {
          return `${this.id} ${this.title}`;
      }
      getNodeOrigin() {
          return this.origin;
      }
      printInput(input) {
          if (input.compactPrinter && input.compactPrinter.IsFullyInlined()) {
              const s = input.compactPrinter.PrintInLine();
              return s;
          }
          return "v" + input.id.toString();
      }
      getNonCompactedOperationText() {
          if (this.inputs.length == 0) {
              return `${this.id} ${this.title}`;
          }
          else {
              return `${this.id} ${this.title}(${this.inputs.map(i => i.source.id).join(", ")})`;
          }
      }
      buildOperationText(compact) {
          if (!compact) {
              return this.getNonCompactedOperationText();
          }
          const that = this;
          if (this.compactPrinter) {
              return this.compactPrinter.Print(this.id, n => that.printInput(this.inputs[n].source));
          }
          else if (this.inputs.length == 0) {
              return `v${this.id} ${this.title}`;
          }
          else {
              return `v${this.id} ${this.title}(${this.inputs.map(input => that.printInput(input.source)).join(", ")})`;
          }
      }
      equals(that) {
          if (!that)
              return false;
          if (this.id !== that.id)
              return false;
          return this.title === that.title;
      }
      parseOperationForCompactRepresentation(properties) {
          try {
              switch (this.title) {
                  case Opcode.Constant:
                      return new CompactOperationPrinter_Constant(this, properties);
                  case Opcode.WordBinop:
                      return new CompactOperationPrinter_WordBinop(this, properties);
                  case Opcode.Comparison:
                      return new CompactOperationPrinter_Comparison(this, properties);
                  case Opcode.Shift:
                      return new CompactOperationPrinter_Shift(this, properties);
                  case Opcode.Load:
                      return new CompactOperationPrinter_Load(this, properties);
                  case Opcode.Store:
                      return new CompactOperationPrinter_Store(this, properties);
                  case Opcode.DeoptimizeIf:
                      return new CompactOperationPrinter_DeoptimizeIf(this, properties);
                  case Opcode.Goto:
                  case Opcode.Branch:
                      return new CompactOperationPrinter_Goto_Branch(this, properties);
                  default:
                      return null;
              }
          }
          catch (e) {
              if (e instanceof CompactOperationError) {
                  console.error(e.message);
                  return null;
              }
              throw e;
          }
      }
  }

  // Copyright 2022 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  class TurboshaftGraphBlock extends Node$1 {
      constructor(id, type, deferred, predecessors) {
          super(id, `${type} ${id}${deferred ? " (deferred)" : ""}`);
          this.type = type;
          this.deferred = deferred;
          this.predecessors = predecessors ?? new Array();
          this.nodes = new Array();
          this.visible = true;
      }
      getHeight(showCustomData, compactView) {
          if (this.collapsed)
              return this.labelBox.height + this.collapsedLabelBox.height;
          if (this.showCustomData != showCustomData || this.compactView != compactView) {
              this.height = this.nodes.reduce((accumulator, node) => {
                  return accumulator + node.getHeight(showCustomData, compactView);
              }, this.labelBox.height);
              this.showCustomData = showCustomData;
          }
          return this.height;
      }
      getWidth() {
          if (!this.width) {
              const labelWidth = this.labelBox.width + this.labelBox.height
                  + TURBOSHAFT_COLLAPSE_ICON_X_INDENT;
              const maxNodesWidth = Math.max(...this.nodes.map((node) => node.getWidth()));
              this.width = Math.max(maxNodesWidth, labelWidth, this.collapsedLabelBox.width)
                  + TURBOSHAFT_NODE_X_INDENT * 2;
          }
          return this.width;
      }
      compressHeight() {
          if (this.collapsed) {
              this.height = this.getHeight(null, false);
              this.showCustomData = null;
          }
      }
      getRankIndent() {
          return this.rank * (TURBOSHAFT_BLOCK_ROW_SEPARATION + 2 * DEFAULT_NODE_BUBBLE_RADIUS);
      }
      initCollapsedLabel() {
          this.collapsedLabel = `${this.nodes.length} operations`;
          this.collapsedLabelBox = measureText(this.collapsedLabel);
      }
      hasBackEdges() {
          return (this.type == TurboshaftGraphBlockType.Loop) ||
              (this.type == TurboshaftGraphBlockType.Merge &&
                  this.inputs.length > 0 &&
                  this.inputs[this.inputs.length - 1].source.type == TurboshaftGraphBlockType.Loop);
      }
      toString() {
          return `B${this.id}`;
      }
  }
  var TurboshaftGraphBlockType;
  (function (TurboshaftGraphBlockType) {
      TurboshaftGraphBlockType["Loop"] = "LOOP";
      TurboshaftGraphBlockType["Merge"] = "MERGE";
      TurboshaftGraphBlockType["Block"] = "BLOCK";
  })(TurboshaftGraphBlockType || (TurboshaftGraphBlockType = {}));

  // Copyright 2022 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  class TurboshaftGraphEdge extends Edge {
      constructor(target, index, source) {
          super(target, index, source);
          this.visible = target.visible && source.visible;
      }
      isBackEdge() {
          if (this.target instanceof TurboshaftGraphBlock) {
              return this.target.hasBackEdges() && (this.target.rank < this.source.rank);
          }
          return this.target.rank < this.source.rank;
      }
  }

  // Copyright 2022 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  class TurboshaftGraphPhase extends Phase {
      constructor(name, dataJson, nodeMap, sources, inlinings) {
          super(name, PhaseType.TurboshaftGraph);
          this.stateType = GraphStateType$1.NeedToFullRebuild;
          this.instructionsPhase = new InstructionsPhase();
          this.customData = new TurboshaftCustomData();
          this.nodeIdToNodeMap = new Array();
          this.blockIdToBlockMap = new Array();
          this.originIdToNodesMap = new Map();
          this.positions = new PositionsContainer();
          this.highestNodeId = 0;
          this.rendered = false;
          this.parseDataFromJSON(dataJson, nodeMap, sources, inlinings);
      }
      addCustomData(customDataPhase) {
          this.customData?.addCustomData(customDataPhase);
          const propertyName = "Properties";
          if (customDataPhase.dataTarget === DataTarget.Nodes &&
              customDataPhase.name === propertyName) {
              this.data.nodes.forEach(operation => operation.propertiesChanged(customDataPhase));
          }
      }
      parseDataFromJSON(dataJson, nodeMap, sources, inlinings) {
          this.data = new TurboshaftGraphData();
          this.parseBlocksFromJSON(dataJson.blocks);
          this.parseNodesFromJSON(dataJson.nodes, nodeMap, sources, inlinings);
          this.parseEdgesFromJSON(dataJson.edges);
      }
      parseBlocksFromJSON(blocksJson) {
          for (const blockJson of blocksJson) {
              const block = new TurboshaftGraphBlock(blockJson.id, blockJson.type, blockJson.deferred, blockJson.predecessors);
              this.data.blocks.push(block);
              this.blockIdToBlockMap[block.identifier()] = block;
          }
          for (const block of this.blockIdToBlockMap) {
              for (const [idx, predecessor] of block.predecessors.entries()) {
                  const source = this.blockIdToBlockMap[predecessor];
                  const edge = new TurboshaftGraphEdge(block, idx, source);
                  block.inputs.push(edge);
                  source.outputs.push(edge);
              }
          }
      }
      parseNodesFromJSON(nodesJson, nodeMap, sources, inlinings) {
          for (const nodeJson of nodesJson) {
              const block = this.blockIdToBlockMap[nodeJson.block_id];
              let sourcePosition = null;
              const sourcePositionJson = nodeJson.sourcePosition;
              if (sourcePositionJson) {
                  const scriptOffset = sourcePositionJson.scriptOffset;
                  const inliningId = sourcePositionJson.inliningId;
                  sourcePosition = new SourcePosition(scriptOffset, inliningId);
              }
              let origin = null;
              let bytecodePosition = null;
              const originJson = nodeJson.origin;
              if (originJson) {
                  const nodeId = originJson.nodeId;
                  const originNode = nodeMap[nodeId];
                  origin = new NodeOrigin(nodeId, originNode, originJson.phase, originJson.reducer);
                  if (originNode) {
                      if (originNode instanceof GraphNode) {
                          bytecodePosition = originNode.nodeLabel.bytecodePosition;
                      }
                      else {
                          bytecodePosition = originNode.bytecodePosition;
                      }
                  }
              }
              const node = new TurboshaftGraphOperation(nodeJson.id, nodeJson.title, block, sourcePosition, bytecodePosition, origin, nodeJson.op_effects);
              block.nodes.push(node);
              this.data.nodes.push(node);
              this.nodeIdToNodeMap[node.identifier()] = node;
              this.highestNodeId = Math.max(this.highestNodeId, node.id);
              if (origin) {
                  const identifier = origin.identifier();
                  if (!this.originIdToNodesMap.has(identifier)) {
                      this.originIdToNodesMap.set(identifier, new Array());
                  }
                  this.originIdToNodesMap.get(identifier).push(node);
              }
              nodeMap[node.id] = node;
              if (sourcePosition) {
                  const inlining = inlinings[sourcePosition.inliningId];
                  if (inlining)
                      sources[inlining.sourceId].sourcePositions.push(sourcePosition);
                  this.positions.addSourcePosition(node.identifier(), sourcePosition);
              }
              if (bytecodePosition) {
                  this.positions.addBytecodePosition(node.identifier(), bytecodePosition);
              }
          }
          for (const block of this.blockIdToBlockMap) {
              block.initCollapsedLabel();
          }
      }
      parseEdgesFromJSON(edgesJson) {
          for (const edgeJson of edgesJson) {
              const target = this.nodeIdToNodeMap[edgeJson.target];
              const source = this.nodeIdToNodeMap[edgeJson.source];
              const edge = new TurboshaftGraphEdge(target, -1, source);
              this.data.edges.push(edge);
              target.inputs.push(edge);
              source.outputs.push(edge);
          }
          for (const node of this.data.nodes) {
              node.initDisplayLabel();
          }
      }
  }
  class TurboshaftGraphData {
      constructor() {
          this.nodes = new Array();
          this.edges = new Array();
          this.blocks = new Array();
      }
  }
  class TurboshaftCustomData {
      constructor() {
          this.nodes = new Map();
          this.blocks = new Map();
      }
      addCustomData(customDataPhase) {
          switch (customDataPhase.dataTarget) {
              case DataTarget.Nodes:
                  this.nodes.set(customDataPhase.name, customDataPhase);
                  break;
              case DataTarget.Blocks:
                  this.blocks.set(customDataPhase.name, customDataPhase);
                  break;
              default:
                  throw "Unsupported turboshaft custom data target type";
          }
      }
      getTitle(key, dataTarget) {
          switch (dataTarget) {
              case DataTarget.Nodes:
                  return this.concatCustomData(key, this.nodes);
              case DataTarget.Blocks:
                  return this.concatCustomData(key, this.blocks);
          }
      }
      concatCustomData(key, items) {
          let customData = "";
          for (const [name, dataPhase] of items.entries()) {
              if (dataPhase.data[key] && dataPhase.data[key].length > 0) {
                  customData += `\n${name}: ${dataPhase.data[key]}`;
              }
          }
          return customData;
      }
  }

  // Copyright 2018 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  class SourceResolver {
      constructor() {
          // Maps source ids to source objects.
          this.sources = new Array();
          // Maps bytecode source ids to bytecode source objects.
          this.bytecodeSources = new Map();
          // Maps inlining ids to inlining objects.
          this.inlinings = new Array();
          // Maps source position keys to inlinings.
          this.inliningsMap = new Map();
          // Maps phase ids to phases.
          this.phases = new Array();
          // Maps phase names to phaseIds.
          this.phaseNames = new Map();
          // Maps line numbers to source positions
          this.linePositionMap = new Map();
          // Maps node ids to node origin
          this.finalNodeOrigins = new Array();
      }
      getMainFunction(jsonObj) {
          const fncJson = jsonObj.function;
          // Backwards compatibility.
          if (typeof fncJson === "string") {
              return new Source(null, null, jsonObj.source, -1, true, jsonObj.sourcePosition, jsonObj.sourcePosition + jsonObj.source.length);
          }
          return new Source(fncJson.sourceName, fncJson.functionName, fncJson.sourceText, fncJson.sourceId, false, fncJson.startPosition, fncJson.endPosition);
      }
      setInlinings(inliningsJson) {
          if (inliningsJson) {
              for (const [inliningIdStr, inlining] of Object.entries(inliningsJson)) {
                  const scriptOffset = inlining.inliningPosition.scriptOffset;
                  const inliningId = inlining.inliningPosition.inliningId;
                  const inl = new InliningPosition(inlining.sourceId, new SourcePosition(scriptOffset, inliningId));
                  this.inlinings[Number(inliningIdStr)] = inl;
                  this.inliningsMap.set(inl.inliningPosition.toString(), inl);
              }
          }
          // This is a default entry for the script itself that helps
          // keep other code more uniform.
          this.inlinings[-1] = new InliningPosition(-1, null);
      }
      setSources(sourcesJson, mainFunc) {
          if (sourcesJson) {
              for (const [sourceId, source] of Object.entries(sourcesJson)) {
                  const src = new Source(source.sourceName, source.functionName, source.sourceText, source.sourceId, source.backwardsCompatibility, source.startPosition, source.endPosition);
                  this.sources[sourceId] = src;
              }
          }
          // This is a fallback if the JSON is incomplete (e.g. due to compiler crash).
          if (!this.sources[-1]) {
              this.sources[-1] = mainFunc;
          }
      }
      setBytecodeSources(bytecodeSourcesJson) {
          if (!bytecodeSourcesJson)
              return;
          for (const [sourceId, source] of Object.entries(bytecodeSourcesJson)) {
              const bytecodeSource = source.bytecodeSource;
              const data = new Array();
              for (const bytecode of Object.values(bytecodeSource.data)) {
                  data.push(new BytecodeSourceData(bytecode.offset, bytecode.disassembly));
              }
              const numSourceId = Number(sourceId);
              const inliningIds = [];
              for (let index = -1; index < this.inlinings.length; index += 1) {
                  const inlining = this.inlinings[index];
                  if (inlining.sourceId == source.sourceId)
                      inliningIds.push(index);
              }
              this.bytecodeSources.set(numSourceId, new BytecodeSource(source.sourceId, inliningIds, source.functionName, data, bytecodeSource.constantPool));
          }
      }
      setFinalNodeOrigins(nodeOriginsJson) {
          if (!nodeOriginsJson)
              return;
          for (const [nodeId, nodeOrigin] of Object.entries(nodeOriginsJson)) {
              this.finalNodeOrigins[nodeId] = new NodeOrigin(nodeOrigin.nodeId, null, nodeOrigin.phase, nodeOrigin.reducer);
          }
      }
      parsePhases(phasesJson) {
          const instructionsPhase = new InstructionsPhase();
          const selectedDynamicPhases = new Array();
          const nodeMap = new Array();
          let lastTurboshaftGraphPhase = null;
          let lastGraphPhase = null;
          for (const [, genericPhase] of Object.entries(phasesJson)) {
              switch (genericPhase.type) {
                  case PhaseType.Disassembly:
                      const castedDisassembly = genericPhase;
                      const disassemblyPhase = new DisassemblyPhase(castedDisassembly.name, castedDisassembly.data, castedDisassembly?.blockIdToOffset);
                      this.disassemblyPhase = disassemblyPhase;
                      break;
                  case PhaseType.Schedule:
                      const castedSchedule = genericPhase;
                      const schedulePhase = new SchedulePhase(castedSchedule.name, castedSchedule.data);
                      this.phaseNames.set(schedulePhase.name, this.phases.length);
                      this.phases.push(schedulePhase);
                      selectedDynamicPhases.push(schedulePhase);
                      if (lastGraphPhase instanceof GraphPhase) {
                          schedulePhase.positions = lastGraphPhase.positions;
                      }
                      else {
                          const oldIdToNewIdMap = this.getOldIdToNewIdMap(this.phases.length - 1);
                          schedulePhase.positions.merge(lastGraphPhase.data.nodes, oldIdToNewIdMap);
                      }
                      schedulePhase.instructionsPhase = instructionsPhase;
                      break;
                  case PhaseType.Sequence:
                      const castedSequence = camelize(genericPhase);
                      const sequencePhase = new SequencePhase(castedSequence.name, castedSequence.blocks, castedSequence.registerAllocation);
                      const prevPhase = this.getDynamicPhase(this.phases.length - 1);
                      sequencePhase.positions = prevPhase.positions;
                      sequencePhase.instructionsPhase = prevPhase.instructionsPhase;
                      this.phaseNames.set(sequencePhase.name, this.phases.length);
                      this.phases.push(sequencePhase);
                      break;
                  case PhaseType.Instructions:
                      const castedInstructions = genericPhase;
                      if (instructionsPhase.name === "") {
                          instructionsPhase.name = castedInstructions.name;
                      }
                      else {
                          instructionsPhase.name += `, ${castedInstructions.name}`;
                      }
                      instructionsPhase.parseNodeIdToInstructionRangeFromJSON(castedInstructions
                          ?.nodeIdToInstructionRange);
                      instructionsPhase.parseBlockIdToInstructionRangeFromJSON(castedInstructions
                          ?.blockIdToInstructionRange);
                      instructionsPhase.parseInstructionOffsetToPCOffsetFromJSON(castedInstructions
                          ?.instructionOffsetToPCOffset);
                      instructionsPhase.parseCodeOffsetsInfoFromJSON(castedInstructions?.codeOffsetsInfo);
                      break;
                  case PhaseType.Graph:
                      const castedGraph = genericPhase;
                      const graphPhase = new GraphPhase(castedGraph.name, castedGraph.data, nodeMap, this.sources, this.inlinings);
                      this.phaseNames.set(graphPhase.name, this.phases.length);
                      this.phases.push(graphPhase);
                      selectedDynamicPhases.push(graphPhase);
                      lastGraphPhase = graphPhase;
                      break;
                  case PhaseType.TurboshaftGraph:
                      const castedTurboshaftGraph = genericPhase;
                      const turboshaftGraphPhase = new TurboshaftGraphPhase(castedTurboshaftGraph.name, castedTurboshaftGraph.data, nodeMap, this.sources, this.inlinings);
                      this.phaseNames.set(turboshaftGraphPhase.name, this.phases.length);
                      this.phases.push(turboshaftGraphPhase);
                      selectedDynamicPhases.push(turboshaftGraphPhase);
                      lastTurboshaftGraphPhase = turboshaftGraphPhase;
                      lastGraphPhase = turboshaftGraphPhase;
                      break;
                  case PhaseType.TurboshaftCustomData:
                      const castedCustomData = camelize(genericPhase);
                      const customDataPhase = new TurboshaftCustomDataPhase(castedCustomData.name, castedCustomData.dataTarget, castedCustomData.data);
                      lastTurboshaftGraphPhase?.addCustomData(customDataPhase);
                      break;
                  default:
                      throw "Unsupported phase type";
              }
          }
          this.sortSourcePositions();
          this.instructionsPhase = instructionsPhase;
          if (!lastTurboshaftGraphPhase) {
              for (const phase of selectedDynamicPhases) {
                  if (!phase.isDynamic())
                      continue;
                  phase.instructionsPhase = instructionsPhase;
              }
              return;
          }
          if (instructionsPhase.name == "")
              return;
          // Adapting 'nodeIdToInstructionRange' array to fix Turboshaft's nodes recreation
          this.adaptInstructionsPhases(selectedDynamicPhases);
      }
      sourcePositionsToNodeIds(sourcePositions) {
          const nodeIds = new Set();
          for (const position of sourcePositions) {
              const key = position.toString();
              let nodeIdsForPosition = null;
              if (position instanceof SourcePosition) {
                  nodeIdsForPosition = this.positions.sourcePositionToNodes.get(key);
              }
              else {
                  // Wasm support
                  nodeIdsForPosition = this.positions.bytecodePositionToNodes.get(key);
              }
              if (!nodeIdsForPosition)
                  continue;
              for (const nodeId of nodeIdsForPosition) {
                  nodeIds.add(nodeId);
              }
          }
          return nodeIds;
      }
      bytecodePositionsToNodeIds(bytecodePositions) {
          const nodeIds = new Set();
          for (const position of bytecodePositions) {
              const nodeIdsForPosition = this.positions.bytecodePositionToNodes.get(position.toString());
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
              const sourcePosition = this.positions.nodeIdToSourcePositionMap[nodeId];
              if (sourcePosition) {
                  sourcePositions.set(sourcePosition.toString(), sourcePosition);
              }
              // Wasm support
              if (this.bytecodeSources.size == 0) {
                  const bytecodePosition = this.positions.nodeIdToBytecodePositionMap[nodeId];
                  if (bytecodePosition) {
                      sourcePositions.set(bytecodePosition.toString(), bytecodePosition);
                  }
              }
          }
          const sourcePositionArray = new Array();
          for (const sourcePosition of sourcePositions.values()) {
              sourcePositionArray.push(sourcePosition);
          }
          return sourcePositionArray;
      }
      nodeIdsToBytecodePositions(nodeIds) {
          const bytecodePositions = new Map();
          for (const nodeId of nodeIds) {
              const position = this.positions.nodeIdToBytecodePositionMap[nodeId];
              if (!position)
                  continue;
              bytecodePositions.set(position.toString(), position);
          }
          return Array.from(bytecodePositions.values());
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
          const inlining = this.inliningsMap.get(sourcePosition.toString());
          if (!inlining)
              return;
          const source = this.sources[inlining.sourceId];
          for (const sp of source.sourcePositions) {
              locations.push(sp);
              this.addInliningPositions(sp, locations);
          }
      }
      getInliningForPosition(sourcePosition) {
          return this.inliningsMap.get(sourcePosition.toString());
      }
      getSource(sourceId) {
          return this.sources[sourceId];
      }
      addAnyPositionToLine(lineNumber, sourcePosition) {
          const lineNumberString = String(lineNumber);
          if (!this.linePositionMap.has(lineNumberString)) {
              this.linePositionMap.set(lineNumberString, new Array());
          }
          const storedPositions = this.linePositionMap.get(lineNumberString);
          if (!storedPositions.includes(sourcePosition))
              storedPositions.push(sourcePosition);
      }
      repairPhaseId(anyPhaseId) {
          return Math.max(0, Math.min(anyPhaseId | 0, this.phases.length - 1));
      }
      getPhase(phaseId) {
          return this.phases[phaseId];
      }
      getGraphPhase(phaseId) {
          const phase = this.phases[phaseId];
          return phase.isGraph() ? phase : null;
      }
      getDynamicPhase(phaseId) {
          const phase = this.phases[phaseId];
          return phase.isDynamic() ? phase : null;
      }
      getPhaseNameById(phaseId) {
          return this.getPhase(phaseId).name;
      }
      getPhaseIdByName(phaseName) {
          return this.phaseNames.get(phaseName);
      }
      lineToSourcePositions(lineNumber) {
          return this.linePositionMap.get(String(lineNumber)) ?? new Array();
      }
      getSourceName(sourceId) {
          const source = this.sources[sourceId];
          return `${source.sourceName}:${source.functionName}`;
      }
      sourcePositionsInRange(sourceId, start, end) {
          const inRange = Array();
          if (!this.sources[sourceId])
              return inRange;
          const list = this.sources[sourceId].sourcePositions;
          for (const sourcePosition of list) {
              if (start <= sourcePosition.scriptOffset && sourcePosition.scriptOffset < end) {
                  inRange.push(sourcePosition);
              }
          }
          return inRange;
      }
      setSourceLineToBytecodePosition(sourceLineToBytecodePositionJson) {
          if (!sourceLineToBytecodePositionJson)
              return;
          sourceLineToBytecodePositionJson.forEach((position, idx) => {
              this.addAnyPositionToLine(idx, new BytecodePosition(position, -1));
          });
      }
      getInlineStack(sourcePosition) {
          const inliningStack = Array();
          if (!sourcePosition)
              return inliningStack;
          let cur = sourcePosition;
          while (cur && cur.inliningId != -1) {
              inliningStack.push(cur);
              const inlining = this.inlinings[cur.inliningId];
              if (!inlining)
                  break;
              cur = inlining.inliningPosition;
          }
          if (cur && cur.inliningId == -1) {
              inliningStack.push(cur);
          }
          return inliningStack;
      }
      sortSourcePositions() {
          for (const source of Object.values(this.sources)) {
              source.sourcePositions = sortUnique(source.sourcePositions, (a, b) => a.lessOrEquals(b), (a, b) => a.equals(b));
          }
      }
      adaptInstructionsPhases(dynamicPhases) {
          const seaOfNodesInstructions = new InstructionsPhase("sea of nodes");
          for (let phaseId = dynamicPhases.length - 2; phaseId >= 0; phaseId--) {
              const phase = dynamicPhases[phaseId];
              const prevPhase = dynamicPhases[phaseId + 1];
              if (phase.type == PhaseType.TurboshaftGraph && prevPhase.type == PhaseType.Schedule) {
                  phase.instructionsPhase.merge(prevPhase.instructionsPhase);
                  const oldIdToNewIdMap = this.getOldIdToNewIdMap(phaseId + 1);
                  const maxNodeId = phase.highestNodeId;
                  for (let nodeId = 0; nodeId <= maxNodeId; nodeId++) {
                      const prevNodeId = oldIdToNewIdMap.has(nodeId) ? oldIdToNewIdMap.get(nodeId) : nodeId;
                      phase.instructionsPhase.nodeIdToInstructionRange[nodeId] =
                          prevPhase.instructionsPhase.getInstruction(prevNodeId);
                  }
              }
              else if (phase.type == PhaseType.TurboshaftGraph &&
                  prevPhase.type == PhaseType.TurboshaftGraph) {
                  phase.instructionsPhase.merge(prevPhase.instructionsPhase);
                  const maxNodeId = phase.highestNodeId;
                  const originIdToNodesMap = prevPhase.originIdToNodesMap;
                  for (let nodeId = 0; nodeId <= maxNodeId; nodeId++) {
                      const nodes = originIdToNodesMap.get(String(nodeId));
                      const prevNodeId = nodes?.length > 0 ? nodes[0]?.id : nodeId;
                      phase.instructionsPhase.nodeIdToInstructionRange[nodeId] =
                          prevPhase.instructionsPhase.getInstruction(prevNodeId);
                  }
              }
              else if (phase.type == PhaseType.Schedule && prevPhase.type == PhaseType.TurboshaftGraph) {
                  seaOfNodesInstructions.merge(prevPhase.instructionsPhase);
                  phase.instructionsPhase = seaOfNodesInstructions;
                  const originIdToNodesMap = prevPhase.originIdToNodesMap;
                  for (const [originId, nodes] of originIdToNodesMap.entries()) {
                      if (!originId || nodes.length == 0)
                          continue;
                      phase.instructionsPhase.nodeIdToInstructionRange[originId] =
                          prevPhase.instructionsPhase.getInstruction(nodes[0].id);
                  }
              }
              else if (phase.type == PhaseType.Graph && prevPhase.type == PhaseType.Graph) {
                  phase.instructionsPhase = seaOfNodesInstructions;
                  const prevGraphPhase = prevPhase;
                  for (const [originId, nodes] of prevGraphPhase.originIdToNodesMap.entries()) {
                      if (!originId || nodes.length == 0)
                          continue;
                      for (const node of nodes) {
                          if (!phase.instructionsPhase.nodeIdToInstructionRange[originId]) {
                              if (!prevPhase.instructionsPhase.nodeIdToInstructionRange[node.id])
                                  continue;
                              phase.instructionsPhase.nodeIdToInstructionRange[originId] =
                                  prevPhase.instructionsPhase.getInstruction(node.id);
                          }
                          else {
                              break;
                          }
                      }
                  }
              }
              else {
                  phase.instructionsPhase = seaOfNodesInstructions;
              }
          }
      }
      getOldIdToNewIdMap(phaseId) {
          // This function works with final node origins (we can have overwriting for Turboshaft IR)
          const oldIdToNewIdMap = new Map();
          for (const [newId, nodeOrigin] of this.finalNodeOrigins.entries()) {
              if (!nodeOrigin)
                  continue;
              if (nodeOrigin.phase === this.phases[phaseId].name) {
                  oldIdToNewIdMap.set(nodeOrigin.nodeId, newId);
              }
          }
          return oldIdToNewIdMap;
      }
  }

  // Copyright 2015 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  class SelectionBroker {
      constructor(sourceResolver) {
          this.sourceResolver = sourceResolver;
          this.allHandlers = new Array();
          this.historyHandlers = new Array();
          this.nodeHandlers = new Array();
          this.blockHandlers = new Array();
          this.instructionHandlers = new Array();
          this.sourcePositionHandlers = new Array();
          this.bytecodeOffsetHandlers = new Array();
          this.registerAllocationHandlers = new Array();
      }
      addHistoryHandler(handler) {
          this.historyHandlers.push(handler);
      }
      deleteHistoryHandler(handler) {
          this.historyHandlers = this.historyHandlers.filter(h => h != handler);
      }
      addNodeHandler(handler) {
          this.allHandlers.push(handler);
          this.nodeHandlers.push(handler);
      }
      deleteNodeHandler(handler) {
          this.allHandlers = this.allHandlers.filter(h => h != handler);
          this.nodeHandlers = this.nodeHandlers.filter(h => h != handler);
      }
      addBlockHandler(handler) {
          this.allHandlers.push(handler);
          this.blockHandlers.push(handler);
      }
      deleteBlockHandler(handler) {
          this.allHandlers = this.allHandlers.filter(h => h != handler);
          this.blockHandlers = this.blockHandlers.filter(h => h != handler);
      }
      addInstructionHandler(handler) {
          this.allHandlers.push(handler);
          this.instructionHandlers.push(handler);
      }
      addSourcePositionHandler(handler) {
          this.allHandlers.push(handler);
          this.sourcePositionHandlers.push(handler);
      }
      addBytecodeOffsetHandler(handler) {
          this.allHandlers.push(handler);
          this.bytecodeOffsetHandlers.push(handler);
      }
      addRegisterAllocatorHandler(handler) {
          this.allHandlers.push(handler);
          this.registerAllocationHandlers.push(handler);
      }
      broadcastHistoryShow(from, node, phaseName) {
          for (const handler of this.historyHandlers) {
              if (handler != from)
                  handler.showNodeHistory(node, phaseName);
          }
      }
      broadcastInstructionSelect(from, instructionOffsets, selected) {
          // Select the lines from the disassembly (right panel)
          for (const handler of this.instructionHandlers) {
              if (handler != from)
                  handler.brokeredInstructionSelect([instructionOffsets], selected);
          }
          // Select the lines from the source and bytecode panels (left panels)
          const nodes = this.sourceResolver.instructionsPhase.nodesForInstructions(instructionOffsets);
          const sourcePositions = this.sourceResolver.nodeIdsToSourcePositions(nodes);
          for (const handler of this.sourcePositionHandlers) {
              if (handler != from)
                  handler.brokeredSourcePositionSelect(sourcePositions, selected);
          }
          const bytecodePositions = this.sourceResolver.nodeIdsToBytecodePositions(nodes);
          for (const handler of this.bytecodeOffsetHandlers) {
              if (handler != from)
                  handler.brokeredBytecodeOffsetSelect(bytecodePositions, selected);
          }
          // Select the lines from the middle panel for the register allocation phase.
          for (const b of this.registerAllocationHandlers) {
              if (b != from) {
                  b.brokeredRegisterAllocationSelect(instructionOffsets.map(instr => [instr, instr]), selected);
              }
          }
      }
      broadcastSourcePositionSelect(from, sourcePositions, selected, selectedNodes) {
          sourcePositions = sourcePositions.filter(sourcePosition => {
              if (!sourcePosition.isValid()) {
                  console.warn("Invalid source position");
                  return false;
              }
              return true;
          });
          // Select the lines from the source panel (left panel)
          for (const handler of this.sourcePositionHandlers) {
              if (handler != from)
                  handler.brokeredSourcePositionSelect(sourcePositions, selected);
          }
          // Select the nodes (middle panel)
          const nodes = this.sourceResolver.sourcePositionsToNodeIds(sourcePositions);
          for (const handler of this.nodeHandlers) {
              if (handler != from)
                  handler.brokeredNodeSelect(nodes, selected);
          }
          // Select bytecode source panel (left panel)
          const bytecodePositions = selectedNodes
              ? this.sourceResolver.nodeIdsToBytecodePositions(selectedNodes)
              : this.sourceResolver.nodeIdsToBytecodePositions(nodes);
          for (const handler of this.bytecodeOffsetHandlers) {
              if (handler != from)
                  handler.brokeredBytecodeOffsetSelect(bytecodePositions, selected);
          }
          this.selectInstructionsAndRegisterAllocations(from, nodes, selected);
      }
      broadcastBytecodePositionsSelect(from, bytecodePositions, selected) {
          bytecodePositions = bytecodePositions.filter(bytecodePosition => {
              if (!bytecodePosition.isValid()) {
                  console.warn("Invalid bytecode position");
                  return false;
              }
              return true;
          });
          // Select the lines from the bytecode panel (left panel)
          for (const handler of this.bytecodeOffsetHandlers) {
              if (handler != from)
                  handler.brokeredBytecodeOffsetSelect(bytecodePositions, selected);
          }
          // Select the nodes (middle panel)
          const nodes = this.sourceResolver.bytecodePositionsToNodeIds(bytecodePositions);
          for (const handler of this.nodeHandlers) {
              if (handler != from)
                  handler.brokeredNodeSelect(nodes, selected);
          }
          // Select the lines from the source panel (left panel)
          const sourcePositions = this.sourceResolver.nodeIdsToSourcePositions(nodes);
          for (const handler of this.sourcePositionHandlers) {
              if (handler != from)
                  handler.brokeredSourcePositionSelect(sourcePositions, selected);
          }
          this.selectInstructionsAndRegisterAllocations(from, nodes, selected);
      }
      broadcastNodeSelect(from, nodes, selected) {
          // Select the nodes (middle panel)
          for (const handler of this.nodeHandlers) {
              if (handler != from)
                  handler.brokeredNodeSelect(nodes, selected);
          }
          // Select the lines from the source panel (left panel)
          const sourcePositions = this.sourceResolver.nodeIdsToSourcePositions(nodes);
          for (const handler of this.sourcePositionHandlers) {
              if (handler != from)
                  handler.brokeredSourcePositionSelect(sourcePositions, selected);
          }
          // Select bytecode source panel (left panel)
          const bytecodePositions = this.sourceResolver.nodeIdsToBytecodePositions(nodes);
          for (const handler of this.bytecodeOffsetHandlers) {
              if (handler != from)
                  handler.brokeredBytecodeOffsetSelect(bytecodePositions, selected);
          }
          this.selectInstructionsAndRegisterAllocations(from, nodes, selected);
      }
      broadcastBlockSelect(from, blocksIds, selected) {
          for (const handler of this.blockHandlers) {
              if (handler != from)
                  handler.brokeredBlockSelect(blocksIds, selected);
          }
      }
      broadcastClear(from) {
          for (const handler of this.allHandlers) {
              if (handler != from)
                  handler.brokeredClear();
          }
      }
      selectInstructionsAndRegisterAllocations(from, nodes, selected) {
          const instructionsOffsets = new Array();
          for (const node of nodes) {
              const instructionRange = this.sourceResolver.instructionsPhase.nodeIdToInstructionRange[node];
              if (instructionRange)
                  instructionsOffsets.push(instructionRange);
          }
          if (instructionsOffsets.length > 0) {
              // Select the lines from the disassembly (right panel)
              for (const handler of this.instructionHandlers) {
                  if (handler != from)
                      handler.brokeredInstructionSelect(instructionsOffsets, selected);
              }
              // Select the lines from the middle panel for the register allocation phase.
              for (const handler of this.registerAllocationHandlers) {
                  if (handler != from) {
                      handler.brokeredRegisterAllocationSelect(instructionsOffsets, selected);
                  }
              }
          }
      }
  }

  // Copyright 2022 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  class ViewElements {
      constructor(container) {
          this.container = container;
          this.scrollTop = undefined;
      }
      consider(element, doConsider) {
          if (!doConsider)
              return;
          const newScrollTop = this.computeScrollTop(element);
          if (isNaN(newScrollTop)) {
              console.warn("New scroll top value is NaN");
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
      computeScrollTop(element) {
          const height = this.container.offsetHeight;
          const margin = Math.floor(height / 4);
          const pos = element.offsetTop;
          const currentScrollTop = this.container.scrollTop;
          if (pos < currentScrollTop + margin) {
              return Math.max(0, pos - margin);
          }
          else if (pos > (currentScrollTop + 3 * margin)) {
              return Math.max(0, pos - 3 * margin);
          }
          return currentScrollTop;
      }
  }

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
  }
  var CodeMode;
  (function (CodeMode) {
      CodeMode["MainSource"] = "main function";
      CodeMode["InlinedSource"] = "inlined function";
  })(CodeMode || (CodeMode = {}));

  // Copyright 2015 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  class SelectionMap {
      constructor(stringKeyFnc, originStringKeyFnc) {
          this.selection = new Map();
          this.stringKey = stringKeyFnc;
          this.originStringKey = originStringKeyFnc;
      }
      isEmpty() {
          return this.selection.size == 0;
      }
      clear() {
          this.selection = new Map();
      }
      select(items, isSelected) {
          for (const item of items) {
              if (item === undefined)
                  continue;
              if (isSelected === undefined) {
                  isSelected = !this.selection.has(this.stringKey(item));
              }
              if (isSelected) {
                  this.selection.set(this.stringKey(item), item);
              }
              else {
                  this.selection.delete(this.stringKey(item));
              }
          }
      }
      isSelected(obj) {
          return this.selection.has(this.stringKey(obj));
      }
      isKeySelected(key) {
          return this.selection.has(key);
      }
      selectedKeys() {
          const result = new Set();
          for (const key of this.selection.keys()) {
              result.add(key);
          }
          return result;
      }
      selectedKeysAsAbsNumbers() {
          const result = new Set();
          for (const key of this.selection.keys()) {
              const keyNum = Number(key);
              result.add(keyNum < 0 ? Math.abs(keyNum + 1) : keyNum);
          }
          return result;
      }
      detachSelection() {
          const result = this.selection;
          this.clear();
          return result;
      }
      [Symbol.iterator]() { return this.selection.values(); }
  }

  // Copyright 2015 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  class SelectionMapsHandler {
      constructor(view, idToHtmlElementsMap) {
          this.view = view;
          this.idToHtmlElementsMap = idToHtmlElementsMap;
          this.current = new SelectionMap(id => String(id));
          this.previous = new SelectionMap(id => String(id));
      }
      clearCurrent() {
          this.previous.selection = this.current.selection;
          this.current.clear();
      }
      clearPrevious() {
          for (const blockId of this.previous.selectedKeys()) {
              const elements = this.idToHtmlElementsMap.get(blockId);
              if (!elements)
                  continue;
              for (const element of elements) {
                  element.classList.toggle("selected", false);
              }
          }
          this.previous.clear();
      }
      selectElements(scrollIntoView, scrollDiv) {
          const mkVisible = new ViewElements(scrollDiv);
          for (const id of this.current.selectedKeys()) {
              const elements = this.idToHtmlElementsMap.get(id);
              if (!elements)
                  continue;
              for (const element of elements) {
                  if (element.className.substring(0, 5) != "range" && element.getRootNode() == document) {
                      mkVisible.consider(element, true);
                  }
                  element.classList.toggle("selected", true);
              }
          }
          mkVisible.apply(scrollIntoView);
      }
  }
  class TextView extends PhaseView {
      constructor(parent, broker) {
          super(parent);
          this.broker = broker;
          this.sourceResolver = broker.sourceResolver;
          this.textListNode = this.divNode.getElementsByTagName("ul")[0];
          this.instructionIdToHtmlElementsMap = new Map();
          this.nodeIdToHtmlElementsMap = new Map();
          this.blockIdToHtmlElementsMap = new Map();
          this.blockIdToNodeIds = new Map();
          this.nodeIdToBlockId = new Array();
          this.nodeSelections = new SelectionMapsHandler(this, this.nodeIdToHtmlElementsMap);
          this.instructionSelections = new SelectionMapsHandler(this, this.instructionIdToHtmlElementsMap);
          this.blockSelections = new SelectionMapsHandler(this, this.blockIdToHtmlElementsMap);
          this.nodeSelectionHandler = this.initializeNodeSelectionHandler();
          this.blockSelectionHandler = this.initializeBlockSelectionHandler();
          this.registerAllocationSelectionHandler = this.initializeRegisterAllocationSelectionHandler();
          broker.addNodeHandler(this.nodeSelectionHandler);
          broker.addBlockHandler(this.blockSelectionHandler);
          broker.addRegisterAllocatorHandler(this.registerAllocationSelectionHandler);
          this.selectionCleared = false;
          this.divNode.addEventListener("click", e => {
              if (!e.shiftKey) {
                  this.nodeSelectionHandler.clear();
              }
              e.stopPropagation();
          });
      }
      initializeContent(genericPhase, _) {
          this.clearText();
          if (genericPhase instanceof DisassemblyPhase) {
              this.processText(genericPhase.data);
          }
          this.show();
      }
      clearSelectionMaps() {
          this.instructionIdToHtmlElementsMap.clear();
          this.nodeIdToHtmlElementsMap.clear();
          this.blockIdToHtmlElementsMap.clear();
      }
      updateSelection(scrollIntoView = false, scrollDiv = this.divNode) {
          if (this.divNode.parentNode == null)
              return;
          const clearDisassembly = () => {
              const elementsToSelect = this.divNode.querySelectorAll(`[data-pc-offset]`);
              for (const el of elementsToSelect) {
                  el.classList.toggle("selected", false);
              }
          };
          clearDisassembly();
          this.blockSelections.clearPrevious();
          this.instructionSelections.clearPrevious();
          this.nodeSelections.clearPrevious();
          this.blockSelections.selectElements(scrollIntoView, scrollDiv);
          this.instructionSelections.selectElements(scrollIntoView, scrollDiv);
          this.nodeSelections.selectElements(scrollIntoView, scrollDiv);
          if (this.rangeViewSelectionHandler !== undefined) {
              this.rangeViewSelectionHandler.updateBackground();
          }
      }
      setRangeViewSelectionHandler(handler) {
          this.rangeViewSelectionHandler = handler;
      }
      processLine(line) {
          const fragments = new Array();
          let patternSet = 0;
          while (true) {
              const beforeLine = line;
              for (const pattern of this.patterns[patternSet]) {
                  const matches = line.match(pattern[0]);
                  if (matches) {
                      if (matches[0].length > 0) {
                          const style = pattern[1] != null ? pattern[1] : {};
                          const text = matches[0];
                          if (text.length > 0) {
                              const fragment = this.createFragment(matches[0], style);
                              if (fragment !== null)
                                  fragments.push(fragment);
                          }
                          line = line.substr(matches[0].length);
                      }
                      let nextPatternSet = patternSet;
                      if (pattern.length > 2) {
                          nextPatternSet = pattern[2];
                      }
                      if (line.length == 0) {
                          if (nextPatternSet != -1) {
                              throw (`illegal parsing state in text-view in patternSet: ${patternSet}`);
                          }
                          return fragments;
                      }
                      patternSet = nextPatternSet;
                      break;
                  }
              }
              if (beforeLine == line) {
                  throw (`input not consumed in text-view in patternSet: ${patternSet}`);
              }
          }
      }
      onresize() { }
      removeHtmlElementFromMapIf(condition, map) {
          for (const [nodeId, elements] of map) {
              let i = elements.length;
              while (i--) {
                  if (condition(elements[i])) {
                      elements.splice(i, 1);
                  }
              }
              if (elements.length == 0) {
                  map.delete(nodeId);
              }
          }
      }
      removeHtmlElementFromAllMapsIf(condition) {
          this.clearSelection();
          this.removeHtmlElementFromMapIf(condition, this.nodeIdToHtmlElementsMap);
          this.removeHtmlElementFromMapIf(condition, this.blockIdToHtmlElementsMap);
          this.removeHtmlElementFromMapIf(condition, this.instructionIdToHtmlElementsMap);
      }
      clearSelection() {
          if (this.selectionCleared)
              return;
          this.blockSelections.clearCurrent();
          this.instructionSelections.clearCurrent();
          this.nodeSelections.clearCurrent();
          this.updateSelection();
          this.selectionCleared = true;
      }
      // instruction-id are the divs for the register allocator phase
      addHtmlElementForInstructionId(anyInstructionId, htmlElement) {
          const instructionId = String(anyInstructionId);
          if (!this.instructionIdToHtmlElementsMap.has(instructionId)) {
              this.instructionIdToHtmlElementsMap.set(instructionId, new Array());
          }
          this.instructionIdToHtmlElementsMap.get(instructionId).push(htmlElement);
      }
      addHtmlElementForNodeId(anyNodeId, htmlElement) {
          const nodeId = String(anyNodeId);
          if (!this.nodeIdToHtmlElementsMap.has(nodeId)) {
              this.nodeIdToHtmlElementsMap.set(nodeId, new Array());
          }
          this.nodeIdToHtmlElementsMap.get(nodeId).push(htmlElement);
      }
      addHtmlElementForBlockId(anyBlockId, htmlElement) {
          const blockId = String(anyBlockId);
          if (!this.blockIdToHtmlElementsMap.has(blockId)) {
              this.blockIdToHtmlElementsMap.set(blockId, new Array());
          }
          this.blockIdToHtmlElementsMap.get(blockId).push(htmlElement);
      }
      getSubId(id) {
          return -id - 1;
      }
      createFragment(text, style) {
          const fragment = document.createElement("span");
          if (typeof style.associateData === "function") {
              if (!style.associateData(text, fragment))
                  return null;
          }
          else {
              if (style.css !== undefined) {
                  const css = isIterable(style.css) ? style.css : [style.css];
                  for (const cls of css) {
                      fragment.classList.add(cls);
                  }
              }
              fragment.innerText = text;
          }
          return fragment;
      }
      selectionHandlerSelect(selection, ids, selected, scrollIntoView = false) {
          this.selectionCleared = false;
          const firstSelect = scrollIntoView ? this.blockSelections.current.isEmpty() : false;
          selection.select(ids, selected);
          this.updateSelection(firstSelect);
      }
      selectionHandlerClear() {
          this.clearSelection();
          this.broker.broadcastClear(this);
      }
      initializeNodeSelectionHandler() {
          const view = this;
          return {
              select: function (nodeIds, selected, scrollIntoView) {
                  view.selectionHandlerSelect(view.nodeSelections.current, nodeIds, selected, scrollIntoView);
                  view.broker.broadcastNodeSelect(this, view.nodeSelections.current.selectedKeys(), selected);
              },
              brokeredNodeSelect: function (nodeIds, selected) {
                  view.selectionHandlerSelect(view.nodeSelections.current, Array.from(nodeIds), selected, false);
              },
              clear: view.selectionHandlerClear.bind(this),
              brokeredClear: view.clearSelection.bind(this),
          };
      }
      initializeBlockSelectionHandler() {
          const view = this;
          return {
              select: function (blockIds, selected) {
                  view.selectionHandlerSelect(view.blockSelections.current, blockIds, selected);
                  view.broker.broadcastBlockSelect(this, Array.from(view.blockSelections.current.selectedKeysAsAbsNumbers()), selected);
              },
              brokeredBlockSelect: function (blockIds, selected) {
                  view.selectionHandlerSelect(view.blockSelections.current, blockIds, selected, true);
              },
              clear: view.selectionHandlerClear.bind(this),
              brokeredClear: view.clearSelection.bind(this),
          };
      }
      initializeRegisterAllocationSelectionHandler() {
          const view = this;
          return {
              select: function (instructionIds, selected, scrollIntoView) {
                  view.selectionHandlerSelect(view.instructionSelections.current, instructionIds, selected, scrollIntoView);
                  view.broker.broadcastInstructionSelect(this, Array.from(view.instructionSelections.current.selectedKeysAsAbsNumbers()), selected);
              },
              brokeredRegisterAllocationSelect: function (instructionsOffsets, selected) {
                  view.selectionCleared = false;
                  const firstSelect = view.blockSelections.current.isEmpty();
                  for (const instructionOffset of instructionsOffsets) {
                      view.instructionSelections.current.select(instructionOffset, selected);
                  }
                  view.updateSelection(firstSelect);
              },
              clear: view.selectionHandlerClear.bind(this),
              brokeredClear: view.clearSelection.bind(this),
          };
      }
      clearText() {
          while (this.textListNode.firstChild) {
              this.textListNode.removeChild(this.textListNode.firstChild);
          }
      }
      processText(text) {
          const textLines = text.split(/[\n]/);
          let lineNo = 0;
          for (const line of textLines) {
              const li = document.createElement("li");
              li.className = "nolinenums";
              li.dataset.lineNo = String(lineNo++);
              const fragments = this.processLine(line);
              for (const fragment of fragments) {
                  li.appendChild(fragment);
              }
              this.textListNode.appendChild(li);
          }
      }
  }

  // Copyright 2015 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  const toolboxHTML$1 = `<div id="disassembly-toolbox">
    <form>
      <label><input id="show-instruction-address" type="checkbox" name="instruction-address">Show addresses</label>
      <label><input id="show-instruction-binary" type="checkbox" name="instruction-binary">Show binary literal</label>
      <label><input id="highlight-gap-instructions" type="checkbox" name="instruction-binary">Highlight gap instructions</label>
    </form>
  </div>`;
  class DisassemblyView extends TextView {
      constructor(parent, broker) {
          super(parent, broker);
          this.patterns = this.initializePatterns();
          this.divNode.addEventListener("click", e => this.linkClickHandler(e));
          this.divNode.addEventListener("click", e => this.linkBlockClickHandler(e));
          this.offsetSelection = new SelectionMap(offset => String(offset));
          this.instructionSelectionHandler = this.initializeInstructionSelectionHandler();
          this.broker.addInstructionHandler(this.instructionSelectionHandler);
          this.addDisassemblyToolbox();
      }
      createViewElement() {
          const pane = document.createElement("div");
          pane.setAttribute("id", DISASSEMBLY_PANE_ID);
          pane.innerHTML =
              `<pre id="disassembly-text-pre" class="prettyprint prettyprinted">
         <ul class="disassembly-list nolinenums noindent"></ul>
       </pre>`;
          return pane;
      }
      updateSelection(scrollIntoView = false) {
          if (this.divNode.parentNode == null)
              return;
          super.updateSelection(scrollIntoView, this.divNode.parentNode);
          const selectedKeys = this.nodeSelections.current.selectedKeys();
          const keyPcOffsets = [
              ...this.sourceResolver.instructionsPhase.nodesToKeyPcOffsets(selectedKeys)
          ];
          if (this.offsetSelection) {
              for (const key of this.offsetSelection.selectedKeys()) {
                  keyPcOffsets.push(key);
              }
          }
          const mkVisible = new ViewElements(this.divNode.parentElement);
          for (const keyPcOffset of keyPcOffsets) {
              const elementsToSelect = this.divNode.querySelectorAll(`[data-pc-offset='${keyPcOffset}']`);
              for (const el of elementsToSelect) {
                  mkVisible.consider(el, true);
                  el.classList.toggle("selected", true);
              }
          }
          mkVisible.apply(scrollIntoView);
      }
      processLine(line) {
          let fragments = super.processLine(line);
          const cssCls = "prof";
          // Add profiling data per instruction if available.
          if (this.totalEventCounts) {
              const matches = /^(0x[0-9a-fA-F]+)\s+\d+\s+[0-9a-fA-F]+/.exec(line);
              if (matches) {
                  const newFragments = new Array();
                  for (const event in this.addrEventCounts) {
                      if (!this.addrEventCounts.hasOwnProperty(event))
                          continue;
                      const count = this.addrEventCounts[event][matches[1]];
                      if (count !== undefined) {
                          const perc = count / this.totalEventCounts[event] * 100;
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
                                  col.r = Math.round(interpolate$1(val, max, col1.r, col2.r));
                                  col.g = Math.round(interpolate$1(val, max, col1.g, col2.g));
                                  col.b = Math.round(interpolate$1(val, max, col1.b, col2.b));
                                  break;
                              }
                          }
                          const fragment = this.createFragment(UNICODE_BLOCK, cssCls);
                          fragment.title = `${event}: ${this.makeReadable(perc)} (${count})`;
                          fragment.style.color = `rgb(${col.r}, ${col.g}, ${col.b})`;
                          newFragments.push(fragment);
                      }
                      else {
                          newFragments.push(this.createFragment(" ", cssCls));
                      }
                  }
                  fragments = newFragments.concat(fragments);
              }
          }
          return fragments;
      }
      detachSelection() {
          return null;
      }
      adaptSelection(selection) {
          return selection;
      }
      searchInputAction(searchInput, e, onlyVisible) {
          throw new Error("Method not implemented.");
      }
      showContent(disassemblyPhase) {
          console.time("disassembly-view");
          super.initializeContent(disassemblyPhase, null);
          this.showInstructionAddressHandler();
          this.showInstructionBinaryHandler();
          this.highlightGapInstructionsHandler();
          console.timeEnd("disassembly-view");
      }
      initializeCode(sourceText, sourcePosition = 0) {
          this.addrEventCounts = null;
          this.totalEventCounts = null;
          this.maxEventCounts = null;
          this.posLines = new Array();
          // Comment lines for line 0 include sourcePosition already, only need to
          // add sourcePosition for lines > 0.
          this.posLines[0] = sourcePosition;
          if (sourceText && sourceText !== "") {
              const base = sourcePosition;
              let current = 0;
              const sourceLines = sourceText.split("\n");
              for (let i = 1; i < sourceLines.length; i++) {
                  // Add 1 for newline character that is split off.
                  current += sourceLines[i - 1].length + 1;
                  this.posLines[i] = base + current;
              }
          }
      }
      initializePerfProfile(eventCounts) {
          if (eventCounts !== undefined) {
              this.addrEventCounts = eventCounts;
              this.totalEventCounts = {};
              this.maxEventCounts = {};
              for (const evName in this.addrEventCounts) {
                  if (this.addrEventCounts.hasOwnProperty(evName)) {
                      const keys = Object.keys(this.addrEventCounts[evName]);
                      const values = keys.map(key => this.addrEventCounts[evName][key]);
                      this.totalEventCounts[evName] = values.reduce((a, b) => a + b);
                      this.maxEventCounts[evName] = values.reduce((a, b) => Math.max(a, b));
                  }
              }
          }
          else {
              this.addrEventCounts = null;
              this.totalEventCounts = null;
              this.maxEventCounts = null;
          }
      }
      initializeInstructionSelectionHandler() {
          const view = this;
          const broker = this.broker;
          return {
              select: function (instructionIds, selected) {
                  view.offsetSelection.select(instructionIds, selected);
                  view.updateSelection();
                  broker.broadcastInstructionSelect(this, instructionIds.map(id => Number(id)), selected);
              },
              clear: function () {
                  view.offsetSelection.clear();
                  view.updateSelection();
                  broker.broadcastClear(this);
              },
              brokeredInstructionSelect: function (instructionsOffsets, selected) {
                  const firstSelect = view.offsetSelection.isEmpty();
                  for (const instructionOffset of instructionsOffsets) {
                      const keyPcOffsets = view.sourceResolver.instructionsPhase
                          .instructionsToKeyPcOffsets(instructionOffset);
                      view.offsetSelection.select(keyPcOffsets, selected);
                  }
                  view.updateSelection(firstSelect);
              },
              brokeredClear: function () {
                  view.offsetSelection.clear();
                  view.updateSelection();
              }
          };
      }
      linkClickHandler(e) {
          if (!(e.target instanceof HTMLElement))
              return;
          const offsetAsString = e.target.dataset.pcOffset !== undefined
              ? e.target.dataset.pcOffset
              : e.target.parentElement.dataset.pcOffset;
          const offset = Number.parseInt(offsetAsString, 10);
          if (offsetAsString !== undefined && !Number.isNaN(offset)) {
              this.offsetSelection.select([offset], true);
              const nodes = this.sourceResolver.instructionsPhase.nodesForPCOffset(offset);
              if (nodes.length > 0) {
                  e.stopPropagation();
                  if (!e.shiftKey)
                      this.nodeSelectionHandler.clear();
                  this.nodeSelectionHandler.select(nodes, true, false);
              }
              else {
                  const instructions = this.sourceResolver.instructionsPhase.instructionsForPCOffset(offset);
                  if (instructions.length > 0) {
                      e.stopPropagation();
                      if (!e.shiftKey)
                          this.instructionSelectionHandler.clear();
                      this.instructionSelectionHandler
                          .brokeredInstructionSelect(instructions.map(instr => [instr, instr]), true);
                      this.broker.broadcastInstructionSelect(this, instructions, true);
                  }
                  else {
                      this.updateSelection();
                  }
              }
          }
          return undefined;
      }
      linkBlockClickHandler(e) {
          const spanBlockElement = e.target;
          const blockId = spanBlockElement.dataset.blockId;
          if (blockId !== undefined) {
              const blockIds = blockId.split(",");
              if (!e.shiftKey)
                  this.blockSelectionHandler.clear();
              this.blockSelectionHandler.select(blockIds.map(id => Number(id)), true, false);
          }
      }
      addDisassemblyToolbox() {
          const view = this;
          const toolbox = document.createElement("div");
          toolbox.id = "toolbox-anchor";
          toolbox.innerHTML = toolboxHTML$1;
          view.divNode.insertBefore(toolbox, view.divNode.firstChild);
          const instructionAddressInput = view.divNode.querySelector("#show-instruction-address");
          instructionAddressInput.checked = storageGetItem("show-instruction-address");
          const showInstructionAddressHandler = () => {
              storageSetItem("show-instruction-address", instructionAddressInput.checked);
              for (const el of view.divNode.querySelectorAll(".instruction-address")) {
                  el.classList.toggle("invisible", !instructionAddressInput.checked);
              }
          };
          instructionAddressInput.addEventListener("change", showInstructionAddressHandler);
          this.showInstructionAddressHandler = showInstructionAddressHandler;
          const instructionBinaryInput = view.divNode.querySelector("#show-instruction-binary");
          instructionBinaryInput.checked = storageGetItem("show-instruction-binary");
          const showInstructionBinaryHandler = () => {
              storageSetItem("show-instruction-binary", instructionBinaryInput.checked);
              for (const el of view.divNode.querySelectorAll(".instruction-binary")) {
                  el.classList.toggle("invisible", !instructionBinaryInput.checked);
              }
          };
          instructionBinaryInput.addEventListener("change", showInstructionBinaryHandler);
          this.showInstructionBinaryHandler = showInstructionBinaryHandler;
          const highlightGapInstructionsInput = view.divNode.querySelector("#highlight-gap-instructions");
          highlightGapInstructionsInput.checked = storageGetItem("highlight-gap-instructions");
          const highlightGapInstructionsHandler = () => {
              storageSetItem("highlight-gap-instructions", highlightGapInstructionsInput.checked);
              view.divNode.classList.toggle("highlight-gap-instructions", highlightGapInstructionsInput.checked);
          };
          highlightGapInstructionsInput.addEventListener("change", highlightGapInstructionsHandler);
          this.highlightGapInstructionsHandler = highlightGapInstructionsHandler;
      }
      makeReadable(num) {
          // Shorten decimals and remove trailing zeroes for readability.
          return `${num.toFixed(3).replace(/\.?0+$/, "")}%`;
      }
      initializePatterns() {
          return [
              [
                  [/^0?x?[0-9a-fA-F]{8,16}\s+[0-9a-f]+\s+/, this.addressStyle, 1],
                  [/^\s*--[^<]*<.*(not inlined|inlined\((\d+)\)):(\d+)>\s*--/, this.sourcePositionHeaderStyle, -1],
                  [/^\s+-- B\d+ start.*/, this.blockHeaderStyle, -1],
                  [/^.*/, this.unclassifiedStyle, -1]
              ],
              [
                  [/^\s*[0-9a-f]+\s+/, this.numberStyle, 2],
                  [/^\s*[0-9a-f]+\s+[0-9a-f]+\s+/, this.numberStyle, 2],
                  [/^.*/, null, -1]
              ],
              [
                  [/^REX.W \S+\s+/, this.opcodeStyle, 3],
                  [/^\S+\s+/, this.opcodeStyle, 3],
                  [/^\S+$/, this.opcodeStyle, -1],
                  [/^.*/, null, -1]
              ],
              [
                  [/^\s+/, null],
                  [/^[^;]+$/, this.opcodeArgs, -1],
                  [/^[^;]+/, this.opcodeArgs, 4],
                  [/^;/, this.commentStyle, 5]
              ],
              [
                  [/^.+$/, this.commentStyle, -1]
              ]
          ];
      }
      get numberStyle() {
          return {
              css: ["instruction-binary", "lit"]
          };
      }
      get opcodeStyle() {
          return {
              css: "kwd"
          };
      }
      get unclassifiedStyle() {
          return {
              css: "com"
          };
      }
      get commentStyle() {
          return {
              css: "com"
          };
      }
      get sourcePositionHeaderStyle() {
          return {
              css: "com"
          };
      }
      get blockHeaderStyle() {
          const view = this;
          return {
              associateData: (text, fragment) => {
                  if (view.sourceResolver.disassemblyPhase.hasBlockStartInfo())
                      return false;
                  const matches = /\d+/.exec(text);
                  if (!matches)
                      return true;
                  const blockId = matches[0];
                  fragment.dataset.blockId = blockId;
                  fragment.innerHTML = text;
                  fragment.className = "com block";
                  return true;
              }
          };
      }
      get opcodeArgs() {
          const view = this;
          return {
              associateData: (text, fragment) => {
                  fragment.innerHTML = text;
                  const replacer = (match, hexOffset) => {
                      const offset = Number.parseInt(hexOffset, 16);
                      let keyOffset = view.sourceResolver.instructionsPhase.getKeyPcOffset(offset);
                      if (keyOffset == -1)
                          keyOffset = Number(offset);
                      const blockIds = view.sourceResolver.disassemblyPhase.getBlockIdsForOffset(offset);
                      let block = "";
                      let blockIdData = "";
                      if (blockIds && blockIds.length > 0) {
                          block = `B${blockIds.join(",")} `;
                          blockIdData = `data-block-id="${blockIds.join(",")}"`;
                      }
                      return `<span class="tag linkable-text" data-pc-offset="${keyOffset}" ${blockIdData}>${block}${match}</span>`;
                  };
                  fragment.innerHTML = text.replace(/<.0?x?([0-9a-fA-F]+)>/g, replacer);
                  return true;
              }
          };
      }
      get addressStyle() {
          const view = this;
          return {
              associateData: (text, fragment) => {
                  const matches = text.match(/(?<address>0?x?[0-9a-fA-F]{8,16})(?<addressSpace>\s+)(?<offset>[0-9a-f]+)(?<offsetSpace>\s*)/);
                  const offset = Number.parseInt(matches.groups["offset"], 16);
                  const instructionKind = view.sourceResolver.instructionsPhase
                      .getInstructionKindForPCOffset(offset);
                  fragment.dataset.instructionKind = instructionKind;
                  fragment.title = view.sourceResolver.instructionsPhase
                      .instructionKindToReadableName(instructionKind);
                  const blockIds = view.sourceResolver.disassemblyPhase.getBlockIdsForOffset(offset);
                  const blockIdElement = document.createElement("span");
                  blockIdElement.className = "block-id com linkable-text";
                  blockIdElement.innerText = "";
                  if (blockIds && blockIds.length > 0) {
                      blockIds.forEach(blockId => view.addHtmlElementForBlockId(blockId, fragment));
                      blockIdElement.innerText = `B${blockIds.join(",")}:`;
                      blockIdElement.dataset.blockId = `${blockIds.join(",")}`;
                  }
                  fragment.appendChild(blockIdElement);
                  const addressElement = document.createElement("span");
                  addressElement.className = "instruction-address";
                  addressElement.innerText = matches.groups["address"];
                  const offsetElement = document.createElement("span");
                  offsetElement.innerText = matches.groups["offset"];
                  fragment.appendChild(addressElement);
                  fragment.appendChild(document.createTextNode(matches.groups["addressSpace"]));
                  fragment.appendChild(offsetElement);
                  fragment.appendChild(document.createTextNode(matches.groups["offsetSpace"]));
                  fragment.classList.add("tag");
                  if (!Number.isNaN(offset)) {
                      let pcOffset = view.sourceResolver.instructionsPhase.getKeyPcOffset(offset);
                      if (pcOffset == -1)
                          pcOffset = Number(offset);
                      fragment.dataset.pcOffset = String(pcOffset);
                      addressElement.classList.add("linkable-text");
                      offsetElement.classList.add("linkable-text");
                  }
                  return true;
              }
          };
      }
  }

  function ascending$1(a, b) {
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
      return ascending$1(f(d), x);
    };
  }

  bisector(ascending$1);

  var noop$1 = {value: function() {}};

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

  function parseTypenames$1(typenames, types) {
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
          T = parseTypenames$1(typename + "", _),
          t,
          i = -1,
          n = T.length;

      // If no callback was specified, return the callback of the given type and name.
      if (arguments.length < 2) {
        while (++i < n) if ((t = (typename = T[i]).type) && (t = get$1(_[t], typename.name))) return t;
        return;
      }

      // If a type was specified, set the callback for the given type and name.
      // Otherwise, if a null callback was specified, remove callbacks of the given name.
      if (callback != null && typeof callback !== "function") throw new Error("invalid callback: " + callback);
      while (++i < n) {
        if (t = (typename = T[i]).type) _[t] = set$1(_[t], typename.name, callback);
        else if (callback == null) for (t in _) _[t] = set$1(_[t], typename.name, null);
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

  function get$1(type, name) {
    for (var i = 0, n = type.length, c; i < n; ++i) {
      if ((c = type[i]).name === name) {
        return c.value;
      }
    }
  }

  function set$1(type, name, callback) {
    for (var i = 0, n = type.length; i < n; ++i) {
      if (type[i].name === name) {
        type[i] = noop$1, type = type.slice(0, i).concat(type.slice(i + 1));
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

    return new Selection$1(subgroups, this._parents);
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

    return new Selection$1(subgroups, parents);
  }

  var matcher = function(selector) {
    return function() {
      return this.matches(selector);
    };
  };

  if (typeof document !== "undefined") {
    var element$1 = document.documentElement;
    if (!element$1.matches) {
      var vendorMatches = element$1.webkitMatchesSelector
          || element$1.msMatchesSelector
          || element$1.mozMatchesSelector
          || element$1.oMatchesSelector;
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

    return new Selection$1(subgroups, this._parents);
  }

  function sparse(update) {
    return new Array(update.length);
  }

  function selection_enter() {
    return new Selection$1(this._enter || this._groups.map(sparse), this._parents);
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

  function constant$3(x) {
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

    if (typeof value !== "function") value = constant$3(value);

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

    update = new Selection$1(update, parents);
    update._enter = enter;
    update._exit = exit;
    return update;
  }

  function selection_exit() {
    return new Selection$1(this._exit || this._groups.map(sparse), this._parents);
  }

  function selection_merge(selection) {

    for (var groups0 = this._groups, groups1 = selection._groups, m0 = groups0.length, m1 = groups1.length, m = Math.min(m0, m1), merges = new Array(m0), j = 0; j < m; ++j) {
      for (var group0 = groups0[j], group1 = groups1[j], n = group0.length, merge = merges[j] = new Array(n), node, i = 0; i < n; ++i) {
        if (node = group0[i] || group1[i]) {
          merge[i] = node;
        }
      }
    }

    for (; j < m0; ++j) {
      merges[j] = groups0[j];
    }

    return new Selection$1(merges, this._parents);
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
    if (!compare) compare = ascending;

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

    return new Selection$1(sortgroups, this._parents).order();
  }

  function ascending(a, b) {
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

  function attrConstant$1(name, value) {
    return function() {
      this.setAttribute(name, value);
    };
  }

  function attrConstantNS$1(fullname, value) {
    return function() {
      this.setAttributeNS(fullname.space, fullname.local, value);
    };
  }

  function attrFunction$1(name, value) {
    return function() {
      var v = value.apply(this, arguments);
      if (v == null) this.removeAttribute(name);
      else this.setAttribute(name, v);
    };
  }

  function attrFunctionNS$1(fullname, value) {
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
        ? (fullname.local ? attrRemoveNS$1 : attrRemove$1) : (typeof value === "function"
        ? (fullname.local ? attrFunctionNS$1 : attrFunction$1)
        : (fullname.local ? attrConstantNS$1 : attrConstant$1)))(fullname, value));
  }

  function defaultView(node) {
    return (node.ownerDocument && node.ownerDocument.defaultView) // node is a Node
        || (node.document && node) // node is a Window
        || node.defaultView; // node is a Document
  }

  function styleRemove$1(name) {
    return function() {
      this.style.removeProperty(name);
    };
  }

  function styleConstant$1(name, value, priority) {
    return function() {
      this.style.setProperty(name, value, priority);
    };
  }

  function styleFunction$1(name, value, priority) {
    return function() {
      var v = value.apply(this, arguments);
      if (v == null) this.style.removeProperty(name);
      else this.style.setProperty(name, v, priority);
    };
  }

  function selection_style(name, value, priority) {
    return arguments.length > 1
        ? this.each((value == null
              ? styleRemove$1 : typeof value === "function"
              ? styleFunction$1
              : styleConstant$1)(name, value, priority == null ? "" : priority))
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

  function textConstant$1(value) {
    return function() {
      this.textContent = value;
    };
  }

  function textFunction$1(value) {
    return function() {
      var v = value.apply(this, arguments);
      this.textContent = v == null ? "" : v;
    };
  }

  function selection_text(value) {
    return arguments.length
        ? this.each(value == null
            ? textRemove : (typeof value === "function"
            ? textFunction$1
            : textConstant$1)(value))
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
    var element = document.documentElement;
    if (!("onmouseenter" in element)) {
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

  function parseTypenames(typenames) {
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
    var typenames = parseTypenames(typename + ""), i, n = typenames.length, t;

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

  function Selection$1(groups, parents) {
    this._groups = groups;
    this._parents = parents;
  }

  function selection() {
    return new Selection$1([[document.documentElement]], root);
  }

  Selection$1.prototype = selection.prototype = {
    constructor: Selection$1,
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
        ? new Selection$1([[document.querySelector(selector)]], [document.documentElement])
        : new Selection$1([[selector]], root);
  }

  var nextId = 0;

  function Local() {
    this._ = "@" + (++nextId).toString(36);
  }

  Local.prototype = {
    constructor: Local,
    get: function(node) {
      var id = this._;
      while (!(id in node)) if (!(node = node.parentNode)) return;
      return node[id];
    },
    set: function(node, value) {
      return node[this._] = value;
    },
    remove: function(node) {
      return this._ in node && delete node[this._];
    },
    toString: function() {
      return this._;
    }
  };

  function sourceEvent() {
    var current = event, source;
    while (source = current.sourceEvent) current = source;
    return current;
  }

  function point$4(node, event) {
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
    return point$4(node, event);
  }

  function selectAll(selector) {
    return typeof selector === "string"
        ? new Selection$1([document.querySelectorAll(selector)], [document.documentElement])
        : new Selection$1([selector == null ? [] : selector], root);
  }

  function touch(node, touches, identifier) {
    if (arguments.length < 3) identifier = touches, touches = sourceEvent().changedTouches;

    for (var i = 0, n = touches ? touches.length : 0, touch; i < n; ++i) {
      if ((touch = touches[i]).identifier === identifier) {
        return point$4(node, touch);
      }
    }

    return null;
  }

  function nopropagation$1() {
    event.stopImmediatePropagation();
  }

  function noevent$1() {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function dragDisable(view) {
    var root = view.document.documentElement,
        selection = select(view).on("dragstart.drag", noevent$1, true);
    if ("onselectstart" in root) {
      selection.on("selectstart.drag", noevent$1, true);
    } else {
      root.__noselect = root.style.MozUserSelect;
      root.style.MozUserSelect = "none";
    }
  }

  function yesdrag(view, noclick) {
    var root = view.document.documentElement,
        selection = select(view).on("dragstart.drag", null);
    if (noclick) {
      selection.on("click.drag", noevent$1, true);
      setTimeout(function() { selection.on("click.drag", null); }, 0);
    }
    if ("onselectstart" in root) {
      selection.on("selectstart.drag", null);
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
  function defaultFilter$1() {
    return !event.button;
  }

  function defaultContainer() {
    return this.parentNode;
  }

  function defaultSubject(d) {
    return d == null ? {x: event.x, y: event.y} : d;
  }

  function defaultTouchable$1() {
    return "ontouchstart" in this;
  }

  function drag() {
    var filter = defaultFilter$1,
        container = defaultContainer,
        subject = defaultSubject,
        touchable = defaultTouchable$1,
        gestures = {},
        listeners = dispatch("start", "drag", "end"),
        active = 0,
        mousedownx,
        mousedowny,
        mousemoving,
        touchending,
        clickDistance2 = 0;

    function drag(selection) {
      selection
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
      nopropagation$1();
      mousemoving = false;
      mousedownx = event.clientX;
      mousedowny = event.clientY;
      gesture("start");
    }

    function mousemoved() {
      noevent$1();
      if (!mousemoving) {
        var dx = event.clientX - mousedownx, dy = event.clientY - mousedowny;
        mousemoving = dx * dx + dy * dy > clickDistance2;
      }
      gestures.mouse("drag");
    }

    function mouseupped() {
      select(event.view).on("mousemove.drag mouseup.drag", null);
      yesdrag(event.view, mousemoving);
      noevent$1();
      gestures.mouse("end");
    }

    function touchstarted() {
      if (!filter.apply(this, arguments)) return;
      var touches = event.changedTouches,
          c = container.apply(this, arguments),
          n = touches.length, i, gesture;

      for (i = 0; i < n; ++i) {
        if (gesture = beforestart(touches[i].identifier, c, touch, this, arguments)) {
          nopropagation$1();
          gesture("start");
        }
      }
    }

    function touchmoved() {
      var touches = event.changedTouches,
          n = touches.length, i, gesture;

      for (i = 0; i < n; ++i) {
        if (gesture = gestures[touches[i].identifier]) {
          noevent$1();
          gesture("drag");
        }
      }
    }

    function touchended() {
      var touches = event.changedTouches,
          n = touches.length, i, gesture;

      if (touchending) clearTimeout(touchending);
      touchending = setTimeout(function() { touchending = null; }, 500); // Ghost clicks are delayed!
      for (i = 0; i < n; ++i) {
        if (gesture = gestures[touches[i].identifier]) {
          nopropagation$1();
          gesture("end");
        }
      }
    }

    function beforestart(id, container, point, that, args) {
      var p = point(container, id), s, dx, dy,
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
          case "drag": p = point(container, id), n = active; break;
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
      reHex = /^#([0-9a-f]{3,8})$/,
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
    copy: function(channels) {
      return Object.assign(new this.constructor, this, channels);
    },
    displayable: function() {
      return this.rgb().displayable();
    },
    hex: color_formatHex, // Deprecated! Use color.formatHex.
    formatHex: color_formatHex,
    formatHsl: color_formatHsl,
    formatRgb: color_formatRgb,
    toString: color_formatRgb
  });

  function color_formatHex() {
    return this.rgb().formatHex();
  }

  function color_formatHsl() {
    return hslConvert(this).formatHsl();
  }

  function color_formatRgb() {
    return this.rgb().formatRgb();
  }

  function color(format) {
    var m, l;
    format = (format + "").trim().toLowerCase();
    return (m = reHex.exec(format)) ? (l = m[1].length, m = parseInt(m[1], 16), l === 6 ? rgbn(m) // #ff0000
        : l === 3 ? new Rgb((m >> 8 & 0xf) | (m >> 4 & 0xf0), (m >> 4 & 0xf) | (m & 0xf0), ((m & 0xf) << 4) | (m & 0xf), 1) // #f00
        : l === 8 ? rgba(m >> 24 & 0xff, m >> 16 & 0xff, m >> 8 & 0xff, (m & 0xff) / 0xff) // #ff000000
        : l === 4 ? rgba((m >> 12 & 0xf) | (m >> 8 & 0xf0), (m >> 8 & 0xf) | (m >> 4 & 0xf0), (m >> 4 & 0xf) | (m & 0xf0), (((m & 0xf) << 4) | (m & 0xf)) / 0xff) // #f000
        : null) // invalid hex
        : (m = reRgbInteger.exec(format)) ? new Rgb(m[1], m[2], m[3], 1) // rgb(255, 0, 0)
        : (m = reRgbPercent.exec(format)) ? new Rgb(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, 1) // rgb(100%, 0%, 0%)
        : (m = reRgbaInteger.exec(format)) ? rgba(m[1], m[2], m[3], m[4]) // rgba(255, 0, 0, 1)
        : (m = reRgbaPercent.exec(format)) ? rgba(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, m[4]) // rgb(100%, 0%, 0%, 1)
        : (m = reHslPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, 1) // hsl(120, 50%, 50%)
        : (m = reHslaPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, m[4]) // hsla(120, 50%, 50%, 1)
        : named.hasOwnProperty(format) ? rgbn(named[format]) // eslint-disable-line no-prototype-builtins
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
      return (-0.5 <= this.r && this.r < 255.5)
          && (-0.5 <= this.g && this.g < 255.5)
          && (-0.5 <= this.b && this.b < 255.5)
          && (0 <= this.opacity && this.opacity <= 1);
    },
    hex: rgb_formatHex, // Deprecated! Use color.formatHex.
    formatHex: rgb_formatHex,
    formatRgb: rgb_formatRgb,
    toString: rgb_formatRgb
  }));

  function rgb_formatHex() {
    return "#" + hex(this.r) + hex(this.g) + hex(this.b);
  }

  function rgb_formatRgb() {
    var a = this.opacity; a = isNaN(a) ? 1 : Math.max(0, Math.min(1, a));
    return (a === 1 ? "rgb(" : "rgba(")
        + Math.max(0, Math.min(255, Math.round(this.r) || 0)) + ", "
        + Math.max(0, Math.min(255, Math.round(this.g) || 0)) + ", "
        + Math.max(0, Math.min(255, Math.round(this.b) || 0))
        + (a === 1 ? ")" : ", " + a + ")");
  }

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
    },
    formatHsl: function() {
      var a = this.opacity; a = isNaN(a) ? 1 : Math.max(0, Math.min(1, a));
      return (a === 1 ? "hsl(" : "hsla(")
          + (this.h || 0) + ", "
          + (this.s || 0) * 100 + "%, "
          + (this.l || 0) * 100 + "%"
          + (a === 1 ? ")" : ", " + a + ")");
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

  // https://observablehq.com/@mbostock/lab-and-rgb
  var K = 18,
      Xn = 0.96422,
      Yn = 1,
      Zn = 0.82521,
      t0$1 = 4 / 29,
      t1$1 = 6 / 29,
      t2 = 3 * t1$1 * t1$1,
      t3 = t1$1 * t1$1 * t1$1;

  function labConvert(o) {
    if (o instanceof Lab) return new Lab(o.l, o.a, o.b, o.opacity);
    if (o instanceof Hcl) return hcl2lab(o);
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
    return t > t3 ? Math.pow(t, 1 / 3) : t / t2 + t0$1;
  }

  function lab2xyz(t) {
    return t > t1$1 ? t * t * t : t2 * (t - t0$1);
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
    if (o.a === 0 && o.b === 0) return new Hcl(NaN, 0 < o.l && o.l < 100 ? 0 : NaN, o.l, o.opacity);
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

  function hcl2lab(o) {
    if (isNaN(o.h)) return new Lab(o.l, 0, 0, o.opacity);
    var h = o.h * deg2rad;
    return new Lab(o.l, Math.cos(h) * o.c, Math.sin(h) * o.c, o.opacity);
  }

  define(Hcl, hcl, extend(Color, {
    brighter: function(k) {
      return new Hcl(this.h, this.c, this.l + K * (k == null ? 1 : k), this.opacity);
    },
    darker: function(k) {
      return new Hcl(this.h, this.c, this.l - K * (k == null ? 1 : k), this.opacity);
    },
    rgb: function() {
      return hcl2lab(this).rgb();
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

  function cubehelix$1(h, s, l, opacity) {
    return arguments.length === 1 ? cubehelixConvert(h) : new Cubehelix(h, s, l, opacity == null ? 1 : opacity);
  }

  function Cubehelix(h, s, l, opacity) {
    this.h = +h;
    this.s = +s;
    this.l = +l;
    this.opacity = +opacity;
  }

  define(Cubehelix, cubehelix$1, extend(Color, {
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

  function constant$1(x) {
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
    return d ? linear(a, d > 180 || d < -180 ? d - 360 * Math.round(d / 360) : d) : constant$1(isNaN(a) ? b : a);
  }

  function gamma(y) {
    return (y = +y) === 1 ? nogamma : function(a, b) {
      return b - a ? exponential(a, b, y) : constant$1(isNaN(a) ? b : a);
    };
  }

  function nogamma(a, b) {
    var d = b - a;
    return d ? linear(a, d) : constant$1(isNaN(a) ? b : a);
  }

  var interpolateRgb = (function rgbGamma(y) {
    var color = gamma(y);

    function rgb$1(start, end) {
      var r = color((start = rgb(start)).r, (end = rgb(end)).r),
          g = color(start.g, end.g),
          b = color(start.b, end.b),
          opacity = nogamma(start.opacity, end.opacity);
      return function(t) {
        start.r = r(t);
        start.g = g(t);
        start.b = b(t);
        start.opacity = opacity(t);
        return start + "";
      };
    }

    rgb$1.gamma = rgbGamma;

    return rgb$1;
  })(1);

  function rgbSpline(spline) {
    return function(colors) {
      var n = colors.length,
          r = new Array(n),
          g = new Array(n),
          b = new Array(n),
          i, color;
      for (i = 0; i < n; ++i) {
        color = rgb(colors[i]);
        r[i] = color.r || 0;
        g[i] = color.g || 0;
        b[i] = color.b || 0;
      }
      r = spline(r);
      g = spline(g);
      b = spline(b);
      color.opacity = 1;
      return function(t) {
        color.r = r(t);
        color.g = g(t);
        color.b = b(t);
        return color + "";
      };
    };
  }

  var rgbBasis = rgbSpline(basis$1);

  function interpolateNumber(a, b) {
    return a = +a, b = +b, function(t) {
      return a * (1 - t) + b * t;
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
      epsilon2$1 = 1e-12;

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
    if (d2 < epsilon2$1) {
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

  function cubehelix(hue) {
    return (function cubehelixGamma(y) {
      y = +y;

      function cubehelix(start, end) {
        var h = hue((start = cubehelix$1(start)).h, (end = cubehelix$1(end)).h),
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

      cubehelix.gamma = cubehelixGamma;

      return cubehelix;
    })(1);
  }

  cubehelix(hue);
  var cubehelixLong = cubehelix(nogamma);

  var frame = 0, // is an animation frame pending?
      timeout$1 = 0, // is a timeout pending?
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
    frame = timeout$1 = 0;
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
    if (timeout$1) timeout$1 = clearTimeout(timeout$1);
    var delay = time - clockNow; // Strictly less than if we recomputed clockNow.
    if (delay > 24) {
      if (time < Infinity) timeout$1 = setTimeout(wake, time - clock.now() - clockSkew);
      if (interval) interval = clearInterval(interval);
    } else {
      if (!interval) clockLast = clock.now(), interval = setInterval(poke, pokeDelay);
      frame = 1, setFrame(wake);
    }
  }

  function timeout(callback, delay, time) {
    var t = new Timer;
    delay = delay == null ? 0 : +delay;
    t.restart(function(elapsed) {
      t.stop();
      callback(elapsed + delay);
    }, delay, time);
    return t;
  }

  var emptyOn = dispatch("start", "end", "cancel", "interrupt");
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
    create(node, id, {
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
    var schedule = get(node, id);
    if (schedule.state > CREATED) throw new Error("too late; already scheduled");
    return schedule;
  }

  function set(node, id) {
    var schedule = get(node, id);
    if (schedule.state > STARTED) throw new Error("too late; already running");
    return schedule;
  }

  function get(node, id) {
    var schedule = node.__transition;
    if (!schedule || !(schedule = schedule[id])) throw new Error("transition not found");
    return schedule;
  }

  function create(node, id, self) {
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
        if (o.state === STARTED) return timeout(start);

        // Interrupt the active transition, if any.
        if (o.state === RUNNING) {
          o.state = ENDED;
          o.timer.stop();
          o.on.call("interrupt", node, node.__data__, o.index, o.group);
          delete schedules[i];
        }

        // Cancel any pre-empted transitions.
        else if (+i < id) {
          o.state = ENDED;
          o.timer.stop();
          o.on.call("cancel", node, node.__data__, o.index, o.group);
          delete schedules[i];
        }
      }

      // Defer the first tick to end of the current frame; see d3/d3#1576.
      // Note the transition may be canceled after start and before the first tick!
      // Note this must be scheduled before the start event; see d3/d3-transition#16!
      // Assuming this is successful, subsequent callbacks go straight to tick.
      timeout(function() {
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
        tween[i].call(node, t);
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
        schedule,
        active,
        empty = true,
        i;

    if (!schedules) return;

    name = name == null ? null : name + "";

    for (i in schedules) {
      if ((schedule = schedules[i]).name !== name) { empty = false; continue; }
      active = schedule.state > STARTING && schedule.state < ENDING;
      schedule.state = ENDED;
      schedule.timer.stop();
      schedule.on.call(active ? "interrupt" : "cancel", node, node.__data__, schedule.index, schedule.group);
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
      var schedule = set(this, id),
          tween = schedule.tween;

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

      schedule.tween = tween1;
    };
  }

  function tweenFunction(id, name, value) {
    var tween0, tween1;
    if (typeof value !== "function") throw new Error;
    return function() {
      var schedule = set(this, id),
          tween = schedule.tween;

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

      schedule.tween = tween1;
    };
  }

  function transition_tween(name, value) {
    var id = this._id;

    name += "";

    if (arguments.length < 2) {
      var tween = get(this.node(), id).tween;
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
      var schedule = set(this, id);
      (schedule.value || (schedule.value = {}))[name] = value.apply(this, arguments);
    });

    return function(node) {
      return get(node, id).value[name];
    };
  }

  function interpolate(a, b) {
    var c;
    return (typeof b === "number" ? interpolateNumber
        : b instanceof color ? interpolateRgb
        : (c = color(b)) ? (b = c, interpolateRgb)
        : interpolateString)(a, b);
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

  function attrConstant(name, interpolate, value1) {
    var string00,
        string1 = value1 + "",
        interpolate0;
    return function() {
      var string0 = this.getAttribute(name);
      return string0 === string1 ? null
          : string0 === string00 ? interpolate0
          : interpolate0 = interpolate(string00 = string0, value1);
    };
  }

  function attrConstantNS(fullname, interpolate, value1) {
    var string00,
        string1 = value1 + "",
        interpolate0;
    return function() {
      var string0 = this.getAttributeNS(fullname.space, fullname.local);
      return string0 === string1 ? null
          : string0 === string00 ? interpolate0
          : interpolate0 = interpolate(string00 = string0, value1);
    };
  }

  function attrFunction(name, interpolate, value) {
    var string00,
        string10,
        interpolate0;
    return function() {
      var string0, value1 = value(this), string1;
      if (value1 == null) return void this.removeAttribute(name);
      string0 = this.getAttribute(name);
      string1 = value1 + "";
      return string0 === string1 ? null
          : string0 === string00 && string1 === string10 ? interpolate0
          : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
    };
  }

  function attrFunctionNS(fullname, interpolate, value) {
    var string00,
        string10,
        interpolate0;
    return function() {
      var string0, value1 = value(this), string1;
      if (value1 == null) return void this.removeAttributeNS(fullname.space, fullname.local);
      string0 = this.getAttributeNS(fullname.space, fullname.local);
      string1 = value1 + "";
      return string0 === string1 ? null
          : string0 === string00 && string1 === string10 ? interpolate0
          : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
    };
  }

  function transition_attr(name, value) {
    var fullname = namespace(name), i = fullname === "transform" ? interpolateTransformSvg : interpolate;
    return this.attrTween(name, typeof value === "function"
        ? (fullname.local ? attrFunctionNS : attrFunction)(fullname, i, tweenValue(this, "attr." + name, value))
        : value == null ? (fullname.local ? attrRemoveNS : attrRemove)(fullname)
        : (fullname.local ? attrConstantNS : attrConstant)(fullname, i, value));
  }

  function attrInterpolate(name, i) {
    return function(t) {
      this.setAttribute(name, i.call(this, t));
    };
  }

  function attrInterpolateNS(fullname, i) {
    return function(t) {
      this.setAttributeNS(fullname.space, fullname.local, i.call(this, t));
    };
  }

  function attrTweenNS(fullname, value) {
    var t0, i0;
    function tween() {
      var i = value.apply(this, arguments);
      if (i !== i0) t0 = (i0 = i) && attrInterpolateNS(fullname, i);
      return t0;
    }
    tween._value = value;
    return tween;
  }

  function attrTween(name, value) {
    var t0, i0;
    function tween() {
      var i = value.apply(this, arguments);
      if (i !== i0) t0 = (i0 = i) && attrInterpolate(name, i);
      return t0;
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
        : get(this.node(), id).delay;
  }

  function durationFunction(id, value) {
    return function() {
      set(this, id).duration = +value.apply(this, arguments);
    };
  }

  function durationConstant(id, value) {
    return value = +value, function() {
      set(this, id).duration = value;
    };
  }

  function transition_duration(value) {
    var id = this._id;

    return arguments.length
        ? this.each((typeof value === "function"
            ? durationFunction
            : durationConstant)(id, value))
        : get(this.node(), id).duration;
  }

  function easeConstant(id, value) {
    if (typeof value !== "function") throw new Error;
    return function() {
      set(this, id).ease = value;
    };
  }

  function transition_ease(value) {
    var id = this._id;

    return arguments.length
        ? this.each(easeConstant(id, value))
        : get(this.node(), id).ease;
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

  function transition_merge(transition) {
    if (transition._id !== this._id) throw new Error;

    for (var groups0 = this._groups, groups1 = transition._groups, m0 = groups0.length, m1 = groups1.length, m = Math.min(m0, m1), merges = new Array(m0), j = 0; j < m; ++j) {
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
    var on0, on1, sit = start(name) ? init : set;
    return function() {
      var schedule = sit(this, id),
          on = schedule.on;

      // If this node shared a dispatch with the previous node,
      // just assign the updated shared dispatch and we’re done!
      // Otherwise, copy-on-write.
      if (on !== on0) (on1 = (on0 = on).copy()).on(name, listener);

      schedule.on = on1;
    };
  }

  function transition_on(name, listener) {
    var id = this._id;

    return arguments.length < 2
        ? get(this.node(), id).on.on(name)
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

  function transition_select(select) {
    var name = this._name,
        id = this._id;

    if (typeof select !== "function") select = selector(select);

    for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, subgroup = subgroups[j] = new Array(n), node, subnode, i = 0; i < n; ++i) {
        if ((node = group[i]) && (subnode = select.call(node, node.__data__, i, group))) {
          if ("__data__" in node) subnode.__data__ = node.__data__;
          subgroup[i] = subnode;
          schedule(subgroup[i], name, id, i, subgroup, get(node, id));
        }
      }
    }

    return new Transition(subgroups, this._parents, name, id);
  }

  function transition_selectAll(select) {
    var name = this._name,
        id = this._id;

    if (typeof select !== "function") select = selectorAll(select);

    for (var groups = this._groups, m = groups.length, subgroups = [], parents = [], j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
        if (node = group[i]) {
          for (var children = select.call(node, node.__data__, i, group), child, inherit = get(node, id), k = 0, l = children.length; k < l; ++k) {
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

  var Selection = selection.prototype.constructor;

  function transition_selection() {
    return new Selection(this._groups, this._parents);
  }

  function styleNull(name, interpolate) {
    var string00,
        string10,
        interpolate0;
    return function() {
      var string0 = styleValue(this, name),
          string1 = (this.style.removeProperty(name), styleValue(this, name));
      return string0 === string1 ? null
          : string0 === string00 && string1 === string10 ? interpolate0
          : interpolate0 = interpolate(string00 = string0, string10 = string1);
    };
  }

  function styleRemove(name) {
    return function() {
      this.style.removeProperty(name);
    };
  }

  function styleConstant(name, interpolate, value1) {
    var string00,
        string1 = value1 + "",
        interpolate0;
    return function() {
      var string0 = styleValue(this, name);
      return string0 === string1 ? null
          : string0 === string00 ? interpolate0
          : interpolate0 = interpolate(string00 = string0, value1);
    };
  }

  function styleFunction(name, interpolate, value) {
    var string00,
        string10,
        interpolate0;
    return function() {
      var string0 = styleValue(this, name),
          value1 = value(this),
          string1 = value1 + "";
      if (value1 == null) string1 = value1 = (this.style.removeProperty(name), styleValue(this, name));
      return string0 === string1 ? null
          : string0 === string00 && string1 === string10 ? interpolate0
          : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
    };
  }

  function styleMaybeRemove(id, name) {
    var on0, on1, listener0, key = "style." + name, event = "end." + key, remove;
    return function() {
      var schedule = set(this, id),
          on = schedule.on,
          listener = schedule.value[key] == null ? remove || (remove = styleRemove(name)) : undefined;

      // If this node shared a dispatch with the previous node,
      // just assign the updated shared dispatch and we’re done!
      // Otherwise, copy-on-write.
      if (on !== on0 || listener0 !== listener) (on1 = (on0 = on).copy()).on(event, listener0 = listener);

      schedule.on = on1;
    };
  }

  function transition_style(name, value, priority) {
    var i = (name += "") === "transform" ? interpolateTransformCss : interpolate;
    return value == null ? this
        .styleTween(name, styleNull(name, i))
        .on("end.style." + name, styleRemove(name))
      : typeof value === "function" ? this
        .styleTween(name, styleFunction(name, i, tweenValue(this, "style." + name, value)))
        .each(styleMaybeRemove(this._id, name))
      : this
        .styleTween(name, styleConstant(name, i, value), priority)
        .on("end.style." + name, null);
  }

  function styleInterpolate(name, i, priority) {
    return function(t) {
      this.style.setProperty(name, i.call(this, t), priority);
    };
  }

  function styleTween(name, value, priority) {
    var t, i0;
    function tween() {
      var i = value.apply(this, arguments);
      if (i !== i0) t = (i0 = i) && styleInterpolate(name, i, priority);
      return t;
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

  function textConstant(value) {
    return function() {
      this.textContent = value;
    };
  }

  function textFunction(value) {
    return function() {
      var value1 = value(this);
      this.textContent = value1 == null ? "" : value1;
    };
  }

  function transition_text(value) {
    return this.tween("text", typeof value === "function"
        ? textFunction(tweenValue(this, "text", value))
        : textConstant(value == null ? "" : value + ""));
  }

  function textInterpolate(i) {
    return function(t) {
      this.textContent = i.call(this, t);
    };
  }

  function textTween(value) {
    var t0, i0;
    function tween() {
      var i = value.apply(this, arguments);
      if (i !== i0) t0 = (i0 = i) && textInterpolate(i);
      return t0;
    }
    tween._value = value;
    return tween;
  }

  function transition_textTween(value) {
    var key = "text";
    if (arguments.length < 1) return (key = this.tween(key)) && key._value;
    if (value == null) return this.tween(key, null);
    if (typeof value !== "function") throw new Error;
    return this.tween(key, textTween(value));
  }

  function transition_transition() {
    var name = this._name,
        id0 = this._id,
        id1 = newId();

    for (var groups = this._groups, m = groups.length, j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
        if (node = group[i]) {
          var inherit = get(node, id0);
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

  function transition_end() {
    var on0, on1, that = this, id = that._id, size = that.size();
    return new Promise(function(resolve, reject) {
      var cancel = {value: reject},
          end = {value: function() { if (--size === 0) resolve(); }};

      that.each(function() {
        var schedule = set(this, id),
            on = schedule.on;

        // If this node shared a dispatch with the previous node,
        // just assign the updated shared dispatch and we’re done!
        // Otherwise, copy-on-write.
        if (on !== on0) {
          on1 = (on0 = on).copy();
          on1._.cancel.push(cancel);
          on1._.interrupt.push(cancel);
          on1._.end.push(end);
        }

        schedule.on = on1;
      });
    });
  }

  var id = 0;

  function Transition(groups, parents, name, id) {
    this._groups = groups;
    this._parents = parents;
    this._name = name;
    this._id = id;
  }

  function newId() {
    return ++id;
  }

  var selection_prototype = selection.prototype;

  Transition.prototype = {
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
    textTween: transition_textTween,
    remove: transition_remove,
    tween: transition_tween,
    delay: transition_delay,
    duration: transition_duration,
    ease: transition_ease,
    end: transition_end
  };

  function cubicInOut(t) {
    return ((t *= 2) <= 1 ? t * t * t : (t -= 2) * t * t + 2) / 2;
  }

  var exponent$1 = 3;

  ((function custom(e) {
    e = +e;

    function polyIn(t) {
      return Math.pow(t, e);
    }

    polyIn.exponent = custom;

    return polyIn;
  }))(exponent$1);

  ((function custom(e) {
    e = +e;

    function polyOut(t) {
      return 1 - Math.pow(1 - t, e);
    }

    polyOut.exponent = custom;

    return polyOut;
  }))(exponent$1);

  ((function custom(e) {
    e = +e;

    function polyInOut(t) {
      return ((t *= 2) <= 1 ? Math.pow(t, e) : 2 - Math.pow(2 - t, e)) / 2;
    }

    polyInOut.exponent = custom;

    return polyInOut;
  }))(exponent$1);

  var overshoot = 1.70158;

  ((function custom(s) {
    s = +s;

    function backIn(t) {
      return t * t * ((s + 1) * t - s);
    }

    backIn.overshoot = custom;

    return backIn;
  }))(overshoot);

  ((function custom(s) {
    s = +s;

    function backOut(t) {
      return --t * t * ((s + 1) * t + s) + 1;
    }

    backOut.overshoot = custom;

    return backOut;
  }))(overshoot);

  ((function custom(s) {
    s = +s;

    function backInOut(t) {
      return ((t *= 2) < 1 ? t * t * ((s + 1) * t - s) : (t -= 2) * t * ((s + 1) * t + s) + 2) / 2;
    }

    backInOut.overshoot = custom;

    return backInOut;
  }))(overshoot);

  var tau$2 = 2 * Math.PI,
      amplitude = 1,
      period = 0.3;

  ((function custom(a, p) {
    var s = Math.asin(1 / (a = Math.max(1, a))) * (p /= tau$2);

    function elasticIn(t) {
      return a * Math.pow(2, 10 * --t) * Math.sin((s - t) / p);
    }

    elasticIn.amplitude = function(a) { return custom(a, p * tau$2); };
    elasticIn.period = function(p) { return custom(a, p); };

    return elasticIn;
  }))(amplitude, period);

  ((function custom(a, p) {
    var s = Math.asin(1 / (a = Math.max(1, a))) * (p /= tau$2);

    function elasticOut(t) {
      return 1 - a * Math.pow(2, -10 * (t = +t)) * Math.sin((t + s) / p);
    }

    elasticOut.amplitude = function(a) { return custom(a, p * tau$2); };
    elasticOut.period = function(p) { return custom(a, p); };

    return elasticOut;
  }))(amplitude, period);

  ((function custom(a, p) {
    var s = Math.asin(1 / (a = Math.max(1, a))) * (p /= tau$2);

    function elasticInOut(t) {
      return ((t = t * 2 - 1) < 0
          ? a * Math.pow(2, 10 * t) * Math.sin((s - t) / p)
          : 2 - a * Math.pow(2, -10 * t) * Math.sin((s + t) / p)) / 2;
    }

    elasticInOut.amplitude = function(a) { return custom(a, p * tau$2); };
    elasticInOut.period = function(p) { return custom(a, p); };

    return elasticInOut;
  }))(amplitude, period);

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

  var pi$1 = Math.PI,
      tau$1 = 2 * pi$1,
      epsilon$2 = 1e-6,
      tauEpsilon = tau$1 - epsilon$2;

  function Path() {
    this._x0 = this._y0 = // start of current subpath
    this._x1 = this._y1 = null; // end of current subpath
    this._ = "";
  }

  Path.prototype = {
    constructor: Path,
    moveTo: function(x, y) {
      this._ += "M" + (this._x0 = this._x1 = +x) + "," + (this._y0 = this._y1 = +y);
    },
    closePath: function() {
      if (this._x1 !== null) {
        this._x1 = this._x0, this._y1 = this._y0;
        this._ += "Z";
      }
    },
    lineTo: function(x, y) {
      this._ += "L" + (this._x1 = +x) + "," + (this._y1 = +y);
    },
    quadraticCurveTo: function(x1, y1, x, y) {
      this._ += "Q" + (+x1) + "," + (+y1) + "," + (this._x1 = +x) + "," + (this._y1 = +y);
    },
    bezierCurveTo: function(x1, y1, x2, y2, x, y) {
      this._ += "C" + (+x1) + "," + (+y1) + "," + (+x2) + "," + (+y2) + "," + (this._x1 = +x) + "," + (this._y1 = +y);
    },
    arcTo: function(x1, y1, x2, y2, r) {
      x1 = +x1, y1 = +y1, x2 = +x2, y2 = +y2, r = +r;
      var x0 = this._x1,
          y0 = this._y1,
          x21 = x2 - x1,
          y21 = y2 - y1,
          x01 = x0 - x1,
          y01 = y0 - y1,
          l01_2 = x01 * x01 + y01 * y01;

      // Is the radius negative? Error.
      if (r < 0) throw new Error("negative radius: " + r);

      // Is this path empty? Move to (x1,y1).
      if (this._x1 === null) {
        this._ += "M" + (this._x1 = x1) + "," + (this._y1 = y1);
      }

      // Or, is (x1,y1) coincident with (x0,y0)? Do nothing.
      else if (!(l01_2 > epsilon$2));

      // Or, are (x0,y0), (x1,y1) and (x2,y2) collinear?
      // Equivalently, is (x1,y1) coincident with (x2,y2)?
      // Or, is the radius zero? Line to (x1,y1).
      else if (!(Math.abs(y01 * x21 - y21 * x01) > epsilon$2) || !r) {
        this._ += "L" + (this._x1 = x1) + "," + (this._y1 = y1);
      }

      // Otherwise, draw an arc!
      else {
        var x20 = x2 - x0,
            y20 = y2 - y0,
            l21_2 = x21 * x21 + y21 * y21,
            l20_2 = x20 * x20 + y20 * y20,
            l21 = Math.sqrt(l21_2),
            l01 = Math.sqrt(l01_2),
            l = r * Math.tan((pi$1 - Math.acos((l21_2 + l01_2 - l20_2) / (2 * l21 * l01))) / 2),
            t01 = l / l01,
            t21 = l / l21;

        // If the start tangent is not coincident with (x0,y0), line to.
        if (Math.abs(t01 - 1) > epsilon$2) {
          this._ += "L" + (x1 + t01 * x01) + "," + (y1 + t01 * y01);
        }

        this._ += "A" + r + "," + r + ",0,0," + (+(y01 * x20 > x01 * y20)) + "," + (this._x1 = x1 + t21 * x21) + "," + (this._y1 = y1 + t21 * y21);
      }
    },
    arc: function(x, y, r, a0, a1, ccw) {
      x = +x, y = +y, r = +r;
      var dx = r * Math.cos(a0),
          dy = r * Math.sin(a0),
          x0 = x + dx,
          y0 = y + dy,
          cw = 1 ^ ccw,
          da = ccw ? a0 - a1 : a1 - a0;

      // Is the radius negative? Error.
      if (r < 0) throw new Error("negative radius: " + r);

      // Is this path empty? Move to (x0,y0).
      if (this._x1 === null) {
        this._ += "M" + x0 + "," + y0;
      }

      // Or, is (x0,y0) not coincident with the previous point? Line to (x0,y0).
      else if (Math.abs(this._x1 - x0) > epsilon$2 || Math.abs(this._y1 - y0) > epsilon$2) {
        this._ += "L" + x0 + "," + y0;
      }

      // Is this arc empty? We’re done.
      if (!r) return;

      // Does the angle go the wrong way? Flip the direction.
      if (da < 0) da = da % tau$1 + tau$1;

      // Is this a complete circle? Draw two arcs to complete the circle.
      if (da > tauEpsilon) {
        this._ += "A" + r + "," + r + ",0,1," + cw + "," + (x - dx) + "," + (y - dy) + "A" + r + "," + r + ",0,1," + cw + "," + (this._x1 = x0) + "," + (this._y1 = y0);
      }

      // Is this arc non-empty? Draw an arc!
      else if (da > epsilon$2) {
        this._ += "A" + r + "," + r + ",0," + (+(da >= pi$1)) + "," + cw + "," + (this._x1 = x + r * Math.cos(a1)) + "," + (this._y1 = y + r * Math.sin(a1));
      }
    },
    rect: function(x, y, w, h) {
      this._ += "M" + (this._x0 = this._x1 = +x) + "," + (this._y0 = this._y1 = +y) + "h" + (+w) + "v" + (+h) + "h" + (-w) + "Z";
    },
    toString: function() {
      return this._;
    }
  };

  var prefix = "$";

  function Map$1() {}

  Map$1.prototype = map.prototype = {
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

  function map(object, f) {
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

  var proto = map.prototype;

  Set$1.prototype = {
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

  dsvFormat(",");

  dsvFormat("\t");

  function tree_add(d) {
    var x = +this._x.call(null, d),
        y = +this._y.call(null, d);
    return add$1(this.cover(x, y), x, y, d);
  }

  function add$1(tree, x, y, d) {
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
      add$1(this, xz[i], yz[i], data[i]);
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

  function tree_x(_) {
    return arguments.length ? (this._x = _, this) : this._x;
  }

  function tree_y(_) {
    return arguments.length ? (this._y = _, this) : this._y;
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

  var treeProto = Quadtree.prototype;

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

  function exponent(x) {
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

  function identity$1(x) {
    return x;
  }

  var prefixes = ["y","z","a","f","p","n","µ","m","","k","M","G","T","P","E","Z","Y"];

  function formatLocale$1(locale) {
    var group = locale.grouping && locale.thousands ? formatGroup(locale.grouping, locale.thousands) : identity$1,
        currency = locale.currency,
        decimal = locale.decimal,
        numerals = locale.numerals ? formatNumerals(locale.numerals) : identity$1,
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
          e = Math.max(-8, Math.min(8, Math.floor(exponent(value) / 3))) * 3,
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

  var locale$1;

  defaultLocale$1({
    decimal: ".",
    thousands: ",",
    grouping: [3],
    currency: ["$", ""]
  });

  function defaultLocale$1(definition) {
    locale$1 = formatLocale$1(definition);
    locale$1.format;
    locale$1.formatPrefix;
    return locale$1;
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
      add(temp, y, this.t);
      add(this, temp.s, this.s);
      if (this.s) this.t += temp.t;
      else this.s = temp.t;
    },
    valueOf: function() {
      return this.s;
    }
  };

  var temp = new Adder;

  function add(adder, a, b) {
    var x = adder.s = a + b,
        bv = x - a,
        av = x - bv;
    adder.t = (a - av) + (b - bv);
  }

  var pi = Math.PI;
  var tau = pi * 2;

  var abs = Math.abs;

  adder();

  adder();

  adder();

  function rotationIdentity(lambda, phi) {
    return [abs(lambda) > pi ? lambda + Math.round(-lambda / tau) * tau : lambda, phi];
  }

  rotationIdentity.invert = rotationIdentity;

  adder();

  adder();

  adder();
      adder();

  adder();

  function TransformStream() {}

  TransformStream.prototype = {
    constructor: TransformStream,
    point: function(x, y) { this.stream.point(x, y); },
    sphere: function() { this.stream.sphere(); },
    lineStart: function() { this.stream.lineStart(); },
    lineEnd: function() { this.stream.lineEnd(); },
    polygonStart: function() { this.stream.polygonStart(); },
    polygonEnd: function() { this.stream.polygonEnd(); }
  };

  function equirectangularRaw(lambda, phi) {
    return [lambda, phi];
  }

  equirectangularRaw.invert = equirectangularRaw;

  function count(node) {
    var sum = 0,
        children = node.children,
        i = children && children.length;
    if (!i) sum = 1;
    else while (--i >= 0) sum += children[i].value;
    node.value = sum;
  }

  function node_count() {
    return this.eachAfter(count);
  }

  function node_each(callback) {
    var node = this, current, next = [node], children, i, n;
    do {
      current = next.reverse(), next = [];
      while (node = current.pop()) {
        callback(node), children = node.children;
        if (children) for (i = 0, n = children.length; i < n; ++i) {
          next.push(children[i]);
        }
      }
    } while (next.length);
    return this;
  }

  function node_eachBefore(callback) {
    var node = this, nodes = [node], children, i;
    while (node = nodes.pop()) {
      callback(node), children = node.children;
      if (children) for (i = children.length - 1; i >= 0; --i) {
        nodes.push(children[i]);
      }
    }
    return this;
  }

  function node_eachAfter(callback) {
    var node = this, nodes = [node], next = [], children, i, n;
    while (node = nodes.pop()) {
      next.push(node), children = node.children;
      if (children) for (i = 0, n = children.length; i < n; ++i) {
        nodes.push(children[i]);
      }
    }
    while (node = next.pop()) {
      callback(node);
    }
    return this;
  }

  function node_sum(value) {
    return this.eachAfter(function(node) {
      var sum = +value(node.data) || 0,
          children = node.children,
          i = children && children.length;
      while (--i >= 0) sum += children[i].value;
      node.value = sum;
    });
  }

  function node_sort(compare) {
    return this.eachBefore(function(node) {
      if (node.children) {
        node.children.sort(compare);
      }
    });
  }

  function node_path(end) {
    var start = this,
        ancestor = leastCommonAncestor(start, end),
        nodes = [start];
    while (start !== ancestor) {
      start = start.parent;
      nodes.push(start);
    }
    var k = nodes.length;
    while (end !== ancestor) {
      nodes.splice(k, 0, end);
      end = end.parent;
    }
    return nodes;
  }

  function leastCommonAncestor(a, b) {
    if (a === b) return a;
    var aNodes = a.ancestors(),
        bNodes = b.ancestors(),
        c = null;
    a = aNodes.pop();
    b = bNodes.pop();
    while (a === b) {
      c = a;
      a = aNodes.pop();
      b = bNodes.pop();
    }
    return c;
  }

  function node_ancestors() {
    var node = this, nodes = [node];
    while (node = node.parent) {
      nodes.push(node);
    }
    return nodes;
  }

  function node_descendants() {
    var nodes = [];
    this.each(function(node) {
      nodes.push(node);
    });
    return nodes;
  }

  function node_leaves() {
    var leaves = [];
    this.eachBefore(function(node) {
      if (!node.children) {
        leaves.push(node);
      }
    });
    return leaves;
  }

  function node_links() {
    var root = this, links = [];
    root.each(function(node) {
      if (node !== root) { // Don’t include the root’s parent, if any.
        links.push({source: node.parent, target: node});
      }
    });
    return links;
  }

  function hierarchy(data, children) {
    var root = new Node(data),
        valued = +data.value && (root.value = data.value),
        node,
        nodes = [root],
        child,
        childs,
        i,
        n;

    if (children == null) children = defaultChildren;

    while (node = nodes.pop()) {
      if (valued) node.value = +node.data.value;
      if ((childs = children(node.data)) && (n = childs.length)) {
        node.children = new Array(n);
        for (i = n - 1; i >= 0; --i) {
          nodes.push(child = node.children[i] = new Node(childs[i]));
          child.parent = node;
          child.depth = node.depth + 1;
        }
      }
    }

    return root.eachBefore(computeHeight);
  }

  function node_copy() {
    return hierarchy(this).eachBefore(copyData);
  }

  function defaultChildren(d) {
    return d.children;
  }

  function copyData(node) {
    node.data = node.data.data;
  }

  function computeHeight(node) {
    var height = 0;
    do node.height = height;
    while ((node = node.parent) && (node.height < ++height));
  }

  function Node(data) {
    this.data = data;
    this.depth =
    this.height = 0;
    this.parent = null;
  }

  Node.prototype = hierarchy.prototype = {
    constructor: Node,
    count: node_count,
    each: node_each,
    eachAfter: node_eachAfter,
    eachBefore: node_eachBefore,
    sum: node_sum,
    sort: node_sort,
    path: node_path,
    ancestors: node_ancestors,
    descendants: node_descendants,
    leaves: node_leaves,
    links: node_links,
    copy: node_copy
  };

  function treemapDice(parent, x0, y0, x1, y1) {
    var nodes = parent.children,
        node,
        i = -1,
        n = nodes.length,
        k = parent.value && (x1 - x0) / parent.value;

    while (++i < n) {
      node = nodes[i], node.y0 = y0, node.y1 = y1;
      node.x0 = x0, node.x1 = x0 += node.value * k;
    }
  }

  Object.create(Node.prototype);

  function treemapSlice(parent, x0, y0, x1, y1) {
    var nodes = parent.children,
        node,
        i = -1,
        n = nodes.length,
        k = parent.value && (y1 - y0) / parent.value;

    while (++i < n) {
      node = nodes[i], node.x0 = x0, node.x1 = x1;
      node.y0 = y0, node.y1 = y0 += node.value * k;
    }
  }

  var phi = (1 + Math.sqrt(5)) / 2;

  function squarifyRatio(ratio, parent, x0, y0, x1, y1) {
    var rows = [],
        nodes = parent.children,
        row,
        nodeValue,
        i0 = 0,
        i1 = 0,
        n = nodes.length,
        dx, dy,
        value = parent.value,
        sumValue,
        minValue,
        maxValue,
        newRatio,
        minRatio,
        alpha,
        beta;

    while (i0 < n) {
      dx = x1 - x0, dy = y1 - y0;

      // Find the next non-empty node.
      do sumValue = nodes[i1++].value; while (!sumValue && i1 < n);
      minValue = maxValue = sumValue;
      alpha = Math.max(dy / dx, dx / dy) / (value * ratio);
      beta = sumValue * sumValue * alpha;
      minRatio = Math.max(maxValue / beta, beta / minValue);

      // Keep adding nodes while the aspect ratio maintains or improves.
      for (; i1 < n; ++i1) {
        sumValue += nodeValue = nodes[i1].value;
        if (nodeValue < minValue) minValue = nodeValue;
        if (nodeValue > maxValue) maxValue = nodeValue;
        beta = sumValue * sumValue * alpha;
        newRatio = Math.max(maxValue / beta, beta / minValue);
        if (newRatio > minRatio) { sumValue -= nodeValue; break; }
        minRatio = newRatio;
      }

      // Position and record the row orientation.
      rows.push(row = {value: sumValue, dice: dx < dy, children: nodes.slice(i0, i1)});
      if (row.dice) treemapDice(row, x0, y0, x1, value ? y0 += dy * sumValue / value : y1);
      else treemapSlice(row, x0, y0, value ? x0 += dx * sumValue / value : x1, y1);
      value -= sumValue, i0 = i1;
    }

    return rows;
  }

  ((function custom(ratio) {

    function squarify(parent, x0, y0, x1, y1) {
      squarifyRatio(ratio, parent, x0, y0, x1, y1);
    }

    squarify.ratio = function(x) {
      return custom((x = +x) > 1 ? x : 1);
    };

    return squarify;
  }))(phi);

  ((function custom(ratio) {

    function resquarify(parent, x0, y0, x1, y1) {
      if ((rows = parent._squarify) && (rows.ratio === ratio)) {
        var rows,
            row,
            nodes,
            i,
            j = -1,
            n,
            m = rows.length,
            value = parent.value;

        while (++j < m) {
          row = rows[j], nodes = row.children;
          for (i = row.value = 0, n = nodes.length; i < n; ++i) row.value += nodes[i].value;
          if (row.dice) treemapDice(row, x0, y0, x1, y0 += (y1 - y0) * row.value / value);
          else treemapSlice(row, x0, y0, x0 += (x1 - x0) * row.value / value, y1);
          value -= row.value;
        }
      } else {
        parent._squarify = rows = squarifyRatio(ratio, parent, x0, y0, x1, y1);
        rows.ratio = ratio;
      }
    }

    resquarify.ratio = function(x) {
      return custom((x = +x) > 1 ? x : 1);
    };

    return resquarify;
  }))(phi);

  function defaultSource() {
    return Math.random();
  }

  ((function sourceRandomUniform(source) {
    function randomUniform(min, max) {
      min = min == null ? 0 : +min;
      max = max == null ? 1 : +max;
      if (arguments.length === 1) max = min, min = 0;
      else max -= min;
      return function() {
        return source() * max + min;
      };
    }

    randomUniform.source = sourceRandomUniform;

    return randomUniform;
  }))(defaultSource);

  var normal = (function sourceRandomNormal(source) {
    function randomNormal(mu, sigma) {
      var x, r;
      mu = mu == null ? 0 : +mu;
      sigma = sigma == null ? 1 : +sigma;
      return function() {
        var y;

        // If available, use the second previously-generated uniform random.
        if (x != null) y = x, x = null;

        // Otherwise, generate a new x and y.
        else do {
          x = source() * 2 - 1;
          y = source() * 2 - 1;
          r = x * x + y * y;
        } while (!r || r > 1);

        return mu + sigma * y * Math.sqrt(-2 * Math.log(r) / r);
      };
    }

    randomNormal.source = sourceRandomNormal;

    return randomNormal;
  })(defaultSource);

  ((function sourceRandomLogNormal(source) {
    function randomLogNormal() {
      var randomNormal = normal.source(source).apply(this, arguments);
      return function() {
        return Math.exp(randomNormal());
      };
    }

    randomLogNormal.source = sourceRandomLogNormal;

    return randomLogNormal;
  }))(defaultSource);

  var irwinHall = (function sourceRandomIrwinHall(source) {
    function randomIrwinHall(n) {
      return function() {
        for (var sum = 0, i = 0; i < n; ++i) sum += source();
        return sum;
      };
    }

    randomIrwinHall.source = sourceRandomIrwinHall;

    return randomIrwinHall;
  })(defaultSource);

  ((function sourceRandomBates(source) {
    function randomBates(n) {
      var randomIrwinHall = irwinHall.source(source)(n);
      return function() {
        return randomIrwinHall() / n;
      };
    }

    randomBates.source = sourceRandomBates;

    return randomBates;
  }))(defaultSource);

  ((function sourceRandomExponential(source) {
    function randomExponential(lambda) {
      return function() {
        return -Math.log(1 - source()) / lambda;
      };
    }

    randomExponential.source = sourceRandomExponential;

    return randomExponential;
  }))(defaultSource);

  var t0 = new Date,
      t1 = new Date;

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
        t0.setTime(+start), t1.setTime(+end);
        floori(t0), floori(t1);
        return Math.floor(count(t0, t1));
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
  millisecond.range;

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
  second.range;

  var minute = newInterval(function(date) {
    date.setTime(Math.floor(date / durationMinute) * durationMinute);
  }, function(date, step) {
    date.setTime(+date + step * durationMinute);
  }, function(start, end) {
    return (end - start) / durationMinute;
  }, function(date) {
    return date.getMinutes();
  });
  minute.range;

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
  hour.range;

  var day = newInterval(function(date) {
    date.setHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setDate(date.getDate() + step);
  }, function(start, end) {
    return (end - start - (end.getTimezoneOffset() - start.getTimezoneOffset()) * durationMinute) / durationDay;
  }, function(date) {
    return date.getDate() - 1;
  });
  day.range;

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

  sunday.range;
  monday.range;
  tuesday.range;
  wednesday.range;
  thursday.range;
  friday.range;
  saturday.range;

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
  month.range;

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
  year.range;

  var utcMinute = newInterval(function(date) {
    date.setUTCSeconds(0, 0);
  }, function(date, step) {
    date.setTime(+date + step * durationMinute);
  }, function(start, end) {
    return (end - start) / durationMinute;
  }, function(date) {
    return date.getUTCMinutes();
  });
  utcMinute.range;

  var utcHour = newInterval(function(date) {
    date.setUTCMinutes(0, 0, 0);
  }, function(date, step) {
    date.setTime(+date + step * durationHour);
  }, function(start, end) {
    return (end - start) / durationHour;
  }, function(date) {
    return date.getUTCHours();
  });
  utcHour.range;

  var utcDay = newInterval(function(date) {
    date.setUTCHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setUTCDate(date.getUTCDate() + step);
  }, function(start, end) {
    return (end - start) / durationDay;
  }, function(date) {
    return date.getUTCDate() - 1;
  });
  utcDay.range;

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

  utcSunday.range;
  utcMonday.range;
  utcTuesday.range;
  utcWednesday.range;
  utcThursday.range;
  utcFriday.range;
  utcSaturday.range;

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
  utcMonth.range;

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
  utcYear.range;

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

  function formatLocale(locale) {
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
            week, day$1;
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
            week = utcDate(newYear(d.y)), day$1 = week.getUTCDay();
            week = day$1 > 4 || day$1 === 0 ? utcMonday.ceil(week) : utcMonday(week);
            week = utcDay.offset(week, (d.V - 1) * 7);
            d.y = week.getUTCFullYear();
            d.m = week.getUTCMonth();
            d.d = week.getUTCDate() + (d.w + 6) % 7;
          } else {
            week = newDate(newYear(d.y)), day$1 = week.getDay();
            week = day$1 > 4 || day$1 === 0 ? monday.ceil(week) : monday(week);
            week = day.offset(week, (d.V - 1) * 7);
            d.y = week.getFullYear();
            d.m = week.getMonth();
            d.d = week.getDate() + (d.w + 6) % 7;
          }
        } else if ("W" in d || "U" in d) {
          if (!("w" in d)) d.w = "u" in d ? d.u % 7 : "W" in d ? 1 : 0;
          day$1 = "Z" in d ? utcDate(newYear(d.y)).getUTCDay() : newDate(newYear(d.y)).getDay();
          d.m = 0;
          d.d = "W" in d ? (d.w + 6) % 7 + d.W * 7 - (day$1 + 5) % 7 : d.w + d.U * 7 - (day$1 + 6) % 7;
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
    var day = d.getDay();
    return day === 0 ? 7 : day;
  }

  function formatWeekNumberSunday(d, p) {
    return pad(sunday.count(year(d), d), p, 2);
  }

  function formatWeekNumberISO(d, p) {
    var day = d.getDay();
    d = (day >= 4 || day === 0) ? thursday(d) : thursday.ceil(d);
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
    var day = d.getUTCDay();
    d = (day >= 4 || day === 0) ? utcThursday(d) : utcThursday.ceil(d);
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

  var locale;
  var utcFormat;
  var utcParse;

  defaultLocale({
    dateTime: "%x, %X",
    date: "%-m/%-d/%Y",
    time: "%-I:%M:%S %p",
    periods: ["AM", "PM"],
    days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    shortDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    shortMonths: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  });

  function defaultLocale(definition) {
    locale = formatLocale(definition);
    locale.format;
    locale.parse;
    utcFormat = locale.utcFormat;
    utcParse = locale.utcParse;
    return locale;
  }

  var isoSpecifier = "%Y-%m-%dT%H:%M:%S.%LZ";

  function formatIsoNative(date) {
    return date.toISOString();
  }

  Date.prototype.toISOString
      ? formatIsoNative
      : utcFormat(isoSpecifier);

  function parseIsoNative(string) {
    var date = new Date(string);
    return isNaN(date) ? null : date;
  }

  +new Date("2000-01-01T00:00:00.000Z")
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

  colors("4e79a7f28e2ce1575976b7b259a14fedc949af7aa1ff9da79c755fbab0ab");

  function ramp$1(scheme) {
    return rgbBasis(scheme[scheme.length - 1]);
  }

  var scheme$q = new Array(3).concat(
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

  ramp$1(scheme$q);

  var scheme$p = new Array(3).concat(
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

  ramp$1(scheme$p);

  var scheme$o = new Array(3).concat(
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

  ramp$1(scheme$o);

  var scheme$n = new Array(3).concat(
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

  ramp$1(scheme$n);

  var scheme$m = new Array(3).concat(
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

  ramp$1(scheme$m);

  var scheme$l = new Array(3).concat(
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

  ramp$1(scheme$l);

  var scheme$k = new Array(3).concat(
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

  ramp$1(scheme$k);

  var scheme$j = new Array(3).concat(
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

  ramp$1(scheme$j);

  var scheme$i = new Array(3).concat(
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

  ramp$1(scheme$i);

  var scheme$h = new Array(3).concat(
    "e5f5f999d8c92ca25f",
    "edf8fbb2e2e266c2a4238b45",
    "edf8fbb2e2e266c2a42ca25f006d2c",
    "edf8fbccece699d8c966c2a42ca25f006d2c",
    "edf8fbccece699d8c966c2a441ae76238b45005824",
    "f7fcfde5f5f9ccece699d8c966c2a441ae76238b45005824",
    "f7fcfde5f5f9ccece699d8c966c2a441ae76238b45006d2c00441b"
  ).map(colors);

  ramp$1(scheme$h);

  var scheme$g = new Array(3).concat(
    "e0ecf49ebcda8856a7",
    "edf8fbb3cde38c96c688419d",
    "edf8fbb3cde38c96c68856a7810f7c",
    "edf8fbbfd3e69ebcda8c96c68856a7810f7c",
    "edf8fbbfd3e69ebcda8c96c68c6bb188419d6e016b",
    "f7fcfde0ecf4bfd3e69ebcda8c96c68c6bb188419d6e016b",
    "f7fcfde0ecf4bfd3e69ebcda8c96c68c6bb188419d810f7c4d004b"
  ).map(colors);

  ramp$1(scheme$g);

  var scheme$f = new Array(3).concat(
    "e0f3dba8ddb543a2ca",
    "f0f9e8bae4bc7bccc42b8cbe",
    "f0f9e8bae4bc7bccc443a2ca0868ac",
    "f0f9e8ccebc5a8ddb57bccc443a2ca0868ac",
    "f0f9e8ccebc5a8ddb57bccc44eb3d32b8cbe08589e",
    "f7fcf0e0f3dbccebc5a8ddb57bccc44eb3d32b8cbe08589e",
    "f7fcf0e0f3dbccebc5a8ddb57bccc44eb3d32b8cbe0868ac084081"
  ).map(colors);

  ramp$1(scheme$f);

  var scheme$e = new Array(3).concat(
    "fee8c8fdbb84e34a33",
    "fef0d9fdcc8afc8d59d7301f",
    "fef0d9fdcc8afc8d59e34a33b30000",
    "fef0d9fdd49efdbb84fc8d59e34a33b30000",
    "fef0d9fdd49efdbb84fc8d59ef6548d7301f990000",
    "fff7ecfee8c8fdd49efdbb84fc8d59ef6548d7301f990000",
    "fff7ecfee8c8fdd49efdbb84fc8d59ef6548d7301fb300007f0000"
  ).map(colors);

  ramp$1(scheme$e);

  var scheme$d = new Array(3).concat(
    "ece2f0a6bddb1c9099",
    "f6eff7bdc9e167a9cf02818a",
    "f6eff7bdc9e167a9cf1c9099016c59",
    "f6eff7d0d1e6a6bddb67a9cf1c9099016c59",
    "f6eff7d0d1e6a6bddb67a9cf3690c002818a016450",
    "fff7fbece2f0d0d1e6a6bddb67a9cf3690c002818a016450",
    "fff7fbece2f0d0d1e6a6bddb67a9cf3690c002818a016c59014636"
  ).map(colors);

  ramp$1(scheme$d);

  var scheme$c = new Array(3).concat(
    "ece7f2a6bddb2b8cbe",
    "f1eef6bdc9e174a9cf0570b0",
    "f1eef6bdc9e174a9cf2b8cbe045a8d",
    "f1eef6d0d1e6a6bddb74a9cf2b8cbe045a8d",
    "f1eef6d0d1e6a6bddb74a9cf3690c00570b0034e7b",
    "fff7fbece7f2d0d1e6a6bddb74a9cf3690c00570b0034e7b",
    "fff7fbece7f2d0d1e6a6bddb74a9cf3690c00570b0045a8d023858"
  ).map(colors);

  ramp$1(scheme$c);

  var scheme$b = new Array(3).concat(
    "e7e1efc994c7dd1c77",
    "f1eef6d7b5d8df65b0ce1256",
    "f1eef6d7b5d8df65b0dd1c77980043",
    "f1eef6d4b9dac994c7df65b0dd1c77980043",
    "f1eef6d4b9dac994c7df65b0e7298ace125691003f",
    "f7f4f9e7e1efd4b9dac994c7df65b0e7298ace125691003f",
    "f7f4f9e7e1efd4b9dac994c7df65b0e7298ace125698004367001f"
  ).map(colors);

  ramp$1(scheme$b);

  var scheme$a = new Array(3).concat(
    "fde0ddfa9fb5c51b8a",
    "feebe2fbb4b9f768a1ae017e",
    "feebe2fbb4b9f768a1c51b8a7a0177",
    "feebe2fcc5c0fa9fb5f768a1c51b8a7a0177",
    "feebe2fcc5c0fa9fb5f768a1dd3497ae017e7a0177",
    "fff7f3fde0ddfcc5c0fa9fb5f768a1dd3497ae017e7a0177",
    "fff7f3fde0ddfcc5c0fa9fb5f768a1dd3497ae017e7a017749006a"
  ).map(colors);

  ramp$1(scheme$a);

  var scheme$9 = new Array(3).concat(
    "edf8b17fcdbb2c7fb8",
    "ffffcca1dab441b6c4225ea8",
    "ffffcca1dab441b6c42c7fb8253494",
    "ffffccc7e9b47fcdbb41b6c42c7fb8253494",
    "ffffccc7e9b47fcdbb41b6c41d91c0225ea80c2c84",
    "ffffd9edf8b1c7e9b47fcdbb41b6c41d91c0225ea80c2c84",
    "ffffd9edf8b1c7e9b47fcdbb41b6c41d91c0225ea8253494081d58"
  ).map(colors);

  ramp$1(scheme$9);

  var scheme$8 = new Array(3).concat(
    "f7fcb9addd8e31a354",
    "ffffccc2e69978c679238443",
    "ffffccc2e69978c67931a354006837",
    "ffffccd9f0a3addd8e78c67931a354006837",
    "ffffccd9f0a3addd8e78c67941ab5d238443005a32",
    "ffffe5f7fcb9d9f0a3addd8e78c67941ab5d238443005a32",
    "ffffe5f7fcb9d9f0a3addd8e78c67941ab5d238443006837004529"
  ).map(colors);

  ramp$1(scheme$8);

  var scheme$7 = new Array(3).concat(
    "fff7bcfec44fd95f0e",
    "ffffd4fed98efe9929cc4c02",
    "ffffd4fed98efe9929d95f0e993404",
    "ffffd4fee391fec44ffe9929d95f0e993404",
    "ffffd4fee391fec44ffe9929ec7014cc4c028c2d04",
    "ffffe5fff7bcfee391fec44ffe9929ec7014cc4c028c2d04",
    "ffffe5fff7bcfee391fec44ffe9929ec7014cc4c02993404662506"
  ).map(colors);

  ramp$1(scheme$7);

  var scheme$6 = new Array(3).concat(
    "ffeda0feb24cf03b20",
    "ffffb2fecc5cfd8d3ce31a1c",
    "ffffb2fecc5cfd8d3cf03b20bd0026",
    "ffffb2fed976feb24cfd8d3cf03b20bd0026",
    "ffffb2fed976feb24cfd8d3cfc4e2ae31a1cb10026",
    "ffffccffeda0fed976feb24cfd8d3cfc4e2ae31a1cb10026",
    "ffffccffeda0fed976feb24cfd8d3cfc4e2ae31a1cbd0026800026"
  ).map(colors);

  ramp$1(scheme$6);

  var scheme$5 = new Array(3).concat(
    "deebf79ecae13182bd",
    "eff3ffbdd7e76baed62171b5",
    "eff3ffbdd7e76baed63182bd08519c",
    "eff3ffc6dbef9ecae16baed63182bd08519c",
    "eff3ffc6dbef9ecae16baed64292c62171b5084594",
    "f7fbffdeebf7c6dbef9ecae16baed64292c62171b5084594",
    "f7fbffdeebf7c6dbef9ecae16baed64292c62171b508519c08306b"
  ).map(colors);

  ramp$1(scheme$5);

  var scheme$4 = new Array(3).concat(
    "e5f5e0a1d99b31a354",
    "edf8e9bae4b374c476238b45",
    "edf8e9bae4b374c47631a354006d2c",
    "edf8e9c7e9c0a1d99b74c47631a354006d2c",
    "edf8e9c7e9c0a1d99b74c47641ab5d238b45005a32",
    "f7fcf5e5f5e0c7e9c0a1d99b74c47641ab5d238b45005a32",
    "f7fcf5e5f5e0c7e9c0a1d99b74c47641ab5d238b45006d2c00441b"
  ).map(colors);

  ramp$1(scheme$4);

  var scheme$3 = new Array(3).concat(
    "f0f0f0bdbdbd636363",
    "f7f7f7cccccc969696525252",
    "f7f7f7cccccc969696636363252525",
    "f7f7f7d9d9d9bdbdbd969696636363252525",
    "f7f7f7d9d9d9bdbdbd969696737373525252252525",
    "fffffff0f0f0d9d9d9bdbdbd969696737373525252252525",
    "fffffff0f0f0d9d9d9bdbdbd969696737373525252252525000000"
  ).map(colors);

  ramp$1(scheme$3);

  var scheme$2 = new Array(3).concat(
    "efedf5bcbddc756bb1",
    "f2f0f7cbc9e29e9ac86a51a3",
    "f2f0f7cbc9e29e9ac8756bb154278f",
    "f2f0f7dadaebbcbddc9e9ac8756bb154278f",
    "f2f0f7dadaebbcbddc9e9ac8807dba6a51a34a1486",
    "fcfbfdefedf5dadaebbcbddc9e9ac8807dba6a51a34a1486",
    "fcfbfdefedf5dadaebbcbddc9e9ac8807dba6a51a354278f3f007d"
  ).map(colors);

  ramp$1(scheme$2);

  var scheme$1 = new Array(3).concat(
    "fee0d2fc9272de2d26",
    "fee5d9fcae91fb6a4acb181d",
    "fee5d9fcae91fb6a4ade2d26a50f15",
    "fee5d9fcbba1fc9272fb6a4ade2d26a50f15",
    "fee5d9fcbba1fc9272fb6a4aef3b2ccb181d99000d",
    "fff5f0fee0d2fcbba1fc9272fb6a4aef3b2ccb181d99000d",
    "fff5f0fee0d2fcbba1fc9272fb6a4aef3b2ccb181da50f1567000d"
  ).map(colors);

  ramp$1(scheme$1);

  var scheme = new Array(3).concat(
    "fee6cefdae6be6550d",
    "feeddefdbe85fd8d3cd94701",
    "feeddefdbe85fd8d3ce6550da63603",
    "feeddefdd0a2fdae6bfd8d3ce6550da63603",
    "feeddefdd0a2fdae6bfd8d3cf16913d948018c2d04",
    "fff5ebfee6cefdd0a2fdae6bfd8d3cf16913d948018c2d04",
    "fff5ebfee6cefdd0a2fdae6bfd8d3cf16913d94801a636037f2704"
  ).map(colors);

  ramp$1(scheme);

  cubehelixLong(cubehelix$1(300, 0.5, 0.0), cubehelix$1(-240, 0.5, 1.0));

  cubehelixLong(cubehelix$1(-100, 0.75, 0.35), cubehelix$1(80, 1.50, 0.8));

  cubehelixLong(cubehelix$1(260, 0.75, 0.35), cubehelix$1(80, 1.50, 0.8));

  cubehelix$1();

  rgb();

  function ramp(range) {
    var n = range.length;
    return function(t) {
      return range[Math.max(0, Math.min(n - 1, Math.floor(t * n)))];
    };
  }

  ramp(colors("44015444025645045745055946075a46085c460a5d460b5e470d60470e6147106347116447136548146748166848176948186a481a6c481b6d481c6e481d6f481f70482071482173482374482475482576482677482878482979472a7a472c7a472d7b472e7c472f7d46307e46327e46337f463480453581453781453882443983443a83443b84433d84433e85423f854240864241864142874144874045884046883f47883f48893e49893e4a893e4c8a3d4d8a3d4e8a3c4f8a3c508b3b518b3b528b3a538b3a548c39558c39568c38588c38598c375a8c375b8d365c8d365d8d355e8d355f8d34608d34618d33628d33638d32648e32658e31668e31678e31688e30698e306a8e2f6b8e2f6c8e2e6d8e2e6e8e2e6f8e2d708e2d718e2c718e2c728e2c738e2b748e2b758e2a768e2a778e2a788e29798e297a8e297b8e287c8e287d8e277e8e277f8e27808e26818e26828e26828e25838e25848e25858e24868e24878e23888e23898e238a8d228b8d228c8d228d8d218e8d218f8d21908d21918c20928c20928c20938c1f948c1f958b1f968b1f978b1f988b1f998a1f9a8a1e9b8a1e9c891e9d891f9e891f9f881fa0881fa1881fa1871fa28720a38620a48621a58521a68522a78522a88423a98324aa8325ab8225ac8226ad8127ad8128ae8029af7f2ab07f2cb17e2db27d2eb37c2fb47c31b57b32b67a34b67935b77937b87838b9773aba763bbb753dbc743fbc7340bd7242be7144bf7046c06f48c16e4ac16d4cc26c4ec36b50c46a52c56954c56856c66758c7655ac8645cc8635ec96260ca6063cb5f65cb5e67cc5c69cd5b6ccd5a6ece5870cf5773d05675d05477d1537ad1517cd2507fd34e81d34d84d44b86d54989d5488bd6468ed64590d74393d74195d84098d83e9bd93c9dd93ba0da39a2da37a5db36a8db34aadc32addc30b0dd2fb2dd2db5de2bb8de29bade28bddf26c0df25c2df23c5e021c8e020cae11fcde11dd0e11cd2e21bd5e21ad8e219dae319dde318dfe318e2e418e5e419e7e419eae51aece51befe51cf1e51df4e61ef6e620f8e621fbe723fde725"));

  ramp(colors("00000401000501010601010802010902020b02020d03030f03031204041405041606051806051a07061c08071e0907200a08220b09240c09260d0a290e0b2b100b2d110c2f120d31130d34140e36150e38160f3b180f3d19103f1a10421c10441d11471e114920114b21114e22115024125325125527125829115a2a115c2c115f2d11612f116331116533106734106936106b38106c390f6e3b0f703d0f713f0f72400f74420f75440f764510774710784910784a10794c117a4e117b4f127b51127c52137c54137d56147d57157e59157e5a167e5c167f5d177f5f187f601880621980641a80651a80671b80681c816a1c816b1d816d1d816e1e81701f81721f817320817521817621817822817922827b23827c23827e24828025828125818326818426818627818827818928818b29818c29818e2a81902a81912b81932b80942c80962c80982d80992d809b2e7f9c2e7f9e2f7fa02f7fa1307ea3307ea5317ea6317da8327daa337dab337cad347cae347bb0357bb2357bb3367ab5367ab73779b83779ba3878bc3978bd3977bf3a77c03a76c23b75c43c75c53c74c73d73c83e73ca3e72cc3f71cd4071cf4070d0416fd2426fd3436ed5446dd6456cd8456cd9466bdb476adc4869de4968df4a68e04c67e24d66e34e65e44f64e55064e75263e85362e95462ea5661eb5760ec5860ed5a5fee5b5eef5d5ef05f5ef1605df2625df2645cf3655cf4675cf4695cf56b5cf66c5cf66e5cf7705cf7725cf8745cf8765cf9785df9795df97b5dfa7d5efa7f5efa815ffb835ffb8560fb8761fc8961fc8a62fc8c63fc8e64fc9065fd9266fd9467fd9668fd9869fd9a6afd9b6bfe9d6cfe9f6dfea16efea36ffea571fea772fea973feaa74feac76feae77feb078feb27afeb47bfeb67cfeb77efeb97ffebb81febd82febf84fec185fec287fec488fec68afec88cfeca8dfecc8ffecd90fecf92fed194fed395fed597fed799fed89afdda9cfddc9efddea0fde0a1fde2a3fde3a5fde5a7fde7a9fde9aafdebacfcecaefceeb0fcf0b2fcf2b4fcf4b6fcf6b8fcf7b9fcf9bbfcfbbdfcfdbf"));

  ramp(colors("00000401000501010601010802010a02020c02020e03021004031204031405041706041907051b08051d09061f0a07220b07240c08260d08290e092b10092d110a30120a32140b34150b37160b39180c3c190c3e1b0c411c0c431e0c451f0c48210c4a230c4c240c4f260c51280b53290b552b0b572d0b592f0a5b310a5c320a5e340a5f3609613809623909633b09643d09653e0966400a67420a68440a68450a69470b6a490b6a4a0c6b4c0c6b4d0d6c4f0d6c510e6c520e6d540f6d550f6d57106e59106e5a116e5c126e5d126e5f136e61136e62146e64156e65156e67166e69166e6a176e6c186e6d186e6f196e71196e721a6e741a6e751b6e771c6d781c6d7a1d6d7c1d6d7d1e6d7f1e6c801f6c82206c84206b85216b87216b88226a8a226a8c23698d23698f24699025689225689326679526679727669827669a28659b29649d29649f2a63a02a63a22b62a32c61a52c60a62d60a82e5fa92e5eab2f5ead305dae305cb0315bb1325ab3325ab43359b63458b73557b93556ba3655bc3754bd3853bf3952c03a51c13a50c33b4fc43c4ec63d4dc73e4cc83f4bca404acb4149cc4248ce4347cf4446d04545d24644d34743d44842d54a41d74b3fd84c3ed94d3dda4e3cdb503bdd513ade5238df5337e05536e15635e25734e35933e45a31e55c30e65d2fe75e2ee8602de9612bea632aeb6429eb6628ec6726ed6925ee6a24ef6c23ef6e21f06f20f1711ff1731df2741cf3761bf37819f47918f57b17f57d15f67e14f68013f78212f78410f8850ff8870ef8890cf98b0bf98c0af98e09fa9008fa9207fa9407fb9606fb9706fb9906fb9b06fb9d07fc9f07fca108fca309fca50afca60cfca80dfcaa0ffcac11fcae12fcb014fcb216fcb418fbb61afbb81dfbba1ffbbc21fbbe23fac026fac228fac42afac62df9c72ff9c932f9cb35f8cd37f8cf3af7d13df7d340f6d543f6d746f5d949f5db4cf4dd4ff4df53f4e156f3e35af3e55df2e661f2e865f2ea69f1ec6df1ed71f1ef75f1f179f2f27df2f482f3f586f3f68af4f88ef5f992f6fa96f8fb9af9fc9dfafda1fcffa4"));

  ramp(colors("0d088710078813078916078a19068c1b068d1d068e20068f2206902406912605912805922a05932c05942e05952f059631059733059735049837049938049a3a049a3c049b3e049c3f049c41049d43039e44039e46039f48039f4903a04b03a14c02a14e02a25002a25102a35302a35502a45601a45801a45901a55b01a55c01a65e01a66001a66100a76300a76400a76600a76700a86900a86a00a86c00a86e00a86f00a87100a87201a87401a87501a87701a87801a87a02a87b02a87d03a87e03a88004a88104a78305a78405a78606a68707a68808a68a09a58b0aa58d0ba58e0ca48f0da4910ea3920fa39410a29511a19613a19814a099159f9a169f9c179e9d189d9e199da01a9ca11b9ba21d9aa31e9aa51f99a62098a72197a82296aa2395ab2494ac2694ad2793ae2892b02991b12a90b22b8fb32c8eb42e8db52f8cb6308bb7318ab83289ba3388bb3488bc3587bd3786be3885bf3984c03a83c13b82c23c81c33d80c43e7fc5407ec6417dc7427cc8437bc9447aca457acb4679cc4778cc4977cd4a76ce4b75cf4c74d04d73d14e72d24f71d35171d45270d5536fd5546ed6556dd7566cd8576bd9586ada5a6ada5b69db5c68dc5d67dd5e66de5f65de6164df6263e06363e16462e26561e26660e3685fe4695ee56a5de56b5de66c5ce76e5be76f5ae87059e97158e97257ea7457eb7556eb7655ec7754ed7953ed7a52ee7b51ef7c51ef7e50f07f4ff0804ef1814df1834cf2844bf3854bf3874af48849f48948f58b47f58c46f68d45f68f44f79044f79143f79342f89441f89540f9973ff9983ef99a3efa9b3dfa9c3cfa9e3bfb9f3afba139fba238fca338fca537fca636fca835fca934fdab33fdac33fdae32fdaf31fdb130fdb22ffdb42ffdb52efeb72dfeb82cfeba2cfebb2bfebd2afebe2afec029fdc229fdc328fdc527fdc627fdc827fdca26fdcb26fccd25fcce25fcd025fcd225fbd324fbd524fbd724fad824fada24f9dc24f9dd25f8df25f8e125f7e225f7e425f6e626f6e826f5e926f5eb27f4ed27f3ee27f3f027f2f227f1f426f1f525f0f724f0f921"));

  var epsilon$1 = 1e-12;

  function noop() {}

  function point$3(that, x, y) {
    that._context.bezierCurveTo(
      (2 * that._x0 + that._x1) / 3,
      (2 * that._y0 + that._y1) / 3,
      (that._x0 + 2 * that._x1) / 3,
      (that._y0 + 2 * that._y1) / 3,
      (that._x0 + 4 * that._x1 + x) / 6,
      (that._y0 + 4 * that._y1 + y) / 6
    );
  }

  function Basis(context) {
    this._context = context;
  }

  Basis.prototype = {
    areaStart: function() {
      this._line = 0;
    },
    areaEnd: function() {
      this._line = NaN;
    },
    lineStart: function() {
      this._x0 = this._x1 =
      this._y0 = this._y1 = NaN;
      this._point = 0;
    },
    lineEnd: function() {
      switch (this._point) {
        case 3: point$3(this, this._x1, this._y1); // proceed
        case 2: this._context.lineTo(this._x1, this._y1); break;
      }
      if (this._line || (this._line !== 0 && this._point === 1)) this._context.closePath();
      this._line = 1 - this._line;
    },
    point: function(x, y) {
      x = +x, y = +y;
      switch (this._point) {
        case 0: this._point = 1; this._line ? this._context.lineTo(x, y) : this._context.moveTo(x, y); break;
        case 1: this._point = 2; break;
        case 2: this._point = 3; this._context.lineTo((5 * this._x0 + this._x1) / 6, (5 * this._y0 + this._y1) / 6); // proceed
        default: point$3(this, x, y); break;
      }
      this._x0 = this._x1, this._x1 = x;
      this._y0 = this._y1, this._y1 = y;
    }
  };

  function Bundle(context, beta) {
    this._basis = new Basis(context);
    this._beta = beta;
  }

  Bundle.prototype = {
    lineStart: function() {
      this._x = [];
      this._y = [];
      this._basis.lineStart();
    },
    lineEnd: function() {
      var x = this._x,
          y = this._y,
          j = x.length - 1;

      if (j > 0) {
        var x0 = x[0],
            y0 = y[0],
            dx = x[j] - x0,
            dy = y[j] - y0,
            i = -1,
            t;

        while (++i <= j) {
          t = i / j;
          this._basis.point(
            this._beta * x[i] + (1 - this._beta) * (x0 + t * dx),
            this._beta * y[i] + (1 - this._beta) * (y0 + t * dy)
          );
        }
      }

      this._x = this._y = null;
      this._basis.lineEnd();
    },
    point: function(x, y) {
      this._x.push(+x);
      this._y.push(+y);
    }
  };

  ((function custom(beta) {

    function bundle(context) {
      return beta === 1 ? new Basis(context) : new Bundle(context, beta);
    }

    bundle.beta = function(beta) {
      return custom(+beta);
    };

    return bundle;
  }))(0.85);

  function point$2(that, x, y) {
    that._context.bezierCurveTo(
      that._x1 + that._k * (that._x2 - that._x0),
      that._y1 + that._k * (that._y2 - that._y0),
      that._x2 + that._k * (that._x1 - x),
      that._y2 + that._k * (that._y1 - y),
      that._x2,
      that._y2
    );
  }

  function Cardinal(context, tension) {
    this._context = context;
    this._k = (1 - tension) / 6;
  }

  Cardinal.prototype = {
    areaStart: function() {
      this._line = 0;
    },
    areaEnd: function() {
      this._line = NaN;
    },
    lineStart: function() {
      this._x0 = this._x1 = this._x2 =
      this._y0 = this._y1 = this._y2 = NaN;
      this._point = 0;
    },
    lineEnd: function() {
      switch (this._point) {
        case 2: this._context.lineTo(this._x2, this._y2); break;
        case 3: point$2(this, this._x1, this._y1); break;
      }
      if (this._line || (this._line !== 0 && this._point === 1)) this._context.closePath();
      this._line = 1 - this._line;
    },
    point: function(x, y) {
      x = +x, y = +y;
      switch (this._point) {
        case 0: this._point = 1; this._line ? this._context.lineTo(x, y) : this._context.moveTo(x, y); break;
        case 1: this._point = 2; this._x1 = x, this._y1 = y; break;
        case 2: this._point = 3; // proceed
        default: point$2(this, x, y); break;
      }
      this._x0 = this._x1, this._x1 = this._x2, this._x2 = x;
      this._y0 = this._y1, this._y1 = this._y2, this._y2 = y;
    }
  };

  ((function custom(tension) {

    function cardinal(context) {
      return new Cardinal(context, tension);
    }

    cardinal.tension = function(tension) {
      return custom(+tension);
    };

    return cardinal;
  }))(0);

  function CardinalClosed(context, tension) {
    this._context = context;
    this._k = (1 - tension) / 6;
  }

  CardinalClosed.prototype = {
    areaStart: noop,
    areaEnd: noop,
    lineStart: function() {
      this._x0 = this._x1 = this._x2 = this._x3 = this._x4 = this._x5 =
      this._y0 = this._y1 = this._y2 = this._y3 = this._y4 = this._y5 = NaN;
      this._point = 0;
    },
    lineEnd: function() {
      switch (this._point) {
        case 1: {
          this._context.moveTo(this._x3, this._y3);
          this._context.closePath();
          break;
        }
        case 2: {
          this._context.lineTo(this._x3, this._y3);
          this._context.closePath();
          break;
        }
        case 3: {
          this.point(this._x3, this._y3);
          this.point(this._x4, this._y4);
          this.point(this._x5, this._y5);
          break;
        }
      }
    },
    point: function(x, y) {
      x = +x, y = +y;
      switch (this._point) {
        case 0: this._point = 1; this._x3 = x, this._y3 = y; break;
        case 1: this._point = 2; this._context.moveTo(this._x4 = x, this._y4 = y); break;
        case 2: this._point = 3; this._x5 = x, this._y5 = y; break;
        default: point$2(this, x, y); break;
      }
      this._x0 = this._x1, this._x1 = this._x2, this._x2 = x;
      this._y0 = this._y1, this._y1 = this._y2, this._y2 = y;
    }
  };

  ((function custom(tension) {

    function cardinal(context) {
      return new CardinalClosed(context, tension);
    }

    cardinal.tension = function(tension) {
      return custom(+tension);
    };

    return cardinal;
  }))(0);

  function CardinalOpen(context, tension) {
    this._context = context;
    this._k = (1 - tension) / 6;
  }

  CardinalOpen.prototype = {
    areaStart: function() {
      this._line = 0;
    },
    areaEnd: function() {
      this._line = NaN;
    },
    lineStart: function() {
      this._x0 = this._x1 = this._x2 =
      this._y0 = this._y1 = this._y2 = NaN;
      this._point = 0;
    },
    lineEnd: function() {
      if (this._line || (this._line !== 0 && this._point === 3)) this._context.closePath();
      this._line = 1 - this._line;
    },
    point: function(x, y) {
      x = +x, y = +y;
      switch (this._point) {
        case 0: this._point = 1; break;
        case 1: this._point = 2; break;
        case 2: this._point = 3; this._line ? this._context.lineTo(this._x2, this._y2) : this._context.moveTo(this._x2, this._y2); break;
        case 3: this._point = 4; // proceed
        default: point$2(this, x, y); break;
      }
      this._x0 = this._x1, this._x1 = this._x2, this._x2 = x;
      this._y0 = this._y1, this._y1 = this._y2, this._y2 = y;
    }
  };

  ((function custom(tension) {

    function cardinal(context) {
      return new CardinalOpen(context, tension);
    }

    cardinal.tension = function(tension) {
      return custom(+tension);
    };

    return cardinal;
  }))(0);

  function point$1(that, x, y) {
    var x1 = that._x1,
        y1 = that._y1,
        x2 = that._x2,
        y2 = that._y2;

    if (that._l01_a > epsilon$1) {
      var a = 2 * that._l01_2a + 3 * that._l01_a * that._l12_a + that._l12_2a,
          n = 3 * that._l01_a * (that._l01_a + that._l12_a);
      x1 = (x1 * a - that._x0 * that._l12_2a + that._x2 * that._l01_2a) / n;
      y1 = (y1 * a - that._y0 * that._l12_2a + that._y2 * that._l01_2a) / n;
    }

    if (that._l23_a > epsilon$1) {
      var b = 2 * that._l23_2a + 3 * that._l23_a * that._l12_a + that._l12_2a,
          m = 3 * that._l23_a * (that._l23_a + that._l12_a);
      x2 = (x2 * b + that._x1 * that._l23_2a - x * that._l12_2a) / m;
      y2 = (y2 * b + that._y1 * that._l23_2a - y * that._l12_2a) / m;
    }

    that._context.bezierCurveTo(x1, y1, x2, y2, that._x2, that._y2);
  }

  function CatmullRom(context, alpha) {
    this._context = context;
    this._alpha = alpha;
  }

  CatmullRom.prototype = {
    areaStart: function() {
      this._line = 0;
    },
    areaEnd: function() {
      this._line = NaN;
    },
    lineStart: function() {
      this._x0 = this._x1 = this._x2 =
      this._y0 = this._y1 = this._y2 = NaN;
      this._l01_a = this._l12_a = this._l23_a =
      this._l01_2a = this._l12_2a = this._l23_2a =
      this._point = 0;
    },
    lineEnd: function() {
      switch (this._point) {
        case 2: this._context.lineTo(this._x2, this._y2); break;
        case 3: this.point(this._x2, this._y2); break;
      }
      if (this._line || (this._line !== 0 && this._point === 1)) this._context.closePath();
      this._line = 1 - this._line;
    },
    point: function(x, y) {
      x = +x, y = +y;

      if (this._point) {
        var x23 = this._x2 - x,
            y23 = this._y2 - y;
        this._l23_a = Math.sqrt(this._l23_2a = Math.pow(x23 * x23 + y23 * y23, this._alpha));
      }

      switch (this._point) {
        case 0: this._point = 1; this._line ? this._context.lineTo(x, y) : this._context.moveTo(x, y); break;
        case 1: this._point = 2; break;
        case 2: this._point = 3; // proceed
        default: point$1(this, x, y); break;
      }

      this._l01_a = this._l12_a, this._l12_a = this._l23_a;
      this._l01_2a = this._l12_2a, this._l12_2a = this._l23_2a;
      this._x0 = this._x1, this._x1 = this._x2, this._x2 = x;
      this._y0 = this._y1, this._y1 = this._y2, this._y2 = y;
    }
  };

  ((function custom(alpha) {

    function catmullRom(context) {
      return alpha ? new CatmullRom(context, alpha) : new Cardinal(context, 0);
    }

    catmullRom.alpha = function(alpha) {
      return custom(+alpha);
    };

    return catmullRom;
  }))(0.5);

  function CatmullRomClosed(context, alpha) {
    this._context = context;
    this._alpha = alpha;
  }

  CatmullRomClosed.prototype = {
    areaStart: noop,
    areaEnd: noop,
    lineStart: function() {
      this._x0 = this._x1 = this._x2 = this._x3 = this._x4 = this._x5 =
      this._y0 = this._y1 = this._y2 = this._y3 = this._y4 = this._y5 = NaN;
      this._l01_a = this._l12_a = this._l23_a =
      this._l01_2a = this._l12_2a = this._l23_2a =
      this._point = 0;
    },
    lineEnd: function() {
      switch (this._point) {
        case 1: {
          this._context.moveTo(this._x3, this._y3);
          this._context.closePath();
          break;
        }
        case 2: {
          this._context.lineTo(this._x3, this._y3);
          this._context.closePath();
          break;
        }
        case 3: {
          this.point(this._x3, this._y3);
          this.point(this._x4, this._y4);
          this.point(this._x5, this._y5);
          break;
        }
      }
    },
    point: function(x, y) {
      x = +x, y = +y;

      if (this._point) {
        var x23 = this._x2 - x,
            y23 = this._y2 - y;
        this._l23_a = Math.sqrt(this._l23_2a = Math.pow(x23 * x23 + y23 * y23, this._alpha));
      }

      switch (this._point) {
        case 0: this._point = 1; this._x3 = x, this._y3 = y; break;
        case 1: this._point = 2; this._context.moveTo(this._x4 = x, this._y4 = y); break;
        case 2: this._point = 3; this._x5 = x, this._y5 = y; break;
        default: point$1(this, x, y); break;
      }

      this._l01_a = this._l12_a, this._l12_a = this._l23_a;
      this._l01_2a = this._l12_2a, this._l12_2a = this._l23_2a;
      this._x0 = this._x1, this._x1 = this._x2, this._x2 = x;
      this._y0 = this._y1, this._y1 = this._y2, this._y2 = y;
    }
  };

  ((function custom(alpha) {

    function catmullRom(context) {
      return alpha ? new CatmullRomClosed(context, alpha) : new CardinalClosed(context, 0);
    }

    catmullRom.alpha = function(alpha) {
      return custom(+alpha);
    };

    return catmullRom;
  }))(0.5);

  function CatmullRomOpen(context, alpha) {
    this._context = context;
    this._alpha = alpha;
  }

  CatmullRomOpen.prototype = {
    areaStart: function() {
      this._line = 0;
    },
    areaEnd: function() {
      this._line = NaN;
    },
    lineStart: function() {
      this._x0 = this._x1 = this._x2 =
      this._y0 = this._y1 = this._y2 = NaN;
      this._l01_a = this._l12_a = this._l23_a =
      this._l01_2a = this._l12_2a = this._l23_2a =
      this._point = 0;
    },
    lineEnd: function() {
      if (this._line || (this._line !== 0 && this._point === 3)) this._context.closePath();
      this._line = 1 - this._line;
    },
    point: function(x, y) {
      x = +x, y = +y;

      if (this._point) {
        var x23 = this._x2 - x,
            y23 = this._y2 - y;
        this._l23_a = Math.sqrt(this._l23_2a = Math.pow(x23 * x23 + y23 * y23, this._alpha));
      }

      switch (this._point) {
        case 0: this._point = 1; break;
        case 1: this._point = 2; break;
        case 2: this._point = 3; this._line ? this._context.lineTo(this._x2, this._y2) : this._context.moveTo(this._x2, this._y2); break;
        case 3: this._point = 4; // proceed
        default: point$1(this, x, y); break;
      }

      this._l01_a = this._l12_a, this._l12_a = this._l23_a;
      this._l01_2a = this._l12_2a, this._l12_2a = this._l23_2a;
      this._x0 = this._x1, this._x1 = this._x2, this._x2 = x;
      this._y0 = this._y1, this._y1 = this._y2, this._y2 = y;
    }
  };

  ((function custom(alpha) {

    function catmullRom(context) {
      return alpha ? new CatmullRomOpen(context, alpha) : new CardinalOpen(context, 0);
    }

    catmullRom.alpha = function(alpha) {
      return custom(+alpha);
    };

    return catmullRom;
  }))(0.5);

  function sign(x) {
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
    return (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0;
  }

  // Calculate a one-sided slope.
  function slope2(that, t) {
    var h = that._x1 - that._x0;
    return h ? (3 * (that._y1 - that._y0) / h - t) / 2 : t;
  }

  // According to https://en.wikipedia.org/wiki/Cubic_Hermite_spline#Representations
  // "you can express cubic Hermite interpolation in terms of cubic Bézier curves
  // with respect to the four values p0, p0 + m0 / 3, p1 - m1 / 3, p1".
  function point(that, t0, t1) {
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
        case 3: point(this, this._t0, slope2(this, this._t0)); break;
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
        case 2: this._point = 3; point(this, slope2(this, t1 = slope3(this, x, y)), t1); break;
        default: point(this, this._t0, t1 = slope3(this, x, y)); break;
      }

      this._x0 = this._x1, this._x1 = x;
      this._y0 = this._y1, this._y1 = y;
      this._t0 = t1;
    }
  };

  (Object.create(MonotoneX.prototype)).point = function(x, y) {
    MonotoneX.prototype.point.call(this, y, x);
  };

  function RedBlackTree() {
    this._ = null; // root node
  }

  function RedBlackNode(node) {
    node.U = // parent node
    node.C = // color - true for red, false for black
    node.L = // left node
    node.R = // right node
    node.P = // previous node
    node.N = null; // next node
  }

  RedBlackTree.prototype = {
    constructor: RedBlackTree,

    insert: function(after, node) {
      var parent, grandpa, uncle;

      if (after) {
        node.P = after;
        node.N = after.N;
        if (after.N) after.N.P = node;
        after.N = node;
        if (after.R) {
          after = after.R;
          while (after.L) after = after.L;
          after.L = node;
        } else {
          after.R = node;
        }
        parent = after;
      } else if (this._) {
        after = RedBlackFirst(this._);
        node.P = null;
        node.N = after;
        after.P = after.L = node;
        parent = after;
      } else {
        node.P = node.N = null;
        this._ = node;
        parent = null;
      }
      node.L = node.R = null;
      node.U = parent;
      node.C = true;

      after = node;
      while (parent && parent.C) {
        grandpa = parent.U;
        if (parent === grandpa.L) {
          uncle = grandpa.R;
          if (uncle && uncle.C) {
            parent.C = uncle.C = false;
            grandpa.C = true;
            after = grandpa;
          } else {
            if (after === parent.R) {
              RedBlackRotateLeft(this, parent);
              after = parent;
              parent = after.U;
            }
            parent.C = false;
            grandpa.C = true;
            RedBlackRotateRight(this, grandpa);
          }
        } else {
          uncle = grandpa.L;
          if (uncle && uncle.C) {
            parent.C = uncle.C = false;
            grandpa.C = true;
            after = grandpa;
          } else {
            if (after === parent.L) {
              RedBlackRotateRight(this, parent);
              after = parent;
              parent = after.U;
            }
            parent.C = false;
            grandpa.C = true;
            RedBlackRotateLeft(this, grandpa);
          }
        }
        parent = after.U;
      }
      this._.C = false;
    },

    remove: function(node) {
      if (node.N) node.N.P = node.P;
      if (node.P) node.P.N = node.N;
      node.N = node.P = null;

      var parent = node.U,
          sibling,
          left = node.L,
          right = node.R,
          next,
          red;

      if (!left) next = right;
      else if (!right) next = left;
      else next = RedBlackFirst(right);

      if (parent) {
        if (parent.L === node) parent.L = next;
        else parent.R = next;
      } else {
        this._ = next;
      }

      if (left && right) {
        red = next.C;
        next.C = node.C;
        next.L = left;
        left.U = next;
        if (next !== right) {
          parent = next.U;
          next.U = node.U;
          node = next.R;
          parent.L = node;
          next.R = right;
          right.U = next;
        } else {
          next.U = parent;
          parent = next;
          node = next.R;
        }
      } else {
        red = node.C;
        node = next;
      }

      if (node) node.U = parent;
      if (red) return;
      if (node && node.C) { node.C = false; return; }

      do {
        if (node === this._) break;
        if (node === parent.L) {
          sibling = parent.R;
          if (sibling.C) {
            sibling.C = false;
            parent.C = true;
            RedBlackRotateLeft(this, parent);
            sibling = parent.R;
          }
          if ((sibling.L && sibling.L.C)
              || (sibling.R && sibling.R.C)) {
            if (!sibling.R || !sibling.R.C) {
              sibling.L.C = false;
              sibling.C = true;
              RedBlackRotateRight(this, sibling);
              sibling = parent.R;
            }
            sibling.C = parent.C;
            parent.C = sibling.R.C = false;
            RedBlackRotateLeft(this, parent);
            node = this._;
            break;
          }
        } else {
          sibling = parent.L;
          if (sibling.C) {
            sibling.C = false;
            parent.C = true;
            RedBlackRotateRight(this, parent);
            sibling = parent.L;
          }
          if ((sibling.L && sibling.L.C)
            || (sibling.R && sibling.R.C)) {
            if (!sibling.L || !sibling.L.C) {
              sibling.R.C = false;
              sibling.C = true;
              RedBlackRotateLeft(this, sibling);
              sibling = parent.L;
            }
            sibling.C = parent.C;
            parent.C = sibling.L.C = false;
            RedBlackRotateRight(this, parent);
            node = this._;
            break;
          }
        }
        sibling.C = true;
        node = parent;
        parent = parent.U;
      } while (!node.C);

      if (node) node.C = false;
    }
  };

  function RedBlackRotateLeft(tree, node) {
    var p = node,
        q = node.R,
        parent = p.U;

    if (parent) {
      if (parent.L === p) parent.L = q;
      else parent.R = q;
    } else {
      tree._ = q;
    }

    q.U = parent;
    p.U = q;
    p.R = q.L;
    if (p.R) p.R.U = p;
    q.L = p;
  }

  function RedBlackRotateRight(tree, node) {
    var p = node,
        q = node.L,
        parent = p.U;

    if (parent) {
      if (parent.L === p) parent.L = q;
      else parent.R = q;
    } else {
      tree._ = q;
    }

    q.U = parent;
    p.U = q;
    p.L = q.R;
    if (p.L) p.L.U = p;
    q.R = p;
  }

  function RedBlackFirst(node) {
    while (node.L) node = node.L;
    return node;
  }

  function createEdge(left, right, v0, v1) {
    var edge = [null, null],
        index = edges.push(edge) - 1;
    edge.left = left;
    edge.right = right;
    if (v0) setEdgeEnd(edge, left, right, v0);
    if (v1) setEdgeEnd(edge, right, left, v1);
    cells[left.index].halfedges.push(index);
    cells[right.index].halfedges.push(index);
    return edge;
  }

  function createBorderEdge(left, v0, v1) {
    var edge = [v0, v1];
    edge.left = left;
    return edge;
  }

  function setEdgeEnd(edge, left, right, vertex) {
    if (!edge[0] && !edge[1]) {
      edge[0] = vertex;
      edge.left = left;
      edge.right = right;
    } else if (edge.left === right) {
      edge[1] = vertex;
    } else {
      edge[0] = vertex;
    }
  }

  // Liang–Barsky line clipping.
  function clipEdge(edge, x0, y0, x1, y1) {
    var a = edge[0],
        b = edge[1],
        ax = a[0],
        ay = a[1],
        bx = b[0],
        by = b[1],
        t0 = 0,
        t1 = 1,
        dx = bx - ax,
        dy = by - ay,
        r;

    r = x0 - ax;
    if (!dx && r > 0) return;
    r /= dx;
    if (dx < 0) {
      if (r < t0) return;
      if (r < t1) t1 = r;
    } else if (dx > 0) {
      if (r > t1) return;
      if (r > t0) t0 = r;
    }

    r = x1 - ax;
    if (!dx && r < 0) return;
    r /= dx;
    if (dx < 0) {
      if (r > t1) return;
      if (r > t0) t0 = r;
    } else if (dx > 0) {
      if (r < t0) return;
      if (r < t1) t1 = r;
    }

    r = y0 - ay;
    if (!dy && r > 0) return;
    r /= dy;
    if (dy < 0) {
      if (r < t0) return;
      if (r < t1) t1 = r;
    } else if (dy > 0) {
      if (r > t1) return;
      if (r > t0) t0 = r;
    }

    r = y1 - ay;
    if (!dy && r < 0) return;
    r /= dy;
    if (dy < 0) {
      if (r > t1) return;
      if (r > t0) t0 = r;
    } else if (dy > 0) {
      if (r < t0) return;
      if (r < t1) t1 = r;
    }

    if (!(t0 > 0) && !(t1 < 1)) return true; // TODO Better check?

    if (t0 > 0) edge[0] = [ax + t0 * dx, ay + t0 * dy];
    if (t1 < 1) edge[1] = [ax + t1 * dx, ay + t1 * dy];
    return true;
  }

  function connectEdge(edge, x0, y0, x1, y1) {
    var v1 = edge[1];
    if (v1) return true;

    var v0 = edge[0],
        left = edge.left,
        right = edge.right,
        lx = left[0],
        ly = left[1],
        rx = right[0],
        ry = right[1],
        fx = (lx + rx) / 2,
        fy = (ly + ry) / 2,
        fm,
        fb;

    if (ry === ly) {
      if (fx < x0 || fx >= x1) return;
      if (lx > rx) {
        if (!v0) v0 = [fx, y0];
        else if (v0[1] >= y1) return;
        v1 = [fx, y1];
      } else {
        if (!v0) v0 = [fx, y1];
        else if (v0[1] < y0) return;
        v1 = [fx, y0];
      }
    } else {
      fm = (lx - rx) / (ry - ly);
      fb = fy - fm * fx;
      if (fm < -1 || fm > 1) {
        if (lx > rx) {
          if (!v0) v0 = [(y0 - fb) / fm, y0];
          else if (v0[1] >= y1) return;
          v1 = [(y1 - fb) / fm, y1];
        } else {
          if (!v0) v0 = [(y1 - fb) / fm, y1];
          else if (v0[1] < y0) return;
          v1 = [(y0 - fb) / fm, y0];
        }
      } else {
        if (ly < ry) {
          if (!v0) v0 = [x0, fm * x0 + fb];
          else if (v0[0] >= x1) return;
          v1 = [x1, fm * x1 + fb];
        } else {
          if (!v0) v0 = [x1, fm * x1 + fb];
          else if (v0[0] < x0) return;
          v1 = [x0, fm * x0 + fb];
        }
      }
    }

    edge[0] = v0;
    edge[1] = v1;
    return true;
  }

  function clipEdges(x0, y0, x1, y1) {
    var i = edges.length,
        edge;

    while (i--) {
      if (!connectEdge(edge = edges[i], x0, y0, x1, y1)
          || !clipEdge(edge, x0, y0, x1, y1)
          || !(Math.abs(edge[0][0] - edge[1][0]) > epsilon
              || Math.abs(edge[0][1] - edge[1][1]) > epsilon)) {
        delete edges[i];
      }
    }
  }

  function createCell(site) {
    return cells[site.index] = {
      site: site,
      halfedges: []
    };
  }

  function cellHalfedgeAngle(cell, edge) {
    var site = cell.site,
        va = edge.left,
        vb = edge.right;
    if (site === vb) vb = va, va = site;
    if (vb) return Math.atan2(vb[1] - va[1], vb[0] - va[0]);
    if (site === va) va = edge[1], vb = edge[0];
    else va = edge[0], vb = edge[1];
    return Math.atan2(va[0] - vb[0], vb[1] - va[1]);
  }

  function cellHalfedgeStart(cell, edge) {
    return edge[+(edge.left !== cell.site)];
  }

  function cellHalfedgeEnd(cell, edge) {
    return edge[+(edge.left === cell.site)];
  }

  function sortCellHalfedges() {
    for (var i = 0, n = cells.length, cell, halfedges, j, m; i < n; ++i) {
      if ((cell = cells[i]) && (m = (halfedges = cell.halfedges).length)) {
        var index = new Array(m),
            array = new Array(m);
        for (j = 0; j < m; ++j) index[j] = j, array[j] = cellHalfedgeAngle(cell, edges[halfedges[j]]);
        index.sort(function(i, j) { return array[j] - array[i]; });
        for (j = 0; j < m; ++j) array[j] = halfedges[index[j]];
        for (j = 0; j < m; ++j) halfedges[j] = array[j];
      }
    }
  }

  function clipCells(x0, y0, x1, y1) {
    var nCells = cells.length,
        iCell,
        cell,
        site,
        iHalfedge,
        halfedges,
        nHalfedges,
        start,
        startX,
        startY,
        end,
        endX,
        endY,
        cover = true;

    for (iCell = 0; iCell < nCells; ++iCell) {
      if (cell = cells[iCell]) {
        site = cell.site;
        halfedges = cell.halfedges;
        iHalfedge = halfedges.length;

        // Remove any dangling clipped edges.
        while (iHalfedge--) {
          if (!edges[halfedges[iHalfedge]]) {
            halfedges.splice(iHalfedge, 1);
          }
        }

        // Insert any border edges as necessary.
        iHalfedge = 0, nHalfedges = halfedges.length;
        while (iHalfedge < nHalfedges) {
          end = cellHalfedgeEnd(cell, edges[halfedges[iHalfedge]]), endX = end[0], endY = end[1];
          start = cellHalfedgeStart(cell, edges[halfedges[++iHalfedge % nHalfedges]]), startX = start[0], startY = start[1];
          if (Math.abs(endX - startX) > epsilon || Math.abs(endY - startY) > epsilon) {
            halfedges.splice(iHalfedge, 0, edges.push(createBorderEdge(site, end,
                Math.abs(endX - x0) < epsilon && y1 - endY > epsilon ? [x0, Math.abs(startX - x0) < epsilon ? startY : y1]
                : Math.abs(endY - y1) < epsilon && x1 - endX > epsilon ? [Math.abs(startY - y1) < epsilon ? startX : x1, y1]
                : Math.abs(endX - x1) < epsilon && endY - y0 > epsilon ? [x1, Math.abs(startX - x1) < epsilon ? startY : y0]
                : Math.abs(endY - y0) < epsilon && endX - x0 > epsilon ? [Math.abs(startY - y0) < epsilon ? startX : x0, y0]
                : null)) - 1);
            ++nHalfedges;
          }
        }

        if (nHalfedges) cover = false;
      }
    }

    // If there weren’t any edges, have the closest site cover the extent.
    // It doesn’t matter which corner of the extent we measure!
    if (cover) {
      var dx, dy, d2, dc = Infinity;

      for (iCell = 0, cover = null; iCell < nCells; ++iCell) {
        if (cell = cells[iCell]) {
          site = cell.site;
          dx = site[0] - x0;
          dy = site[1] - y0;
          d2 = dx * dx + dy * dy;
          if (d2 < dc) dc = d2, cover = cell;
        }
      }

      if (cover) {
        var v00 = [x0, y0], v01 = [x0, y1], v11 = [x1, y1], v10 = [x1, y0];
        cover.halfedges.push(
          edges.push(createBorderEdge(site = cover.site, v00, v01)) - 1,
          edges.push(createBorderEdge(site, v01, v11)) - 1,
          edges.push(createBorderEdge(site, v11, v10)) - 1,
          edges.push(createBorderEdge(site, v10, v00)) - 1
        );
      }
    }

    // Lastly delete any cells with no edges; these were entirely clipped.
    for (iCell = 0; iCell < nCells; ++iCell) {
      if (cell = cells[iCell]) {
        if (!cell.halfedges.length) {
          delete cells[iCell];
        }
      }
    }
  }

  var circlePool = [];

  var firstCircle;

  function Circle() {
    RedBlackNode(this);
    this.x =
    this.y =
    this.arc =
    this.site =
    this.cy = null;
  }

  function attachCircle(arc) {
    var lArc = arc.P,
        rArc = arc.N;

    if (!lArc || !rArc) return;

    var lSite = lArc.site,
        cSite = arc.site,
        rSite = rArc.site;

    if (lSite === rSite) return;

    var bx = cSite[0],
        by = cSite[1],
        ax = lSite[0] - bx,
        ay = lSite[1] - by,
        cx = rSite[0] - bx,
        cy = rSite[1] - by;

    var d = 2 * (ax * cy - ay * cx);
    if (d >= -epsilon2) return;

    var ha = ax * ax + ay * ay,
        hc = cx * cx + cy * cy,
        x = (cy * ha - ay * hc) / d,
        y = (ax * hc - cx * ha) / d;

    var circle = circlePool.pop() || new Circle;
    circle.arc = arc;
    circle.site = cSite;
    circle.x = x + bx;
    circle.y = (circle.cy = y + by) + Math.sqrt(x * x + y * y); // y bottom

    arc.circle = circle;

    var before = null,
        node = circles._;

    while (node) {
      if (circle.y < node.y || (circle.y === node.y && circle.x <= node.x)) {
        if (node.L) node = node.L;
        else { before = node.P; break; }
      } else {
        if (node.R) node = node.R;
        else { before = node; break; }
      }
    }

    circles.insert(before, circle);
    if (!before) firstCircle = circle;
  }

  function detachCircle(arc) {
    var circle = arc.circle;
    if (circle) {
      if (!circle.P) firstCircle = circle.N;
      circles.remove(circle);
      circlePool.push(circle);
      RedBlackNode(circle);
      arc.circle = null;
    }
  }

  var beachPool = [];

  function Beach() {
    RedBlackNode(this);
    this.edge =
    this.site =
    this.circle = null;
  }

  function createBeach(site) {
    var beach = beachPool.pop() || new Beach;
    beach.site = site;
    return beach;
  }

  function detachBeach(beach) {
    detachCircle(beach);
    beaches.remove(beach);
    beachPool.push(beach);
    RedBlackNode(beach);
  }

  function removeBeach(beach) {
    var circle = beach.circle,
        x = circle.x,
        y = circle.cy,
        vertex = [x, y],
        previous = beach.P,
        next = beach.N,
        disappearing = [beach];

    detachBeach(beach);

    var lArc = previous;
    while (lArc.circle
        && Math.abs(x - lArc.circle.x) < epsilon
        && Math.abs(y - lArc.circle.cy) < epsilon) {
      previous = lArc.P;
      disappearing.unshift(lArc);
      detachBeach(lArc);
      lArc = previous;
    }

    disappearing.unshift(lArc);
    detachCircle(lArc);

    var rArc = next;
    while (rArc.circle
        && Math.abs(x - rArc.circle.x) < epsilon
        && Math.abs(y - rArc.circle.cy) < epsilon) {
      next = rArc.N;
      disappearing.push(rArc);
      detachBeach(rArc);
      rArc = next;
    }

    disappearing.push(rArc);
    detachCircle(rArc);

    var nArcs = disappearing.length,
        iArc;
    for (iArc = 1; iArc < nArcs; ++iArc) {
      rArc = disappearing[iArc];
      lArc = disappearing[iArc - 1];
      setEdgeEnd(rArc.edge, lArc.site, rArc.site, vertex);
    }

    lArc = disappearing[0];
    rArc = disappearing[nArcs - 1];
    rArc.edge = createEdge(lArc.site, rArc.site, null, vertex);

    attachCircle(lArc);
    attachCircle(rArc);
  }

  function addBeach(site) {
    var x = site[0],
        directrix = site[1],
        lArc,
        rArc,
        dxl,
        dxr,
        node = beaches._;

    while (node) {
      dxl = leftBreakPoint(node, directrix) - x;
      if (dxl > epsilon) node = node.L; else {
        dxr = x - rightBreakPoint(node, directrix);
        if (dxr > epsilon) {
          if (!node.R) {
            lArc = node;
            break;
          }
          node = node.R;
        } else {
          if (dxl > -epsilon) {
            lArc = node.P;
            rArc = node;
          } else if (dxr > -epsilon) {
            lArc = node;
            rArc = node.N;
          } else {
            lArc = rArc = node;
          }
          break;
        }
      }
    }

    createCell(site);
    var newArc = createBeach(site);
    beaches.insert(lArc, newArc);

    if (!lArc && !rArc) return;

    if (lArc === rArc) {
      detachCircle(lArc);
      rArc = createBeach(lArc.site);
      beaches.insert(newArc, rArc);
      newArc.edge = rArc.edge = createEdge(lArc.site, newArc.site);
      attachCircle(lArc);
      attachCircle(rArc);
      return;
    }

    if (!rArc) { // && lArc
      newArc.edge = createEdge(lArc.site, newArc.site);
      return;
    }

    // else lArc !== rArc
    detachCircle(lArc);
    detachCircle(rArc);

    var lSite = lArc.site,
        ax = lSite[0],
        ay = lSite[1],
        bx = site[0] - ax,
        by = site[1] - ay,
        rSite = rArc.site,
        cx = rSite[0] - ax,
        cy = rSite[1] - ay,
        d = 2 * (bx * cy - by * cx),
        hb = bx * bx + by * by,
        hc = cx * cx + cy * cy,
        vertex = [(cy * hb - by * hc) / d + ax, (bx * hc - cx * hb) / d + ay];

    setEdgeEnd(rArc.edge, lSite, rSite, vertex);
    newArc.edge = createEdge(lSite, site, null, vertex);
    rArc.edge = createEdge(site, rSite, null, vertex);
    attachCircle(lArc);
    attachCircle(rArc);
  }

  function leftBreakPoint(arc, directrix) {
    var site = arc.site,
        rfocx = site[0],
        rfocy = site[1],
        pby2 = rfocy - directrix;

    if (!pby2) return rfocx;

    var lArc = arc.P;
    if (!lArc) return -Infinity;

    site = lArc.site;
    var lfocx = site[0],
        lfocy = site[1],
        plby2 = lfocy - directrix;

    if (!plby2) return lfocx;

    var hl = lfocx - rfocx,
        aby2 = 1 / pby2 - 1 / plby2,
        b = hl / plby2;

    if (aby2) return (-b + Math.sqrt(b * b - 2 * aby2 * (hl * hl / (-2 * plby2) - lfocy + plby2 / 2 + rfocy - pby2 / 2))) / aby2 + rfocx;

    return (rfocx + lfocx) / 2;
  }

  function rightBreakPoint(arc, directrix) {
    var rArc = arc.N;
    if (rArc) return leftBreakPoint(rArc, directrix);
    var site = arc.site;
    return site[1] === directrix ? site[0] : Infinity;
  }

  var epsilon = 1e-6;
  var epsilon2 = 1e-12;
  var beaches;
  var cells;
  var circles;
  var edges;

  function triangleArea(a, b, c) {
    return (a[0] - c[0]) * (b[1] - a[1]) - (a[0] - b[0]) * (c[1] - a[1]);
  }

  function lexicographic(a, b) {
    return b[1] - a[1]
        || b[0] - a[0];
  }

  function Diagram(sites, extent) {
    var site = sites.sort(lexicographic).pop(),
        x,
        y,
        circle;

    edges = [];
    cells = new Array(sites.length);
    beaches = new RedBlackTree;
    circles = new RedBlackTree;

    while (true) {
      circle = firstCircle;
      if (site && (!circle || site[1] < circle.y || (site[1] === circle.y && site[0] < circle.x))) {
        if (site[0] !== x || site[1] !== y) {
          addBeach(site);
          x = site[0], y = site[1];
        }
        site = sites.pop();
      } else if (circle) {
        removeBeach(circle.arc);
      } else {
        break;
      }
    }

    sortCellHalfedges();

    if (extent) {
      var x0 = +extent[0][0],
          y0 = +extent[0][1],
          x1 = +extent[1][0],
          y1 = +extent[1][1];
      clipEdges(x0, y0, x1, y1);
      clipCells(x0, y0, x1, y1);
    }

    this.edges = edges;
    this.cells = cells;

    beaches =
    circles =
    edges =
    cells = null;
  }

  Diagram.prototype = {
    constructor: Diagram,

    polygons: function() {
      var edges = this.edges;

      return this.cells.map(function(cell) {
        var polygon = cell.halfedges.map(function(i) { return cellHalfedgeStart(cell, edges[i]); });
        polygon.data = cell.site.data;
        return polygon;
      });
    },

    triangles: function() {
      var triangles = [],
          edges = this.edges;

      this.cells.forEach(function(cell, i) {
        if (!(m = (halfedges = cell.halfedges).length)) return;
        var site = cell.site,
            halfedges,
            j = -1,
            m,
            s0,
            e1 = edges[halfedges[m - 1]],
            s1 = e1.left === site ? e1.right : e1.left;

        while (++j < m) {
          s0 = s1;
          e1 = edges[halfedges[j]];
          s1 = e1.left === site ? e1.right : e1.left;
          if (s0 && s1 && i < s0.index && i < s1.index && triangleArea(site, s0, s1) < 0) {
            triangles.push([site.data, s0.data, s1.data]);
          }
        }
      });

      return triangles;
    },

    links: function() {
      return this.edges.filter(function(edge) {
        return edge.right;
      }).map(function(edge) {
        return {
          source: edge.left.data,
          target: edge.right.data
        };
      });
    },

    find: function(x, y, radius) {
      var that = this, i0, i1 = that._found || 0, n = that.cells.length, cell;

      // Use the previously-found cell, or start with an arbitrary one.
      while (!(cell = that.cells[i1])) if (++i1 >= n) return null;
      var dx = x - cell.site[0], dy = y - cell.site[1], d2 = dx * dx + dy * dy;

      // Traverse the half-edges to find a closer cell, if any.
      do {
        cell = that.cells[i0 = i1], i1 = null;
        cell.halfedges.forEach(function(e) {
          var edge = that.edges[e], v = edge.left;
          if ((v === cell.site || !v) && !(v = edge.right)) return;
          var vx = x - v[0], vy = y - v[1], v2 = vx * vx + vy * vy;
          if (v2 < d2) d2 = v2, i1 = v.index;
        });
      } while (i1 !== null);

      that._found = i0;

      return radius == null || d2 <= radius * radius ? cell.site : null;
    }
  };

  function constant(x) {
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

  var identity = new Transform(1, 0, 0);

  transform.prototype = Transform.prototype;

  function transform(node) {
    while (!node.__zoom) if (!(node = node.parentNode)) return identity;
    return node.__zoom;
  }

  function nopropagation() {
    event.stopImmediatePropagation();
  }

  function noevent() {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  // Ignore right-click, since that should open the context menu.
  function defaultFilter() {
    return !event.ctrlKey && !event.button;
  }

  function defaultExtent() {
    var e = this;
    if (e instanceof SVGElement) {
      e = e.ownerSVGElement || e;
      if (e.hasAttribute("viewBox")) {
        e = e.viewBox.baseVal;
        return [[e.x, e.y], [e.x + e.width, e.y + e.height]];
      }
      return [[0, 0], [e.width.baseVal.value, e.height.baseVal.value]];
    }
    return [[0, 0], [e.clientWidth, e.clientHeight]];
  }

  function defaultTransform() {
    return this.__zoom || identity;
  }

  function defaultWheelDelta() {
    return -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002);
  }

  function defaultTouchable() {
    return navigator.maxTouchPoints || ("ontouchstart" in this);
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
    var filter = defaultFilter,
        extent = defaultExtent,
        constrain = defaultConstrain,
        wheelDelta = defaultWheelDelta,
        touchable = defaultTouchable,
        scaleExtent = [0, Infinity],
        translateExtent = [[-Infinity, -Infinity], [Infinity, Infinity]],
        duration = 250,
        interpolate = interpolateZoom,
        listeners = dispatch("start", "zoom", "end"),
        touchstarting,
        touchending,
        touchDelay = 500,
        wheelDelay = 150,
        clickDistance2 = 0;

    function zoom(selection) {
      selection
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

    zoom.transform = function(collection, transform, point) {
      var selection = collection.selection ? collection.selection() : collection;
      selection.property("__zoom", defaultTransform);
      if (collection !== selection) {
        schedule(collection, transform, point);
      } else {
        selection.interrupt().each(function() {
          gesture(this, arguments)
              .start()
              .zoom(null, typeof transform === "function" ? transform.apply(this, arguments) : transform)
              .end();
        });
      }
    };

    zoom.scaleBy = function(selection, k, p) {
      zoom.scaleTo(selection, function() {
        var k0 = this.__zoom.k,
            k1 = typeof k === "function" ? k.apply(this, arguments) : k;
        return k0 * k1;
      }, p);
    };

    zoom.scaleTo = function(selection, k, p) {
      zoom.transform(selection, function() {
        var e = extent.apply(this, arguments),
            t0 = this.__zoom,
            p0 = p == null ? centroid(e) : typeof p === "function" ? p.apply(this, arguments) : p,
            p1 = t0.invert(p0),
            k1 = typeof k === "function" ? k.apply(this, arguments) : k;
        return constrain(translate(scale(t0, k1), p0, p1), e, translateExtent);
      }, p);
    };

    zoom.translateBy = function(selection, x, y) {
      zoom.transform(selection, function() {
        return constrain(this.__zoom.translate(
          typeof x === "function" ? x.apply(this, arguments) : x,
          typeof y === "function" ? y.apply(this, arguments) : y
        ), extent.apply(this, arguments), translateExtent);
      });
    };

    zoom.translateTo = function(selection, x, y, p) {
      zoom.transform(selection, function() {
        var e = extent.apply(this, arguments),
            t = this.__zoom,
            p0 = p == null ? centroid(e) : typeof p === "function" ? p.apply(this, arguments) : p;
        return constrain(identity.translate(p0[0], p0[1]).scale(t.k).translate(
          typeof x === "function" ? -x.apply(this, arguments) : -x,
          typeof y === "function" ? -y.apply(this, arguments) : -y
        ), e, translateExtent);
      }, p);
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

    function schedule(transition, transform, point) {
      transition
          .on("start.zoom", function() { gesture(this, arguments).start(); })
          .on("interrupt.zoom end.zoom", function() { gesture(this, arguments).end(); })
          .tween("zoom", function() {
            var that = this,
                args = arguments,
                g = gesture(that, args),
                e = extent.apply(that, args),
                p = point == null ? centroid(e) : typeof point === "function" ? point.apply(that, args) : point,
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

    function gesture(that, args, clean) {
      return (!clean && that.__zooming) || new Gesture(that, args);
    }

    function Gesture(that, args) {
      this.that = that;
      this.args = args;
      this.active = 0;
      this.extent = extent.apply(that, args);
      this.taps = 0;
    }

    Gesture.prototype = {
      start: function() {
        if (++this.active === 1) {
          this.that.__zooming = this;
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
          delete this.that.__zooming;
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

      noevent();
      g.wheel = setTimeout(wheelidled, wheelDelay);
      g.zoom("mouse", constrain(translate(scale(t, k), g.mouse[0], g.mouse[1]), g.extent, translateExtent));

      function wheelidled() {
        g.wheel = null;
        g.end();
      }
    }

    function mousedowned() {
      if (touchending || !filter.apply(this, arguments)) return;
      var g = gesture(this, arguments, true),
          v = select(event.view).on("mousemove.zoom", mousemoved, true).on("mouseup.zoom", mouseupped, true),
          p = mouse(this),
          x0 = event.clientX,
          y0 = event.clientY;

      dragDisable(event.view);
      nopropagation();
      g.mouse = [p, this.__zoom.invert(p)];
      interrupt(this);
      g.start();

      function mousemoved() {
        noevent();
        if (!g.moved) {
          var dx = event.clientX - x0, dy = event.clientY - y0;
          g.moved = dx * dx + dy * dy > clickDistance2;
        }
        g.zoom("mouse", constrain(translate(g.that.__zoom, g.mouse[0] = mouse(g.that), g.mouse[1]), g.extent, translateExtent));
      }

      function mouseupped() {
        v.on("mousemove.zoom mouseup.zoom", null);
        yesdrag(event.view, g.moved);
        noevent();
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

      noevent();
      if (duration > 0) select(this).transition().duration(duration).call(schedule, t1, p0);
      else select(this).call(zoom.transform, t1);
    }

    function touchstarted() {
      if (!filter.apply(this, arguments)) return;
      var touches = event.touches,
          n = touches.length,
          g = gesture(this, arguments, event.changedTouches.length === n),
          started, i, t, p;

      nopropagation();
      for (i = 0; i < n; ++i) {
        t = touches[i], p = touch(this, touches, t.identifier);
        p = [p, this.__zoom.invert(p), t.identifier];
        if (!g.touch0) g.touch0 = p, started = true, g.taps = 1 + !!touchstarting;
        else if (!g.touch1 && g.touch0[2] !== p[2]) g.touch1 = p, g.taps = 0;
      }

      if (touchstarting) touchstarting = clearTimeout(touchstarting);

      if (started) {
        if (g.taps < 2) touchstarting = setTimeout(function() { touchstarting = null; }, touchDelay);
        interrupt(this);
        g.start();
      }
    }

    function touchmoved() {
      if (!this.__zooming) return;
      var g = gesture(this, arguments),
          touches = event.changedTouches,
          n = touches.length, i, t, p, l;

      noevent();
      if (touchstarting) touchstarting = clearTimeout(touchstarting);
      g.taps = 0;
      for (i = 0; i < n; ++i) {
        t = touches[i], p = touch(this, touches, t.identifier);
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
      if (!this.__zooming) return;
      var g = gesture(this, arguments),
          touches = event.changedTouches,
          n = touches.length, i, t;

      nopropagation();
      if (touchending) clearTimeout(touchending);
      touchending = setTimeout(function() { touchending = null; }, touchDelay);
      for (i = 0; i < n; ++i) {
        t = touches[i];
        if (g.touch0 && g.touch0[2] === t.identifier) delete g.touch0;
        else if (g.touch1 && g.touch1[2] === t.identifier) delete g.touch1;
      }
      if (g.touch1 && !g.touch0) g.touch0 = g.touch1, delete g.touch1;
      if (g.touch0) g.touch0[1] = this.__zoom.invert(g.touch0[0]);
      else {
        g.end();
        // If this was a dbltap, reroute to the (optional) dblclick.zoom handler.
        if (g.taps === 2) {
          var p = select(this).on("dblclick.zoom");
          if (p) p.apply(this, arguments);
        }
      }
    }

    zoom.wheelDelta = function(_) {
      return arguments.length ? (wheelDelta = typeof _ === "function" ? _ : constant(+_), zoom) : wheelDelta;
    };

    zoom.filter = function(_) {
      return arguments.length ? (filter = typeof _ === "function" ? _ : constant(!!_), zoom) : filter;
    };

    zoom.touchable = function(_) {
      return arguments.length ? (touchable = typeof _ === "function" ? _ : constant(!!_), zoom) : touchable;
    };

    zoom.extent = function(_) {
      return arguments.length ? (extent = typeof _ === "function" ? _ : constant([[+_[0][0], +_[0][1]], [+_[1][0], +_[1][1]]]), zoom) : extent;
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

  // Copyright 2022 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  class MovableContainer {
      constructor(graphPhase) {
          this.graphPhase = graphPhase;
          this.minGraphX = 0;
          this.maxGraphX = 1;
          this.minGraphY = 0;
          this.maxGraphY = 1;
          this.width = 1;
          this.height = 1;
      }
      isRendered() {
          return this.graphPhase.rendered;
      }
  }

  // Copyright 2022 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  class Graph extends MovableContainer {
      constructor(graphPhase) {
          super(graphPhase);
          this.nodeMap = graphPhase.nodeIdToNodeMap;
          this.originNodesMap = graphPhase.originIdToNodesMap;
      }
      *nodes(func = (n) => true) {
          for (const node of this.nodeMap) {
              if (!node || !func(node))
                  continue;
              yield node;
          }
      }
      *filteredEdges(func) {
          for (const node of this.nodes()) {
              for (const edge of node.inputs) {
                  if (func(edge))
                      yield edge;
              }
          }
      }
      forEachEdge(func) {
          for (const node of this.nodeMap) {
              if (!node)
                  continue;
              for (const edge of node.inputs) {
                  func(edge);
              }
          }
      }
      redetermineGraphBoundingBox(showTypes) {
          this.minGraphX = 0;
          this.maxGraphNodeX = 1;
          this.minGraphY = 0;
          this.maxGraphY = 1;
          for (const node of this.nodes()) {
              if (!node.visible)
                  continue;
              this.minGraphX = Math.min(this.minGraphX, node.x);
              this.maxGraphNodeX = Math.max(this.maxGraphNodeX, node.x + node.getWidth());
              this.minGraphY = Math.min(this.minGraphY, node.y - NODE_INPUT_WIDTH);
              this.maxGraphY = Math.max(this.maxGraphY, node.y + node.getHeight(showTypes)
                  + NODE_INPUT_WIDTH);
          }
          this.maxGraphX = this.maxGraphNodeX + this.maxBackEdgeNumber
              * MINIMUM_EDGE_SEPARATION;
          this.width = this.maxGraphX - this.minGraphX;
          this.height = this.maxGraphY - this.minGraphY;
          return [
              [this.minGraphX - this.width / 2, this.minGraphY - this.height / 2],
              [this.maxGraphX + this.width / 2, this.maxGraphY + this.height / 2]
          ];
      }
      makeNodeVisible(identifier) {
          if (this.nodeMap[identifier])
              this.nodeMap[identifier].visible = true;
      }
      makeEdgesVisible() {
          if (this.graphPhase.stateType == GraphStateType.NeedToFullRebuild) {
              this.forEachEdge(edge => edge.visible = edge.source.visible && edge.target.visible);
          }
          else {
              this.forEachEdge(edge => edge.visible = edge.visible || (this.isRendered() &&
                  edge.type === "control" && edge.source.visible && edge.target.visible));
          }
      }
  }

  // Copyright 2022 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  class LayoutOccupation {
      constructor(graph) {
          this.graph = graph;
          this.filledSlots = new Array();
          this.occupations = new Array();
          this.minSlot = 0;
          this.maxSlot = 0;
      }
      clearOutputs(source, extendHeight) {
          for (const edge of source.outputs) {
              if (!edge.isVisible())
                  continue;
              for (const inputEdge of edge.target.inputs) {
                  if (inputEdge.source === source) {
                      const horizontalPos = edge.getInputHorizontalPosition(this.graph, extendHeight);
                      this.clearPositionRangeWithMargin(horizontalPos, horizontalPos, NODE_INPUT_WIDTH / 2);
                  }
              }
          }
      }
      clearOccupied() {
          for (const [firstSlot, endSlotExclusive] of this.occupations) {
              this.clearSlotRange(firstSlot, endSlotExclusive);
          }
          this.occupations = new Array();
      }
      occupy(item) {
          const width = item.getWidth();
          const margin = MINIMUM_EDGE_SEPARATION;
          const paddedWidth = width + 2 * margin;
          const [direction, position] = this.getPlacementHint(item);
          const x = position - paddedWidth + margin;
          this.trace(`${item.id} placement hint [${x}, ${(x + paddedWidth)})`);
          const placement = this.findSpace(x, paddedWidth, direction);
          const [firstSlot, slotWidth] = placement;
          const endSlotExclusive = firstSlot + slotWidth - 1;
          this.occupySlotRange(firstSlot, endSlotExclusive);
          this.occupations.push([firstSlot, endSlotExclusive]);
          if (direction < 0) {
              return this.slotToLeftPosition(firstSlot + slotWidth) - width - margin;
          }
          else if (direction > 0) {
              return this.slotToLeftPosition(firstSlot) + margin;
          }
          else {
              return this.slotToLeftPosition(firstSlot + slotWidth / 2) - (width / 2);
          }
      }
      occupyInputs(item, extendHeight) {
          for (let i = 0; i < item.inputs.length; ++i) {
              if (item.inputs[i].isVisible()) {
                  const edge = item.inputs[i];
                  if (!edge.isBackEdge()) {
                      const horizontalPos = edge.getInputHorizontalPosition(this.graph, extendHeight);
                      this.trace(`Occupying input ${i} of ${item.id} at ${horizontalPos}`);
                      this.occupyPositionRangeWithMargin(horizontalPos, horizontalPos, NODE_INPUT_WIDTH / 2);
                  }
              }
          }
      }
      print() {
          let output = "";
          for (let currentSlot = -40; currentSlot < 40; ++currentSlot) {
              if (currentSlot != 0) {
                  output += " ";
              }
              else {
                  output += "|";
              }
          }
          console.log(output);
          output = "";
          for (let currentSlot2 = -40; currentSlot2 < 40; ++currentSlot2) {
              if (this.filledSlots[this.slotToIndex(currentSlot2)]) {
                  output += "*";
              }
              else {
                  output += " ";
              }
          }
          console.log(output);
      }
      getPlacementHint(item) {
          let position = 0;
          let direction = -1;
          let outputEdges = 0;
          let inputEdges = 0;
          for (const outputEdge of item.outputs) {
              if (!outputEdge.isVisible())
                  continue;
              const output = outputEdge.target;
              for (let l = 0; l < output.inputs.length; ++l) {
                  if (output.rank > item.rank) {
                      const inputEdge = output.inputs[l];
                      if (inputEdge.isVisible())
                          ++inputEdges;
                      if (output.inputs[l].source == item) {
                          position += output.x + output.getInputX(l) + NODE_INPUT_WIDTH / 2;
                          outputEdges++;
                          if (l >= (output.inputs.length / 2)) {
                              direction = 1;
                          }
                      }
                  }
              }
          }
          if (outputEdges != 0) {
              position /= outputEdges;
          }
          if (outputEdges > 1 || inputEdges == 1) {
              direction = 0;
          }
          return [direction, position];
      }
      occupyPositionRange(from, to) {
          this.occupySlotRange(this.positionToSlot(from), this.positionToSlot(to - 1));
      }
      clearPositionRange(from, to) {
          this.clearSlotRange(this.positionToSlot(from), this.positionToSlot(to - 1));
      }
      occupySlotRange(from, to) {
          this.trace(`Occupied [${this.slotToLeftPosition(from)} ${this.slotToLeftPosition(to + 1)})`);
          this.setIndexRange(from, to, true);
      }
      clearSlotRange(from, to) {
          this.trace(`Cleared [${this.slotToLeftPosition(from)} ${this.slotToLeftPosition(to + 1)})`);
          this.setIndexRange(from, to, false);
      }
      clearPositionRangeWithMargin(from, to, margin) {
          const fromMargin = from - Math.floor(margin);
          const toMargin = to + Math.floor(margin);
          this.clearPositionRange(fromMargin, toMargin);
      }
      occupyPositionRangeWithMargin(from, to, margin) {
          const fromMargin = from - Math.floor(margin);
          const toMargin = to + Math.floor(margin);
          this.occupyPositionRange(fromMargin, toMargin);
      }
      findSpace(pos, width, direction) {
          const widthSlots = Math.floor((width + NODE_INPUT_WIDTH - 1) /
              NODE_INPUT_WIDTH);
          const currentSlot = this.positionToSlot(pos + width / 2);
          let widthSlotsRemainingLeft = widthSlots;
          let widthSlotsRemainingRight = widthSlots;
          let slotsChecked = 0;
          while (true) {
              const mod = slotsChecked++ % 2;
              const currentScanSlot = currentSlot + (mod ? -1 : 1) * (slotsChecked >> 1);
              if (!this.filledSlots[this.slotToIndex(currentScanSlot)]) {
                  if (mod) {
                      if (direction <= 0)
                          --widthSlotsRemainingLeft;
                  }
                  else if (direction >= 0) {
                      --widthSlotsRemainingRight;
                  }
                  if (widthSlotsRemainingLeft == 0 || widthSlotsRemainingRight == 0 ||
                      (widthSlotsRemainingLeft + widthSlotsRemainingRight) == widthSlots &&
                          (widthSlots == slotsChecked)) {
                      return mod ? [currentScanSlot, widthSlots]
                          : [currentScanSlot - widthSlots + 1, widthSlots];
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
      setIndexRange(from, to, value) {
          if (to < from)
              throw ("Illegal slot range");
          while (from <= to) {
              this.maxSlot = Math.max(from, this.maxSlot);
              this.minSlot = Math.min(from, this.minSlot);
              this.filledSlots[this.slotToIndex(from++)] = value;
          }
      }
      positionToSlot(position) {
          return Math.floor(position / NODE_INPUT_WIDTH);
      }
      slotToIndex(slot) {
          return slot >= 0 ? slot * 2 : slot * 2 + 1;
      }
      slotToLeftPosition(slot) {
          return slot * NODE_INPUT_WIDTH;
      }
      trace(message) {
      }
  }

  // Copyright 2015 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  class GraphLayout {
      constructor(graph) {
          this.graph = graph;
          this.layoutOccupation = new LayoutOccupation(graph);
          this.maxRank = 0;
          this.visitOrderWithinRank = 0;
      }
      rebuild(showTypes) {
          switch (this.graph.graphPhase.stateType) {
              case GraphStateType.NeedToFullRebuild:
                  this.fullRebuild(showTypes);
                  break;
              case GraphStateType.Cached:
                  this.cachedRebuild();
                  break;
              default:
                  throw "Unsupported graph state type";
          }
          this.graph.graphPhase.rendered = true;
      }
      fullRebuild(showTypes) {
          this.startTime = performance.now();
          this.maxRank = 0;
          this.visitOrderWithinRank = 0;
          const [startNodes, endNodes] = this.initNodes();
          this.initWorkList(startNodes);
          let visited = new Array();
          startNodes.forEach((sn) => this.dfsFindRankLate(visited, sn));
          visited = new Array();
          startNodes.forEach((sn) => this.dfsRankOrder(visited, sn));
          endNodes.forEach((node) => node.rank = this.maxRank + 1);
          const rankSets = this.getRankSets(showTypes);
          this.placeNodes(rankSets, showTypes);
          this.calculateBackEdgeNumbers();
          this.graph.graphPhase.stateType = GraphStateType.Cached;
      }
      cachedRebuild() {
          this.calculateBackEdgeNumbers();
      }
      initNodes() {
          // First determine the set of nodes that have no outputs. Those are the
          // basis for bottom-up DFS to determine rank and node placement.
          const endNodesHasNoOutputs = new Array();
          const startNodesHasNoInputs = new Array();
          for (const node of this.graph.nodes()) {
              endNodesHasNoOutputs[node.id] = true;
              startNodesHasNoInputs[node.id] = true;
          }
          this.graph.forEachEdge((edge) => {
              endNodesHasNoOutputs[edge.source.id] = false;
              startNodesHasNoInputs[edge.target.id] = false;
          });
          // Finialize the list of start and end nodes.
          const endNodes = new Array();
          const startNodes = new Array();
          const visited = new Array();
          for (const node of this.graph.nodes()) {
              if (endNodesHasNoOutputs[node.id]) {
                  endNodes.push(node);
              }
              if (startNodesHasNoInputs[node.id]) {
                  startNodes.push(node);
              }
              visited[node.id] = false;
              node.rank = 0;
              node.visitOrderWithinRank = 0;
              node.outputApproach = MINIMUM_NODE_OUTPUT_APPROACH;
          }
          this.trace("layoutGraph init");
          return [startNodes, endNodes];
      }
      initWorkList(startNodes) {
          const workList = startNodes.slice();
          while (workList.length != 0) {
              const node = workList.pop();
              let changed = false;
              if (node.rank == MAX_RANK_SENTINEL) {
                  node.rank = 1;
                  changed = true;
              }
              let begin = 0;
              let end = node.inputs.length;
              if (node.nodeLabel.opcode === "Phi" ||
                  node.nodeLabel.opcode === "EffectPhi" ||
                  node.nodeLabel.opcode === "InductionVariablePhi") {
                  // Keep with merge or loop node
                  begin = node.inputs.length - 1;
              }
              else if (node.hasBackEdges()) {
                  end = 1;
              }
              for (let l = begin; l < end; ++l) {
                  const input = node.inputs[l].source;
                  if (input.visible && input.rank >= node.rank) {
                      node.rank = input.rank + 1;
                      changed = true;
                  }
              }
              if (changed) {
                  const hasBackEdges = node.hasBackEdges();
                  for (let l = node.outputs.length - 1; l >= 0; --l) {
                      if (hasBackEdges && (l != 0)) {
                          workList.unshift(node.outputs[l].target);
                      }
                      else {
                          workList.push(node.outputs[l].target);
                      }
                  }
              }
              this.maxRank = Math.max(node.rank, this.maxRank);
          }
          this.trace("layoutGraph work list");
      }
      dfsFindRankLate(visited, node) {
          if (visited[node.id])
              return;
          visited[node.id] = true;
          const originalRank = node.rank;
          let newRank = node.rank;
          let isFirstInput = true;
          for (const outputEdge of node.outputs) {
              const output = outputEdge.target;
              this.dfsFindRankLate(visited, output);
              const outputRank = output.rank;
              if (output.visible && (isFirstInput || outputRank <= newRank) &&
                  (outputRank > originalRank)) {
                  newRank = outputRank - 1;
              }
              isFirstInput = false;
          }
          if (node.nodeLabel.opcode !== "Start" && node.nodeLabel.opcode !== "Phi"
              && node.nodeLabel.opcode !== "EffectPhi"
              && node.nodeLabel.opcode !== "InductionVariablePhi") {
              node.rank = newRank;
          }
      }
      dfsRankOrder(visited, node) {
          if (visited[node.id])
              return;
          visited[node.id] = true;
          for (const outputEdge of node.outputs) {
              if (outputEdge.isVisible()) {
                  const output = outputEdge.target;
                  this.dfsRankOrder(visited, output);
              }
          }
          if (node.visitOrderWithinRank == 0) {
              node.visitOrderWithinRank = ++this.visitOrderWithinRank;
          }
      }
      getRankSets(showTypes) {
          const rankSets = new Array();
          for (const node of this.graph.nodes()) {
              node.y = node.rank * (DEFAULT_NODE_ROW_SEPARATION +
                  node.getHeight(showTypes) + 2 * DEFAULT_NODE_BUBBLE_RADIUS);
              if (node.visible) {
                  if (!rankSets[node.rank]) {
                      rankSets[node.rank] = new Array(node);
                  }
                  else {
                      rankSets[node.rank].push(node);
                  }
              }
          }
          return rankSets;
      }
      placeNodes(rankSets, showTypes) {
          // Iterate backwards from highest to lowest rank, placing nodes so that they
          // spread out from the "center" as much as possible while still being
          // compact and not overlapping live input lines.
          rankSets.reverse().forEach((rankSet) => {
              for (const node of rankSet) {
                  this.layoutOccupation.clearOutputs(node, showTypes);
              }
              this.traceOccupation("After clearing outputs");
              let placedCount = 0;
              rankSet = rankSet.sort((a, b) => a.compare(b));
              for (const node of rankSet) {
                  if (node.visible) {
                      node.x = this.layoutOccupation.occupy(node);
                      this.trace(`Node ${node.id} is placed between [${node.x}, ${node.x + node.getWidth()})`);
                      const staggeredFlooredI = Math.floor(placedCount++ % 3);
                      const delta = MINIMUM_EDGE_SEPARATION * staggeredFlooredI;
                      node.outputApproach += delta;
                  }
                  else {
                      node.x = 0;
                  }
              }
              this.traceOccupation("Before clearing nodes");
              this.layoutOccupation.clearOccupied();
              this.traceOccupation("After clearing nodes");
              for (const node of rankSet) {
                  this.layoutOccupation.occupyInputs(node, showTypes);
              }
              this.traceOccupation("After occupying inputs and determining bounding box");
          });
      }
      calculateBackEdgeNumbers() {
          this.graph.maxBackEdgeNumber = 0;
          this.graph.forEachEdge((edge) => {
              if (edge.isBackEdge()) {
                  edge.backEdgeNumber = ++this.graph.maxBackEdgeNumber;
              }
              else {
                  edge.backEdgeNumber = 0;
              }
          });
      }
      trace(message) {
      }
      traceOccupation(message) {
      }
  }

  // Copyright 2022 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  class MovableView extends PhaseView {
      constructor(idOrContainer, broker, showPhaseByName, toolbox) {
          super(idOrContainer);
          this.broker = broker;
          this.showPhaseByName = showPhaseByName;
          this.toolbox = toolbox;
          this.state = new MovableViewState();
          this.divElement = select(this.divNode);
          // Listen for key events. Note that the focus handler seems
          // to be important even if it does nothing.
          this.svg = this.divElement.append("svg")
              .attr("version", "2.0")
              .attr("width", "100%")
              .attr("height", "100%")
              .on("focus", () => { })
              .on("keydown", () => this.svgKeyDown());
          this.svg.append("svg:defs")
              .append("svg:marker")
              .attr("id", "end-arrow")
              .attr("viewBox", "0 -4 8 8")
              .attr("refX", 2)
              .attr("markerWidth", 2.5)
              .attr("markerHeight", 2.5)
              .attr("orient", "auto")
              .append("svg:path")
              .attr("d", "M0,-4L8,0L0,4");
          this.graphElement = this.svg.append("g");
          this.panZoom = zoom()
              .scaleExtent([0.2, 40])
              .on("zoom", () => {
              if (event.shiftKey)
                  return false;
              this.graphElement.attr("transform", event.transform);
              return true;
          })
              .on("start", () => {
              if (event.shiftKey)
                  return;
              select("body").style("cursor", "move");
          })
              .on("end", () => select("body").style("cursor", "auto"));
          this.svg.call(this.panZoom).on("dblclick.zoom", null);
      }
      createViewElement() {
          const pane = document.createElement("div");
          pane.setAttribute("id", GRAPH_PANE_ID);
          return pane;
      }
      onresize() {
          const trans = transform(this.svg.node());
          const ctrans = this.panZoom.constrain()(trans, this.getSvgExtent(), this.panZoom.translateExtent());
          this.panZoom.transform(this.svg, ctrans);
      }
      hide() {
          if (this.state.cacheLayout) {
              this.graph.graphPhase.transform = this.getTransformMatrix();
          }
          else {
              this.graph.graphPhase.transform = null;
          }
          this.broker.deleteNodeHandler(this.nodeSelectionHandler);
          super.hide();
          this.deleteContent();
      }
      getTransformMatrix() {
          const matrix = this.graphElement.node().transform.baseVal.consolidate().matrix;
          return { scale: matrix.a, x: matrix.e, y: matrix.f };
      }
      viewTransformMatrix(matrix) {
          this.svg.call(this.panZoom.transform, identity
              .translate(matrix.x, matrix.y)
              .scale(matrix.scale));
      }
      focusOnSvg() {
          const svg = document.getElementById(GRAPH_PANE_ID).childNodes[0];
          svg.focus();
      }
      updateGraphStateType(stateType) {
          this.graph.graphPhase.stateType = stateType;
      }
      viewGraphRegion(minX, minY, maxX, maxY) {
          const [width, height] = this.getSvgViewDimensions();
          const dx = maxX - minX;
          const dy = maxY - minY;
          const x = (minX + maxX) / 2;
          const y = (minY + maxY) / 2;
          const scale = Math.min(width / dx, height / dy) * 0.9;
          this.svg
              .transition().duration(120).call(this.panZoom.scaleTo, scale)
              .transition().duration(120).call(this.panZoom.translateTo, x, y);
      }
      addImgInput(id, title, onClick) {
          const input = this.createImgInput(id, title, onClick);
          this.toolbox.appendChild(input);
      }
      addToggleImgInput(id, title, initState, onClick) {
          const input = this.createImgToggleInput(id, title, initState, onClick);
          this.toolbox.appendChild(input);
      }
      minScale() {
          const [clientWith, clientHeight] = this.getSvgViewDimensions();
          const minXScale = clientWith / (2 * this.graph.width);
          const minYScale = clientHeight / (2 * this.graph.height);
          const minScale = Math.min(minXScale, minYScale);
          this.panZoom.scaleExtent([minScale, 40]);
          return minScale;
      }
      getNodeFrontier(nodes, inEdges, edgeFilter) {
          const frontier = new Set();
          let newState = true;
          const edgeFrontier = this.getEdgeFrontier(nodes, inEdges, edgeFilter);
          // Control key toggles edges rather than just turning them on
          if (event.ctrlKey) {
              for (const edge of edgeFrontier) {
                  if (edge.visible)
                      newState = false;
              }
          }
          for (const edge of edgeFrontier) {
              edge.visible = newState;
              if (newState) {
                  const node = inEdges ? edge.source : edge.target;
                  node.visible = true;
                  frontier.add(node);
              }
          }
          this.updateGraphVisibility();
          return newState ? frontier : undefined;
      }
      showSelectionFrontierNodes(inEdges, filter, select) {
          const frontier = this.getNodeFrontier(this.state.selection, inEdges, filter);
          if (frontier !== undefined && frontier.size) {
              if (select) {
                  if (!event.shiftKey)
                      this.state.selection.clear();
                  this.state.selection.select([...frontier], true);
              }
              this.updateGraphVisibility();
          }
      }
      getEdgeFrontier(nodes, inEdges, edgeFilter) {
          const frontier = new Set();
          for (const node of nodes) {
              let edgeNumber = 0;
              const edges = inEdges ? node.inputs : node.outputs;
              for (const edge of edges) {
                  if (edgeFilter === undefined || edgeFilter(edge, edgeNumber)) {
                      frontier.add(edge);
                  }
                  ++edgeNumber;
              }
          }
          return frontier;
      }
      connectVisibleSelectedElements(selection) {
          for (const element of selection) {
              element.inputs.forEach((edge) => {
                  if (edge.source.visible && edge.target.visible) {
                      edge.visible = true;
                  }
              });
              element.outputs.forEach((edge) => {
                  if (edge.source.visible && edge.target.visible) {
                      edge.visible = true;
                  }
              });
          }
      }
      showVisible() {
          this.updateGraphVisibility();
          this.viewWholeGraph();
          this.focusOnSvg();
      }
      viewWholeGraph() {
          this.panZoom.scaleTo(this.svg, 0);
          this.panZoom.translateTo(this.svg, this.graph.minGraphX + this.graph.width / 2, this.graph.minGraphY + this.graph.height / 2);
      }
      searchNodes(filterFunction, e, onlyVisible) {
          return [...this.graph.nodes(node => {
                  if ((e.ctrlKey || node.visible || !onlyVisible) && filterFunction(node)) {
                      if (e.ctrlKey || !onlyVisible)
                          node.visible = true;
                      return true;
                  }
                  return false;
              })];
      }
      showHoveredNodeHistory() {
          const node = this.graph.nodeMap[this.hoveredNodeIdentifier];
          if (!node)
              return;
          this.broker.broadcastHistoryShow(null, node, this.phaseName);
      }
      createImgToggleInput(id, title, initState, onClick) {
          const input = this.createImgInput(id, title, onClick);
          input.classList.toggle("button-input-toggled", initState);
          return input;
      }
      deleteContent() {
          for (const item of this.toolbox.querySelectorAll(".graph-toolbox-item")) {
              item.parentElement.removeChild(item);
          }
          if (!this.state.cacheLayout) {
              this.updateGraphStateType(GraphStateType.NeedToFullRebuild);
          }
          this.graph.graphPhase.rendered = false;
          this.updateGraphVisibility();
      }
      getSvgViewDimensions() {
          return [this.container.clientWidth, this.container.clientHeight];
      }
      getSvgExtent() {
          return [[0, 0], [this.container.clientWidth, this.container.clientHeight]];
      }
      createImgInput(id, title, onClick) {
          const input = document.createElement("input");
          input.setAttribute("id", id);
          input.setAttribute("type", "image");
          input.setAttribute("title", title);
          input.setAttribute("src", `img/toolbox/${id}-icon.png`);
          input.className = "button-input graph-toolbox-item";
          input.addEventListener("click", onClick);
          return input;
      }
  }
  class MovableViewState {
      get hideDead() {
          return storageGetItem("toggle-hide-dead", false);
      }
      set hideDead(value) {
          storageSetItem("toggle-hide-dead", value);
      }
      get showTypes() {
          return storageGetItem("toggle-types", false);
      }
      set showTypes(value) {
          storageSetItem("toggle-types", value);
      }
      get showCustomData() {
          return storageGetItem("toggle-custom-data", false);
      }
      set showCustomData(value) {
          storageSetItem("toggle-custom-data", value);
      }
      get cacheLayout() {
          return storageGetItem("toggle-cache-layout", true);
      }
      set cacheLayout(value) {
          storageSetItem("toggle-cache-layout", value);
      }
      get compactView() {
          return storageGetItem("compact-view", true);
      }
      set compactView(value) {
          storageSetItem("compact-view", value);
      }
  }

  // Copyright 2022 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  class SelectionStorage {
      constructor(nodes, blocks, instructions) {
          this.nodes = nodes ?? new Map();
          this.blocks = blocks ?? new Map();
          this.instructions = instructions ?? new Map();
          this.adaptedNodes = new Set();
          this.adaptedBocks = new Set();
          this.adaptedInstructions = new Set();
      }
      adaptNode(nodeKey) {
          this.adaptedNodes.add(nodeKey);
      }
      adaptBlock(blockKey) {
          this.adaptedBocks.add(blockKey);
      }
      adaptInstruction(instrId) {
          this.adaptedInstructions.add(instrId);
      }
      isAdapted() {
          return this.adaptedNodes.size != 0 || this.adaptedBocks.size != 0
              || this.adaptedInstructions.size != 0;
      }
  }

  // Copyright 2015 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  class GraphView extends MovableView {
      constructor(idOrContainer, broker, showPhaseByName, toolbox) {
          super(idOrContainer, broker, showPhaseByName, toolbox);
          this.state.selection = new SelectionMap(node => node.identifier(), node => {
              if (node instanceof GraphNode)
                  return node.nodeLabel?.origin?.identifier();
              return node?.origin?.identifier();
          });
          this.nodeSelectionHandler = this.initializeNodeSelectionHandler();
          this.svg.on("click", () => this.nodeSelectionHandler.clear());
          this.visibleEdges = this.graphElement.append("g");
          this.visibleNodes = this.graphElement.append("g");
          this.drag = drag()
              .on("drag", (node) => {
              node.x += event.dx;
              node.y += event.dy;
              this.updateGraphVisibility();
          });
      }
      initializeContent(data, rememberedSelection) {
          this.show();
          this.addImgInput("layout", "layout graph", partial(this.layoutAction, this));
          this.addImgInput("show-all", "show all nodes", partial(this.showAllAction, this));
          this.addImgInput("show-control", "show only control nodes", partial(this.showControlAction, this));
          this.addImgInput("hide-unselected", "hide unselected", partial(this.hideUnselectedAction, this));
          this.addImgInput("hide-selected", "hide selected", partial(this.hideSelectedAction, this));
          this.addImgInput("zoom-selection", "zoom selection", partial(this.zoomSelectionAction, this));
          this.addToggleImgInput("toggle-hide-dead", "toggle hide dead nodes", this.state.hideDead, partial(this.toggleHideDeadAction, this));
          this.addToggleImgInput("toggle-types", "toggle types", this.state.showTypes, partial(this.toggleTypesAction, this));
          this.addToggleImgInput("toggle-cache-layout", "toggle saving graph layout", this.state.cacheLayout, partial(this.toggleLayoutCachingAction, this));
          this.phaseName = data.name;
          const adaptedSelection = this.createGraph(data, rememberedSelection);
          this.broker.addNodeHandler(this.nodeSelectionHandler);
          const selectedNodes = adaptedSelection.isAdapted()
              ? this.attachSelection(adaptedSelection.adaptedNodes)
              : null;
          if (selectedNodes?.length > 0) {
              this.connectVisibleSelectedElements(this.state.selection);
              this.updateGraphVisibility();
              this.viewSelection();
          }
          else {
              if (this.state.cacheLayout && data.transform) {
                  this.viewTransformMatrix(data.transform);
              }
              else {
                  this.viewWholeGraph();
              }
          }
      }
      updateGraphVisibility() {
          const view = this;
          const graph = this.graph;
          const state = this.state;
          if (!graph)
              return;
          const filteredEdges = [
              ...graph.filteredEdges(edge => graph.isRendered()
                  && edge.source.visible && edge.target.visible)
          ];
          const selEdges = view.visibleEdges
              .selectAll("path")
              .data(filteredEdges, edge => edge.toString());
          // remove old links
          selEdges.exit().remove();
          // add new paths
          const newEdges = selEdges
              .enter()
              .append("path")
              .style("marker-end", "url(#end-arrow)")
              .attr("id", edge => `e,${edge.toString()}`)
              .on("click", edge => {
              event.stopPropagation();
              if (!event.shiftKey) {
                  view.nodeSelectionHandler.clear();
              }
              view.nodeSelectionHandler.select([edge.source, edge.target], true, false);
          })
              .attr("adjacentToHover", "false")
              .classed("value", edge => edge.type === "value" || edge.type === "context")
              .classed("control", edge => edge.type === "control")
              .classed("effect", edge => edge.type === "effect")
              .classed("frame-state", edge => edge.type === "frame-state")
              .attr("stroke-dasharray", edge => {
              if (edge.type === "frame-state")
                  return "10,10";
              return edge.type === "effect" ? "5,5" : "";
          });
          const newAndOldEdges = newEdges.merge(selEdges);
          newAndOldEdges.classed("hidden", edge => !edge.isVisible());
          // select existing nodes
          const filteredNodes = [...graph.nodes(node => graph.isRendered() && node.visible)];
          const allNodes = view.visibleNodes.selectAll("g");
          const selNodes = allNodes.data(filteredNodes, node => node.toString());
          // remove old nodes
          selNodes.exit().remove();
          // add new nodes
          const newGs = selNodes.enter()
              .append("g")
              .classed("turbonode", true)
              .classed("control", node => node.isControl())
              .classed("live", node => node.isLive())
              .classed("dead", node => !node.isLive())
              .classed("javascript", node => node.isJavaScript())
              .classed("input", node => node.isInput())
              .classed("simplified", node => node.isSimplified())
              .classed("machine", node => node.isMachine())
              .on("mouseenter", node => {
              const visibleEdges = view.visibleEdges.selectAll("path");
              const adjInputEdges = visibleEdges.filter(edge => edge.target === node);
              const adjOutputEdges = visibleEdges.filter(edge => edge.source === node);
              adjInputEdges.attr("relToHover", "input");
              adjOutputEdges.attr("relToHover", "output");
              const visibleNodes = view.visibleNodes.selectAll("g");
              const adjInputNodes = adjInputEdges.data().map(edge => edge.source);
              visibleNodes.data(adjInputNodes, node => node.toString())
                  .attr("relToHover", "input");
              const adjOutputNodes = adjOutputEdges.data().map(edge => edge.target);
              visibleNodes.data(adjOutputNodes, node => node.toString())
                  .attr("relToHover", "output");
              view.hoveredNodeIdentifier = node.identifier();
              view.updateGraphVisibility();
          })
              .on("mouseleave", node => {
              const visibleEdges = view.visibleEdges.selectAll("path");
              const adjEdges = visibleEdges.filter(edge => edge.target === node || edge.source === node);
              adjEdges.attr("relToHover", "none");
              const adjNodes = adjEdges.data().map(edge => edge.target)
                  .concat(adjEdges.data().map(edge => edge.source));
              const visibleNodes = view.visibleNodes.selectAll("g");
              visibleNodes.data(adjNodes, node => node.toString()).attr("relToHover", "none");
              view.hoveredNodeIdentifier = null;
              view.updateGraphVisibility();
          })
              .on("click", node => {
              if (!event.shiftKey)
                  view.nodeSelectionHandler.clear();
              view.nodeSelectionHandler.select([node], undefined, false);
              event.stopPropagation();
          })
              .call(view.drag);
          newGs.each(function (node) {
              const svg = select(this);
              svg.append("rect")
                  .attr("rx", 10)
                  .attr("ry", 10)
                  .attr("width", node => node.getWidth())
                  .attr("height", node => node.getHeight(view.state.showTypes));
              svg.append("text")
                  .classed("label", true)
                  .attr("text-anchor", "right")
                  .attr("dx", 5)
                  .attr("dy", 5)
                  .append("tspan")
                  .text(node.getDisplayLabel())
                  .append("title")
                  .text(node.getTitle());
              if (node.nodeLabel.type) {
                  svg.append("text")
                      .classed("label", true)
                      .classed("type", true)
                      .attr("text-anchor", "right")
                      .attr("dx", 5)
                      .attr("dy", node.labelBox.height + 5)
                      .append("tspan")
                      .text(node.getDisplayType())
                      .append("title")
                      .text(node.getType());
              }
              view.appendInputAndOutputBubbles(svg, node);
          });
          const newAndOldNodes = newGs.merge(selNodes);
          newAndOldNodes.select(".type").each(function () {
              this.setAttribute("visibility", view.state.showTypes ? "visible" : "hidden");
          });
          newAndOldNodes
              .classed("selected", node => state.selection.isSelected(node))
              .attr("transform", node => `translate(${node.x},${node.y})`)
              .select("rect")
              .attr("height", node => node.getHeight(view.state.showTypes));
          view.visibleBubbles = view.svg.selectAll("circle");
          view.updateInputAndOutputBubbles();
          graph.maxGraphX = graph.maxGraphNodeX;
          newAndOldEdges.attr("d", edge => edge.generatePath(graph, view.state.showTypes));
      }
      svgKeyDown() {
          let eventHandled = true; // unless the below switch defaults
          switch (event.keyCode) {
              case 38: // UP
              case 40: // DOWN
                  this.showSelectionFrontierNodes(event.keyCode == 38, undefined, true);
                  break;
              case 49:
              case 50:
              case 51:
              case 52:
              case 53:
              case 54:
              case 55:
              case 56:
              case 57: // '1'-'9'
                  this.showSelectionFrontierNodes(true, (edge, index) => index == (event.keyCode - 49), !event.ctrlKey);
                  break;
              case 65: // 'a'
                  this.selectAllNodes();
                  break;
              case 67: // 'c'
                  this.showSelectionFrontierNodes(event.altKey, (edge) => edge.type === "control", true);
                  break;
              case 69: // 'e'
                  this.showSelectionFrontierNodes(event.altKey, (edge) => edge.type === "effect", true);
                  break;
              case 72: // 'h'
                  this.showHoveredNodeHistory();
                  break;
              case 73: // 'i'
                  if (!event.ctrlKey && !event.shiftKey) {
                      this.showSelectionFrontierNodes(true, undefined, false);
                  }
                  else {
                      eventHandled = false;
                  }
                  break;
              case 79: // 'o'
                  this.showSelectionFrontierNodes(false, undefined, false);
                  break;
              case 80: // 'p'
                  this.selectOrigins();
                  break;
              case 82: // 'r'
                  if (!event.ctrlKey && !event.shiftKey) {
                      this.layoutAction(this);
                  }
                  else {
                      eventHandled = false;
                  }
                  break;
              case 83: // 's'
                  if (!event.ctrlKey && !event.shiftKey) {
                      this.hideSelectedAction(this);
                  }
                  else {
                      eventHandled = false;
                  }
                  break;
              case 85: // 'u'
                  if (!event.ctrlKey && !event.shiftKey) {
                      this.hideUnselectedAction(this);
                  }
                  else {
                      eventHandled = false;
                  }
                  break;
              case 97:
              case 98:
              case 99:
              case 100:
              case 101:
              case 102:
              case 103:
              case 104:
              case 105: // 'numpad 1'-'numpad 9'
                  this.showSelectionFrontierNodes(true, (edge, index) => index == (event.keyCode - 97), !event.ctrlKey);
                  break;
              default:
                  eventHandled = false;
                  break;
          }
          if (eventHandled)
              event.preventDefault();
      }
      searchInputAction(searchInput, e, onlyVisible) {
          if (e.keyCode == 13) {
              this.nodeSelectionHandler.clear();
              const query = searchInput.value;
              storageSetItem("lastSearch", query);
              if (query.length == 0)
                  return;
              const reg = new RegExp(query);
              const filterFunction = (node) => {
                  return (reg.exec(node.getDisplayLabel()) !== null ||
                      (this.state.showTypes && reg.exec(node.getDisplayType())) ||
                      (reg.exec(node.getTitle())) ||
                      reg.exec(node.nodeLabel.opcode) !== null);
              };
              const selection = this.searchNodes(filterFunction, e, onlyVisible);
              this.nodeSelectionHandler.select(selection, true, false);
              this.connectVisibleSelectedElements(this.state.selection);
              this.updateGraphVisibility();
              searchInput.blur();
              this.viewSelection();
              this.focusOnSvg();
          }
          e.stopPropagation();
      }
      detachSelection() {
          return new SelectionStorage(this.state.selection.detachSelection());
      }
      adaptSelection(rememberedSelection) {
          if (!this.graph.nodeMap || !(rememberedSelection instanceof SelectionStorage)) {
              return new SelectionStorage();
          }
          for (const node of rememberedSelection.adaptedNodes) {
              this.graph.makeNodeVisible(node);
          }
          for (const [key, node] of rememberedSelection.nodes.entries()) {
              // Adding survived nodes (with the same id)
              const survivedNode = this.graph.nodeMap[key];
              if (survivedNode) {
                  const key = this.state.selection.stringKey(survivedNode);
                  rememberedSelection.adaptNode(key);
                  this.graph.makeNodeVisible(key);
              }
              // Adding children of nodes
              const childNodes = this.graph.originNodesMap.get(key);
              if (childNodes?.length > 0) {
                  for (const childNode of childNodes) {
                      const key = this.state.selection.stringKey(childNode);
                      rememberedSelection.adaptNode(key);
                      this.graph.makeNodeVisible(key);
                  }
              }
              // Adding ancestors of nodes
              const originStringKey = this.state.selection.originStringKey(node);
              if (originStringKey) {
                  rememberedSelection.adaptNode(originStringKey);
                  this.graph.makeNodeVisible(originStringKey);
              }
          }
          return rememberedSelection;
      }
      initializeNodeSelectionHandler() {
          const view = this;
          return {
              select: function (selectedNodes, selected, scrollIntoView) {
                  const locations = new Array();
                  const nodes = new Set();
                  for (const node of selectedNodes) {
                      if (node.nodeLabel.sourcePosition) {
                          locations.push(node.nodeLabel.sourcePosition);
                          nodes.add(node.identifier());
                      }
                      if (node.nodeLabel.bytecodePosition) {
                          locations.push(node.nodeLabel.bytecodePosition);
                          nodes.add(node.identifier());
                      }
                  }
                  view.state.selection.select(selectedNodes, selected);
                  view.broker.broadcastSourcePositionSelect(this, locations, selected, nodes);
                  view.updateGraphVisibility();
              },
              clear: function () {
                  view.state.selection.clear();
                  view.broker.broadcastClear(this);
                  view.updateGraphVisibility();
              },
              brokeredNodeSelect: function (nodeIds, selected) {
                  if (!view.graph)
                      return;
                  const selection = view.graph.nodes(node => nodeIds.has(node.identifier())
                      && (!view.state.hideDead || node.isLive()));
                  view.state.selection.select(selection, selected);
                  // Update edge visibility based on selection.
                  for (const item of view.state.selection.selectedKeys()) {
                      const node = view.graph.nodeMap[item];
                      if (!node)
                          continue;
                      node.visible = true;
                      node.inputs.forEach(edge => {
                          edge.visible = edge.visible || edge.source.visible;
                      });
                      node.outputs.forEach(edge => {
                          edge.visible = edge.visible || edge.target.visible;
                      });
                  }
                  view.updateGraphVisibility();
              },
              brokeredClear: function () {
                  view.state.selection.clear();
                  view.updateGraphVisibility();
              }
          };
      }
      createGraph(data, rememberedSelection) {
          this.graph = new Graph(data);
          this.graphLayout = new GraphLayout(this.graph);
          if (!this.state.cacheLayout ||
              this.graph.graphPhase.stateType == GraphStateType.NeedToFullRebuild) {
              this.updateGraphStateType(GraphStateType.NeedToFullRebuild);
              this.showControlAction(this);
          }
          else {
              this.showVisible();
          }
          const adaptedSelection = this.adaptSelection(rememberedSelection);
          this.graph.makeEdgesVisible();
          this.layoutGraph();
          this.updateGraphVisibility();
          return adaptedSelection;
      }
      layoutGraph() {
          const layoutMessage = this.graph.graphPhase.stateType == GraphStateType.Cached
              ? "Layout graph from cache"
              : "Layout graph";
          console.time(layoutMessage);
          this.graphLayout.rebuild(this.state.showTypes);
          const extent = this.graph.redetermineGraphBoundingBox(this.state.showTypes);
          this.panZoom.translateExtent(extent);
          this.minScale();
          console.timeEnd(layoutMessage);
      }
      appendInputAndOutputBubbles(svg, node) {
          const view = this;
          for (let i = 0; i < node.inputs.length; ++i) {
              const x = node.getInputX(i);
              const y = -DEFAULT_NODE_BUBBLE_RADIUS;
              svg.append("circle")
                  .classed("filledBubbleStyle", node.inputs[i].isVisible())
                  .classed("bubbleStyle", !node.inputs[i].isVisible())
                  .attr("id", `ib,${node.inputs[i]}`)
                  .attr("r", DEFAULT_NODE_BUBBLE_RADIUS)
                  .attr("transform", `translate(${x},${y})`)
                  .on("click", function () {
                  const components = this.id.split(",");
                  const node = view.graph.nodeMap[components[3]];
                  const edge = node.inputs[components[2]];
                  const visible = !edge.isVisible();
                  node.setInputVisibility(components[2], visible);
                  event.stopPropagation();
                  view.updateGraphVisibility();
              });
          }
          if (node.outputs.length > 0) {
              const x = node.getOutputX();
              const y = node.getHeight(view.state.showTypes) + DEFAULT_NODE_BUBBLE_RADIUS;
              svg.append("circle")
                  .classed("filledBubbleStyle", node.areAnyOutputsVisible()
                  == OutputVisibilityType.AllNodesVisible)
                  .classed("halFilledBubbleStyle", node.areAnyOutputsVisible()
                  == OutputVisibilityType.SomeNodesVisible)
                  .classed("bubbleStyle", node.areAnyOutputsVisible()
                  == OutputVisibilityType.NoVisibleNodes)
                  .attr("id", `ob,${node.id}`)
                  .attr("r", DEFAULT_NODE_BUBBLE_RADIUS)
                  .attr("transform", `translate(${x},${y})`)
                  .on("click", node => {
                  node.setOutputVisibility(node.areAnyOutputsVisible()
                      == OutputVisibilityType.NoVisibleNodes);
                  event.stopPropagation();
                  view.updateGraphVisibility();
              });
          }
      }
      updateInputAndOutputBubbles() {
          const view = this;
          const graph = this.graph;
          const bubbles = this.visibleBubbles;
          bubbles.classed("filledBubbleStyle", function () {
              const components = this.id.split(",");
              if (components[0] === "ib") {
                  const edge = graph.nodeMap[components[3]].inputs[components[2]];
                  return edge.isVisible();
              }
              return graph.nodeMap[components[1]].areAnyOutputsVisible()
                  == OutputVisibilityType.AllNodesVisible;
          }).classed("halfFilledBubbleStyle", function () {
              const components = this.id.split(",");
              if (components[0] === "ib")
                  return false;
              return graph.nodeMap[components[1]].areAnyOutputsVisible()
                  == OutputVisibilityType.SomeNodesVisible;
          }).classed("bubbleStyle", function () {
              const components = this.id.split(",");
              if (components[0] === "ib") {
                  const edge = graph.nodeMap[components[3]].inputs[components[2]];
                  return !edge.isVisible();
              }
              return graph.nodeMap[components[1]].areAnyOutputsVisible()
                  == OutputVisibilityType.NoVisibleNodes;
          });
          bubbles.each(function () {
              const components = this.id.split(",");
              if (components[0] === "ob") {
                  const from = graph.nodeMap[components[1]];
                  const x = from.getOutputX();
                  const y = from.getHeight(view.state.showTypes) + DEFAULT_NODE_BUBBLE_RADIUS;
                  this.setAttribute("transform", `translate(${x},${y})`);
              }
          });
      }
      attachSelection(selection) {
          if (!(selection instanceof Set))
              return new Array();
          this.nodeSelectionHandler.clear();
          const selected = [
              ...this.graph.nodes(node => selection.has(this.state.selection.stringKey(node))
                  && (!this.state.hideDead || node.isLive()))
          ];
          this.nodeSelectionHandler.select(selected, true, false);
          return selected;
      }
      viewSelection() {
          let minX;
          let maxX;
          let minY;
          let maxY;
          let hasSelection = false;
          this.visibleNodes.selectAll("g").each((node) => {
              if (this.state.selection.isSelected(node)) {
                  hasSelection = true;
                  minX = minX ? Math.min(minX, node.x) : node.x;
                  maxX = maxX ? Math.max(maxX, node.x + node.getWidth()) : node.x + node.getWidth();
                  minY = minY ? Math.min(minY, node.y) : node.y;
                  maxY = maxY
                      ? Math.max(maxY, node.y + node.getHeight(this.state.showTypes))
                      : node.y + node.getHeight(this.state.showTypes);
              }
          });
          if (hasSelection) {
              this.viewGraphRegion(minX - NODE_INPUT_WIDTH, minY - 60, maxX + NODE_INPUT_WIDTH, maxY + 60);
          }
      }
      // Actions (handlers of toolbox menu and hotkeys events)
      layoutAction(view) {
          view.updateGraphStateType(GraphStateType.NeedToFullRebuild);
          view.layoutGraph();
          view.updateGraphVisibility();
          view.viewWholeGraph();
          view.focusOnSvg();
      }
      showAllAction(view) {
          for (const node of view.graph.nodes()) {
              node.visible = !view.state.hideDead || node.isLive();
          }
          view.graph.forEachEdge((edge) => {
              edge.visible = edge.source.visible || edge.target.visible;
          });
          view.updateGraphVisibility();
          view.viewWholeGraph();
          view.focusOnSvg();
      }
      showControlAction(view) {
          for (const node of view.graph.nodes()) {
              node.visible = node.cfg && (!view.state.hideDead || node.isLive());
          }
          view.graph.forEachEdge((edge) => {
              edge.visible = edge.type === "control" && edge.source.visible && edge.target.visible;
          });
          view.showVisible();
      }
      hideUnselectedAction(view) {
          for (const node of view.graph.nodes()) {
              if (!view.state.selection.isSelected(node)) {
                  node.visible = false;
              }
          }
          view.updateGraphVisibility();
          view.focusOnSvg();
      }
      hideSelectedAction(view) {
          for (const node of view.graph.nodes()) {
              if (view.state.selection.isSelected(node)) {
                  node.visible = false;
              }
          }
          view.nodeSelectionHandler.clear();
          view.focusOnSvg();
      }
      zoomSelectionAction(view) {
          view.viewSelection();
          view.focusOnSvg();
      }
      toggleHideDeadAction(view) {
          view.state.hideDead = !view.state.hideDead;
          if (view.state.hideDead) {
              view.hideDead();
          }
          else {
              view.showDead();
          }
          const element = document.getElementById("toggle-hide-dead");
          element.classList.toggle("button-input-toggled", view.state.hideDead);
          view.focusOnSvg();
      }
      toggleTypesAction(view) {
          view.state.showTypes = !view.state.showTypes;
          const element = document.getElementById("toggle-types");
          element.classList.toggle("button-input-toggled", view.state.showTypes);
          view.updateGraphVisibility();
          view.focusOnSvg();
      }
      toggleLayoutCachingAction(view) {
          view.state.cacheLayout = !view.state.cacheLayout;
          const element = document.getElementById("toggle-cache-layout");
          element.classList.toggle("button-input-toggled", view.state.cacheLayout);
      }
      hideDead() {
          for (const node of this.graph.nodes()) {
              if (!node.isLive()) {
                  node.visible = false;
                  this.state.selection.select([node], false);
              }
          }
          this.updateGraphVisibility();
      }
      showDead() {
          for (const node of this.graph.nodes()) {
              if (!node.isLive()) {
                  node.visible = true;
              }
          }
          this.updateGraphVisibility();
      }
      // Hotkeys handlers
      selectAllNodes() {
          if (!event.shiftKey) {
              this.state.selection.clear();
          }
          const allVisibleNodes = [...this.graph.nodes(node => node.visible)];
          this.state.selection.select(allVisibleNodes, true);
          this.updateGraphVisibility();
      }
      selectOrigins() {
          const selection = new SelectionStorage();
          const origins = new Array();
          let phase = this.phaseName;
          for (const node of this.state.selection) {
              const origin = node.nodeLabel.origin;
              if (origin && origin instanceof NodeOrigin) {
                  phase = origin.phase;
                  const node = this.graph.nodeMap[origin.identifier()];
                  if (phase === this.phaseName && node) {
                      origins.push(node);
                  }
                  else {
                      selection.adaptNode(origin.identifier());
                  }
              }
          }
          // Only go through phase reselection if we actually need
          // to display another phase.
          if (selection.isAdapted() && phase !== this.phaseName) {
              this.showPhaseByName(phase, selection);
          }
          else if (origins.length > 0) {
              this.nodeSelectionHandler.clear();
              this.nodeSelectionHandler.select(origins, true, false);
          }
      }
  }

  // Copyright 2015 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  class ScheduleView extends TextView {
      constructor(parent, broker) {
          super(parent, broker);
          this.sourceResolver = broker.sourceResolver;
      }
      createViewElement() {
          const pane = document.createElement("div");
          pane.setAttribute("id", SCHEDULE_PANE_ID);
          pane.classList.add("scrollable");
          pane.setAttribute("tabindex", "0");
          return pane;
      }
      initializeContent(schedule, rememberedSelection) {
          this.divNode.innerHTML = "";
          this.schedule = schedule;
          this.clearSelectionMaps();
          this.addBlocks(schedule.data.blocksRpo);
          this.show();
          if (rememberedSelection) {
              const adaptedSelection = this.adaptSelection(rememberedSelection);
              this.attachSelection(adaptedSelection);
          }
      }
      detachSelection() {
          return new SelectionStorage(this.nodeSelections.current.detachSelection(), this.blockSelections.current.detachSelection());
      }
      adaptSelection(selection) {
          for (const key of selection.nodes.keys())
              selection.adaptedNodes.add(key);
          for (const key of selection.blocks.keys())
              selection.adaptedBocks.add(key);
          return selection;
      }
      searchInputAction(searchBar, e, onlyVisible) {
          e.stopPropagation();
          this.nodeSelectionHandler.clear();
          const query = searchBar.value;
          if (query.length == 0)
              return;
          const select = new Array();
          storageSetItem("lastSearch", query);
          const reg = new RegExp(query);
          for (const node of this.schedule.data.nodes) {
              if (node === undefined)
                  continue;
              if (reg.exec(node.toString()) !== null) {
                  select.push(node.id);
              }
          }
          this.nodeSelectionHandler.select(select, true, false);
      }
      addBlocks(blocks) {
          for (const block of blocks) {
              const blockEl = this.createElementForBlock(block);
              this.divNode.appendChild(blockEl);
          }
      }
      attachSelection(adaptedSelection) {
          if (!(adaptedSelection instanceof SelectionStorage))
              return;
          this.blockSelectionHandler.clear();
          this.nodeSelectionHandler.clear();
          this.blockSelectionHandler.select(Array.from(adaptedSelection.adaptedBocks).map(block => Number(block)), true, true);
          this.nodeSelectionHandler.select(adaptedSelection.adaptedNodes, true, true);
      }
      createElementForBlock(block) {
          const scheduleBlock = this.createElement("div", "schedule-block");
          scheduleBlock.classList.toggle("deferred", block.deferred);
          const [start, end] = this.sourceResolver.instructionsPhase
              .getInstructionRangeForBlock(block.rpo);
          const instrMarker = this.createElement("div", "instr-marker com", "&#8857;");
          instrMarker.setAttribute("title", `Instructions range for this block is [${start}, ${end})`);
          instrMarker.onclick = this.mkBlockLinkHandler(block.rpo);
          scheduleBlock.appendChild(instrMarker);
          let displayStr = String(block.rpo) + " Id:" + String(block.id);
          if (block.count != -1)
              displayStr += " Count:" + String(block.count);
          const blocksRpoId = this.createElement("div", "block-id com clickable", displayStr);
          blocksRpoId.onclick = this.mkBlockLinkHandler(block.rpo);
          scheduleBlock.appendChild(blocksRpoId);
          const blockPred = this.createElement("div", "predecessor-list block-list comma-sep-list");
          for (const pred of block.predecessors) {
              const predEl = this.createElement("div", "block-id com clickable", String(pred));
              predEl.onclick = this.mkBlockLinkHandler(pred);
              blockPred.appendChild(predEl);
          }
          if (block.predecessors.length)
              scheduleBlock.appendChild(blockPred);
          const nodes = this.createElement("div", "nodes");
          for (const node of block.nodes) {
              nodes.appendChild(this.createElementForNode(node));
          }
          scheduleBlock.appendChild(nodes);
          const blockSucc = this.createElement("div", "successor-list block-list comma-sep-list");
          for (const succ of block.successors) {
              const succEl = this.createElement("div", "block-id com clickable", String(succ));
              succEl.onclick = this.mkBlockLinkHandler(succ);
              blockSucc.appendChild(succEl);
          }
          if (block.successors.length)
              scheduleBlock.appendChild(blockSucc);
          this.addHtmlElementForBlockId(block.rpo, scheduleBlock);
          return scheduleBlock;
      }
      createElementForNode(node) {
          const nodeEl = this.createElement("div", "node");
          const [start, end] = this.sourceResolver.instructionsPhase.getInstruction(node.id);
          const [marker, tooltip] = this.sourceResolver.instructionsPhase
              .getInstructionMarker(start, end);
          const instrMarker = this.createElement("div", "instr-marker com", marker);
          instrMarker.setAttribute("title", tooltip);
          instrMarker.onclick = this.mkNodeLinkHandler(node.id);
          nodeEl.appendChild(instrMarker);
          const nodeIdEl = this.createElement("div", "node-id tag clickable", String(node.id));
          nodeIdEl.onclick = this.mkNodeLinkHandler(node.id);
          this.addHtmlElementForNodeId(node.id, nodeIdEl);
          nodeEl.appendChild(nodeIdEl);
          const nodeLabel = this.createElement("div", "node-label", node.label);
          nodeEl.appendChild(nodeLabel);
          if (node.inputs.length > 0) {
              const nodeParameters = this.createElement("div", "parameter-list comma-sep-list");
              for (const param of node.inputs) {
                  const paramEl = this.createElement("div", "parameter tag clickable", String(param));
                  nodeParameters.appendChild(paramEl);
                  paramEl.onclick = this.mkNodeLinkHandler(param);
                  this.addHtmlElementForNodeId(param, paramEl);
              }
              nodeEl.appendChild(nodeParameters);
          }
          return nodeEl;
      }
      mkBlockLinkHandler(blockId) {
          const view = this;
          return function (e) {
              e.stopPropagation();
              if (!e.shiftKey) {
                  view.blockSelectionHandler.clear();
              }
              view.blockSelectionHandler.select([blockId], true, false);
          };
      }
      mkNodeLinkHandler(nodeId) {
          const view = this;
          return function (e) {
              e.stopPropagation();
              if (!e.shiftKey) {
                  view.nodeSelectionHandler.clear();
              }
              view.nodeSelectionHandler.select([nodeId], true, false);
          };
      }
      createElement(tag, cls, content) {
          const el = document.createElement(tag);
          el.className = cls;
          if (content !== undefined)
              el.innerHTML = content;
          return el;
      }
  }

  // Copyright 2022 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  class Interval {
      constructor(numbers) {
          this.start = numbers[0];
          this.end = numbers[1];
      }
  }

  // Copyright 2020 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  // This class holds references to the HTMLElements that represent each cell.
  class Grid {
      constructor(canvas) {
          this.elements = new Array();
          this.background = canvas;
          this.backgroundContext = this.background.getContext("2d");
          this.background.style.setProperty("margin-left", "0px");
          this.backgroundScrollLeft = 0;
          this.backgroundScrollTop = 0;
          this.backgroundFocusRow = -1;
          this.backgroundFocusColumn = -1;
      }
      setRow(row, elementsRow) {
          this.elements[row] = elementsRow;
      }
      updateBackgroundFocusPoint(row, column) {
          this.backgroundFocusRow = row;
          this.backgroundFocusColumn = column;
      }
      clearBackgroundFocusPoint() {
          this.backgroundFocusRow = -1;
          this.backgroundFocusColumn = -1;
      }
      updateBackground(view, scrollTop, scrollLeft) {
          // Update canvas size.
          if (view.divs.grid === undefined)
              return;
          if (view.divs.registers === undefined)
              return;
          if (view.divs.positionHeaders === null)
              return;
          const positions = view.divs.positionHeaders.lastChild;
          const gridBoundRect = view.divs.grid.getBoundingClientRect();
          const yAxisBoundRect = view.divs.yAxis.getBoundingClientRect();
          this.background.style.setProperty("margin-left", yAxisBoundRect.width.toString() + "px");
          this.background.style.setProperty("margin-top", (yAxisBoundRect.top - gridBoundRect.top).toString() + "px");
          const rangePosCellSize = view.divs.getRangePositionCellSize();
          const rangeRegCellSize = view.divs.getRangeRegCellSize();
          const flipped = view.userSettings.get("flipped");
          const canvasWidth = Math.min(gridBoundRect.width, flipped ? view.divs.registers.getBoundingClientRect().width :
              positions.getBoundingClientRect().width);
          const canvasHeight = Math.min(gridBoundRect.height, flipped ? positions.getBoundingClientRect().height :
              view.divs.registers.getBoundingClientRect().height);
          this.background.setAttribute("width", canvasWidth.toString());
          this.background.setAttribute("height", canvasHeight.toString());
          const firstPosition = view.instructionRangeHandler.getFirstPosition();
          // Draw background lines and highlight select sections.
          if (!flipped) {
              const startRow = Math.floor(scrollTop / rangeRegCellSize[1]);
              const endRow = Math.floor((scrollTop + canvasHeight) / rangeRegCellSize[1]);
              const startColumn = Math.floor(scrollLeft / rangePosCellSize[0]);
              const endColumn = Math.floor((scrollLeft + canvasWidth) / rangePosCellSize[0]);
              // Draw the highlight region.
              this.backgroundContext.fillStyle = RANGE_BACKGROUND_SELECT_COLOR;
              let yAxisPos = startRow * rangeRegCellSize[1] - scrollTop + RANGE_REGISTER_BORDER_WIDTH;
              for (let row = startRow; row <= endRow; row++) {
                  if (view.divs.isRangeRegSelected(row)) {
                      this.backgroundContext.fillRect(0, yAxisPos, canvasWidth, rangeRegCellSize[1]);
                  }
                  yAxisPos += rangeRegCellSize[1];
              }
              let xAxisPos = startColumn * rangePosCellSize[0] - scrollLeft;
              for (let column = startColumn; column <= endColumn; column++) {
                  if (view.divs.isRangePositionSelected(column)) {
                      this.backgroundContext.fillRect(xAxisPos, 0, rangePosCellSize[0], canvasHeight);
                  }
                  xAxisPos += rangePosCellSize[0];
              }
              // Draw the focus point.
              if (this.canShowFocus([startRow, endRow,
                  startColumn + firstPosition, endColumn + firstPosition])) {
                  this.backgroundContext.fillStyle = RANGE_BACKGROUND_FOCUS_COLOR;
                  const xPos = (this.backgroundFocusColumn - firstPosition) * rangePosCellSize[0] - scrollLeft;
                  const yPos = this.backgroundFocusRow * rangeRegCellSize[1] - scrollTop;
                  this.backgroundContext.fillRect(xPos, yPos, rangePosCellSize[0], rangeRegCellSize[1]);
              }
              // Draw the background lines.
              this.backgroundContext.fillStyle = RANGE_BACKGROUND_BORDER_COLOR;
              yAxisPos = (startRow + 1) * rangeRegCellSize[1] - scrollTop;
              for (let row = startRow; row <= endRow; row++) {
                  this.backgroundContext.fillRect(0, yAxisPos - RANGE_REGISTER_BORDER_WIDTH, canvasWidth, RANGE_REGISTER_BORDER_WIDTH_X2);
                  yAxisPos += rangeRegCellSize[1];
              }
              xAxisPos = (startColumn + 1) * rangePosCellSize[0] - scrollLeft;
              for (let column = startColumn; column <= endColumn; column++) {
                  const borderWidth = this.getBorderWidth(view, column + firstPosition);
                  this.backgroundContext.fillRect(xAxisPos - borderWidth, 0, borderWidth, canvasHeight);
                  xAxisPos += rangePosCellSize[0];
              }
          }
          else {
              const startRow = Math.floor(scrollTop / rangePosCellSize[1]);
              const endRow = Math.floor((scrollTop + canvasHeight) / rangePosCellSize[1]);
              const startColumn = Math.floor(scrollLeft / rangeRegCellSize[0]);
              const endColumn = Math.floor((scrollLeft + canvasWidth) / rangeRegCellSize[0]);
              // Draw the highlight region.
              this.backgroundContext.fillStyle = RANGE_BACKGROUND_SELECT_COLOR;
              let yAxisPos = startRow * rangePosCellSize[1] - scrollTop;
              for (let row = startRow; row <= endRow; row++) {
                  if (view.divs.isRangePositionSelected(row)) {
                      this.backgroundContext.fillRect(0, yAxisPos, canvasWidth, rangePosCellSize[1]);
                  }
                  yAxisPos += rangePosCellSize[1];
              }
              let xAxisPos = startColumn * rangeRegCellSize[0] - scrollLeft + RANGE_REGISTER_BORDER_WIDTH;
              for (let column = startColumn; column <= endColumn; column++) {
                  if (view.divs.isRangeRegSelected(column)) {
                      this.backgroundContext.fillRect(xAxisPos, 0, rangeRegCellSize[0], canvasHeight);
                  }
                  xAxisPos += rangeRegCellSize[0];
              }
              // Draw the focus point.
              if (this.canShowFocus([startColumn, endColumn,
                  startRow + firstPosition, endRow + firstPosition])) {
                  this.backgroundContext.fillStyle = RANGE_BACKGROUND_FOCUS_COLOR;
                  const xPos = this.backgroundFocusRow * rangeRegCellSize[0] - scrollLeft;
                  const yPos = (this.backgroundFocusColumn - firstPosition) * rangePosCellSize[1] - scrollTop;
                  this.backgroundContext.fillRect(xPos, yPos, rangeRegCellSize[0], rangePosCellSize[1]);
              }
              // Draw the background lines.
              this.backgroundContext.fillStyle = RANGE_BACKGROUND_BORDER_COLOR;
              yAxisPos = (startRow + 1) * rangePosCellSize[1] - scrollTop;
              for (let row = startRow; row <= endRow; row++) {
                  const borderWidth = this.getBorderWidth(view, row + firstPosition);
                  this.backgroundContext.fillRect(0, yAxisPos - borderWidth, canvasWidth, borderWidth);
                  yAxisPos += rangePosCellSize[1];
              }
              xAxisPos = (startColumn + 1) * rangeRegCellSize[0] - scrollLeft;
              for (let column = startColumn; column <= endColumn; column++) {
                  this.backgroundContext.fillRect(xAxisPos - RANGE_REGISTER_BORDER_WIDTH, 0, RANGE_REGISTER_BORDER_WIDTH_X2, canvasHeight);
                  xAxisPos += rangeRegCellSize[0];
              }
          }
          this.backgroundScrollLeft = scrollLeft;
          this.backgroundScrollTop = scrollTop;
      }
      getCell(row, column) {
          if (this.elements[row] === undefined)
              return undefined;
          return this.elements[row][column];
      }
      getInterval(row, column) {
          // The cell is within an inner wrapper div which is within the interval div.
          return this.getCell(row, column).parentElement.parentElement;
      }
      getBorderWidth(view, position) {
          return view.blocksData.isBlockBorder(position) ? view.cssVariables.blockBorderWidth :
              view.blocksData.isInstructionBorder(position) ? view.cssVariables.instrBorder :
                  RANGE_POSITION_BORDER_WIDTH;
      }
      canShowFocus(bound) {
          return this.backgroundFocusRow >= bound[0] && this.backgroundFocusRow <= bound[1] &&
              this.backgroundFocusColumn >= bound[2] && this.backgroundFocusColumn <= bound[3];
      }
  }
  // This class is used as a wrapper to hide the switch between the
  // two different Grid objects used, one for each phase,
  // before and after register allocation.
  class GridAccessor {
      constructor(sequenceView) {
          this.sequenceView = sequenceView;
          this.grids = new Map();
      }
      getAnyGrid() {
          return this.grids.values().next().value;
      }
      hasGrid() {
          return this.grids.has(this.sequenceView.currentPhaseIndex);
      }
      addGrid(grid) {
          if (this.hasGrid())
              console.warn("Overwriting existing Grid.");
          this.grids.set(this.sequenceView.currentPhaseIndex, grid);
      }
      getCell(row, column) {
          return this.currentGrid().getCell(row, column);
      }
      getInterval(row, column) {
          return this.currentGrid().getInterval(row, column);
      }
      currentGrid() {
          return this.grids.get(this.sequenceView.currentPhaseIndex);
      }
  }
  // This class is used as a wrapper to access the interval HTMLElements
  class IntervalElementsAccessor {
      constructor(sequenceView) {
          this.sequenceView = sequenceView;
          this.map = new Map();
      }
      addInterval(interval) {
          this.currentIntervals().push(interval);
      }
      forEachInterval(callback) {
          for (const phase of this.map.keys()) {
              for (const interval of this.map.get(phase)) {
                  callback(phase, interval);
              }
          }
      }
      currentIntervals() {
          const intervals = this.map.get(this.sequenceView.currentPhaseIndex);
          if (intervals === undefined) {
              this.map.set(this.sequenceView.currentPhaseIndex, new Array());
              return this.currentIntervals();
          }
          return intervals;
      }
  }
  // A number of css variables regarding dimensions of HTMLElements are required by RangeView.
  class CSSVariables {
      constructor() {
          this.positionWidth = getNumericCssValue("--range-position-width");
          this.positionBorder = getNumericCssValue("--range-position-border");
          this.blockBorderWidth = getNumericCssValue("--range-block-border");
          this.flippedPositionHeight = getNumericCssValue("--range-flipped-position-height");
          this.instrBorder = getNumericCssValue("--range-instr-border");
      }
      setVariables(numPositions, numRegisters) {
          setCssValue("--range-num-positions", String(numPositions));
          setCssValue("--range-num-registers", String(numRegisters));
      }
  }
  class UserSettingsObject {
      constructor(value, resetFunction) {
          this.value = value;
          this.resetFunction = resetFunction;
      }
  }
  // Manages the user's setting options regarding how the grid is displayed.
  class UserSettings {
      constructor() {
          this.settings = new Map();
      }
      addSetting(settingName, value, resetFunction) {
          this.settings.set(settingName, new UserSettingsObject(value, resetFunction));
      }
      getToggleElement(settingName, settingLabel) {
          const toggleEl = createElement("label", "range-toggle-setting", settingLabel);
          const toggleInput = createElement("input", "range-toggle-setting");
          toggleInput.id = `range-toggle-${settingName}`;
          toggleInput.setAttribute("type", "checkbox");
          toggleInput.oninput = () => {
              toggleInput.disabled = true;
              this.set(settingName, toggleInput.checked);
              this.reset(settingName);
              toggleInput.disabled = false;
          };
          toggleEl.onclick = (e) => { e.stopPropagation(); };
          toggleEl.insertBefore(toggleInput, toggleEl.firstChild);
          return toggleEl;
      }
      reset(settingName) {
          const settingObject = this.settings.get(settingName);
          settingObject.resetFunction(settingObject.value);
          storageSetItem(this.getSettingKey(settingName), settingObject.value);
          window.dispatchEvent(new Event("resize"));
      }
      get(settingName) {
          return this.settings.get(settingName).value;
      }
      set(settingName, value) {
          this.settings.get(settingName).value = value;
      }
      resetFromSessionStorage() {
          for (const [settingName, setting] of this.settings.entries()) {
              const storedValue = storageGetItem(this.getSettingKey(settingName));
              if (storedValue === undefined)
                  continue;
              this.set(settingName, storedValue);
              if (storedValue) {
                  const toggle = document.getElementById(`range-toggle-${settingName}`);
                  if (!toggle.checked) {
                      toggle.checked = storedValue;
                      setting.resetFunction(storedValue);
                  }
              }
          }
      }
      getSettingKey(settingName) {
          return `${SESSION_STORAGE_PREFIX}${settingName}`;
      }
  }
  // Store the required data from the blocks JSON.
  class BlocksData {
      constructor(view, blocks) {
          this.view = view;
          this.blockBorders = new Set();
          this.blockInstructionCountMap = new Map();
          for (const block of blocks) {
              this.blockInstructionCountMap.set(block.id, block.instructions.length);
              const maxInstructionInBlock = block.instructions[block.instructions.length - 1].id;
              this.blockBorders.add(maxInstructionInBlock);
          }
      }
      isInstructionBorder(position) {
          return ((position + 1) % POSITIONS_PER_INSTRUCTION) == 0;
      }
      isInstructionIdOnBlockBorder(instrId) {
          return this.view.instructionRangeHandler.isLastInstruction(instrId)
              || this.blockBorders.has(instrId);
      }
      isBlockBorder(position) {
          const border = Math.floor(position / POSITIONS_PER_INSTRUCTION);
          return this.view.instructionRangeHandler.isLastPosition(position)
              || (this.isInstructionBorder(position) && this.blockBorders.has(border));
      }
      isIndexInstructionBorder(index) {
          return this.isInstructionBorder(this.view.instructionRangeHandler.getPositionFromIndex(index));
      }
      isIndexBlockBorder(index) {
          return this.isBlockBorder(this.view.instructionRangeHandler.getPositionFromIndex(index));
      }
  }
  class Divs {
      constructor(userSettings, instructionRangeString) {
          this.container = document.getElementById(RANGES_PANE_ID);
          this.resizerBar = document.getElementById(RESIZER_RANGES_ID);
          this.snapper = document.getElementById(SHOW_HIDE_RANGES_ID);
          this.content = document.createElement("div");
          this.content.id = "ranges-content";
          this.content.appendChild(this.elementForTitle(userSettings, instructionRangeString));
          this.showOnLoad = document.createElement("div");
          this.showOnLoad.style.visibility = "hidden";
          this.content.appendChild(this.showOnLoad);
          this.xAxisLabel = createElement("div", "range-header-label-x");
          this.xAxisLabel.dataset.notFlipped = "Blocks, Instructions, and Positions";
          this.xAxisLabel.dataset.flipped = "Registers";
          this.xAxisLabel.innerText = this.xAxisLabel.dataset.notFlipped;
          this.showOnLoad.appendChild(this.xAxisLabel);
          this.yAxisLabel = createElement("div", "range-header-label-y");
          this.yAxisLabel.dataset.notFlipped = "Registers";
          this.yAxisLabel.dataset.flipped = "Positions";
          this.yAxisLabel.innerText = this.yAxisLabel.dataset.notFlipped;
          this.showOnLoad.appendChild(this.yAxisLabel);
          this.registerHeaders = createElement("div", "range-register-labels");
          this.registers = createElement("div", "range-registers");
          this.registerHeaders.appendChild(this.registers);
      }
      elementForTitle(userSettings, instructionRangeString) {
          const titleEl = createElement("div", "range-title-div");
          const titleBar = createElement("div", "range-title");
          titleBar.appendChild(createElement("div", "", "Live Ranges for " + instructionRangeString));
          const titleHelp = createElement("div", "range-title-help", "?");
          titleHelp.title = "Each row represents a single TopLevelLiveRange (or two if deferred exists)."
              + "\nEach interval belongs to a LiveRange contained within that row's TopLevelLiveRange."
              + "\nAn interval is identified by i, the index of the LiveRange within the TopLevelLiveRange,"
              + "\nand j, the index of the interval within the LiveRange, to give i:j.";
          titleEl.appendChild(titleBar);
          titleEl.appendChild(titleHelp);
          titleEl.appendChild(userSettings.getToggleElement("landscapeMode", "Landscape Mode"));
          titleEl.appendChild(userSettings.getToggleElement("flipped", "Switched Axes"));
          return titleEl;
      }
      getRangePositionCellSize() {
          const positions = this.positionHeaders.lastChild;
          if (positions.children.length == 0)
              return [0, 0];
          const rangePositionRect = positions.children[0].getBoundingClientRect();
          return [rangePositionRect.width, rangePositionRect.height];
      }
      getRangeRegCellSize() {
          if (this.registers.children.length == 0)
              return [0, 0];
          const yAxisRect = this.registers.children[0].getBoundingClientRect();
          return [yAxisRect.width, yAxisRect.height];
      }
      isRangePositionSelected(column) {
          const positions = this.positionHeaders.lastChild;
          if (positions.children.length < column)
              return false;
          const rangePositionEl = positions.children[column];
          if (rangePositionEl === undefined)
              return false;
          return rangePositionEl.classList.contains('selected');
      }
      isRangeRegSelected(row) {
          if (this.registers.children.length < row)
              return false;
          const rangeRegisterEl = this.registers.children[row];
          if (rangeRegisterEl === undefined)
              return false;
          return rangeRegisterEl.classList.contains('selected');
      }
  }
  class RowConstructor {
      constructor(view) {
          this.view = view;
      }
      getGridTemplateRowsValueForGroupDiv(length) {
          return `repeat(${length},calc(${this.view.cssVariables.positionWidth}ch +
            ${2 * this.view.cssVariables.positionBorder}px))`;
      }
      getGridTemplateColumnsValueForInterval(length) {
          const positionSize = (this.view.userSettings.get("flipped")
              ? `${this.view.cssVariables.flippedPositionHeight}em`
              : `${this.view.cssVariables.positionWidth}ch`);
          return `repeat(${length},calc(${positionSize} + ${this.view.cssVariables.blockBorderWidth}px))`;
      }
      // Constructs the row of HTMLElements for grid while providing a callback for each position
      // depending on whether that position is the start of an interval or not.
      // RangePair is used to allow the two fixed register live ranges of normal and deferred to be
      // easily combined into a single row.
      construct(grid, row, registerId, registerIndex, ranges, getElementForEmptyPosition, callbackForInterval) {
          // Construct all of the new intervals.
          const intervalMap = this.elementsForIntervals(registerIndex, ranges);
          if (intervalMap.size == 0)
              return false;
          const positionsArray = new Array(this.view.instructionRangeHandler.numPositions);
          const posOffset = this.view.instructionRangeHandler.getPositionFromIndex(0);
          let blockId = this.view.instructionRangeHandler.getBlockIdFromIndex(0);
          let lastIntervalEndPos = -1;
          for (let column = 0; column < this.view.instructionRangeHandler.numPositions; ++column) {
              const interval = intervalMap.get(column);
              if (interval === undefined) {
                  if (column == lastIntervalEndPos || column == this.view.instructionRangeHandler.numPositions - 1) {
                      // Add one empty div element at the end of interval to display the use mark.
                      positionsArray[column] = getElementForEmptyPosition(column);
                      this.view.selectionHandler.addCell(positionsArray[column], row, column + posOffset, blockId, registerId, undefined, true);
                  }
                  else {
                      positionsArray[column] = undefined;
                  }
                  if (this.view.blocksData.isBlockBorder(column + posOffset))
                      ++blockId;
              }
              else {
                  callbackForInterval(column, interval);
                  this.view.intervalsAccessor.addInterval(interval);
                  const innerWrapper = this.view.getInnerWrapperFromInterval(interval);
                  const intervalNodeId = interval.dataset.nodeId;
                  this.view.selectionHandler.addInterval(interval, innerWrapper, intervalNodeId, registerId);
                  const intervalPositionElements = innerWrapper.children;
                  for (let j = 0; j < intervalPositionElements.length; ++j) {
                      const intervalColumn = column + j;
                      // Point positions to the new elements.
                      positionsArray[intervalColumn] = intervalPositionElements[j];
                      this.view.selectionHandler.addCell(positionsArray[intervalColumn], row, intervalColumn + posOffset, blockId, registerId, intervalNodeId);
                      if (this.view.blocksData.isBlockBorder(intervalColumn + posOffset))
                          ++blockId;
                  }
                  column += intervalPositionElements.length - 1;
                  lastIntervalEndPos = column + 1;
              }
          }
          grid.setRow(row, positionsArray);
          for (const range of ranges) {
              if (!range)
                  continue;
              this.setUses(grid, row, range);
          }
          return true;
      }
      // This is the main function used to build new intervals.
      // Returns a map of LifeTimePositions to intervals.
      elementsForIntervals(registerIndex, ranges) {
          const intervalMap = new Map();
          for (const range of ranges) {
              if (!range)
                  continue;
              for (const childRange of range.childRanges) {
                  const tooltip = childRange.getTooltip(registerIndex);
                  for (const [index, intervalNums] of childRange.intervals.entries()) {
                      let interval = new Interval(intervalNums);
                      if (!this.view.instructionRangeHandler.showAllPositions) {
                          if (!this.view.instructionRangeHandler.isIntervalInRange(interval))
                              continue;
                          interval =
                              this.view.instructionRangeHandler.convertIntervalPositionsToIndexes(interval);
                      }
                      const intervalEl = this.elementForInterval(childRange, interval, tooltip, index, range.isDeferred);
                      intervalMap.set(interval.start, intervalEl);
                  }
              }
          }
          return intervalMap;
      }
      elementForInterval(childRange, interval, tooltip, index, isDeferred) {
          const intervalEl = createElement("div", "range-interval");
          intervalEl.dataset.tooltip = tooltip.text;
          const title = `${childRange.id}:${index} ${tooltip.text}`;
          intervalEl.setAttribute("title", isDeferred ? `deferred: ${title}` : title);
          this.setIntervalColor(intervalEl, tooltip.text);
          const intervalInnerWrapper = createElement("div", "range-interval-wrapper");
          intervalEl.style.gridColumn = `${(interval.start + 1)} / ${(interval.end + 1)}`;
          const intervalLength = interval.end - interval.start;
          intervalInnerWrapper.style.gridTemplateColumns =
              this.getGridTemplateColumnsValueForInterval(intervalLength);
          const intervalStringEls = this.elementsForIntervalString(tooltip.text, intervalLength);
          intervalEl.appendChild(intervalStringEls.main);
          intervalEl.appendChild(intervalStringEls.behind);
          for (let i = interval.start; i < interval.end; ++i) {
              const classes = "range-position range-interval-position range-empty" +
                  (this.view.blocksData.isIndexBlockBorder(i)
                      ? " range-block-border"
                      : this.view.blocksData.isIndexInstructionBorder(i) ? " range-instr-border" : "");
              const positionEl = createElement("div", classes, "_");
              positionEl.style.gridColumn = String(i - interval.start + 1);
              intervalInnerWrapper.appendChild(positionEl);
          }
          intervalEl.appendChild(intervalInnerWrapper);
          // Either the tooltip represents the interval id, or a new id is required.
          const intervalNodeId = tooltip.isId ? tooltip.text
              : "interval-" + index + "-" + interval.start;
          intervalEl.dataset.nodeId = intervalNodeId;
          return intervalEl;
      }
      setIntervalColor(interval, tooltip) {
          if (tooltip.includes(INTERVAL_TEXT_FOR_NONE))
              return;
          if (tooltip.includes(`${INTERVAL_TEXT_FOR_STACK}-`)) {
              interval.style.backgroundColor = "rgb(250, 158, 168)";
          }
          else if (tooltip.includes(INTERVAL_TEXT_FOR_STACK)) {
              interval.style.backgroundColor = "rgb(250, 158, 100)";
          }
          else if (tooltip.includes(INTERVAL_TEXT_FOR_CONST)) {
              interval.style.backgroundColor = "rgb(153, 158, 230)";
          }
          else {
              interval.style.backgroundColor = "rgb(153, 220, 168)";
          }
      }
      elementsForIntervalString(tooltip, numCells) {
          const spanEl = createElement("span", "range-interval-text");
          // Allows a cleaner display of the interval text when displayed vertically.
          const spanElBehind = createElement("span", "range-interval-text range-interval-text-behind");
          this.view.stringConstructor.setIntervalString(spanEl, spanElBehind, tooltip, numCells);
          return { main: spanEl, behind: spanElBehind };
      }
      setUses(grid, row, range) {
          for (const liveRange of range.childRanges) {
              if (!liveRange.uses)
                  continue;
              for (let use of liveRange.uses) {
                  if (!this.view.instructionRangeHandler.showAllPositions) {
                      if (!this.view.instructionRangeHandler.isPositionInRange(use))
                          continue;
                      use = this.view.instructionRangeHandler.getIndexFromPosition(use);
                  }
                  const gridCell = grid.getCell(row, use);
                  if (gridCell !== undefined) {
                      gridCell.classList.toggle("range-use", true);
                  }
              }
          }
      }
  }
  // A simple storage class for the data used when constructing an interval string.
  class IntervalStringData {
      constructor(tooltip) {
          this.mainString = tooltip;
          this.textLength = tooltip.length;
          this.paddingLeft = null;
      }
  }
  class StringConstructor {
      constructor(view) {
          this.view = view;
      }
      setRegisterString(registerName, isVirtual, regEl) {
          if (this.view.userSettings.get("flipped")) {
              const nums = registerName.match(/\d+/);
              const num = nums ? nums[0] : registerName.substring(1);
              let str = num[num.length - 1];
              for (let i = 2; i <= Math.max(this.view.maxLengthVirtualRegisterNumber, 2); ++i) {
                  const addition = num.length < i ? "<span class='range-transparent'>_</span>"
                      : num[num.length - i];
                  str = `${addition} ${str}`;
              }
              regEl.innerHTML = str;
          }
          else if (!isVirtual) {
              const span = "".padEnd(FIXED_REGISTER_LABEL_WIDTH - registerName.length, "_");
              regEl.innerHTML = `HW - <span class='range-transparent'>${span}</span>${registerName}`;
          }
          else {
              regEl.innerText = registerName;
          }
      }
      // Each interval displays a string of information about it.
      setIntervalString(spanEl, spanElBehind, tooltip, numCells) {
          const isFlipped = this.view.userSettings.get("flipped");
          const spacePerCell = isFlipped ? 1 : this.view.cssVariables.positionWidth + 0.25;
          // One character space is removed to accommodate for padding.
          const totalSpaceAvailable = (numCells * spacePerCell) - (isFlipped ? 0 : 0.5);
          this.intervalStringData = new IntervalStringData(tooltip);
          spanElBehind.innerHTML = "";
          spanEl.style.width = null;
          this.setIntervalStringPadding(spanEl, spanElBehind, totalSpaceAvailable, isFlipped);
          if (this.intervalStringData.textLength > totalSpaceAvailable) {
              this.intervalStringData.mainString = "";
              spanElBehind.innerHTML = "";
          }
          spanEl.innerHTML = this.intervalStringData.mainString;
      }
      setIntervalStringPadding(spanEl, spanElBehind, totalSpaceAvailable, isFlipped) {
          // Add padding at start of text if possible
          if (this.intervalStringData.textLength <= totalSpaceAvailable) {
              if (isFlipped) {
                  spanEl.style.paddingTop =
                      this.intervalStringData.textLength == totalSpaceAvailable ? "0.25em" : "1em";
                  spanEl.style.paddingLeft = null;
              }
              else {
                  this.intervalStringData.paddingLeft =
                      (this.intervalStringData.textLength == totalSpaceAvailable) ? "0.5ch" : "1ch";
                  spanEl.style.paddingTop = null;
              }
          }
          else {
              spanEl.style.paddingTop = null;
          }
          if (spanElBehind.innerHTML.length > 0) {
              // Apply same styling to spanElBehind as to spanEl.
              spanElBehind.setAttribute("style", spanEl.getAttribute("style"));
              spanElBehind.style.paddingLeft = this.intervalStringData.paddingLeft;
          }
          else {
              spanEl.style.paddingLeft = this.intervalStringData.paddingLeft;
          }
      }
  }
  // A simple class to tally the total number of each type of register and store
  // the register prefixes for use in the register type header.
  class RegisterTypeHeaderData {
      constructor() {
          this.virtualCount = 0;
          this.generalCount = 0;
          this.floatCount = 0;
          this.generalPrefix = "x";
          this.floatPrefix = "fp";
      }
      countFixedRegister(registerName, ranges) {
          const range = ranges[0] ? ranges[0] : ranges[1];
          if (range.childRanges[0].isFloatingPoint()) {
              ++(this.floatCount);
              this.floatPrefix = this.floatPrefix == "fp" ? registerName.match(/\D+/)[0] : this.floatPrefix;
          }
          else {
              ++(this.generalCount);
              this.generalPrefix = this.generalPrefix == "x" ? registerName[0] : this.generalPrefix;
          }
      }
  }
  class RangeViewConstructor {
      constructor(rangeView) {
          this.view = rangeView;
          this.registerTypeHeaderData = new RegisterTypeHeaderData();
      }
      construct() {
          const backgroundCanvas = document.createElement("canvas");
          const backgroundCanvasDiv = createElement("div", "range-background-canvas-div");
          backgroundCanvasDiv.appendChild(backgroundCanvas);
          this.grid = new Grid(backgroundCanvas);
          this.view.gridAccessor.addGrid(this.grid);
          this.view.divs.wholeHeader = this.elementForHeader();
          this.view.divs.showOnLoad.appendChild(this.view.divs.wholeHeader);
          const gridContainer = document.createElement("div");
          this.view.divs.grid = this.elementForGrid();
          this.view.divs.yAxis = createElement("div", "range-y-axis");
          this.view.divs.yAxis.appendChild(this.view.divs.registerHeaders);
          this.view.divs.yAxis.onscroll = () => {
              this.view.scrollHandler.syncScroll(ToSync.TOP, this.view.divs.yAxis, this.view.divs.grid);
              this.view.scrollHandler.saveScroll();
          };
          gridContainer.appendChild(backgroundCanvasDiv);
          gridContainer.appendChild(this.view.divs.yAxis);
          gridContainer.appendChild(this.view.divs.grid);
          this.view.selectionHandler.addBackground(this.view.divs.grid);
          this.view.divs.showOnLoad.appendChild(gridContainer);
          this.resetGroups();
          this.addFixedRanges(this.addVirtualRanges(0));
          this.view.divs.registersTypeHeader = this.elementForRegisterTypeHeader();
          this.view.divs.registerHeaders.insertBefore(this.view.divs.registersTypeHeader, this.view.divs.registers);
      }
      // The following three functions are for constructing the groups which the rows are contained
      // within and which make up the grid. This is so as to allow groups of rows to easily be displayed
      // and hidden for performance reasons. As rows are constructed, they are added to the currentGroup
      // div. Each row in currentGroup is matched with an equivalent placeholder row in
      // currentPlaceholderGroup that will be shown when currentGroup is hidden so as to maintain the
      // dimensions and scroll positions of the grid.
      resetGroups() {
          this.currentGroup = createElement("div", "range-positions-group range-hidden");
          this.currentPlaceholderGroup = createElement("div", "range-positions-group");
      }
      appendGroupsToGrid(row) {
          const endRow = row + 2;
          const numRows = this.currentPlaceholderGroup.children.length;
          this.currentGroup.style.gridRow = `${endRow - numRows} / ${numRows == 1 ? "auto" : endRow}`;
          this.currentPlaceholderGroup.style.gridRow = this.currentGroup.style.gridRow;
          this.currentGroup.style.gridTemplateRows =
              this.view.rowConstructor.getGridTemplateRowsValueForGroupDiv(numRows);
          this.currentPlaceholderGroup.style.gridTemplateRows = this.currentGroup.style.gridTemplateRows;
          this.view.divs.grid.appendChild(this.currentPlaceholderGroup);
          this.view.divs.grid.appendChild(this.currentGroup);
      }
      addRowToGroup(row, rowEl) {
          this.currentGroup.appendChild(rowEl);
          this.currentPlaceholderGroup.appendChild(createElement("div", "range-positions range-positions-placeholder", "_"));
          if ((row + 1) % ROW_GROUP_SIZE == 0) {
              this.appendGroupsToGrid(row);
              this.resetGroups();
          }
      }
      addVirtualRanges(row) {
          return this.view.instructionRangeHandler.forEachLiveRange(row, (registerIndex, row, registerName, range) => {
              const registerId = VIRTUAL_REGISTER_ID_PREFIX + registerName;
              const rowEl = this.elementForRow(row, registerId, registerIndex, [range, undefined]);
              if (rowEl) {
                  const registerEl = this.elementForRegister(row, registerName, registerId, true);
                  this.addRowToGroup(row, rowEl);
                  this.view.divs.registers.appendChild(registerEl);
                  this.view.focusHandler.virtualRegisterToRowMap.set(registerIndex, row);
                  ++(this.registerTypeHeaderData.virtualCount);
                  return true;
              }
              return false;
          });
      }
      addFixedRanges(row) {
          row = this.view.instructionRangeHandler.forEachFixedRange(row, (registerIndex, row, registerName, ranges) => {
              const rowEl = this.elementForRow(row, registerName, registerIndex, ranges);
              if (rowEl) {
                  this.registerTypeHeaderData.countFixedRegister(registerName, ranges);
                  const registerEl = this.elementForRegister(row, registerName, registerName, false);
                  this.addRowToGroup(row, rowEl);
                  this.view.divs.registers.appendChild(registerEl);
                  return true;
              }
              return false;
          });
          if (row % ROW_GROUP_SIZE != 0) {
              this.appendGroupsToGrid(row - 1);
          }
      }
      // Each row of positions and intervals associated with a register is contained in a single
      // HTMLElement. RangePair is used to allow the two fixed register live ranges of normal and
      // deferred to be easily combined into a single row.
      elementForRow(row, registerId, registerIndex, ranges) {
          const rowEl = createElement("div", "range-positions");
          const getElementForEmptyPosition = (column) => {
              const position = this.view.instructionRangeHandler.getPositionFromIndex(column);
              const blockBorder = this.view.blocksData.isBlockBorder(position);
              const classes = "range-position range-empty range-background-div " + (blockBorder
                  ? "range-block-border" : this.view.blocksData.isInstructionBorder(position)
                  ? "range-instr-border" : "range-position-border");
              const positionEl = createElement("div", classes, "_");
              positionEl.style.gridColumn = String(column + 1);
              rowEl.appendChild(positionEl);
              return positionEl;
          };
          const callbackForInterval = (_, interval) => {
              rowEl.appendChild(interval);
          };
          // Only construct the row if it has any intervals.
          if (this.view.rowConstructor.construct(this.grid, row, registerId, registerIndex, ranges, getElementForEmptyPosition, callbackForInterval)) {
              return rowEl;
          }
          return undefined;
      }
      elementForRegister(row, registerName, registerId, isVirtual) {
          const regEl = createElement("div", "range-reg");
          this.view.stringConstructor.setRegisterString(registerName, isVirtual, regEl);
          regEl.dataset.virtual = isVirtual.toString();
          regEl.setAttribute("title", registerName);
          regEl.style.gridColumn = String(row + 1);
          this.view.selectionHandler.addRegister(regEl, registerId, row);
          return regEl;
      }
      elementForRegisterTypeHeader() {
          let column = 1;
          const addTypeHeader = (container, count, textOptions) => {
              if (count) {
                  const element = createElement("div", "range-type-header");
                  element.setAttribute("title", textOptions.max);
                  element.style.gridColumn = column + " / " + (column + count);
                  column += count;
                  element.dataset.count = String(count);
                  element.dataset.max = textOptions.max;
                  element.dataset.med = textOptions.med;
                  element.dataset.min = textOptions.min;
                  container.appendChild(element);
              }
          };
          const registerTypeHeaderEl = createElement("div", "range-registers-type range-hidden");
          addTypeHeader(registerTypeHeaderEl, this.registerTypeHeaderData.virtualCount, { max: "virtual registers", med: "virtual", min: "v" });
          addTypeHeader(registerTypeHeaderEl, this.registerTypeHeaderData.generalCount, { max: "general registers",
              med: "general",
              min: this.registerTypeHeaderData.generalPrefix });
          addTypeHeader(registerTypeHeaderEl, this.registerTypeHeaderData.floatCount, { max: "floating point registers",
              med: "floating point",
              min: this.registerTypeHeaderData.floatPrefix });
          return registerTypeHeaderEl;
      }
      // The header element contains the three headers for the LifeTimePosition axis.
      elementForHeader() {
          const headerEl = createElement("div", "range-header");
          this.view.divs.positionHeaders = createElement("div", "range-position-labels");
          this.view.divs.positionHeaders.appendChild(this.elementForBlockHeader());
          this.view.divs.positionHeaders.appendChild(this.elementForInstructionHeader());
          this.view.divs.positionHeaders.appendChild(this.elementForPositionHeader());
          headerEl.appendChild(this.view.divs.positionHeaders);
          headerEl.onscroll = () => {
              this.view.scrollHandler.syncScroll(ToSync.LEFT, this.view.divs.wholeHeader, this.view.divs.grid);
              this.view.scrollHandler.saveScroll();
          };
          return headerEl;
      }
      // The LifeTimePosition axis shows three headers, for positions, instructions, and blocks.
      elementForBlockHeader() {
          const headerEl = createElement("div", "range-block-ids");
          let blockId = 0;
          const lastPos = this.view.instructionRangeHandler.getLastPosition();
          for (let position = 0; position <= lastPos;) {
              const instrCount = this.view.blocksData.blockInstructionCountMap.get(blockId);
              if (this.view.instructionRangeHandler.showAllPositions) {
                  headerEl.appendChild(this.elementForBlock(blockId, position, instrCount));
              }
              else {
                  let blockInterval = new Interval([position, position + (POSITIONS_PER_INSTRUCTION * instrCount)]);
                  if (this.view.instructionRangeHandler.isIntervalInRange(blockInterval)) {
                      blockInterval = this.view.instructionRangeHandler
                          .convertBlockPositionsToIndexes(blockId, blockInterval);
                      headerEl.appendChild(this.elementForBlock(blockId, blockInterval.start, (blockInterval.end - blockInterval.start) / POSITIONS_PER_INSTRUCTION));
                  }
              }
              ++blockId;
              position += instrCount * POSITIONS_PER_INSTRUCTION;
          }
          return headerEl;
      }
      elementForBlock(blockId, firstColumn, instrCount) {
          const element = createElement("div", "range-block-id range-header-element range-block-border");
          const str = `B${blockId}`;
          const idEl = createElement("span", "range-block-id-number", str);
          const centre = instrCount * POSITIONS_PER_INSTRUCTION;
          idEl.style.gridRow = `${centre} / ${centre + 1}`;
          element.appendChild(idEl);
          element.setAttribute("title", str);
          element.dataset.instrCount = String(instrCount);
          // gridColumns start at 1 rather than 0.
          const firstGridCol = firstColumn + 1;
          const lastGridCol = firstGridCol + (instrCount * POSITIONS_PER_INSTRUCTION);
          element.style.gridColumn = `${firstGridCol} / ${lastGridCol}`;
          element.style.gridTemplateRows = `repeat(${8 * instrCount},
      calc((${this.view.cssVariables.flippedPositionHeight}em +
            ${this.view.cssVariables.blockBorderWidth}px)/2))`;
          this.view.selectionHandler.addBlock(element, blockId, firstColumn);
          return element;
      }
      elementForInstructionHeader() {
          const headerEl = createElement("div", "range-instruction-ids");
          let blockId = this.view.instructionRangeHandler.getBlockIdFromIndex(0);
          let instrId = this.view.instructionRangeHandler.getInstructionIdFromIndex(0);
          const instrLimit = instrId + this.view.instructionRangeHandler.numInstructions;
          for (; instrId < instrLimit; ++instrId) {
              headerEl.appendChild(this.elementForInstruction(instrId, blockId));
              if (this.view.blocksData.isInstructionIdOnBlockBorder(instrId))
                  ++blockId;
          }
          return headerEl;
      }
      elementForInstruction(instrId, blockId) {
          const isBlockBorder = this.view.blocksData.isInstructionIdOnBlockBorder(instrId);
          const classes = "range-instruction-id range-header-element "
              + (isBlockBorder ? "range-block-border" : "range-instr-border");
          const element = createElement("div", classes);
          element.appendChild(createElement("span", "range-instruction-id-number", String(instrId)));
          element.setAttribute("title", String(instrId));
          const instrIndex = this.view.instructionRangeHandler.getInstructionIndex(instrId);
          const firstGridCol = (instrIndex * POSITIONS_PER_INSTRUCTION) + 1;
          element.style.gridColumn = `${firstGridCol} / ${(firstGridCol + POSITIONS_PER_INSTRUCTION)}`;
          this.view.selectionHandler.addInstruction(element, instrId, instrIndex, blockId);
          return element;
      }
      elementForPositionHeader() {
          const headerEl = createElement("div", "range-positions range-positions-header");
          let blockId = this.view.instructionRangeHandler.getBlockIdFromIndex(0);
          let position = this.view.instructionRangeHandler.getPositionFromIndex(0);
          const lastPos = this.view.instructionRangeHandler.getLastPosition();
          for (; position <= lastPos; ++position) {
              const isBlockBorder = this.view.blocksData.isBlockBorder(position);
              headerEl.appendChild(this.elementForPosition(position, blockId, isBlockBorder));
              if (isBlockBorder)
                  ++blockId;
          }
          return headerEl;
      }
      elementForPosition(position, blockId, isBlockBorder) {
          const classes = "range-position range-header-element " +
              (isBlockBorder ? "range-block-border"
                  : this.view.blocksData.isInstructionBorder(position) ? "range-instr-border"
                      : "range-position-border");
          const element = createElement("div", classes, String(position));
          element.setAttribute("title", String(position));
          this.view.selectionHandler.addPosition(element, position, blockId);
          return element;
      }
      elementForGrid() {
          const gridEl = createElement("div", "range-grid");
          gridEl.onscroll = () => {
              this.view.scrollHandler.syncScroll(ToSync.TOP, this.view.divs.grid, this.view.divs.yAxis);
              this.view.scrollHandler.syncScroll(ToSync.LEFT, this.view.divs.grid, this.view.divs.wholeHeader);
              this.view.scrollHandler.saveScroll();
          };
          return gridEl;
      }
  }
  // Handles the work required when the phase is changed.
  // Between before and after register allocation for example.
  class PhaseChangeHandler {
      constructor(view) {
          this.view = view;
      }
      // Called when the phase view is switched between before and after register allocation.
      phaseChange() {
          if (!this.view.gridAccessor.hasGrid()) {
              // If this phase view has not been seen yet then the intervals need to be constructed.
              this.addNewIntervals();
          }
          // Show all intervals pertaining to the current phase view.
          this.view.intervalsAccessor.forEachInterval((phase, interval) => {
              interval.classList.toggle("range-hidden", phase != this.view.sequenceView.currentPhaseIndex);
          });
          this.view.focusHandler.resetFocus();
      }
      addNewIntervals() {
          // All Grids should point to the same HTMLElement for empty cells in the grid,
          // so as to avoid duplication. The current Grid is used to retrieve these elements.
          const currentGrid = this.view.gridAccessor.getAnyGrid();
          const newGrid = new Grid(currentGrid.background);
          this.view.gridAccessor.addGrid(newGrid);
          let row = 0;
          row = this.view.instructionRangeHandler.forEachLiveRange(row, (registerIndex, row, registerName, range) => {
              this.addnewIntervalsInRange(currentGrid, newGrid, row, VIRTUAL_REGISTER_ID_PREFIX + registerName, registerIndex, [range, undefined]);
              return true;
          });
          this.view.instructionRangeHandler.forEachFixedRange(row, (registerIndex, row, registerName, ranges) => {
              this.addnewIntervalsInRange(currentGrid, newGrid, row, registerName, registerIndex, ranges);
              return true;
          });
      }
      addnewIntervalsInRange(currentGrid, newGrid, row, registerId, registerIndex, ranges) {
          const numReplacements = new Map();
          const getElementForEmptyPosition = (column) => {
              return currentGrid.getCell(row, column);
          };
          // Inserts new interval beside existing intervals.
          const callbackForInterval = (column, interval) => {
              // Overlapping intervals are placed beside each other and the relevant ones displayed.
              let currentInterval = currentGrid.getInterval(row, column);
              // The number of intervals already inserted is tracked so that the inserted intervals
              // are ordered correctly.
              const intervalsAlreadyInserted = numReplacements.get(currentInterval);
              numReplacements.set(currentInterval, intervalsAlreadyInserted
                  ? intervalsAlreadyInserted + 1 : 1);
              if (intervalsAlreadyInserted) {
                  for (let j = 0; j < intervalsAlreadyInserted; ++j) {
                      currentInterval = currentInterval.nextElementSibling;
                  }
              }
              interval.classList.add("range-hidden");
              currentInterval.insertAdjacentElement("afterend", interval);
          };
          this.view.rowConstructor.construct(newGrid, row, registerId, registerIndex, ranges, getElementForEmptyPosition, callbackForInterval);
      }
  }
  // Manages the limitation of how many instructions are shown in the grid.
  class InstructionRangeHandler {
      constructor(view, firstInstr, lastInstr) {
          this.view = view;
          this.showAllPositions = false;
          this.blockRange = [0, -1];
          this.instructionRange = this.getValidRange(firstInstr, lastInstr);
          if (this.instructionRange[0] == 0
              && this.instructionRange[1] == this.view.sequenceView.numInstructions) {
              this.showAllPositions = true;
          }
          this.updateInstructionRange();
      }
      isNewRangeViewRequired(firstInstr, lastInstr) {
          const validRange = this.getValidRange(firstInstr, lastInstr);
          return (this.instructionRange[0] != validRange[0])
              || (this.instructionRange[1] != validRange[1]);
      }
      getValidRange(firstInstr, lastInstr) {
          const maxInstructions = Math.floor(MAX_NUM_POSITIONS / POSITIONS_PER_INSTRUCTION);
          const validRange = [firstInstr, lastInstr + 1];
          if (isNaN(lastInstr)) {
              validRange[1] = this.view.sequenceView.numInstructions;
          }
          if (isNaN(firstInstr)) {
              validRange[0] = (isNaN(lastInstr) || validRange[1] < maxInstructions)
                  ? 0 : validRange[1] - maxInstructions;
          }
          if (!this.isValidRange(validRange[0], validRange[1])) {
              console.warn("Invalid range: displaying default view.");
              validRange[0] = 0;
              validRange[1] = this.view.sequenceView.numInstructions;
          }
          const rangeLength = validRange[1] - validRange[0];
          if (POSITIONS_PER_INSTRUCTION * rangeLength > MAX_NUM_POSITIONS) {
              validRange[1] = validRange[0] + maxInstructions;
              console.warn("Cannot display more than " + maxInstructions
                  + " instructions in the live ranges grid at one time.");
          }
          return validRange;
      }
      isValidRange(firstInstr, instrLimit) {
          return 0 <= firstInstr && firstInstr < instrLimit
              && instrLimit <= this.view.sequenceView.numInstructions;
      }
      updateInstructionRange() {
          this.numInstructions = this.showAllPositions
              ? this.view.sequenceView.numInstructions
              : this.instructionRange[1] - this.instructionRange[0];
          this.numPositions = this.numInstructions * POSITIONS_PER_INSTRUCTION;
          this.positionRange = [POSITIONS_PER_INSTRUCTION * this.instructionRange[0],
              POSITIONS_PER_INSTRUCTION * this.instructionRange[1]];
      }
      getInstructionRangeString() {
          if (this.showAllPositions) {
              return "all instructions";
          }
          else {
              return "instructions [" + this.instructionRange[0]
                  + ", " + (this.instructionRange[1] - 1) + "]";
          }
      }
      getLastPosition() {
          return this.positionRange[1] - 1;
      }
      getFirstPosition() {
          return this.positionRange[0];
      }
      getPositionFromIndex(index) {
          return index + this.positionRange[0];
      }
      getIndexFromPosition(position) {
          return position - this.positionRange[0];
      }
      getInstructionIdFromIndex(index) {
          return index + this.instructionRange[0];
      }
      getInstructionIndex(id) {
          return id - this.instructionRange[0];
      }
      getBlockIdFromIndex(index) {
          return index + this.blockRange[0];
      }
      getBlockIndex(id) {
          return id - this.blockRange[0];
      }
      isPositionInRange(position) {
          return position >= this.positionRange[0] && position < this.positionRange[1];
      }
      isIntervalInRange(interval) {
          return interval.start < this.positionRange[1] && interval.end > this.positionRange[0];
      }
      convertIntervalPositionsToIndexes(interval) {
          return new Interval([Math.max(0, interval.start - this.positionRange[0]),
              Math.min(this.numPositions, interval.end - this.positionRange[0])]);
      }
      convertBlockPositionsToIndexes(blockIndex, interval) {
          if (this.blockRange[1] < 0)
              this.blockRange[0] = blockIndex;
          this.blockRange[1] = blockIndex + 1;
          return this.convertIntervalPositionsToIndexes(interval);
      }
      isLastPosition(position) {
          return !this.showAllPositions && (position == this.getLastPosition());
      }
      isLastInstruction(instrId) {
          return !this.showAllPositions && (instrId == this.instructionRange[1] - 1);
      }
      forEachLiveRange(row, callback) {
          const source = this.view.sequenceView.sequence.registerAllocation;
          for (const [registerIndex, range] of source.liveRanges.entries()) {
              if (!range ||
                  (!this.showAllPositions &&
                      (range.instructionRange[0] >= this.positionRange[1]
                          || this.positionRange[0] >= range.instructionRange[1]))) {
                  continue;
              }
              if (callback(registerIndex, row, `v${registerIndex}`, range)) {
                  ++row;
              }
          }
          return row;
      }
      forEachFixedRange(row, callback) {
          const forEachRangeInMap = (rangeMap) => {
              // There are two fixed live ranges for each register, one for normal, another for deferred.
              // These are combined into a single row.
              const fixedRegisterMap = new Map();
              for (const [registerIndex, range] of rangeMap.entries()) {
                  if (!range ||
                      (!this.showAllPositions &&
                          (range.instructionRange[0] >= this.positionRange[1]
                              || this.positionRange[0] >= range.instructionRange[1]))) {
                      continue;
                  }
                  const registerName = range.fixedRegisterName();
                  if (fixedRegisterMap.has(registerName)) {
                      const entry = fixedRegisterMap.get(registerName);
                      entry.ranges[1] = range;
                      // Only use the deferred register index if no normal index exists.
                      if (!range.isDeferred) {
                          entry.registerIndex = registerIndex;
                      }
                  }
                  else {
                      fixedRegisterMap.set(registerName, { registerIndex, ranges: [range, undefined] });
                  }
              }
              // Sort the registers by number.
              const sortedMap = new Map([...fixedRegisterMap.entries()].sort(([nameA, _], [nameB, __]) => {
                  if (nameA.length > nameB.length) {
                      return 1;
                  }
                  else if (nameA.length < nameB.length) {
                      return -1;
                  }
                  else if (nameA > nameB) {
                      return 1;
                  }
                  else if (nameA < nameB) {
                      return -1;
                  }
                  return 0;
              }));
              for (const [registerName, { ranges, registerIndex }] of sortedMap) {
                  if (callback(-registerIndex - 1, row, registerName, ranges)) {
                      ++row;
                  }
              }
          };
          const source = this.view.sequenceView.sequence.registerAllocation;
          forEachRangeInMap(source.fixedLiveRanges);
          forEachRangeInMap(source.fixedDoubleLiveRanges);
          return row;
      }
  }
  // This class tracks what element is selected and scrolls it into view.
  class FocusHandler {
      constructor(rangeView) {
          this.rangeView = rangeView;
          this.virtualRegisterToRowMap = new Map();
          this.elementInFocus = undefined;
          this.isBackgroundInFocus = false;
          this.coordsInFocus = [-1, -1];
      }
      getHeaderElement(row, index) {
          return this.rangeView.divs.positionHeaders.children[RANGES_NUM_POS_HEADER_ROWS + row]
              .children[index];
      }
      moveFocusTo(element, eventInitDict) {
          if (element !== undefined) {
              element.scrollIntoView({ block: 'nearest' });
          }
          else if (this.isBackgroundInFocus) ;
      }
      isInFocus(element) {
          return this.elementInFocus == element;
      }
      setFocus(element, row, column, isBackground) {
          this.clear();
          this.coordsInFocus[0] = row;
          this.coordsInFocus[1] = column;
          if (element !== undefined) {
              element.classList.toggle("focused", true);
          }
          this.elementInFocus = element;
          this.isBackgroundInFocus = isBackground;
          if (isBackground) {
              this.rangeView.gridAccessor.currentGrid().updateBackgroundFocusPoint(row, column);
          }
      }
      setFocusVirtualRegister(register) {
          const row = this.virtualRegisterToRowMap.get(register);
          if (row)
              this.moveFocusTo(this.rangeView.divs.registers.children[row]);
      }
      clear() {
          if (this.elementInFocus) {
              this.elementInFocus.classList.toggle("focused", false);
              this.elementInFocus = undefined;
          }
          const curGrid = this.rangeView.gridAccessor.currentGrid();
          if (curGrid !== undefined) {
              curGrid.clearBackgroundFocusPoint();
              curGrid.updateBackground(this.rangeView, this.rangeView.divs.grid.scrollTop, this.rangeView.divs.grid.scrollLeft);
              this.isBackgroundInFocus = false;
          }
      }
      clearCoordsInFocus() {
          this.coordsInFocus[0] = -1;
          this.coordsInFocus[1] = -1;
      }
      resetFocus() {
          this.clear();
          // Restore focus if saved.
          if (this.coordsInFocus[0] >= 0 || this.coordsInFocus[1] >= 0) {
              this.moveFocusTo(this.rangeView.gridAccessor.getCell(this.coordsInFocus[0], this.coordsInFocus[1]));
          }
      }
      select(instructionIds, selected, scrollIntoView) { }
      brokeredClear() {
          this.clear();
      }
      brokeredRegisterAllocationSelect(instructionsOffsets, selected) {
          if (!selected)
              return;
          for (const offsetPair of instructionsOffsets) {
              for (const offset of offsetPair) {
                  const instr = this.getHeaderElement(RANGES_INSTR_GRID_ROW, this.rangeView.instructionRangeHandler.getInstructionIndex(offset));
                  if (instr)
                      this.moveFocusTo(instr, { shiftKey: true });
              }
          }
      }
      brokeredBlockSelect(blockIds, selected) {
          if (!selected)
              return;
          for (const id of blockIds) {
              const block = this.getHeaderElement(RANGES_BLOCK_GRID_ROW, this.rangeView.instructionRangeHandler.getBlockIndex(id));
              if (block)
                  this.moveFocusTo(block, { shiftKey: true });
          }
      }
  }
  // This class works in tandem with the selectionHandlers defined in text-view.ts
  // rather than updating HTMLElements explicitly itself.
  class RangeViewSelectionHandler {
      constructor(rangeView) {
          this.rangeView = rangeView;
          this.sequenceView = this.rangeView.sequenceView;
          this.rowToRegisterId = new Map();
          this.positionToBlockId = new Map();
          // Clear all selections when container is clicked.
          this.rangeView.divs.container.onclick = (e) => {
              if (!e.shiftKey)
                  this.sequenceView.broker.broadcastClear(null);
              this.rangeView.focusHandler.clearCoordsInFocus();
          };
      }
      addBlock(element, id, firstColumn) {
          element.onclick = (e) => {
              e.stopPropagation();
              if (!e.shiftKey) {
                  this.clear();
              }
              this.select(null, null, [id], true);
              this.rangeView.focusHandler.setFocus(element, RANGES_BLOCK_GRID_ROW, firstColumn);
          };
          this.sequenceView.addHtmlElementForBlockId(id, element);
          this.sequenceView.addHtmlElementForBlockId(this.sequenceView.getSubId(id), element);
      }
      addInstruction(element, id, index, blockId) {
          // Select the block which contains the instruction and all positions and cells
          // that are within this instruction.=
          element.onclick = (e) => {
              e.stopPropagation();
              if (!e.shiftKey) {
                  this.clear();
              }
              this.select(null, [id], [this.sequenceView.getSubId(blockId)], true);
              this.rangeView.focusHandler.setFocus(element, RANGES_INSTR_GRID_ROW, POSITIONS_PER_INSTRUCTION * index);
          };
          this.sequenceView.addHtmlElementForBlockId(blockId, element);
          this.sequenceView.addHtmlElementForInstructionId(id, element);
          this.sequenceView.addHtmlElementForInstructionId(this.sequenceView.getSubId(id), element);
      }
      addPosition(element, position, blockId) {
          const instrId = Math.floor(position / POSITIONS_PER_INSTRUCTION);
          const column = this.rangeView.instructionRangeHandler.getIndexFromPosition(position);
          // Select the block and instruction which contains this position.
          element.onclick = (e) => {
              e.stopPropagation();
              if (!e.shiftKey) {
                  this.clear();
              }
              this.select(["position-" + position], [this.sequenceView.getSubId(instrId)], [this.sequenceView.getSubId(blockId)], true);
              this.rangeView.focusHandler.setFocus(element, RANGES_POS_GRID_ROW, column);
          };
          this.sequenceView.addHtmlElementForBlockId(blockId, element);
          this.sequenceView.addHtmlElementForInstructionId(instrId, element);
          this.sequenceView.addHtmlElementForNodeId("position-" + position, element);
          this.positionToBlockId.set(position, blockId);
      }
      addRegister(element, registerId, row) {
          const rowGroupIndex = (Math.floor(row / ROW_GROUP_SIZE) * 2) + 1;
          element.onclick = (e) => {
              e.stopPropagation();
              if (!this.canSelectRow(element, row, rowGroupIndex))
                  return;
              if (!e.shiftKey) {
                  this.clear();
              }
              // The register also effectively selects the row.
              this.select([registerId], null, null, true);
              this.rangeView.focusHandler.setFocus(element, row, RANGES_POS_GRID_ROW);
          };
          this.sequenceView.addHtmlElementForNodeId(registerId, element);
          this.rowToRegisterId.set(row, registerId);
      }
      addRow(element, registerId) {
          // Highlight row when register is selected.
          this.rangeView.sequenceView.addHtmlElementForNodeId(registerId, element);
      }
      addInterval(intervalEl, intervalInnerWrapperEl, intervalNodeId, registerId) {
          // Highlight interval when the interval is selected.
          this.sequenceView.addHtmlElementForNodeId(intervalNodeId, intervalEl);
          // Highlight inner wrapper when row is selected, allowing for different color highlighting.
          this.sequenceView.addHtmlElementForNodeId(registerId, intervalInnerWrapperEl);
      }
      addCell(element, row, position, blockId, registerId, intervalNodeId, isEmptyCell) {
          const instrId = Math.floor(position / POSITIONS_PER_INSTRUCTION);
          const column = this.rangeView.instructionRangeHandler.getIndexFromPosition(position);
          // Select the relevant row by the registerId, and the column by position.
          // Also select the instruction and the block in which the position is in.
          const select = [registerId, "position-" + position];
          if (intervalNodeId)
              select.push(intervalNodeId);
          const rowGroupIndex = (Math.floor(row / ROW_GROUP_SIZE) * 2) + 1;
          element.onclick = (e) => {
              e.stopPropagation();
              if (!this.canSelectRow(element, row, rowGroupIndex))
                  return;
              if (!e.shiftKey) {
                  this.clear();
              }
              this.select(select, [this.sequenceView.getSubId(instrId)], [this.sequenceView.getSubId(blockId)], true);
              this.rangeView.focusHandler.setFocus(element, row, column);
          };
          if (!isEmptyCell) {
              this.sequenceView.addHtmlElementForBlockId(blockId, element);
              this.sequenceView.addHtmlElementForInstructionId(instrId, element);
              this.sequenceView.addHtmlElementForNodeId("position-" + position, element);
          }
      }
      addBackground(background) {
          background.onclick = (e) => {
              if (this.rangeView.divs.grid === undefined)
                  return;
              if (this.rangeView.divs.registers === undefined)
                  return;
              if (this.rangeView.divs.positionHeaders === null)
                  return;
              const gridBoundRect = this.rangeView.divs.grid.getBoundingClientRect();
              const clickLeft = e.clientX - gridBoundRect.left + this.rangeView.divs.grid.scrollLeft;
              const clickTop = e.clientY - gridBoundRect.top + this.rangeView.divs.grid.scrollTop;
              const rangePosCellSize = this.rangeView.divs.getRangePositionCellSize();
              const rangeRegCellSize = this.rangeView.divs.getRangeRegCellSize();
              const firstPosition = this.rangeView.instructionRangeHandler.getFirstPosition();
              let row = -1;
              let column = -1;
              if (this.rangeView.userSettings.get("flipped")) {
                  row = Math.floor(clickLeft / rangeRegCellSize[0]);
                  column = Math.floor(clickTop / rangePosCellSize[1]) + firstPosition;
              }
              else {
                  row = Math.floor(clickTop / rangeRegCellSize[1]);
                  column = Math.floor(clickLeft / rangePosCellSize[0]) + firstPosition;
              }
              if (!this.rowToRegisterId.has(row))
                  return;
              const registerId = this.rowToRegisterId.get(row);
              const positionId = "position-" + column;
              e.stopPropagation();
              if (!e.shiftKey) {
                  this.clear();
              }
              this.rangeView.focusHandler.setFocus(undefined, row, column, true);
              const instrId = Math.floor(column / POSITIONS_PER_INSTRUCTION);
              const blockId = this.positionToBlockId.get(column);
              this.select([registerId, positionId], [this.sequenceView.getSubId(instrId)], [this.sequenceView.getSubId(blockId)], true);
          };
      }
      updateBackground() {
          this.rangeView.gridAccessor.currentGrid().updateBackground(this.rangeView, this.rangeView.divs.grid.scrollTop, this.rangeView.divs.grid.scrollLeft);
      }
      canSelectRow(element, row, rowGroupIndex) {
          // No need to repeat work if already in focus.
          if (this.rangeView.focusHandler.isInFocus(element))
              return false;
          // Don't select anything if the row group which this row is included in is hidden.
          if (row >= 0
              && this.rangeView.divs.grid.children[rowGroupIndex].classList.contains("range-hidden")) {
              this.rangeView.scrollHandler.syncHidden();
              return false;
          }
          return true;
      }
      // Don't call multiple times in a row or the SelectionMapsHandlers will clear their previous
      // causing the HTMLElements to not be deselected by select.
      clear() {
          this.rangeView.focusHandler.clear();
          this.sequenceView.blockSelections.clearCurrent();
          this.sequenceView.instructionSelections.clearCurrent();
          this.sequenceView.nodeSelections.clearCurrent();
          // Mark as cleared so that the HTMLElements are not updated on broadcastClear.
          // The HTMLElements will be updated when select is called.
          this.sequenceView.selectionCleared = true;
          // broadcastClear calls brokeredClear on all SelectionHandlers but that which is passed to it.
          this.sequenceView.broker.broadcastClear(this.sequenceView.nodeSelectionHandler);
          this.sequenceView.selectionCleared = false;
      }
      select(nodeIds, instrIds, blockIds, selected) {
          // Add nodeIds and blockIds to selections.
          if (nodeIds)
              this.sequenceView.nodeSelections.current.select(nodeIds, selected);
          if (instrIds)
              this.sequenceView.instructionSelections.current.select(instrIds, selected);
          if (blockIds)
              this.sequenceView.blockSelections.current.select(blockIds, selected);
          // Update the HTMLElements.
          this.sequenceView.updateSelection(true);
          if (nodeIds) {
              // Broadcast selections to other SelectionHandlers.
              this.sequenceView.broker.broadcastNodeSelect(this.sequenceView.nodeSelectionHandler, this.sequenceView.nodeSelections.current.selectedKeys(), selected);
          }
          if (instrIds) {
              this.sequenceView.broker.broadcastInstructionSelect(this.sequenceView.registerAllocationSelectionHandler, Array.from(this.sequenceView.instructionSelections.current.selectedKeysAsAbsNumbers()), selected);
          }
      }
  }
  class DisplayResetter {
      constructor(view) {
          this.view = view;
      }
      // Allow much of the changes required to be done in the css.
      updateClassesOnContainer() {
          this.isFlipped = this.view.userSettings.get("flipped");
          this.view.divs.container.classList.toggle("not_flipped", !this.isFlipped);
          this.view.divs.container.classList.toggle("flipped", this.isFlipped);
      }
      resetLandscapeMode(isInLandscapeMode) {
          // Used to communicate the setting to Resizer.
          this.view.divs.container.dataset.landscapeMode =
              isInLandscapeMode.toString();
          window.dispatchEvent(new Event('resize'));
          // Required to adjust scrollbar spacing.
          setTimeout(() => {
              window.dispatchEvent(new Event('resize'));
          }, 100);
      }
      resetFlipped() {
          this.updateClassesOnContainer();
          // Appending the HTMLElement removes it from its current position.
          this.view.divs.wholeHeader.appendChild(this.isFlipped ? this.view.divs.registerHeaders
              : this.view.divs.positionHeaders);
          this.view.divs.yAxis.appendChild(this.isFlipped ? this.view.divs.positionHeaders
              : this.view.divs.registerHeaders);
          this.resetLayout();
          // Set the label text appropriately.
          this.view.divs.xAxisLabel.innerText = this.isFlipped
              ? this.view.divs.xAxisLabel.dataset.flipped
              : this.view.divs.xAxisLabel.dataset.notFlipped;
          this.view.divs.yAxisLabel.innerText = this.isFlipped
              ? this.view.divs.yAxisLabel.dataset.flipped
              : this.view.divs.yAxisLabel.dataset.notFlipped;
          this.view.focusHandler.resetFocus();
      }
      resetLayout() {
          this.resetRegisters();
          this.resetIntervals();
      }
      resetRegisters() {
          // Reset register strings.
          for (const regNode of this.view.divs.registers.childNodes) {
              const regEl = regNode;
              const registerName = regEl.getAttribute("title");
              this.view.stringConstructor.setRegisterString(registerName, regEl.dataset.virtual == "true", regEl);
          }
          // registerTypeHeader is only displayed when the axes are switched.
          this.view.divs.registersTypeHeader.classList.toggle("range-hidden", !this.isFlipped);
          if (this.isFlipped) {
              for (const typeHeader of this.view.divs.registersTypeHeader.children) {
                  const element = typeHeader;
                  const regCount = parseInt(element.dataset.count, 10);
                  const spaceAvailable = regCount * Math.floor(this.view.cssVariables.positionWidth);
                  // The more space available the longer the header text can be.
                  if (spaceAvailable > element.dataset.max.length) {
                      element.innerText = element.dataset.max;
                  }
                  else if (spaceAvailable > element.dataset.med.length) {
                      element.innerText = element.dataset.med;
                  }
                  else {
                      element.innerText = element.dataset.min;
                  }
              }
          }
      }
      resetIntervals() {
          this.view.intervalsAccessor.forEachInterval((_, interval) => {
              const intervalEl = interval;
              const spanEl = intervalEl.children[0];
              const spanElBehind = intervalEl.children[1];
              const intervalLength = this.view.getInnerWrapperFromInterval(interval).children.length;
              this.view.stringConstructor.setIntervalString(spanEl, spanElBehind, intervalEl.dataset.tooltip, intervalLength);
              const intervalInnerWrapper = intervalEl.children[2];
              intervalInnerWrapper.style.gridTemplateColumns =
                  this.view.rowConstructor.getGridTemplateColumnsValueForInterval(intervalLength);
          });
      }
  }
  var ToSync;
  (function (ToSync) {
      ToSync[ToSync["LEFT"] = 0] = "LEFT";
      ToSync[ToSync["TOP"] = 1] = "TOP";
  })(ToSync || (ToSync = {}));
  // Handles saving and syncing the scroll positions of the grid.
  class ScrollHandler {
      constructor(view) {
          this.view = view;
          this.scrollTop = 0;
          this.scrollLeft = 0;
      }
      // This function is used to hide the rows which are not currently in view and
      // so reduce the performance cost of things like hit tests and scrolling.
      syncHidden() {
          const isFlipped = this.view.userSettings.get("flipped");
          const toHide = new Array();
          const sampleCell = this.view.divs.registers.children[1];
          const buffer = 2 * (isFlipped ? sampleCell.clientWidth : sampleCell.clientHeight);
          const min = (isFlipped ? this.view.divs.grid.offsetLeft + this.view.divs.grid.scrollLeft
              : this.view.divs.grid.offsetTop + this.view.divs.grid.scrollTop)
              - buffer;
          const max = (isFlipped ? min + this.view.divs.grid.clientWidth
              : min + this.view.divs.grid.clientHeight)
              + buffer;
          // The rows are grouped by being contained within a group div. This is so as to allow
          // groups of rows to easily be displayed and hidden with less of a performance cost.
          // Each row in the mainGroup div is matched with an equivalent placeholder row in
          // the placeholderGroup div that will be shown when mainGroup is hidden so as to maintain
          // the dimensions and scroll positions of the grid.
          const rangeGroups = this.view.divs.grid.children;
          for (let i = 1; i < rangeGroups.length; i += 2) {
              const mainGroup = rangeGroups[i];
              const placeholderGroup = rangeGroups[i - 1];
              const isHidden = mainGroup.classList.contains("range-hidden");
              // The offsets are used to calculate whether the group is in view.
              const offsetMin = this.getOffset(mainGroup.firstChild, placeholderGroup.firstChild, isHidden, isFlipped);
              const offsetMax = this.getOffset(mainGroup.lastChild, placeholderGroup.lastChild, isHidden, isFlipped);
              if (offsetMax > min && offsetMin < max) {
                  if (isHidden) {
                      // Show the rows, hide the placeholders.
                      mainGroup.classList.toggle("range-hidden", false);
                      placeholderGroup.classList.toggle("range-hidden", true);
                  }
              }
              else if (!isHidden) {
                  // Only hide the rows once the new rows are shown so that scrollLeft is not lost.
                  toHide.push([mainGroup, placeholderGroup]);
              }
          }
          for (const [mainGroup, placeholderGroup] of toHide) {
              // Hide the rows, show the placeholders.
              mainGroup.classList.toggle("range-hidden", true);
              placeholderGroup.classList.toggle("range-hidden", false);
          }
      }
      // This function is required to keep the axes labels in line with the grid
      // content when scrolling.
      syncScroll(toSync, source, target) {
          // Continually delay timeout until scrolling has stopped.
          toSync == ToSync.TOP
              ? clearTimeout(this.scrollTopTimeout)
              : clearTimeout(this.scrollLeftTimeout);
          if (target.onscroll) {
              if (toSync == ToSync.TOP) {
                  this.scrollTopFunc = target.onscroll;
              }
              else {
                  this.scrollLeftFunc = target.onscroll;
              }
          }
          // Clear onscroll to prevent the target syncing back with the source.
          target.onscroll = null;
          if (toSync == ToSync.TOP) {
              target.scrollTop = source.scrollTop;
          }
          else {
              target.scrollLeft = source.scrollLeft;
          }
          // Only show / hide the grid content once scrolling has stopped.
          if (toSync == ToSync.TOP) {
              this.scrollTopTimeout = setTimeout(() => {
                  target.onscroll = this.scrollTopFunc;
                  this.syncHidden();
              }, 100);
          }
          else {
              this.scrollLeftTimeout = setTimeout(() => {
                  target.onscroll = this.scrollLeftFunc;
                  this.syncHidden();
              }, 100);
          }
          // Update background cell.
          const currentGrid = this.view.gridAccessor.currentGrid();
          const gridScrollTop = this.view.divs.grid.scrollTop;
          const gridScrollLeft = this.view.divs.grid.scrollLeft;
          if (currentGrid !== undefined && (currentGrid.backgroundScrollLeft != gridScrollLeft ||
              currentGrid.backgroundScrollTop != gridScrollTop)) {
              currentGrid.updateBackground(this.view, gridScrollTop, gridScrollLeft);
          }
      }
      saveScroll() {
          this.scrollLeft = this.view.divs.grid.scrollLeft;
          this.scrollTop = this.view.divs.grid.scrollTop;
      }
      restoreScroll() {
          if (this.scrollLeft) {
              this.view.divs.grid.scrollLeft = this.scrollLeft;
              this.view.divs.grid.scrollTop = this.scrollTop;
          }
      }
      getOffset(rowEl, placeholderRowEl, isHidden, isFlipped) {
          const element = isHidden ? placeholderRowEl : rowEl;
          return isFlipped ? element.offsetLeft : element.offsetTop;
      }
  }
  // RangeView displays the live range data as passed in by SequenceView.
  // The data is displayed in a grid format, with the fixed and virtual registers
  // along one axis, and the LifeTimePositions along the other. Each LifeTimePosition
  // is part of an Instruction in SequenceView, which itself is part of an Instruction
  // Block. The live ranges are displayed as intervals, each belonging to a register,
  // and spanning across a certain range of LifeTimePositions.
  // When the phase being displayed changes between before register allocation and
  // after register allocation, only the intervals need to be changed.
  class RangeView {
      constructor(sequence, firstInstr, lastInstr) {
          this.sequenceView = sequence;
          this.initialized = false;
          this.isShown = false;
          this.instructionRangeHandler = new InstructionRangeHandler(this, firstInstr, lastInstr);
      }
      initializeContent(blocks, broker) {
          if (!this.initialized) {
              this.gridAccessor = new GridAccessor(this.sequenceView);
              this.intervalsAccessor = new IntervalElementsAccessor(this.sequenceView);
              this.cssVariables = new CSSVariables();
              this.userSettings = new UserSettings();
              this.displayResetter = new DisplayResetter(this);
              // Indicates whether the RangeView is displayed beside or below the SequenceView.
              this.userSettings.addSetting("landscapeMode", false, this.displayResetter.resetLandscapeMode.bind(this.displayResetter));
              // Indicates whether the grid axes are switched.
              this.userSettings.addSetting("flipped", false, this.displayResetter.resetFlipped.bind(this.displayResetter));
              this.blocksData = new BlocksData(this, blocks);
              this.divs = new Divs(this.userSettings, this.instructionRangeHandler.getInstructionRangeString());
              this.displayResetter.updateClassesOnContainer();
              this.scrollHandler = new ScrollHandler(this);
              this.rowConstructor = new RowConstructor(this);
              this.stringConstructor = new StringConstructor(this);
              this.selectionHandler = new RangeViewSelectionHandler(this);
              this.sequenceView.setRangeViewSelectionHandler(this.selectionHandler);
              this.focusHandler = new FocusHandler(this);
              broker.addBlockHandler(this.focusHandler);
              broker.addRegisterAllocatorHandler(this.focusHandler);
              const constructor = new RangeViewConstructor(this);
              constructor.construct();
              this.cssVariables.setVariables(this.instructionRangeHandler.numPositions, this.divs.registers.children.length);
              this.phaseChangeHandler = new PhaseChangeHandler(this);
              let maxVirtualRegisterNumber = 0;
              for (const register of this.focusHandler.virtualRegisterToRowMap.keys()) {
                  maxVirtualRegisterNumber = Math.max(maxVirtualRegisterNumber, register);
              }
              this.maxLengthVirtualRegisterNumber = Math.floor(Math.log10(maxVirtualRegisterNumber)) + 1;
              this.initialized = true;
          }
          else {
              // If the RangeView has already been initialized then the phase must have
              // been changed.
              this.phaseChangeHandler.phaseChange();
          }
      }
      show() {
          if (!this.isShown) {
              this.isShown = true;
              this.divs.container.appendChild(this.divs.content);
              this.divs.resizerBar.style.visibility = "visible";
              this.divs.container.style.visibility = "visible";
              this.divs.snapper.style.visibility = "visible";
              // Dispatch a resize event to ensure that the
              // panel is shown.
              window.dispatchEvent(new Event("resize"));
              if (this.divs.registers.children.length) {
                  setTimeout(() => {
                      this.userSettings.resetFromSessionStorage();
                      this.focusHandler.resetFocus();
                      this.scrollHandler.restoreScroll();
                      this.scrollHandler.syncHidden();
                      this.selectionHandler.updateBackground();
                      this.divs.showOnLoad.style.visibility = "visible";
                  }, 100);
              }
          }
      }
      hide() {
          if (this.initialized) {
              this.isShown = false;
              this.divs.container.removeChild(this.divs.content);
              this.divs.resizerBar.style.visibility = "hidden";
              this.divs.container.style.visibility = "hidden";
              this.divs.snapper.style.visibility = "hidden";
              this.divs.showOnLoad.style.visibility = "hidden";
          }
          else {
              window.document.getElementById(RANGES_PANE_ID).style.visibility = "hidden";
          }
          // Dispatch a resize event to ensure that the
          // panel is hidden.
          window.dispatchEvent(new Event("resize"));
      }
      onresize() {
          if (this.divs.registers.children.length && this.isShown) {
              this.scrollHandler.syncHidden();
              this.selectionHandler.updateBackground();
          }
      }
      getInnerWrapperFromInterval(interval) {
          return interval.children[2];
      }
  }

  // Copyright 2018 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  class SequenceView extends TextView {
      constructor(parent, broker) {
          super(parent, broker);
          this.numInstructions = 0;
          this.phaseIndexes = new Set();
          this.isShown = false;
          this.showRangeView = false;
          this.toggleRangeViewEl = this.elementForToggleRangeView();
      }
      createViewElement() {
          const pane = document.createElement("div");
          pane.setAttribute("id", SEQUENCE_PANE_ID);
          pane.classList.add("scrollable");
          pane.setAttribute("tabindex", "0");
          return pane;
      }
      detachSelection() {
          return new SelectionStorage(this.nodeSelections.current.detachSelection(), this.blockSelections.current.detachSelection(), this.instructionSelections.current.detachSelection());
      }
      adaptSelection(selection) {
          for (const key of selection.nodes.keys())
              selection.adaptedNodes.add(key);
          for (const key of selection.blocks.keys())
              selection.adaptedBocks.add(key);
          for (const key of selection.instructions.keys())
              selection.adaptedInstructions.add(Number(key));
          return selection;
      }
      show() {
          this.currentPhaseIndex = this.phaseSelectEl.selectedIndex;
          if (!this.isShown) {
              this.isShown = true;
              this.phaseIndexes.add(this.currentPhaseIndex);
              this.container.appendChild(this.divNode);
              this.container.getElementsByClassName("graph-toolbox")[0].appendChild(this.toggleRangeViewEl);
          }
          if (this.showRangeView)
              this.rangeView.show();
      }
      hide() {
          // A single SequenceView object is used for two phases (i.e before and after
          // register allocation), tracking the indexes lets the redundant hides and
          // shows be avoided when switching between the two.
          this.currentPhaseIndex = this.phaseSelectEl.selectedIndex;
          if (!this.phaseIndexes.has(this.currentPhaseIndex)) {
              this.isShown = false;
              this.container.removeChild(this.divNode);
              this.container.getElementsByClassName("graph-toolbox")[0].removeChild(this.toggleRangeViewEl);
              if (this.showRangeView)
                  this.rangeView.hide();
          }
      }
      onresize() {
          if (this.showRangeView)
              this.rangeView.onresize();
      }
      initializeContent(sequence, rememberedSelection) {
          this.divNode.innerHTML = "";
          const view = this;
          this.divNode.onclick = (e) => {
              if (view.showRangeView)
                  view.rangeView.focusHandler.clearCoordsInFocus();
          };
          this.sequence = sequence;
          this.searchInfo = new Array();
          this.phaseSelectEl = document.getElementById("phase-select");
          this.currentPhaseIndex = this.phaseSelectEl.selectedIndex;
          this.addBlocks(this.sequence.blocks);
          this.numInstructions = this.sequence.getNumInstructions();
          this.addRangeView();
          this.show();
          if (rememberedSelection) {
              const adaptedSelection = this.adaptSelection(rememberedSelection);
              if (adaptedSelection.isAdapted())
                  this.attachSelection(adaptedSelection);
          }
      }
      searchInputAction(searchBar, e) {
          e.stopPropagation();
          this.nodeSelectionHandler.clear();
          const query = searchBar.value;
          if (query.length == 0)
              return;
          const select = new Array();
          storageSetItem("lastSearch", query);
          const reg = new RegExp(query);
          for (const item of this.searchInfo) {
              if (reg.exec(item) != null) {
                  select.push(item);
              }
          }
          this.nodeSelectionHandler.select(select, true, false);
      }
      attachSelection(adaptedSelection) {
          if (!(adaptedSelection instanceof SelectionStorage))
              return;
          this.blockSelectionHandler.clear();
          this.nodeSelectionHandler.clear();
          this.registerAllocationSelectionHandler.clear();
          this.blockSelectionHandler.select(Array.from(adaptedSelection.adaptedBocks).map(block => Number(block)), true, true);
          this.nodeSelectionHandler.select(adaptedSelection.adaptedNodes, true, true);
          this.registerAllocationSelectionHandler.select(Array.from(adaptedSelection.adaptedInstructions), true, true);
      }
      addBlocks(blocks) {
          for (const block of blocks) {
              const blockEl = this.elementForBlock(block);
              this.divNode.appendChild(blockEl);
          }
      }
      elementForBlock(block) {
          const sequenceBlock = createElement("div", "schedule-block");
          sequenceBlock.classList.toggle("deferred", block.deferred);
          const blockIdEl = createElement("div", "block-id com clickable", String(block.id));
          // Select just the block id when any of the block's instructions or positions
          // are selected.
          this.addHtmlElementForBlockId(this.getSubId(block.id), blockIdEl);
          blockIdEl.onclick = this.mkBlockLinkHandler(block.id);
          sequenceBlock.appendChild(blockIdEl);
          const blockPred = createElement("div", "predecessor-list block-list comma-sep-list");
          for (const pred of block.predecessors) {
              const predEl = createElement("div", "block-id com clickable", String(pred));
              predEl.onclick = this.mkBlockLinkHandler(pred);
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
              const outputEl = this.elementForOperand(phi.output);
              phiEl.appendChild(outputEl);
              const assignEl = createElement("div", "assign", "=");
              phiEl.appendChild(assignEl);
              for (const input of phi.operands) {
                  const inputEl = this.elementForPhiOperand(input);
                  phiEl.appendChild(inputEl);
              }
          }
          const instructions = createElement("div", "instructions");
          for (const instruction of block.instructions) {
              instructions.appendChild(this.elementForInstruction(instruction));
          }
          sequenceBlock.appendChild(instructions);
          const blockSucc = createElement("div", "successor-list block-list comma-sep-list");
          for (const succ of block.successors) {
              const succEl = createElement("div", "block-id com clickable", String(succ));
              succEl.onclick = this.mkBlockLinkHandler(succ);
              blockSucc.appendChild(succEl);
          }
          if (block.successors.length > 0)
              sequenceBlock.appendChild(blockSucc);
          this.addHtmlElementForBlockId(block.id, sequenceBlock);
          return sequenceBlock;
      }
      elementForOperand(operand) {
          let isVirtual = false;
          let className = `parameter tag clickable ${operand.type}`;
          if (operand.text[0] === "v" && !(operand.tooltip && operand.tooltip.includes("Float"))) {
              isVirtual = true;
              className += " virtual-reg";
          }
          const span = createElement("span", className, operand.text);
          if (operand.tooltip) {
              span.setAttribute("title", operand.tooltip);
          }
          return this.elementForOperandWithSpan(span, operand.text, isVirtual);
      }
      elementForPhiOperand(text) {
          const span = createElement("span", "parameter tag clickable virtual-reg", text);
          return this.elementForOperandWithSpan(span, text, true);
      }
      elementForOperandWithSpan(span, text, isVirtual) {
          const selectionText = isVirtual ? `virt_${text}` : text;
          const onclick = this.mkOperandLinkHandler(selectionText);
          const view = this;
          if (isVirtual) {
              const row = parseInt(text.substring(1), 10);
              span.onclick = function (e) {
                  onclick(e);
                  if (view.showRangeView)
                      view.rangeView.focusHandler.setFocusVirtualRegister(row);
              };
          }
          else {
              span.onclick = onclick;
          }
          this.searchInfo.push(text);
          this.addHtmlElementForNodeId(selectionText, span);
          const container = createElement("div", "");
          container.appendChild(span);
          return container;
      }
      elementForInstruction(instruction) {
          const instNodeEl = createElement("div", "instruction-node");
          const instId = createElement("div", "instruction-id", String(instruction.id));
          const offsets = this.sourceResolver.instructionsPhase.instructionToPcOffsets(instruction.id);
          instId.classList.add("clickable");
          // Select instruction id for both when the instruction is selected and when any of its
          // positions are selected.
          this.addHtmlElementForInstructionId(instruction.id, instId);
          this.addHtmlElementForInstructionId(this.getSubId(instruction.id), instId);
          instId.onclick = this.mkInstructionLinkHandler(instruction.id);
          instId.dataset.instructionId = String(instruction.id);
          if (offsets) {
              instId.setAttribute("title", `This instruction generated gap code at pc-offset 0x${offsets.gap.toString(16)}, code at pc-offset 0x${offsets.arch.toString(16)}, condition handling at pc-offset 0x${offsets.condition.toString(16)}.`);
          }
          instNodeEl.appendChild(instId);
          const instContentsEl = createElement("div", "instruction-contents");
          instNodeEl.appendChild(instContentsEl);
          // Print gap moves.
          const gapEl = createElement("div", "gap", "gap");
          let hasGaps = false;
          for (const gap of instruction.gaps) {
              const moves = createElement("div", "comma-sep-list gap-move");
              for (const [destination, source] of gap) {
                  hasGaps = true;
                  const moveEl = createElement("div", "move");
                  const destinationEl = this.elementForOperand(destination);
                  moveEl.appendChild(destinationEl);
                  const assignEl = createElement("div", "assign", "=");
                  moveEl.appendChild(assignEl);
                  const sourceEl = this.elementForOperand(source);
                  moveEl.appendChild(sourceEl);
                  moves.appendChild(moveEl);
              }
              gapEl.appendChild(moves);
          }
          if (hasGaps) {
              instContentsEl.appendChild(gapEl);
          }
          const instEl = createElement("div", "instruction");
          instContentsEl.appendChild(instEl);
          if (instruction.outputs.length > 0) {
              const outputs = createElement("div", "comma-sep-list input-output-list");
              for (const output of instruction.outputs) {
                  const outputEl = this.elementForOperand(output);
                  outputs.appendChild(outputEl);
              }
              instEl.appendChild(outputs);
              const assignEl = createElement("div", "assign", "=");
              instEl.appendChild(assignEl);
          }
          const text = instruction.opcode + instruction.flags;
          const instLabel = createElement("div", "node-label", text);
          if (instruction.opcode == "ArchNop" && instruction.outputs.length == 1
              && instruction.outputs[0].tooltip) {
              instLabel.innerText = instruction.outputs[0].tooltip;
          }
          this.searchInfo.push(text);
          this.addHtmlElementForNodeId(text, instLabel);
          instEl.appendChild(instLabel);
          if (instruction.inputs.length > 0) {
              const inputs = createElement("div", "comma-sep-list input-output-list");
              for (const input of instruction.inputs) {
                  const inputEl = this.elementForOperand(input);
                  inputs.appendChild(inputEl);
              }
              instEl.appendChild(inputs);
          }
          if (instruction.temps.length > 0) {
              const temps = createElement("div", "comma-sep-list input-output-list temps");
              for (const temp of instruction.temps) {
                  const tempEl = this.elementForOperand(temp);
                  temps.appendChild(tempEl);
              }
              instEl.appendChild(temps);
          }
          return instNodeEl;
      }
      addRangeView() {
          if (this.sequence.registerAllocation) {
              if (!this.rangeView) {
                  this.rangeView = new RangeView(this, parseInt(this.firstInstrInput.value, 10), parseInt(this.lastInstrInput.value, 10));
              }
              const source = this.sequence.registerAllocation;
              if (source.fixedLiveRanges.length == 0 && source.liveRanges.length == 0) {
                  this.preventRangeView("No live ranges to show");
              }
              if (this.showRangeView) {
                  this.rangeView.initializeContent(this.sequence.blocks, this.broker);
              }
          }
          else {
              this.preventRangeView("No live range data provided");
          }
      }
      preventRangeView(reason) {
          const toggleRangesInput = this.toggleRangeViewEl.firstChild;
          if (this.rangeView) {
              toggleRangesInput.checked = false;
              this.toggleRangeView(toggleRangesInput);
          }
          toggleRangesInput.disabled = true;
          this.toggleRangeViewEl.style.textDecoration = "line-through";
          this.toggleRangeViewEl.setAttribute("title", reason);
      }
      mkBlockLinkHandler(blockId) {
          return this.mkLinkHandler(blockId, this.blockSelectionHandler);
      }
      mkInstructionLinkHandler(instrId) {
          return this.mkLinkHandler(instrId, this.registerAllocationSelectionHandler);
      }
      mkOperandLinkHandler(text) {
          return this.mkLinkHandler(text, this.nodeSelectionHandler);
      }
      mkLinkHandler(id, handler) {
          return function (e) {
              e.stopPropagation();
              if (!e.shiftKey) {
                  handler.clear();
              }
              handler.select([id], true);
          };
      }
      elementForRangeViewInputElement(form, text) {
          const instrInputEl = createElement("input", "instruction-range-input");
          instrInputEl.type = "text";
          instrInputEl.title = text;
          instrInputEl.placeholder = text;
          instrInputEl.alt = text;
          form.appendChild(instrInputEl);
          return instrInputEl;
      }
      elementForToggleRangeView() {
          const toggleRangeViewEl = createElement("label", "", "show live ranges from ");
          const form = createElement("form", "range-toggle-form");
          toggleRangeViewEl.appendChild(form);
          this.firstInstrInput = this.elementForRangeViewInputElement(form, "first instruction");
          form.appendChild(createElement("span", "", " to "));
          this.lastInstrInput = this.elementForRangeViewInputElement(form, "last instruction");
          const submit = createElement("input", "instruction-range-submit");
          submit.type = "submit";
          submit.value = "Refresh Ranges";
          submit.onclick = (e) => {
              e.preventDefault();
              // Single click if not shown, double click to refresh if shown.
              this.toggleRangeViewEl.click();
              if (!this.showRangeView)
                  this.toggleRangeViewEl.click();
          };
          form.appendChild(submit);
          const toggleRangesInput = createElement("input", "range-toggle-show");
          toggleRangesInput.setAttribute("type", "checkbox");
          toggleRangesInput.oninput = () => this.toggleRangeView(toggleRangesInput);
          toggleRangeViewEl.insertBefore(toggleRangesInput, toggleRangeViewEl.firstChild);
          return toggleRangeViewEl;
      }
      toggleRangeView(toggleRangesInput) {
          toggleRangesInput.disabled = true;
          this.showRangeView = toggleRangesInput.checked;
          if (this.showRangeView) {
              const firstInstr = parseInt(this.firstInstrInput.value, 10);
              const lastInstr = parseInt(this.lastInstrInput.value, 10);
              if (this.rangeView.instructionRangeHandler.isNewRangeViewRequired(firstInstr, lastInstr)) {
                  // Remove current RangeView's selection nodes and blocks from SelectionHandlers.
                  this.removeHtmlElementFromAllMapsIf((e) => e.closest("#ranges-content") != null);
                  this.rangeView = new RangeView(this, firstInstr, lastInstr);
                  this.addRangeView();
              }
              this.rangeView.initializeContent(this.sequence.blocks, this.broker);
              this.rangeView.show();
          }
          else {
              this.rangeView.hide();
          }
          window.dispatchEvent(new Event("resize"));
          toggleRangesInput.disabled = false;
      }
  }

  // Copyright 2022 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  class TurboshaftGraph extends MovableContainer {
      constructor(graphPhase) {
          super(graphPhase);
          this.blockMap = graphPhase.blockIdToBlockMap;
          this.nodeMap = graphPhase.nodeIdToNodeMap;
          this.customData = graphPhase.customData;
      }
      *blocks(func = (b) => true) {
          for (const block of this.blockMap) {
              if (!block || !func(block))
                  continue;
              yield block;
          }
      }
      *nodes(func = (n) => true) {
          for (const node of this.nodeMap) {
              if (!node || !func(node))
                  continue;
              yield node;
          }
      }
      *blocksEdges(func = (e) => true) {
          for (const block of this.blockMap) {
              if (!block)
                  continue;
              for (const edge of block.inputs) {
                  if (!edge || !func(edge))
                      continue;
                  yield edge;
              }
          }
      }
      *nodesEdges(func = (e) => true) {
          for (const block of this.nodeMap) {
              if (!block)
                  continue;
              for (const edge of block.inputs) {
                  if (!edge || !func(edge))
                      continue;
                  yield edge;
              }
          }
      }
      redetermineGraphBoundingBox(showCustomData) {
          this.minGraphX = 0;
          this.maxGraphNodeX = 1;
          this.minGraphY = 0;
          this.maxGraphY = 1;
          for (const block of this.blocks()) {
              this.minGraphX = Math.min(this.minGraphX, block.x);
              this.maxGraphNodeX = Math.max(this.maxGraphNodeX, block.x + block.getWidth());
              this.minGraphY = Math.min(this.minGraphY, block.y - NODE_INPUT_WIDTH);
              this.maxGraphY = Math.max(this.maxGraphY, block.y + block.getHeight(showCustomData, false)
                  + NODE_INPUT_WIDTH);
          }
          this.maxGraphX = this.maxGraphNodeX + this.maxBackEdgeNumber * MINIMUM_EDGE_SEPARATION;
          this.width = this.maxGraphX - this.minGraphX;
          this.height = this.maxGraphY - this.minGraphY;
          return [
              [this.minGraphX - this.width / 2, this.minGraphY - this.height / 2],
              [this.maxGraphX + this.width / 2, this.maxGraphY + this.height / 2]
          ];
      }
      hasCustomData(customData, dataTarget) {
          switch (dataTarget) {
              case DataTarget.Nodes:
                  return this.customData.nodes.has(customData);
              case DataTarget.Blocks:
                  return this.customData.blocks.has(customData);
          }
      }
      getCustomData(customData, key, dataTarget) {
          switch (dataTarget) {
              case DataTarget.Nodes:
                  return this.customData.nodes.get(customData).data[key];
              case DataTarget.Blocks:
                  return this.customData.blocks.get(customData).data[key];
          }
      }
      getRanksMaxBlockHeight(showCustomData) {
          const ranksMaxBlockHeight = new Array();
          for (const block of this.blocks()) {
              ranksMaxBlockHeight[block.rank] = Math.max(ranksMaxBlockHeight[block.rank] ?? 0, block.getHeight(showCustomData, false));
          }
          return ranksMaxBlockHeight;
      }
  }

  // Copyright 2022 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  class TurboshaftGraphLayout {
      constructor(graph) {
          this.graph = graph;
          this.layoutOccupation = new LayoutOccupation(graph);
          this.maxRank = 0;
      }
      rebuild(showCustomData) {
          switch (this.graph.graphPhase.stateType) {
              case GraphStateType$1.NeedToFullRebuild:
                  this.fullRebuild(showCustomData);
                  break;
              case GraphStateType$1.Cached:
                  this.cachedRebuild();
                  break;
              default:
                  throw "Unsupported graph state type";
          }
          this.graph.graphPhase.rendered = true;
      }
      fullRebuild(showCustomData) {
          this.startTime = performance.now();
          this.maxRank = 0;
          this.visitOrderWithinRank = 0;
          const blocks = this.initBlocks();
          this.initWorkList(blocks);
          const visited = new Array();
          blocks.forEach((block) => this.dfsRankOrder(visited, block));
          const rankSets = this.getRankSets(showCustomData);
          this.placeBlocks(rankSets, showCustomData);
          this.calculateBackEdgeNumbers();
          this.graph.graphPhase.stateType = GraphStateType$1.Cached;
      }
      cachedRebuild() {
          this.calculateBackEdgeNumbers();
      }
      initBlocks() {
          // First determine the set of blocks that have no inputs. Those are the
          // basis for top-down DFS to determine rank and block placement.
          const blocksHasNoInputs = new Array();
          for (const block of this.graph.blocks()) {
              block.collapsed = false;
              blocksHasNoInputs[block.id] = true;
          }
          for (const edge of this.graph.blocksEdges()) {
              blocksHasNoInputs[edge.target.id] = false;
          }
          // Finialize the list of blocks.
          const blocks = new Array();
          const visited = new Array();
          for (const block of this.graph.blocks()) {
              if (blocksHasNoInputs[block.id]) {
                  blocks.push(block);
              }
              visited[block.id] = false;
              block.rank = 0;
              block.visitOrderWithinRank = 0;
              block.outputApproach = MINIMUM_NODE_OUTPUT_APPROACH;
          }
          this.trace("layoutGraph init");
          return blocks;
      }
      initWorkList(blocks) {
          const workList = blocks.slice();
          while (workList.length != 0) {
              const block = workList.pop();
              let changed = false;
              if (block.rank == MAX_RANK_SENTINEL) {
                  block.rank = 1;
                  changed = true;
              }
              let end = block.inputs.length;
              if (block.hasBackEdges()) {
                  end = 1;
              }
              for (let l = 0; l < end; ++l) {
                  const input = block.inputs[l].source;
                  if (input.rank >= block.rank) {
                      block.rank = input.rank + 1;
                      changed = true;
                  }
              }
              if (changed) {
                  const hasBackEdges = block.hasBackEdges();
                  for (let l = block.outputs.length - 1; l >= 0; --l) {
                      if (hasBackEdges && (l != 0)) {
                          workList.unshift(block.outputs[l].target);
                      }
                      else {
                          workList.push(block.outputs[l].target);
                      }
                  }
              }
              this.maxRank = Math.max(block.rank, this.maxRank);
              this.trace("layoutGraph work list");
          }
      }
      dfsRankOrder(visited, block) {
          if (visited[block.id])
              return;
          visited[block.id] = true;
          for (const outputEdge of block.outputs) {
              if (outputEdge.isVisible()) {
                  const output = outputEdge.target;
                  this.dfsRankOrder(visited, output);
              }
          }
          if (block.visitOrderWithinRank == 0) {
              block.visitOrderWithinRank = ++this.visitOrderWithinRank;
          }
      }
      getRankSets(showCustomData) {
          const ranksMaxBlockHeight = this.graph.getRanksMaxBlockHeight(showCustomData);
          const rankSets = new Array();
          for (const block of this.graph.blocks()) {
              block.y = ranksMaxBlockHeight.slice(1, block.rank).reduce((accumulator, current) => {
                  return accumulator + current;
              }, block.getRankIndent());
              if (!rankSets[block.rank]) {
                  rankSets[block.rank] = new Array(block);
              }
              else {
                  rankSets[block.rank].push(block);
              }
          }
          return rankSets;
      }
      placeBlocks(rankSets, showCustomData) {
          // Iterate backwards from highest to lowest rank, placing blocks so that they
          // spread out from the "center" as much as possible while still being
          // compact and not overlapping live input lines.
          rankSets.reverse().forEach((rankSet) => {
              for (const block of rankSet) {
                  this.layoutOccupation.clearOutputs(block, showCustomData);
              }
              this.traceOccupation("After clearing outputs");
              let placedCount = 0;
              rankSet = rankSet.sort((a, b) => a.compare(b));
              for (const block of rankSet) {
                  block.x = this.layoutOccupation.occupy(block);
                  const blockWidth = block.getWidth();
                  this.trace(`Block ${block.id} is placed between [${block.x}, ${block.x + blockWidth})`);
                  const staggeredFlooredI = Math.floor(placedCount++ % 3);
                  const delta = MINIMUM_EDGE_SEPARATION * staggeredFlooredI;
                  block.outputApproach += delta;
              }
              this.traceOccupation("Before clearing blocks");
              this.layoutOccupation.clearOccupied();
              this.traceOccupation("After clearing blocks");
              for (const block of rankSet) {
                  this.layoutOccupation.occupyInputs(block, showCustomData);
              }
              this.traceOccupation("After occupying inputs and determining bounding box");
          });
      }
      calculateBackEdgeNumbers() {
          this.graph.maxBackEdgeNumber = 0;
          for (const edge of this.graph.blocksEdges()) {
              if (edge.isBackEdge()) {
                  edge.backEdgeNumber = ++this.graph.maxBackEdgeNumber;
              }
              else {
                  edge.backEdgeNumber = 0;
              }
          }
      }
      trace(message) {
      }
      traceOccupation(message) {
      }
  }

  // Copyright 2022 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  class TurboshaftGraphView extends MovableView {
      constructor(idOrContainer, broker, showPhaseByName, toolbox) {
          super(idOrContainer, broker, showPhaseByName, toolbox);
          this.state.selection = new SelectionMap(node => node.identifier());
          this.state.blocksSelection = new SelectionMap(block => {
              if (block instanceof TurboshaftGraphBlock)
                  return block.identifier();
              return String(block);
          });
          this.nodeSelectionHandler = this.initializeNodeSelectionHandler();
          this.blockSelectionHandler = this.initializeBlockSelectionHandler();
          this.svg.on("click", () => {
              this.nodeSelectionHandler.clear();
              this.blockSelectionHandler.clear();
          });
          this.visibleEdges = this.graphElement.append("g");
          this.visibleBlocks = this.graphElement.append("g");
          this.blockDrag = drag()
              .on("drag", (block) => {
              block.x += event.dx;
              block.y += event.dy;
              this.updateBlockLocation(block);
          });
      }
      initializeContent(data, rememberedSelection) {
          this.show();
          this.addImgInput("layout", "layout graph", partial(this.layoutAction, this));
          this.addImgInput("show-all", "uncollapse all blocks", partial(this.uncollapseAllBlocksAction, this));
          this.addImgInput("compress-layout", "compress layout", partial(this.compressLayoutAction, this));
          this.addImgInput("collapse-selected", "collapse selected blocks", partial(this.changeSelectedCollapsingAction, this, true));
          this.addImgInput("uncollapse-selected", "uncollapse selected blocks", partial(this.changeSelectedCollapsingAction, this, false));
          this.addImgInput("zoom-selection", "zoom selection", partial(this.zoomSelectionAction, this));
          this.addToggleImgInput("toggle-cache-layout", "toggle saving graph layout", this.state.cacheLayout, partial(this.toggleLayoutCachingAction, this));
          this.phaseName = data.name;
          this.addCustomDataSelect(data.customData);
          this.addToggleImgInput("toggle-compact-view", "compact view", this.state.compactView, partial(this.toggleCompactViewAction, this));
          const adaptedSelection = this.createGraph(data, rememberedSelection);
          this.broker.addNodeHandler(this.nodeSelectionHandler);
          this.broker.addBlockHandler(this.blockSelectionHandler);
          const countOfSelectedItems = adaptedSelection.isAdapted()
              ? this.attachSelection(adaptedSelection)
              : 0;
          if (countOfSelectedItems > 0) {
              this.updateGraphVisibility();
              this.viewSelection();
          }
          else {
              if (this.state.cacheLayout && data.transform) {
                  this.viewTransformMatrix(data.transform);
              }
              else {
                  this.viewWholeGraph();
              }
          }
          const customDataShowed = this.graph.graphPhase.customDataShowed;
          if (customDataShowed != null && customDataShowed != this.nodesCustomDataShowed()) {
              this.compressLayoutAction(this);
          }
      }
      updateGraphVisibility() {
          if (!this.graph)
              return;
          this.updateVisibleBlocksAndEdges();
          this.visibleNodes = this.visibleBlocks.selectAll(".turboshaft-node");
          this.visibleBubbles = selectAll("circle");
          this.updateInputAndOutputBubbles();
          this.updateInlineNodes();
      }
      svgKeyDown() {
          let eventHandled = true; // unless the below switch defaults
          switch (event.keyCode) {
              case 38: // UP
              case 40: // DOWN
                  this.showSelectionFrontierNodes(event.keyCode == 38, undefined, true);
                  break;
              case 65: // 'a'
                  this.selectAllNodes();
                  break;
              case 67: // 'c'
                  if (!event.ctrlKey && !event.shiftKey) {
                      this.copyToClipboardHoveredNodeInfo();
                  }
                  else {
                      eventHandled = false;
                  }
                  break;
              case 72: // 'h'
                  this.showHoveredNodeHistory();
                  break;
              case 73: // 'i'
                  this.selectNodesOfSelectedBlocks();
                  break;
              case 80: // 'p'
                  if (!event.ctrlKey && !event.shiftKey) {
                      this.changeSelectedCollapsingAction(this, true);
                  }
                  else {
                      eventHandled = false;
                  }
                  break;
              case 82: // 'r'
                  if (!event.ctrlKey && !event.shiftKey) {
                      this.layoutAction(this);
                  }
                  else {
                      eventHandled = false;
                  }
                  break;
              case 83: // 's'
                  if (!event.ctrlKey && !event.shiftKey) {
                      this.changeSelectedCollapsingAction(this, false);
                  }
                  else {
                      eventHandled = false;
                  }
                  break;
              case 85: // 'u'
                  this.collapseUnusedBlocks(this.state.selection.selection.values());
                  break;
              case 89: // 'y'
                  const node = this.graph.nodeMap[this.hoveredNodeIdentifier];
                  if (!node)
                      return;
                  this.collapseUnusedBlocks([node]);
                  break;
              default:
                  eventHandled = false;
                  break;
          }
          if (eventHandled)
              event.preventDefault();
      }
      searchInputAction(searchInput, e, onlyVisible) {
          if (e.keyCode == 13) {
              this.nodeSelectionHandler.clear();
              const query = searchInput.value;
              storageSetItem("lastSearch", query);
              if (query.length == 0)
                  return;
              const reg = new RegExp(query);
              const filterFunction = (node) => {
                  if (!onlyVisible)
                      node.block.collapsed = false;
                  const customDataTitle = this.graph.customData.getTitle(node.id, DataTarget.Nodes);
                  return (!onlyVisible || !node.block.collapsed) &&
                      reg.exec(`${node.getTitle()}${customDataTitle}`);
              };
              const selection = this.searchNodes(filterFunction, e, onlyVisible);
              this.nodeSelectionHandler.select(selection, true, false);
              this.updateGraphVisibility();
              searchInput.blur();
              this.viewSelection();
              this.focusOnSvg();
          }
          e.stopPropagation();
      }
      hide() {
          this.graph.graphPhase.customDataShowed = this.nodesCustomDataShowed();
          this.broker.deleteBlockHandler(this.blockSelectionHandler);
          super.hide();
      }
      detachSelection() {
          return new SelectionStorage(this.state.selection.detachSelection(), this.state.blocksSelection.detachSelection());
      }
      adaptSelection(rememberedSelection) {
          if (!this.graph.nodeMap && !this.graph.blockMap ||
              !(rememberedSelection instanceof SelectionStorage)) {
              return new SelectionStorage();
          }
          for (const key of rememberedSelection.nodes.keys()) {
              if (this.graph.nodeMap[key]) {
                  rememberedSelection.adaptNode(key);
              }
          }
          for (const key of rememberedSelection.blocks.keys()) {
              if (this.graph.blockMap[key]) {
                  rememberedSelection.adaptBlock(key);
              }
          }
          return rememberedSelection;
      }
      adaptiveUpdateGraphVisibility() {
          const graphElement = this.graphElement.node();
          const originalHeight = graphElement.getBBox().height;
          this.updateGraphVisibility();
          this.focusOnSvg();
          const newHeight = graphElement.getBBox().height;
          const transformMatrix = this.getTransformMatrix();
          transformMatrix.y *= (newHeight / originalHeight);
          this.viewTransformMatrix(transformMatrix);
      }
      initializeNodeSelectionHandler() {
          const view = this;
          return {
              select: function (selectedNodes, selected, scrollIntoView) {
                  const sourcePositions = new Array();
                  const nodes = new Set();
                  for (const node of selectedNodes) {
                      if (!node)
                          continue;
                      if (node.sourcePosition) {
                          sourcePositions.push(node.sourcePosition);
                          nodes.add(node.identifier());
                      }
                  }
                  view.state.selection.select(selectedNodes, selected);
                  view.broker.broadcastSourcePositionSelect(this, sourcePositions, selected, nodes);
                  view.updateGraphVisibility();
              },
              clear: function () {
                  view.state.selection.clear();
                  view.broker.broadcastClear(this);
                  view.updateGraphVisibility();
              },
              brokeredNodeSelect: function (nodeIds, selected) {
                  const selection = view.graph.nodes(node => nodeIds.has(node.identifier()));
                  view.state.selection.select(selection, selected);
                  view.updateGraphVisibility();
              },
              brokeredClear: function () {
                  view.state.selection.clear();
                  view.updateGraphVisibility();
              }
          };
      }
      initializeBlockSelectionHandler() {
          const view = this;
          return {
              select: function (selectedBlocks, selected) {
                  view.state.blocksSelection.select(selectedBlocks, selected);
                  const selectedBlocksKeys = new Array();
                  for (const selectedBlock of selectedBlocks) {
                      selectedBlocksKeys.push(Number(view.state.blocksSelection.stringKey(selectedBlock)));
                  }
                  view.broker.broadcastBlockSelect(this, selectedBlocksKeys, selected);
                  view.updateGraphVisibility();
              },
              clear: function () {
                  view.state.blocksSelection.clear();
                  view.broker.broadcastClear(this);
                  view.updateGraphVisibility();
              },
              brokeredBlockSelect: function (blockIds, selected) {
                  view.state.blocksSelection.select(blockIds, selected);
                  view.updateGraphVisibility();
              },
              brokeredClear: function () {
                  view.state.blocksSelection.clear();
                  view.updateGraphVisibility();
              },
          };
      }
      createGraph(data, rememberedSelection) {
          this.graph = new TurboshaftGraph(data);
          this.graphLayout = new TurboshaftGraphLayout(this.graph);
          if (!this.state.cacheLayout ||
              this.graph.graphPhase.stateType == GraphStateType.NeedToFullRebuild) {
              this.updateGraphStateType(GraphStateType.NeedToFullRebuild);
          }
          this.showVisible();
          const adaptedSelection = this.adaptSelection(rememberedSelection);
          this.layoutGraph();
          this.updateGraphVisibility();
          return adaptedSelection;
      }
      layoutGraph() {
          const layoutMessage = this.graph.graphPhase.stateType == GraphStateType.Cached
              ? "Layout turboshaft graph from cache"
              : "Layout turboshaft graph";
          console.time(layoutMessage);
          this.graphLayout.rebuild(this.nodesCustomDataShowed());
          const extent = this.graph.redetermineGraphBoundingBox(this.nodesCustomDataShowed());
          this.panZoom.translateExtent(extent);
          this.minScale();
          console.timeEnd(layoutMessage);
      }
      addCustomDataSelect(customData) {
          const keys = Array.from(customData.nodes.keys());
          if (keys.length == 0)
              return;
          const select = document.createElement("select");
          select.setAttribute("id", "custom-data-select");
          select.setAttribute("class", "graph-toolbox-item");
          select.setAttribute("title", "custom data");
          const checkBox = this.createImgToggleInput("toggle-custom-data", "toggle custom data visibility", this.state.showCustomData, partial(this.toggleCustomDataAction, this));
          for (const key of keys) {
              const option = document.createElement("option");
              option.text = key;
              select.add(option);
          }
          const storageKey = this.customDataStorageKey();
          const indexOfSelected = keys.indexOf(storageGetItem(storageKey, null, false));
          if (indexOfSelected != -1) {
              select.selectedIndex = indexOfSelected;
          }
          else {
              storageSetItem(storageKey, keys[0]);
          }
          const view = this;
          select.onchange = function () {
              const selectedCustomData = select.options[this.selectedIndex].text;
              storageSetItem(storageKey, selectedCustomData);
              view.updateGraphVisibility();
              view.updateInlineNodesCustomData();
          };
          this.toolbox.appendChild(select);
          this.toolbox.appendChild(checkBox);
      }
      updateBlockLocation(block) {
          this.visibleBlocks
              .selectAll(".turboshaft-block")
              .filter(b => b == block)
              .attr("transform", block => `translate(${block.x},${block.y})`);
          this.visibleEdges
              .selectAll("path")
              .filter(edge => edge.target === block || edge.source === block)
              .attr("d", edge => edge.generatePath(this.graph, this.nodesCustomDataShowed(), this.state.compactView));
      }
      updateVisibleBlocksAndEdges() {
          const view = this;
          const iconsPath = "img/turboshaft/";
          // select existing edges
          const filteredEdges = [...view.graph.blocksEdges(_ => view.graph.isRendered())];
          const selEdges = view.visibleEdges
              .selectAll("path")
              .data(filteredEdges, edge => edge.toString());
          // remove old edges
          selEdges.exit().remove();
          // add new edges
          const newEdges = selEdges
              .enter()
              .append("path")
              .style("marker-end", "url(#end-arrow)")
              .attr("id", edge => `e,${edge.toString()}`)
              .on("click", edge => {
              event.stopPropagation();
              if (!event.shiftKey) {
                  view.blockSelectionHandler.clear();
              }
              view.blockSelectionHandler.select([edge.source, edge.target], true, false);
          })
              .attr("adjacentToHover", "false");
          const newAndOldEdges = newEdges.merge(selEdges);
          newAndOldEdges.classed("hidden", edge => !edge.isVisible());
          // select existing blocks
          const filteredBlocks = [...view.graph.blocks(_ => view.graph.isRendered())];
          const allBlocks = view.visibleBlocks
              .selectAll(".turboshaft-block");
          const selBlocks = allBlocks.data(filteredBlocks, block => block.toString());
          // remove old blocks
          selBlocks.exit().remove();
          // add new blocks
          const newBlocks = selBlocks
              .enter()
              .append("g")
              .classed("turboshaft-block", true)
              .classed("block", b => b.type == TurboshaftGraphBlockType.Block)
              .classed("merge", b => b.type == TurboshaftGraphBlockType.Merge)
              .classed("loop", b => b.type == TurboshaftGraphBlockType.Loop)
              .on("mouseenter", (block) => {
              const visibleEdges = view.visibleEdges
                  .selectAll("path");
              const adjInputEdges = visibleEdges.filter(edge => edge.target === block);
              const adjOutputEdges = visibleEdges.filter(edge => edge.source === block);
              adjInputEdges.classed("input", true);
              adjOutputEdges.classed("output", true);
              view.updateGraphVisibility();
          })
              .on("mouseleave", (block) => {
              const visibleEdges = view.visibleEdges
                  .selectAll("path");
              const adjEdges = visibleEdges
                  .filter(edge => edge.target === block || edge.source === block);
              adjEdges.classed("input output", false);
              view.updateGraphVisibility();
          })
              .on("click", (block) => {
              if (!event.shiftKey)
                  view.blockSelectionHandler.clear();
              view.blockSelectionHandler.select([block], undefined, false);
              event.stopPropagation();
          })
              .call(view.blockDrag);
          newBlocks
              .append("rect")
              .attr("rx", TURBOSHAFT_BLOCK_BORDER_RADIUS)
              .attr("ry", TURBOSHAFT_BLOCK_BORDER_RADIUS)
              .attr("width", block => block.getWidth())
              .attr("height", block => block.getHeight(view.nodesCustomDataShowed(), this.state?.compactView));
          newBlocks.each(function (block) {
              const svg = select(this);
              svg
                  .append("text")
                  .classed("block-label", true)
                  .attr("text-anchor", "middle")
                  .attr("x", block.getWidth() / 2)
                  .append("tspan")
                  .text(block.displayLabel)
                  .append("title")
                  .text(view.graph.customData.getTitle(block.id, DataTarget.Blocks));
              svg
                  .append("text")
                  .classed("block-collapsed-label", true)
                  .attr("text-anchor", "middle")
                  .attr("x", block.getWidth() / 2)
                  .attr("dy", block.labelBox.height)
                  .attr("visibility", block.collapsed ? "visible" : "hidden")
                  .append("tspan")
                  .text(block.collapsedLabel);
              svg
                  .append("image")
                  .attr("xlink:href", `${iconsPath}collapse_${block.collapsed ? "down" : "up"}.svg`)
                  .attr("height", block.labelBox.height)
                  .attr("x", block.getWidth() - block.labelBox.height)
                  .on("click", () => {
                  event.stopPropagation();
                  block.collapsed = !block.collapsed;
                  view.nodeSelectionHandler.select(block.nodes, false, false);
              });
              view.appendInputAndOutputBubbles(svg, block);
              view.appendInlineNodes(svg, block);
          });
          const newAndOldBlocks = newBlocks.merge(selBlocks);
          newAndOldBlocks
              .classed("selected", block => view.state.blocksSelection.isSelected(block))
              .attr("transform", block => `translate(${block.x},${block.y})`)
              .select("rect")
              .attr("height", block => block.getHeight(view.nodesCustomDataShowed(), this.state?.compactView));
          newAndOldBlocks.select("image")
              .attr("xlink:href", block => `${iconsPath}collapse_${block.collapsed ? "down" : "up"}.svg`);
          newAndOldBlocks.select(".block-collapsed-label")
              .attr("visibility", block => block.collapsed ? "visible" : "hidden");
          newAndOldEdges.attr("d", edge => edge.generatePath(view.graph, view.nodesCustomDataShowed(), view.state.compactView));
      }
      appendInlineNodes(svg, block) {
          const state = this.state;
          const graph = this.graph;
          const filteredNodes = [...block.nodes.filter(_ => graph.isRendered())];
          const allNodes = svg.selectAll(".inline-node");
          const selNodes = allNodes.data(filteredNodes, node => node.toString());
          // remove old nodes
          selNodes.exit().remove();
          // add new nodes
          const newNodes = selNodes
              .enter()
              .append("g")
              .classed("turboshaft-node inline-node", true);
          let nodeY = block.labelBox.height;
          const blockWidth = block.getWidth();
          const view = this;
          const customData = this.graph.customData;
          const storageKey = this.customDataStorageKey();
          const selectedCustomData = storageGetItem(storageKey, null, false);
          newNodes.each(function (node) {
              const nodeSvg = select(this);
              nodeSvg
                  .attr("id", node.id)
                  .append("text")
                  .attr("dx", TURBOSHAFT_NODE_X_INDENT)
                  .classed("inline-node-label", true)
                  .attr("dy", nodeY)
                  .append("tspan")
                  .html(node.buildOperationText(state.compactView))
                  .append("title")
                  .text(`${node.getTitle()}${customData.getTitle(node.id, DataTarget.Nodes)}`);
              nodeSvg
                  .on("mouseenter", (node) => {
                  view.visibleNodes.data(node.inputs.map(edge => edge.source), source => source.toString())
                      .classed("input", true);
                  view.visibleNodes.data(node.outputs.map(edge => edge.target), target => target.toString())
                      .classed("output", true);
                  view.hoveredNodeIdentifier = node.identifier();
                  view.updateGraphVisibility();
              })
                  .on("mouseleave", (node) => {
                  const inOutNodes = node.inputs.map(edge => edge.source)
                      .concat(node.outputs.map(edge => edge.target));
                  view.visibleNodes.data(inOutNodes, inOut => inOut.toString())
                      .classed("input output", false);
                  view.hoveredNodeIdentifier = null;
                  view.updateGraphVisibility();
              })
                  .on("click", (node) => {
                  if (!event.shiftKey)
                      view.nodeSelectionHandler.clear();
                  view.nodeSelectionHandler.select([node], undefined, false);
                  event.stopPropagation();
              });
              nodeY += node.getHeight(false, state.compactView);
              if (view.graph.customData.nodes.size > 0) {
                  const customData = view.graph.getCustomData(selectedCustomData, node.id, DataTarget.Nodes);
                  nodeSvg
                      .append("text")
                      .attr("dx", TURBOSHAFT_NODE_X_INDENT)
                      .classed("inline-node-custom-data", true)
                      .attr("dy", nodeY)
                      .append("tspan")
                      .text(view.getReadableString(customData, blockWidth))
                      .append("title")
                      .text(customData);
                  nodeY += node.labelBox.height;
              }
          });
          newNodes.merge(selNodes)
              .classed("selected", node => state.selection.isSelected(node));
      }
      updateInlineNodes() {
          const view = this;
          const state = this.state;
          const showCustomData = this.nodesCustomDataShowed();
          const customData = this.graph.customData;
          let totalHeight = 0;
          let blockId = 0;
          view.visibleNodes.each(function (node) {
              const nodeSvg = select(this);
              if (blockId != node.block.id) {
                  blockId = node.block.id;
                  totalHeight = 0;
              }
              totalHeight += node.getHeight(showCustomData, state?.compactView);
              const nodeY = showCustomData ? totalHeight - node.labelBox.height : totalHeight;
              nodeSvg
                  .select(".inline-node-label")
                  .classed("selected", node => state.selection.isSelected(node))
                  .attr("dy", nodeY)
                  .attr("visibility", !node.block.collapsed ? "visible" : "hidden")
                  .select("tspan")
                  .html(node.buildOperationText(state.compactView))
                  .append("title")
                  .text(`${node.getTitle()}${customData.getTitle(node.id, DataTarget.Nodes)}`);
              nodeSvg
                  .select(".inline-node-custom-data")
                  .attr("visibility", !node.block.collapsed && showCustomData ? "visible" : "hidden");
          });
      }
      updateInlineNodesCustomData() {
          const view = this;
          const storageKey = this.customDataStorageKey();
          const selectedCustomData = storageGetItem(storageKey, null, false);
          if (!this.nodesCustomDataShowed())
              return;
          view.visibleNodes.each(function (node) {
              const customData = view.graph.getCustomData(selectedCustomData, node.id, DataTarget.Nodes);
              select(this)
                  .select(".inline-node-custom-data")
                  .select("tspan")
                  .text(view.getReadableString(customData, node.block.width))
                  .append("title")
                  .text(customData);
          });
      }
      appendInputAndOutputBubbles(svg, block) {
          for (let i = 0; i < block.inputs.length; i++) {
              const x = block.getInputX(i);
              const y = -DEFAULT_NODE_BUBBLE_RADIUS;
              svg.append("circle")
                  .classed("filledBubbleStyle", true)
                  .attr("id", `ib,${block.inputs[i].toString()}`)
                  .attr("r", DEFAULT_NODE_BUBBLE_RADIUS)
                  .attr("transform", `translate(${x},${y})`);
          }
          if (block.outputs.length > 0) {
              const x = block.getOutputX();
              const y = block.getHeight(this.nodesCustomDataShowed(), this.state?.compactView) + DEFAULT_NODE_BUBBLE_RADIUS;
              svg.append("circle")
                  .classed("filledBubbleStyle", true)
                  .attr("id", `ob,${block.id}`)
                  .attr("r", DEFAULT_NODE_BUBBLE_RADIUS)
                  .attr("transform", `translate(${x},${y})`);
          }
      }
      updateInputAndOutputBubbles() {
          const view = this;
          view.visibleBubbles.each(function () {
              const components = this.id.split(",");
              if (components[0] === "ob") {
                  const from = view.graph.blockMap[components[1]];
                  const x = from.getOutputX();
                  const y = from.getHeight(view.nodesCustomDataShowed(), view.state?.compactView) + DEFAULT_NODE_BUBBLE_RADIUS;
                  this.setAttribute("transform", `translate(${x},${y})`);
              }
          });
      }
      viewSelection() {
          let minX;
          let maxX;
          let minY;
          let maxY;
          let hasSelection = false;
          this.visibleBlocks.selectAll(".turboshaft-block")
              .each((block) => {
              let blockHasSelection = false;
              for (const node of block.nodes) {
                  if (this.state.selection.isSelected(node) || this.state.blocksSelection.isSelected(block)) {
                      blockHasSelection = true;
                      minX = minX ? Math.min(minX, block.x) : block.x;
                      maxX = maxX ? Math.max(maxX, block.x + block.getWidth()) : block.x + block.getWidth();
                      minY = minY ? Math.min(minY, block.y) : block.y;
                      maxY = maxY
                          ? Math.max(maxY, block.y + block.getHeight(this.nodesCustomDataShowed(), this.state?.compactView))
                          : block.y + block.getHeight(this.nodesCustomDataShowed(), this.state?.compactView);
                  }
                  if (blockHasSelection) {
                      hasSelection = true;
                      break;
                  }
              }
          });
          if (hasSelection) {
              this.viewGraphRegion(minX - NODE_INPUT_WIDTH, minY - 60, maxX + NODE_INPUT_WIDTH, maxY + 60);
          }
      }
      attachSelection(selection) {
          if (!(selection instanceof SelectionStorage))
              return 0;
          this.nodeSelectionHandler.clear();
          this.blockSelectionHandler.clear();
          const selectedNodes = [
              ...this.graph.nodes(node => selection.adaptedNodes.has(this.state.selection.stringKey(node)))
          ];
          this.nodeSelectionHandler.select(selectedNodes, true, false);
          const selectedBlocks = [
              ...this.graph.blocks(block => selection.adaptedBocks.has(this.state.blocksSelection.stringKey(block)))
          ];
          this.blockSelectionHandler.select(selectedBlocks, true, false);
          return selectedNodes.length + selectedBlocks.length;
      }
      nodesCustomDataShowed() {
          const storageKey = this.customDataStorageKey();
          const selectedCustomData = storageGetItem(storageKey, null, false);
          if (selectedCustomData == null)
              return false;
          return this.graph.hasCustomData(selectedCustomData, DataTarget.Nodes) &&
              this.state.showCustomData;
      }
      customDataStorageKey() {
          return `${this.phaseName}-selected-custom-data`;
      }
      getReadableString(str, maxWidth) {
          if (!str)
              return "";
          const strBox = measureText(str);
          if (maxWidth > strBox.width)
              return str;
          const widthOfOneSymbol = Math.floor(strBox.width / str.length);
          const lengthOfReadableProperties = Math.floor(maxWidth / widthOfOneSymbol);
          return `${str.slice(0, lengthOfReadableProperties - 3)}..`;
      }
      // Actions (handlers of toolbox menu and hotkeys events)
      layoutAction(view) {
          view.updateGraphStateType(GraphStateType.NeedToFullRebuild);
          view.layoutGraph();
          view.updateGraphVisibility();
          view.viewWholeGraph();
          view.focusOnSvg();
      }
      uncollapseAllBlocksAction(view) {
          for (const block of view.graph.blocks()) {
              block.collapsed = false;
          }
          view.updateGraphVisibility();
          view.focusOnSvg();
      }
      compressLayoutAction(view) {
          for (const block of view.graph.blocks()) {
              block.compressHeight();
          }
          const ranksMaxBlockHeight = view.graph.getRanksMaxBlockHeight(view.nodesCustomDataShowed());
          for (const block of view.graph.blocks()) {
              block.y = ranksMaxBlockHeight.slice(1, block.rank).reduce((accumulator, current) => {
                  return accumulator + current;
              }, block.getRankIndent());
          }
          view.adaptiveUpdateGraphVisibility();
      }
      changeSelectedCollapsingAction(view, collapsed) {
          for (const key of view.state.blocksSelection.selectedKeys()) {
              const block = view.graph.blockMap[key];
              if (!block)
                  continue;
              block.collapsed = collapsed;
          }
          view.updateGraphVisibility();
          view.focusOnSvg();
      }
      zoomSelectionAction(view) {
          view.viewSelection();
          view.focusOnSvg();
      }
      toggleCompactViewAction(view) {
          view.state.compactView = !view.state.compactView;
          const element = document.getElementById("toggle-compact-view");
          element.classList.toggle("button-input-toggled", view.state.compactView);
          const extent = view.graph.redetermineGraphBoundingBox(view.state.showCustomData);
          view.panZoom.translateExtent(extent);
          view.adaptiveUpdateGraphVisibility();
          view.updateInlineNodesCustomData();
      }
      toggleCustomDataAction(view) {
          view.state.showCustomData = !view.state.showCustomData;
          const ranksMaxBlockHeight = new Array();
          for (const block of view.graph.blocks()) {
              ranksMaxBlockHeight[block.rank] = Math.max(ranksMaxBlockHeight[block.rank] ?? 0, block.collapsed
                  ? block.height
                  : block.getHeight(view.nodesCustomDataShowed(), this.state?.compactView));
          }
          for (const block of view.graph.blocks()) {
              block.y = ranksMaxBlockHeight.slice(1, block.rank).reduce((accumulator, current) => {
                  return accumulator + current;
              }, block.getRankIndent());
          }
          const element = document.getElementById("toggle-custom-data");
          element.classList.toggle("button-input-toggled", view.state.showCustomData);
          const extent = view.graph.redetermineGraphBoundingBox(view.state.showCustomData);
          view.panZoom.translateExtent(extent);
          view.adaptiveUpdateGraphVisibility();
          view.updateInlineNodesCustomData();
      }
      toggleLayoutCachingAction(view) {
          view.state.cacheLayout = !view.state.cacheLayout;
          const element = document.getElementById("toggle-cache-layout");
          element.classList.toggle("button-input-toggled", view.state.cacheLayout);
      }
      // Hotkeys handlers
      selectAllNodes() {
          this.nodeSelectionHandler.select(this.graph.nodeMap, true, false);
          this.updateGraphVisibility();
      }
      collapseUnusedBlocks(usedNodes) {
          const usedBlocks = new Set();
          for (const node of usedNodes) {
              usedBlocks.add(node.block);
              for (const input of node.inputs) {
                  usedBlocks.add(input.source.block);
              }
              for (const output of node.outputs) {
                  usedBlocks.add(output.target.block);
              }
          }
          if (usedBlocks.size == 0)
              return;
          for (const block of this.graph.blockMap) {
              block.collapsed = !usedBlocks.has(block);
          }
          this.updateGraphVisibility();
      }
      copyToClipboardHoveredNodeInfo() {
          const node = this.graph.nodeMap[this.hoveredNodeIdentifier];
          if (!node)
              return;
          const customData = this.graph.customData;
          copyToClipboard(`${node.getTitle()}${customData.getTitle(node.id, DataTarget.Nodes)}`);
      }
      selectNodesOfSelectedBlocks() {
          let selectedNodes = new Array();
          for (const key of this.state.blocksSelection.selectedKeys()) {
              const block = this.graph.blockMap[key];
              if (!block)
                  continue;
              block.collapsed = false;
              selectedNodes = selectedNodes.concat(block.nodes);
          }
          this.nodeSelectionHandler.select(selectedNodes, true, false);
          this.updateGraphVisibility();
      }
  }

  // Copyright 2018 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  const toolboxHTML = `
<div class="graph-toolbox">
  <select id="phase-select">
    <option disabled selected>(please open a file)</option>
  </select>
  <input id="search-input" type="text" title="search nodes for regex" alt="search node for regex" class="search-input"
    placeholder="find with regexp&hellip;">
  <label><input id="search-only-visible" type="checkbox" name="instruction-address" alt="Apply search to visible nodes only">only visible</label>
</div>`;
  class GraphMultiView extends View {
      constructor(id, selectionBroker, sourceResolver) {
          super(id);
          const view = this;
          view.sourceResolver = sourceResolver;
          view.selectionBroker = selectionBroker;
          const toolbox = document.createElement("div");
          toolbox.className = "toolbox-anchor";
          toolbox.innerHTML = toolboxHTML;
          view.divNode.appendChild(toolbox);
          const searchInput = toolbox.querySelector("#search-input");
          const onlyVisibleCheckbox = toolbox.querySelector("#search-only-visible");
          searchInput.addEventListener("keyup", (e) => {
              view.currentPhaseView?.searchInputAction(searchInput, e, onlyVisibleCheckbox.checked);
          });
          view.divNode.addEventListener("keyup", (e) => {
              if (e.keyCode == 191) { // keyCode == '/'
                  searchInput.focus();
              }
              else if (e.keyCode == 78) { // keyCode == 'n'
                  view.displayNextGraphPhase();
              }
              else if (e.keyCode == 66) { // keyCode == 'b'
                  view.displayPreviousGraphPhase();
              }
          });
          searchInput.setAttribute("value", storageGetItem("lastSearch", "", false));
          this.graph = new GraphView(this.divNode, selectionBroker, view.displayPhaseByName.bind(this), toolbox.querySelector(".graph-toolbox"));
          this.turboshaftGraph = new TurboshaftGraphView(this.divNode, selectionBroker, view.displayPhaseByName.bind(this), toolbox.querySelector(".graph-toolbox"));
          this.schedule = new ScheduleView(this.divNode, selectionBroker);
          this.sequence = new SequenceView(this.divNode, selectionBroker);
          this.selectMenu = toolbox.querySelector("#phase-select");
      }
      createViewElement() {
          const pane = document.createElement("div");
          pane.setAttribute("id", MULTIVIEW_ID);
          pane.setAttribute("tabindex", "1");
          pane.className = "viewpane";
          return pane;
      }
      hide() {
          this.container.className = "";
          this.hideCurrentPhase();
          super.hide();
      }
      show() {
          // Insert before is used so that the display is inserted before the
          // resizer for the RangeView.
          this.container.insertBefore(this.divNode, this.container.firstChild);
          this.initializeSelect();
          const lastPhaseIndex = storageGetItem("lastSelectedPhase");
          const initialPhaseIndex = this.sourceResolver.repairPhaseId(lastPhaseIndex);
          this.selectMenu.selectedIndex = initialPhaseIndex;
          this.displayPhase(this.sourceResolver.getDynamicPhase(initialPhaseIndex));
      }
      displayPhaseByName(phaseName, selection) {
          const phaseId = this.sourceResolver.getPhaseIdByName(phaseName);
          this.selectMenu.selectedIndex = phaseId;
          this.currentPhaseView.hide();
          this.displayPhase(this.sourceResolver.getDynamicPhase(phaseId), selection);
      }
      onresize() {
          this.currentPhaseView?.onresize();
      }
      displayPhase(phase, selection) {
          this.sourceResolver.positions = phase.positions;
          this.sourceResolver.instructionsPhase = phase.instructionsPhase;
          if (phase.type == PhaseType.Graph) {
              this.displayPhaseView(this.graph, phase, selection);
          }
          else if (phase.type == PhaseType.TurboshaftGraph) {
              this.displayPhaseView(this.turboshaftGraph, phase, selection);
          }
          else if (phase.type == PhaseType.Schedule) {
              this.displayPhaseView(this.schedule, phase, selection);
          }
          else if (phase.type == PhaseType.Sequence) {
              this.displayPhaseView(this.sequence, phase, selection);
          }
      }
      displayPhaseView(view, data, selection) {
          const rememberedSelection = selection ? selection : this.hideCurrentPhase();
          view.initializeContent(data, rememberedSelection);
          this.currentPhaseView = view;
      }
      displayNextGraphPhase() {
          let nextPhaseIndex = this.selectMenu.selectedIndex + 1;
          while (nextPhaseIndex < this.sourceResolver.phases.length) {
              const nextPhase = this.sourceResolver.getDynamicPhase(nextPhaseIndex);
              if (nextPhase && nextPhase.isGraph()) {
                  this.selectMenu.selectedIndex = nextPhaseIndex;
                  storageSetItem("lastSelectedPhase", nextPhaseIndex);
                  this.displayPhase(nextPhase);
                  break;
              }
              nextPhaseIndex += 1;
          }
      }
      displayPreviousGraphPhase() {
          let previousPhaseIndex = this.selectMenu.selectedIndex - 1;
          while (previousPhaseIndex >= 0) {
              const previousPhase = this.sourceResolver.getDynamicPhase(previousPhaseIndex);
              if (previousPhase && previousPhase.isGraph()) {
                  this.selectMenu.selectedIndex = previousPhaseIndex;
                  storageSetItem("lastSelectedPhase", previousPhaseIndex);
                  this.displayPhase(previousPhase);
                  break;
              }
              previousPhaseIndex -= 1;
          }
      }
      initializeSelect() {
          const view = this;
          view.selectMenu.innerHTML = "";
          for (const phase of view.sourceResolver.phases) {
              const optionElement = document.createElement("option");
              let maxNodeId = "";
              if ((phase instanceof GraphPhase || phase instanceof TurboshaftGraphPhase)
                  && phase.highestNodeId != 0) {
                  maxNodeId = ` ${phase.highestNodeId}`;
              }
              optionElement.text = `${phase.name}${maxNodeId}`;
              view.selectMenu.add(optionElement);
          }
          this.selectMenu.onchange = function () {
              const phaseIndex = this.selectedIndex;
              storageSetItem("lastSelectedPhase", phaseIndex);
              view.displayPhase(view.sourceResolver.getDynamicPhase(phaseIndex));
          };
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
  }

  // Copyright 2015 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  class CodeView extends View {
      constructor(parent, broker, sourceFunction, sourceResolver, codeMode) {
          super(parent);
          this.broker = broker;
          this.source = sourceFunction;
          this.sourceResolver = sourceResolver;
          this.codeMode = codeMode;
          this.sourcePositionToHtmlElements = new Map();
          this.showAdditionalInliningPosition = false;
          this.sourcePositionSelection = new SelectionMap((gp) => gp.toString());
          this.sourcePositionSelectionHandler = this.initializeSourcePositionSelectionHandler();
          broker.addSourcePositionHandler(this.sourcePositionSelectionHandler);
          this.initializeCode();
      }
      createViewElement() {
          const sourceContainer = document.createElement("div");
          sourceContainer.classList.add("source-container");
          return sourceContainer;
      }
      initializeCode() {
          const view = this;
          const source = this.source;
          const sourceText = source.sourceText;
          if (!sourceText)
              return;
          const sourceContainer = view.divNode;
          if (this.codeMode == CodeMode.MainSource) {
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
          codeModeDiv.innerHTML = this.codeMode;
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
          if (sourceText !== "") {
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
                  if (e.target instanceof Element && e.target.tagName === "DIV") {
                      const targetDiv = e.target;
                      if (targetDiv.classList.contains("line-number")) {
                          e.stopPropagation();
                          view.onSelectLine(Number(targetDiv.dataset.lineNumber), !e.shiftKey);
                      }
                  }
                  else {
                      view.sourcePositionSelectionHandler.clear();
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
                  currentLineElement.id = `li${i}`;
                  currentLineElement.dataset.lineNumber = String(lineNumber);
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
                      (sourceText[current] === "\n" || sourceText[current] === "\r")) {
                      ++current;
                      ++newlineAdjust;
                  }
              }
          }
      }
      initializeSourcePositionSelectionHandler() {
          const view = this;
          const broker = this.broker;
          const sourceResolver = this.sourceResolver;
          return {
              select: function (sourcePositions, selected) {
                  const locations = new Array();
                  for (const sourcePosition of sourcePositions) {
                      locations.push(sourcePosition);
                      sourceResolver.addInliningPositions(sourcePosition, locations);
                  }
                  if (locations.length == 0)
                      return;
                  view.sourcePositionSelection.select(locations, selected);
                  view.updateSelection();
                  broker.broadcastSourcePositionSelect(this, locations, selected);
              },
              clear: function () {
                  view.sourcePositionSelection.clear();
                  view.updateSelection();
                  broker.broadcastClear(this);
              },
              brokeredSourcePositionSelect: function (locations, selected) {
                  const firstSelect = view.sourcePositionSelection.isEmpty();
                  for (const location of locations) {
                      const translated = sourceResolver.translateToSourceId(view.source.sourceId, location);
                      if (!translated)
                          continue;
                      view.sourcePositionSelection.select([translated], selected);
                  }
                  view.updateSelection(firstSelect);
              },
              brokeredClear: function () {
                  view.sourcePositionSelection.clear();
                  view.updateSelection();
              },
          };
      }
      addHtmlElementToSourcePosition(sourcePosition, element) {
          const key = sourcePosition.toString();
          if (!this.sourcePositionToHtmlElements.has(key)) {
              this.sourcePositionToHtmlElements.set(key, new Array());
          }
          this.sourcePositionToHtmlElements.get(key).push(element);
      }
      updateSelection(scrollIntoView = false) {
          const mkVisible = new ViewElements(this.divNode.parentNode);
          for (const [sp, els] of this.sourcePositionToHtmlElements.entries()) {
              const isSelected = this.sourcePositionSelection.isKeySelected(sp);
              for (const el of els) {
                  mkVisible.consider(el, isSelected);
                  el.classList.toggle("selected", isSelected);
              }
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
          const orderList = this.divNode.querySelector(`#${this.getCodeHtmlElementName()} ol`);
          return orderList.childNodes;
      }
      onSelectLine(lineNumber, doClear) {
          if (doClear) {
              this.sourcePositionSelectionHandler.clear();
          }
          const positions = this.sourceResolver.lineToSourcePositions(lineNumber - 1);
          if (positions !== undefined) {
              this.sourcePositionSelectionHandler.select(positions, undefined);
          }
      }
      onSelectSourcePosition(sourcePosition, doClear) {
          if (doClear) {
              this.sourcePositionSelectionHandler.clear();
          }
          this.sourcePositionSelectionHandler.select([sourcePosition], undefined);
      }
      insertSourcePositions(currentSpan, lineNumber, pos, end, adjust) {
          const view = this;
          const sps = this.sourceResolver.sourcePositionsInRange(this.source.sourceId, pos - adjust, end);
          let offset = 0;
          for (const sourcePosition of sps) {
              // Internally, line numbers are 0-based so we have to substract 1 from the line number. This
              // path in only taken by non-Wasm code. Wasm code relies on setSourceLineToBytecodePosition.
              this.sourceResolver.addAnyPositionToLine(lineNumber - 1, sourcePosition);
              const textNode = currentSpan.tagName === "SPAN" ? currentSpan.lastChild : currentSpan;
              if (!(textNode instanceof Text))
                  continue;
              const splitLength = Math.max(0, sourcePosition.scriptOffset - pos - offset);
              offset += splitLength;
              const replacementNode = textNode.splitText(splitLength);
              const span = document.createElement("span");
              span.setAttribute("scriptOffset", sourcePosition.scriptOffset.toString());
              span.classList.add("source-position");
              const marker = document.createElement("span");
              marker.classList.add("marker");
              span.appendChild(marker);
              const inlining = this.sourceResolver.getInliningForPosition(sourcePosition);
              if (inlining && view.showAdditionalInliningPosition) {
                  const sourceName = this.sourceResolver.getSourceName(inlining.sourceId);
                  const inliningMarker = document.createElement("span");
                  inliningMarker.classList.add("inlining-marker");
                  inliningMarker.setAttribute("data-descr", `${sourceName} was inlined here`);
                  span.appendChild(inliningMarker);
              }
              span.onclick = function (e) {
                  e.stopPropagation();
                  view.onSelectSourcePosition(sourcePosition, !e.shiftKey);
              };
              view.addHtmlElementToSourcePosition(sourcePosition, span);
              textNode.parentNode.insertBefore(span, replacementNode);
          }
      }
      insertLineNumber(lineElement, lineNumber) {
          const lineNumberElement = document.createElement("div");
          lineNumberElement.classList.add("line-number");
          lineNumberElement.dataset.lineNumber = String(lineNumber);
          lineNumberElement.innerText = String(lineNumber);
          lineElement.insertBefore(lineNumberElement, lineElement.firstChild);
          for (const sourcePosition of this.sourceResolver.lineToSourcePositions(lineNumber - 1)) {
              this.addHtmlElementToSourcePosition(sourcePosition, lineElement);
          }
      }
  }

  // Copyright 2022 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  class Tabs {
      constructor(container) {
          this.container = container;
          this.nextTabId = 0;
          this.makeTabBar(container);
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
      addTab(caption) {
          const newTab = document.createElement("li");
          newTab.innerHTML = caption;
          newTab.id = `tab-header-${this.container.id}-${this.nextTabId++}`;
          const lastTab = this.tabBar.querySelector("li.last-tab");
          this.tabBar.insertBefore(newTab, lastTab);
          return newTab;
      }
      makeTabBar(container) {
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
      showTab(li, show = true) {
          const tabDiv = document.getElementById(li.dataset.divid);
          tabDiv.style.display = show ? "block" : "none";
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
              ? e.target
              : this.tabBar.querySelector("li.last-tab");
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
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  class Snapper {
      constructor(resizer) {
          this.resizer = resizer;
          this.sourceExpand = document.getElementById(SOURCE_EXPAND_ID);
          this.sourceCollapse = document.getElementById(SOURCE_COLLAPSE_ID);
          this.disassemblyExpand = document.getElementById(DISASSEMBLY_EXPAND_ID);
          this.disassemblyCollapse = document.getElementById(DISASSEMBLY_COLLAPSE_ID);
          this.rangesShowHide = document.getElementById(SHOW_HIDE_RANGES_ID);
          this.rangesExpandVert = document.getElementById(RANGES_EXPAND_VERT_ID);
          this.rangesCollapseVert = document.getElementById(RANGES_COLLAPSE_VERT_ID);
          this.rangesExpandHor = document.getElementById(RANGES_EXPAND_HOR_ID);
          this.rangesCollapseHor = document.getElementById(RANGES_COLLAPSE_HOR_ID);
          document.getElementById(SHOW_HIDE_SOURCE_ID).addEventListener("click", () => {
              this.resizer.resizerLeft.classed("snapped", !this.resizer.resizerLeft.classed("snapped"));
              this.setSourceExpanded(!this.sourceExpand.classList.contains("invisible"));
              this.resizer.updatePanes();
          });
          document.getElementById(SHOW_HIDE_DISASSEMBLY_ID).addEventListener("click", () => {
              this.resizer.resizerRight.classed("snapped", !this.resizer.resizerRight.classed("snapped"));
              this.setDisassemblyExpanded(!this.disassemblyExpand.classList.contains("invisible"));
              this.resizer.updatePanes();
          });
          this.rangesShowHide.dataset.expanded = "1";
          this.rangesShowHide.addEventListener("click", () => {
              this.resizer.resizerRanges.classed("snapped", !this.resizer.resizerRanges.classed("snapped"));
              this.setRangesExpanded(this.rangesShowHide.dataset.expanded !== "1");
              this.resizer.updatePanes();
          });
      }
      restoreExpandedState() {
          this.resizer.resizerLeft.classed("snapped", !storageGetItem("expandedState-source", true));
          this.resizer.resizerRight.classed("snapped", !storageGetItem("expandedState-disassembly", true));
          this.resizer.resizerRanges.classed("snapped", !storageGetItem("expandedState-ranges", true));
          this.setSourceExpanded(this.getLastExpandedState("source", true));
          this.setDisassemblyExpanded(this.getLastExpandedState("disassembly", true));
          this.setRangesExpanded(this.getLastExpandedState("ranges", true));
      }
      setSourceExpanded(isSourceExpanded) {
          this.sourceUpdate(isSourceExpanded);
          this.resizer.updateLeftWidth();
      }
      setDisassemblyExpanded(isDisassemblyExpanded) {
          this.disassemblyUpdate(isDisassemblyExpanded);
          this.resizer.updateRightWidth();
          this.resizer.updateRanges();
      }
      rangesUpdate(isRangesExpanded) {
          storageSetItem("expandedState-ranges", isRangesExpanded);
          this.rangesShowHide.dataset.expanded = isRangesExpanded ? "1" : "0";
          const landscapeMode = this.resizer.isRangesInLandscapeMode();
          this.rangesExpandVert.classList.toggle("invisible", !landscapeMode || isRangesExpanded);
          this.rangesCollapseVert.classList.toggle("invisible", !landscapeMode || !isRangesExpanded);
          this.rangesExpandHor.classList.toggle("invisible", landscapeMode || isRangesExpanded);
          this.rangesCollapseHor.classList.toggle("invisible", landscapeMode || !isRangesExpanded);
          let left;
          if (landscapeMode) {
              left = this.resizer.sepLeft + this.resizer.RESIZER_SIZE;
          }
          else {
              left = isRangesExpanded
                  ? this.resizer.sepRangesX + this.resizer.RESIZER_SIZE
                  : (this.resizer.sepRangesX - this.rangesShowHide.clientWidth
                      - (2 * this.resizer.RESIZER_SIZE));
          }
          const marginLeft = parseInt(window.getComputedStyle(this.rangesShowHide, null)
              .getPropertyValue("margin-left").slice(0, -2), 10);
          const marginRight = parseInt(window.getComputedStyle(this.rangesShowHide, null)
              .getPropertyValue("margin-right").slice(0, -2), 10);
          const width = this.rangesShowHide.clientWidth + marginLeft + marginRight;
          // The left value is bounded on both sides by another show/hide button of the same width. The
          // max value must also account for its own width. marginRight is subtracted from both sides to
          // reduce the separation between buttons.
          const maxLeft = document.body.getBoundingClientRect().width - (2 * width) + marginRight;
          this.rangesShowHide.style.left = `${Math.max(width - marginRight, Math.min(left, maxLeft))}px`;
      }
      setRangesExpanded(isRangesExpanded) {
          this.rangesUpdate(isRangesExpanded);
          this.resizer.updateRanges();
      }
      getLastExpandedState(type, defaultState) {
          return storageGetItem(`expandedState-${type}`, defaultState);
      }
      sourceUpdate(isSourceExpanded) {
          storageSetItem("expandedState-source", isSourceExpanded);
          this.sourceExpand.classList.toggle("invisible", isSourceExpanded);
          this.sourceCollapse.classList.toggle("invisible", !isSourceExpanded);
      }
      disassemblyUpdate(isDisassemblyExpanded) {
          storageSetItem("expandedState-disassembly", isDisassemblyExpanded);
          this.disassemblyExpand.classList.toggle("invisible", isDisassemblyExpanded);
          this.disassemblyCollapse.classList.toggle("invisible", !isDisassemblyExpanded);
      }
  }
  class Resizer {
      constructor(panesUpdatedCallback, deadWidth, deadHeight) {
          this.RESIZER_SIZE = document.getElementById("resizer-ranges").offsetHeight;
          const resizer = this;
          resizer.panesUpdatedCallback = panesUpdatedCallback;
          resizer.deadWidth = deadWidth;
          resizer.deadHeight = deadHeight;
          resizer.left = document.getElementById(SOURCE_PANE_ID);
          resizer.right = document.getElementById(GENERATED_PANE_ID);
          resizer.ranges = document.getElementById(RANGES_PANE_ID);
          resizer.middle = document.getElementById(INTERMEDIATE_PANE_ID);
          resizer.resizerLeft = select("#resizer-left");
          resizer.resizerRight = select("#resizer-right");
          resizer.resizerRanges = select("#resizer-ranges");
          // Set default sizes, if they weren't set.
          storageSetIfIsNotExist("source-pane-percent", SOURCE_PANE_DEFAULT_PERCENT);
          storageSetIfIsNotExist("disassembly-pane-percent", DISASSEMBLY_PANE_DEFAULT_PERCENT);
          storageSetIfIsNotExist("ranges-pane-height-percent", RANGES_PANE_HEIGHT_DEFAULT_PERCENT);
          storageSetIfIsNotExist("ranges-pane-width-percent", RANGES_PANE_WIDTH_DEFAULT_PERCENT);
          this.updateSizes();
          const dragResizeLeft = drag()
              .on("drag", () => {
              const [x, _] = mouse(document.body);
              resizer.sepLeft = Math.min(Math.max(0, x), resizer.sepRight);
              if (resizer.sepLeft > resizer.sepRangesX) {
                  resizer.sepRangesX = resizer.sepLeft;
              }
              resizer.updatePanes();
          })
              .on("start", () => {
              resizer.rangesInLandscapeMode = resizer.isRangesInLandscapeMode();
              resizer.resizerLeft.classed("dragged", true);
          })
              .on("end", () => {
              // If the panel is close enough to the left, treat it as if it was pulled
              // all the way to the left.
              const [x, y] = mouse(document.body);
              if (x <= deadWidth) {
                  resizer.sepLeft = 0;
                  resizer.updatePanes();
              }
              // Snap if dragged all the way to the left.
              resizer.resizerLeft.classed("snapped", resizer.sepLeft === 0);
              if (!resizer.isLeftSnapped()) {
                  storageSetItem("source-pane-percent", resizer.sepLeft / document.body.getBoundingClientRect().width);
              }
              resizer.snapper.setSourceExpanded(!resizer.isLeftSnapped());
              resizer.resizerLeft.classed("dragged", false);
              if (!resizer.rangesInLandscapeMode) {
                  resizer.dragRangesEnd(y, resizer.sepRangesX >= resizer.sepRight - deadWidth);
              }
          });
          resizer.resizerLeft.call(dragResizeLeft);
          const dragResizeRight = drag()
              .on("drag", () => {
              const [x, _] = mouse(document.body);
              resizer.sepRight = Math.max(resizer.sepLeft, Math.min(x, document.body.getBoundingClientRect().width));
              if (resizer.sepRight < resizer.sepRangesX || resizer.isRangesSnapped()) {
                  resizer.sepRangesX = resizer.sepRight;
              }
              resizer.updatePanes();
          })
              .on("start", () => {
              resizer.rangesInLandscapeMode = resizer.isRangesInLandscapeMode();
              resizer.resizerRight.classed("dragged", true);
          })
              .on("end", () => {
              // If the panel is close enough to the right, treat it as if
              // it was pulled all the way to the right.
              const [x, y] = mouse(document.body);
              const clientWidth = document.body.getBoundingClientRect().width;
              if (x >= (clientWidth - deadWidth)) {
                  resizer.sepRight = clientWidth - 1;
                  resizer.updatePanes();
              }
              // Snap if dragged all the way to the right.
              resizer.resizerRight.classed("snapped", resizer.sepRight >= clientWidth - 1);
              if (!resizer.isRightSnapped()) {
                  storageSetItem("disassembly-pane-percent", resizer.sepRight / clientWidth);
              }
              resizer.snapper.setDisassemblyExpanded(!resizer.isRightSnapped());
              resizer.resizerRight.classed("dragged", false);
              if (!resizer.rangesInLandscapeMode) {
                  resizer.dragRangesEnd(y, resizer.sepRangesX >= resizer.sepRight - deadWidth);
              }
          });
          resizer.resizerRight.call(dragResizeRight);
          const dragResizeRanges = drag()
              .on("drag", () => {
              const [x, y] = mouse(document.body);
              resizer.sepRangesX = Math.max(resizer.sepLeft, Math.min(x, resizer.sepRight));
              resizer.sepRangesHeight = Math.max(100, Math.min(y, window.innerHeight)
                  - RESIZER_RANGES_HEIGHT_BUFFER_PERCENTAGE);
              resizer.updatePanes();
          })
              .on("start", () => {
              resizer.rangesInLandscapeMode = resizer.isRangesInLandscapeMode();
              resizer.resizerRanges.classed("dragged", true);
          })
              .on("end", () => {
              const [x, y] = mouse(document.body);
              const isSnappedX = !resizer.rangesInLandscapeMode && (x >= (resizer.sepRight - deadWidth));
              resizer.dragRangesEnd(y, isSnappedX);
          });
          resizer.resizerRanges.call(dragResizeRanges);
          window.onresize = function () {
              resizer.updateSizes();
              resizer.updatePanes();
          };
          resizer.snapper = new Snapper(resizer);
          resizer.snapper.restoreExpandedState();
      }
      isRangesInLandscapeMode() {
          return this.ranges.dataset.landscapeMode === "true";
      }
      updatePanes() {
          this.left.style.width = `${this.sepLeft}px`;
          this.resizerLeft.style("left", `${this.sepLeft}px`);
          this.right.style.width = `${(document.body.getBoundingClientRect().width - this.sepRight)}px`;
          this.resizerRight.style("right", `${(document.body.getBoundingClientRect().width - this.sepRight - 1)}px`);
          this.updateRangesPane();
          this.panesUpdatedCallback();
      }
      updateRanges() {
          if (this.isRangesSnapped()) {
              this.sepRangesHeight = window.innerHeight;
              this.sepRangesX = this.sepRight;
          }
          else {
              const sepRangesHeight = storageGetItem("ranges-pane-height-percent");
              this.sepRangesHeight = window.innerHeight * sepRangesHeight;
              const sepRangesWidth = storageGetItem("ranges-pane-width-percent");
              this.sepRangesX = this.sepLeft + ((this.sepRight - this.sepLeft) * sepRangesWidth);
          }
      }
      updateLeftWidth() {
          if (this.isLeftSnapped()) {
              this.sepLeft = 0;
          }
          else {
              const sepLeft = storageGetItem("source-pane-percent");
              this.sepLeft = document.body.getBoundingClientRect().width * sepLeft;
          }
      }
      updateRightWidth() {
          if (this.isRightSnapped()) {
              this.sepRight = document.body.getBoundingClientRect().width;
          }
          else {
              const sepRight = storageGetItem("disassembly-pane-percent");
              this.sepRight = document.body.getBoundingClientRect().width * sepRight;
          }
      }
      updateSizes() {
          this.updateLeftWidth();
          this.updateRightWidth();
          this.updateRanges();
      }
      isLeftSnapped() {
          return this.resizerLeft.classed("snapped");
      }
      isRightSnapped() {
          return this.resizerRight.classed("snapped");
      }
      isRangesSnapped() {
          return this.resizerRanges.classed("snapped");
      }
      updateRangesPane() {
          const clientHeight = window.innerHeight;
          const rangesIsHidden = this.ranges.style.visibility === "hidden";
          const resizerSize = rangesIsHidden ? 0 : this.RESIZER_SIZE;
          const sepRangesHeight = rangesIsHidden ? clientHeight : this.sepRangesHeight;
          const sepRangesX = rangesIsHidden ? this.sepRight : this.sepRangesX;
          this.snapper.rangesUpdate(this.snapper.rangesShowHide.dataset.expanded === "1");
          const inLandscapeMode = this.isRangesInLandscapeMode();
          const rangeHeight = inLandscapeMode ? clientHeight - sepRangesHeight : clientHeight;
          this.ranges.style.height = `${rangeHeight}px`;
          const panelWidth = this.sepRight - this.sepLeft - (2 * resizerSize);
          const rangeWidth = inLandscapeMode ? panelWidth : this.sepRight - sepRangesX;
          this.ranges.style.width = `${rangeWidth}px`;
          const multiview = document.getElementById(MULTIVIEW_ID);
          if (multiview && multiview.style) {
              multiview.style.height =
                  `${(inLandscapeMode ? sepRangesHeight - resizerSize : clientHeight)}px`;
              const midWidth = inLandscapeMode ? panelWidth : sepRangesX - this.sepLeft - (3 * resizerSize);
              multiview.style.width = `${midWidth}px`;
              if (inLandscapeMode) {
                  this.middle.classList.remove("display-inline-flex");
              }
              else {
                  this.middle.classList.add("display-inline-flex");
              }
          }
          // Resize the range grid and labels.
          const rangeGrid = this.ranges.getElementsByClassName("range-grid")[0];
          if (rangeGrid) {
              const yAxis = this.ranges.getElementsByClassName("range-y-axis")[0];
              const rangeHeader = this.ranges.getElementsByClassName("range-header")[0];
              const rangeTitle = this.ranges.getElementsByClassName("range-title-div")[0];
              let gridWidth = rangeWidth - yAxis.clientWidth;
              if (this.ranges.classList.contains("flipped")) {
                  const rangeRegisters = this.ranges.getElementsByClassName("range-registers")[0];
                  if (rangeRegisters.offsetWidth + FLIPPED_REGISTER_WIDTH_BUFFER < gridWidth) {
                      gridWidth = Math.floor(rangeRegisters.offsetWidth + rangeGrid.offsetWidth
                          - rangeGrid.clientWidth + FLIPPED_REGISTER_WIDTH_BUFFER);
                  }
              }
              rangeTitle.style.width = `${rangeWidth}px`;
              rangeGrid.style.width = `${gridWidth - 1}px`;
              // Take live ranges' right scrollbar into account.
              rangeHeader.style.width =
                  `${(gridWidth - rangeGrid.offsetWidth + rangeGrid.clientWidth - 1)}px`;
              this.resizerRanges.style("width", inLandscapeMode ? `${rangeWidth}px` : `${resizerSize}px`);
              this.resizerRanges.style("height", inLandscapeMode ? `${resizerSize}px` : `${clientHeight}px`);
              const rangeHeaderLabel = this.ranges.getElementsByClassName("range-header-label-x")[0];
              const gridHeight = rangeHeight - rangeHeader.clientHeight
                  - rangeTitle.clientHeight - rangeHeaderLabel.clientHeight;
              rangeGrid.style.height = `${gridHeight}px`;
              // Take live ranges' bottom scrollbar into account.
              yAxis.style.height = `${(gridHeight - rangeGrid.offsetHeight + rangeGrid.clientHeight)}px`;
          }
          else {
              this.resizerRanges.style("width", "0px");
              this.resizerRanges.style("height", "0px");
          }
          this.resizerRanges.style("ranges", this.ranges.style.height);
      }
      dragRangesEnd(y, isSnappedX) {
          // If the panel is close enough to the bottom, treat it as if it was pulled all the way to the
          // bottom.
          const isSnappedY = this.rangesInLandscapeMode
              && (y >= (window.innerHeight - this.deadHeight));
          if (isSnappedX || isSnappedY) {
              if (isSnappedX) {
                  this.sepRangesX = this.sepRight;
              }
              if (isSnappedY) {
                  this.sepRangesHeight = window.innerHeight;
              }
              this.updatePanes();
          }
          // Snap if dragged all the way to the bottom.
          this.resizerRanges.classed("snapped", (!this.rangesInLandscapeMode && (this.sepRangesX >= this.sepRight - 1)) ||
              (this.rangesInLandscapeMode && (this.sepRangesHeight >= window.innerHeight - 1)));
          if (!this.isRangesSnapped()) {
              if (this.rangesInLandscapeMode) {
                  storageSetItem("ranges-pane-height-percent", this.sepRangesHeight / window.innerHeight);
              }
              else {
                  storageSetItem("ranges-pane-width-percent", (this.sepRangesX - this.sepLeft) / (this.sepRight - this.sepLeft));
              }
          }
          this.snapper.setRangesExpanded(!this.isRangesSnapped());
          this.resizerRanges.classed("dragged", false);
      }
  }

  // Copyright 2022 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
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

  // Copyright 2022 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  class HistoryView extends View {
      constructor(id, broker, sourceResolver, showPhaseByName) {
          super(id);
          this.broker = broker;
          this.sourceResolver = sourceResolver;
          this.showPhaseByName = showPhaseByName;
          this.historyHandler = this.initializeNodeSelectionHandler();
          this.broker.addHistoryHandler(this.historyHandler);
          this.phaseIdToHistory = new Map();
          this.x = 0;
          this.y = 0;
          this.initializeSvgHistoryContainer();
      }
      createViewElement() {
          return createElement("div", "history-container");
      }
      hide() {
          super.hide();
          this.broker.deleteHistoryHandler(this.historyHandler);
      }
      initializeSvgHistoryContainer() {
          this.svg = select(this.divNode)
              .append("svg")
              .classed("history-svg-container", true)
              .attr("version", "2.0")
              .attr("transform", _ => `translate(${this.x},${this.y})`)
              .style("visibility", "hidden");
          const dragHandler = drag().on("drag", () => {
              const rect = document.body.getBoundingClientRect();
              const x = this.x + event.dx;
              this.x = event.dx > 0 ? Math.min(x, rect.width - this.getWidth()) : Math.max(x, 0);
              const y = this.y + event.dy;
              this.y = event.dy > 0 ? Math.min(y, rect.height - this.getHeight()) : Math.max(y, 0);
              this.svg.attr("transform", _ => `translate(${this.x},${this.y})`);
          });
          this.svg.call(dragHandler);
      }
      initializeNodeSelectionHandler() {
          const view = this;
          return {
              showNodeHistory: function (node, phaseName) {
                  view.clear();
                  view.node = node;
                  const phaseId = view.sourceResolver.getPhaseIdByName(phaseName);
                  const historyChain = view.getHistoryChain(phaseId, node);
                  view.getPhaseHistory(historyChain);
                  view.render();
              }
          };
      }
      render() {
          this.setLabel();
          this.svg
              .attr("width", this.getWidth())
              .attr("height", this.getHeight());
          this.svg
              .append("text")
              .classed("history-label", true)
              .attr("text-anchor", "middle")
              .attr("x", this.getWidth() / 2)
              .append("tspan")
              .text(this.label);
          this.svg
              .append("circle")
              .classed("close-button", true)
              .attr("r", this.labelBox.height / 4)
              .attr("cx", this.getWidth() - this.labelBox.height / 2)
              .attr("cy", this.labelBox.height / 2)
              .on("click", () => {
              event.stopPropagation();
              this.clear();
              this.svg.style("visibility", "hidden");
          });
          this.historyList = this.svg
              .append("g")
              .attr("clip-path", "url(#history-clip-path)");
          this.renderHistoryContent();
          this.renderHistoryContentScroll();
          this.svg.style("visibility", "visible");
      }
      renderHistoryContent() {
          const existCircles = new Set();
          const defs = this.svg.append("svg:defs");
          let recordY = 0;
          for (const [phaseId, phaseHistory] of this.phaseIdToHistory.entries()) {
              if (!phaseHistory.hasChanges())
                  continue;
              const phaseName = this.sourceResolver.getPhaseNameById(phaseId);
              this.historyList
                  .append("text")
                  .classed("history-item", true)
                  .attr("dy", recordY)
                  .append("tspan")
                  .text(phaseName);
              recordY += this.labelBox.height;
              for (const record of phaseHistory.nodeIdToRecord.values()) {
                  const changes = Array.from(record.changes.values()).sort();
                  const circleId = changes.map(i => HistoryChange[i]).join("-");
                  if (!existCircles.has(circleId)) {
                      const def = defs.append("linearGradient")
                          .attr("id", circleId);
                      const step = 100 / changes.length;
                      for (let i = 0; i < changes.length; i++) {
                          const start = i * step;
                          const stop = (i + 1) * step;
                          def.append("stop")
                              .attr("offset", `${start}%`)
                              .style("stop-color", this.getHistoryChangeColor(changes[i]));
                          def.append("stop")
                              .attr("offset", `${stop}%`)
                              .style("stop-color", this.getHistoryChangeColor(changes[i]));
                      }
                      existCircles.add(circleId);
                  }
                  this.historyList
                      .append("circle")
                      .classed("history-item", true)
                      .attr("r", this.labelBox.height / 3.5)
                      .attr("cx", this.labelBox.height / 3)
                      .attr("cy", this.labelBox.height / 2.5 + recordY)
                      .attr("fill", `url(#${circleId})`)
                      .append("title")
                      .text(`[${record.toString()}]`);
                  this.historyList
                      .append("text")
                      .classed("history-item history-item-record", true)
                      .classed("current-history-item", record.changes.has(HistoryChange.Current))
                      .attr("dy", recordY)
                      .attr("dx", this.labelBox.height * 0.75)
                      .append("tspan")
                      .text(record.node.displayLabel)
                      .on("click", () => {
                      if (!record.changes.has(HistoryChange.Removed)) {
                          const selectionStorage = new SelectionStorage();
                          selectionStorage.adaptNode(record.node.identifier());
                          this.showPhaseByName(phaseName, selectionStorage);
                      }
                  })
                      .append("title")
                      .text(record.node.getTitle());
                  recordY += this.labelBox.height;
              }
          }
      }
      renderHistoryContentScroll() {
          let scrollDistance = 0;
          const historyArea = {
              x: HISTORY_CONTENT_INDENT,
              y: this.labelBox.height + HISTORY_CONTENT_INDENT / 2,
              width: this.getWidth() - HISTORY_CONTENT_INDENT * 2,
              height: this.getHeight() - this.labelBox.height - HISTORY_CONTENT_INDENT * 1.5
          };
          const content = this.historyList
              .append("g")
              .attr("transform", `translate(${historyArea.x},${historyArea.y})`);
          this.historyList
              .selectAll(".history-item")
              .each(function () {
              content.node().appendChild(select(this).node());
          });
          this.historyList
              .append("clipPath")
              .attr("id", "history-clip-path")
              .append("rect")
              .attr("width", historyArea.width)
              .attr("height", historyArea.height)
              .attr("transform", `translate(${historyArea.x},${historyArea.y})`);
          const scrollX = historyArea.x + historyArea.width - HISTORY_SCROLLBAR_WIDTH;
          const scrollBar = this.historyList
              .append("rect")
              .classed("history-content-scroll", true)
              .attr("width", HISTORY_SCROLLBAR_WIDTH)
              .attr("rx", HISTORY_SCROLLBAR_WIDTH / 2)
              .attr("ry", HISTORY_SCROLLBAR_WIDTH / 2)
              .attr("transform", `translate(${scrollX},${historyArea.y})`);
          // Calculate maximum scrollable amount
          const contentBBox = content.node().getBBox();
          const absoluteContentHeight = contentBBox.y + contentBBox.height;
          const scrollbarHeight = historyArea.height * historyArea.height / absoluteContentHeight;
          scrollBar.attr("height", Math.min(scrollbarHeight, historyArea.height));
          const maxScroll = Math.max(absoluteContentHeight - historyArea.height, 0);
          const updateScrollPosition = (diff) => {
              scrollDistance += diff;
              scrollDistance = Math.min(maxScroll, Math.max(0, scrollDistance));
              content.attr("transform", `translate(${historyArea.x},${historyArea.y - scrollDistance})`);
              const scrollBarPosition = scrollDistance / maxScroll * (historyArea.height - scrollbarHeight);
              if (!isNaN(scrollBarPosition))
                  scrollBar.attr("y", scrollBarPosition);
          };
          this.svg.on("wheel", () => {
              updateScrollPosition(event.deltaY);
          });
          const dragBehaviour = drag().on("drag", () => {
              updateScrollPosition(event.dy * maxScroll / (historyArea.height - scrollbarHeight));
          });
          scrollBar.call(dragBehaviour);
      }
      setLabel() {
          this.label = this.node.getHistoryLabel();
          const coefficient = this.getCoefficient("history-tspan-font-size");
          this.labelBox = measureText(this.label, coefficient);
      }
      getCoefficient(varName) {
          const tspanSize = getNumericCssValue("--tspan-font-size");
          const varSize = getNumericCssValue(`--${varName}`);
          return Math.min(tspanSize, varSize) / Math.max(tspanSize, varSize);
      }
      getPhaseHistory(historyChain) {
          const uniqueAncestors = new Set();
          const coefficient = this.getCoefficient("history-item-tspan-font-size");
          let prevNode = null;
          let first = true;
          for (let i = 0; i < this.sourceResolver.phases.length; i++) {
              const phase = this.sourceResolver.getGraphPhase(i);
              if (!phase)
                  continue;
              const phaseNameMeasure = measureText(phase.name, coefficient);
              this.maxPhaseNameWidth = Math.max(this.maxPhaseNameWidth, phaseNameMeasure.width);
              const node = historyChain.get(i);
              if (!node && prevNode) {
                  this.addToHistory(i, prevNode, HistoryChange.Removed);
              }
              if (phase.type == PhaseType.Graph && node &&
                  phase.originIdToNodesMap.has(node.identifier())) {
                  this.addHistoryAncestors(node.identifier(), phase, uniqueAncestors);
              }
              if (phase.type == PhaseType.TurboshaftGraph && node?.getNodeOrigin().phase == phase.name) {
                  this.addToHistory(i, node, HistoryChange.Lowered);
              }
              if (phase.type == PhaseType.Graph && prevNode && !prevNode.equals(node) &&
                  phase.originIdToNodesMap.has(prevNode.identifier())) {
                  const prevNodeCurrentState = phase.nodeIdToNodeMap[prevNode.identifier()];
                  if (!prevNodeCurrentState) {
                      this.addToHistory(i, prevNode, HistoryChange.Removed);
                  }
                  else if (!this.nodeEquals(prevNodeCurrentState, node) &&
                      prevNodeCurrentState instanceof GraphNode &&
                      prevNodeCurrentState.getInplaceUpdatePhase() == phase.name) {
                      this.addToHistory(i, prevNodeCurrentState, HistoryChange.InplaceUpdated);
                  }
                  else if (node?.identifier() != prevNode.identifier()) {
                      this.addToHistory(i, prevNodeCurrentState, HistoryChange.Survived);
                  }
                  this.addHistoryAncestors(prevNode.identifier(), phase, uniqueAncestors);
              }
              if (!node) {
                  prevNode = null;
                  continue;
              }
              if (node instanceof GraphNode && node.getInplaceUpdatePhase() == phase.name) {
                  this.addToHistory(i, node, HistoryChange.InplaceUpdated);
              }
              if (first) {
                  this.addToHistory(i, node, HistoryChange.Emerged);
                  first = false;
              }
              this.addToHistory(i, node, HistoryChange.Current);
              prevNode = node;
          }
      }
      addHistoryAncestors(key, phase, uniqueAncestors) {
          let changed = false;
          const phaseId = this.sourceResolver.getPhaseIdByName(phase.name);
          for (const ancestor of phase.originIdToNodesMap.get(key)) {
              const key = ancestor.identifier();
              if (!uniqueAncestors.has(key)) {
                  this.addToHistory(phaseId, ancestor, HistoryChange.Lowered);
                  uniqueAncestors.add(key);
                  changed = true;
              }
          }
          return changed;
      }
      getHistoryChain(phaseId, node) {
          const leftChain = this.getLeftHistoryChain(phaseId, node);
          const rightChain = this.getRightHistoryChain(phaseId, node);
          return new Map([...leftChain, ...rightChain]);
      }
      getLeftHistoryChain(phaseId, node) {
          const leftChain = new Map();
          for (let i = phaseId; i >= 0; i--) {
              const phase = this.sourceResolver.getGraphPhase(i);
              if (!phase)
                  continue;
              const nodeKey = node instanceof GraphNode || i == phaseId || node.origin.phase == phase.name
                  ? node.identifier()
                  : node.origin.identifier();
              let currentNode = phase.nodeIdToNodeMap[nodeKey];
              if (!currentNode) {
                  const nodeOrigin = node.getNodeOrigin();
                  if (nodeOrigin) {
                      currentNode = phase.nodeIdToNodeMap[nodeOrigin.identifier()];
                  }
                  if (!currentNode)
                      return leftChain;
              }
              leftChain.set(i, currentNode);
              node = currentNode;
          }
          return leftChain;
      }
      getRightHistoryChain(phaseId, node) {
          const rightChain = new Map();
          for (let i = phaseId + 1; i < this.sourceResolver.phases.length; i++) {
              const phase = this.sourceResolver.getGraphPhase(i);
              if (!phase)
                  continue;
              let currentNode = null;
              if (phase.type == PhaseType.TurboshaftGraph) {
                  const currentNodeState = phase.nodeIdToNodeMap[node.identifier()];
                  if (node.equals(currentNodeState)) {
                      currentNode = currentNodeState;
                  }
                  else {
                      const nodes = phase.originIdToNodesMap.get(node.identifier());
                      if (nodes?.length == 1 && nodes[0].getNodeOrigin().phase == phase.name) {
                          currentNode = nodes[0];
                      }
                      else if (nodes?.length > 1) {
                          return rightChain;
                      }
                  }
              }
              else {
                  currentNode = phase.nodeIdToNodeMap[node.identifier()];
              }
              if (!currentNode)
                  return rightChain;
              rightChain.set(i, currentNode);
              node = currentNode;
          }
          return rightChain;
      }
      addToHistory(phaseId, node, change) {
          if (!this.phaseIdToHistory.has(phaseId)) {
              this.phaseIdToHistory.set(phaseId, new PhaseHistory(phaseId));
          }
          this.phaseIdToHistory.get(phaseId).addChange(node, change);
          if (change == HistoryChange.Current) {
              this.maxNodeWidth = Math.max(this.maxNodeWidth, node.labelBox.width * 1.07);
          }
          else {
              this.maxNodeWidth = Math.max(this.maxNodeWidth, node.labelBox.width);
          }
      }
      nodeEquals(first, second) {
          if (!first || !second)
              return false;
          if ((first instanceof GraphNode && second instanceof GraphNode)) {
              return first.equals(second);
          }
          else if (first instanceof TurboshaftGraphOperation && second instanceof TurboshaftGraphOperation) {
              return first.equals(second);
          }
          return first.getHistoryLabel() == second.getHistoryLabel();
      }
      clear() {
          this.phaseIdToHistory.clear();
          this.maxNodeWidth = 0;
          this.maxPhaseNameWidth = 0;
          this.svg.selectAll("*").remove();
      }
      getWidth() {
          const scrollWidth = HISTORY_SCROLLBAR_WIDTH / 2 + HISTORY_SCROLLBAR_WIDTH;
          const indentWidth = 2 * HISTORY_CONTENT_INDENT;
          const labelWidth = this.labelBox.width + 3 * this.labelBox.height;
          const phaseNameWidth = this.maxPhaseNameWidth + indentWidth + scrollWidth;
          const contentWidth = this.labelBox.height * 0.75 + indentWidth + scrollWidth
              + (this.maxNodeWidth * this.getCoefficient("history-item-tspan-font-size"));
          return Math.max(labelWidth, phaseNameWidth, contentWidth);
      }
      getHeight() {
          return window.screen.availHeight * HISTORY_DEFAULT_HEIGHT_PERCENT;
      }
      getHistoryChangeColor(historyChange) {
          switch (historyChange) {
              case HistoryChange.Current:
                  return "rgb(255, 167, 0)";
              case HistoryChange.Emerged:
                  return "rgb(160, 83, 236)";
              case HistoryChange.Lowered:
                  return "rgb(0, 255, 0)";
              case HistoryChange.InplaceUpdated:
                  return "rgb(57, 57, 208)";
              case HistoryChange.Removed:
                  return "rgb(255, 0, 0)";
              case HistoryChange.Survived:
                  return "rgb(7, 253, 232)";
          }
      }
      traceToConsole() {
          const keys = Array.from(this.phaseIdToHistory.keys()).sort((a, b) => a - b);
          for (const key of keys) {
              console.log(`${key} ${this.sourceResolver.getPhaseNameById(key)}`);
              const phaseHistory = this.phaseIdToHistory.get(key);
              for (const record of phaseHistory.nodeIdToRecord.values()) {
                  console.log(record.toString(), record.node);
              }
          }
      }
  }
  class PhaseHistory {
      constructor(phaseId) {
          this.phaseId = phaseId;
          this.nodeIdToRecord = new Map();
      }
      addChange(node, change) {
          const key = node.identifier();
          if (!this.nodeIdToRecord.has(key)) {
              this.nodeIdToRecord.set(key, new HistoryRecord(node));
          }
          this.nodeIdToRecord.get(key).addChange(change);
      }
      hasChanges() {
          for (const record of this.nodeIdToRecord.values()) {
              if (record.hasChanges())
                  return true;
          }
          return false;
      }
  }
  class HistoryRecord {
      constructor(node) {
          this.node = node;
          this.changes = new Set();
      }
      addChange(change) {
          this.changes.add(change);
      }
      hasChanges() {
          return this.changes.size > 1 ||
              (this.changes.size == 1 && !this.changes.has(HistoryChange.Current));
      }
      toString() {
          return Array.from(this.changes.values()).sort().map(i => HistoryChange[i]).join(", ");
      }
  }
  var HistoryChange;
  (function (HistoryChange) {
      HistoryChange[HistoryChange["Current"] = 0] = "Current";
      HistoryChange[HistoryChange["Emerged"] = 1] = "Emerged";
      HistoryChange[HistoryChange["Lowered"] = 2] = "Lowered";
      HistoryChange[HistoryChange["InplaceUpdated"] = 3] = "InplaceUpdated";
      HistoryChange[HistoryChange["Removed"] = 4] = "Removed";
      HistoryChange[HistoryChange["Survived"] = 5] = "Survived";
  })(HistoryChange || (HistoryChange = {}));

  // Copyright 2022 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  class BytecodeSourceView extends View {
      constructor(parent, broker, sourceFunction, sourceResolver, codeMode) {
          super(parent);
          this.broker = broker;
          this.source = sourceFunction;
          this.sourceResolver = sourceResolver;
          this.codeMode = codeMode;
          this.bytecodeOffsetToHtmlElement = new Map();
          this.bytecodeOffsetSelection = new SelectionMap((offset) => String(offset));
          this.bytecodeOffsetSelectionHandler = this.initializeBytecodeOffsetSelectionHandler();
          this.broker.addBytecodeOffsetHandler(this.bytecodeOffsetSelectionHandler);
          this.initializeCode();
      }
      createViewElement() {
          return createElement("div", "bytecode-source-container");
      }
      initializeCode() {
          const view = this;
          const source = this.source;
          const bytecodeContainer = this.divNode;
          bytecodeContainer.classList.add(view.getSourceClass());
          const bytecodeHeader = createElement("div", "code-header");
          bytecodeHeader.setAttribute("id", view.getBytecodeHeaderHtmlElementName());
          const codeFileFunction = createElement("div", "code-file-function", source.functionName);
          bytecodeHeader.appendChild(codeFileFunction);
          const codeMode = createElement("div", "code-mode", view.codeMode);
          bytecodeHeader.appendChild(codeMode);
          const clearElement = document.createElement("div");
          clearElement.style.clear = "both";
          bytecodeHeader.appendChild(clearElement);
          bytecodeContainer.appendChild(bytecodeHeader);
          const codePre = createElement("pre", "prettyprint linenums");
          codePre.setAttribute("id", view.getBytecodeHtmlElementName());
          bytecodeContainer.appendChild(codePre);
          bytecodeHeader.onclick = () => {
              codePre.style.display = codePre.style.display === "none" ? "block" : "none";
          };
          const sourceList = createElement("ol", "linenums");
          for (const bytecodeSource of view.source.data) {
              const currentLine = createElement("li", `L${bytecodeSource.offset}`);
              currentLine.setAttribute("id", `li${bytecodeSource.offset}`);
              view.insertLineContent(currentLine, bytecodeSource.disassembly);
              view.insertLineNumber(currentLine, bytecodeSource.offset);
              view.bytecodeOffsetToHtmlElement.set(bytecodeSource.offset, currentLine);
              sourceList.appendChild(currentLine);
          }
          codePre.appendChild(sourceList);
          if (!view.source.constantPool)
              return;
          const constantList = createElement("ol", "linenums constants");
          const constantListHeader = createElement("li", "");
          view.insertLineContent(constantListHeader, `Constant pool (size = ${view.source.constantPool.length})`);
          constantList.appendChild(constantListHeader);
          for (const [idx, constant] of view.source.constantPool.entries()) {
              const currentLine = createElement("li", `C${idx}`);
              view.insertLineContent(currentLine, `${idx}: ${constant}`);
              constantList.appendChild(currentLine);
          }
          codePre.appendChild(constantList);
      }
      initializeBytecodeOffsetSelectionHandler() {
          const view = this;
          const broker = this.broker;
          return {
              select: function (offsets, selected) {
                  const bytecodePositions = new Array();
                  for (const offset of offsets) {
                      view.source.inliningIds.forEach(inliningId => bytecodePositions.push(new BytecodePosition(offset, inliningId)));
                  }
                  view.bytecodeOffsetSelection.select(offsets, selected);
                  view.updateSelection();
                  broker.broadcastBytecodePositionsSelect(this, bytecodePositions, selected);
              },
              clear: function () {
                  view.bytecodeOffsetSelection.clear();
                  view.updateSelection();
                  broker.broadcastClear(this);
              },
              brokeredBytecodeOffsetSelect: function (positions, selected) {
                  const offsets = new Array();
                  const firstSelect = view.bytecodeOffsetSelection.isEmpty();
                  for (const position of positions) {
                      if (view.source.inliningIds.includes(position.inliningId)) {
                          offsets.push(position.bytecodePosition);
                      }
                  }
                  view.bytecodeOffsetSelection.select(offsets, selected);
                  view.updateSelection(firstSelect);
              },
              brokeredClear: function () {
                  view.bytecodeOffsetSelection.clear();
                  view.updateSelection();
              },
          };
      }
      getBytecodeHeaderHtmlElementName() {
          return `source-pre-${this.source.sourceId}-header`;
      }
      getBytecodeHtmlElementName() {
          return `source-pre-${this.source.sourceId}`;
      }
      getSourceClass() {
          return this.codeMode == CodeMode.MainSource ? "main-source" : "inlined-source";
      }
      updateSelection(scrollIntoView = false) {
          const mkVisible = new ViewElements(this.divNode.parentNode);
          for (const [offset, element] of this.bytecodeOffsetToHtmlElement.entries()) {
              const key = this.bytecodeOffsetSelection.stringKey(offset);
              const isSelected = this.bytecodeOffsetSelection.isKeySelected(key);
              mkVisible.consider(element, isSelected);
              element.classList.toggle("selected", isSelected);
          }
          mkVisible.apply(scrollIntoView);
      }
      onSelectBytecodeOffset(offset, doClear) {
          if (doClear) {
              this.bytecodeOffsetSelectionHandler.clear();
          }
          this.bytecodeOffsetSelectionHandler.select([offset], undefined);
      }
      insertLineContent(lineElement, content) {
          const lineContentElement = createElement("span", "", content);
          lineElement.appendChild(lineContentElement);
      }
      insertLineNumber(lineElement, lineNumber) {
          const view = this;
          const lineNumberElement = createElement("div", "line-number", String(lineNumber));
          lineNumberElement.onclick = function (e) {
              e.stopPropagation();
              view.onSelectBytecodeOffset(lineNumber, !e.shiftKey);
          };
          lineElement.insertBefore(lineNumberElement, lineElement.firstChild);
      }
  }

  // Copyright 2017 the V8 project authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.
  window.onload = function () {
      let multiview;
      let disassemblyView;
      let sourceViews = new Array();
      let bytecodeSourceViews = new Array();
      let historyView;
      let selectionBroker;
      let sourceResolver;
      const resizer = new Resizer(() => multiview?.onresize(), 75, 75);
      const disassemblyTabsContainer = document.getElementById(GENERATED_PANE_ID);
      const disassemblyTabs = new Tabs(disassemblyTabsContainer);
      disassemblyTabs.addTab("&#x2b;").classList.add("last-tab", "persistent-tab");
      const sourceTabsContainer = document.getElementById(SOURCE_PANE_ID);
      const sourceTabs = new Tabs(sourceTabsContainer);
      sourceTabs.addTab("&#x2b;").classList.add("last-tab", "persistent-tab");
      const [infoTab, infoContainer] = sourceTabs.addTabAndContent("Info");
      infoTab.classList.add("persistent-tab");
      infoContainer.classList.add("viewpane", "scrollable");
      const infoView = new InfoView(infoContainer);
      infoView.show();
      sourceTabs.activateTab(infoTab);
      function loadFile(txtRes) {
          sourceTabs.clearTabsAndContent();
          disassemblyTabs.clearTabsAndContent();
          // If the JSON isn't properly terminated, assume compiler crashed and
          // add best-guess empty termination
          if (txtRes[txtRes.length - 2] === ",") {
              txtRes += '{"name":"disassembly","type":"disassembly","data":""}]}';
          }
          try {
              sourceViews.forEach(sv => sv.hide());
              bytecodeSourceViews.forEach(bsv => bsv.hide());
              multiview?.hide();
              multiview = null;
              document.getElementById("ranges").innerHTML = "";
              document.getElementById("ranges").style.visibility = "hidden";
              document.getElementById("show-hide-ranges").style.visibility = "hidden";
              disassemblyView?.hide();
              historyView?.hide();
              sourceViews = new Array();
              bytecodeSourceViews = new Array();
              sourceResolver = new SourceResolver();
              selectionBroker = new SelectionBroker(sourceResolver);
              const jsonObj = JSON.parse(txtRes);
              const mainFunction = sourceResolver.getMainFunction(jsonObj);
              sourceResolver.setInlinings(jsonObj.inlinings);
              sourceResolver.setSourceLineToBytecodePosition(jsonObj.sourceLineToBytecodePosition);
              sourceResolver.setSources(jsonObj.sources, mainFunction);
              sourceResolver.setBytecodeSources(jsonObj.bytecodeSources);
              sourceResolver.setFinalNodeOrigins(jsonObj.nodeOrigins);
              sourceResolver.parsePhases(jsonObj.phases);
              const [sourceTab, sourceContainer] = sourceTabs.addTabAndContent("Source");
              sourceContainer.classList.add("viewpane", "scrollable");
              sourceTabs.activateTab(sourceTab);
              const sourceView = new CodeView(sourceContainer, selectionBroker, mainFunction, sourceResolver, CodeMode.MainSource);
              sourceView.show();
              sourceViews.push(sourceView);
              for (const source of sourceResolver.sources) {
                  const sourceView = new CodeView(sourceContainer, selectionBroker, source, sourceResolver, CodeMode.InlinedSource);
                  sourceView.show();
                  sourceViews.push(sourceView);
              }
              if (sourceResolver.bytecodeSources.size > 0) {
                  const [_, bytecodeContainer] = sourceTabs.addTabAndContent("Bytecode");
                  bytecodeContainer.classList.add("viewpane", "scrollable");
                  const bytecodeSources = Array.from(sourceResolver.bytecodeSources.values()).reverse();
                  for (const source of bytecodeSources) {
                      const codeMode = source.sourceId == -1 ? CodeMode.MainSource : CodeMode.InlinedSource;
                      const bytecodeSourceView = new BytecodeSourceView(bytecodeContainer, selectionBroker, source, sourceResolver, codeMode);
                      bytecodeSourceView.show();
                      bytecodeSourceViews.push(bytecodeSourceView);
                  }
              }
              const [disassemblyTab, disassemblyContainer] = disassemblyTabs.addTabAndContent("Disassembly");
              disassemblyContainer.classList.add("viewpane", "scrollable");
              disassemblyTabs.activateTab(disassemblyTab);
              disassemblyView = new DisassemblyView(disassemblyContainer, selectionBroker);
              disassemblyView.initializeCode(mainFunction.sourceText);
              if (sourceResolver.disassemblyPhase) {
                  disassemblyView.initializePerfProfile(jsonObj.eventCounts);
                  disassemblyView.showContent(sourceResolver.disassemblyPhase);
                  disassemblyView.show();
              }
              multiview = new GraphMultiView(INTERMEDIATE_PANE_ID, selectionBroker, sourceResolver);
              multiview.show();
              historyView = new HistoryView(HISTORY_ID, selectionBroker, sourceResolver, multiview.displayPhaseByName.bind(multiview));
              historyView.show();
          }
          catch (err) {
              if (window.confirm("Error: Exception during load of TurboFan JSON file:\n" +
                  `error: ${err} \nDo you want to clear session storage?`)) {
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
                  const fileReader = new FileReader();
                  fileReader.onload = () => {
                      document.title = uploadFile.name.replace(".json", "");
                      const txtRes = fileReader.result;
                      if (typeof txtRes === "string") {
                          loadFile(txtRes);
                      }
                  };
                  fileReader.readAsText(uploadFile);
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

})();
//# sourceMappingURL=turbolizer.js.map
