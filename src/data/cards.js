export function cardDisplayClass(def) { return def.subtype ? 'syntax' : def.type; }

// === CARD DEFINITIONS ===
export const CARD_DEFS = {
  atk:{type:'instruction',name:'攻击',icon:'⚔️',desc:'造成X点伤害',needsParam:true,rarity:1,exec(ctx,v){ctx.dealDamage(v);}},
  def:{type:'instruction',name:'防御',icon:'🛡️',desc:'获得X点护盾',needsParam:true,rarity:1,exec(ctx,v){ctx.addShield(v);}},
  heal:{type:'instruction',name:'治疗',icon:'💚',desc:'回复X点血量',needsParam:true,consume:true,rarity:2,exec(ctx,v){ctx.healHP(v);}},
  draw:{type:'instruction',name:'抽牌',icon:'🃏',desc:'抽取X张牌',needsParam:true,rarity:2,exec(ctx,v){ctx.drawCards(v);}},
  charge:{type:'instruction',name:'蓄力',icon:'⚡',desc:'下回合首个参数翻倍',needsParam:false,rarity:1,exec(ctx){ctx.bstate.chargeNext=true;}},
  poison:{type:'instruction',name:'毒素',icon:'🧪',desc:'敌人中毒X回合',needsParam:true,rarity:2,exec(ctx,v){ctx.bstate.enemy.status.poison+=v;}},
  burn:{type:'instruction',name:'燃烧',icon:'🔥',desc:'敌人燃烧X回合',needsParam:true,rarity:2,exec(ctx,v){ctx.bstate.enemy.status.burn+=v;}},
  shield:{type:'instruction',name:'护盾',icon:'🛡️',desc:'获得X点护盾',needsParam:true,rarity:1,exec(ctx,v){ctx.addShield(v);}},
  reflect:{type:'instruction',name:'反弹',icon:'🪞',desc:'反弹X点伤害',needsParam:true,consume:true,rarity:3,exec(ctx,v){ctx.bstate.player.status.reflect+=v;}},
  weakenCard:{type:'instruction',name:'削弱',icon:'💫',desc:'敌人减伤X,持续X回合',needsParam:true,rarity:1,exec(ctx,v){ctx.bstate.enemy.status.weaken+=v;}},
  weakAll:{type:'instruction',name:'虚弱',icon:'😵',desc:'敌人攻击-30%本回合',needsParam:false,consume:true,rarity:2,exec(ctx){ctx.bstate.enemyWeakThisTurn=true;}},
  vuln:{type:'instruction',name:'易伤',icon:'🎯',desc:'敌人受伤+X%,X回合',needsParam:true,rarity:2,exec(ctx,v){ctx.bstate.enemy.status.vulnerable+=v;}},
  multiHit:{type:'instruction',name:'连击',icon:'👊',desc:'攻击X次,每次1伤害',needsParam:true,rarity:3,exec(ctx,v){for(let i=0;i<v;i++)ctx.dealDamage(1);}},
  doubleStrike:{type:'instruction',name:'双击',icon:'⚡',desc:'下次攻击双倍伤害',needsParam:false,consume:true,rarity:1,exec(ctx){ctx.bstate.player.status.doubleNext=true;}},
  lifesteal:{type:'instruction',name:'吸血',icon:'🧛',desc:'造成X伤害,回复50%',needsParam:true,consume:true,rarity:3,exec(ctx,v){ctx.dealDamage(v);ctx.healHP(Math.floor(v/2));}},
  // SYNTAX CARDS
  for_loop:{type:'instruction',name:'循环()',icon:'🔁',desc:'循环执行N次',subtype:'for',needsParam:true,rarity:1,capacity:2},
  for_accel:{type:'instruction',name:'循环()×加速',icon:'🔁',desc:'循环N次,每次+1',subtype:'for_accel',needsParam:true,rarity:2,capacity:2},
  for_double:{type:'instruction',name:'循环()×双倍',icon:'🔁',desc:'循环N次,每个指令执行两次',subtype:'for_double',needsParam:true,rarity:3,capacity:2},
  if_atk2:{type:'instruction',name:'如果{×2}...则',icon:'✖️',desc:'效果×2',subtype:'if',bonus:{type:'mul',val:2},capacity:1,needsParam:false,rarity:1},
  if_def2:{type:'instruction',name:'如果{×2}...则',icon:'✖️',desc:'效果×2',subtype:'if',bonus:{type:'mul',val:2},capacity:1,needsParam:false,rarity:1,draftable:false},
  if_bal2:{type:'instruction',name:'如果{+5}...则',icon:'➕',desc:'效果+5',subtype:'if',bonus:{type:'add',val:5},capacity:1,needsParam:false,rarity:2},
  if_hunter3:{type:'instruction',name:'如果{×2}...则',icon:'✖️',desc:'效果×2',subtype:'if',bonus:{type:'mul',val:2},capacity:1,needsParam:false,rarity:3},
  if_plus5:{type:'instruction',name:'如果{+5}...则',icon:'➕',desc:'效果+5',subtype:'if',bonus:{type:'add',val:5},capacity:2,needsParam:false,rarity:1},
  if_gambler5:{type:'instruction',name:'如果{+5}...则',icon:'➕',desc:'效果+5',subtype:'if',bonus:{type:'add',val:5},capacity:1,needsParam:false,rarity:3},
  // PARAMETERS
  p1:{type:'parameter',name:'1',icon:'1',value:1,rarity:1},p2:{type:'parameter',name:'2',icon:'2',value:2,rarity:1},
  p3:{type:'parameter',name:'3',icon:'3',value:3,rarity:1},p4:{type:'parameter',name:'4',icon:'4',value:4,rarity:1},
  p5:{type:'parameter',name:'5',icon:'5',value:5,rarity:1},p6:{type:'parameter',name:'6',icon:'6',value:6,rarity:2},
  p7:{type:'parameter',name:'7',icon:'7',value:7,rarity:2},p8:{type:'parameter',name:'8',icon:'8',value:8,rarity:2},
  p9:{type:'parameter',name:'9',icon:'9',value:9,rarity:3},p10:{type:'parameter',name:'10',icon:'10',value:10,rarity:3},
};
export const IF_CONDITIONS = [
  {id:'enemy_hp_30',tier:1,label:'敌方血量<30%',check:ctx=>ctx.bstate.enemy.hp<ctx.bstate.enemy.maxHp*0.3},
  {id:'player_hp_70',tier:1,label:'我方血量>70%',check:ctx=>ctx.bstate.player.hp>ctx.bstate.player.maxHp*0.7},
  {id:'no_param_instruction',tier:2,label:'本回合未打出过参数型指令',check:ctx=>!ctx.usedParamInstruction},
  {id:'has_dealt_damage',tier:2,label:'本回合已造成过伤害',check:ctx=>ctx.hasAttacked},
  {id:'enemy_hp_50',tier:3,label:'敌方血量<50%',check:ctx=>ctx.bstate.enemy.hp<ctx.bstate.enemy.maxHp*0.5},
  {id:'player_hp_50',tier:3,label:'我方血量>50%',check:ctx=>ctx.bstate.player.hp>ctx.bstate.player.maxHp*0.5},
];

// Initial deck: Instructions(8, including for/if) + Parameters(8) = 16 cards
export const STARTER_DECK = ['atk','atk','atk','def','def','for_loop','for_loop','if_atk2','p2','p2','p3','p3','p3','p4','p4','p5'];
