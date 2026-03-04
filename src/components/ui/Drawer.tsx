"use client";

import { Drawer as VaulDrawer } from "vaul";
import { cn } from "@/lib/cn";

interface DrawerContentProps extends React.ComponentProps<typeof VaulDrawer.Content> {
  title?: string;
  description?: string;
}

function DrawerContent({ title, description, children, className, ...props }: DrawerContentProps) {
  return (
    <VaulDrawer.Content
      className={cn(
        "flex max-h-[96vh] flex-col rounded-t-[10px] border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900",
        className
      )}
      {...props}
    >
      <div className="mx-auto mt-4 h-1.5 w-12 shrink-0 rounded-full bg-slate-200 dark:bg-slate-600" />
      {(title || description) && (
        <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          {title && <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>}
          {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
    </VaulDrawer.Content>
  );
}

/** Vaul Drawer bileşeni - title/description ile genişletilmiş Content */
export const Drawer = {
  Root: VaulDrawer.Root,
  Trigger: VaulDrawer.Trigger,
  Portal: VaulDrawer.Portal,
  Overlay: VaulDrawer.Overlay,
  Close: VaulDrawer.Close,
  Title: VaulDrawer.Title,
  Description: VaulDrawer.Description,
  Handle: VaulDrawer.Handle,
  Content: DrawerContent,
};
