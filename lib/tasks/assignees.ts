import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { memberships, users, workspacePeople } from "@/lib/db/schema";

export interface AssignablePersonOption {
  value: string;
  label: string;
  email: string | null;
  isUser: boolean;
}

export interface TaskAssigneeInput {
  assigneeRef?: string | null;
  assigneeName?: string | null;
  assigneeId?: string | null;
  assigneePersonId?: string | null;
}

export interface ResolvedTaskAssignee {
  assigneeId: string | null;
  assigneePersonId: string | null;
  assigneeDisplayName: string | null;
  assigneeEmail: string | null;
  assigneeUserId: string | null;
}

interface PersonRow {
  id: string;
  userId: string | null;
  displayName: string;
  email: string | null;
}

function memberLabel(member: { id: string; firstName: string | null; lastName: string | null; email: string | null }): string {
  return [member.firstName, member.lastName].filter(Boolean).join(" ") || member.email || member.id;
}

function personResult(person: PersonRow): ResolvedTaskAssignee {
  return {
    assigneeId: person.userId,
    assigneePersonId: person.id,
    assigneeDisplayName: person.displayName,
    assigneeEmail: person.email,
    assigneeUserId: person.userId,
  };
}

function parseAssigneeText(value: string): { displayName: string; email: string | null } {
  const trimmed = value.trim();
  const bracketEmail = trimmed.match(/<([^>\s]+@[^>\s]+)>/);
  if (bracketEmail) {
    const email = bracketEmail[1].toLowerCase();
    const name = trimmed.replace(bracketEmail[0], "").trim();
    return { displayName: name || email, email };
  }

  const emailOnly = trimmed.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  return {
    displayName: trimmed,
    email: emailOnly ? trimmed.toLowerCase() : null,
  };
}

async function getPersonById(workspaceId: string, personId: string): Promise<PersonRow | null> {
  const [person] = await db
    .select({
      id: workspacePeople.id,
      userId: workspacePeople.userId,
      displayName: workspacePeople.displayName,
      email: workspacePeople.email,
    })
    .from(workspacePeople)
    .where(and(eq(workspacePeople.id, personId), eq(workspacePeople.workspaceId, workspaceId)))
    .limit(1);

  return person ?? null;
}

async function findPersonByEmail(workspaceId: string, email: string): Promise<PersonRow | null> {
  const [person] = await db
    .select({
      id: workspacePeople.id,
      userId: workspacePeople.userId,
      displayName: workspacePeople.displayName,
      email: workspacePeople.email,
    })
    .from(workspacePeople)
    .where(and(eq(workspacePeople.workspaceId, workspaceId), eq(workspacePeople.email, email)))
    .limit(1);

  return person ?? null;
}

async function findPersonForUser(workspaceId: string, userId: string): Promise<PersonRow | null> {
  const [person] = await db
    .select({
      id: workspacePeople.id,
      userId: workspacePeople.userId,
      displayName: workspacePeople.displayName,
      email: workspacePeople.email,
    })
    .from(workspacePeople)
    .where(and(eq(workspacePeople.workspaceId, workspaceId), eq(workspacePeople.userId, userId)))
    .limit(1);

  return person ?? null;
}

async function findWorkspaceMember(workspaceId: string, userId: string) {
  const [member] = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, userId)))
    .limit(1);

  return member ?? null;
}

