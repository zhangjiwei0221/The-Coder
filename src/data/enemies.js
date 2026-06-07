import { rand } from '../core/utils.js';

// === ENEMY DEFINITIONS ===
export const ENEMIES = {
  bug:{name:'BUG',icon:'🐛',image:'img/enemies/bug.png',hp:28,tier:1,getIntent(t){if(t%3===2)return{type:'buff',val:5,desc:'获得5护盾',code:'防御[5]'};if(t%3===0)return{type:'atk',val:6,code:'攻击[6]\n防御[5]',totalDmg:6,totalShield:5};return{type:'atk',val:6,code:'攻击[6]'};}},
  error:{name:'Error',icon:'⚠️',image:'img/enemies/error.png',hp:30,tier:1,onHit(self){if(Math.random()<0.1)self.status.stun=Math.max(self.status.stun||0,1);},getIntent(t){const v=rand(7,10);return{type:'atk',val:v,code:`攻击[${v}]`};}},
  loop:{name:'回环',icon:'🔁',image:'img/enemies/loop.png',hp:32,tier:1,getIntent(t){if(t%2===1)return{type:'atk',val:3,code:'循环(3)\n  攻击[3]',hits:[3,3,3],totalDmg:9};return{type:'atk',val:3,code:'循环(2)\n  攻击[3]\n  防御[3]',hits:[3,3],totalDmg:6,totalShield:6};}},
  branch:{name:'岔路',icon:'◇',image:'img/enemies/branch.png',hp:34,tier:1,getIntent(t,self,player){if(t%2===1){const hits=[3];let code='攻击[3]';if(player.shield<=0){hits.push(5);code+='\n如果(你没有护盾)\n  攻击[5]';}if(self.hp<self.maxHp*0.3){hits.push(3);code+='\n如果(自身HP<30%)\n  攻击[3]';}return{type:'atk',val:hits[0],hits,totalDmg:hits.reduce((a,b)=>a+b,0),code};}if(player.shield>0)return{type:'buff',val:5,desc:'你有护盾，岔路转为防御',code:'如果(你有护盾)\n  防御[5]'};self.branchBonus=(self.branchBonus||0)+1;return{type:'debuff',val:0,desc:'下次攻击参数+1',code:'否则\n  参数 += 1',selfBuff:{branchBonus:1}};}},
  ddl:{name:'DDL',icon:'⏰',image:'img/enemies/ddl.png',hp:42,tier:2,getIntent(t){if(t%3===1)return{type:'atk',val:6,code:'攻击[6]\n倒计时[2]'};if(t%3===2)return{type:'debuff',val:0,desc:'施加1层易伤',code:'易伤[1]',vulnerable:1};return{type:'atk',val:12,code:'攻击[12]\nDDL触发()'};}},
  chaser:{name:'催单员',icon:'📣',hp:40,tier:1,getIntent(t){const v=4+t*2;return{type:'atk',val:v,code:`攻击[${v}] // 催促+${t}`};}},
  todo:{name:'待办残片',icon:'📌',hp:40,tier:1,getIntent(t){return t%2===0?{type:'buff',val:7,desc:'获得7护盾',code:'防御[7]'}:{type:'atk',val:8,code:'攻击[8]'};}},
  infloop:{name:'InfiniteLoop',icon:'♾️',hp:35,tier:2,getIntent(t){const v=3+t*2;return{type:'atk',val:v,code:`攻击[${v}]`};}},
  memleak:{name:'MemoryLeak',icon:'💧',hp:40,tier:2,getIntent(t){return{type:'atk',val:rand(4,6),code:`吸血[${rand(4,6)}]`,steal:true};}},
  recursion:{name:'Recursion',icon:'🔄',hp:45,tier:2,getIntent(t){const v=Math.min(5*Math.pow(2,t-1),40);return{type:'atk',val:v,code:`攻击[${v}]`};}},
  stackoverflow:{name:'StackOverflow',icon:'📚',hp:55,tier:2,getIntent(t){return{type:'atk',val:4,code:'循环(3)\n  攻击[4]',totalDmg:12};}},
  racecond:{name:'RaceCondition',icon:'🏃',hp:50,tier:2,getIntent(t){const v=rand(3,20);return{type:'atk',val:v,code:`攻击[${v}] // random!`};}},
  deadlock:{name:'Deadlock',icon:'🔒',hp:60,tier:2,getIntent(t){return t%2===0?{type:'buff',val:15,desc:'获得15护盾',code:'防御[15]'}:{type:'atk',val:20,code:'攻击[20]'};}},
  gc:{name:'GarbageCollector',icon:'🗑️',hp:35,tier:2,getIntent(t){return t%2===0?{type:'debuff',val:1,desc:'移除1张手牌',code:'gc.collect()'}:{type:'atk',val:rand(6,10),code:`攻击[${rand(6,10)}]`};}},
  syntaxerr:{name:'红字审判',icon:'🚫',image:'img/enemies/syntaxerr.png',hp:125,tier:3,getIntent(t){if(t%4===0)return{type:'buff',val:10,desc:'获得10护盾',code:'防御[10]'};if(t%4===2)return{type:'debuff',val:1,desc:'随机弃掉1张手牌',code:'语法错误!'};const v=rand(10,15);return{type:'atk',val:v,code:`攻击[${v}]`};}},
  firewall:{name:'Firewall',icon:'🔥',hp:120,tier:3,getIntent(t){if(t%3===0)return{type:'buff',val:20,desc:'获得20护盾',code:'防御[20]'};if(t%3===1)return{type:'atk',val:10,code:'防御[15]\n攻击[10]',totalDmg:10,totalShield:15};return{type:'atk',val:25,code:'攻击[25]'};}},
  root:{name:'Root',icon:'💀',hp:200,tier:4,getIntent(t){if(t%5===0)return{type:'buff',val:30,desc:'获得30护盾',code:'循环(3)\n  防御[10]'};if(t%3===0)return{type:'heal',val:20,desc:'回复20HP',code:'治疗[20]'};return{type:'atk',val:rand(20,30),code:`攻击[${rand(20,30)}]`};}},
};

