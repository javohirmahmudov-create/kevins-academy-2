const PARENT_META_PREFIX = '__KA_PARENT__:';

export type ParentAuthMetadata = {
  username?: string;
  password?: string;
  studentId?: string;
  phone?: string;
  telegramChatId?: string;
};

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
    return {
      username: typeof parsed.username === 'string' ? parsed.username : undefined,
      password: typeof parsed.password === 'string' ? parsed.password : undefined,
      studentId: typeof parsed.studentId === 'string' ? parsed.studentId : undefined,
      phone: typeof parsed.phone === 'string' ? parsed.phone : undefined,
      telegramChatId: typeof parsed.telegramChatId === 'string' ? parsed.telegramChatId : undefined,
    };
  } catch {
    return null;
  }
}

export function encodeParentMetadata(metadata: ParentAuthMetadata): string {
  const compact = {
    ...(metadata.username ? { username: metadata.username } : {}),
    ...(metadata.password ? { password: metadata.password } : {}),
    ...(metadata.studentId ? { studentId: metadata.studentId } : {}),
    ...(metadata.phone ? { phone: metadata.phone } : {}),
    ...(metadata.telegramChatId ? { telegramChatId: metadata.telegramChatId } : {}),
  };
  return `${PARENT_META_PREFIX}${toBase64(JSON.stringify(compact))}`;
}

export function unpackParent(parent: any) {
  const metadata = decodeParentMetadata(parent?.phone);
  return {
    ...parent,
    username: metadata?.username,
    password: metadata?.password,
    studentId: metadata?.studentId,
    phone: metadata?.phone ?? parent?.phone ?? null,
    telegramChatId: metadata?.telegramChatId,
  };
}