async function findOrCreatePersonForUser(workspaceId: string, userId: string): Promise<ResolvedTaskAssignee | null> {
  const member = await findWorkspaceMember(workspaceId, userId);
  if (!member) return null;

  const existingForUser = await findPersonForUser(workspaceId, userId);
  if (existingForUser) return personResult(existingForUser);

  const label = memberLabel(member);
  if (member.email) {
    const existingForEmail = await findPersonByEmail(workspaceId, member.email);
    if (existingForEmail) {
      const [updated] = await db
        .update(workspacePeople)
        .set({
          userId,
          displayName: existingForEmail.displayName || label,
          updatedAt: new Date(),
        })
        .where(eq(workspacePeople.id, existingForEmail.id))
        .returning({
          id: workspacePeople.id,
          userId: workspacePeople.userId,
          displayName: workspacePeople.displayName,
          email: workspacePeople.email,
        });

      return personResult(updated);
    }
  }

  const [created] = await db
    .insert(workspacePeople)
    .values({
      workspaceId,
      userId,
      displayName: label,
      email: member.email,
    })
    .returning({
      id: workspacePeople.id,
      userId: workspacePeople.userId,
      displayName: workspacePeople.displayName,
      email: workspacePeople.email,
    });

  return personResult(created);
}

async function findOrCreatePersonFromText(workspaceId: string, assigneeName: string): Promise<ResolvedTaskAssignee | null> {
  const parsed = parseAssigneeText(assigneeName);
  if (!parsed.displayName) return null;

  if (parsed.email) {
    const existing = await findPersonByEmail(workspaceId, parsed.email);
    if (existing) return personResult(existing);
  }

  const [created] = await db
    .insert(workspacePeople)
    .values({
      workspaceId,
      displayName: parsed.displayName,
      email: parsed.email,
    })
    .returning({
      id: workspacePeople.id,
      userId: workspacePeople.userId,
      displayName: workspacePeople.displayName,
      email: workspacePeople.email,
    });

  return personResult(created);
}

export async function listAssignablePeople(workspaceId: string): Promise<AssignablePersonOption[]> {
  const [members, placeholders] = await Promise.all([
    db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.workspaceId, workspaceId))
      .orderBy(asc(users.firstName), asc(users.email)),
    db
      .select({
        id: workspacePeople.id,
        displayName: workspacePeople.displayName,
        email: workspacePeople.email,
      })
      .from(workspacePeople)
      .where(and(eq(workspacePeople.workspaceId, workspaceId), isNull(workspacePeople.userId)))
      .orderBy(asc(workspacePeople.displayName)),
  ]);

  return [
    ...members.map((member) => ({
      value: `user:${member.id}`,
      label: memberLabel(member),
      email: member.email,
      isUser: true,
    })),
    ...placeholders.map((person) => ({
      value: `person:${person.id}`,
      label: person.displayName,
      email: person.email,
      isUser: false,
    })),
  ];
}

export async function resolveTaskAssignee(
  workspaceId: string,
  input: TaskAssigneeInput
): Promise<ResolvedTaskAssignee> {
  const assigneeName = input.assigneeName?.trim();
  if (assigneeName) {
    return (await findOrCreatePersonFromText(workspaceId, assigneeName)) ?? {
      assigneeId: null,
      assigneePersonId: null,
      assigneeDisplayName: null,
      assigneeEmail: null,
      assigneeUserId: null,
    };
  }

  if (input.assigneeRef) {
    const [kind, id] = input.assigneeRef.split(":");
    if (kind === "user" && id) {
      return (await findOrCreatePersonForUser(workspaceId, id)) ?? {
        assigneeId: null,
        assigneePersonId: null,
        assigneeDisplayName: null,
        assigneeEmail: null,
        assigneeUserId: null,
      };
    }
    if (kind === "person" && id) {
      const person = await getPersonById(workspaceId, id);
      if (person) return personResult(person);
    }
  }

  if (input.assigneePersonId) {
    const person = await getPersonById(workspaceId, input.assigneePersonId);
    if (person) return personResult(person);
  }

  if (input.assigneeId) {
    return (await findOrCreatePersonForUser(workspaceId, input.assigneeId)) ?? {
      assigneeId: null,
      assigneePersonId: null,
      assigneeDisplayName: null,
      assigneeEmail: null,
      assigneeUserId: null,
    };
  }

  return {
    assigneeId: null,
    assigneePersonId: null,
    assigneeDisplayName: null,
    assigneeEmail: null,
    assigneeUserId: null,
  };
}
