// src/components/thesis/brain-dump-components/BrainDumpItemCard.tsx
"use client";

import type { FC } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Trash2, EllipsisVertical } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { BrainDumpEntry, BrainDumpEntryStatus } from '@/types';
import { statusConfigDefinition } from './brainDumpConstants';

interface BrainDumpItemCardProps {
  entry: BrainDumpEntry;
  onUpdateStatus: (id: string, status: BrainDumpEntryStatus) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isLoading: boolean;
}

const BrainDumpItemCard: FC<BrainDumpItemCardProps> = ({
  entry,
  onUpdateStatus,
  onDelete,
  isLoading,
}) => {
  const config = statusConfigDefinition[entry.status];
  if (!config) {
    console.error(`Configuration de statut invalide pour la note: ${entry.id} avec statut ${entry.status}`);
    return (
      <Card className="border-l-4 border-red-500 p-3 text-red-700 shadow-sm">
        Erreur: Statut de note invalide ({entry.status}) pour "{entry.text.substring(0, 30)}...".
      </Card>
    );
  }
  const StatusIcon = config.icon;
  const availableActions = config.actions || [];

  return (
    <Card className={cn("shadow-sm hover:shadow-md transition-shadow duration-150 flex flex-col border-l-4", config.colorClasses.border)}>
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex justify-between items-center">
          <Badge variant="outline" className={cn(
            "text-xs font-medium border-none",
            config.colorClasses.badgeBg,
            config.colorClasses.badgeText
          )}>
            <StatusIcon className={cn("mr-1.5 h-3.5 w-3.5", config.colorClasses.iconText)} />
            {config.label}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: fr })}
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-1 pb-3 px-3 flex-grow min-h-[50px]">
        <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90">{entry.text}</p>
      </CardContent>
      <CardFooter className="flex justify-end items-center gap-1 pt-2 pb-3 px-3 border-t">
        {availableActions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-primary"
                disabled={isLoading}
                title="Changer le statut"
              >
                <EllipsisVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {availableActions.map(action => {
                const ActionIcon = action.icon;
                return (
                  <DropdownMenuItem
                    key={action.toStatus}
                    onClick={() => onUpdateStatus(entry.id, action.toStatus)}
                    disabled={isLoading}
                    className="text-sm cursor-pointer"
                  >
                    <ActionIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                    {action.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(entry.id)}
          title="Supprimer Définitivement"
          className="text-destructive/70 hover:text-destructive hover:bg-destructive/10 h-8 w-8"
          disabled={isLoading}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
};

export default BrainDumpItemCard;
