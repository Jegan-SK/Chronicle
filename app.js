/* =========================================
   CHRONICLE — TIMETABLE TRACKER
   Redesigned core logic — vanilla JavaScript
   ========================================= */
'use strict';

const STORAGE_USERS = 'chronicle_users';
const STORAGE_SESSION = 'chronicle_session';
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAY_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WINTER_START = new Date(2026, 9, 1);
const WINTER_END = new Date(2026, 11, 31);

let currentUser = null;
let userData = null;
let currentDate = new Date();
let activeTab = 'daily';
let selectedDays = new Set();
let winterMonth = 9;

function getUsers(){ return JSON.parse(localStorage.getItem(STORAGE_USERS) || '{}'); }
function saveUsers(users){ localStorage.setItem(STORAGE_USERS, JSON.stringify(users)); }
function getSession(){ return localStorage.getItem(STORAGE_SESSION) || null; }
function setSession(username){ localStorage.setItem(STORAGE_SESSION, username); }
function clearSession(){ localStorage.removeItem(STORAGE_SESSION); }
function generateId(){ return '_' + Math.random().toString(36).slice(2,11); }

function emptyUserData(){
  return { dailyTasks: [], varyingTasks: [], rites: [], completions: {}, todos: {}, lockedScores: {} };
}

function normalizeTask(task){
  if (!task.points || Number(task.points) <= 0) task.points = 1;
  task.points = Number(task.points);
  return task;
}
function normalizeUserData(data){
  const base = emptyUserData();
  const d = data || {};
  userData = {
    dailyTasks: Array.isArray(d.dailyTasks) ? d.dailyTasks.map(normalizeTask) : [],
    varyingTasks: Array.isArray(d.varyingTasks) ? d.varyingTasks.map(t => normalizeTask({...t, days:Array.isArray(t.days)?t.days:[]})) : [],
    rites: Array.isArray(d.rites) ? d.rites.map(normalizeTask) : [],
    completions: d.completions && typeof d.completions === 'object' ? d.completions : {},
    todos: d.todos && typeof d.todos === 'object' ? d.todos : base.todos,
    lockedScores: d.lockedScores && typeof d.lockedScores === 'object' ? d.lockedScores : base.lockedScores
  };
  return userData;
}
function saveUserData(){
  const users = getUsers();
  if (!users[currentUser]) return;
  users[currentUser].data = userData;
  saveUsers(users);
}

