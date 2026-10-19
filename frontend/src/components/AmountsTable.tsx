import { formatAmountValue } from '../lib/format';
import type { Amount } from '../lib/schema';

export function AmountsTable({ amounts }: { amounts: Amount[] }) {
  if (amounts.length === 0) {
    return <p className="muted">Dokument nie zawiera kwot.</p>;
  }

  return (
    <div className="table-scroll">
      <table className="ledger">
        <caption className="visually-hidden">Kwoty wymienione w dokumencie</caption>
        <thead>
          <tr>
            <th scope="col">Czego dotyczy</th>
            <th scope="col" className="num">
              Kwota
            </th>
            <th scope="col">Waluta</th>
          </tr>
        </thead>
        <tbody>
          {amounts.map((amount, index) => (
            <tr key={`${String(amount.value)}-${amount.currency ?? ''}-${String(index)}`}>
              <td>{amount.context ?? <span className="muted">brak opisu</span>}</td>
              <td className="num">{formatAmountValue(amount.value)}</td>
              <td className="currency">{amount.currency ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
