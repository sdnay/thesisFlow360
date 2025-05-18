
"use client";

import type { FC } from 'react';
import type { Source } from '@/types';
import { cn } from '@/lib/utils';
import { FileText, Link as LinkIconLucide, Mic, BookOpen, FileArchive } from 'lucide-react';

export const SourceTypeIcon: FC<{ type: Source['type'], className?: string }> = ({ type, className }) => {
  const iconProps = { className: cn("h-4 w-4", className) };
  switch (type) {
    case 'pdf': return <FileText {...iconProps} />;
    case 'website': return <LinkIconLucide {...iconProps} />;
    case 'interview': return <Mic {...iconProps} />;
    case 'field_notes': return <BookOpen {...iconProps} />;
    default: return <FileArchive {...iconProps} />;
  }
};

export const sourceTypeText = (type: Source['type']): string => {
    switch (type) {
        case 'pdf': return 'Document PDF';
        case 'website': return 'Site Web / Lien';
        case 'interview': return 'Entretien';
        case 'field_notes': return 'Notes de Terrain';
        case 'other': return 'Autre';
        default: return type;
    }
};
