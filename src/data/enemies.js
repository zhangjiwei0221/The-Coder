import { rand } from '../core/utils.js';

// === ENEMY DEFINITIONS ===
export const ENEMIES = {
  bug:{name:'Bug',icon:'🐛',hp:32,tier:1,getIntent(t){if(t%3===2)return{type:'buff',val:7,desc:'获得7护盾',code:'防御[7]'};if(t%3===0)return{type:'atk',val:7,code:'攻击[7]\n防御[7]',totalDmg:7,totalShield:7};return{type:'atk',val:7,code:'攻击[7]'};}},
  typo:{name:'错字虫',icon:'📝',hp:30,tier:1,getIntent(t){const v=rand(6,9);return{type:'atk',val:v,code:`攻击[${v}]`};}},
  redpoint:{name:'红点提醒',icon:'🔴',hp:34,tier:1,getIntent(t){if(t%3===0)return{type:'debuff',val:0,desc:'下回合少抽1张牌',code:'提醒弹出()',drawPenalty:{any:1}};return{type:'atk',val:6,code:'攻击[6]'};}},
  nullptr:{name:'空值幽影',icon:'⚠️',hp:38,tier:1,getIntent(t){if(t%3===2)return{type:'buff',val:0,desc:'潜伏一回合',code:'// 空值潜伏'};if(t%3===0)return{type:'atk',val:12,code:'攻击[12]'};return{type:'atk',val:8,code:'攻击[8]'};}},
  chaser:{name:'催单员',icon:'📣',hp:40,tier:1,getIntent(t){const v=5+t*2;return{type:'atk',val:v,code:`攻击[${v}] // 催促+${t}`};}},
  todo:{name:'待办残片',icon:'📌',hp:42,tier:1,getIntent(t){return t%2===0?{type:'buff',val:8,desc:'获得8护盾',code:'防御[8]'}:{type:'atk',val:9,code:'攻击[9]'};}},
  infloop:{name:'InfiniteLoop',icon:'♾️',hp:35,tier:2,getIntent(t){const v=3+t*2;return{type:'atk',val:v,code:`攻击[${v}]`};}},
  memleak:{name:'MemoryLeak',icon:'💧',hp:40,tier:2,getIntent(t){return{type:'atk',val:rand(4,6),code:`吸血[${rand(4,6)}]`,steal:true};}},
  recursion:{name:'Recursion',icon:'🔄',hp:45,tier:2,getIntent(t){const v=Math.min(5*Math.pow(2,t-1),40);return{type:'atk',val:v,code:`攻击[${v}]`};}},
  stackoverflow:{name:'StackOverflow',icon:'📚',hp:55,tier:2,getIntent(t){return{type:'atk',val:4,code:'循环(3)\n  攻击[4]',totalDmg:12};}},
  racecond:{name:'RaceCondition',icon:'🏃',hp:50,tier:2,getIntent(t){const v=rand(3,20);return{type:'atk',val:v,code:`攻击[${v}] // random!`};}},
  deadlock:{name:'Deadlock',icon:'🔒',hp:60,tier:2,getIntent(t){return t%2===0?{type:'buff',val:15,desc:'获得15护盾',code:'防御[15]'}:{type:'atk',val:20,code:'攻击[20]'};}},
  gc:{name:'GarbageCollector',icon:'🗑️',hp:35,tier:2,getIntent(t){return t%2===0?{type:'debuff',val:1,desc:'移除1张手牌',code:'gc.collect()'}:{type:'atk',val:rand(6,10),code:`攻击[${rand(6,10)}]`};}},
  syntaxerr:{name:'红字审判',icon:'🚫',hp:140,tier:3,getIntent(t){if(t%4===0)return{type:'buff',val:12,desc:'获得12护盾',code:'防御[12]'};if(t%4===2)return{type:'debuff',val:1,desc:'随机弃掉1张手牌',code:'语法错误!'};const v=rand(12,18);return{type:'atk',val:v,code:`攻击[${v}]`};}},
  firewall:{name:'Firewall',icon:'🔥',hp:120,tier:3,getIntent(t){if(t%3===0)return{type:'buff',val:20,desc:'获得20护盾',code:'防御[20]'};if(t%3===1)return{type:'atk',val:10,code:'防御[15]\n攻击[10]',totalDmg:10,totalShield:15};return{type:'atk',val:25,code:'攻击[25]'};}},
  root:{name:'Root',icon:'💀',hp:200,tier:4,getIntent(t){if(t%5===0)return{type:'buff',val:30,desc:'获得30护盾',code:'循环(3)\n  防御[10]'};if(t%3===0)return{type:'heal',val:20,desc:'回复20HP',code:'治疗[20]'};return{type:'atk',val:rand(20,30),code:`攻击[${rand(20,30)}]`};}},
};

export const ENEMY_UI_META = {
  Bug: { codeLib:['攻击[7]','防御[7]'], ability:'行动循环: 攻击 → 防御 → 攻击+防御。' },
  错字虫: { codeLib:['攻击[6-9]'], ability:'每回合造成小幅随机伤害。' },
  红点提醒: { codeLib:['攻击[6]','提醒弹出()'], ability:'每3回合干扰一次，下回合少抽1张牌。' },
  空值幽影: { codeLib:['攻击[8]','// 空值潜伏','攻击[12]'], ability:'会潜伏一回合，随后打出更高伤害。' },
  催单员: { codeLib:['攻击[5+t*2]'], ability:'伤害随回合逐步提高，拖久会变危险。' },
  待办残片: { codeLib:['攻击[9]','防御[8]'], ability:'攻击和防御交替出现。' },
  InfiniteLoop: { codeLib:['攻击[3+t*2]'], ability:'伤害随回合数线性增长。' },
  MemoryLeak: { codeLib:['吸血[4-6]'], ability:'造成伤害后会回复生命。' },
  Recursion: { codeLib:['攻击[5,10,20,40]'], ability:'伤害呈指数级增长。' },
  StackOverflow: { codeLib:['循环(3){攻击[4]}'], ability:'周期性多段打击压制。' },
  RaceCondition: { codeLib:['攻击[3-20] // 随机'], ability:'伤害波动大，极不稳定。' },
  Deadlock: { codeLib:['防御[15]','攻击[20]'], ability:'防御与爆发回合交替。' },
  GarbageCollector: { codeLib:['垃圾回收()','攻击[6-10]'], ability:'干扰你的手牌资源。' },
  红字审判: { codeLib:['防御[12]','攻击[12-18]','语法错误!'], ability:'Boss: 周期性干扰手牌，并用较高伤害检验基础攻防。' },
  Firewall: { codeLib:['防御[20]','防御[15]+攻击[10]','攻击[25]'], ability:'Boss: 高护盾并伴随高爆发。' },
  Root: { codeLib:['循环(3){防御[10]}','治疗[20]','攻击[20-30]'], ability:'最终Boss，兼具回复、护盾与爆发。' },
};
