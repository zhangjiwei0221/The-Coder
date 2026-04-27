// === STATUS EFFECTS ===
export function emptyStatus() { return {poison:0, burn:0, weaken:0, vulnerable:0, reflect:0, doubleNext:false}; }
export function renderStatusTags(st) {
  let h='';
  if(st.poison>0) h+=`<span class="status-tag" style="background:rgba(63,185,80,.2);color:var(--green)">毒${st.poison}</span>`;
  if(st.burn>0) h+=`<span class="status-tag" style="background:rgba(248,81,73,.2);color:var(--red)">燃${st.burn}</span>`;
  if(st.weaken>0) h+=`<span class="status-tag" style="background:rgba(210,153,34,.2);color:var(--yellow)">弱${st.weaken}</span>`;
  if(st.vulnerable>0) h+=`<span class="status-tag" style="background:rgba(163,113,247,.2);color:var(--purple)">伤${st.vulnerable}</span>`;
  if(st.reflect>0) h+=`<span class="status-tag" style="background:rgba(88,166,255,.2);color:var(--blue)">反${st.reflect}</span>`;
  return h;
}
