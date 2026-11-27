// prisma/seed-large.ts  —  npm run seed:large
// Run AFTER `npm run seed`. Adds one extra project "BIG" (workspace "acme") with 5,000 tasks,
// so the base seed counts stay untouched. Safe to re-run: it recreates BIG each time.

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, ProjectRole, TaskPriority } from '../generated/prisma/client';
import type { Column } from '../generated/prisma/client';
import { generateNKeysBetween } from 'fractional-indexing';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const DAY = 86_400_000;

// Safe array read: works even when tsconfig has "noUncheckedIndexedAccess": true
function at<T>(arr: readonly T[], i: number): T {
  const v = arr[i];
  if (v === undefined) throw new Error(`Index ${i} is out of range`);
  return v;
}
const TOTAL = 5000;
const CHUNK = 1000;

const COLUMNS = [
  { name: 'To Do', isDone: false },
  { name: 'In Progress', isDone: false },
  { name: 'In Review', isDone: false },
  { name: 'Done', isDone: true },
];

async function main() {
  const workspace = await prisma.workspace.findUnique({ where: { slug: 'acme' } });
  const alice = await prisma.user.findUnique({ where: { email: 'alice@example.com' } });
  const bob = await prisma.user.findUnique({ where: { email: 'bob@example.com' } });
  if (!workspace || !alice || !bob) throw new Error('Run `npm run seed` first.');

  await prisma.project.deleteMany({ where: { workspaceId: workspace.id, key: 'BIG' } });

  const project = await prisma.project.create({
    data: {
      workspaceId: workspace.id,
      key: 'BIG',
      name: 'Load test',
      createdById: alice.id,
      members: {
        create: [
          { userId: alice.id, role: ProjectRole.ADMIN },
          { userId: bob.id, role: ProjectRole.MEMBER },
        ],
      },
    },
  });

  const colKeys = generateNKeysBetween(null, null, COLUMNS.length);
  const columns: Column[] = [];
  for (const [i, c] of COLUMNS.entries()) {
    columns.push(
      await prisma.column.create({
        data: { projectId: project.id, name: c.name, isDone: c.isDone, position: at(colKeys, i) },
      }),
    );
  }

  // Position keys per column (tasks are dealt round-robin, so column c holds i % 4 === c).
  const perColumn = Math.ceil(TOTAL / columns.length);
  const keys = columns.map(() => generateNKeysBetween(null, null, perColumn));
  const priorities = Object.values(TaskPriority);
  const people = [alice, bob];

  for (let start = 0; start < TOTAL; start += CHUNK) {
    const data = [];
    for (let i = start; i < Math.min(start + CHUNK, TOTAL); i++) {
      const c = i % columns.length;
      const column = at(columns, c);
      const assignee = at(people, i % people.length);
      data.push({
        projectId: project.id,
        columnId: column.id,
        number: i + 1,
        title: `Load test task ${i + 1}`,
        priority: at(priorities, i % priorities.length),
        position: at(at(keys, c), Math.floor(i / columns.length)),
        dueDate: i % 3 === 0 ? null : new Date(Date.now() + ((i % 60) - 20) * DAY),
        creatorId: alice.id,
        completedAt: column.isDone ? new Date(Date.now() - (i % 30) * DAY) : null,
        completedById: column.isDone ? assignee.id : null,
      });
    }
    await prisma.task.createMany({ data });
  }

  await prisma.project.update({ where: { id: project.id }, data: { nextTaskNumber: TOTAL + 1 } });

  // Give every task an assignee (createMany needs the generated task ids).
  const rows = await prisma.task.findMany({
    where: { projectId: project.id },
    select: { id: true, number: true },
  });
  await prisma.taskAssignee.createMany({
    data: rows.map((t) => ({ taskId: t.id, userId: at(people, (t.number - 1) % people.length).id })),
  });

  // Quick timing of the query the board view runs: first 50 tasks of a column, in order.
  const t0 = performance.now();
  const page = await prisma.task.findMany({
    where: { columnId: at(columns, 0).id },
    orderBy: { position: 'asc' },
    take: 50,
    include: { assignees: true, labels: true },
  });
  const ms = (performance.now() - t0).toFixed(1);

  console.log(`Added ${TOTAL} tasks to BIG (total tasks: ${await prisma.task.count()}).`);
  console.log(`Board query (50 tasks of one column, ordered by position): ${ms} ms, ${page.length} rows.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
