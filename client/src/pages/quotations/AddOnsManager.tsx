import * as React from 'react';
import { toast } from 'sonner';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { getErrorMessage } from '@/lib/axios';
import { cn, formatCurrency } from '@/lib/utils';
import * as quotationService from '@/services/quotation.service';
import type { QuotationExtra, QuotationExtraInput } from '@/services/quotation.service';

const englishOnly = /^[\x20-\x7E]*$/;

interface Draft {
  name: string;
  description: string;
  price: string;
}

const emptyDraft: Draft = { name: '', description: '', price: '' };

/** Turns the form text into an API payload, or returns an error message. */
function toInput(draft: Draft): QuotationExtraInput | string {
  const name = draft.name.trim();
  const description = draft.description.trim();
  const price = Number(draft.price);
  if (name.length < 2) return 'Enter the add-on name.';
  if (!englishOnly.test(name) || !englishOnly.test(description)) return 'Please type in English letters.';
  if (!Number.isInteger(price) || price < 0) return 'Enter the amount in whole rupees.';
  return { name, description: description || undefined, price };
}

function DraftFields({ draft, onChange }: { draft: Draft; onChange: (d: Draft) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_110px]">
      <Input
        value={draft.name}
        onChange={(e) => onChange({ ...draft, name: e.target.value })}
        placeholder="Name, e.g. Policy"
        aria-label="Add-on name"
      />
      <Input
        value={draft.price}
        onChange={(e) => onChange({ ...draft, price: e.target.value.replace(/[^0-9]/g, '') })}
        inputMode="numeric"
        placeholder="Default ₹"
        aria-label="Add-on default amount"
      />
      <Input
        value={draft.description}
        onChange={(e) => onChange({ ...draft, description: e.target.value })}
        placeholder="Description on the PDF (optional)"
        aria-label="Add-on description"
        className="sm:col-span-2"
      />
    </div>
  );
}

/**
 * Admin-only list of optional add-ons (e.g. a policy). A ticked add-on is
 * taken out of the panels + inverter price, so the total never changes.
 * Saved quotations keep their own copy of the prices.
 */
export function AddOnsManager({ extras, onChanged }: { extras: QuotationExtra[]; onChanged: () => void }) {
  const [draft, setDraft] = React.useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editDraft, setEditDraft] = React.useState<Draft>(emptyDraft);
  const [busy, setBusy] = React.useState(false);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      onChanged();
      return true;
    } catch (err) {
      toast.error(getErrorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = toInput(draft);
    if (typeof input === 'string') {
      toast.error(input);
      return;
    }
    if (await run(() => quotationService.createExtra(input), `${input.name} added.`)) setDraft(emptyDraft);
  };

  const startEdit = (extra: QuotationExtra) => {
    setEditingId(extra._id);
    setEditDraft({
      name: extra.name,
      description: extra.description ?? '',
      price: String(extra.price),
    });
  };

  const saveEdit = async (extra: QuotationExtra) => {
    const input = toInput(editDraft);
    if (typeof input === 'string') {
      toast.error(input);
      return;
    }
    // An empty description clears it.
    const payload = { ...input, description: input.description ?? '' };
    if (await run(() => quotationService.updateExtra(extra._id, payload), 'Add-on updated.')) setEditingId(null);
  };

  const handleDelete = (extra: QuotationExtra) => {
    if (!window.confirm(`Delete the add-on "${extra.name}"? Quotations already made keep it.`)) return;
    void run(() => quotationService.deleteExtra(extra._id), 'Add-on deleted.');
  };

  const toggleActive = (extra: QuotationExtra) =>
    void run(
      () => quotationService.updateExtra(extra._id, { active: !extra.active }),
      extra.active ? `${extra.name} hidden from new quotations.` : `${extra.name} offered again.`,
    );

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div>
          <h2 className="text-base font-extrabold text-foreground">Add-ons</h2>
          <p className="text-xs text-muted-foreground">
            Optional items like a policy. The amount here is only the default and can be changed on each quotation
            (leave it empty to type it every time). The total stays the same: the add-on amount is taken out of the
            panels + inverter price.
          </p>
        </div>

        {extras.length > 0 && (
          <ul className="space-y-2">
            {extras.map((extra) =>
              editingId === extra._id ? (
                <li key={extra._id} className="space-y-2 rounded-xl border border-primary/50 p-3">
                  <DraftFields draft={editDraft} onChange={setEditDraft} />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} disabled={busy}>
                      <X className="h-4 w-4" /> Cancel
                    </Button>
                    <Button size="sm" onClick={() => saveEdit(extra)} disabled={busy}>
                      <Check className="h-4 w-4" /> Save
                    </Button>
                  </div>
                </li>
              ) : (
                <li
                  key={extra._id}
                  className={cn('flex items-center gap-1.5 rounded-xl border border-border/70 p-3', !extra.active && 'opacity-60')}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-foreground">{extra.name}</p>
                    <p className="font-mono-brand text-xs tabular-nums text-muted-foreground">
                      {extra.price > 0 ? `Default ${formatCurrency(extra.price)}` : 'Amount typed on each quotation'}
                      {!extra.active && ' · hidden'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    title={extra.active ? 'Stop offering this add-on' : 'Offer this add-on again'}
                    onClick={() => toggleActive(extra)}
                  >
                    {extra.active ? 'Hide' : 'Show'}
                  </Button>
                  <Button size="sm" variant="ghost" aria-label={`Edit ${extra.name}`} title="Edit" disabled={busy} onClick={() => startEdit(extra)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Delete ${extra.name}`}
                    title="Delete"
                    disabled={busy}
                    onClick={() => handleDelete(extra)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ),
            )}
          </ul>
        )}

        <form onSubmit={handleAdd} className="space-y-2 border-t border-border/60 pt-4">
          <DraftFields draft={draft} onChange={setDraft} />
          <Button type="submit" variant="outline" className="w-full" disabled={busy}>
            <Plus className="h-4 w-4" /> Add add-on
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
