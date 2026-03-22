import { useEffect, useState } from 'react';
import { Scale } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WeighbridgeInputProps {
  tareWeight: number;
  grossWeight: number;
  onChange: (values: { tareWeight: number; grossWeight: number; netWeight: number }) => void;
  readOnly?: boolean;
  className?: string;
}

export function WeighbridgeInput({
  tareWeight: initialTare,
  grossWeight: initialGross,
  onChange,
  readOnly = false,
  className,
}: WeighbridgeInputProps) {
  const [tare, setTare] = useState(initialTare);
  const [gross, setGross] = useState(initialGross);
  const net = Math.max(0, gross - tare);

  useEffect(() => {
    setTare(initialTare);
    setGross(initialGross);
  }, [initialTare, initialGross]);

  const handleTareChange = (val: number) => {
    setTare(val);
    const netVal = Math.max(0, gross - val);
    onChange({ tareWeight: val, grossWeight: gross, netWeight: netVal });
  };

  const handleGrossChange = (val: number) => {
    setGross(val);
    const netVal = Math.max(0, val - tare);
    onChange({ tareWeight: tare, grossWeight: val, netWeight: netVal });
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Tare Weight (Kg)
          </label>
          {readOnly ? (
            <div className="rounded-lg bg-gray-50 px-3 py-2 text-lg font-semibold text-text-primary">
              {tare.toLocaleString()}
            </div>
          ) : (
            <input
              type="number"
              value={tare || ''}
              onChange={(e) => handleTareChange(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-lg font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              min={0}
            />
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Gross Weight (Kg)
          </label>
          {readOnly ? (
            <div className="rounded-lg bg-gray-50 px-3 py-2 text-lg font-semibold text-text-primary">
              {gross.toLocaleString()}
            </div>
          ) : (
            <input
              type="number"
              value={gross || ''}
              onChange={(e) => handleGrossChange(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-lg font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              min={0}
            />
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Net Weight (Kg)
          </label>
          <div className="rounded-lg bg-gray-50 px-3 py-2 text-lg font-semibold text-text-secondary">
            {net.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Big Net Weight Display */}
      <div className="rounded-xl bg-gradient-to-r from-primary-50 to-primary-100 p-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Scale className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold uppercase tracking-wider text-primary-600">
            Net Weight
          </span>
        </div>
        <p className="text-5xl font-bold text-primary">
          {net.toLocaleString()}
          <span className="ml-2 text-xl font-medium text-primary-400">Kg</span>
        </p>
      </div>
    </div>
  );
}
