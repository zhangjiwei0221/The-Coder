// === STATUS EFFECTS ===
export function emptyStatus() { return {poison:0, burn:0, weaken:0, vulnerable:0, reflect:0, stun:0}; }
export function renderStatusTags(st) {
  let h='';
  if(st.poison>0) h+=`<span class="status-tag" style="background:rgba(63,185,80,.2);color:var(--green)">中毒 ${st.poison}</span>`;
  if(st.burn>0) h+=`<span class="status-tag" style="background:rgba(248,81,73,.2);color:var(--red)">燃烧 ${st.burn}</span>`;
  if(st.weaken>0) h+=`<span class="status-tag" style="background:rgba(210,153,34,.2);color:var(--yellow)">干扰 ${st.weaken}</span>`;
  if(st.vulnerable>0) h+=`<span class="status-tag" style="background:rgba(163,113,247,.2);color:var(--purple)">易伤 ${st.vulnerable}</span>`;
  if(st.reflect>0) h+=`<span class="status-tag" style="background:rgba(88,166,255,.2);color:var(--blue)">反弹 ${st.reflect}</span>`;
  if(st.stun>0) h+=`<span class="status-tag" style="background:rgba(88,166,255,.2);color:var(--blue)">眩晕 ${st.stun}</span>`;
  return h || '<span class="status-tag empty-status">无异常</span>';
}
