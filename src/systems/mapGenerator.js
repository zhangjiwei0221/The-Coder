import { rand, pick } from '../core/utils.js';
import { ENEMIES } from '../data/enemies.js';

const NODE_META = {
  battle: { icon: '⚔️', label: '战斗' },
  event: { icon: '❓', label: '事件' },
  shop: { icon: '🏪', label: '商店' },
  rest: { icon: '🔥', label: '休息' },
  treasure: { icon: '💎', label: '宝箱' },
  elite: { icon: '💀', label: '精英' },
};

// === MAP GENERATOR ===
export const MapGenerator = {
  LAYER_NAMES: ['Bug 领域', 'Error Zone', 'Kernel Space'],
  LAYER_COLS: [11, 10, 11],

  generate(floors = 3) {
    return Array.from({ length: floors }, (_, floor) => this._buildLayer(floor));
  },

  _buildLayer(floor) {
    const numCols = this.LAYER_COLS[floor] || 10;
    const columns = [];
    const nodesById = {};

    for (let col = 0; col < numCols; col++) {
      const count = this._nodeCountForCol(col, numCols);
      const ySlots = this._createYSlots(count);
      const column = ySlots.map((y, index) => {
        const node = this._makeNode(
          `f${floor}-c${col}-n${index}`,
          col,
          y,
          ...this._nodeBlueprint(floor, col, numCols)
        );
        nodesById[node.id] = node;
        return node;
      });
      columns.push(column);
    }

    if (floor === 0 && columns[0]?.[0]) {
      columns[0][0].type = 'battle';
      columns[0][0].icon = '🐛';
      columns[0][0].label = '教学';
    }

    this._injectSpecialNodes(columns, floor, numCols);
    this._connectColumns(columns);

    const bossNode = {
      id: `f${floor}-boss`,
      type: 'boss',
      icon: ['☠️', '🔥', '💀'][floor] || '💀',
      label: ['红字审判', 'Firewall', 'Root'][floor] || 'Boss',
      col: numCols,
      y: 0.5,
      nextIds: [],
      prevIds: columns[numCols - 1].map(node => node.id),
      visited: false,
      available: false,
      revealed: true,
    };

    for (const node of columns[numCols - 1]) {
      node.nextIds.push(bossNode.id);
    }

    return {
      numCols,
      columns,
      nodesById,
      bossNode,
      currentNodeId: null,
    };
  },

  _nodeCountForCol(col, numCols) {
    if (col === 0) return 1;
    if (col === numCols - 1) return 2;
    if (col <= 2) return rand(2, 3);
    if (col >= numCols - 3) return rand(2, 3);
    return rand(2, 4);
  },

  _createYSlots(count) {
    const presets = {
      1: [0.5],
      2: [0.28, 0.72],
      3: [0.18, 0.5, 0.82],
      4: [0.12, 0.36, 0.64, 0.88],
    };
    return (presets[count] || presets[3]).map(value => {
      const jitter = count === 1 ? 0 : ((Math.random() - 0.5) * 0.06);
      return Math.max(0.1, Math.min(0.9, value + jitter));
    });
  },

  _nodeBlueprint(floor, col, numCols) {
    if (col === 0) return ['battle', NODE_META.battle.icon, NODE_META.battle.label];

    const progress = col / Math.max(1, numCols - 1);
    const roll = Math.random();
    let type = 'battle';

    if (progress < 0.22) {
      if (roll < 0.62) type = 'battle';
      else if (roll < 0.8) type = 'event';
      else if (roll < 0.92) type = 'shop';
      else type = 'rest';
    } else if (progress < 0.68) {
      if (roll < 0.42) type = 'battle';
      else if (roll < 0.58) type = 'event';
      else if (roll < 0.72) type = 'shop';
      else if (roll < 0.84) type = 'treasure';
      else if (roll < 0.94) type = 'rest';
      else type = 'elite';
    } else {
      if (roll < 0.32) type = 'battle';
      else if (roll < 0.5) type = 'event';
      else if (roll < 0.62) type = 'treasure';
      else if (roll < 0.78) type = 'rest';
      else if (roll < 0.9) type = 'shop';
      else type = 'elite';
    }

    if (floor >= 2 && progress > 0.55 && type === 'battle' && Math.random() < 0.22) {
      type = 'elite';
    }

    return [type, NODE_META[type].icon, NODE_META[type].label];
  },

  _injectSpecialNodes(columns, floor, numCols) {
    const pickNodeInCol = (col, fallbackType = 'battle') => {
      const column = columns[Math.max(0, Math.min(numCols - 1, col))];
      if (!column?.length) return null;
      return pick(column.filter(node => node.type !== 'elite')) || pick(column) || null;
    };

    const mustHave = [
      [Math.min(2, numCols - 2), 'event'],
      [Math.min(3, numCols - 2), 'shop'],
      [Math.max(4, Math.floor(numCols * 0.45)), 'treasure'],
      [Math.max(5, Math.floor(numCols * 0.62)), 'elite'],
      [numCols - 1, 'rest'],
    ];

    mustHave.forEach(([col, type]) => {
      const target = pickNodeInCol(col);
      if (target) this._setNodeType(target, type);
    });

    if (floor >= 1) {
      const extraElite = pickNodeInCol(Math.max(6, Math.floor(numCols * 0.78)));
      if (extraElite) this._setNodeType(extraElite, 'elite');
    }
  },

  _setNodeType(node, type) {
    node.type = type;
    node.icon = NODE_META[type].icon;
    node.label = NODE_META[type].label;
  },

  _connectColumns(columns) {
    for (let col = 0; col < columns.length - 1; col++) {
      const current = [...columns[col]].sort((a, b) => a.y - b.y);
      const next = [...columns[col + 1]].sort((a, b) => a.y - b.y);

      current.forEach((node, index) => {
        const ordered = [...next].sort((a, b) => Math.abs(a.y - node.y) - Math.abs(b.y - node.y));
        const degree = (next.length > 2 && Math.random() < 0.5) ? 2 : 1;
        const chosen = ordered.slice(0, degree);
        if (next.length > 1 && index === 0 && !chosen.includes(next[0])) chosen.push(next[0]);
        if (next.length > 1 && index === current.length - 1 && !chosen.includes(next[next.length - 1])) chosen.push(next[next.length - 1]);
        chosen.forEach(target => this._link(node, target));
      });

      next.forEach(target => {
        if (!target.prevIds.length) {
          const source = [...current].sort((a, b) => Math.abs(a.y - target.y) - Math.abs(b.y - target.y))[0];
          if (source) this._link(source, target);
        }
      });
    }
  },

  _link(from, to) {
    if (!from.nextIds.includes(to.id)) from.nextIds.push(to.id);
    if (!to.prevIds.includes(from.id)) to.prevIds.push(from.id);
  },

  _makeNode(id, col, y, type, icon, label) {
    return {
      id,
      type,
      icon,
      label,
      col,
      y,
      nextIds: [],
      prevIds: [],
      visited: false,
      available: false,
      revealed: true,
    };
  },

  getEnemyForNode(node, floor) {
    if (node.type === 'boss') return ENEMIES[['syntaxerr', 'firewall', 'root'][floor] || 'root'];
    if (node.label === '教学') return ENEMIES.bug;
    if (node.type === 'elite') {
      const elites = [
        ['nullptr', 'chaser', 'todo'],
        ['recursion', 'deadlock', 'stackoverflow'],
        ['deadlock', 'racecond', 'gc'],
      ];
      return ENEMIES[pick(elites[floor] || elites[0])];
    }
    const regular = [
      ['bug', 'typo', 'redpoint', 'nullptr', 'chaser', 'todo'],
      ['infloop', 'memleak', 'racecond', 'gc'],
      ['stackoverflow', 'recursion', 'deadlock'],
    ];
    return ENEMIES[pick(regular[floor] || regular[0])];
  },
};
