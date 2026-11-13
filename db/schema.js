import {sqliteTable,text,integer,index,unique,check,primaryKey} from 'drizzle-orm/sqlite-core';
import {sql} from 'drizzle-orm';
export const users=sqliteTable('users',{
  id:text('id').primaryKey(),name:text('name').notNull(),email:text('email').notNull(),
  role:text('role').notNull().default('student'),classId:text('class_id').notNull().default(''),schoolId:text('school_id').notNull().default('better-education'),
  coins:integer('coins').notNull().default(0),streak:integer('streak').notNull().default(0),stars:integer('stars').notNull().default(0),lastActivity:text('last_activity'),createdAt:text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
},t=>[check('users_role_check',sql`${t.role} IN ('student','teacher','deputy','director','developer')`),check('users_coins_check',sql`${t.coins} >= 0`)]);
export const transactions=sqliteTable('transactions',{
  id:text('id').primaryKey(),userId:text('user_id').notNull().references(()=>users.id),amount:integer('amount').notNull(),label:text('label').notNull(),date:text('date').notNull().default(sql`CURRENT_TIMESTAMP`),
},t=>[index('transactions_user').on(t.userId,t.date)]);
export const attempts=sqliteTable('attempts',{
  id:text('id').primaryKey(),userId:text('user_id').notNull().references(()=>users.id),quizId:text('quiz_id').notNull(),score:integer('score').notNull(),correct:integer('correct').notNull(),total:integer('total').notNull(),answers:text('answers').notNull(),date:text('date').notNull().default(sql`CURRENT_TIMESTAMP`),
},t=>[unique('attempts_user_quiz_unique').on(t.userId,t.quizId)]);
export const grades=sqliteTable('grades',{
  id:text('id').primaryKey(),studentId:text('student_id').notNull().references(()=>users.id),subject:text('subject').notNull(),score:integer('score').notNull(),teacherId:text('teacher_id').notNull().references(()=>users.id),date:text('date').notNull().default(sql`CURRENT_TIMESTAMP`),
},t=>[check('grades_score_check',sql`${t.score} BETWEEN 1 AND 5`)]);
export const achievements=sqliteTable('achievements',{
  id:text('id').primaryKey(),studentId:text('student_id').notNull().references(()=>users.id),title:text('title').notNull(),subject:text('subject').notNull(),level:text('level').notNull(),result:text('result').notNull(),date:text('date').notNull(),status:text('status').notNull().default('pending'),verifiedBy:text('verified_by').references(()=>users.id),
},t=>[check('achievements_status_check',sql`${t.status} IN ('pending','verified','rejected')`)]);
export const materials=sqliteTable('materials',{
  id:text('id').primaryKey(),title:text('title').notNull(),subject:text('subject').notNull(),body:text('body').notNull(),minutes:integer('minutes').notNull().default(5),classId:text('class_id').notNull(),schoolId:text('school_id').notNull(),createdBy:text('created_by').notNull().references(()=>users.id),
});
export const completions=sqliteTable('completions',{
  id:text('id').primaryKey(),userId:text('user_id').notNull().references(()=>users.id),materialId:text('material_id').notNull(),date:text('date').notNull().default(sql`CURRENT_TIMESTAMP`),
},t=>[unique('completions_user_material_unique').on(t.userId,t.materialId)]);
export const lessons=sqliteTable('lessons',{
  id:text('id').primaryKey(),subject:text('subject').notNull(),title:text('title').notNull(),time:text('time').notNull(),endTime:text('end_time').notNull(),day:integer('day').notNull(),room:text('room').notNull(),teacher:text('teacher').notNull(),classId:text('class_id').notNull(),schoolId:text('school_id').notNull(),createdBy:text('created_by').notNull().references(()=>users.id),
},t=>[check('lessons_day_check',sql`${t.day} BETWEEN 1 AND 7`)]);
export const settings=sqliteTable('settings',{key:text('key').primaryKey(),value:text('value').notNull()});
export const auditLog=sqliteTable('audit_log',{id:text('id').primaryKey(),actorId:text('actor_id').notNull(),action:text('action').notNull(),targetId:text('target_id').notNull(),detail:text('detail').notNull(),date:text('date').notNull().default(sql`CURRENT_TIMESTAMP`)});
export const chatUsage=sqliteTable('chat_usage',{userId:text('user_id').notNull(),day:text('day').notNull(),count:integer('count').notNull().default(0)},t=>[primaryKey({columns:[t.userId,t.day]})]);
