export default function ProgressBar({ currentStep, totalSteps }) {
  const labels = ['Data', 'Orario', 'Tipo', 'Bici', 'Contatti', 'Riepilogo'];

  return (
    <div className="progress-wrapper">
      <div className="progress-bar-track">
        <div
          className="progress-bar-fill"
          style={{ width: `${(currentStep / totalSteps) * 100}%` }}
        />
      </div>
      <div className="progress-steps">
        {labels.map((label, i) => {
          const stepNum = i + 1;
          const active  = stepNum === currentStep;
          return (
            <span key={i} style={{ color: active ? 'var(--primary)' : undefined }}>
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