export const ENEMY_UI_META = {
  BUG: { codeLib:['攻击[6]','防御[5]'], ability:'行动循环: 攻击 → 防御 → 攻击+防御。' },
  Error: { codeLib:['攻击[7-10]','onHit: 10% → 眩晕'], ability:'每回合只攻击；受到攻击时有10%概率下回合眩晕。' },
  回环: { codeLib:['循环(3){攻击[3]}','循环(2){攻击[3]+防御[3]}'], ability:'用固定多段行动教学循环机制。' },
  岔路: { codeLib:['攻击[3]','如果(你没有护盾){攻击[5]}','如果(你有护盾){防御[5]}','否则 参数+=1'], ability:'根据你的护盾和自身血量选择不同分支。' },
  DDL: { codeLib:['攻击[6]','易伤[1]','攻击[12]'], ability:'精英: 先施加易伤，再用截止触发制造压力。' },
  催单员: { codeLib:['攻击[4+t*2]'], ability:'伤害随回合逐步提高，拖久会变危险。' },
  待办残片: { codeLib:['攻击[8]','防御[7]'], ability:'攻击和防御交替出现。' },
  InfiniteLoop: { codeLib:['攻击[3+t*2]'], ability:'伤害随回合数线性增长。' },
  MemoryLeak: { codeLib:['吸血[4-6]'], ability:'造成伤害后会回复生命。' },
  Recursion: { codeLib:['攻击[5,10,20,40]'], ability:'伤害呈指数级增长。' },
  StackOverflow: { codeLib:['循环(3){攻击[4]}'], ability:'周期性多段打击压制。' },
  RaceCondition: { codeLib:['攻击[3-20] // 随机'], ability:'伤害波动大，极不稳定。' },
  Deadlock: { codeLib:['防御[15]','攻击[20]'], ability:'防御与爆发回合交替。' },
  GarbageCollector: { codeLib:['垃圾回收()','攻击[6-10]'], ability:'干扰你的手牌资源。' },
  红字审判: { codeLib:['防御[10]','攻击[10-15]','语法错误!'], ability:'Boss: 周期性干扰手牌，并用较高伤害检验基础攻防。' },
  Firewall: { codeLib:['防御[20]','防御[15]+攻击[10]','攻击[25]'], ability:'Boss: 高护盾并伴随高爆发。' },
  Root: { codeLib:['循环(3){防御[10]}','治疗[20]','攻击[20-30]'], ability:'最终Boss，兼具回复、护盾与爆发。' },
};
