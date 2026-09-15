interface ResultCardProps {
  title: string;
  stat: string;
  interpretation: string;
  footer: string;
  children?: React.ReactNode;
}

/** Analysis output unit: title, key stat, plot, interpretation, method footer. */
export default function ResultCard({ title, stat, interpretation, footer, children }: ResultCardProps) {
  return (
    <article className="result-card">
      <div className="result-card__head">
        <h3 className="result-card__title">{title}</h3>
        <span className="result-card__stat">{stat}</span>
      </div>
      {children}
      <p className="result-card__interpretation">{interpretation}</p>
      <footer className="result-card__footer">{footer}</footer>
    </article>
  );
}