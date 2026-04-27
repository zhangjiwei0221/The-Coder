import { $, rand, pick, newCardId } from '../core/utils.js';
import { CARD_DEFS, cardDisplayClass } from '../data/cards.js';
import { CHARACTERS } from '../data/characters.js';
import { EVENTS_LIST } from '../data/events.js';
import { PLUGIN_DEFS } from '../data/plugins.js';
import { MapGenerator } from '../systems/mapGenerator.js';
import { BattleManager } from '../systems/battleManager.js';

// === GAME CONTROLLER ===
export const Game = {
  run:null, battle:null,
  showScreen(name) { document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden')); document.getElementById('screen-'+name).classList.remove('hidden'); },

  startRun() {
    this.showScreen('charselect');
    const container=$('#char-cards'); container.innerHTML='';
    Object.entries(CHARACTERS).forEach(([key,ch])=>{
      const card=document.createElement('div'); card.className='char-card';
      card.innerHTML=`<div class="char-icon">${ch.icon}</div><div class="char-name">${ch.name}</div><div class="char-ability">${ch.ability}</div><div class="char-desc">${ch.abilityDesc}</div>`;
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
    $('#map-layer-name').textContent = `// ${layerNames[this.run.currentFloor]||'Unknown'} - 第${this.run.currentFloor+1}层`;
    this.renderMap();
  },

  renderMap() {
    const container=$('#map-container'); container.innerHTML='';
    const layer = this.run.map[this.run.currentFloor];
    if (!layer) return;
    const { numCols, grid, bossNode, playerRow, playerCol, inlineBoss } = layer;
    const totalCols = inlineBoss ? numCols : (numCols + 1);

    // Determine available nodes
    for (let r=0;r<3;r++) for (let c=0;c<numCols;c++) grid[r][c].available = false;
    if (bossNode) bossNode.available = false;

    // Reveal nodes: reveal col 0 always, and current+next col if player placed
    for (let r=0;r<3;r++) grid[r][0].revealed = true;

    if (playerCol >= 0) {
      // Reveal current col and next col
      for (let r=0;r<3;r++) {
        if (playerCol < numCols) grid[r][playerCol].revealed = true;
        if (playerCol+1 < numCols) grid[r][playerCol+1].revealed = true;
      }
      if (bossNode) bossNode.revealed = true;
      // Available = next column, reachable rows (same, ±1)
      const nextCol = playerCol + 1;
      if (nextCol < numCols) {
        for (let r=0;r<3;r++) {
          if (Math.abs(r - playerRow) <= 1 && !grid[r][nextCol].visited && grid[r][nextCol].type !== 'empty') {
            grid[r][nextCol].available = true;
          }
        }
      } else if (!inlineBoss && nextCol === numCols) {
        // Boss available
        if (!bossNode.visited) bossNode.available = true;
      }
    } else {
      // Player hasn't started - col 0 available (skip empty nodes)
      for (let r=0;r<3;r++) {
        if (grid[r][0].type !== 'empty') {
          grid[r][0].available = true;
        }
        grid[r][0].revealed = true;
      }
    }

    // Build grid table
    const table = document.createElement('div');
    table.className = 'map-grid';
    table.style.gridTemplateColumns = `28px repeat(${totalCols}, 80px)`;

    // Row labels
    const rowLabels = ['上','中','下'];
    for (let r=0;r<3;r++) {
      // Row label
      const rl = document.createElement('div');
      rl.className = 'row-label';
      rl.textContent = rowLabels[r];
      rl.style.gridRow = r+1;
      rl.style.gridColumn = 1;
      table.appendChild(rl);

      for (let c=0;c<numCols;c++) {
        const node = grid[r][c];
        const el = document.createElement('div');
        el.className = 'map-node';
        // Empty nodes are invisible placeholders
        if (node.type === 'empty') {
          el.style.visibility = 'hidden';
          el.style.gridRow = r+1;
          el.style.gridColumn = c+2;
          table.appendChild(el);
          continue;
        }
        if (node.visited) el.classList.add('visited');
        if (node.available) el.classList.add('available');
        if (playerRow === r && playerCol === c) el.classList.add('current');
        if (!node.revealed) el.classList.add('hidden-node');

        const displayIcon = node.revealed ? node.icon : '?';
        const displayLabel = node.revealed ? node.label : '';
        el.innerHTML = `<span style="font-size:22px">${displayIcon}</span><span class="node-label">${displayLabel}</span>`;

        if (node.available) {
          el.addEventListener('click', () => this.selectGridNode(node, r, c));
        }
        el.style.gridRow = r+1;
        el.style.gridColumn = c+2;
        table.appendChild(el);
      }

      // Boss column (only show in middle row, but make clickable for all reachable rows)
      if (!inlineBoss && r === 1) {
        const bel = document.createElement('div');
        bel.className = 'map-node boss-node';
        if (bossNode.visited) bel.classList.add('visited');
        if (bossNode.available) bel.classList.add('available');
        bel.innerHTML = `<span style="font-size:26px">${bossNode.icon}</span><span class="node-label">${bossNode.label}</span>`;
        if (bossNode.available) {
          bel.addEventListener('click', () => this.selectBossNode(bossNode));
        }
        bel.style.gridRow = '1 / 4';
        bel.style.gridColumn = totalCols + 1;
        bel.style.height = '100%';
        bel.style.minHeight = '200px';
        bel.style.borderRadius = '14px';
        table.appendChild(bel);
      }
    }

    container.appendChild(table);

    // Camera: scroll to keep player position visible
    requestAnimationFrame(()=>{
      const containerW = container.clientWidth;
      const gridW = table.scrollWidth;
      if(gridW <= containerW){
        table.style.transform = 'translateX(0)';
        return;
      }
      // Use col 0 as camera target if player hasn't started (playerCol=-1)
      const camCol = Math.max(0, playerCol);
      const colWidth = 80 + 8; // node width + gap
      const labelWidth = 28 + 20; // row label + padding
      const playerPixelX = labelWidth + (camCol * colWidth) + (colWidth / 2);
      // Center camera on player, clamped to edges
      let offsetX = (containerW / 2) - playerPixelX;
      const maxOffset = 0;
      const minOffset = containerW - gridW;
      offsetX = Math.max(minOffset, Math.min(maxOffset, offsetX));
      table.style.transform = `translateX(${offsetX}px)`;
    });
  },

  selectGridNode(node, row, col) {
    node.visited = true;
    node.available = false;
    const layer = this.run.map[this.run.currentFloor];
    layer.playerRow = row;
    layer.playerCol = col;
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

  selectBossNode(bossNode) {
    bossNode.visited = true;
    if (bossNode) bossNode.available = false;
    this.run.nodesVisited++;
    const floor = this.run.currentFloor;
    this.startBattle(MapGenerator.getEnemyForNode(bossNode, floor), true);
    this.lastEnemyType = 'boss';
  },

  startBattle(enemyDef,isBoss) {
    this.isBoss=isBoss;
    this.battle=new BattleManager(enemyDef,this.run,(won)=>this.endBattle(won));
    this.showScreen('battle');
  },

  endBattle(won) {
    this.run.hp=this.battle.player.hp;
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
    const container=$('#reward-cards'); container.innerHTML='';
    const eType = this.lastEnemyType || 'normal';
    const eTypeLabel = eType==='boss'?'Boss击杀':eType==='elite'?'精英击杀':'战斗胜利';
    const rewardTitle = document.querySelector('#screen-reward h2');
    if(rewardTitle) rewardTitle.textContent = `// ${eTypeLabel} — 选择奖励`;
    const ownedPlugins = this.run.plugins || [];
    // Helper: get cards by rarity
    const cardsOfRarity = (r) => Object.keys(CARD_DEFS).filter(id=>(CARD_DEFS[id].rarity||1)===r);
    // Build reward card pool based on enemy type
    let pool;
    if (eType==='normal') {
      pool = cardsOfRarity(1);
    } else if (eType==='elite') {
      pool = [...cardsOfRarity(2), ...cardsOfRarity(3)];
    } else {
      pool = [...cardsOfRarity(2), ...cardsOfRarity(3), ...cardsOfRarity(3)];
    }
    // Show 3 random cards, pick one
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
      const card=document.createElement('div');card.className=`reward-card ${cardDisplayClass(def)}`;
      if(def.subtype==='if'||def.subtype==='if_else'){
        const bonusText = def.bonus ? (def.bonus.type==='mul'?`×${def.bonus.val}`:`+${def.bonus.val}`) : '';
        card.innerHTML=`<div class="card-icon">${def.icon}</div><div class="card-name if-card-line1">如果【】则</div><div class="card-desc if-card-bonus">${bonusText}</div><div style="font-size:9px;color:${rarityColor};margin-top:2px;">[${rarityLabel}]</div>`;
      } else {
        card.innerHTML=`<div class="card-icon">${def.icon}</div><div class="card-name">${def.name}</div><div class="card-desc">${def.desc||''}</div><div style="font-size:9px;color:${rarityColor};margin-top:2px;">[${rarityLabel}]</div>`;
      }
      card.addEventListener('click',()=>{this.run.deck.push({id:newCardId(),defId});this.showMap();});
      container.appendChild(card);
    });
    // Plugin reward: elite=guaranteed normal plugin, boss=guaranteed advanced plugin
    if (eType==='elite' || eType==='boss') {
      const targetTier = eType==='boss' ? 'advanced' : 'normal';
      let availPlugins = Object.keys(PLUGIN_DEFS).filter(id=>!ownedPlugins.includes(id) && PLUGIN_DEFS[id].tier===targetTier);
      if (!availPlugins.length) availPlugins = Object.keys(PLUGIN_DEFS).filter(id=>!ownedPlugins.includes(id));
      if (availPlugins.length) {
        const pid = pick(availPlugins);
        const pdef = PLUGIN_DEFS[pid];
        const tierLabel = pdef.tier==='advanced' ? '高级' : '普通';
        const card = document.createElement('div'); card.className='reward-plugin';
        card.innerHTML=`<div class="card-icon">${pdef.icon}</div><div class="card-name">${pdef.name}</div><div class="card-desc">${pdef.desc}</div><div style="font-size:9px;color:var(--orange);margin-top:2px;">[${tierLabel}插件 - 必得]</div>`;
        card.addEventListener('click',()=>{this.run.plugins.push(pid);this.showMap();});
        container.appendChild(card);
      }
    }
  },

  skipReward() { this.showMap(); },

  showEvent() {
    this.showScreen('event');
    const evt=pick(EVENTS_LIST);
    $('#event-icon').textContent=evt.icon;$('#event-title').textContent=evt.title;$('#event-desc').textContent=evt.desc;
    const choicesEl=$('#event-choices');choicesEl.innerHTML='';
    evt.choices.forEach(ch=>{
      const btn=document.createElement('button');btn.textContent=ch.text;
      btn.style.cssText='background:var(--bg3);border:1px solid var(--blue);color:var(--blue);';
      btn.addEventListener('click',()=>{ch.action(this.run);this.showMap();});
      choicesEl.appendChild(btn);
    });
  },

  showRest() {
    this.showScreen('event');
    $('#event-icon').textContent='🏕️';$('#event-title').textContent='休息站';
    $('#event-desc').textContent='你找到了一个安全的角落，可以休息一下...';
    const choicesEl=$('#event-choices');choicesEl.innerHTML='';
    // Rest: heal 30%
    const healBtn=document.createElement('button');
    healBtn.textContent=`休息 (回复 ${Math.floor(this.run.maxHp*0.3)} HP)`;
    healBtn.style.cssText='background:var(--bg3);border:1px solid var(--green);color:var(--green);';
    healBtn.addEventListener('click',()=>{this.run.hp=Math.min(this.run.maxHp,this.run.hp+Math.floor(this.run.maxHp*0.3));this.showMap();});
    choicesEl.appendChild(healBtn);
    // Forge: placeholder +5 gold
    const forgeBtn=document.createElement('button');
    forgeBtn.textContent='锻造 (升级随机卡牌 → +5金币)';
    forgeBtn.style.cssText='background:var(--bg3);border:1px solid var(--yellow);color:var(--yellow);';
    forgeBtn.addEventListener('click',()=>{this.run.gold+=5;this.showMap();});
    choicesEl.appendChild(forgeBtn);
    // Recall: lose 5 HP, gain random card
    const recallBtn=document.createElement('button');
    recallBtn.textContent='回忆 (-5 HP, 获得随机牌)';
    recallBtn.style.cssText='background:var(--bg3);border:1px solid var(--purple);color:var(--purple);';
    recallBtn.addEventListener('click',()=>{
      this.run.hp-=5;
      const pool=['atk','def','heal','poison','burn','for_loop','if_atk2','p5','p7'];
      this.run.deck.push({id:newCardId(),defId:pick(pool)});
      this.showMap();
    });
    choicesEl.appendChild(recallBtn);
    // Plugin scavenge option (if normal plugins available)
    const ownedPlugins = this.run.plugins || [];
    const availPlugins = Object.keys(PLUGIN_DEFS).filter(id=>!ownedPlugins.includes(id) && PLUGIN_DEFS[id].tier==='normal');
    if (availPlugins.length && Math.random() < 0.4) {
      const pid = pick(availPlugins);
      const pdef = PLUGIN_DEFS[pid];
      const plugBtn=document.createElement('button');
      plugBtn.textContent=`拾取插件: ${pdef.icon} ${pdef.name} — ${pdef.desc}`;
      plugBtn.style.cssText='background:var(--bg3);border:1px solid var(--orange);color:var(--orange);';
      plugBtn.addEventListener('click',()=>{this.run.plugins.push(pid);this.showMap();});
      choicesEl.appendChild(plugBtn);
    }
  },

  showShop() {
    this.showScreen('event');
    $('#event-icon').textContent='🛒';$('#event-title').textContent='代码商店';
    $('#event-desc').textContent=`你有 ${this.run.gold} 金币`;
    const choicesEl=$('#event-choices');choicesEl.innerHTML='';
    // 3 cards for sale
    const shopItems=[
      {defId:pick(['atk','def','heal','draw','poison','burn']),cost:15},
      {defId:pick(['for_loop','for_accel','for_double','if_atk2','if_def2','if_plus5']),cost:25},
      {defId:pick(['p5','p6','p7','p8','p9']),cost:10},
    ];
    shopItems.forEach(item=>{
      const def=CARD_DEFS[item.defId];
      const rarityLabel = (def.rarity||1)===3?'史诗':(def.rarity||1)===2?'稀有':'普通';
      const btn=document.createElement('button');
      btn.textContent=`${def.icon} ${def.name} [${rarityLabel}] (${item.cost}金币)`;
      btn.style.cssText='background:var(--bg3);border:1px solid var(--yellow);color:var(--yellow);';
      if(this.run.gold<item.cost){btn.style.opacity='0.3';btn.disabled=true;}
      btn.addEventListener('click',()=>{
        if(this.run.gold>=item.cost){this.run.gold-=item.cost;this.run.deck.push({id:newCardId(),defId:item.defId});this.showShop();}
      });
      choicesEl.appendChild(btn);
    });
    // Plugin for sale (1 random unowned plugin, normal only in shop)
    const ownedPlugins = this.run.plugins || [];
    const availPlugins = Object.keys(PLUGIN_DEFS).filter(id=>!ownedPlugins.includes(id) && PLUGIN_DEFS[id].tier==='normal');
    if (availPlugins.length) {
      const pid = pick(availPlugins);
      const pdef = PLUGIN_DEFS[pid];
      const pluginCost = 40;
      const pbtn = document.createElement('button');
      pbtn.textContent = `${pdef.icon} ${pdef.name} (${pluginCost}金币) — ${pdef.desc}`;
      pbtn.style.cssText='background:var(--bg3);border:1px solid var(--orange);color:var(--orange);';
      if(this.run.gold<pluginCost){pbtn.style.opacity='0.3';pbtn.disabled=true;}
      pbtn.addEventListener('click',()=>{
        if(this.run.gold>=pluginCost){this.run.gold-=pluginCost;this.run.plugins.push(pid);this.showShop();}
      });
      choicesEl.appendChild(pbtn);
    }
    // Remove card option
    const removeBtn=document.createElement('button');
    removeBtn.textContent='移除卡牌 (75金币)';
    removeBtn.style.cssText='background:var(--bg3);border:1px solid var(--red);color:var(--red);';
    if(this.run.gold<75){removeBtn.style.opacity='0.3';removeBtn.disabled=true;}
    removeBtn.addEventListener('click',()=>{
      if(this.run.gold>=75&&this.run.deck.length>5){
        this.run.gold-=75;
        const ri=rand(0,this.run.deck.length-1);
        const removed=this.run.deck.splice(ri,1)[0];
        const rdef=CARD_DEFS[removed.defId];
        alert(`移除了: ${rdef.name}`);
        this.showShop();
      }
    });
    choicesEl.appendChild(removeBtn);
    // Upgrade card placeholder
    const upgradeBtn=document.createElement('button');
    upgradeBtn.textContent='升级卡牌 (50金币) - Coming Soon';
    upgradeBtn.style.cssText='background:var(--bg3);border:1px solid var(--dim);color:var(--dim);opacity:0.4;';
    upgradeBtn.disabled=true;
    choicesEl.appendChild(upgradeBtn);
    // Leave
    const leaveBtn=document.createElement('button');
    leaveBtn.textContent='离开';
    leaveBtn.style.cssText='background:var(--bg3);border:1px solid var(--dim);color:var(--dim);';
    leaveBtn.addEventListener('click',()=>this.showMap());
    choicesEl.appendChild(leaveBtn);
  },

  showTreasure() {
    this.showScreen('event');
    $('#event-icon').textContent='💎';$('#event-title').textContent='宝箱';
    $('#event-desc').textContent='你发现了一个闪闪发光的宝箱！';
    const choicesEl=$('#event-choices');choicesEl.innerHTML='';
    // 30% chance: normal plugin treasure; 70% chance: card treasure
    const ownedPlugins = this.run.plugins || [];
    const availPlugins = Object.keys(PLUGIN_DEFS).filter(id=>!ownedPlugins.includes(id) && PLUGIN_DEFS[id].tier==='normal');
    if (availPlugins.length && Math.random() < 0.3) {
      const pid = pick(availPlugins);
      const pdef = PLUGIN_DEFS[pid];
      const btn=document.createElement('button');
      btn.textContent=`打开宝箱 → ${pdef.icon} ${pdef.name}（${pdef.desc}）`;
      btn.style.cssText='background:var(--bg3);border:1px solid var(--orange);color:var(--orange);';
      btn.addEventListener('click',()=>{this.run.plugins.push(pid);this.showMap();});
      choicesEl.appendChild(btn);
    } else {
      const pool=['atk','def','heal','poison','burn','for_loop','for_accel','if_atk2','if_def2','if_plus5','p5','p7','p8'];
      const defId=pick(pool);const def=CARD_DEFS[defId];
      const btn=document.createElement('button');
      btn.textContent=`打开宝箱 → ${def.icon} ${def.name}`;
      btn.style.cssText='background:var(--bg3);border:1px solid var(--yellow);color:var(--yellow);';
      btn.addEventListener('click',()=>{this.run.deck.push({id:newCardId(),defId});this.showMap();});
      choicesEl.appendChild(btn);
    }
    const skipBtn=document.createElement('button');
    skipBtn.textContent='跳过';
    skipBtn.style.cssText='background:var(--bg3);border:1px solid var(--dim);color:var(--dim);';
    skipBtn.addEventListener('click',()=>this.showMap());
    choicesEl.appendChild(skipBtn);
  },

  showGameOver(won) {
    this.showScreen('gameover');
    $('#gameover-title').textContent=won?'// 胜利!':'// 系统崩溃';
    $('#gameover-title').style.color=won?'var(--green)':'var(--red)';
    $('#gameover-stats').innerHTML=`探索节点: ${this.run.nodesVisited}<br>击败Boss: ${this.run.bossesKilled}<br>剩余HP: ${Math.max(0,this.run.hp)}<br>牌库大小: ${this.run.deck.length}`;
  },

  backToTitle() { this.showScreen('title'); },
};
