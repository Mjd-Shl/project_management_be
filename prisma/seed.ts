// prisma/seed.ts  —  npm run seed
// DEV ONLY: wipes all workspaces and users, then recreates demo data.
//
// Result: 5 users, 2 workspaces, 3 projects, 40 tasks.
// Roles covered: WorkspaceRole OWNER / ADMIN / MEMBER, ProjectRole ADMIN / MEMBER / VIEWER.
// All users have the password "password123".

import 'dotenv/config';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  WorkspaceRole,
  ProjectRole,
  TaskPriority,
  ActivityAction,
  NotificationType,
} from '../generated/prisma/client';
import type { User, Project, Column, Label, Task } from '../generated/prisma/client';
import { generateNKeysBetween } from 'fractional-indexing';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DAY = 86_400_000;
const daysFromNow = (n: number) => new Date(Date.now() + n * DAY);

// Safe array read: works even when tsconfig has "noUncheckedIndexedAccess": true
function at<T>(arr: readonly T[], i: number): T {
  const v = arr[i];
  if (v === undefined) throw new Error(`Index ${i} is out of range`);
  return v;
}

const COLUMNS = [
  { name: 'To Do', isDone: false },
  { name: 'In Progress', isDone: false },
  { name: 'In Review', isDone: false },
  { name: 'Done', isDone: true },
];

const TITLES = [
  'Set up CI pipeline',
  'Design login screen',
  'Fix pagination bug',
  'Write API docs',
  'Add dark mode',
  'Optimise slow query',
  'Refactor auth middleware',
  'Add email templates',
  'Improve error messages',
  'Upgrade dependencies',
];

async function createProject(
  workspaceId: string,
  key: string,
  name: string,
  creator: User,
  members: [User, ProjectRole][],
) {
  const project = await prisma.project.create({
    data: {
      workspaceId,
      key,
      name,
      description: `${name} board`,
      createdById: creator.id,
      members: { create: members.map(([u, role]) => ({ userId: u.id, role })) },
    },
  });

  // Every new project gets the same columns; the Done column has isDone = true.
  const keys = generateNKeysBetween(null, null, COLUMNS.length);
  const columns: Column[] = [];
  for (const [i, c] of COLUMNS.entries()) {
    columns.push(
      await prisma.column.create({
        data: { projectId: project.id, name: c.name, isDone: c.isDone, position: at(keys, i) },
      }),
    );
  }
  return { project, columns };
}

async function seedTasks(
  project: Project,
  columns: Column[],
  count: number,
  creator: User,
  assignable: User[],
  labels: Label[],
): Promise<Task[]> {
  // Spread tasks round-robin over the columns, then give each column its own position keys.
  const colIdx = Array.from({ length: count }, (_, i) => i % columns.length);
  const perColumn = columns.map((_, c) => colIdx.filter((x) => x === c).length);
  const keys = perColumn.map((n) => generateNKeysBetween(null, null, n));
  const used = columns.map(() => 0);
  const priorities = Object.values(TaskPriority);
  const checklistKeys = generateNKeysBetween(null, null, 2);

  const created: Task[] = [];
  for (let i = 0; i < count; i++) {
    const c = at(colIdx, i);
    const column = at(columns, c);
    const number = i + 1;
    const assignee = at(assignable, i % assignable.length);
    const slot = at(used, c);
    used[c] = slot + 1;

    created.push(
      await prisma.task.create({
        data: {
          projectId: project.id,
          columnId: column.id,
          number,
          title: at(TITLES, i % TITLES.length),
          description: `Demo task ${project.key}-${number}`,
          priority: at(priorities, i % priorities.length),
          position: at(at(keys, c), slot),
          dueDate: i % 3 === 0 ? null : daysFromNow((i % 21) - 7), // stored as a plain date
          creatorId: creator.id,
          // What the move endpoint (TL-121) would set when a task enters a done column:
          completedAt: column.isDone ? daysFromNow(-(i % 7)) : null,
          completedById: column.isDone ? assignee.id : null,
          assignees: { create: [{ userId: assignee.id }] },
          ...(labels.length
            ? { labels: { create: [{ labelId: at(labels, i % labels.length).id }] } }
            : {}),
          ...(i % 4 === 0
            ? {
                checklistItems: {
                  create: [
                    { content: 'Write tests', position: at(checklistKeys, 0), isChecked: column.isDone },
                    { content: 'Update docs', position: at(checklistKeys, 1), isChecked: false },
                  ],
                },
              }
            : {}),
        },
      }),
    );
  }

  // Counter on the project row = number the next task will get.
  await prisma.project.update({ where: { id: project.id }, data: { nextTaskNumber: count + 1 } });

  await prisma.activity.createMany({
    data: created.map((t) => ({
      workspaceId: project.workspaceId,
      projectId: project.id,
      taskId: t.id,
      actorId: creator.id,
      action: ActivityAction.TASK_CREATED,
    })),
  });

  return created;
}