function dateKey(d){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function parseDateKey(k){ const [y,m,d]=k.split('-').map(Number); return new Date(y,m-1,d); }
function cloneDate(d){ return new Date(d.getFullYear(),d.getMonth(),d.getDate()); }
function isSameDay(a,b){ return dateKey(a) === dateKey(b); }
function formatDisplayDate(d){ return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`; }
function formatShortDate(d){ return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0,3)}`; }
function todayKey(){ return dateKey(new Date()); }

function showPage(id){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const page=document.getElementById(id); if(page) page.classList.add('active');
}
function showHome(){ showPage('page-home'); renderHomeView(); updateTopBarLabels(); }
function showGraph(){ showPage('page-graph'); updateTopBarLabels(); renderGraph(); }
function showWinterArc(){
  winterMonth = Math.max(9, Math.min(11, currentDate.getMonth() >= 9 && currentDate.getMonth() <= 11 ? currentDate.getMonth() : 9));
  showPage('page-winter'); updateTopBarLabels(); renderWinterCalendar();
}

function switchToRegister(){
  document.getElementById('form-login').classList.remove('active');
  document.getElementById('form-register').classList.add('active');
  hideError('login-error'); hideError('reg-error');
}
function switchToLogin(){
  document.getElementById('form-register').classList.remove('active');
  document.getElementById('form-login').classList.add('active');
  hideError('login-error'); hideError('reg-error');
}
function hideError(id){ document.getElementById(id)?.classList.add('hidden'); }
function showFormError(id,msg){ const el=document.getElementById(id); el.textContent=msg; el.classList.remove('hidden'); }

function handleLogin(){
  const username=document.getElementById('login-username').value.trim();
  const password=document.getElementById('login-password').value;
  const users=getUsers();
  if(!username||!password) return showFormError('login-error','Please fill in all fields.');
  if(!users[username]) return showFormError('login-error','No account found with that username.');
  if(users[username].password!==password) return showFormError('login-error','Incorrect password.');
  currentUser=username; normalizeUserData(users[username].data);
  lockPastScores();
  setSession(username); saveUserData();
  document.getElementById('login-username').value=''; document.getElementById('login-password').value='';
  currentDate=new Date(); showHome();
}
function handleRegister(){
  const username=document.getElementById('reg-username').value.trim();
  const password=document.getElementById('reg-password').value;
  const confirm=document.getElementById('reg-confirm').value;
  const users=getUsers();
  if(!username||!password||!confirm) return showFormError('reg-error','Please fill in all fields.');
  if(username.length<3) return showFormError('reg-error','Username must be at least 3 characters.');
  if(password.length<4) return showFormError('reg-error','Password must be at least 4 characters.');
  if(password!==confirm) return showFormError('reg-error','Passwords do not match.');
  if(users[username]) return showFormError('reg-error','That username is already taken.');
  users[username]={password,data:emptyUserData()}; saveUsers(users);
  currentUser=username; userData=emptyUserData(); setSession(username); saveUserData();
  document.getElementById('reg-username').value=''; document.getElementById('reg-password').value=''; document.getElementById('reg-confirm').value='';
  currentDate=new Date(); showHome();
}
function handleLogout(){ clearSession(); currentUser=null; userData=null; currentDate=new Date(); showPage('page-auth'); }

function updateTopBarLabels(){
  const ids=['display-username','graph-username-label','winter-username-label'];
  ids.forEach(id=>{ const el=document.getElementById(id); if(el) el.textContent=currentUser||''; });
  const initials=(currentUser||'?').slice(0,1).toUpperCase();
  ['user-avatar-icon','graph-avatar-icon','winter-avatar-icon'].forEach(id=>{ const el=document.getElementById(id); if(el) el.textContent=initials; });
}

function navigateDay(delta){ currentDate=cloneDate(currentDate); currentDate.setDate(currentDate.getDate()+delta); if(isDateLocked(dateKey(currentDate))) lockDateIfNeeded(dateKey(currentDate)); renderHomeView(); }
function goToday(){ currentDate=new Date(); renderHomeView(); }
function renderDateDisplay(){
  document.getElementById('display-day-name').textContent=DAY_NAMES[currentDate.getDay()];
  document.getElementById('display-date').textContent=formatDisplayDate(currentDate);
  const today=document.getElementById('today-jump'); if(today) today.classList.toggle('hidden',isSameDay(currentDate,new Date()));
}

function getTasksForDay(dow){
  return {
    daily:userData.dailyTasks,
    varying:userData.varyingTasks.filter(t=>t.days.includes(dow)),
    rites:userData.rites
  };
}
function computeLiveScore(dk){
  const comps=userData.completions[dk]||{};
  const {daily,varying,rites}=getTasksForDay(parseDateKey(dk).getDay());
  const all=[...daily,...varying,...rites];
  const total=all.reduce((sum,t)=>sum+Number(t.points||1),0);
  const done=all.reduce((sum,t)=>sum+(comps[t.id]?Number(t.points||1):0),0);
  return {done,total,pct:total?Math.round(done/total*100):0,taskCount:all.length};
}

function isDateLocked(dk){ return dk < todayKey(); }

function lockDateIfNeeded(dk){
  if(!isDateLocked(dk) || userData.lockedScores?.[dk]) return false;
  const score=computeLiveScore(dk);
  if(score.total<=0) return false;
  if(!userData.lockedScores) userData.lockedScores={};
  userData.lockedScores[dk]={done:score.done,total:score.total,pct:score.pct,taskCount:score.taskCount};
  return true;
}

function lockPastScores(){
  if(!userData.lockedScores) userData.lockedScores={};
  let changed=false;
  const candidateDates=new Set(Object.keys(userData.completions||{}));
  Object.keys(userData.todos||{}).forEach(k=>candidateDates.add(k));
  candidateDates.forEach(dk=>{
    if(lockDateIfNeeded(dk)) changed=true;
  });
  return changed;
}

function computeScore(dk){
  const locked=userData.lockedScores?.[dk];
  if(locked) return {...locked};
  return computeLiveScore(dk);
}
function updateScoreDisplay(){
  const dk=dateKey(currentDate), {done,total,pct}=computeScore(dk);
  document.getElementById('daily-score-display').textContent=pct;
  document.getElementById('daily-total-display').textContent=total?`${done} / ${total} pts`:'No points yet';
  document.getElementById('score-progress-bar').style.width=pct+'%';
  const label=document.getElementById('score-status');
  if(label) label.textContent=isDateLocked(dk)?'Score locked':total===0?'Add scored tasks to begin':pct===100?'Perfect day':'Keep going';
  const area=document.querySelector('.score-area'); if(area) area.classList.toggle('score-locked',isDateLocked(dk));
}

function renderHomeView(){
  if(!userData) return;
  renderDateDisplay(); renderTaskSections(); updateScoreDisplay(); renderTodoSection(); updateTopBarLabels();
}
function renderTaskSections(){
  const dk=dateKey(currentDate), comps=userData.completions[dk]||{};
  const {daily,varying,rites}=getTasksForDay(currentDate.getDay());
  const hasAny=daily.length+varying.length+rites.length>0;
  document.getElementById('empty-tasks-msg').classList.toggle('hidden',hasAny);
  renderSection('daily',daily,comps,'daily-item');
  renderSection('varying',varying,comps,'varying-item');
  renderSection('rites',rites,comps,'rites-item');
  const vlabel=document.getElementById('varying-day-label'); if(vlabel) vlabel.textContent=DAY_NAMES[currentDate.getDay()];
}
function renderSection(type,tasks,comps,itemClass){
  const section=document.getElementById(`section-${type}`), list=document.getElementById(`list-${type}`);
  section.classList.toggle('hidden',tasks.length===0); list.innerHTML='';
  const locked=isDateLocked(dateKey(currentDate));
  tasks.forEach(task=>{
    const checked=!!comps[task.id];
    const item=document.createElement('div'); item.className=`task-item ${itemClass} ${checked?'checked':''} ${locked?'locked':''}`;
    item.dataset.taskId=task.id; item.setAttribute('role','checkbox'); item.setAttribute('aria-checked',checked); item.setAttribute('aria-disabled',locked);
    if(locked) item.title='This day is locked. Scores cannot be changed.';
    const check=document.createElement('span'); check.className='task-checkbox';
    const name=document.createElement('span'); name.className='task-name'; name.textContent=task.name;
    const points=document.createElement('span'); points.className='task-points'; points.textContent=`+${task.points||1}`;
    item.append(check,name,points);
    const toggle=()=>toggleTaskCompletion(task.id);
    if(!locked){
      item.addEventListener('click',toggle);
      item.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}});
    }
    list.appendChild(item);
  });
}
function toggleTaskCompletion(taskId){
  const dk=dateKey(currentDate);
  if(isDateLocked(dk)) return;
  if(!userData.completions[dk]) userData.completions[dk]={};
  userData.completions[dk][taskId]=!userData.completions[dk][taskId]; saveUserData(); renderTaskSections(); updateScoreDisplay();
}

