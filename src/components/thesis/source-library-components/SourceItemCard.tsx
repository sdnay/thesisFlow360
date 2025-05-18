
"use client";

import type { FC } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import type { Source } from '@/types';
import { SourceTypeIcon, sourceTypeText } from './SourceTypeIcon'; // Updated import path
import { Edit3, Trash2, EllipsisVertical, Link as LinkIconLucide, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface SourceItemCardProps {
  source: Source;
  onEdit: (source: Source) => void;
  onDelete: (id: string) => Promise<void>;
  isLoading: boolean;
}

const SourceItemCard: FC<SourceItemCardProps> = ({ source, onEdit, onDelete, isLoading }) => {
  const isExternalLink = source.source_link_or_path && (source.source_link_or_path.startsWith('http://') || source.source_link_or_path.startsWith('https://'));
  
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow duration-150 flex flex-col h-full bg-card">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex justify-between items-start gap-2">
          <div className="flex items-center gap-2.5 flex-grow min-w-0">
            <SourceTypeIcon type={source.type} className="text-primary shrink-0 h-5 w-5" />
            <div className="flex-grow min-w-0">
              <CardTitle className="text-base md:text-lg leading-tight truncate" title={source.title}>
                {source.title}
              </CardTitle>
              <CardDescription className="text-xs pt-0.5">
                <Badge variant="outline" className="font-normal border-primary/30 text-primary/80">
                  {sourceTypeText(source.type)}
                </Badge>
              </CardDescription>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-primary" disabled={isLoading} aria-label="Options de la source">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <EllipsisVertical className="h-4 w-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(source)} disabled={isLoading} className="cursor-pointer">
                <Edit3 className="mr-2 h-4 w-4" /> Modifier
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(source.id)} className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer" disabled={isLoading}>
                <Trash2 className="mr-2 h-4 w-4" /> Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="text-xs md:text-sm flex-grow py-3 px-4 space-y-2">
        <p className="text-xs text-muted-foreground">
          Ajouté le : {format(new Date(source.created_at), "d MMM yyyy, HH:mm", { locale: fr })}
        </p>
        <Accordion type="single" collapsible className="w-full text-xs">
          {source.source_link_or_path && (
            <AccordionItem value="link" className="border-b-0">
              <AccordionTrigger className="py-1.5 text-muted-foreground hover:text-primary hover:no-underline text-xs">
                Voir Lien/Chemin
              </AccordionTrigger>
              <AccordionContent className="pt-1 pb-2 text-xs">
                <div className="flex items-center gap-1.5 break-all">
                  <LinkIconLucide className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  {isExternalLink ? (
                    <Link href={source.source_link_or_path} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" title={source.source_link_or_path}>
                      {source.source_link_or_path}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground" title={source.source_link_or_path}>{source.source_link_or_path}</span>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
          {source.notes && (
            <AccordionItem value="notes" className={cn(!source.source_link_or_path && "border-b-0")}>
              <AccordionTrigger className="py-1.5 text-muted-foreground hover:text-primary hover:no-underline text-xs">
                Voir Notes ({source.notes.split(/\s+/).length} mots)
              </AccordionTrigger>
              <AccordionContent className="pt-1 pb-2 text-xs">
                <p className="text-foreground whitespace-pre-wrap max-h-32 overflow-y-auto custom-scrollbar pr-1">{source.notes}</p>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
        {!source.source_link_or_path && !source.notes && (
          <p className="text-muted-foreground italic text-xs py-2">Aucun lien ou note pour cette source.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default SourceItemCard;
