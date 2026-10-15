import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'ink';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * - `primary`: the accent fill. Reserved for the transport's Play scale,
   *   the one orange action in the app; views use `ink` for their main action.
   * - `ink`: solid black, for strong secondary actions (Start session).
   * - `secondary`: white with a control border.
   * - `ghost`: no border, muted text; for tertiary actions.
   */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Leading icon from lucide-react. */
  icon?: LucideIcon;
  /** Render as a square icon-only button. Requires `aria-label`. */
  iconOnly?: boolean;
  children?: ReactNode;
}

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:brightness-95 active:brightness-90',
  ink: 'bg-ink text-surface hover:bg-ink/85',
  secondary: 'bg-surface text-ink border border-control hover:bg-sunken',
  ghost: 'bg-transparent text-muted hover:bg-sunken hover:text-ink',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
  lg: 'h-11 px-5 text-[15px] gap-2',
  /** The focal action of a view (ChordAI's Listen). */
  xl: 'h-14 px-7 text-[17px] gap-2.5',
};

const ICON_ONLY: Record<ButtonSize, string> = {
  sm: 'h-8 w-8',
  md: 'h-9 w-9',
  lg: 'h-11 w-11',
  xl: 'h-14 w-14',
};

const ICON_PX: Record<ButtonSize, number> = { sm: 15, md: 16, lg: 18, xl: 20 };

/**
 * Button
 *
 * The one button component. Disabled buttons keep their shape and drop to
 * 45% opacity so the layout never shifts when an action becomes available.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon: Icon, iconOnly = false, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-control font-bold whitespace-nowrap',
        'transition-[background-color,color,filter] duration-150',
        'disabled:pointer-events-none disabled:opacity-45',
        VARIANT[variant],
        iconOnly ? ICON_ONLY[size] : SIZE[size],
        className,
      )}
      {...rest}
    >
      {Icon && <Icon size={ICON_PX[size]} strokeWidth={2} aria-hidden="true" />}
      {!iconOnly && children}
    </button>
  );
});
