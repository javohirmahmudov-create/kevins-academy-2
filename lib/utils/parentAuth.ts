const PARENT_META_PREFIX = '__KA_PARENT__:';

export type ParentAuthMetadata = {
  username?: string;
  password?: string;
  studentId?: string | number;
  studentIds?: Array<string | number>;
  phone?: string;
  telegramChatId?: string;
  botStatus?: string;
  botDisconnectedAt?: string;
  botLastCheckedAt?: string;
  botLastError?: string;
};

function normalizeStudentIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const unique = new Set<string>();

  for (const item of value) {
    const normalized = String(item ?? '').trim();
    if (!normalized) continue;
    unique.add(normalized);
  }

  return Array.from(unique);
}

function mergeStudentIds(primary?: string | number, list?: Array<string | number>) {
  const unique = new Set<string>();
  const normalizedPrimary = String(primary ?? '').trim();
  if (normalizedPrimary) unique.add(normalizedPrimary);

  for (const item of normalizeStudentIds(list)) {
    unique.add(item);
  }

  return Array.from(unique);
}

export function isParentTelegramConnected(storedPhone?: string | null) {
  const metadata = decodeParentMetadata(storedPhone);
  return Boolean(metadata?.telegramChatId);
}

function toBase64(value: string) {
  return Buffer.from(value, 'utf8').toString('base64');
}

function fromBase64(value: string) {
  return Buffer.from(value, 'base64').toString('utf8');
}

export function decodeParentMetadata(storedPhone?: string | null): ParentAuthMetadata | null {
  if (!storedPhone || !storedPhone.startsWith(PARENT_META_PREFIX)) {
    return null;
  }

  try {
    const payload = storedPhone.slice(PARENT_META_PREFIX.length);
    const parsed = JSON.parse(fromBase64(payload));
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    const parsedStudentIds = normalizeStudentIds((parsed as any).studentIds);
    const singleStudentId =
      typeof parsed.studentId === 'string'
        ? parsed.studentId
        : (typeof parsed.studentId === 'number' && Number.isFinite(parsed.studentId)
            ? String(parsed.studentId)
            : undefined);
    const studentIds = mergeStudentIds(singleStudentId, parsedStudentIds);

    return {
      username: typeof parsed.username === 'string' ? parsed.username : undefined,
      password: typeof parsed.password === 'string' ? parsed.password : undefined,
      studentId: studentIds[0],
      studentIds,
      phone: typeof parsed.phone === 'string' ? parsed.phone : undefined,
      telegramChatId: typeof parsed.telegramChatId === 'string' ? parsed.telegramChatId : undefined,
      botStatus: typeof parsed.botStatus === 'string' ? parsed.botStatus : undefined,
      botDisconnectedAt: typeof parsed.botDisconnectedAt === 'string' ? parsed.botDisconnectedAt : undefined,
      botLastCheckedAt: typeof parsed.botLastCheckedAt === 'string' ? parsed.botLastCheckedAt : undefined,
      botLastError: typeof parsed.botLastError === 'string' ? parsed.botLastError : undefined,
    };
  } catch {
    return null;
  }
}

export function encodeParentMetadata(metadata: ParentAuthMetadata): string {
  const studentIds = mergeStudentIds(metadata.studentId, metadata.studentIds);
  const compact = {
    ...(metadata.username ? { username: metadata.username } : {}),
    ...(metadata.password ? { password: metadata.password } : {}),
    ...(studentIds.length > 0
      ? { studentId: studentIds[0] }
      : {}),
    ...(studentIds.length > 0
      ? { studentIds }
      : {}),
    ...(metadata.phone ? { phone: metadata.phone } : {}),
    ...(metadata.telegramChatId ? { telegramChatId: metadata.telegramChatId } : {}),
    ...(metadata.botStatus ? { botStatus: metadata.botStatus } : {}),
    ...(metadata.botDisconnectedAt ? { botDisconnectedAt: metadata.botDisconnectedAt } : {}),
    ...(metadata.botLastCheckedAt ? { botLastCheckedAt: metadata.botLastCheckedAt } : {}),
    ...(metadata.botLastError ? { botLastError: metadata.botLastError } : {}),
  };
  return `${PARENT_META_PREFIX}${toBase64(JSON.stringify(compact))}`;
}

export function unpackParent(parent: any) {
  const metadata = decodeParentMetadata(parent?.phone);
  const hasMetadataPayload = Boolean(metadata);
  const studentIds = mergeStudentIds(metadata?.studentId, metadata?.studentIds);
  return {
    ...parent,
    username: metadata?.username,
    password: metadata?.password,
    studentId: studentIds[0],
    studentIds,
    phone: hasMetadataPayload ? (metadata?.phone ?? null) : (parent?.phone ?? null),
    telegramChatId: metadata?.telegramChatId,
    botStatus: metadata?.botStatus ?? parent?.botStatus,
    botDisconnectedAt: metadata?.botDisconnectedAt ?? parent?.botDisconnectedAt,
    botLastCheckedAt: metadata?.botLastCheckedAt ?? parent?.botLastCheckedAt,
    botLastError: metadata?.botLastError ?? parent?.botLastError,
  };
}
