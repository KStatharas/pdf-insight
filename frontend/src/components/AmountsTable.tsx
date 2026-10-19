import type { CSSProperties } from 'react';

import { useI18n } from '../i18n/context';
import { formatAmountValue } from '../lib/format';
import { useCountUp } from '../lib/motion';
import type { Amount } from '../lib/schema';

interface AmountsTableProps {
  amounts: Amount[];
  /** Descriptions to show (translated or original), in the order of `amounts`. */
  contexts: (string | null)[];
  lang: string | undefined;
  pending: boolean;
  /** Animate descriptions that were just replaced by their translation. */
  inkIn: boolean;
}

/** Rolls the number up from zero when the table first appears. */
function RollingAmount({ value, delay, locale }: { value: number; delay: number; locale: string }) {
  const shown = useCountUp(value, 900, delay);
  return <>{formatAmountValue(shown, locale)}</>;
}

export function AmountsTable({ amounts, contexts, lang, pending, inkIn }: AmountsTableProps) {
  const { t, locale } = useI18n();
  if (amounts.length === 0) {
    return <p className="muted">{t.amounts.empty}</p>;
  }

  return (
    <div className="table-scroll">
      <table className={`ledger${pending ? ' is-pending' : ''}`}>
        <caption className="visually-hidden">{t.amounts.caption}</caption>
        <thead>
          <tr>
            <th scope="col">{t.amounts.context}</th>
            <th scope="col" className="num">
              {t.amounts.value}
            </th>
            <th scope="col">{t.amounts.currency}</th>
          </tr>
        </thead>
        <tbody>
          {amounts.map((amount, index) => {
            const context = contexts[index] ?? amount.context;
            return (
              <tr
                key={`${String(amount.value)}-${amount.currency ?? ''}-${String(index)}`}
                style={{ '--i': index } as CSSProperties}
              >
                <td
                  key={`context-${String(lang)}`}
                  lang={lang}
                  className={`context${inkIn ? ' ink-in' : ''}`}
                >
                  {context ?? <span className="muted">{t.amounts.noContext}</span>}
                </td>
                <td className="num">
                  <RollingAmount
                    value={amount.value}
                    delay={350 + Math.min(index, 12) * 45}
                    locale={locale}
                  />
                </td>
                <td className="currency">
                  <span className={`currency-badge currency-${amount.currency ?? 'none'}`}>
                    {amount.currency ?? '—'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