function getTodosForDay(){
  if(!userData.todos) userData.todos={};
  const dk=dateKey(currentDate); if(!userData.todos[dk]) userData.todos[dk]=[];
  return userData.todos[dk];
}
function renderTodoSection(){
  const todos=getTodosForDay(), list=document.getElementById('list-todo'), badge=document.getElementById('todo-badge'), empty=document.getElementById('todo-empty-msg');
  list.innerHTML=''; badge.textContent=todos.filter(t=>!t.done).length;
  empty.classList.toggle('hidden',todos.length>0);
  todos.forEach(todo=>{
    const item=document.createElement('div'); item.className=`todo-item ${todo.done?'done':''}`;
    const check=document.createElement('span'); check.className='todo-check';
    const name=document.createElement('span'); name.className='todo-item-name'; name.textContent=todo.name;
    const del=document.createElement('button'); del.className='todo-item-del'; del.innerHTML='&times;'; del.setAttribute('aria-label',`Delete ${todo.name}`);
    check.addEventListener('click',()=>toggleTodoItem(todo.id)); name.addEventListener('click',()=>toggleTodoItem(todo.id)); del.addEventListener('click',()=>deleteTodoItem(todo.id));
    item.append(check,name,del); list.appendChild(item);
  });
}
function addTodoItem(){
  const input=document.getElementById('input-todo'), name=input.value.trim(); if(!name){input.focus();return;}
  getTodosForDay().push({id:generateId(),name,done:false}); saveUserData(); input.value=''; renderTodoSection(); input.focus();
}
function toggleTodoItem(id){ const todo=getTodosForDay().find(t=>t.id===id); if(!todo)return; todo.done=!todo.done; saveUserData(); renderTodoSection(); }
function deleteTodoItem(id){ const dk=dateKey(currentDate); userData.todos[dk]=getTodosForDay().filter(t=>t.id!==id); saveUserData(); renderTodoSection(); }
function handleTodoKey(e){ if(e.key==='Enter') addTodoItem(); }
function toggleTodoCollapse(){ document.getElementById('todo-body').classList.toggle('collapsed'); document.getElementById('todo-chevron').classList.toggle('collapsed'); }

