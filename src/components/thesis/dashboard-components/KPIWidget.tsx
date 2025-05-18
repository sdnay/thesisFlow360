
"use client";

import type { FC, ElementType, ReactNode } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface KPIWidgetProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: ElementType;
  link?: string;
  linkText?: string;
  children?: ReactNode;
}

const KPIWidget: FC<KPIWidgetProps> = ({ title, value, description, icon: Icon, link, linkText, children }) => {
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow duration-150 bg-card h-full flex flex-col">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-muted-foreground">{title}</CardTitle>
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        </div>
      </CardHeader>
      <CardContent className="flex-grow py-2 px-4">
        <div className="text-2xl font-bold text-primary">{value}</div>
        {description && <p className="text-xs text-muted-foreground pt-0.5">{description}</p>}
        {children}
      </CardContent>
      {link && linkText && (
        <CardFooter className="pt-2 pb-3 px-4 border-t mt-auto">
          <Button asChild variant="link" size="xs" className="p-0 h-auto text-xs text-primary hover:underline">
            <Link href={link}>{linkText} <span aria-hidden="true">→</span></Link>
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};

export default KPIWidget;
