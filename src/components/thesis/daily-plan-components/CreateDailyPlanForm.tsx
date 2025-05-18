
"use client";

import type { FC } from 'react';
import { useState, useEffect } from 'react';
import type { DailyPlan } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface CreateDailyPlanFormProps {
  planDate: Date;
  userId: string;
  existingPlan: DailyPlan | null;
  onSubmitPlan: (title: string | null) => Promise<void>;
  isSubmitting: boolean;
  onCancel: () => void;
}

const CreateDailyPlanForm: FC<CreateDailyPlanFormProps> = ({
  planDate,
  userId,
  existingPlan,
  onSubmitPlan,
  isSubmitting,
  onCancel,
}) => {
  const [title, setTitle] = useState(existingPlan?.title || '');

  useEffect(() => {
    setTitle(existingPlan?.title || '');
  }, [existingPlan]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitPlan(title.trim() === '' ? null : title.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4">
      <div>
        <Label htmlFor="planTitle" className="mb-1.5 block text-sm">
          Titre du Plan pour le {format(planDate, "d MMMM yyyy", { locale: fr })} (Optionnel)
        </Label>
        <Input
          id="planTitle"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="ex: Finalisation Chapitre 3, Recherche intensive..."
          disabled={isSubmitting}
          className="text-sm"
        />
        <p className="text-xs text-muted-foreground mt-1">Laissez vide pour un plan sans titre spécifique.</p>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Annuler
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {existingPlan?.id ? 'Mettre à Jour le Titre' : 'Créer le Plan'}
        </Button>
      </div>
    </form>
  );
};

export default CreateDailyPlanForm;