function openTaskManager(){
  resetDayChips(); switchTab('daily'); renderModalLists(); document.getElementById('modal-overlay').classList.remove('hidden'); setTimeout(()=>document.getElementById('input-daily')?.focus(),100);
}
function closeTaskManager(){ document.getElementById('modal-overlay').classList.add('hidden'); renderHomeView(); }
function closeModalOverlay(e){ if(e.target===document.getElementById('modal-overlay')) closeTaskManager(); }
function switchTab(tab){
  activeTab=tab;
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
  document.getElementById(`tab-${tab}-btn`).classList.add('active'); document.getElementById(`tab-${tab}`).classList.add('active');
}
function toggleDayChip(btn){ const d=Number(btn.dataset.day); selectedDays.has(d)?selectedDays.delete(d):selectedDays.add(d); btn.classList.toggle('active',selectedDays.has(d)); }
function resetDayChips(){ selectedDays=new Set(); document.querySelectorAll('.day-chip').forEach(c=>c.classList.remove('active')); }
function getPointsInput(type){ return document.getElementById(`points-${type}`); }
function addTask(type){
  const input=document.getElementById(`input-${type}`), name=input.value.trim();
  const points=Number(getPointsInput(type)?.value||1);
  if(!name){input.focus();return;}
  if(!Number.isFinite(points)||points<=0){getPointsInput(type)?.focus();return;}
  if(type==='varying'&&selectedDays.size===0){document.getElementById('day-chips').classList.add('invalid');setTimeout(()=>document.getElementById('day-chips').classList.remove('invalid'),500);return;}
  const task={id:generateId(),name,points};
  if(type==='daily') userData.dailyTasks.push(task);
  else if(type==='rites') userData.rites.push(task);
  else { task.days=Array.from(selectedDays).sort((a,b)=>a-b); userData.varyingTasks.push(task); resetDayChips(); }
  input.value=''; if(getPointsInput(type)) getPointsInput(type).value='1'; saveUserData(); renderModalLists(); input.focus();
}
function handleTaskInputKey(e,type){ if(e.key==='Enter') addTask(type); }
function taskCollection(type){ return type==='daily'?userData.dailyTasks:type==='varying'?userData.varyingTasks:userData.rites; }
function editTask(type,id){
  const task=taskCollection(type).find(t=>t.id===id); if(!task)return;
  const name=prompt('Task name:',task.name); if(name===null)return;
  const points=prompt('Points:',String(task.points||1)); if(points===null)return;
  const p=Number(points); if(!name.trim()||!Number.isFinite(p)||p<=0)return alert('Please enter a valid name and positive point value.');
  task.name=name.trim(); task.points=p;
  if(type==='varying'){
    const days=prompt('Active weekdays (Sun,Mon,Tue,Wed,Thu,Fri,Sat), comma separated:',task.days.map(d=>DAY_SHORT[d]).join(','));
    if(days!==null){ const map=Object.fromEntries(DAY_SHORT.map((d,i)=>[d.toLowerCase(),i])); const parsed=days.split(',').map(x=>map[x.trim().toLowerCase()]).filter(x=>x!==undefined); if(parsed.length) task.days=[...new Set(parsed)].sort((a,b)=>a-b); }
  }
  saveUserData(); renderModalLists(); renderHomeView();
}
function deleteTask(type,id){
  const task=taskCollection(type).find(t=>t.id===id); if(!task)return;
  if(!confirm(`Delete "${task.name}"?`))return;
  if(type==='daily') userData.dailyTasks=userData.dailyTasks.filter(t=>t.id!==id);
  else if(type==='varying') userData.varyingTasks=userData.varyingTasks.filter(t=>t.id!==id);
  else userData.rites=userData.rites.filter(t=>t.id!==id);
  Object.keys(userData.completions).forEach(k=>delete userData.completions[k][id]);
  saveUserData(); renderModalLists(); renderHomeView();
}
function renderModalLists(){
  renderModalList('daily',userData.dailyTasks); renderModalList('varying',userData.varyingTasks); renderModalList('rites',userData.rites);
}
function renderModalList(type,tasks){
  const ul=document.getElementById(`modal-list-${type}`); ul.innerHTML='';
  if(!tasks.length){const li=document.createElement('li');li.className='modal-empty';li.textContent='No tasks yet';ul.appendChild(li);return;}
  tasks.forEach(task=>{
    const li=document.createElement('li'); li.className='modal-task-item';
    const info=document.createElement('div'); info.className='modal-task-info';
    const name=document.createElement('span'); name.className='modal-task-name'; name.textContent=task.name;
    const meta=document.createElement('span'); meta.className='modal-task-meta'; meta.textContent=`+${task.points||1}${type==='varying'?' · '+task.days.map(d=>DAY_SHORT[d]).join(' '):''}`;
    info.append(name,meta);
    const actions=document.createElement('div'); actions.className='modal-task-actions';
    const edit=document.createElement('button'); edit.className='btn-small'; edit.textContent='Edit'; edit.onclick=()=>editTask(type,task.id);
    const del=document.createElement('button'); del.className='btn-small danger'; del.textContent='Delete'; del.onclick=()=>deleteTask(type,task.id);
    actions.append(edit,del); li.append(info,actions); ul.appendChild(li);
  });
}

