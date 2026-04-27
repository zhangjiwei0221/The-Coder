export const $ = s => document.querySelector(s);
export const $$ = s => document.querySelectorAll(s);
export const delay = ms => new Promise(r => setTimeout(r, ms));
export const rand = (a,b) => Math.floor(Math.random()*(b-a+1))+a;
export const pick = arr => arr[Math.floor(Math.random()*arr.length)];
export const shuffle = arr => { let a=[...arr]; for(let i=a.length-1;i>0;i--){let j=rand(0,i);[a[i],a[j]]=[a[j],a[i]];} return a; };

let nextId = 1;
export function newCardId() { return nextId++; }
