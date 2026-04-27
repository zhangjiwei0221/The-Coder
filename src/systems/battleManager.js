import { $, $$, delay, shuffle, newCardId } from '../core/utils.js';
import { PROG_LINES, HAND_QUOTAS, MAX_RETAIN } from '../core/constants.js';
import { emptyStatus, renderStatusTags } from '../core/status.js';
import { CARD_DEFS, IF_CONDITIONS, cardDisplayClass } from '../data/cards.js';
import { ENEMY_UI_META } from '../data/enemies.js';
import { PLUGIN_DEFS } from '../data/plugins.js';

// === BATTLE MANAGER ===
export class BattleManager {
  constructor(enemyDef, runState, onBattleEnd) {
    this.run = runState;
    this.onBattleEnd = onBattleEnd;
    this.player = {hp:runState.hp, maxHp:runState.maxHp, shield:0, status:emptyStatus()};
    this.enemy = {...enemyDef, hp:enemyDef.hp, maxHp:enemyDef.hp, shield:0, tier:enemyDef.tier||1, status:emptyStatus()};
    const enemyMeta = ENEMY_UI_META[enemyDef.name] || { codeLib: [], ability: '暂无特殊能力' };
    this.enemyCodeLib = enemyMeta.codeLib;
    this.enemyAbility = enemyMeta.ability;
    this.turn = 0;
    this.phase = 'player';
    this.hand = [];
    this.program = new Array(PROG_LINES).fill(null);
    // Two draw/discard piles: instruction (includes for/if) and parameter
    this.instructionDrawPile = []; this.instructionDiscardPile = [];
    this.paramDrawPile = []; this.paramDiscardPile = [];
    this.chargeNext = false;
    this.running = false;
    this.selectedCard = null;
    this.selectedProgramLine = null;
    this.conditionPopoverEl = null;
    this._conditionPickerCleanup = null;
    this.ifPreviewPopoverEl = null;
    this._ifPreviewCleanup = null;
    this._ifPreviewAnchorCardId = null;
    this._pendingDrawRevealIds = new Set();
    this.usedParamSum = 0;
    this.maxParamSum = runState.maxParamSum || 10;
    this.enemyWeakThisTurn = false;
    this.checkpointUsed = false;
    this.initDeck();
    this.startTurn();
  }

  initDeck() {
    const cards = this.run.deck.map(c=>({...c}));
    const instr=[], param=[];
    cards.forEach(c=>{const t=CARD_DEFS[c.defId].type; if(t==='instruction')instr.push(c); else param.push(c);});
    this.instructionDrawPile=shuffle(instr); this.paramDrawPile=shuffle(param);
    this.instructionDiscardPile=[]; this.paramDiscardPile=[];
  }

  _drawFromPile(type, n) {
    const dp = type==='instruction'?'instructionDrawPile':'paramDrawPile';
    const drawn=[];
    for(let i=0;i<n;i++){
      if(!this[dp].length) break; // pile empty, can't draw more
      drawn.push(this[dp].shift());
    }
    return drawn;
  }

  _reshufflePiles() {
    // Merge discard into draw pile and shuffle (at turn start)
    this.instructionDrawPile = shuffle([...this.instructionDrawPile, ...this.instructionDiscardPile]);
    this.instructionDiscardPile = [];
    this.paramDrawPile = shuffle([...this.paramDrawPile, ...this.paramDiscardPile]);
    this.paramDiscardPile = [];
  }

  _discardCard(card) {
    const t=CARD_DEFS[card.defId].type;
    if(t==='instruction') this.instructionDiscardPile.push(card);
    else this.paramDiscardPile.push(card);
  }

