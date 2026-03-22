import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LineItem {
  material: string;
  qty: number;
  unit: string;
  invoiceNumber: string;
  remarks: string;
}

interface MaterialLineItemsProps {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  readOnly?: boolean;
  className?: string;
}

const MATERIAL_OPTIONS = [
  'E-waste',
  'Li-ion Battery',
  'Iron',
  'Copper',
  'Cobalt',
  'Aluminium',
  'Plastic',
  'Mixed Metals',
];

const UNIT_OPTIONS = ['Kg', 'MT', 'Pcs', 'Nos'];

export function MaterialLineItems({
  items,
  onChange,
  readOnly = false,
  className,
}: MaterialLineItemsProps) {
  const addRow = () => {
    onChange([
      ...items,
      { material: '', qty: 0, unit: 'Kg', invoiceNumber: '', remarks: '' },
    ]);
  };

  const removeRow = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, field: keyof LineItem, value: string | number) => {
    const updated = items.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    );
    onChange(updated);
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-3 py-2.5 text-left font-semibold text-text-secondary">Material</th>
              <th className="px-3 py-2.5 text-left font-semibold text-text-secondary w-24">Qty</th>
              <th className="px-3 py-2.5 text-left font-semibold text-text-secondary w-20">Unit</th>
              <th className="px-3 py-2.5 text-left font-semibold text-text-secondary">Invoice #</th>
              <th className="px-3 py-2.5 text-left font-semibold text-text-secondary">Remarks</th>
              {!readOnly && <th className="px-3 py-2.5 w-12" />}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={readOnly ? 5 : 6}
                  className="px-3 py-8 text-center text-text-muted"
                >
                  No line items added yet
                </td>
              </tr>
            ) : (
              items.map((item, index) => (
                <tr key={index} className="border-b border-gray-100">
                  <td className="px-3 py-2">
                    {readOnly ? (
                      <span>{item.material}</span>
                    ) : (
                      <select
                        value={item.material}
                        onChange={(e) => updateRow(index, 'material', e.target.value)}
                        className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      >
                        <option value="">Select material</option>
                        {MATERIAL_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {readOnly ? (
                      <span>{item.qty}</span>
                    ) : (
                      <input
                        type="number"
                        value={item.qty || ''}
                        onChange={(e) => updateRow(index, 'qty', Number(e.target.value))}
                        className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        min={0}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {readOnly ? (
                      <span>{item.unit}</span>
                    ) : (
                      <select
                        value={item.unit}
                        onChange={(e) => updateRow(index, 'unit', e.target.value)}
                        className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      >
                        {UNIT_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {readOnly ? (
                      <span>{item.invoiceNumber || '—'}</span>
                    ) : (
                      <input
                        type="text"
                        value={item.invoiceNumber}
                        onChange={(e) => updateRow(index, 'invoiceNumber', e.target.value)}
                        placeholder="INV-..."
                        className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {readOnly ? (
                      <span>{item.remarks || '—'}</span>
                    ) : (
                      <input
                        type="text"
                        value={item.remarks}
                        onChange={(e) => updateRow(index, 'remarks', e.target.value)}
                        placeholder="Optional"
                        className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    )}
                  </td>
                  {!readOnly && (
                    <td className="px-3 py-2">
                      <button
                        onClick={() => removeRow(index)}
                        className="rounded p-1 text-gray-400 hover:bg-danger-50 hover:text-danger transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <button
          onClick={addRow}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-sm font-medium text-text-muted hover:border-primary hover:text-primary transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Material
        </button>
      )}
    </div>
  );
}
