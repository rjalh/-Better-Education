import {roles,quizzes,materials as baseMaterials,lessons as baseLessons,courses,demoState} from './data.js';

const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const fail=(message,status=400)=>{const e=new Error(message);e.status=status;throw e;};
const day=(offset=0)=>new Date(Date.now()+5*3600000+offset*86400000).toISOString().slice(0,10);
const text=(value,max=200)=>typeof value==='string'?value.trim().slice(0,max):'';
const uid=()=>crypto.randomUUID();
const one=(db,sql,...args)=>db.prepare(sql).bind(...args).first();
const rows=async(db,sql,...args)=>(await db.prepare(sql).bind(...args).all()).results??[];
const run=(db,sql,...args)=>db.prepare(sql).bind(...args).run();
const camelUser=u=>({id:u.id,name:u.name,email:u.email,role:u.role,classId:u.class_id,schoolId:u.school_id,coins:u.coins,streak:u.streak,stars:u.stars,lastActivity:u.last_activity});
const publicUser=u=>({id:u.id,name:u.name,role:u.role,classId:u.class_id,schoolId:u.school_id,coins:u.coins,streak:u.streak,stars:u.stars});
const staff=u=>u.role!=='student';
const scope=(actor,target)=>actor.role==='developer'||(actor.school_id===target.school_id&&(actor.role!=='teacher'||!!actor.class_id&&actor.class_id===target.class_id));
function requireStaff(actor){if(!staff(actor))fail('Доступно только сотрудникам школы.',403);}
function whereScope(actor,alias='u'){
  if(actor.role==='developer')return {sql:'1=1',args:[]};
  if(actor.role==='teacher')return {sql:`${alias}.school_id=? AND ${alias}.class_id=? AND ${alias}.class_id<>''`,args:[actor.school_id,actor.class_id]};
  return {sql:`${alias}.school_id=?`,args:[actor.school_id]};
}
async function audit(db,actor,action,target,detail){await run(db,'INSERT INTO audit_log(id,actor_id,action,target_id,detail) VALUES(?,?,?,?,?)',uid(),actor.id,action,target,JSON.stringify(detail));}
async function readBody(request){
  const size=Number(request.headers.get('content-length')||0);if(size>60000)fail('Слишком большой запрос.',413);
  const raw=await request.text();if(raw.length>60000)fail('Слишком большой запрос.',413);
  try{return JSON.parse(raw||'{}');}catch{fail('Неверный формат запроса.');}
}
async function actorFor(request,env){
  const id=request.headers.get('oai-authenticated-user-id');if(!id)return null;
  if(!env.DB)fail('База данных ещё не подключена. Обратитесь к разработчику.',503);
  const email=(request.headers.get('oai-authenticated-user-email')||'').toLowerCase();
  let name=request.headers.get('oai-authenticated-user-full-name')||'';
  if(request.headers.get('oai-authenticated-user-full-name-encoding')==='percent-encoded-utf-8'){try{name=decodeURIComponent(name);}catch{name='';}}
  const bootstrap=!!env.BOOTSTRAP_DEVELOPER_EMAIL&&email===env.BOOTSTRAP_DEVELOPER_EMAIL.toLowerCase().trim();
  await run(env.DB,'INSERT OR IGNORE INTO users(id,name,email,role) VALUES(?,?,?,?)',id,text(name,100)||email.split('@')[0]||'Ученик',email,bootstrap?'developer':'student');
  if(bootstrap)await run(env.DB,"UPDATE users SET role='developer' WHERE id=? AND email=?",id,email);
  return one(env.DB,'SELECT * FROM users WHERE id=?',id);
}
async function award(db,userId,event,amount,label){
  const r=await run(db,'INSERT OR IGNORE INTO transactions(id,user_id,amount,label) VALUES(?,?,?,?)',event,userId,amount,label);
  return (r.meta?.changes??0)>0;
}
async function activity(db,userId){
  await run(db,'UPDATE users SET streak=CASE WHEN last_activity=? THEN streak WHEN last_activity=? THEN streak+1 ELSE 1 END,last_activity=? WHERE id=?',day(),day(-1),day(),userId);
  const u=await one(db,'SELECT * FROM users WHERE id=?',userId);
  const thresholds=[10,50,...Array.from({length:Math.floor(u.streak/100)},(_,i)=>(i+1)*100)];
  for(const n of thresholds)if(u.streak>=n)await award(db,userId,`streak:${userId}:${n}`,n<=200?n*5:500,`Серия: ${n} дней`);
}
async function allMaterials(db,actor){
  const scoped=staff(actor)?whereScope(actor,'m'):{sql:'m.school_id=? AND (m.class_id=? OR m.class_id=\'\')',args:[actor.school_id,actor.class_id]};
  const custom=await rows(db,`SELECT m.* FROM materials m WHERE ${scoped.sql}`, ...scoped.args);
  const complete=await rows(db,'SELECT material_id FROM completions WHERE user_id=?',actor.id);
  const done=new Set(complete.map(x=>x.material_id));
  return [...baseMaterials,...custom.map(m=>({id:m.id,title:m.title,subject:m.subject,body:m.body,minutes:m.minutes,classId:m.class_id}))].map(m=>({...m,completed:done.has(m.id)}));
}
async function getState(db,actor,env){
  const s=staff(actor)?whereScope(actor):{sql:'u.id=?',args:[actor.id]};
  const scheduleScope=staff(actor)?whereScope(actor,'l'):{sql:"l.school_id=? AND (l.class_id=? OR l.class_id='')",args:[actor.school_id,actor.class_id]};
  const rankingScope=actor.role==='teacher'?whereScope(actor):{sql:'u.school_id=?',args:[actor.school_id]};
  const [grades,transactions,attempts,achievements,mats,customLessons,students,settingRows]=await Promise.all([
    rows(db,`SELECT g.id,g.student_id AS studentId,g.subject,g.score,g.date FROM grades g JOIN users u ON u.id=g.student_id WHERE ${s.sql} ORDER BY g.date DESC LIMIT 500`,...s.args),
    rows(db,'SELECT id,amount,label,date FROM transactions WHERE user_id=? ORDER BY date DESC LIMIT 100',actor.id),
    rows(db,'SELECT quiz_id AS quizId,score,correct,total,date FROM attempts WHERE user_id=? ORDER BY date DESC',actor.id),
    rows(db,`SELECT a.id,a.student_id AS studentId,a.title,a.subject,a.level,a.result,a.date,a.status FROM achievements a JOIN users u ON u.id=a.student_id WHERE ${s.sql} ORDER BY a.date DESC LIMIT 200`,...s.args),
    allMaterials(db,actor),
    rows(db,`SELECT l.id,l.subject,l.title,l.time,l.end_time AS endTime,l.day,l.room,l.teacher,l.class_id AS classId FROM lessons l WHERE ${scheduleScope.sql} ORDER BY l.day,l.time`,...scheduleScope.args),
    rows(db,`SELECT u.id,u.name,u.role,u.class_id,u.school_id,u.coins,u.streak,u.stars FROM users u WHERE u.role='student' AND ${rankingScope.sql} ORDER BY u.stars DESC,u.coins DESC LIMIT 100`,...rankingScope.args),
    rows(db,'SELECT key,value FROM settings'),
  ]);
  return {demo:false,user:{...camelUser(actor),streak:actor.last_activity&&actor.last_activity>=day(-1)?actor.streak:0},grades,transactions,attempts,achievements,materials:mats,lessons:[...baseLessons,...customLessons],students:students.map(publicUser),roles,courses,settings:Object.fromEntries(settingRows.map(s=>[s.key,s.value])),admin:staff(actor),aiEnabled:!!env.OPENAI_API_KEY,quizzes:quizzes.map(({questions,...q})=>({...q,questionCount:questions.length}))};
}
async function targetStudent(db,actor,id){
  const target=await one(db,'SELECT * FROM users WHERE id=?',id);
  if(!target)fail('Ученик не найден.',404);
  if(target.role!=='student')fail('Выберите ученика.');
  if(!scope(actor,target))fail('Этот ученик не относится к вашему классу или школе.',403);
  return target;
}
function checkQuiz(q,answers){
  if(!Array.isArray(answers)||answers.length!==q.questions.length||answers.some((a,i)=>!Number.isInteger(a)||a<0||a>=q.questions[i].options.length))fail('Ответьте на все вопросы.');
  const correct=q.questions.filter((q,i)=>q.correct===answers[i]).length;
  return {score:Math.round(correct/q.questions.length*100),correct,total:q.questions.length,review:q.questions.map((q,i)=>({...q,selected:answers[i]})),explanations:q.questions.map((q,i)=>({prompt:q.prompt,answer:q.correct,selected:answers[i],explanation:q.explanation}))};
}
export function localTutor(message){
  const m=message.toLowerCase();
  if(/range|python|цикл|питон|for|while/.test(m))return 'Давай разберём циклы. for подходит, когда мы перебираем последовательность: for i in range(3) напечатает значения 0, 1 и 2. Правая граница range не включается. while повторяет действия, пока условие истинно. Попробуй сам: какие числа даст range(2, 8, 2)? Подсказка: начинаем с 2 и прибавляем по 2, не доходя до 8.';
  if(/квадрат|дискрим|уравнен|алгебр|x²|x\^2/.test(m))return 'Разберём пример x² − 5x + 6 = 0. Здесь a = 1, b = −5, c = 6. Дискриминант D = b² − 4ac = 25 − 24 = 1. Тогда x = (5 ± 1) / 2: получаем 2 и 3. Проверь один корень подстановкой. Если пришлёшь своё уравнение, подключённый ИИ сможет разобрать именно его; сейчас я показываю подготовленные учебные объяснения.';
  if(/english|англий|conditional|would|if /.test(m))return 'Second conditional описывает воображаемую ситуацию: If + Past Simple, would + глагол. Пример: If I had more time, I would read more books. После would не нужен to, а после if не ставим would. Попробуй закончить: If I could travel anywhere, I would…';
  if(/физик|скорост|расстоян|движен/.test(m))return 'Для равномерного движения используй s = v × t. При скорости 6 м/с и времени 8 с путь равен 48 м. Чтобы найти скорость: v = s / t; время: t = s / v. Следи, чтобы единицы измерения совпадали. Попробуй: поезд прошёл 180 км за 3 часа. Какова его скорость?';
  if(/coin|монет|наград|сери|балл/.test(m))return 'BEcoins начисляются за подтверждённые оценки: +30 за пятёрку, +15 за четвёрку; +20 за успешный квиз и +5 за изученный материал. Учебная серия растёт за занятия в разные дни. За 10 дней — +50, за 50 — +250, за 100 — +500, за 200 — +1000. Повторное обновление страницы не даёт новую награду.';
  if(/план|учить|начать|привет|помо/.test(m))return 'Привет! Предлагаю небольшой план: выбери одну тему, прочитай материал за 5–8 минут, затем проверь себя в квизе. Если ошибёшься — посмотри объяснение и вернись к теме. Я могу объяснить циклы Python, квадратные уравнения, Second conditional и формулу пути. С чего начнём?';
  return 'Я Beka, учебный помощник. Сейчас работает режим подготовленных объяснений: Python, квадратные уравнения, английский и физика. Напиши, например, «Объясни циклы Python». Для свободного диалога разработчик может подключить ИИ в настройках сервера.';
}