async function main() {
  // Clean slate (workspace delete cascades to projects, columns, tasks, ...).
  await prisma.workspace.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  // ── Users ─────────────────────────────────────────────
  const passwordHash = bcrypt.hashSync('password123', 10);
  const mk = (email: string, name: string) =>
    prisma.user.create({ data: { email, name, password: passwordHash } });
  const alice = await mk('alice@example.com', 'Alice Owner');
  const bob = await mk('bob@example.com', 'Bob Admin');
  const carol = await mk('carol@example.com', 'Carol Member');
  const dave = await mk('dave@example.com', 'Dave Viewer');
  const eve = await mk('eve@example.com', 'Eve Guest');

  // ── Workspaces & members ─────────────────────────────
  const acme = await prisma.workspace.create({
    data: {
      name: 'Acme Corp',
      slug: 'acme',
      ownerId: alice.id,
      members: {
        create: [
          { userId: alice.id, role: WorkspaceRole.OWNER },
          { userId: bob.id, role: WorkspaceRole.ADMIN },
          { userId: carol.id, role: WorkspaceRole.MEMBER },
          { userId: dave.id, role: WorkspaceRole.MEMBER },
        ],
      },
    },
  });
  const side = await prisma.workspace.create({
    data: {
      name: 'Side Hustle',
      slug: 'side-hustle',
      ownerId: carol.id,
      members: {
        create: [
          { userId: carol.id, role: WorkspaceRole.OWNER },
          { userId: eve.id, role: WorkspaceRole.ADMIN },
          { userId: dave.id, role: WorkspaceRole.MEMBER },
        ],
      },
    },
  });

  // ── Labels (per workspace) ───────────────────────────
  const acmeLabels = await Promise.all(
    ([
      ['Bug', '#DC2626'],
      ['Feature', '#2563EB'],
      ['Chore', '#6B7280'],
    ] as [string, string][]).map(([name, color]) => prisma.label.create({ data: { workspaceId: acme.id, name, color } })),
  );
  const sideLabels = await Promise.all(
    ([
      ['Bug', '#DC2626'],
      ['Idea', '#F59E0B'],
    ] as [string, string][]).map(([name, color]) => prisma.label.create({ data: { workspaceId: side.id, name, color } })),
  );

  
  await prisma.invitation.create({
    data: {
      workspaceId: acme.id,
      email: 'frank@example.com',
      role: WorkspaceRole.MEMBER,
      tokenHash: createHash('sha256').update(randomBytes(32)).digest('hex'),
      invitedById: alice.id,
      expiresAt: daysFromNow(7),
    },
  });

  // ── Projects (3) ─────────────────────────────────────
  const web = await createProject(acme.id, 'WEB', 'Website', alice, [
    [alice, ProjectRole.ADMIN],
    [bob, ProjectRole.MEMBER],
    [carol, ProjectRole.VIEWER],
    [dave, ProjectRole.MEMBER],
  ]);
  const api = await createProject(acme.id, 'API', 'Backend API', bob, [
    [bob, ProjectRole.ADMIN],
    [alice, ProjectRole.MEMBER],
  ]);
  const app = await createProject(side.id, 'APP', 'Mobile App', carol, [
    [carol, ProjectRole.ADMIN],
    [eve, ProjectRole.MEMBER],
    [dave, ProjectRole.VIEWER],
  ]);

  // ── Tasks: 16 + 12 + 12 = 40 ─────────────────────────
  const webTasks = await seedTasks(web.project, web.columns, 16, alice, [alice, bob, dave], acmeLabels);
  await seedTasks(api.project, api.columns, 12, bob, [bob, alice], acmeLabels);
  await seedTasks(app.project, app.columns, 12, carol, [carol, eve], sideLabels);

  // ── Comment + mention + notifications + attachment ───
  const t = at(webTasks, 1);
  const comment = await prisma.comment.create({
    data: {
      taskId: t.id,
      authorId: alice.id,
      body: '@Bob Admin can you review this one?',
      mentions: { create: [{ mentionedUserId: bob.id }] },
    },
  });
  await prisma.notification.createMany({
    data: [
      {
        recipientId: bob.id,
        actorId: alice.id,
        type: NotificationType.MENTIONED,
        projectId: web.project.id,
        taskId: t.id,
        commentId: comment.id,
      },
      {
        recipientId: bob.id,
        actorId: alice.id,
        type: NotificationType.TASK_ASSIGNED,
        projectId: web.project.id,
        taskId: t.id,
        readAt: new Date(),
      },
    ],
  });
  await prisma.attachment.create({
    data: {
      taskId: t.id,
      uploadedById: alice.id,
      fileName: 'mockup.png',
      mimeType: 'image/png',
      sizeBytes: 245_760,
      storageKey: 'seed/mockup.png',
    },
  });

  const [users, workspaces, projects, tasks] = await Promise.all([
    prisma.user.count(),
    prisma.workspace.count(),
    prisma.project.count(),
    prisma.task.count(),
  ]);
  console.log({ users, workspaces, projects, tasks });
  if (users !== 5 || workspaces !== 2 || projects !== 3 || tasks !== 40) {
    throw new Error('Seed counts do not match the acceptance criteria');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());