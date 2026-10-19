import { useI18n } from '../i18n/context';
import { formatAmountValue } from '../lib/format';
import type { Amount } from '../lib/schema';

interface AmountsTableProps {
  amounts: Amount[];
  /** Descriptions to show (translated or original), in the order of `amounts`. */
  contexts: (string | null)[];
  lang: string | undefined;
  pending: boolean;
}

export function AmountsTable({ amounts, contexts, lang, pending }: AmountsTableProps) {
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
              <tr key={`${String(amount.value)}-${amount.currency ?? ''}-${String(index)}`}>
                <td lang={lang} className="context">
                  {context ?? <span className="muted">{t.amounts.noContext}</span>}
                </td>
                <td className="num">{formatAmountValue(amount.value, locale)}</td>
                <td className="currency">{amount.currency ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
