import { rand, pick } from '../core/utils.js';
import { ENEMIES } from '../data/enemies.js';

// === MAP GENERATOR ===
export const MapGenerator = {
  LAYER_NAMES: ['Bug 领域', 'Error Zone', 'Kernel Space'],
  LAYER_COLS: [16, 13, 15],
  generate(floors=3) {
    const allLayers = [];
    for (let f=0;f<floors;f++) {
      const numCols = this.LAYER_COLS[f] || 11;
      const grid = [];
      for (let r=0;r<3;r++) {
        grid[r] = [];
        for (let c=0;c<numCols;c++) {
          grid[r][c] = this._genNode(r, c, numCols, f);
        }
      }
      if (f===0) {
        // === FLOOR 1: Fixed 16-column structure ===
        // Col 0: Bug tutorial — only middle row, others empty/blocked
        grid[0][0] = this._makeNode(0,0,'empty','','');
        grid[1][0] = this._makeNode(1,0,'battle','🐛','教学');
        grid[2][0] = this._makeNode(2,0,'empty','','');
        // Cols 1-4: Early stage — mostly battles, 1 event, 1 shop
        for (let r=0;r<3;r++) for (let c=1;c<=4;c++) {
          grid[r][c] = this._makeNode(r,c,'battle','⚔️','战斗');
        }
        // Sprinkle some variety in early cols
        grid[rand(0,2)][2] = this._makeNode(rand(0,2),2,'event','❓','事件');
        grid[rand(0,2)][3] = this._makeNode(rand(0,2),3,'shop','🏪','商店');
        // Cols 5-9: Mid stage — mixed, add elites and events
        for (let r=0;r<3;r++) for (let c=5;c<=9;c++) {
          grid[r][c] = this._genNode(r,c,numCols,f);
        }
        grid[rand(0,2)][6] = this._makeNode(rand(0,2),6,'elite','💀','精英');
        grid[rand(0,2)][8] = this._makeNode(rand(0,2),8,'elite','💀','精英');
        // Cols 10-14: Late stage — harder, more elites, rest before boss
        for (let r=0;r<3;r++) for (let c=10;c<=14;c++) {
          grid[r][c] = this._genNode(r,c,numCols,f);
        }
        grid[rand(0,2)][11] = this._makeNode(rand(0,2),11,'elite','💀','精英');
        grid[rand(0,2)][12] = this._makeNode(rand(0,2),12,'treasure','💎','宝箱');
        // Col 15 (16th column): Boss battle
        grid[0][numCols-1] = this._makeNode(0,numCols-1,'empty','','');
        grid[1][numCols-1] = this._makeNode(1,numCols-1,'boss','🚫','Boss');
        grid[2][numCols-1] = this._makeNode(2,numCols-1,'empty','','');
      } else {
        // === FLOOR 2+: Original generation with overrides ===
        for (let r=0;r<3;r++) {
          grid[r][0] = this._makeNode(r,0,'battle','⚔️','战斗');
          grid[r][numCols-1] = this._makeNode(r,numCols-1,'rest','🔥','休息');
        }
        const eliteCols = this._spreadPositions(numCols, 3, 3);
        for (const ec of eliteCols) {
          const er = rand(0,2);
          grid[er][ec] = this._makeNode(er, ec, 'elite', '💀', '精英');
        }
        const tCols = this._spreadPositions(numCols, 1, 4);
        for (const tc of tCols) {
          const tr = rand(0,2);
          if (grid[tr][tc].type === 'battle') grid[tr][tc] = this._makeNode(tr, tc, 'treasure', '💎', '宝箱');
        }
      }
      // Boss column
      const bossNode = { type:'boss', icon:['🚫','🔥','💀'][f]||'💀',
        label:['SyntaxError','Firewall','Root'][f]||'Boss',
        row:1, col:numCols, visited:false, available:false, revealed:true };
      allLayers.push({ numCols, grid, bossNode, inlineBoss:(f===0), playerRow:-1, playerCol:-1 });
    }
    return allLayers;
  },
  _spreadPositions(numCols, count, minGap) {
    const positions = [];
    for (let i=0;i<count;i++) {
      let c, tries=0;
      do { c = rand(2, numCols-2); tries++; } while (positions.some(p=>Math.abs(p-c)<minGap) && tries<50);
      if (tries<50) positions.push(c);
    }
    return positions;
  },
  _genNode(row, col, numCols, floor) {
    const r = Math.random();
    let type, icon, label;
    if (r < 0.50) { type='battle'; icon='⚔️'; label='战斗'; }
    else if (r < 0.70) { type='event'; icon='❓'; label='事件'; }
    else if (r < 0.82) { type='shop'; icon='🏪'; label='商店'; }
    else if (r < 0.92) { type='rest'; icon='🔥'; label='休息'; }
    else { type='battle'; icon='⚔️'; label='战斗'; }
    return this._makeNode(row, col, type, icon, label);
  },
  _makeNode(row, col, type, icon, label) {
    return { type, icon, label, row, col, visited:false, available:false, revealed:true };
  },
  getEnemyForNode(node, floor) {
    if(node.type==='boss') return ENEMIES[['syntaxerr','firewall','root'][floor]||'root'];
    if(node.label==='教学') return ENEMIES['bug']; // Tutorial always Bug
    if(node.type==='elite') {
      const elites=[['nullptr','infloop'],['recursion','deadlock','stackoverflow'],['deadlock','racecond','gc']];
      return ENEMIES[pick(elites[floor]||elites[0])];
    }
    const reg=[['bug','typo','nullptr'],['infloop','memleak','racecond','gc'],['stackoverflow','recursion','deadlock']];
    return ENEMIES[pick(reg[floor]||reg[0])];
  }
};
