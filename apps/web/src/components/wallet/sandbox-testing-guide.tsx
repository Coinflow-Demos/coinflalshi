'use client';

const ZIP_TRIGGERS = [
  {zip: '99999', label: 'Force a decline'},
  {zip: '00000', label: 'Force a chargeback-protection rejection'},
  {zip: '00001', label: 'Force a fraud-protection rejection'},
];

const AMOUNT_TRIGGERS = [
  {amount: '9.98', label: 'Friction challenge — success'},
  {amount: '10.97', label: 'Friction challenge — failure'},
  {amount: '7.96', label: 'Rejection'},
];

export function SandboxTestingGuide({
  onSetAmount,
  onSetZip,
}: {
  onSetAmount: (amount: string) => void;
  onSetZip: (zip: string) => void;
}) {
  return (
    <details className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
      <summary className="cursor-pointer select-none font-medium text-muted-foreground">
        Sandbox testing guide
      </summary>
      <div className="mt-3 flex flex-col gap-3 text-xs">
        <div>
          <p className="mb-1.5 font-medium text-foreground">Trigger an outcome by billing zip</p>
          <div className="flex flex-wrap gap-2">
            {ZIP_TRIGGERS.map((trigger) => (
              <button
                key={trigger.zip}
                type="button"
                onClick={() => onSetZip(trigger.zip)}
                className="rounded-full border border-border px-3 py-1 text-muted-foreground hover:bg-accent"
              >
                {trigger.zip} — {trigger.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 font-medium text-foreground">
            Trigger a 3DS challenge on any card, by the amount's last two cents digits
          </p>
          <div className="flex flex-wrap gap-2">
            {AMOUNT_TRIGGERS.map((trigger) => (
              <button
                key={trigger.amount}
                type="button"
                onClick={() => onSetAmount(trigger.amount)}
                className="rounded-full border border-border px-3 py-1 text-muted-foreground hover:bg-accent"
              >
                ${trigger.amount} — {trigger.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </details>
  );
}
