import { newCardId, pick } from '../core/utils.js';

export const EVENTS_LIST = [
  {icon:'💾',title:'废弃数据库',desc:'你发现了一个废弃的数据库...',choices:[{text:'搜索数据 (+10 HP)',action(r){r.hp=Math.min(r.maxHp,r.hp+10);}},{text:'忽略',action(){}}]},
  {icon:'🔧',title:'调试工具',desc:'一套完整的调试工具散落在地上。',choices:[{text:'修复自己 (+15 HP)',action(r){r.hp=Math.min(r.maxHp,r.hp+15);}},{text:'卖掉 (+15 金币)',action(r){r.gold+=15;}}]},
  {icon:'📦',title:'未知包裹',desc:'一个来历不明的npm包...安装它？',choices:[{text:'安装 (随机获得1张牌)',action(r){const p=['atk','def','heal','poison','burn','for_loop','if_atk2','if_def2','p5','p7'];r.deck.push({id:newCardId(),defId:pick(p)});}},{text:'太危险了',action(){}}]},
  {icon:'🎰',title:'代码赌场',desc:'押上你的血量，赌一把？',choices:[{text:'赌！(-10 HP, 50%几率+25 HP)',action(r){r.hp-=10;if(Math.random()>.5)r.hp=Math.min(r.maxHp,r.hp+25);}},{text:'算了',action(){}}]},
];
