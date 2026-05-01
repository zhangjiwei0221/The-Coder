import { $, rand, pick, newCardId } from '../core/utils.js';
import { CARD_DEFS, IF_CONDITIONS, cardDisplayClass } from '../data/cards.js';
import { CHARACTERS } from '../data/characters.js';
import { EVENTS_LIST } from '../data/events.js';
import { PLUGIN_DEFS } from '../data/plugins.js';
import { MapGenerator } from '../systems/mapGenerator.js';
import { BattleManager } from '../systems/battleManager.js';

// === GAME CONTROLLER ===
export const Game = {
  run:null, battle:null,
  rewardIfPreviewEl:null, rewardIfPreviewCardId:null, rewardIfPreviewAnchor:null, _rewardIfPreviewCleanup:null,
  showScreen(name) { document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden')); document.getElementById('screen-'+name).classList.remove('hidden'); },

  toggleTitleLore() {
    const panel = document.getElementById('title-lore-panel');
    if (!panel) return;
    panel.classList.toggle('hidden');
  },

  getConditionsForCard(def) {
    const rarity = def?.rarity || 1;
    const count = rarity >= 3 ? 6 : (rarity === 2 ? 4 : 2);
    return IF_CONDITIONS.slice(0, count);
  },

  _getBonusText(def) {
    if(!def || !def.bonus) return '';
    return def.bonus.type==='mul'?('x' + def.bonus.val):('+' + def.bonus.val);
  },

  closeRewardIfPreview() {
    if (this._rewardIfPreviewCleanup) {
      this._rewardIfPreviewCleanup();
      this._rewardIfPreviewCleanup = null;
    }
    if (this.rewardIfPreviewAnchor) {
      this.rewardIfPreviewAnchor.classList.remove('preview-open');
      this.rewardIfPreviewAnchor = null;
    }
    if (this.rewardIfPreviewEl) {
      this.rewardIfPreviewEl.remove();
      this.rewardIfPreviewEl = null;
    }
    this.rewardIfPreviewCardId = null;
  },

  openRewardIfPreview(anchorEl, cardId, def) {
    this.closeRewardIfPreview();
    const availConds = this.getConditionsForCard(def);
    if (!availConds.length) return;
    const pop = document.createElement('div');
    pop.className = 'condition-popover if-preview-popover';
    const title = document.createElement('div');
    title.className = 'condition-popover-title';
    title.textContent = '条件预览';
    pop.appendChild(title);
    availConds.forEach(c => {
      const item = document.createElement('div');
      item.className = 'condition-preview-item';
      item.textContent = '- ' + c.label;
      pop.appendChild(item);
    });
    document.body.appendChild(pop);
    const rect = anchorEl.getBoundingClientRect();
    const width = Math.max(220, pop.offsetWidth || 220);
    const left = Math.min(window.innerWidth - width - 8, Math.max(8, rect.left + (rect.width - width) / 2));
    const preferTop = rect.top - pop.offsetHeight - 8;
    const top = preferTop >= 8 ? preferTop : Math.min(window.innerHeight - pop.offsetHeight - 8, rect.bottom + 8);
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
    anchorEl.classList.add('preview-open');
    const cleanup = (evt) => {
      if (evt && (pop.contains(evt.target) || anchorEl.contains(evt.target))) return;
      this.closeRewardIfPreview();
    };
    setTimeout(() => document.addEventListener('mousedown', cleanup), 0);
    this._rewardIfPreviewCleanup = () => document.removeEventListener('mousedown', cleanup);
    this.rewardIfPreviewEl = pop;
    this.rewardIfPreviewCardId = cardId;
    this.rewardIfPreviewAnchor = anchorEl;
  },

  startRun() {
    this.showScreen('charselect');
    const container=$('#char-cards'); container.innerHTML='';
    Object.entries(CHARACTERS).forEach(([key,ch])=>{
      const card=document.createElement('div'); card.className='char-card';
      card.innerHTML=`<div class="char-icon">${ch.icon}</div><div class="char-copy"><div class="char-name-row"><div class="char-name">${ch.name}</div><div class="char-tag">人格模块</div></div><div class="char-ability">${ch.ability}</div><div class="char-desc">${ch.abilityDesc}</div></div>`;
      card.addEventListener('click',()=>this.selectCharacter(key));
      container.appendChild(card);
    });
  },

  selectCharacter(charKey) {
    const ch=CHARACTERS[charKey];
    this.run = {
      hp:50, maxHp:50, gold:30,
      deck:ch.deck.map(defId=>({id:newCardId(),defId})),
      map:MapGenerator.generate(3),
      currentFloor:0, nodesVisited:0, bossesKilled:0,
      character:charKey,
      maxParamSum:charKey==='refactor'?13:10,
      handQuotas:{instruction:3, parameter:3},
      maxRetain:charKey==='refactor'?4:3,
      plugins:[],
    };
    this.showMap();
  },

  showMap() {
    this.showScreen('map');
    $('#map-hp').textContent=`${this.run.hp} / ${this.run.maxHp}`;
    $('#map-gold').textContent=this.run.gold;
    const layerNames = MapGenerator.LAYER_NAMES;
    $('#map-layer-name').textContent = '// ' + (layerNames[this.run.currentFloor] || 'Unknown') + ' - 第' + (this.run.currentFloor + 1) + '层';
    this.renderMap();
  },

  _clampMapOffset(container, board, offsetX) {
    const containerW = container.clientWidth;
    const boardW = board.scrollWidth;
    if (boardW <= containerW) return 0;
    return Math.max(containerW - boardW, Math.min(0, offsetX));
  },

  _getDefaultMapOffset(container, board, focusCol) {
    const focusX = 74 + focusCol * 132;
    return this._clampMapOffset(container, board, (container.clientWidth / 2) - focusX);
  },

  _attachMapDrag(container, board, layer) {
    let startX = 0;
    let startOffset = layer.mapOffsetX ?? 0;
    let dragging = false;

    const applyOffset = (offsetX) => {
      const clamped = this._clampMapOffset(container, board, offsetX);
      layer.mapOffsetX = clamped;
      board.style.transform = `translateX(${clamped}px)`;
    };

    const onPointerMove = (evt) => {
      if (!dragging) return;
      evt.preventDefault();
      applyOffset(startOffset + (evt.clientX - startX));
    };

    const stopDrag = () => {
      if (!dragging) return;
      dragging = false;
      container.classList.remove('dragging');
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', stopDrag);
      window.removeEventListener('pointercancel', stopDrag);
    };

    container.onpointerdown = (evt) => {
      if (evt.button !== 0) return;
      if (evt.target.closest('.map-node.available')) return;
      dragging = true;
      startX = evt.clientX;
      startOffset = layer.mapOffsetX ?? 0;
      container.classList.add('dragging');
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', stopDrag);
      window.addEventListener('pointercancel', stopDrag);
    };
  },

  renderMap() {
    const container=$('#map-container'); container.innerHTML='';
    const layer = this.run.map[this.run.currentFloor];
    if (!layer) return;
    const { numCols, columns, nodesById, bossNode, currentNodeId } = layer;
    const allNodes = columns.flat();

    allNodes.forEach(node => { node.available = false; node.revealed = true; });
    if (bossNode) bossNode.available = false;

    if (!currentNodeId) {
      (columns[0] || []).forEach(node => { if (!node.visited) node.available = true; });
    } else {
      const currentNode = nodesById[currentNodeId];
      if (currentNode) {
        currentNode.nextIds
          .map(id => id === bossNode.id ? bossNode : nodesById[id])
          .filter(Boolean)
          .forEach(node => {
            if (!node.visited) node.available = true;
          });
      }
    }

    const board = document.createElement('div');
    board.className = 'map-network';
    board.style.width = `${numCols * 132 + 150}px`;
    board.style.height = '380px';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'map-lines');
    svg.setAttribute('viewBox', `0 0 ${numCols * 132 + 150} 380`);
    board.appendChild(svg);

    const pointOf = (col, y) => ({
      x: 74 + col * 132,
      y: 40 + (y * 300),
    });

    const isActiveEdge = (fromId, toId) => {
      if (!currentNodeId) return false;
      return fromId === currentNodeId && !((toId === bossNode.id ? bossNode : nodesById[toId])?.visited);
    };

    allNodes.forEach(node => {
      const from = pointOf(node.col, node.y);
      node.nextIds.forEach(nextId => {
        const target = nextId === bossNode.id ? bossNode : nodesById[nextId];
        if (!target) return;
        const to = pointOf(target.col, target.y);
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const midX = (from.x + to.x) / 2;
        line.setAttribute('d', `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`);
        line.setAttribute('class', `map-line${isActiveEdge(node.id, nextId) ? ' active' : ''}${node.visited && target.visited ? ' visited' : ''}`);
        svg.appendChild(line);
      });
    });

    columns.forEach((column, colIndex) => {
      const label = document.createElement('div');
      label.className = 'map-col-label';
      label.textContent = colIndex === 0 ? '入口' : `阶段 ${colIndex + 1}`;
      label.style.left = `${46 + colIndex * 132}px`;
      board.appendChild(label);

      column.forEach(node => {
        const point = pointOf(node.col, node.y);
        const el = document.createElement('div');
        el.className = 'map-node';
        if (node.visited) el.classList.add('visited');
        if (node.available) el.classList.add('available');
        if (node.id === currentNodeId) el.classList.add('current');
        if (node.type === 'elite') el.classList.add('elite-node');
        el.innerHTML = `<span class="node-icon">${node.icon}</span><span class="node-label">${node.label}</span>`;
        if (node.available) {
          el.addEventListener('click', () => this.selectMapNode(node.id));
        }
        el.style.left = `${point.x - 38}px`;
        el.style.top = `${point.y - 38}px`;
        board.appendChild(el);
      });
    });

    const bossPoint = pointOf(bossNode.col, bossNode.y);
    const bossEl = document.createElement('div');
    bossEl.className = 'map-node boss-node';
    if (bossNode.visited) bossEl.classList.add('visited');
    if (bossNode.available) bossEl.classList.add('available');
    bossEl.innerHTML = `<span class="node-icon">${bossNode.icon}</span><span class="node-label">${bossNode.label}</span>`;
    if (bossNode.available) bossEl.addEventListener('click', () => this.selectBossNode());
    bossEl.style.left = `${bossPoint.x - 42}px`;
    bossEl.style.top = `${bossPoint.y - 42}px`;
    bossEl.style.width = '84px';
    bossEl.style.height = '84px';
    board.appendChild(bossEl);

    container.appendChild(board);

    requestAnimationFrame(() => {
      const focusCol = currentNodeId ? (nodesById[currentNodeId]?.col ?? 0) : 0;
      if (typeof layer.mapOffsetX !== 'number') {
        layer.mapOffsetX = this._getDefaultMapOffset(container, board, focusCol);
      } else {
        layer.mapOffsetX = this._clampMapOffset(container, board, layer.mapOffsetX);
      }
      board.style.transform = `translateX(${layer.mapOffsetX}px)`;
      this._attachMapDrag(container, board, layer);
    });
  },

  selectMapNode(nodeId) {
    const layer = this.run.map[this.run.currentFloor];
    const node = layer.nodesById[nodeId];
    if (!node) return;
    node.visited = true;
    node.available = false;
    layer.currentNodeId = nodeId;
    this.run.nodesVisited++;
    const floor = this.run.currentFloor;

    if (node.type==='battle' || node.type==='elite') {
      this.lastEnemyType = node.type==='elite' ? 'elite' : 'normal';
      this.startBattle(MapGenerator.getEnemyForNode(node, floor), false);
    } else if (node.type==='boss') {
      this.lastEnemyType = 'boss';
      this.startBattle(MapGenerator.getEnemyForNode(node, floor), true);
    } else if (node.type==='event') this.showEvent();
    else if (node.type==='rest') this.showRest();
    else if (node.type==='shop') this.showShop();
    else if (node.type==='treasure') this.showTreasure();
  },

  selectBossNode() {
    const layer = this.run.map[this.run.currentFloor];
    const bossNode = layer.bossNode;
    bossNode.visited = true;
    bossNode.available = false;
    this.run.nodesVisited++;
    const floor = this.run.currentFloor;
    this.startBattle(MapGenerator.getEnemyForNode(bossNode, floor), true);
    this.lastEnemyType = 'boss';
  },

  startBattle(enemyDef,isBoss) {
    this.isBoss=isBoss;
    this.showScreen('battle');
    this.battle=new BattleManager(enemyDef,this.run,(won)=>this.endBattle(won));
  },

  endBattle(won) {
    this.run.hp=this.battle.player.hp;
    this.battle.destroy?.();
    this.battle=null;
    if(won){
      this.run.gold+=rand(10,20);
      if(this.isBoss){
        this.run.bossesKilled++;
        if(this.run.currentFloor<this.run.map.length-1){this.run.currentFloor++;this.showReward();}
        else{this.showGameOver(true);return;}
      } else this.showReward();
    } else this.showGameOver(false);
  },

  showReward() {
    this.showScreen('reward');
    this.closeRewardIfPreview();
    const container=$('#reward-cards'); container.innerHTML='';
    const eType = this.lastEnemyType || 'normal';
    const eTypeLabel = eType==='boss'?'Boss击杀':eType==='elite'?'精英击杀':'战斗胜利';
    const rewardTitle = document.querySelector('#screen-reward h2');
    if(rewardTitle) rewardTitle.textContent = '// ' + eTypeLabel + ' - 选择奖励';
    const ownedPlugins = this.run.plugins || [];
    const cardsOfRarity = (r) => Object.keys(CARD_DEFS).filter(id=>CARD_DEFS[id].draftable!==false && (CARD_DEFS[id].rarity||1)===r);
    let pool;
    if (eType==='normal') {
      pool = cardsOfRarity(1);
    } else if (eType==='elite') {
      pool = [...cardsOfRarity(2), ...cardsOfRarity(3)];
    } else {
      pool = [...cardsOfRarity(2), ...cardsOfRarity(3), ...cardsOfRarity(3)];
    }
    const shown = [];
    for (let i=0;i<3;i++) {
      if(!pool.length) break;
      const idx = rand(0, pool.length-1);
      shown.push(pool[idx]);
      pool.splice(idx, 1);
    }
    shown.forEach(defId=>{
      const def=CARD_DEFS[defId];
      const rarityLabel = (def.rarity||1)===3?'史诗':(def.rarity||1)===2?'稀有':'普通';
      const rarityColor = (def.rarity||1)===3?'var(--orange)':(def.rarity||1)===2?'var(--blue)':'var(--dim)';
      const card=document.createElement('div');
      card.className='reward-card ' + cardDisplayClass(def);
      if(def.subtype==='if'||def.subtype==='if_else'){
        card.innerHTML='<div class="card-icon">' + def.icon + '</div><div class="card-name if-card-line1">如果【条件】则</div><div class="card-desc if-card-bonus">' + this._getBonusText(def) + '</div><div style="font-size:9px;color:' + rarityColor + ';margin-top:2px;">[' + rarityLabel + ']</div>';
        if(window.matchMedia('(hover: hover) and (pointer: fine)').matches){
          card.addEventListener('mouseenter',()=>this.openRewardIfPreview(card, defId, def));
          card.addEventListener('mouseleave',()=>this.closeRewardIfPreview());
        }
        card.addEventListener('click',(evt)=>{
          if(this.rewardIfPreviewCardId!==defId){
            evt.stopPropagation();
            this.openRewardIfPreview(card, defId, def);
            return;
          }
          this.closeRewardIfPreview();
          this.run.deck.push({id:newCardId(),defId});
          this.showMap();
        });
      } else {
        card.innerHTML='<div class="card-icon">' + def.icon + '</div><div class="card-name">' + def.name + '</div><div class="card-desc">' + (def.desc||'') + '</div><div style="font-size:9px;color:' + rarityColor + ';margin-top:2px;">[' + rarityLabel + ']</div>';
        card.addEventListener('click',()=>{this.run.deck.push({id:newCardId(),defId});this.showMap();});
      }
      container.appendChild(card);
    });
    if (eType==='elite' || eType==='boss') {
      const targetTier = eType==='boss' ? 'advanced' : 'normal';
      let availPlugins = Object.keys(PLUGIN_DEFS).filter(id=>!ownedPlugins.includes(id) && PLUGIN_DEFS[id].tier===targetTier);
        card.innerHTML='<div class="card-icon">' + pdef.icon + '</div><div class="card-name">' + pdef.name + '</div><div class="card-desc">' + pdef.desc + '</div><div style="font-size:9px;color:var(--orange);margin-top:2px;">[' + tierLabel + '插件 - 必得]</div>';
      if (availPlugins.length) {
        const pid = pick(availPlugins);
        const pdef = PLUGIN_DEFS[pid];
        const tierLabel = pdef.tier==='advanced' ? '高级' : '普通';
        const card = document.createElement('div'); card.className='reward-plugin';
        card.innerHTML='<div class="card-icon">' + pdef.icon + '</div><div class="card-name">' + pdef.name + '</div><div class="card-desc">' + pdef.desc + '</div><div style="font-size:9px;color:var(--orange);margin-top:2px;">[' + tierLabel + '鎻掍欢 - 蹇呭緱]</div>';
        card.addEventListener('click',()=>{this.run.plugins.push(pid);this.showMap();});
        container.appendChild(card);
      }
    }
  },

  skipReward() { this.closeRewardIfPreview(); this.showMap(); },

  showEvent() {
    this.showScreen('event');
    const evt = pick(EVENTS_LIST);
    $('#event-icon').textContent = evt.icon;
    $('#event-title').textContent = evt.title;
    $('#event-desc').textContent = evt.desc;
    const choicesEl = $('#event-choices');
    choicesEl.innerHTML = '';
    evt.choices.forEach(ch => {
      const btn = document.createElement('button');
      btn.textContent = ch.text;
      btn.style.cssText = 'background:var(--bg3);border:1px solid var(--blue);color:var(--blue);';
      btn.addEventListener('click', () => { ch.action(this.run); this.showMap(); });
      choicesEl.appendChild(btn);
    });
  },

  showRest() {
    this.showScreen('event');
    $('#event-icon').textContent = '🛌';
    $('#event-title').textContent = '休息站';
    $('#event-desc').textContent = '你找到了一处暂时安全的角落，可以休息片刻。';
    const choicesEl = $('#event-choices');
    choicesEl.innerHTML = '';

    const healBtn = document.createElement('button');
    healBtn.textContent = `休息 (恢复 ${Math.floor(this.run.maxHp * 0.3)} HP)`;
    healBtn.style.cssText = 'background:var(--bg3);border:1px solid var(--green);color:var(--green);';
    healBtn.addEventListener('click', () => {
      this.run.hp = Math.min(this.run.maxHp, this.run.hp + Math.floor(this.run.maxHp * 0.3));
      this.showMap();
    });
    choicesEl.appendChild(healBtn);

    const forgeBtn = document.createElement('button');
    forgeBtn.textContent = '锻造 (升级随机卡牌 -> +5金币)';
    forgeBtn.style.cssText = 'background:var(--bg3);border:1px solid var(--yellow);color:var(--yellow);';
    forgeBtn.addEventListener('click', () => {
      this.run.gold += 5;
      this.showMap();
    });
    choicesEl.appendChild(forgeBtn);

    const recallBtn = document.createElement('button');
    recallBtn.textContent = '回忆 (-5 HP, 获得随机牌)';
    recallBtn.style.cssText = 'background:var(--bg3);border:1px solid var(--purple);color:var(--purple);';
    recallBtn.addEventListener('click', () => {
      this.run.hp -= 5;
      const pool = ['atk', 'def', 'heal', 'poison', 'burn', 'for_loop', 'if_atk2', 'p5', 'p7'];
      this.run.deck.push({ id: newCardId(), defId: pick(pool) });
      this.showMap();
    });
    choicesEl.appendChild(recallBtn);

    const ownedPlugins = this.run.plugins || [];
    const availPlugins = Object.keys(PLUGIN_DEFS).filter(id => !ownedPlugins.includes(id) && PLUGIN_DEFS[id].tier === 'normal');
    if (availPlugins.length && Math.random() < 0.4) {
      const pid = pick(availPlugins);
      const pdef = PLUGIN_DEFS[pid];
      const plugBtn = document.createElement('button');
      plugBtn.textContent = `拾取插件: ${pdef.icon} ${pdef.name} - ${pdef.desc}`;
      plugBtn.style.cssText = 'background:var(--bg3);border:1px solid var(--orange);color:var(--orange);';
      plugBtn.addEventListener('click', () => {
        this.run.plugins.push(pid);
        this.showMap();
      });
      choicesEl.appendChild(plugBtn);
    }
  },

  showShop() {
    this.showScreen('event');
    $('#event-icon').textContent = '🏪';
    $('#event-title').textContent = '代码商店';
    $('#event-desc').textContent = `你有 ${this.run.gold} 金币`;
    const choicesEl = $('#event-choices');
    choicesEl.innerHTML = '';

    const shopItems = [
      { defId: pick(['atk', 'def', 'heal', 'draw', 'poison', 'burn']), cost: 15 },
      { defId: pick(['for_loop', 'for_accel', 'for_double', 'if_atk2', 'if_plus5']), cost: 25 },
      { defId: pick(['p3', 'p4', 'p5', 'p7', 'p8']), cost: 20 },
    ];

    shopItems.forEach(item => {
      const def = CARD_DEFS[item.defId];
      const rarityLabel = (def.rarity || 1) === 3 ? '史诗' : (def.rarity || 1) === 2 ? '稀有' : '普通';
      const btn = document.createElement('button');
      btn.textContent = `${def.icon} ${def.name} [${rarityLabel}] (${item.cost}金币)`;
      btn.style.cssText = 'background:var(--bg3);border:1px solid var(--yellow);color:var(--yellow);';
      if (this.run.gold < item.cost) { btn.style.opacity = '0.3'; btn.disabled = true; }
      btn.addEventListener('click', () => {
        if (this.run.gold >= item.cost) {
          this.run.gold -= item.cost;
          this.run.deck.push({ id: newCardId(), defId: item.defId });
          this.showShop();
        }
      });
      choicesEl.appendChild(btn);
    });

    const ownedPlugins = this.run.plugins || [];
    const availPlugins = Object.keys(PLUGIN_DEFS).filter(id => !ownedPlugins.includes(id) && PLUGIN_DEFS[id].tier === 'normal');
    if (availPlugins.length) {
      const pid = pick(availPlugins);
      const pdef = PLUGIN_DEFS[pid];
      const pluginCost = 40;
      const pbtn = document.createElement('button');
      pbtn.textContent = `${pdef.icon} ${pdef.name} (${pluginCost}金币) - ${pdef.desc}`;
      pbtn.style.cssText = 'background:var(--bg3);border:1px solid var(--orange);color:var(--orange);';
      if (this.run.gold < pluginCost) { pbtn.style.opacity = '0.3'; pbtn.disabled = true; }
      pbtn.addEventListener('click', () => {
        if (this.run.gold >= pluginCost) {
          this.run.gold -= pluginCost;
          this.run.plugins.push(pid);
          this.showShop();
        }
      });
      choicesEl.appendChild(pbtn);
    }

    const removeBtn = document.createElement('button');
    removeBtn.textContent = '移除卡牌 (75金币)';
    removeBtn.style.cssText = 'background:var(--bg3);border:1px solid var(--red);color:var(--red);';
    if (this.run.gold < 75) { removeBtn.style.opacity = '0.3'; removeBtn.disabled = true; }
    removeBtn.addEventListener('click', () => {
      if (this.run.gold >= 75 && this.run.deck.length > 5) {
        this.run.gold -= 75;
        const ri = rand(0, this.run.deck.length - 1);
        const removed = this.run.deck.splice(ri, 1)[0];
        const rdef = CARD_DEFS[removed.defId];
        alert(`移除了 ${rdef.name}`);
        this.showShop();
      }
    });
    choicesEl.appendChild(removeBtn);

    const upgradeBtn = document.createElement('button');
    upgradeBtn.textContent = '升级卡牌 (50金币) - 即将开放';
    upgradeBtn.style.cssText = 'background:var(--bg3);border:1px solid var(--dim);color:var(--dim);opacity:0.4;';
    upgradeBtn.disabled = true;
    choicesEl.appendChild(upgradeBtn);

    const leaveBtn = document.createElement('button');
    leaveBtn.textContent = '离开';
    leaveBtn.style.cssText = 'background:var(--bg3);border:1px solid var(--dim);color:var(--dim);';
    leaveBtn.addEventListener('click', () => this.showMap());
    choicesEl.appendChild(leaveBtn);
  },

  showTreasure() {
    this.showScreen('event');
    $('#event-icon').textContent = '💎';
    $('#event-title').textContent = '宝箱';
    $('#event-desc').textContent = '你发现了一个闪闪发光的宝箱。';
    const choicesEl = $('#event-choices');
    choicesEl.innerHTML = '';

    const ownedPlugins = this.run.plugins || [];
    const availPlugins = Object.keys(PLUGIN_DEFS).filter(id => !ownedPlugins.includes(id) && PLUGIN_DEFS[id].tier === 'normal');
    if (availPlugins.length && Math.random() < 0.3) {
      const pid = pick(availPlugins);
      const pdef = PLUGIN_DEFS[pid];
      const btn = document.createElement('button');
      btn.textContent = `打开宝箱 -> ${pdef.icon} ${pdef.name} (${pdef.desc})`;
      btn.style.cssText = 'background:var(--bg3);border:1px solid var(--orange);color:var(--orange);';
      btn.addEventListener('click', () => {
        this.run.plugins.push(pid);
        this.showMap();
      });
      choicesEl.appendChild(btn);
    } else {
      const pool = ['atk', 'def', 'heal', 'poison', 'burn', 'for_loop', 'for_accel', 'if_atk2', 'if_plus5', 'p5', 'p7', 'p8'];
      const defId = pick(pool);
      const def = CARD_DEFS[defId];
      const btn = document.createElement('button');
      btn.textContent = `打开宝箱 -> ${def.icon} ${def.name}`;
      btn.style.cssText = 'background:var(--bg3);border:1px solid var(--yellow);color:var(--yellow);';
      btn.addEventListener('click', () => {
        this.run.deck.push({ id: newCardId(), defId });
        this.showMap();
      });
      choicesEl.appendChild(btn);
    }

    const skipBtn = document.createElement('button');
    skipBtn.textContent = '跳过';
    skipBtn.style.cssText = 'background:var(--bg3);border:1px solid var(--dim);color:var(--dim);';
    skipBtn.addEventListener('click', () => this.showMap());
    choicesEl.appendChild(skipBtn);
  },

  showGameOver(won) {
    this.showScreen('gameover');
    $('#gameover-title').textContent = won ? '// 胜利!' : '// 系统崩溃';
    $('#gameover-title').style.color = won ? 'var(--green)' : 'var(--red)';
    $('#gameover-stats').innerHTML = `探索节点: ${this.run.nodesVisited}<br>击败Boss: ${this.run.bossesKilled}<br>剩余HP: ${Math.max(0, this.run.hp)}<br>牌库大小: ${this.run.deck.length}`;
  },

  backToTitle() { this.showScreen('title'); },
};

