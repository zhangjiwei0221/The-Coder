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

  _cardRarityLabel(def) {
    return (def.rarity || 1) === 3 ? '史诗' : ((def.rarity || 1) === 2 ? '稀有' : '普通');
  },

  _cardTypeLabel(def) {
    if (def.type === 'parameter') return '参数';
    if (def.subtype === 'for' || def.subtype === 'for_accel' || def.subtype === 'for_double') return '循环';
    if (def.subtype === 'if' || def.subtype === 'if_else') return '判断';
    return '指令';
  },

  _cardSummary(def) {
    if (def.type === 'parameter') return `参数值 ${def.value}`;
    return def.desc || '';
  },

  _groupDeckCards() {
    const map = new Map();
    this.run.deck.forEach(card => {
      const row = map.get(card.defId) || { defId: card.defId, cards: [] };
      row.cards.push(card);
      map.set(card.defId, row);
    });
    return [...map.values()].sort((a,b) => {
      const ad = CARD_DEFS[a.defId], bd = CARD_DEFS[b.defId];
      const at = ad.type === 'parameter' ? 1 : 0;
      const bt = bd.type === 'parameter' ? 1 : 0;
      if (at !== bt) return at - bt;
      return (ad.rarity || 1) - (bd.rarity || 1) || ad.name.localeCompare(bd.name, 'zh-CN');
    });
  },

  openDeckModal(options={}) {
    if (!this.run) return;
    this.closeDeckModal();
    const overlay = document.createElement('div');
    overlay.className = 'modal-backdrop';
    const mode = options.mode || 'view';
    const title = mode === 'remove' ? '选择要删除的卡' : '当前牌库';
    const deckSize = this.run.deck.length;
    overlay.innerHTML = `<div class="deck-modal"><div class="deck-modal-head"><div><div class="deck-modal-kicker">DECK VIEW</div><h3>${title}</h3></div><button class="deck-close" aria-label="关闭">×</button></div><div class="deck-modal-meta"><span>${deckSize} 张卡</span><span>指令 ${this.run.deck.filter(c=>CARD_DEFS[c.defId]?.type==='instruction').length}</span><span>参数 ${this.run.deck.filter(c=>CARD_DEFS[c.defId]?.type==='parameter').length}</span></div><div class="deck-list"></div><div class="deck-modal-foot"></div></div>`;
    const list = overlay.querySelector('.deck-list');
    this._groupDeckCards().forEach(group => {
      const def = CARD_DEFS[group.defId];
      if (!def) return;
      const item = document.createElement('button');
      item.className = 'deck-list-card ' + cardDisplayClass(def);
      item.type = 'button';
      const disabled = mode === 'remove' && this.run.deck.length <= 8;
      item.disabled = disabled;
      item.innerHTML = `<span class="deck-card-icon">${def.icon}</span><span class="deck-card-main"><span class="deck-card-name">${def.name}</span><span class="deck-card-desc">${this._cardSummary(def)}</span></span><span class="deck-card-tags"><b>x${group.cards.length}</b><em>${this._cardTypeLabel(def)}</em><em>${this._cardRarityLabel(def)}</em></span>`;
      if (mode === 'remove') {
        item.addEventListener('click', () => {
          const idx = this.run.deck.findIndex(c => c.id === group.cards[0].id);
          if (idx === -1) return;
          this.run.deck.splice(idx, 1);
          if (typeof options.onRemove === 'function') options.onRemove(def);
          this.closeDeckModal();
        });
      }
      list.appendChild(item);
    });
    const foot = overlay.querySelector('.deck-modal-foot');
    foot.textContent = mode === 'remove' ? '点击一张卡将其从牌库中删除。' : '战斗中会按指令牌堆与参数牌堆分别洗牌。';
    overlay.querySelector('.deck-close').addEventListener('click', () => this.closeDeckModal());
    overlay.addEventListener('click', evt => { if (evt.target === overlay) this.closeDeckModal(); });
    document.body.appendChild(overlay);
    this.deckModalEl = overlay;
  },

  closeDeckModal() {
    if (this.deckModalEl) {
      this.deckModalEl.remove();
      this.deckModalEl = null;
    }
  },

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
    this.selectCharacter('architect');
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
      shopStock:{},
    };
    this.showMap();
  },

  showMap() {
    this.showScreen('map');
    $('#map-hp').textContent=`${this.run.hp} / ${this.run.maxHp}`;
    $('#map-gold').textContent=this.run.gold;
    $('#map-layer-name').textContent = '';
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

    columns.forEach((column) => {
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
    if (isBoss && enemyDef.name === '红字审判') {
      this.showStoryToast('红字审判', '所有未处理的错误都聚成了这一行红字。读懂它，然后改写它。');
    } else if (enemyDef.name === 'BUG' && !this.run.tutorialSeen) {
      this.run.tutorialSeen = true;
      this.showTutorialOverlay();
    }
  },

  endBattle(won) {
    this.run.hp=this.battle.player.hp;
    this.battle.destroy?.();
    this.battle=null;
    if(won){
      this.run.gold+=rand(10,20);
      if(this.isBoss){
        this.run.bossesKilled++;
        if(this.run.currentFloor===0){this.showDemoComplete();return;}
        if(this.run.currentFloor<this.run.map.length-1){this.run.currentFloor++;this.showReward();}
        else{this.showGameOver(true);return;}
      } else this.showReward();
    } else this.showGameOver(false);
  },

  showStoryToast(title, text) {
    const old = document.querySelector('.story-toast');
    if (old) old.remove();
    const toast = document.createElement('div');
    toast.className = 'story-toast';
    toast.innerHTML = `<div class="story-toast-title">${title}</div><div class="story-toast-text">${text}</div>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 20);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 260);
    }, 4200);
  },

  showTutorialOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'tutorial-overlay';
    overlay.innerHTML = `
      <div class="tutorial-panel">
        <div class="tutorial-kicker">FIRST DEBUG</div>
        <h3>第一场战斗</h3>
        <p>先看上方敌人的代码意图，再把指令牌拖进编程区。需要数值的指令，要把参数牌放到它旁边。</p>
        <div class="tutorial-steps">
          <span>1. 看敌方代码</span>
          <span>2. 拖入攻击/防御</span>
          <span>3. 填参数</span>
          <span>4. 点击运行</span>
        </div>
        <button>开始调试</button>
      </div>`;
    overlay.querySelector('button').addEventListener('click', () => overlay.remove());
    document.body.appendChild(overlay);
  },

  showDemoComplete() {
    this.showScreen('gameover');
    $('#gameover-art').innerHTML = '<div class="demo-complete-art"><span></span><span></span><span></span></div>';
    $('#gameover-title').textContent = 'Demo 完成';
    $('#gameover-title').style.color = 'var(--green)';
    $('#gameover-stats').innerHTML =
      `你修复了第一层的红字审判。<br>`+
      `Error Zone 与 Kernel Space 仍在开发中。<br><br>`+
      `探索节点: ${this.run.nodesVisited}<br>`+
      `击败Boss: ${this.run.bossesKilled}<br>`+
      `剩余HP: ${Math.max(0, this.run.hp)}<br>`+
      `牌库大小: ${this.run.deck.length}<br><br>`+
      `<span class="demo-note">未完待续：下一次下潜，将进入更深的心智后台。</span>`;
  },

  showReward() {
    this.showScreen('reward');
    this.closeRewardIfPreview();
    const container=$('#reward-cards'); container.innerHTML='';
    const eType = this.lastEnemyType || 'normal';
    const eTypeLabel = eType==='boss'?'Boss击杀':eType==='elite'?'精英击杀':'战斗胜利';
    const rewardTitle = document.querySelector('#screen-reward h2');
    if(rewardTitle) rewardTitle.textContent = eTypeLabel + ' - 选择奖励';
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
      if (availPlugins.length) {
        const pid = pick(availPlugins);
        const pdef = PLUGIN_DEFS[pid];
        const tierLabel = pdef.tier==='advanced' ? '高级' : '普通';
        const card = document.createElement('div'); card.className='reward-plugin';
        card.innerHTML='<div class="card-icon">' + pdef.icon + '</div><div class="card-name">' + pdef.name + '</div><div class="card-desc">' + pdef.desc + '</div><div style="font-size:9px;color:var(--orange);margin-top:2px;">[' + tierLabel + '插件 - 必得]</div>';
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
    choicesEl.className = '';
    evt.choices.forEach(ch => {
      const btn = document.createElement('button');
      btn.textContent = ch.text;
      btn.style.cssText = 'background:var(--bg3);border:1px solid var(--blue);color:var(--blue);';
      btn.addEventListener('click', () => { ch.action(this.run); this.showMap(); });
      choicesEl.appendChild(btn);
    });
    this._appendDeckViewButton(choicesEl);
  },

  showRest() {
    this.showScreen('event');
    $('#event-icon').textContent = '🛋️';
    $('#event-title').textContent = '安全屋';
    $('#event-desc').innerHTML = `<div class="rest-hero"><strong>系统噪声暂时降下来了。</strong><span>你只能做一件事：恢复状态、整理牌库，或为下一场战斗预编译一段启动流程。</span></div>`;
    const choicesEl = $('#event-choices');
    choicesEl.innerHTML = '';
    choicesEl.className = 'rest-grid';

    const healAmount = Math.max(12, Math.floor(this.run.maxHp * 0.35));
    const healBtn = document.createElement('button');
    healBtn.className = 'rest-card heal';
    healBtn.innerHTML = `<span class="rest-icon">💚</span><span class="rest-name">休整</span><span class="rest-desc">恢复 ${healAmount} HP。适合血量危险时保命。</span>`;
    healBtn.addEventListener('click', () => {
      this.run.hp = Math.min(this.run.maxHp, this.run.hp + healAmount);
      this.showMap();
    });
    choicesEl.appendChild(healBtn);

    const cleanBtn = document.createElement('button');
    cleanBtn.className = 'rest-card clean';
    cleanBtn.innerHTML = `<span class="rest-icon">🧹</span><span class="rest-name">整理牌库</span><span class="rest-desc">删除牌库中的1张牌。不恢复HP。</span>`;
    if (this.run.deck.length <= 8) {
      cleanBtn.disabled = true;
      cleanBtn.classList.add('disabled');
      cleanBtn.innerHTML += '<span class="rest-note">牌库过薄</span>';
    }
    cleanBtn.addEventListener('click', () => {
      if (this.run.deck.length <= 8) return;
      this.openDeckModal({ mode:'remove', onRemove:() => this.showMap() });
    });
    choicesEl.appendChild(cleanBtn);

    const prepBtn = document.createElement('button');
    prepBtn.className = 'rest-card prep';
    prepBtn.innerHTML = `<span class="rest-icon">⏩</span><span class="rest-name">预编译</span><span class="rest-desc">下一场战斗首回合额外抽1张指令牌和1张参数牌。</span>`;
    prepBtn.addEventListener('click', () => {
      this.run.nextBattleBoost = { instruction:1, parameter:1 };
      this.showMap();
    });
    choicesEl.appendChild(prepBtn);

    this._appendDeckViewButton(choicesEl);
  },

  _getShopStock() {
    const layer = this.run.map[this.run.currentFloor];
    const shopId = layer?.currentNodeId || `floor-${this.run.currentFloor}-fallback`;
    if (!this.run.shopStock) this.run.shopStock = {};
    if (!this.run.shopStock[shopId]) {
      const ownedPlugins = this.run.plugins || [];
      const availPlugins = Object.keys(PLUGIN_DEFS).filter(id => !ownedPlugins.includes(id) && PLUGIN_DEFS[id].tier === 'normal');
      this.run.shopStock[shopId] = {
        cards: [
          { defId: pick(['atk', 'def', 'heal', 'draw', 'poison', 'burn', 'charge']), cost: 15, sold:false },
          { defId: pick(['for_loop', 'for_accel', 'for_double', 'if_atk2', 'if_plus5']), cost: 25, sold:false },
          { defId: pick(['p3', 'p4', 'p5', 'p6', 'p7', 'p8']), cost: 20, sold:false },
        ],
        plugin: availPlugins.length ? { id: pick(availPlugins), cost: 40, sold:false } : null,
        removeUsed:false,
      };
    }
    return this.run.shopStock[shopId];
  },

  _makeEventButton(text, color, onClick, disabled=false) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `background:var(--bg3);border:1px solid ${color};color:${color};`;
    btn.disabled = disabled;
    if (disabled) btn.style.opacity = '0.35';
    if (onClick) btn.addEventListener('click', onClick);
    return btn;
  },

  _appendDeckViewButton(container) {
    container.appendChild(this._makeEventButton('查看牌库', 'var(--blue)', () => this.openDeckModal()));
  },

  showShop() {
    this.showScreen('event');
    $('#event-icon').textContent = '🏪';
    $('#event-title').textContent = '代码商店';
    $('#event-desc').innerHTML = `<div class="shop-hero"><div class="shop-terminal-art"><span></span><span></span><span></span></div><div>货架会在本节点内保持不变。买走的商品会标记为售罄，不会刷新成新货。</div><strong>金币 ${this.run.gold}</strong></div>`;
    const choicesEl = $('#event-choices');
    choicesEl.innerHTML = '';
    choicesEl.className = 'shop-grid';

    const stock = this._getShopStock();
    stock.cards.forEach(item => {
      const def = CARD_DEFS[item.defId];
      const btn = document.createElement('button');
      btn.className = 'shop-card ' + cardDisplayClass(def);
      btn.innerHTML = `<span class="shop-card-icon">${def.icon}</span><span class="shop-card-name">${def.name}</span><span class="shop-card-desc">${this._cardSummary(def)}</span><span class="shop-card-meta">${this._cardRarityLabel(def)} / ${item.cost} 金币</span>`;
      if (item.sold) {
        btn.classList.add('sold');
        btn.disabled = true;
        btn.innerHTML += '<span class="shop-sold">已售罄</span>';
      } else if (this.run.gold < item.cost) {
        btn.disabled = true;
        btn.classList.add('disabled');
      }
      btn.addEventListener('click', () => {
        if (this.run.gold < item.cost || item.sold) return;
        this.run.gold -= item.cost;
        this.run.deck.push({ id: newCardId(), defId: item.defId });
        item.sold = true;
        this.showShop();
      });
      choicesEl.appendChild(btn);
    });

    if (stock.plugin) {
      const pid = stock.plugin.id;
      const pdef = PLUGIN_DEFS[pid];
      const pbtn = document.createElement('button');
      pbtn.className = 'shop-card plugin';
      pbtn.innerHTML = `<span class="shop-card-icon">${pdef.icon}</span><span class="shop-card-name">${pdef.name}</span><span class="shop-card-desc">${pdef.desc}</span><span class="shop-card-meta">插件 / ${stock.plugin.cost} 金币</span>`;
      if (stock.plugin.sold || this.run.plugins.includes(pid)) {
        pbtn.classList.add('sold');
        pbtn.disabled = true;
        pbtn.innerHTML += '<span class="shop-sold">已安装</span>';
      } else if (this.run.gold < stock.plugin.cost) {
        pbtn.disabled = true;
        pbtn.classList.add('disabled');
      }
      pbtn.addEventListener('click', () => {
        if (this.run.gold < stock.plugin.cost || stock.plugin.sold || this.run.plugins.includes(pid)) return;
        this.run.gold -= stock.plugin.cost;
        this.run.plugins.push(pid);
        stock.plugin.sold = true;
        this.showShop();
      });
      choicesEl.appendChild(pbtn);
    }

    const removeCost = 75;
    const removeBtn = document.createElement('button');
    removeBtn.className = 'shop-card service';
    removeBtn.innerHTML = `<span class="shop-card-icon">🗑️</span><span class="shop-card-name">代码清理</span><span class="shop-card-desc">指定删除牌库中的1张牌。</span><span class="shop-card-meta">${removeCost} 金币</span>`;
    if (stock.removeUsed) {
      removeBtn.disabled = true;
      removeBtn.classList.add('sold');
      removeBtn.innerHTML += '<span class="shop-sold">已清理</span>';
    } else if (this.run.gold < removeCost || this.run.deck.length <= 8) {
      removeBtn.disabled = true;
      removeBtn.classList.add('disabled');
    }
    removeBtn.addEventListener('click', () => {
      if (this.run.gold < removeCost || this.run.deck.length <= 8 || stock.removeUsed) return;
      this.openDeckModal({ mode:'remove', onRemove:() => {
        this.run.gold -= removeCost;
        stock.removeUsed = true;
        this.showShop();
      }});
    });
    choicesEl.appendChild(removeBtn);

    this._appendDeckViewButton(choicesEl);
    choicesEl.appendChild(this._makeEventButton('离开', 'var(--dim)', () => {
      choicesEl.className = '';
      this.showMap();
    }));
  },

  showTreasure() {
    this.showScreen('event');
    $('#event-icon').textContent = '💎';
    $('#event-title').textContent = '宝箱';
    $('#event-desc').textContent = '你发现了一个闪闪发光的宝箱。';
    const choicesEl = $('#event-choices');
    choicesEl.innerHTML = '';
    choicesEl.className = '';

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
    this._appendDeckViewButton(choicesEl);
  },

  showGameOver(won) {
    this.showScreen('gameover');
    $('#gameover-art').innerHTML = won ? '<div class="demo-complete-art"><span></span><span></span><span></span></div>' : '';
    $('#gameover-title').textContent = won ? '胜利!' : '系统崩溃';
    $('#gameover-title').style.color = won ? 'var(--green)' : 'var(--red)';
    $('#gameover-stats').innerHTML = `探索节点: ${this.run.nodesVisited}<br>击败Boss: ${this.run.bossesKilled}<br>剩余HP: ${Math.max(0, this.run.hp)}<br>牌库大小: ${this.run.deck.length}`;
  },

  backToTitle() { this.showScreen('title'); },
};
