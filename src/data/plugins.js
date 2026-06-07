// === PLUGIN DEFINITIONS ===
export const PLUGIN_DEFS = {
  debugger:{name:'调试器',icon:'🔍',desc:'每回合多抽1张指令卡',tier:'normal'},
  cache:{name:'缓存',icon:'💾',desc:'回合结束保留+1张手牌',tier:'normal'},
  preload:{name:'预加载',icon:'⏩',desc:'首回合额外抽2张随机牌',tier:'normal'},
  autosave:{name:'自动保存',icon:'💊',desc:'每回合结束恢复2HP',tier:'normal'},
  gc_plugin:{name:'垃圾回收',icon:'♻️',desc:'本战移出牌40%概率进入弃牌堆',tier:'normal'},
  powermgmt:{name:'电源管理',icon:'🔋',desc:'护盾每回合保留50%',tier:'advanced'},
  checkpoint:{name:'断点续传',icon:'🔄',desc:'死亡复活一次,HP=15',tier:'advanced'},
  trycatch:{name:'异常捕获',icon:'🛡️',desc:'致命伤害30%概率保留1HP',tier:'advanced'},
  overclock:{name:'CPU超频',icon:'⚡',desc:'首回合伤害+30%',tier:'advanced'},
  obfuscate:{name:'代码混淆',icon:'🌀',desc:'敌人10%概率指令执行失败',tier:'advanced'},
  forExpand:{name:'循环扩容',icon:'🔁',desc:'【循环】卡容量+1',tier:'advanced'},
  ifExpand:{name:'判断扩容',icon:'❓',desc:'【如果】卡容量+1',tier:'advanced'},
};
