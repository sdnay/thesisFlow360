import type { SVGProps } from 'react';

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 50"
      width="120"
      height="30"
      aria-label="ThesisFlow 360 Logo"
      {...props}
    >
      <style>
        {`
          .logo-text {
            font-family: var(--font-geist-sans), Arial, sans-serif;
            font-size: 28px;
            font-weight: 600;
            fill: hsl(var(--primary)); /* Use primary color from theme */
          }
          .logo-text-dark {
             font-family: var(--font-geist-sans), Arial, sans-serif;
            font-size: 28px;
            font-weight: 600;
            fill: hsl(var(--primary-foreground)); /* Use primary foreground for dark mode */
          }
          .logo-highlight {
            fill: hsl(var(--accent)); /* Use accent color from theme */
          }
          @media (prefers-color-scheme: dark) {
            .logo-text {
              fill: hsl(var(--sidebar-foreground));
            }
            .logo-highlight {
               fill: hsl(var(--sidebar-primary));
            }
          }
        `}
      </style>
      <text x="0" y="35" className="logo-text">
        ThesisFlow
        <tspan className="logo-highlight">360</tspan>
      </text>
    </svg>
  );
}
