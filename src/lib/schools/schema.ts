/**
 * 学校の入力と、その検証。
 *
 * 画面（クライアント）とサーバの両方から使うため、DB アクセスを含めない。
 * 片方だけ緩い検証、という状態を作らないため入口はここ1つにする。
 */

/** 比較校の上限（handoff.md 3章） */
export const MAX_COMPETITORS = 5;

export interface SchoolInput {
  name: string;
  url: string;
  prefecture?: string | null;
  schoolType?: string | null;
  coedType?: string | null;
  hasJuniorAdmission?: boolean;
  hasSeniorAdmission?: boolean;
  hasAffiliatedUniversity?: boolean;
}

export class SchoolInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchoolInputError';
  }
}

/**
 * 突き合わせ用の正規化。
 * 「https://a.ed.jp」と「http://www.a.ed.jp/」を別の学校として登録させない。
 */
export function normalizeSchoolUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new SchoolInputError('URL を入力してください');

  let parsed: URL;
  try {
    parsed = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
  } catch {
    throw new SchoolInputError('URL の形式が正しくありません');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new SchoolInputError('URL は http:// または https:// で始まる必要があります');
  }
  if (!parsed.hostname.includes('.')) {
    throw new SchoolInputError('URL の形式が正しくありません');
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const path = parsed.pathname.replace(/\/+$/, '');
  return `https://${host}${path}`;
}

export function validateSchoolInput(input: SchoolInput): SchoolInput & { url: string } {
  const name = input.name.trim();
  if (!name) throw new SchoolInputError('学校名を入力してください');
  if (name.length > 60) throw new SchoolInputError('学校名が長すぎます');

  return { ...input, name, url: normalizeSchoolUrl(input.url) };
}

export const EMPTY_SCHOOL: SchoolInput = {
  name: '',
  url: '',
  hasJuniorAdmission: true,
  hasSeniorAdmission: true,
  hasAffiliatedUniversity: false,
};
