'use client';

import { useState, useTransition } from 'react';

import type { ThreadMessage } from '@/lib/data/thread-repository';
import { DIFFICULTY_LABEL, PRIORITY_LABEL, type Action } from '@/lib/types';

interface InquiryResult {
  body: string;
  revisedPriority: Action['priority'] | null;
  revisedDifficulty: Action['difficulty'] | null;
  confirmInSchool: string[];
}

/**
 * 06 照会欄。校内の事情を入力すると、その施策の位置づけを再評価した回答を返す。
 *
 * 想定される確認事項（qa）は、そのまま質問として送れるようにしてある。
 * 所要時間・期限は回答にも出さない（handoff.md 5章 06）。
 */
export function InquiryBox({
  action,
  initialMessages,
  canAnswer,
}: {
  action: Action;
  initialMessages: ThreadMessage[];
  canAnswer: boolean;
}) {
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages);
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<InquiryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, startSending] = useTransition();

  function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    startSending(async () => {
      setError(null);
      const response = await fetch(`/api/actions/${encodeURIComponent(action.id)}/inquiry`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: trimmed }),
      });
      const body = (await response.json().catch(() => null)) as {
        messages?: ThreadMessage[];
        answer?: InquiryResult;
        error?: string;
      } | null;

      if (!response.ok) {
        setError(body?.error ?? '照会に失敗しました');
        return;
      }
      setMessages(body?.messages ?? []);
      setResult(body?.answer ?? null);
      setQuestion('');
    });
  }

  return (
    <div className="ask">
      <div className="ah">照会 ／ 校内事情を踏まえた確認</div>
      <div className="ab">
        {action.qa.length > 0 && (
          <div className="chips">
            {action.qa.map((qa) => (
              <button
                key={qa.question}
                className="chip"
                disabled={sending || !canAnswer}
                onClick={() => ask(qa.question)}
              >
                {qa.question}
              </button>
            ))}
          </div>
        )}

        <div className="askbox">
          <input
            type="text"
            value={question}
            disabled={sending || !canAnswer}
            placeholder="校内の事情を入力（例：来年サイトを全面改修する予定です）"
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') ask(question);
            }}
          />
          <button
            className="btn"
            disabled={sending || !canAnswer || !question.trim()}
            onClick={() => ask(question)}
          >
            {sending ? '照会中…' : '照会'}
          </button>
        </div>

        {!canAnswer && (
          <p style={{ fontSize: 10.5, color: 'var(--mute)', marginTop: 8, lineHeight: 1.7 }}>
            ANTHROPIC_API_KEY が設定されていないため、照会は利用できません。
          </p>
        )}

        {error && (
          <div className="answer on" style={{ borderColor: 'var(--rose)' }}>
            {error}
          </div>
        )}

        {messages.length > 0 && (
          <div className="answer on">
            {messages.map((message, index) => (
              <div key={`${message.createdAt}-${index}`} style={{ marginBottom: 10 }}>
                {message.role === 'user' ? (
                  <div className="qline">{message.body}</div>
                ) : (
                  <div>{message.body}</div>
                )}
              </div>
            ))}

            {result && (result.revisedPriority || result.revisedDifficulty) && (
              <div className="meta" style={{ marginTop: 4 }}>
                {result.revisedPriority && (
                  <span>
                    優先度の見直し{' '}
                    <b>
                      {PRIORITY_LABEL[action.priority]} → {PRIORITY_LABEL[result.revisedPriority]}
                    </b>
                  </span>
                )}
                {result.revisedDifficulty && (
                  <span>
                    難易度の見直し{' '}
                    <b>
                      {DIFFICULTY_LABEL[action.difficulty]} →{' '}
                      {DIFFICULTY_LABEL[result.revisedDifficulty]}
                    </b>
                  </span>
                )}
              </div>
            )}

            {result && result.confirmInSchool.length > 0 && (
              <>
                <h4 style={{ marginTop: 12 }}>校内で確認すべき点</h4>
                <ul style={{ paddingLeft: 17, fontSize: 12 }}>
                  {result.confirmInSchool.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            )}

            <div className="foot">
              本校サイトの走査結果および比較校の公開情報に基づく回答です。校内事情に関わる判断は担当者の確認を経てください。所要時間・期限は学校ごとの体制により変わるため示していません。
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