  _resolveEase(name) {
    const easing = window.Phaser?.Math?.Easing;
    if(name==='Back.easeOut') return easing?.Back?.Out || (t=>{const c1=1.70158,c3=c1+1;return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2);});
    if(name==='Quad.easeIn') return easing?.Quadratic?.In || (t=>t*t);
    return t=>t;
  }

  _animateGhost(ghost, from, to, duration=250, easeName='Back.easeOut', onDone=null) {
    const ease=this._resolveEase(easeName);
    const start=performance.now();
    const tick=(now)=>{
      const p=Math.min(1,(now-start)/duration);
      const e=ease(p);
      const x=from.x+(to.x-from.x)*e;
      const y=from.y+(to.y-from.y)*e;
      const s=from.scale+(to.scale-from.scale)*e;
      const a=from.alpha+(to.alpha-from.alpha)*e;
      ghost.style.transform=`translate(${x}px,${y}px) scale(${s})`;
      ghost.style.opacity=String(a);
      if(p<1){requestAnimationFrame(tick);return;}
      ghost.remove();
      if(onDone) onDone();
    };
    requestAnimationFrame(tick);
  }

  _makeGhostCardFromRect(rect, html, className='card') {
    if(!rect) return null;
    const ghost=document.createElement('div');
    ghost.className=`fx-ghost-card ${className}`;
    ghost.style.left='0px';
    ghost.style.top='0px';
    ghost.style.width=`${rect.width}px`;
    ghost.style.height=`${rect.height}px`;
    ghost.style.transform=`translate(${rect.left}px,${rect.top}px) scale(1)`;
    ghost.innerHTML=html;
    document.body.appendChild(ghost);
    return ghost;
  }

  _drawCardBackHtml() {
    return '<div class="card-back-face"><div class="card-back-chip">◇</div><div class="card-back-title">THE CODER</div></div>';
  }

  _animateDrawFlipGhost(ghost, fromRect, toRect, target, frontHtml, onDone) {
    const ease=this._resolveEase('Back.easeOut');
    const start=performance.now();
    let swapped=false;
    const fromX=fromRect.left+(fromRect.width-toRect.width)*0.5;
    const fromY=fromRect.top+(fromRect.height-toRect.height)*0.5;
    ghost.innerHTML=this._drawCardBackHtml();
    const tick=(now)=>{
      const p=Math.min(1,(now-start)/300);
      const e=ease(p);
      const x=fromX+(toRect.left-fromX)*e;
      const y=fromY+(toRect.top-fromY)*e;
      const s=0.72+(1-0.72)*e;
      const a=p;
      let rotY=0;
      if(p<0.5){
        rotY=-90*(p/0.5);
      } else {
        if(!swapped){
          ghost.innerHTML=frontHtml;
          swapped=true;
        }
        rotY=90*(1-(p-0.5)/0.5);
      }
      ghost.style.transform=`translate(${x}px,${y}px) perspective(900px) rotateY(${rotY}deg) scale(${s})`;
      ghost.style.opacity=String(a);
      if(p<1){requestAnimationFrame(tick);return;}
      ghost.remove();
      target.classList.remove('anim-hidden');
      if(onDone) onDone();
    };
    requestAnimationFrame(tick);
  }

  _playDrawAnimationByCardIds(cardIds) {
    const fromEl=$('#pile-info');
    if(!fromEl||!cardIds||!cardIds.length) return;
    const fromRect=fromEl.getBoundingClientRect();
    cardIds.forEach((id,idx)=>{
      const delayMs=idx*50;
      setTimeout(()=>{
        const target=document.querySelector(`.card[data-card-id="${id}"]`);
        if(!target){this._pendingDrawRevealIds.delete(id);return;}
        const toRect=target.getBoundingClientRect();
        const ghost=this._makeGhostCardFromRect(toRect,target.innerHTML,target.className);
        if(!ghost){
          this._pendingDrawRevealIds.delete(id);
          target.classList.remove('anim-hidden');
          return;
        }
        this._animateDrawFlipGhost(
          ghost,
          fromRect,
          toRect,
          target,
          target.innerHTML,
          ()=>this._pendingDrawRevealIds.delete(id)
        );
      },delayMs);
    });
  }

  _playDiscardAnimation(rect, html, className, done) {
    const toEl=$('#pile-info');
    if(!rect||!toEl){if(done)done();return;}
    const toRect=toEl.getBoundingClientRect();
    const ghost=this._makeGhostCardFromRect(rect,html,className||'card');
    if(!ghost){if(done)done();return;}
    this._animateGhost(
      ghost,
      {x:rect.left,y:rect.top,scale:1,alpha:1},
      {x:toRect.left,y:toRect.top,scale:0.6,alpha:0},
      200,
      'Quad.easeIn',
      done
    );
  }

  _playCardToProgramAnimation(fromRect, targetLineIdx, html, className) {
    if(!fromRect) return;
    setTimeout(()=>{
      const target=document.querySelector(`.line-content[data-line-idx="${targetLineIdx}"]`);
      if(!target) return;
      const toRect=target.getBoundingClientRect();
      const ghost=this._makeGhostCardFromRect(fromRect,html,className||'card');
      if(!ghost) return;
      this._animateGhost(
        ghost,
        {x:fromRect.left,y:fromRect.top,scale:1.1,alpha:1},
        {x:toRect.left,y:toRect.top,scale:1,alpha:1},
        250,
        'Back.easeOut'
      );
    },0);
  }

  _flashIfResult(lineIdx, success) {
    if(lineIdx===undefined||lineIdx===null) return;
    const lines=$$('.program-line');
    if(!lines[lineIdx]) return;
    const content=lines[lineIdx].querySelector('.line-content');
    if(!content) return;
    const cls=success?'if-success-flash':'if-fail-flash';
    content.classList.add(cls);
    setTimeout(()=>content.classList.remove(cls),220);
  }

  drawHandRetention() {
    const quotas = {
      instruction: (this.run.handQuotas?.instruction ?? HAND_QUOTAS.instruction) + (this.hasPlugin('debugger')?1:0),
      parameter: this.run.handQuotas?.parameter ?? HAND_QUOTAS.parameter,
    };
    const drawnInstr=this._drawFromPile('instruction',quotas.instruction);
    const drawnParam=this._drawFromPile('parameter',quotas.parameter);
    this.hand.push(...drawnInstr);
    this.hand.push(...drawnParam);
    return [...drawnInstr,...drawnParam].map(c=>c.id);
  }

  drawCards(n) {
    const drawnIds=[];
    for(let i=0;i<n;i++){
      if(this.hand.length>=10) break;
      // Draw from any pile that has cards
      const types=shuffle(['instruction','parameter']);
      let drew=false;
      for(const t of types){const d=this._drawFromPile(t,1);if(d.length){this.hand.push(d[0]);drawnIds.push(d[0].id);drew=true;break;}}
      if(!drew) break;
    }
    drawnIds.forEach(id=>this._pendingDrawRevealIds.add(id));
    this.renderHand();
    this._playDrawAnimationByCardIds(drawnIds);
  }

  startTurn() {
    this.turn++;
    this.phase='player';
    this.enemyWeakThisTurn=false;
    // Shield handling
    if(this.hasPlugin('powermgmt')){this.player.shield=Math.floor(this.player.shield*0.5);}
    else{
      // 运维: 护盾>10时回合开始恢复2HP
      if(this.run.character==='ops' && this.player.shield>10 && this.turn>1){
        this.player.hp=Math.min(this.player.maxHp,this.player.hp+2);
        this.addLog('运维: 护盾>10 → 恢复2HP','info');
      }
      this.player.shield=0;
    }
    // Plugin: autosave
    if(this.hasPlugin('autosave')&&this.turn>1){
      this.player.hp=Math.min(this.player.maxHp,this.player.hp+2);
    }
    // Discard used program cards (flat model)
    for(let i=0;i<PROG_LINES;i++){
      const slot=this.program[i];
      if(!slot) continue;
      if(slot.childOf!==undefined){
        if(slot.node) this._discardNode(slot.node);
      } else {
        this._discardNode(slot);
      }
    }
    this.program=new Array(PROG_LINES).fill(null);
    this.usedParamSum=0;
    this.selectedCard=null;
    this.selectedProgramLine=null;
    // Merge discard piles into draw piles and shuffle
    this._reshufflePiles();
    // Draw to fill quotas
    let drawnIds=this.drawHandRetention();
    // 架构师: 首回合先抽1张【循环】
    if(this.turn===1 && this.run.character==='architect'){
      const forIdx = this.instructionDrawPile.findIndex(c=>{ const d=CARD_DEFS[c.defId]; return d&&(d.subtype==='for'||d.subtype==='for_accel'||d.subtype==='for_double'); });
      if(forIdx!==-1){
        const forCard = this.instructionDrawPile.splice(forIdx,1)[0];
        this.hand.push(forCard);
        drawnIds.push(forCard.id);
        this.addLog('架构师: 首回合抽取【循环】卡','info');
      }
    }
    // Plugin: preload — first turn draw +2
    if(this.turn===1 && this.hasPlugin('preload')){
      this.drawCards(2);
      this.addLog('插件[预加载] → 额外抽2张','info');
    }
    this.addLog(`── 回合 ${this.turn} ──`,'turn');
    this.addLog(`抽了${this.hand.length}张牌`,'info');
    drawnIds.forEach(id=>this._pendingDrawRevealIds.add(id));
    this.renderAll();
    this._playDrawAnimationByCardIds(drawnIds);
    this.showIntent();
  }

  _checkNeedsDiscard(maxRetain) {
    return this.hand.length > maxRetain;
  }

  _showDiscardUI(maxRetain) {
    return new Promise(resolve => {
      const mustDiscard = this.hand.length - maxRetain;
      if(mustDiscard <= 0) { resolve(); return; }

      const overlay = document.createElement('div');
      overlay.id = 'discard-overlay';
      overlay.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,.85);z-index:100;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;';

      const title = document.createElement('div');
      title.style.cssText = 'font-family:Orbitron,sans-serif;font-size:18px;color:var(--yellow);letter-spacing:2px;';
      title.textContent = '// 选择要弃掉的牌';
      overlay.appendChild(title);

      const subtitle = document.createElement('div');
      subtitle.style.cssText = 'font-size:12px;color:var(--dim);margin-bottom:8px;';
      overlay.appendChild(subtitle);

      const cardsArea = document.createElement('div');
      cardsArea.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;justify-content:center;max-width:90%;';
      overlay.appendChild(cardsArea);

      const confirmBtn = document.createElement('button');
      confirmBtn.style.cssText = 'padding:10px 36px;font-size:14px;font-weight:700;border-radius:6px;background:var(--bg3);color:var(--dim);letter-spacing:1px;margin-top:12px;cursor:not-allowed;';
      confirmBtn.textContent = '确认弃牌';
      confirmBtn.disabled = true;
      overlay.appendChild(confirmBtn);

      const selected = new Set();

      const render = () => {
        cardsArea.innerHTML = '';
        this.hand.forEach((card, idx) => {
          const def = CARD_DEFS[card.defId];
          const el = document.createElement('div');
          el.className = `card ${cardDisplayClass(def)}`;
          el.dataset.discardIdx=String(idx);
          el.style.cssText = 'cursor:pointer;transition:all .15s;position:relative;';
          el.innerHTML = `<div class="card-icon">${def.icon}</div><div class="card-name">${def.name}</div><div class="card-desc">${def.desc||''}</div>`;

          if(selected.has(idx)) {
            el.style.border = '2px solid var(--red)';
            el.style.opacity = '0.5';
            el.style.transform = 'scale(0.92)';
            const xmark = document.createElement('div');
            xmark.style.cssText = 'position:absolute;top:4px;right:6px;color:var(--red);font-size:18px;font-weight:900;';
            xmark.textContent = '×';
            el.appendChild(xmark);
          }

          el.addEventListener('click', () => {
            if(selected.has(idx)) { selected.delete(idx); }
            else if(selected.size < mustDiscard) { selected.add(idx); }
            render();
          });
          cardsArea.appendChild(el);
        });

        const allDone = selected.size >= mustDiscard;
        confirmBtn.disabled = !allDone;
        confirmBtn.style.background = allDone ? 'var(--red)' : 'var(--bg3)';
        confirmBtn.style.color = allDone ? 'white' : 'var(--dim)';
        confirmBtn.style.cursor = allDone ? 'pointer' : 'not-allowed';

        const left = mustDiscard - selected.size;
        subtitle.textContent = left > 0 ? `最多保留${maxRetain}张，还需弃掉${left}张` : '✓ 已选完，点击确认';
      };

      confirmBtn.addEventListener('click', async () => {
        if(confirmBtn.disabled) return;
        const selectedIdx=[...selected];
        await Promise.all(selectedIdx.map(idx=>new Promise(res=>{
          const target=cardsArea.querySelector(`[data-discard-idx="${idx}"]`);
          if(!target){res();return;}
          this._playDiscardAnimation(target.getBoundingClientRect(),target.innerHTML,target.className,res);
        })));
        const sortedIdxs = [...selected].sort((a,b) => b - a);
        for(const idx of sortedIdxs) {
          this._discardCard(this.hand[idx]);
          this.hand.splice(idx, 1);
        }
        overlay.remove();
        this.renderHand();
        resolve();
      });

      render();
      document.getElementById('screen-battle').appendChild(overlay);
    });
  }

  _discardNode(node) {
    if(!node || node.childOf!==undefined) return;
    const def=CARD_DEFS[node.defId];
    if(def.consume && this.hasPlugin('gc_plugin') && Math.random()<0.4){
      // gc_plugin: consume card saved
      this._discardCard({id:node.id,defId:node.defId});
      return;
    }
    if(!def.consume) this._discardCard({id:node.id,defId:node.defId});
    if(node.param!=null){const pId='p'+node.param;if(CARD_DEFS[pId])this._discardCard({id:newCardId(),defId:pId});}
  }

  formatCodeSyntax(text) {
    if(!text) return text;
    return String(text)
      .replace(/for\[([^\]]+)\]/g,'循环($1)')
      .replace(/for\(([^)]+)\)/g,'循环($1)')
      .replace(/if\{([^}]+)\}/g,'如果{$1}...则');
  }

  showIntent() {
    const intent=this.enemy.getIntent(this.turn);
    this.currentIntent=intent;
    const codeText=this.formatCodeSyntax(intent.code||('攻击['+intent.val+']'));
    let display=`本回合代码:\n${codeText}`;
    if(intent.type==='atk'){display+=`\n预计伤害: ${intent.totalDmg||intent.val}`;}
    else if(intent.type==='buff'||intent.type==='heal'){display+=`\n效果: ${intent.desc}`;}
    $('#enemy-intent').textContent=display;
  }

  renderAll() {
    this.renderEnemy(); this.renderProgram(); this.renderHand(); this.renderPlayer();
    $('#battle-turn').textContent=`回合 ${this.turn}`;
    $('#btn-run').disabled=false;
  }


  renderEnemy() {
    $('#enemy-sprite').textContent=this.enemy.icon;
    $('#enemy-name').textContent=this.enemy.name;
    const pct=Math.max(0,this.enemy.hp/this.enemy.maxHp*100);
    $('#enemy-hp-bar').style.width=pct+'%';
    $('#enemy-hp-text').textContent=`${Math.max(0,this.enemy.hp)} / ${this.enemy.maxHp}`;
    $('#enemy-shield').textContent=this.enemy.shield>0?`🛡️ ${this.enemy.shield}`:'';
    $('#enemy-status').innerHTML=renderStatusTags(this.enemy.status);

    const codeLibEl = $('#enemy-code-lib');
    if (codeLibEl) {
      const lines = this.enemyCodeLib.length ? this.enemyCodeLib.map(line=>this.formatCodeSyntax(line)).join('\n') : '暂无代码库信息';
      codeLibEl.textContent = `代码库\n${lines}`;
    }

    const abilityEl = $('#enemy-ability');
    if (abilityEl) {
      abilityEl.textContent = `能力\n${this.enemyAbility}`;
    }
  }
  renderPlayer() {
    $('#player-hp').textContent=`${this.player.hp} / ${this.player.maxHp}`;
    $('#player-shield').textContent=this.player.shield;
    $('#param-sum').textContent=`${this.usedParamSum}/${this.maxParamSum}`;
    const totalDraw=this.instructionDrawPile.length+this.paramDrawPile.length;
    const totalDiscard=this.instructionDiscardPile.length+this.paramDiscardPile.length;
    $('#pile-info').textContent=`${totalDraw}抽 / ${totalDiscard}弃`;
    $('#player-status').innerHTML=renderStatusTags(this.player.status);
    const pp=$('#player-plugins');
    if(pp){pp.innerHTML='';(this.run.plugins||[]).forEach(pid=>{const pd=PLUGIN_DEFS[pid];if(pd){
      const s=document.createElement('span');s.className='plugin-icon';s.textContent=pd.icon;
      const tipText=pd.name+': '+pd.desc;
      s.addEventListener('mouseenter',(e)=>{
        let tt=document.getElementById('plugin-tt');
        if(!tt){tt=document.createElement('div');tt.id='plugin-tt';tt.className='plugin-tooltip';document.body.appendChild(tt);}
        tt.textContent=tipText;tt.style.display='block';
        tt.style.left=(e.clientX+8)+'px';tt.style.top=(e.clientY-32)+'px';
      });
      s.addEventListener('mousemove',(e)=>{
        const tt=document.getElementById('plugin-tt');
        if(tt){tt.style.left=(e.clientX+8)+'px';tt.style.top=(e.clientY-32)+'px';}
      });
      s.addEventListener('mouseleave',()=>{
        const tt=document.getElementById('plugin-tt');if(tt)tt.style.display='none';
      });
      pp.appendChild(s);
    }});}
  }

  addLog(text, type='info') {
    const el=document.createElement('div');
    el.className='log-entry log-'+type;
    el.textContent=text;
    const container=$('#log-entries');
    container.appendChild(el);
    container.scrollTop=container.scrollHeight;
  }

  clearLog() { $('#log-entries').innerHTML=''; }

  renderHand() {
    this.closeIfPreviewPopover();
    const container=$('#hand-cards');
    container.innerHTML='';
    // Set up drop-to-hand handler once
    if(!container._handDropBound){
      container._handDropBound=true;
      container.addEventListener('dragover',e=>{e.preventDefault();container.classList.add('hand-drop-target');});
      container.addEventListener('dragleave',e=>{if(!container.contains(e.relatedTarget))container.classList.remove('hand-drop-target');});
      container.addEventListener('drop',e=>{
        e.preventDefault();container.classList.remove('hand-drop-target');
        try{const data=JSON.parse(e.dataTransfer.getData('text/plain'));
        if(data.source==='program'){this.removeLine(data.lineIdx);}
        else if(data.source==='child'){
          // Child slot: return node to hand
          const slot=this.program[data.lineIdx];
          if(slot&&slot.childOf!==undefined&&slot.node){
            this.hand.push({id:slot.node.id,defId:slot.node.defId});
            if(slot.node.param!=null){this.usedParamSum-=slot.node.param;const pId='p'+slot.node.param;if(CARD_DEFS[pId])this.hand.push({id:newCardId(),defId:pId});}
            slot.node=null;this.renderProgram();this.renderHand();
          }
        }
        else if(data.source==='param'){
          // Param dragged back to hand
          const node=this._dragParamNode;
          if(node&&node.param!=null){
            const pId='p'+node.param;if(CARD_DEFS[pId])this.hand.push({id:newCardId(),defId:pId});
            this.usedParamSum-=node.param;node.param=null;
            this._dragParamNode=null;
            this.renderProgram();this.renderHand();
          }
        }}catch(ex){}
      });
    }
    // Group cards by type (instruction includes for/if now)
    const groups = {instruction:[], parameter:[]};
    this.hand.forEach((card,i)=>{
      const def=CARD_DEFS[card.defId];
      groups[def.type].push({card,def,idx:i});
    });
    const zoneConfigs = [
      {key:'instruction', label:'指令区', cls:'zone-instruction'},
      {key:'parameter', label:'参数区', cls:'zone-parameter'},
    ];
    zoneConfigs.forEach((zc,zi)=>{
      const zone = document.createElement('div');
      zone.className = `hand-zone ${zc.cls}`;
      const zlabel = document.createElement('span');
      zlabel.className = 'hand-zone-label';
      zlabel.textContent = zc.label;
      zone.appendChild(zlabel);
      const cards = groups[zc.key];
      if (cards.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = `width:var(--card-w);height:var(--card-h);border-radius:8px;border:1px dashed rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;color:var(--dim);font-size:10px;`;
        empty.textContent = '空';
        zone.appendChild(empty);
      }
      cards.forEach(({card,def,idx:i})=>{
        const el=document.createElement('div');
        el.className=`card ${cardDisplayClass(def)}${def.consume?' consume':''}`;
        el.draggable=true; el.dataset.handIdx=i; el.dataset.cardId=card.id;
        if(this._pendingDrawRevealIds.has(card.id)) el.classList.add('anim-hidden');
        if(def.subtype==='if'||def.subtype==='if_else'){
          el.innerHTML=`<div class="card-icon">${def.icon}</div><div class="card-name if-card-line1">如果【】则</div><div class="card-desc if-card-bonus">${this._getBonusText(def)}</div>`;
        } else {
          el.innerHTML=`<div class="card-icon">${def.icon}</div><div class="card-name">${def.name}</div><div class="card-desc">${def.desc||''}</div>`;
        }
        el.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',JSON.stringify({source:'hand',idx:i}));el.classList.add('dragging');});
        el.addEventListener('dragend',()=>el.classList.remove('dragging'));
        el.addEventListener('click',()=>{
          if(this.phase!=='player') return;
          if(this.selectedCard&&this.selectedCard.idx===i){this.selectedCard=null;this.closeIfPreviewPopover();this.renderHand();return;}
          this.selectedProgramLine=null;
          this.selectedCard={idx:i,card,def};
          const previewCardId=(def.subtype==='if'||def.subtype==='if_else')?card.id:null;
          this.renderHand(); this.renderProgram();
          if(previewCardId){
            const nextAnchor=document.querySelector(`.card[data-card-id="${previewCardId}"]`);
            if(nextAnchor) this.openIfPreviewPopover(nextAnchor,previewCardId,def);
          } else {
            this.closeIfPreviewPopover();
          }
        });
        if((def.subtype==='if'||def.subtype==='if_else') && window.matchMedia('(hover: hover) and (pointer: fine)').matches){
          el.addEventListener('mouseenter',()=>this.openIfPreviewPopover(el,card.id,def));
          el.addEventListener('mouseleave',()=>this.closeIfPreviewPopover());
        }
        if(this.selectedCard&&this.selectedCard.idx===i){
          el.style.transform='translateY(-10px) scale(1.1)';
          el.style.boxShadow=`0 0 20px ${def.subtype?'var(--blue)':def.type==='instruction'?'var(--green)':'var(--purple)'}`;
        }
        zone.appendChild(el);
      });
      container.appendChild(zone);
      if (zi < zoneConfigs.length-1) {
        const sep = document.createElement('div');
        sep.className = 'hand-separator';
        container.appendChild(sep);
      }
    });
  }

  getEffectiveCapacity(def) {
    const base=def.capacity||0; if(!base)return 0;
    if(def.subtype==='for'||def.subtype==='for_accel'||def.subtype==='for_double') return base+(this.hasPlugin('forExpand')?1:0);
    if(def.subtype==='if'||def.subtype==='if_else') return base+(this.hasPlugin('ifExpand')?1:0);
    return base;
  }

  getConditionsForCard(def) {
    const rarity = def?.rarity || 1;
    const count = rarity >= 3 ? 6 : (rarity === 2 ? 4 : 2);
    return IF_CONDITIONS.slice(0, count);
  }

  hasPlugin(id) { return this.run.plugins && this.run.plugins.includes(id); }

  closeIfPreviewPopover() {
    if(this._ifPreviewCleanup){this._ifPreviewCleanup();this._ifPreviewCleanup=null;}
    if(this.ifPreviewPopoverEl){this.ifPreviewPopoverEl.remove();this.ifPreviewPopoverEl=null;}
    this._ifPreviewAnchorCardId=null;
  }

  openIfPreviewPopover(anchorEl, cardId, def) {
    this.closeIfPreviewPopover();
    const availConds=this.getConditionsForCard(def);
    if(!availConds.length) return;
    const pop=document.createElement('div');
    pop.className='condition-popover if-preview-popover';
    const title=document.createElement('div');
    title.className='condition-popover-title';
    title.textContent='条件预览';
    pop.appendChild(title);
    availConds.forEach(c=>{
      const item=document.createElement('div');
      item.className='condition-preview-item';
      item.textContent=`• ${c.label}`;
      pop.appendChild(item);
    });
    document.body.appendChild(pop);
    const rect=anchorEl.getBoundingClientRect();
    const width=Math.max(200,pop.offsetWidth||200);
    const left=Math.min(window.innerWidth-width-8,Math.max(8,rect.left));
    const preferTop=rect.top-pop.offsetHeight-8;
    const top=preferTop>=8?preferTop:Math.min(window.innerHeight-pop.offsetHeight-8,rect.bottom+6);
    pop.style.left=`${left}px`;
    pop.style.top=`${top}px`;
    this.ifPreviewPopoverEl=pop;
    this._ifPreviewAnchorCardId=cardId;
    const onDocDown=(evt)=>{
      if(pop.contains(evt.target)||anchorEl.contains(evt.target)) return;
      this.closeIfPreviewPopover();
    };
    setTimeout(()=>{
      document.addEventListener('mousedown',onDocDown,true);
      document.addEventListener('touchstart',onDocDown,true);
    },0);
    this._ifPreviewCleanup=()=>{
      document.removeEventListener('mousedown',onDocDown,true);
      document.removeEventListener('touchstart',onDocDown,true);
    };
  }

  closeConditionPicker() {
    if(this._conditionPickerCleanup){this._conditionPickerCleanup();this._conditionPickerCleanup=null;}
    if(this.conditionPopoverEl){this.conditionPopoverEl.remove();this.conditionPopoverEl=null;}
  }

  openConditionPicker(anchorEl,node,def) {
    if(this.phase!=='player'||this.running) return;
    this.closeConditionPicker();
    const availConds=this.getConditionsForCard(def);
    if(!availConds.length) return;
    if(!node.condition||!availConds.some(c=>c.id===node.condition)) node.condition=availConds[0].id;

    const pop=document.createElement('div');
    pop.className='condition-popover';
    const title=document.createElement('div');
    title.className='condition-popover-title';
    title.textContent='选择条件';
    pop.appendChild(title);
    availConds.forEach(c=>{
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='condition-option'+(node.condition===c.id?' active':'');
      btn.textContent=c.label;
      btn.addEventListener('click',evt=>{
        evt.stopPropagation();
        node.condition=c.id;
        this.closeConditionPicker();
        this.renderProgram();
      });
      pop.appendChild(btn);
    });

    document.body.appendChild(pop);
    const rect=anchorEl.getBoundingClientRect();
    const width=Math.max(180,pop.offsetWidth||180);
    const left=Math.min(window.innerWidth-width-8,Math.max(8,rect.left));
    const top=Math.min(window.innerHeight-pop.offsetHeight-8,rect.bottom+6);
    pop.style.left=`${left}px`;
    pop.style.top=`${top}px`;
    this.conditionPopoverEl=pop;

    const onDocDown=(evt)=>{
      if(pop.contains(evt.target)||anchorEl.contains(evt.target)) return;
      this.closeConditionPicker();
    };
    setTimeout(()=>document.addEventListener('mousedown',onDocDown,true),0);
    this._conditionPickerCleanup=()=>document.removeEventListener('mousedown',onDocDown,true);
  }

  _renderConditionTrigger(container,node,def) {
    const availConds=this.getConditionsForCard(def);
    if(!availConds.length) return;
    if(!node.condition||!availConds.some(c=>c.id===node.condition)) node.condition=availConds[0].id;
    const current=availConds.find(c=>c.id===node.condition)||availConds[0];
    const trigger=document.createElement('button');
    trigger.type='button';
    trigger.className='condition-picker-trigger';
    trigger.textContent=`【${current.label}】`;
    trigger.addEventListener('mousedown',evt=>evt.stopPropagation());
    trigger.addEventListener('click',evt=>{
      evt.stopPropagation();
      this.openConditionPicker(trigger,node,def);
    });
    container.appendChild(trigger);
  }

  _getBonusText(def) {
    if(!def || !def.bonus) return '';
    return def.bonus.type==='mul'?`×${def.bonus.val}`:`+${def.bonus.val}`;
  }

  _renderIfHeader(container,node,def) {
    const pre=document.createElement('span');
    pre.className='code-block syntax';
    pre.textContent='如果';
    container.appendChild(pre);
    this._renderConditionTrigger(container,node,def);
    const post=document.createElement('span');
    post.className='code-block syntax';
    post.textContent='则：';
    container.appendChild(post);
    return pre;
  }

  _checkPlayerDeath() {
    if(this.player.hp>0) return false;
    // Plugin: trycatch — 30% chance survive at 1HP
    if(this.hasPlugin('trycatch') && Math.random()<0.3){
      this.player.hp=1;
      this.addLog('插件[异常捕获] → 保留1HP!','heal');
      this.showBanner('异常捕获!','var(--green)');
      this.renderPlayer();
      return false;
    }
    // Plugin: checkpoint — revive once
    if(this.hasPlugin('checkpoint') && !this.checkpointUsed){
      this.checkpointUsed=true;
      this.player.hp=15;
      this.addLog('插件[断点续传] → 复活! HP=15','heal');
      this.showBanner('断点续传!','var(--green)');
      this.renderPlayer();
      return false;
    }
    return true; // really dead
  }

  _calcLineDepths() {
    const depths = new Array(PROG_LINES).fill(0);
    const parentGroups = {};
    for(let i=0;i<PROG_LINES;i++){
      const slot=this.program[i];
      if(slot&&slot.childOf!==undefined){
        if(!parentGroups[slot.childOf]) parentGroups[slot.childOf]=[];
        parentGroups[slot.childOf].push(i);
      }
    }
    for(const [pidx, children] of Object.entries(parentGroups)){
      const baseDepth = depths[parseInt(pidx)] + 1;
      const stack = [];
      for(const ci of children){
        while(stack.length && stack[stack.length-1].remaining <= 0) stack.pop();
        depths[ci] = baseDepth + stack.length;
        if(stack.length) stack[stack.length-1].remaining--;
        const slot = this.program[ci];
        if(slot.node){
          const def = CARD_DEFS[slot.node.defId];
          const cap = this.getEffectiveCapacity(def);
          if(cap > 0) stack.push({cap, remaining: cap});
        }
      }
    }
    return depths;
  }

  _nestFlatChildren(flat) {
    const result = [];
    let i = 0;
    while(i < flat.length){
      const item = flat[i]; i++;
      if(item){
        const def = CARD_DEFS[item.defId];
        const cap = this.getEffectiveCapacity(def);
        if(cap > 0){
          const sub = flat.slice(i, i + cap);
          item.children = this._nestFlatChildren(sub);
          i += sub.length;
        }
      }
      result.push(item);
    }
    return result;
  }

  renderProgram() {
    this.closeConditionPicker();
    const container=$('#program-lines');
    container.innerHTML='';
    const depths = this._calcLineDepths();
    for(let i=0;i<PROG_LINES;i++){
      const slot=this.program[i];
      const isChild=slot&&slot.childOf!==undefined;
      const depth=depths[i];
      const line=document.createElement('div');
      line.className='program-line'; line.dataset.lineIdx=i;
      if(depth>0) line.style.paddingLeft=(depth*20)+'px';
      line.addEventListener('dragover',e=>{e.preventDefault();line.classList.add('drag-over');});
      line.addEventListener('dragleave',e=>{if(!line.contains(e.relatedTarget))line.classList.remove('drag-over');});
      line.addEventListener('drop',e=>{e.preventDefault();line.classList.remove('drag-over');this.handleDrop(i,e);});
      const numEl=document.createElement('span');
      numEl.className='line-number'; numEl.textContent=String(i+1).padStart(2,'0');
      if(depth>0){numEl.style.borderLeft=`2px solid rgba(88,166,255,${Math.max(0.15,0.5-depth*0.1)})`;numEl.style.paddingLeft='6px';}
      line.appendChild(numEl);
      const content=document.createElement('div');
      // Determine if slot is empty
      const hasCard=isChild?(slot.node!==null):(slot!==null);
      content.className='line-content'+(hasCard?'':' empty');
      if(!hasCard&&this.selectedCard&&this.selectedCard.def.type!=='parameter') content.classList.add('accept-click');
      if(!hasCard&&!isChild&&this.selectedProgramLine!==null&&!this.selectedCard) content.classList.add('accept-click');
      if(hasCard&&!isChild&&this.selectedProgramLine===i&&!this.selectedCard) content.classList.add('floating-selected');
      content.dataset.lineIdx=i;
      content.addEventListener('click',e=>{
        if(e.target.closest('.condition-picker-trigger, .condition-popover, .condition-option, .param-slot, .remove-btn')) return;
        if(this.selectedProgramLine!==null&&!this.selectedCard){
          this.moveProgramLineByClick(i);
          return;
        }
        if(!isChild&&slot&&!this.selectedCard){
          this.selectedProgramLine=(this.selectedProgramLine===i)?null:i;
          this.renderProgram();
          return;
        }
        if(!this.selectedCard)return;
        const sc=this.selectedCard;
        if(isChild){
          // Child slot click: accept instructions or param auto-snap
          if(sc.def.type==='parameter'){
            if(!slot.node)return;const cDef=CARD_DEFS[slot.node.defId];
            if(!cDef.needsParam)return;
            if(slot.node.param!=null){const oldPId='p'+slot.node.param;if(CARD_DEFS[oldPId])this.hand.push({id:newCardId(),defId:oldPId});this.usedParamSum-=slot.node.param;slot.node.param=null;}
            if(this.usedParamSum+sc.def.value>this.maxParamSum){this.showBanner('参数超限!','var(--red)');return;}
            this.usedParamSum+=sc.def.value;slot.node.param=sc.def.value;
            this.hand.splice(sc.idx,1);this.selectedCard=null;this.renderProgram();this.renderHand();return;
          }
          if(sc.def.type!=='instruction'||slot.node)return;
          const srcEl=document.querySelector(`.card[data-card-id="${sc.card.id}"]`);
          const srcRect=srcEl?srcEl.getBoundingClientRect():null;
          const srcHtml=srcEl?srcEl.innerHTML:'';
          const srcClass=srcEl?srcEl.className:'card';
          slot.node=this._makeNode(sc.card.defId,sc.card.id,sc.def);
          this.hand.splice(sc.idx,1);this.selectedCard=null;this.renderProgram();this.renderHand();
          this._playCardToProgramAnimation(srcRect,i,srcHtml,srcClass);
        } else {
          // Normal slot click
          if(sc.def.type==='parameter'&&slot){
            const pDef=CARD_DEFS[slot.defId];
            if(pDef.needsParam){
              if(slot.param!=null){const oldPId='p'+slot.param;if(CARD_DEFS[oldPId])this.hand.push({id:newCardId(),defId:oldPId});this.usedParamSum-=slot.param;slot.param=null;}
              if(this.usedParamSum+sc.def.value>this.maxParamSum){this.showBanner('参数超限!','var(--red)');return;}
              this.usedParamSum+=sc.def.value;slot.param=sc.def.value;this.hand.splice(sc.idx,1);this.selectedCard=null;this.renderProgram();this.renderHand();return;
            }
          }
          if(sc.def.type==='parameter'||slot)return;
          this._placeCardOnLine(i,sc);
        }
      });
      // Render content
      if(isChild){
        if(slot.branch==='else'&&(i===0||!this.program[i-1]||this.program[i-1].branch==='else'||!this.program[i-1].childOf)){
          // Show else label before first else slot
        }
        // Show else separator if this is the first else slot
        if(slot.branch==='else'){
          const prevSlot=i>0?this.program[i-1]:null;
          if(!prevSlot||!prevSlot.branch||prevSlot.branch!=='else'){
            const elseTag=document.createElement('span');elseTag.className='code-block syntax';elseTag.style.fontSize='10px';elseTag.style.marginRight='4px';
            elseTag.textContent='else:';content.appendChild(elseTag);
          }
        }
        if(slot.node){
          const cDef=CARD_DEFS[slot.node.defId];
          let dragHandle=null;
          if(cDef.subtype==='if'||cDef.subtype==='if_else'){
            dragHandle=this._renderIfHeader(content,slot.node,cDef);
          } else {
            const cb=document.createElement('span');cb.className=`code-block ${cardDisplayClass(cDef)}`;cb.textContent=cDef.name;
            content.appendChild(cb);
            dragHandle=cb;
          }
          if(dragHandle){
            dragHandle.draggable=true;
            dragHandle.addEventListener('dragstart',ev=>{ev.dataTransfer.setData('text/plain',JSON.stringify({source:'child',lineIdx:i}));
              setTimeout(()=>{dragHandle.style.opacity='0.3';line.style.pointerEvents='none';},0);});
            dragHandle.addEventListener('dragend',()=>{dragHandle.style.opacity='1';line.style.pointerEvents='';});
          }
          if(cDef.needsParam) this._renderParamSlot(content,slot.node,()=>this.program[i].node);
          const parentSlot=this.program[slot.childOf];
          let parentDef=null;
          if(parentSlot){
            if(parentSlot.defId) parentDef=CARD_DEFS[parentSlot.defId];
            else if(parentSlot.node&&parentSlot.node.defId) parentDef=CARD_DEFS[parentSlot.node.defId];
          }
          if(parentDef&&cDef.needsParam){
            if((parentDef.subtype==='if'||parentDef.subtype==='if_else')&&parentDef.bonus){
              const bonus=document.createElement('span');
              bonus.className='code-inline-bonus';
              bonus.textContent=this._getBonusText(parentDef);
              content.appendChild(bonus);
            }
          }
          const rm=document.createElement('button');rm.className='remove-btn';rm.textContent='×';
          rm.onclick=(evt)=>{
            evt.stopPropagation();
            this.hand.push({id:slot.node.id,defId:slot.node.defId});
            if(slot.node.param!=null){this.usedParamSum-=slot.node.param;const pId='p'+slot.node.param;if(CARD_DEFS[pId])this.hand.push({id:newCardId(),defId:pId});}
            slot.node=null;this.renderProgram();this.renderHand();
          };
          content.appendChild(rm);
        }
      } else if(slot){
        this.renderProgramNode(content,slot,i);
      }
      line.appendChild(content);
      container.appendChild(line);
    }
    this.renderPlayer();
  }

  _makeNode(defId, id, def) {
    if(!def) def = CARD_DEFS[defId];
    const availConds = this.getConditionsForCard(def);
    return {defId, id, param:null, condition:availConds.length?availConds[0].id:null};
  }

  _placeCardOnLine(i,sc) {
    const srcEl=document.querySelector(`.card[data-card-id="${sc.card.id}"]`);
    const srcRect=srcEl?srcEl.getBoundingClientRect():null;
    const srcHtml=srcEl?srcEl.innerHTML:'';
    const srcClass=srcEl?srcEl.className:'card';
    const def=CARD_DEFS[sc.card.defId];
    const node=this._makeNode(sc.card.defId,sc.card.id,def);
    this.program[i]=node;
    // Reserve child slots for for/if
    const cap=this.getEffectiveCapacity(def);
    if(cap>0){
      for(let c=0;c<cap;c++){
        const ci=i+1+c;
        if(ci<PROG_LINES){
          // Push existing card back to hand
          if(this.program[ci]&&this.program[ci].childOf===undefined) this.removeLine(ci);
          this.program[ci]={childOf:i, node:null};
        }
      }
      // if_else: add else branch slots after if-branch slots
      if(def.subtype==='if_else'){
        const elseCap=(def.elseCapacity||1)+(this.hasPlugin('ifExpand')?1:0);
        for(let c=0;c<elseCap;c++){
          const ci=i+1+cap+c;
          if(ci<PROG_LINES){
            if(this.program[ci]&&this.program[ci].childOf===undefined) this.removeLine(ci);
            this.program[ci]={childOf:i, branch:'else', node:null};
          }
        }
      }
    }
    this.hand.splice(sc.idx,1);
    this.selectedCard=null;
    this.selectedProgramLine=null;
    this.renderProgram(); this.renderHand();
    this._playCardToProgramAnimation(srcRect,i,srcHtml,srcClass);
  }

  moveProgramLineByClick(targetIdx) {
    const fromIdx=this.selectedProgramLine;
    this.selectedProgramLine=null;
    if(fromIdx==null){this.renderProgram();return;}
    if(fromIdx===targetIdx){this.renderProgram();return;}
    const mockEvent={dataTransfer:{getData:()=>JSON.stringify({source:'program',lineIdx:fromIdx})}};
    this.handleDrop(targetIdx,mockEvent);
    this.renderProgram();
  }

  _renderParamSlot(container,node,getNode) {
    const slot=document.createElement('span');
    slot.className='param-slot'+(node.param!=null?' filled':'');
    if(node.param==null&&this.selectedCard&&this.selectedCard.def.type==='parameter') slot.classList.add('accept-click');
    slot.textContent=node.param!=null?`${node.param}`:'?';
    // If param is filled, allow dragging it back to hand
    if(node.param!=null){
      slot.draggable=true;
      slot.style.cursor='grab';
      slot.addEventListener('dragstart',e=>{
        e.stopPropagation();
        e.dataTransfer.setData('text/plain',JSON.stringify({source:'param',nodeRef:true}));
        this._dragParamNode=node;
        setTimeout(()=>{slot.style.opacity='0.3';},0);
      });
      slot.addEventListener('dragend',()=>{slot.style.opacity='1';this._dragParamNode=null;});
    }
    slot.addEventListener('dragover',e=>{e.preventDefault();slot.classList.add('drag-over');});
    slot.addEventListener('dragleave',()=>slot.classList.remove('drag-over'));
    slot.addEventListener('drop',e=>{
      e.preventDefault();e.stopPropagation();slot.classList.remove('drag-over');
      try{const data=JSON.parse(e.dataTransfer.getData('text/plain'));
      if(data.source==='hand'){const card=this.hand[data.idx];if(!card)return;const def=CARD_DEFS[card.defId];
      if(def.type!=='parameter')return;
      // If already has a param, return old one to hand first
      if(node.param!=null){
        const oldPId='p'+node.param;if(CARD_DEFS[oldPId])this.hand.push({id:newCardId(),defId:oldPId});
        this.usedParamSum-=node.param;
      }
      if(this.usedParamSum+def.value>this.maxParamSum){
        // Revert if over limit
        if(node.param!=null){this.usedParamSum+=node.param;this.hand.pop();}
        this.showBanner('参数超限!','var(--red)');return;
      }
      this.usedParamSum+=def.value;node.param=def.value;this.hand.splice(data.idx,1);this.renderProgram();this.renderHand();}}catch(e){}
    });
    slot.addEventListener('click',e=>{
      e.stopPropagation();
      // If param filled and no card selected, return param to hand
      if(node.param!=null&&!this.selectedCard){
        const pId='p'+node.param;if(CARD_DEFS[pId])this.hand.push({id:newCardId(),defId:pId});
        this.usedParamSum-=node.param;node.param=null;
        this.renderProgram();this.renderHand();return;
      }
      if(!this.selectedCard)return;const sc=this.selectedCard;
      if(sc.def.type!=='parameter')return;
      // If already has a param, return old one to hand first
      if(node.param!=null){
        const oldPId='p'+node.param;if(CARD_DEFS[oldPId])this.hand.push({id:newCardId(),defId:oldPId});
        this.usedParamSum-=node.param;
      }
      if(this.usedParamSum+sc.def.value>this.maxParamSum){
        if(node.param!=null){this.usedParamSum+=node.param;this.hand.pop();}
        this.showBanner('参数超限!','var(--red)');return;
      }
      this.usedParamSum+=sc.def.value;node.param=sc.def.value;
      this.hand.splice(sc.idx,1);this.selectedCard=null;
      this.renderProgram();this.renderHand();
    });
    container.appendChild(slot);
  }

  renderProgramNode(container,node,lineIdx) {
    const def=CARD_DEFS[node.defId];
    const block=document.createElement('span');
    block.className=`code-block ${cardDisplayClass(def)}`;
    block.textContent=def.subtype==='if'||def.subtype==='if_else'?'如果':def.name;
    if(this.selectedProgramLine===lineIdx) block.classList.add('floating-selected');
    block.addEventListener('click',e=>{
      e.stopPropagation();
      if(this.phase!=='player'||this.running)return;
      if(this.selectedCard){this.selectedCard=null;this.renderHand();}
      this.selectedProgramLine=(this.selectedProgramLine===lineIdx)?null:lineIdx;
      this.renderProgram();
    });
    block.draggable=true;
    block.addEventListener('dragstart',e=>{
      e.dataTransfer.setData('text/plain',JSON.stringify({source:'program',lineIdx}));
      const lineEl=block.closest('.program-line');
      setTimeout(()=>{
        if(lineEl)lineEl.style.pointerEvents='none';
        block.style.opacity='0.3';
      },0);
    });
    block.addEventListener('dragend',()=>{block.style.opacity='1';
      document.querySelectorAll('.program-line').forEach(cl=>cl.style.pointerEvents='');
    });
    container.appendChild(block);
    if(def.needsParam) this._renderParamSlot(container,node,()=>this.program[lineIdx]);
    if(def.subtype==='if'||def.subtype==='if_else'){
      block.textContent='如果';
      this._renderConditionTrigger(container,node,def);
      const tail=document.createElement('span');
      tail.className='code-block syntax';
      tail.textContent='则：';
      container.appendChild(tail);
    }
    const cap=this.getEffectiveCapacity(def);
    if(cap>0){
      let used=0;
      for(let j=0;j<PROG_LINES;j++){
        if(this.program[j]&&this.program[j].childOf===lineIdx&&this.program[j].node) used++;
      }
      block.classList.add('has-capacity');
      block.dataset.capacityTip=`容量：${used}/${cap}`;
      block.title=`容量：${used}/${cap}`;
    }
    const rm=document.createElement('button');rm.className='remove-btn';rm.textContent='×';
    rm.onclick=(evt)=>{evt.stopPropagation();this.removeLine(lineIdx);};
    container.appendChild(rm);
  }

  handleDrop(lineIdx,e) {
    try{const data=JSON.parse(e.dataTransfer.getData('text/plain'));
    const slot=this.program[lineIdx];
    const isChild=slot&&slot.childOf!==undefined;
    if(data.source==='hand'){const card=this.hand[data.idx];if(!card)return;const def=CARD_DEFS[card.defId];
    // Auto-snap: parameter dropped on a line with a card → fill/replace its param slot
    if(def.type==='parameter'){
      if(isChild){
        if(!slot.node)return;const cDef=CARD_DEFS[slot.node.defId];
        if(!cDef.needsParam)return;
        // Return old param if replacing
        if(slot.node.param!=null){
          const oldPId='p'+slot.node.param;if(CARD_DEFS[oldPId])this.hand.push({id:newCardId(),defId:oldPId});
          this.usedParamSum-=slot.node.param;slot.node.param=null;
        }
        if(this.usedParamSum+def.value>this.maxParamSum){this.showBanner('参数超限!','var(--red)');return;}
        this.usedParamSum+=def.value;slot.node.param=def.value;this.hand.splice(data.idx,1);this.renderProgram();this.renderHand();return;
      }
      if(!slot)return;const pDef=CARD_DEFS[slot.defId];
      if(pDef.needsParam){
        // Return old param if replacing
        if(slot.param!=null){
          const oldPId='p'+slot.param;if(CARD_DEFS[oldPId])this.hand.push({id:newCardId(),defId:oldPId});
          this.usedParamSum-=slot.param;slot.param=null;
        }
        if(this.usedParamSum+def.value>this.maxParamSum){this.showBanner('参数超限!','var(--red)');return;}
        this.usedParamSum+=def.value;slot.param=def.value;this.hand.splice(data.idx,1);this.renderProgram();this.renderHand();return;
      }
      return;
    }
    if(def.type!=='instruction')return;
    if(isChild){
      if(slot.node)return; // child slot occupied
      const srcEl=document.querySelector(`.card[data-card-id="${card.id}"]`);
      const srcRect=srcEl?srcEl.getBoundingClientRect():null;
      const srcHtml=srcEl?srcEl.innerHTML:'';
      const srcClass=srcEl?srcEl.className:'card';
      slot.node=this._makeNode(card.defId,card.id,def);
      this.hand.splice(data.idx,1);this.renderProgram();this.renderHand();
      this._playCardToProgramAnimation(srcRect,lineIdx,srcHtml,srcClass);
      return;
    }
    if(slot)return; // top-level occupied
    this._placeCardOnLine(lineIdx,{idx:data.idx,card,def});}
    // Drag from program line → move to another line
    else if(data.source==='program'){
      const fromIdx=data.lineIdx;
      if(fromIdx===lineIdx) return;
      const fromSlot=this.program[fromIdx];
      if(!fromSlot||fromSlot.childOf!==undefined) return; // can't move child slots as top-level
      const fDef=CARD_DEFS[fromSlot.defId];
      const cap=this.getEffectiveCapacity(fDef);

      // Case 1: Dropping on own child slot → reposition parent
      if(isChild && slot.childOf===fromIdx){
        // Check room for new children at lineIdx+1..lineIdx+cap
        for(let c=0;c<cap;c++){
          const ci=lineIdx+1+c;
          if(ci>=PROG_LINES) return;
          const t=this.program[ci];
          // Allow: empty, own child slot, or target line itself (will be overwritten)
          if(t && t.childOf!==fromIdx && t.childOf===undefined && ci!==fromIdx) return;
        }
        // Collect child node contents to preserve
        const childContents=[];
        for(let j=0;j<PROG_LINES;j++){
          if(this.program[j]&&this.program[j].childOf===fromIdx){
            childContents.push(this.program[j].node);
            this.program[j]=null;
          }
        }
        this.program[fromIdx]=null;
        this.program[lineIdx]=fromSlot;
        // Place new child slots, restore contents where possible
        for(let c=0;c<cap;c++){
          const ci=lineIdx+1+c;
          if(ci<PROG_LINES){
            this.program[ci]={childOf:lineIdx, node:childContents[c]||null};
          }
        }
        this.renderProgram();this.renderHand();return;
      }

      // Case 2: Dropping on another parent's child slot → place as child node (no for/if)
      if(isChild){
        if(slot.node)return;
        if(fDef.subtype)return; // for/if can't go into child slots
        slot.node=this._makeNode(fromSlot.defId,fromSlot.id,fDef);
        slot.node.param=fromSlot.param;
        // Clear source and its child slots
        for(let j=0;j<PROG_LINES;j++){if(this.program[j]&&this.program[j].childOf===fromIdx)this.program[j]=null;}
        this.program[fromIdx]=null;
        this.renderProgram();this.renderHand();return;
      }

      // Case 3: Dropping on an empty top-level slot
      if(slot)return;
      // Check room for children at new position
      if(cap>0){
        for(let c=0;c<cap;c++){
          const ci=lineIdx+1+c;
          if(ci>=PROG_LINES)return;
          const target=this.program[ci];
          if(target&&target.childOf!==fromIdx&&target.childOf===undefined&&ci!==fromIdx)return;
        }
      }
      // Collect child node contents
      const childContents=[];
      for(let j=0;j<PROG_LINES;j++){
        if(this.program[j]&&this.program[j].childOf===fromIdx){
          childContents.push(this.program[j].node);
          this.program[j]=null;
        }
      }
      this.program[fromIdx]=null;
      this.program[lineIdx]=fromSlot;
      if(cap>0){
        for(let c=0;c<cap;c++){
          const ci=lineIdx+1+c;
          if(ci<PROG_LINES) this.program[ci]={childOf:lineIdx, node:childContents[c]||null};
        }
      }
      this.renderProgram();this.renderHand();
    }
    // Drag from child slot → move to another line
    else if(data.source==='child'){
      const fromSlot=this.program[data.lineIdx];
      if(!fromSlot||fromSlot.childOf===undefined||!fromSlot.node)return;
      if(isChild){
        if(slot.node)return;
        slot.node=fromSlot.node;fromSlot.node=null;
      } else {
        if(slot)return;
        const cDef=CARD_DEFS[fromSlot.node.defId];
        this.program[lineIdx]={defId:fromSlot.node.defId,id:fromSlot.node.id,param:fromSlot.node.param,condition:fromSlot.node.condition};
        // If it's a for/if, reserve child slots
        const cap=this.getEffectiveCapacity(cDef);
        if(cap>0){
          for(let c=0;c<cap;c++){const ci=lineIdx+1+c;if(ci<PROG_LINES){if(this.program[ci]&&!this.program[ci].childOf)this.removeLine(ci);this.program[ci]={childOf:lineIdx,node:null};}}
        }
        fromSlot.node=null;
      }
      this.renderProgram();this.renderHand();
    }}catch(e){}
  }

  removeLine(lineIdx) {
    if(this.selectedProgramLine===lineIdx) this.selectedProgramLine=null;
    const slot=this.program[lineIdx]; if(!slot)return;
    if(slot.childOf!==undefined){
      // Removing a child slot's content → return node to hand
      if(slot.node){
        this.hand.push({id:slot.node.id,defId:slot.node.defId});
        if(slot.node.param!=null){this.usedParamSum-=slot.node.param;const pId='p'+slot.node.param;if(CARD_DEFS[pId])this.hand.push({id:newCardId(),defId:pId});}
        slot.node=null;
      }
    } else {
      // Top-level node: return to hand
      this.hand.push({id:slot.id,defId:slot.defId});
      if(slot.param!=null){this.usedParamSum-=slot.param;const pId='p'+slot.param;if(CARD_DEFS[pId])this.hand.push({id:newCardId(),defId:pId});}
      // Also clear child slots belonging to this parent and return their contents
      for(let j=0;j<PROG_LINES;j++){
        if(this.program[j]&&this.program[j].childOf===lineIdx){
          if(this.program[j].node){
            this.hand.push({id:this.program[j].node.id,defId:this.program[j].node.defId});
            if(this.program[j].node.param!=null){this.usedParamSum-=this.program[j].node.param;const pId='p'+this.program[j].node.param;if(CARD_DEFS[pId])this.hand.push({id:newCardId(),defId:pId});}
          }
          this.program[j]=null;
        }
      }
      this.program[lineIdx]=null;
    }
    this.renderProgram();this.renderHand();
  }

  clearProgram() { this.selectedProgramLine=null;for(let i=PROG_LINES-1;i>=0;i--){const s=this.program[i];if(s&&s.childOf===undefined)this.removeLine(i);} }

  // === CODE EXECUTION ===
  async runCode() {
    if(this.running||this.phase!=='player') return;
    this.selectedProgramLine=null;
    this.running=true; this.phase='executing'; $('#btn-run').disabled=true;

    const ctx = {
      bstate:this, dmgMult:(this.turn===1&&this.hasPlugin('overclock'))?1.3:1, steps:0, maxSteps:80, hasAttacked:false, loopDepth:0, usedParamInstruction:false,
      dealDamage:(val)=>{
        let dmg=val;
        if(this.player.status.doubleNext){dmg*=2;this.player.status.doubleNext=false;}
        if(this.enemy.status.vulnerable>0) dmg=Math.floor(dmg*1.3);
        if(this.enemy.shield>0){const ab=Math.min(this.enemy.shield,dmg);this.enemy.shield-=ab;dmg-=ab;}
        this.enemy.hp-=dmg;
        ctx.hasAttacked=true;
        this.renderEnemy();
        this.addLog(`攻击 → 敌人 -${val}`,'dmg');
        this.floatText($('#enemy-sprite'),`-${val}`,'var(--red)');$('#enemy-sprite').classList.add('shake');setTimeout(()=>$('#enemy-sprite').classList.remove('shake'),300);
      },
      addShield:(val)=>{this.player.shield+=val;this.renderPlayer();this.addLog(`防御 → +${val} 护盾`,'shield');this.floatText($('#player-panel'),`+${val} 🛡️`,'var(--blue)');},
      healHP:(val)=>{this.player.hp=Math.min(this.player.maxHp,this.player.hp+val);this.renderPlayer();this.addLog(`治疗 → +${val} HP`,'heal');this.floatText($('#player-panel'),`+${val} HP`,'var(--green)');},
      drawCards:(val)=>{this.drawCards(val);}
    };
    try{
      const lines=[];
      for(let i=0;i<PROG_LINES;i++){
        const slot=this.program[i];
        if(!slot) continue;
        if(slot.childOf!==undefined) continue; // skip child slots, handled by parent
        const def=CARD_DEFS[slot.defId];
        const cap=this.getEffectiveCapacity(def);
        const entry={...slot,lineIdx:i};
        // Collect children from subsequent flat slots, then nest
        if(cap>0){
          const rawChildren=[], rawElse=[];
          for(let j=0;j<PROG_LINES;j++){
            const cs=this.program[j];
            if(cs&&cs.childOf===i){
              const item=cs.node?{...cs.node,lineIdx:j}:null;
              if(cs.branch==='else') rawElse.push(item);
              else rawChildren.push(item);
            }
          }
          entry.children=this._nestFlatChildren(rawChildren);
          entry.elseChildren=this._nestFlatChildren(rawElse);
        }
        lines.push(entry);
      }
      await this.executeLines(lines,ctx);
    }catch(err){if(err.message==='OVERFLOW')this.showBanner('栈溢出!','var(--red)');}

    // If enemy dead, skip discard and end battle
    if(this.enemy.hp<=0){await delay(300);this.phase='done';this.running=false;this.onBattleEnd(true);return;}

    // 运维: 回合结束获得3护盾
    if(this.run.character==='ops'){
      this.player.shield+=3;
      this.addLog('运维: 回合结束 +3护盾','info');
      this.renderPlayer();
    }

    // Check if player needs to discard excess hand cards
    let maxRetain = (this.run.maxRetain || MAX_RETAIN) + (this.hasPlugin('cache')?1:0);
    // 架构师: for不计入手牌上限
    if(this.run.character==='architect'){
      const forCount = this.hand.filter(c=>{const d=CARD_DEFS[c.defId];return d&&(d.subtype==='for'||d.subtype==='for_accel'||d.subtype==='for_double');}).length;
      maxRetain += forCount;
    }
    const needsDiscard = this._checkNeedsDiscard(maxRetain);
    if(needsDiscard) {
      await this._showDiscardUI(maxRetain);
    }

    await delay(200);
    await this.enemyTurn();
    this.running=false;
    if(this.enemy.hp<=0){this.phase='done';this.onBattleEnd(true);return;}
    if(this._checkPlayerDeath()){this.phase='done';this.onBattleEnd(false);return;}
    this.startTurn();
  }

  async executeLines(lines,ctx) {
    for(let i=0;i<lines.length;i++){
      ctx.steps++;if(ctx.steps>ctx.maxSteps)throw new Error('OVERFLOW');
      const node=lines[i];const def=CARD_DEFS[node.defId];
      if(def.needsParam && !def.subtype) ctx.usedParamInstruction=true;
      if(node.lineIdx!==undefined) this.highlightLine(node.lineIdx,true);
      await delay(60);
      if(def.subtype==='for'||def.subtype==='for_accel'||def.subtype==='for_double'){
        const times=Math.min(node.param||1,10);
        const children=(node.children||[]).filter(c=>c!==null).map(c=>({...c}));
        ctx.loopDepth++;
        for(let loop=0;loop<times;loop++){
          if(def.subtype==='for_accel') ctx.dmgMult+=1;
          if(def.subtype==='for_double'){
            for(const child of children){
              await this.executeLines([{...child}],ctx);
              await this.executeLines([{...child}],ctx);
            }
          } else {
            await this.executeLines(children.map(c=>({...c})),ctx);
          }
        }
        ctx.loopDepth--;
        if(def.subtype==='for_accel') ctx.dmgMult=1;
      } else if(def.subtype==='if'){
        const cond=IF_CONDITIONS.find(c=>c.id===node.condition);
        const condMet=cond?cond.check(ctx):false;
        this._flashIfResult(node.lineIdx,condMet);
        const children=(node.children||[]).filter(c=>c!==null).map(c=>({...c}));
        if(condMet){
          // 漏洞猎人: if条件满足时额外造成3点伤害
          if(this.run.character==='hunter'){
            ctx.dealDamage(3);
            this.addLog('漏洞猎人: 条件命中 → 额外3伤害','info');
          }
          const oldMult=ctx.dmgMult;
          let bonusVal=def.bonus?def.bonus.val:0;
          if(def.bonus){
            if(def.bonus.type==='mul'){ctx.dmgMult*=bonusVal;await this.executeLines(children,ctx);ctx.dmgMult=oldMult;}
            else if(def.bonus.type==='add'){
              const od=ctx.dealDamage,os=ctx.addShield,oh=ctx.healHP;
              ctx.dealDamage=v=>od(v+bonusVal);ctx.addShield=v=>os(v+bonusVal);ctx.healHP=v=>oh(v+bonusVal);
              await this.executeLines(children,ctx);
              ctx.dealDamage=od;ctx.addShield=os;ctx.healHP=oh;
            }
          } else await this.executeLines(children,ctx);
        } else {this.showBanner('条件不满足','var(--dim)');}
      } else if(def.subtype==='if_else'){
        const cond=IF_CONDITIONS.find(c=>c.id===node.condition);
        const condMet=cond?cond.check(ctx):false;
        this._flashIfResult(node.lineIdx,condMet);
        if(condMet){await this.executeLines((node.children||[]).filter(c=>c!==null).map(c=>({...c})),ctx);}
        else{await this.executeLines((node.elseChildren||[]).filter(c=>c!==null).map(c=>({...c})),ctx);}
      } else if(def.exec){
        let val=node.param||0;
        if(this.chargeNext){val*=2;this.chargeNext=false;}
        val=Math.floor(val*ctx.dmgMult);
        def.exec(ctx,val);
        await delay(80);
      }
      if(node.lineIdx!==undefined) this.highlightLine(node.lineIdx,false);
      if(this.enemy.hp<=0) return;
    }
  }

  highlightLine(idx,on) {const lines=$$('.program-line');if(lines[idx]){if(on)lines[idx].classList.add('highlight');else lines[idx].classList.remove('highlight');}}

  // === ENEMY TURN ===
  async enemyTurn() {
    this.phase='enemy';
    this.enemy.shield=0;
    if(this.enemy.status.burn>0){
      const bd=this.enemy.status.burn;
      this.enemy.hp-=bd;
      this.addLog(`燃烧 → 敌人 -${bd}`,'dmg');
      this.floatText($('#enemy-sprite'),`🔥-${bd}`,'var(--red)');
      this.enemy.status.burn--;
      this.renderEnemy(); await delay(400);
      if(this.enemy.hp<=0) return;
    }
    this.addLog('敌人行动','turn');
    this.showBanner('敌人回合','var(--red)');
    await delay(300);
    // Plugin: obfuscate — 10% enemy action fails
    if(this.hasPlugin('obfuscate') && Math.random()<0.1){
      this.addLog('插件[代码混淆] → 敌人指令失败!','info');
      this.showBanner('SyntaxError!','var(--blue)');
      this.renderEnemy();this.renderPlayer();
      await delay(300);
      return;
    }
    const intent=this.currentIntent;
    if(intent.type==='atk'){
      let dmg=intent.val;
      if(this.enemy.status.weaken>0) dmg=Math.max(0,dmg-this.enemy.status.weaken);
      if(this.enemyWeakThisTurn) dmg=Math.floor(dmg*0.7);
      let reflected=0;
      if(this.player.status.reflect>0){reflected=Math.min(this.player.status.reflect,dmg);this.player.status.reflect-=reflected;this.enemy.hp-=reflected;this.addLog(`反弹 → 敌人 -${reflected}`,'shield');this.floatText($('#enemy-sprite'),`反弹-${reflected}`,'var(--blue)');}
      dmg-=reflected;if(dmg<0)dmg=0;
      if(this.player.shield>0){const ab=Math.min(this.player.shield,dmg);this.player.shield-=ab;dmg-=ab;}
      this.player.hp-=dmg;
      this.addLog(`敌人攻击 → 你 -${intent.val}`,'dmg');
      this.floatText($('#player-panel'),`-${intent.val}`,'var(--red)');
      document.body.classList.add('screen-shake');
      setTimeout(()=>document.body.classList.remove('screen-shake'),200);
    } else if(intent.type==='buff'){
      this.enemy.shield+=(intent.val||10);
      if(intent.totalShield) this.enemy.shield+=intent.totalShield;
      this.addLog(`敌人防御 +${intent.val} 护盾`,'shield');
      this.floatText($('#enemy-sprite'),`+${intent.val} 🛡️`,'var(--blue)');
    } else if(intent.type==='debuff'){
      if(this.hand.length>0){const ri=rand(0,this.hand.length-1);this.hand.splice(ri,1);}
      this.addLog(`敌人施法: ${intent.desc}`,'info');
      this.floatText($('#player-panel'),intent.desc,'var(--purple)');
    } else if(intent.type==='heal'){
      this.enemy.hp=Math.min(this.enemy.maxHp,this.enemy.hp+intent.val);
      this.addLog(`敌人治疗 +${intent.val} HP`,'heal');
      this.floatText($('#enemy-sprite'),`+${intent.val} HP`,'var(--green)');
    }
    if(intent.steal){this.enemy.hp=Math.min(this.enemy.maxHp,this.enemy.hp+Math.floor(intent.val/2));}
    if(this.enemy.status.poison>0){
      const pd=this.enemy.status.poison;
      this.enemy.hp-=pd;
      this.addLog(`中毒 → 敌人 -${pd}`,'dmg');
      this.floatText($('#enemy-sprite'),`🧪-${pd}`,'var(--green)');
      this.enemy.status.poison--;
      if(this.enemy.hp<=0){this.renderEnemy();return;}
    }
    // Decrement enemy status effects
    if(this.enemy.status.weaken>0) this.enemy.status.weaken--;
    if(this.enemy.status.vulnerable>0) this.enemy.status.vulnerable--;
    this.renderEnemy();this.renderPlayer();
    await delay(300);
  }

  floatText(anchor,text,color) {
    const el=document.createElement('div');el.className='float-text';el.textContent=text;el.style.color=color;
    const rect=anchor.getBoundingClientRect();
    el.style.left=(rect.left+rect.width/2-30)+'px';el.style.top=rect.top+'px';
    document.body.appendChild(el);setTimeout(()=>el.remove(),800);
  }

  showBanner(text,color) {
    const el=document.createElement('div');el.className='turn-banner';el.textContent=text;el.style.color=color;el.style.textShadow=`0 0 30px ${color}`;
    document.body.appendChild(el);setTimeout(()=>el.remove(),900);
  }
}