function getTrackedScores(){
  const keys=new Set(Object.keys(userData.completions));
  Object.keys(userData.todos||{}).forEach(k=>{ if(computeScore(k).total>0) keys.add(k); });
  return [...keys].sort().map(dk=>({dk,...computeScore(dk)})).filter(x=>x.total>0);
}
function isPerfectDay(dk){ const s=computeScore(dk); return s.total>0 && s.pct===100; }
function renderGraph(){
  const data=getTrackedScores();
  const canvas=document.getElementById('consistency-chart'), empty=document.getElementById('graph-empty-msg');
  updateStats(data);
  if(!data.length){canvas.classList.add('hidden');empty.classList.remove('hidden');return;}
  canvas.classList.remove('hidden');empty.classList.add('hidden');
  drawChart(canvas,data);
}
function updateStats(data){
  const avg=data.length?Math.round(data.reduce((a,d)=>a+d.pct,0)/data.length):0;
  const best=data.length?Math.max(...data.map(d=>d.pct)):0;
  let perfect=0; data.forEach(d=>{if(d.pct===100)perfect++;});
  let streak=0; let cursor=new Date();
  while(isPerfectDay(dateKey(cursor))){streak++;cursor.setDate(cursor.getDate()-1);}
  if(streak===0){cursor=new Date();cursor.setDate(cursor.getDate()-1);while(isPerfectDay(dateKey(cursor))){streak++;cursor.setDate(cursor.getDate()-1);}}
  const allPerfectDates=data.filter(d=>d.pct===100).map(d=>d.dk);
  let bestStreak=0,current=0,prev=null;
  allPerfectDates.forEach(k=>{const d=parseDateKey(k);if(prev){const diff=(d-prev)/86400000;current=diff===1?current+1:1;}else current=1;bestStreak=Math.max(bestStreak,current);prev=d;});
  document.getElementById('stat-avg').textContent=data.length?avg+'%':'—';
  document.getElementById('stat-best').textContent=data.length?best+'%':'—';
  document.getElementById('stat-streak').textContent=streak+' days';
  document.getElementById('stat-days').textContent=perfect+' perfect';
}
function drawChart(canvas,data){
  const wrap=canvas.parentElement, dpr=window.devicePixelRatio||1, w=Math.max(320,wrap.clientWidth-40), h=Math.max(260,Math.min(390,wrap.clientHeight-40));
  canvas.width=w*dpr;canvas.height=h*dpr;canvas.style.width=w+'px';canvas.style.height=h+'px';
  const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  const pad={l:42,r:18,t:20,b:46}, cw=w-pad.l-pad.r,ch=h-pad.t-pad.b;
  ctx.font='11px Inter, sans-serif';ctx.lineWidth=1;ctx.strokeStyle='rgba(255,255,255,.06)';ctx.fillStyle='rgba(139,144,167,.75)';ctx.textAlign='right';
  [0,25,50,75,100].forEach(v=>{const y=pad.t+ch-(v/100)*ch;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(pad.l+cw,y);ctx.stroke();ctx.fillText(v+'%',pad.l-8,y+4);});
  const pts=data.map((d,i)=>({x:data.length===1?pad.l+cw/2:pad.l+i/(data.length-1)*cw,y:pad.t+ch-d.pct/100*ch,pct:d.pct}));
  if(pts.length>1){ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.lineTo(pts.at(-1).x,pad.t+ch);ctx.lineTo(pts[0].x,pad.t+ch);ctx.closePath();const g=ctx.createLinearGradient(0,pad.t,0,pad.t+ch);g.addColorStop(0,'rgba(108,99,255,.18)');g.addColorStop(1,'rgba(108,99,255,0)');ctx.fillStyle=g;ctx.fill();}
  ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle='#8b83ff';ctx.lineWidth=2.5;ctx.stroke();
  pts.forEach((p,i)=>{ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fillStyle=p.pct===100?'#67d89b':'#8b83ff';ctx.fill();ctx.strokeStyle='#12141a';ctx.lineWidth=2;ctx.stroke();});
  ctx.fillStyle='rgba(139,144,167,.8)';ctx.textAlign='center';const maxLabels=Math.max(2,Math.floor(cw/75)),step=Math.max(1,Math.ceil(data.length/maxLabels));
  pts.forEach((p,i)=>{if(i%step===0||i===pts.length-1)ctx.fillText(formatShortDate(parseDateKey(data[i].dk)),p.x,h-16);});
}