export async function handleApi(request,env={}){
  try{
    const url=new URL(request.url),path=url.pathname.replace(/\/$/,'');
    const quizMatch=path.match(/^\/api\/quiz\/([^/]+)$/);
    if(quizMatch&&request.method==='GET'){
      const q=quizzes.find(q=>q.id===quizMatch[1]);if(!q)fail('Квиз не найден.',404);
      return json({...q,questions:q.questions.map(({correct,explanation,...q})=>q)});
    }
    const demoQuiz=path.match(/^\/api\/demo\/quiz\/([^/]+)$/);
    if(demoQuiz&&request.method==='POST'){
      const q=quizzes.find(q=>q.id===demoQuiz[1]);if(!q)fail('Квиз не найден.',404);
      const b=await readBody(request),result=checkQuiz(q,b.answers);
      return json({ok:true,...result,awarded:result.score>=60?20:0,demo:true});
    }
    if(path==='/api/demo/games/math'&&request.method==='POST'){
      const b=await readBody(request),expected=[12,42,9,48,15,36,8,25,14,81];
      if(!Array.isArray(b.answers)||b.answers.length!==expected.length||b.answers.some(a=>!Number.isFinite(Number(a))))fail('Завершите математический спринт.');
      const correct=b.answers.filter((a,i)=>Number(a)===expected[i]).length;
      return json({ok:true,correct,total:expected.length,awarded:correct>=6?10:0,demo:true});
    }
    const actor=await actorFor(request,env);
    if(path==='/api/state'&&request.method==='GET')return json(actor?await getState(env.DB,actor,env):demoState());
    if(path==='/api/chat'&&request.method==='POST'){
      const body=await readBody(request);
      const messages=(Array.isArray(body.messages)?body.messages:[]).slice(-10).map(m=>({role:m.role==='assistant'?'assistant':'user',content:text(m.content,2000)})).filter(m=>m.content);
      const last=messages.filter(m=>m.role==='user').at(-1)?.content||text(body.message,2000);
      if(!last)fail('Напишите вопрос.');
      if(!messages.length)messages.push({role:'user',content:last});
      if(!env.OPENAI_API_KEY||!actor)return json({reply:localTutor(last),mode:'local'});
      const usage=await run(env.DB,'INSERT INTO chat_usage(user_id,day,count) VALUES(?,?,1) ON CONFLICT(user_id,day) DO UPDATE SET count=count+1 WHERE count<50',actor.id,day());
      if(!(usage.meta?.changes>0))fail('На сегодня достигнут лимит из 50 вопросов. Попробуйте завтра.',429);
      const response=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{authorization:`Bearer ${env.OPENAI_API_KEY}`,'content-type':'application/json'},body:JSON.stringify({model:env.OPENAI_MODEL||'gpt-4.1-mini',max_completion_tokens:800,messages:[{role:'system',content:'Ты Beka, доброжелательный учебный помощник школьников Better Education. Отвечай по-русски, понятно и кратко. Объясняй ход решения, давай подсказки и проверочные вопросы. Не утверждай, что изменил оценки или баланс: таких инструментов у тебя нет. Не выдумывай данные ученика.'},...messages]})});
      if(!response.ok)return json({reply:'Сейчас ИИ недоступен. '+localTutor(last),mode:'local'});
      const completion=await response.json();return json({reply:completion.choices?.[0]?.message?.content||'Попробуй сформулировать вопрос ещё раз.',mode:'ai'});
    }
    if(!actor)fail('Войдите в аккаунт для сохранения результатов.',401);
    const db=env.DB;
    if(quizMatch&&request.method==='POST'){
      const q=quizzes.find(q=>q.id===quizMatch[1]);if(!q)fail('Квиз не найден.',404);
      const body=await readBody(request);
      const checked=checkQuiz(q,body.answers),{correct,score}=checked;
      const result=await run(db,'INSERT OR IGNORE INTO attempts(id,user_id,quiz_id,score,correct,total,answers) VALUES(?,?,?,?,?,?,?)',uid(),actor.id,q.id,score,correct,q.questions.length,JSON.stringify(body.answers));
      const fresh=(result.meta?.changes??0)>0;
      if(!fresh)await run(db,'UPDATE attempts SET score=?,correct=?,total=?,answers=?,date=CURRENT_TIMESTAMP WHERE user_id=? AND quiz_id=? AND score<?',score,correct,q.questions.length,JSON.stringify(body.answers),actor.id,q.id,score);
      let awarded=0;
      if(score>=60&&await award(db,actor.id,`quiz:${actor.id}:${q.id}`,20,`Квиз: ${q.title}`)){awarded=20;await run(db,'UPDATE users SET stars=stars+1 WHERE id=?',actor.id);}
      await activity(db,actor.id);
      return json({ok:true,...checked,awarded,alreadyCompleted:!fresh,user:camelUser(await one(db,'SELECT * FROM users WHERE id=?',actor.id))});
    }
    if(path==='/api/games/math'&&request.method==='POST'){
      const b=await readBody(request),expected=[12,42,9,48,15,36,8,25,14,81];
      if(!Array.isArray(b.answers)||b.answers.length!==expected.length||b.answers.some(a=>!Number.isFinite(Number(a))))fail('Завершите математический спринт.');
      const correct=b.answers.filter((a,i)=>Number(a)===expected[i]).length;
      const awarded=correct>=6&&await award(db,actor.id,`game:${actor.id}:${day()}`,10,'Математический спринт');
      await activity(db,actor.id);return json({ok:true,correct,total:expected.length,awarded:awarded?10:0});
    }
    if(path==='/api/admin'&&request.method==='GET'){
      requireStaff(actor);const s=whereScope(actor);
      const students=await rows(db,`SELECT u.* FROM users u WHERE ${s.sql} ORDER BY role,name`,...s.args);
      const grades=await rows(db,`SELECT g.id,g.student_id AS studentId,g.subject,g.score,g.date FROM grades g JOIN users u ON u.id=g.student_id WHERE ${s.sql} ORDER BY date DESC LIMIT 500`,...s.args);
      const auditLog=actor.role==='developer'?await rows(db,'SELECT id,actor_id AS actorId,action,target_id AS targetId,detail,date FROM audit_log ORDER BY date DESC LIMIT 50'):[];
      return json({students:students.map(camelUser),grades,roles,auditLog,scope:actor.role==='teacher'?`Класс ${actor.class_id||'не назначен'}`:actor.role==='developer'?'Вся платформа':'Ваша школа'});
    }
    if(path==='/api/grades'&&request.method==='POST'){
      requireStaff(actor);const b=await readBody(request),studentId=text(b.studentId),subject=text(b.subject,100),eventId=text(b.eventId,100);
      if(!studentId||!subject||!eventId||!Number.isInteger(b.score)||b.score<1||b.score>5)fail('Укажите ученика, предмет, оценку от 1 до 5 и eventId.');
      await targetStudent(db,actor,studentId);
      const id=`grade:${eventId}`;
      const existing=await one(db,'SELECT * FROM grades WHERE id=?',id);
      if(existing&&(existing.student_id!==studentId||existing.subject!==subject||existing.score!==b.score))fail('Этот идентификатор уже используется для другой оценки.',409);
      await run(db,'INSERT OR IGNORE INTO grades(id,student_id,subject,score,teacher_id) VALUES(?,?,?,?,?)',id,studentId,subject,b.score,actor.id);
      const amount=b.score===5?30:b.score===4?15:0;
      if(amount)await award(db,studentId,id,amount,`${subject}: оценка ${b.score}`);
      if(!existing)await audit(db,actor,'grade.create',studentId,{subject,score:b.score});
      return json({ok:true,awarded:existing?0:amount});
    }
    if(path==='/api/achievements'&&request.method==='POST'){
      const b=await readBody(request),studentId=staff(actor)?text(b.studentId)||actor.id:actor.id;
      if(staff(actor))await targetStudent(db,actor,studentId);
      const record={title:text(b.title,200),subject:text(b.subject,100),level:text(b.level,100),result:text(b.result,200),date:text(b.date,10)};
      if(Object.values(record).some(v=>!v)||!/^\d{4}-\d{2}-\d{2}$/.test(record.date))fail('Заполните название, предмет, уровень, результат и дату.');
      const id=uid();await run(db,'INSERT INTO achievements(id,student_id,title,subject,level,result,date) VALUES(?,?,?,?,?,?,?)',id,studentId,record.title,record.subject,record.level,record.result,record.date);
      return json({ok:true,id,status:'pending'});
    }
    const achievementMatch=path.match(/^\/api\/achievements\/([^/]+)$/);
    if(achievementMatch&&request.method==='PATCH'){
      requireStaff(actor);const b=await readBody(request);if(!['verified','rejected'].includes(b.status))fail('Неверный статус.');
      const achievement=await one(db,'SELECT * FROM achievements WHERE id=?',achievementMatch[1]);if(!achievement)fail('Достижение не найдено.',404);
      await targetStudent(db,actor,achievement.student_id);
      await run(db,'UPDATE achievements SET status=?,verified_by=? WHERE id=?',b.status,actor.id,achievement.id);
      await audit(db,actor,'achievement.review',achievement.id,{status:b.status});return json({ok:true});
    }
    if(path==='/api/materials'&&request.method==='POST'){
      requireStaff(actor);const b=await readBody(request),title=text(b.title),subject=text(b.subject,100),body=text(b.body,12000),classId=actor.role==='teacher'?actor.class_id:text(b.classId)||actor.class_id;
      if(!title||!subject||!body||!classId)fail('Укажите название, предмет, текст и класс.');
      const id=uid();await run(db,'INSERT INTO materials(id,title,subject,body,minutes,class_id,school_id,created_by) VALUES(?,?,?,?,?,?,?,?)',id,title,subject,body,Math.max(1,Math.min(120,Number(b.minutes)||5)),classId,actor.school_id,actor.id);
      await audit(db,actor,'material.create',id,{title,classId});return json({ok:true,id});
    }
    const materialMatch=path.match(/^\/api\/materials\/([^/]+)\/complete$/);
    if(materialMatch&&request.method==='POST'){
      const material=(await allMaterials(db,actor)).find(m=>m.id===materialMatch[1]);if(!material)fail('Материал не найден.',404);
      await run(db,'INSERT OR IGNORE INTO completions(id,user_id,material_id) VALUES(?,?,?)',uid(),actor.id,material.id);
      const awarded=await award(db,actor.id,`material:${actor.id}:${material.id}`,5,`Материал: ${material.title}`);
      await activity(db,actor.id);return json({ok:true,awarded:awarded?5:0});
    }
    if(path==='/api/schedule'&&request.method==='POST'){
      requireStaff(actor);const b=await readBody(request),classId=actor.role==='teacher'?actor.class_id:text(b.classId)||actor.class_id;
      const subject=text(b.subject,100),title=text(b.title),time=text(b.time,5),endTime=text(b.endTime,5),room=text(b.room,100),teacher=text(b.teacher,100)||actor.name;
      if(!subject||!title||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)||time>=endTime||!Number.isInteger(b.day)||b.day<1||b.day>7||!classId)fail('Проверьте предмет, время начала и окончания, день недели и класс.');
      const id=uid();await run(db,'INSERT INTO lessons(id,subject,title,time,end_time,day,room,teacher,class_id,school_id,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)',id,subject,title,time,endTime,b.day,room,teacher,classId,actor.school_id,actor.id);
      await audit(db,actor,'schedule.create',id,{title,classId});return json({ok:true,id});
    }
    if(path==='/api/purchase'&&request.method==='POST'){
      const b=await readBody(request),course=courses.find(c=>c.id===b.courseId);if(!course)fail('Курс не найден.',404);
      if(!course.live)fail('Этот курс готовится. BEcoins останутся на вашем счёте.',409);
      fail('Покупки будут доступны после открытия курсов.',409);
    }
    const userMatch=path.match(/^\/api\/users\/([^/]+)$/);
    if(userMatch&&request.method==='PATCH'){
      if(!['director','developer'].includes(actor.role))fail('Управление доступом разрешено директору и разработчику.',403);
      const target=await one(db,'SELECT * FROM users WHERE id=?',userMatch[1]);if(!target)fail('Пользователь не найден.',404);
      if(!scope(actor,target))fail('Нет доступа к пользователю другой школы.',403);
      const b=await readBody(request),role=b.role||target.role,classId=b.classId===undefined?target.class_id:text(b.classId,50);
      if(!roles.some(r=>r.id===role))fail('Неизвестная роль.');
      if(actor.role==='director'&&(['developer','director'].includes(role)||['developer','director'].includes(target.role)))fail('Эту роль может назначить только разработчик.',403);
      if(target.id===actor.id&&role!==actor.role)fail('Нельзя изменить свою роль.');
      await run(db,'UPDATE users SET role=?,class_id=? WHERE id=?',role,classId,target.id);
      await audit(db,actor,'user.update',target.id,{role,classId});return json({ok:true});
    }
    if(path==='/api/settings'&&request.method==='PATCH'){
      if(actor.role!=='developer')fail('Настройки платформы доступны разработчику.',403);
      const b=await readBody(request),mascotUrl=text(b.mascotUrl,2000);
      if(mascotUrl&&!/^https:\/\//.test(mascotUrl))fail('Укажите безопасный адрес HTTPS.');
      await run(db,"INSERT INTO settings(key,value) VALUES('mascotUrl',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",mascotUrl);
      await audit(db,actor,'settings.update','mascotUrl',{});return json({ok:true});
    }
    return json({error:'Такой маршрут не найден.'},404);
  }catch(e){console.error('API error',e.status||500,e.message);return json({error:e.status?e.message:'Не удалось выполнить действие. Попробуйте ещё раз.'},e.status||500);}
}
