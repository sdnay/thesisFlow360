// src/components/thesis/brain-dump-components/brainDumpConstants.ts
import type { FC } from 'react';
import { Zap, Lightbulb, ListChecks, Archive, ArchiveRestore, LucideProps } from 'lucide-react';
import type { BrainDumpEntryStatus } from '@/types';

// Define a type for the icon component
type IconComponent = FC<LucideProps>;

export const statusConfigDefinition = {
  captured: {
    label: 'Capturé',
    icon: Zap as IconComponent,
    colorClasses: {
      border: 'border-blue-500 dark:border-blue-600',
      badgeBg: 'bg-blue-100 dark:bg-blue-900/40',
      badgeText: 'text-blue-700 dark:text-blue-300',
      iconText: 'text-blue-600 dark:text-blue-400',
    },
    description: 'Pensées brutes, idées initiales à trier.',
    actions: [
      { toStatus: 'task' as BrainDumpEntryStatus, label: 'Convertir en Tâche', icon: ListChecks as IconComponent },
      { toStatus: 'idea' as BrainDumpEntryStatus, label: 'Convertir en Idée', icon: Lightbulb as IconComponent },
      { toStatus: 'discarded' as BrainDumpEntryStatus, label: 'Écarter la note', icon: Archive as IconComponent },
    ],
  },
  idea: {
    label: 'Idée',
    icon: Lightbulb as IconComponent,
    colorClasses: {
      border: 'border-lime-500 dark:border-lime-600',
      badgeBg: 'bg-lime-100 dark:bg-lime-900/40',
      badgeText: 'text-lime-700 dark:text-lime-300',
      iconText: 'text-lime-600 dark:text-lime-400',
    },
    description: 'Concepts à explorer ou développer.',
    actions: [
      { toStatus: 'task' as BrainDumpEntryStatus, label: 'Convertir en Tâche', icon: ListChecks as IconComponent },
      { toStatus: 'discarded' as BrainDumpEntryStatus, label: 'Écarter l\'idée', icon: Archive as IconComponent },
    ],
  },
  task: {
    label: 'Tâche',
    icon: ListChecks as IconComponent,
    colorClasses: {
      border: 'border-amber-500 dark:border-amber-600',
      badgeBg: 'bg-amber-100 dark:bg-amber-900/40',
      badgeText: 'text-amber-700 dark:text-amber-300',
      iconText: 'text-amber-600 dark:text-amber-400',
    },
    description: 'Actions concrètes à planifier ou à réaliser.',
    actions: [
      { toStatus: 'idea' as BrainDumpEntryStatus, label: 'Transformer en Idée', icon: Lightbulb as IconComponent },
      { toStatus: 'discarded' as BrainDumpEntryStatus, label: 'Écarter la tâche', icon: Archive as IconComponent },
    ],
  },
  discarded: {
    label: 'Écarté',
    icon: Archive as IconComponent,
    colorClasses: {
      border: 'border-gray-400 dark:border-gray-500',
      badgeBg: 'bg-gray-100 dark:bg-gray-700/40',
      badgeText: 'text-gray-600 dark:text-gray-400',
      iconText: 'text-gray-500 dark:text-gray-500',
    },
    description: 'Notes jugées non pertinentes ou terminées.',
    actions: [
      { toStatus: 'captured' as BrainDumpEntryStatus, label: 'Restaurer (comme Capturé)', icon: ArchiveRestore as IconComponent },
    ],
  },
} as const;

export type StatusConfigType = typeof statusConfigDefinition;