function navigateWinterMonth(delta){ winterMonth=Math.max(9,Math.min(11,winterMonth+delta));renderWinterCalendar(); }
function renderWinterCalendar(){
  document.getElementById('winter-month-label').textContent=`${MONTH_NAMES[winterMonth]} 2026`;
  const grid=document.getElementById('winter-cal-grid');grid.innerHTML='';
  const first=new Date(2026,winterMonth,1), days=new Date(2026,winterMonth+1,0).getDate();
  for(let i=0;i<first.getDay();i++){const blank=document.createElement('div');blank.className='calendar-blank';grid.appendChild(blank);}
  for(let day=1;day<=days;day++){
    const d=new Date(2026,winterMonth,day), dk=dateKey(d), cell=document.createElement('button');
    cell.className='calendar-day';cell.type='button';cell.innerHTML=`<span class="calendar-number">${day}</span>`;
    const inRange=d>=WINTER_START&&d<=WINTER_END, today=isSameDay(d,new Date());
    const score=computeScore(dk);
    if(today)cell.classList.add('today');
    if(!inRange)cell.classList.add('outside');
    if(inRange&&score.total>0){ if(score.pct===100){cell.classList.add('perfect');cell.insertAdjacentHTML('beforeend','<span class="calendar-mark">✓</span>');} else if(d<=new Date()){cell.classList.add('incomplete');cell.insertAdjacentHTML('beforeend','<span class="calendar-mark">×</span>');} }
    else if(inRange&&d<new Date()){cell.classList.add('untracked');}
    cell.addEventListener('click',()=>{currentDate=cloneDate(d);if(isDateLocked(dk)) lockDateIfNeeded(dk);saveUserData();showHome();}); grid.appendChild(cell);
  }
}

function init(){
  const session=getSession();
  if(session){const users=getUsers();if(users[session]){currentUser=session;normalizeUserData(users[session].data);lockPastScores();saveUserData();currentDate=new Date();showHome();return;}}
  showPage('page-auth');
}

document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.getElementById('modal-overlay').classList.contains('hidden'))closeTaskManager();});
document.addEventListener('DOMContentLoaded',()=>{
  ['login-username','login-password'].forEach(id=>document.getElementById(id)?.addEventListener('keydown',e=>{if(e.key==='Enter')handleLogin();}));
  document.getElementById('reg-confirm')?.addEventListener('keydown',e=>{if(e.key==='Enter')handleRegister();});
  window.addEventListener('resize',()=>{if(document.getElementById('page-graph').classList.contains('active'))renderGraph();});
});
init();