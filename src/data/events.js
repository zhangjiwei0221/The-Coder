import { newCardId, pick } from '../core/utils.js';

export const EVENTS_LIST = [
  {icon:'💾',title:'废弃数据库',desc:'一排旧硬盘还在低声转动，里面残留着上一个项目的运行缓存。',choices:[{text:'恢复缓存 (+10 HP)',action(r){r.hp=Math.min(r.maxHp,r.hp+10);}},{text:'导出日志 (+14 金币)',action(r){r.gold+=14;}},{text:'跳过',action(){}}]},
  {icon:'🔧',title:'调试工具',desc:'一套完整的调试工具散落在地上，像是有人刚刚从这里撤离。',choices:[{text:'修复自己 (+15 HP)',action(r){r.hp=Math.min(r.maxHp,r.hp+15);}},{text:'卖掉零件 (+18 金币)',action(r){r.gold+=18;}}]},
  {icon:'📦',title:'未知包裹',desc:'一个来历不明的 npm 包静静躺在收件箱里。README 写得过分热情。',choices:[{text:'安装 (随机获得1张牌)',action(r){const p=['atk','def','heal','poison','burn','for_loop','if_atk2','p5','p7'];r.deck.push({id:newCardId(),defId:pick(p)});}},{text:'审计源码 (+10 金币)',action(r){r.gold+=10;}},{text:'太危险了',action(){}}]},
  {icon:'🎰',title:'代码赌场',desc:'屏幕上闪烁着“只差一次提交就能翻盘”。你知道这句话不可信，但它很会说话。',choices:[{text:'赌！(-10 HP, 50%几率+25 HP)',action(r){r.hp-=10;if(Math.random()>.5)r.hp=Math.min(r.maxHp,r.hp+25);}},{text:'卖出预测模型 (+12 金币)',action(r){r.gold+=12;}},{text:'算了',action(){}}]},
  {icon:'☕',title:'凌晨咖啡机',desc:'咖啡机吐出一杯颜色可疑的液体。杯套上写着：热修复专用。',choices:[{text:'喝下去 (+8 HP, +8 金币)',action(r){r.hp=Math.min(r.maxHp,r.hp+8);r.gold+=8;}},{text:'带走杯套 (获得参数5)',action(r){r.deck.push({id:newCardId(),defId:'p5'});}},{text:'保持清醒',action(){}}]},
  {icon:'📋',title:'需求评审会',desc:'会议室里没有人，白板却自动生成了三条互相矛盾的需求。',choices:[{text:'硬着头皮接下 (获得判断卡)',action(r){r.deck.push({id:newCardId(),defId:pick(['if_atk2','if_plus5'])});}},{text:'砍掉范围 (+20 金币, -5 HP)',action(r){r.gold+=20;r.hp-=5;}},{text:'装作没看见',action(){}}]},
  {icon:'🧪',title:'A/B 实验台',desc:'两条分支都声称自己是正确答案，监控曲线像心电图一样抖动。',choices:[{text:'选择 A (获得攻击/防御)',action(r){r.deck.push({id:newCardId(),defId:pick(['atk','def','doubleStrike'])});}},{text:'选择 B (获得循环/参数)',action(r){r.deck.push({id:newCardId(),defId:pick(['for_loop','for_accel','p6','p7'])});}},{text:'关闭实验 (+6 HP)',action(r){r.hp=Math.min(r.maxHp,r.hp+6);}}]},
  {icon:'🧹',title:'缓存清扫',desc:'角落里的缓存文件堆成小山。清理它们会让系统轻一点，但也可能误删灵感。',choices:[{text:'谨慎清扫 (+12 金币)',action(r){r.gold+=12;}},{text:'深度清扫 (-6 HP, 获得抽牌)',action(r){r.hp-=6;r.deck.push({id:newCardId(),defId:'draw'});}},{text:'以后再说',action(){}}]},
  {icon:'📡',title:'离线同事',desc:'一个灰掉的头像突然上线，发来一句“我这边好了”。你完全不知道他说的是哪边。',choices:[{text:'接收补丁 (获得随机稀有牌, -6 HP)',action(r){r.hp-=6;r.deck.push({id:newCardId(),defId:pick(['heal','poison','burn','shield','for_accel','p7'])});}},{text:'让他补文档 (+16 金币)',action(r){r.gold+=16;}},{text:'已读不回',action(){}}]},
  {icon:'🔐',title:'权限弹窗',desc:'一个系统弹窗要求你授权“临时永久管理员权限”。按钮都很大，取消键很小。',choices:[{text:'授权 (+30 金币, -12 HP)',action(r){r.gold+=30;r.hp-=12;}},{text:'最小权限 (+6 金币)',action(r){r.gold+=6;}},{text:'关闭窗口',action(){}}]},
];
