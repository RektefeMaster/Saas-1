"use client";

import { X } from "lucide-react";
import type { DemoNavKey } from "./data";
import type { PanelCopy } from "./i18n";

export function GuideModal({
  navKey,
  copy,
  onClose,
}: {
  navKey: DemoNavKey;
  copy: PanelCopy;
  onClose: () => void;
}) {
  const guide = copy.guides[navKey];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-guide-title"
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label={copy.guideClose} onClick={onClose} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              {copy.guideEyebrow}
            </p>
            <h2 id="demo-guide-title" className="mt-1 text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50">
              {guide.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-5">
          <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">{guide.summary}</p>
          <ul className="space-y-2.5">
            {guide.points.map((point) => (
              <li
                key={point}
                className="flex gap-2.5 rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-sm leading-6 text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200"
              >
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                {point}
              </li>
            ))}
          </ul>
        </div>
        <div className="border-t border-slate-100 px-5 py-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            {copy.guideClose}
          </button>
        </div>
      </div>
    </div>
  );
}
