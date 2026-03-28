import { createSignal, createEffect, onCleanup, For, Show, type JSX } from "solid-js";
import { Button } from "./ui/button.js";
import { Input } from "./ui/input.js";

export interface Column<T> {
  header: string;
  accessor: (row: T) => JSX.Element | string | number | null | undefined;
  class?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  loading?: boolean;
  expandRow?: (row: T) => JSX.Element;
  onExpand?: (row: T) => void;
  actions?: JSX.Element;
}

export function DataTable<T>(props: DataTableProps<T>) {
  const [search, setSearch] = createSignal("");
  const [expandedIdx, setExpandedIdx] = createSignal<number | null>(null);
  const totalPages = () => Math.max(1, Math.ceil(props.total / props.pageSize));

  createEffect(() => {
    // Reset expanded row when data or page changes
    void props.data;
    void props.page;
    setExpandedIdx(null);
  });

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(debounceTimer));

  function handleSearch(value: string) {
    setSearch(value);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => props.onSearch?.(value), 300);
  }

  function toggleExpand(idx: number) {
    if (expandedIdx() === idx) {
      setExpandedIdx(null);
    } else {
      setExpandedIdx(idx);
      props.onExpand?.(props.data[idx]!);
    }
  }

  function pageNumbers() {
    const total = totalPages();
    const current = props.page;
    const pages: (number | "...")[] = [];

    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (current > 3) pages.push("...");
      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (current < total - 2) pages.push("...");
      pages.push(total);
    }
    return pages;
  }

  return (
    <div class="space-y-4">
      {/* Toolbar */}
      <div class="flex flex-wrap items-center gap-3">
        <Show when={props.onSearch}>
          <Input
            placeholder={props.searchPlaceholder ?? "Search..."}
            value={search()}
            onInput={(e) => handleSearch(e.currentTarget.value)}
            class="max-w-xs"
          />
        </Show>
        <Show when={props.actions}>
          <div class="ml-auto flex gap-2">{props.actions}</div>
        </Show>
      </div>

      {/* Table */}
      <div class="overflow-x-auto rounded-xl border border-border">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-border bg-muted/30">
              <For each={props.columns}>
                {(col) => (
                  <th
                    class={`px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground ${col.class ?? ""}`}
                  >
                    {col.header}
                  </th>
                )}
              </For>
            </tr>
          </thead>
          <tbody>
            <Show
              when={!props.loading}
              fallback={
                <For each={Array.from({ length: 5 })}>
                  {() => (
                    <tr class="border-b border-border last:border-0">
                      <For each={props.columns}>
                        {() => (
                          <td class="px-4 py-3">
                            <div class="h-4 w-24 animate-pulse rounded bg-muted" />
                          </td>
                        )}
                      </For>
                    </tr>
                  )}
                </For>
              }
            >
              <Show
                when={props.data.length > 0}
                fallback={
                  <tr>
                    <td
                      colSpan={props.columns.length}
                      class="px-4 py-12 text-center text-muted-foreground"
                    >
                      No results found
                    </td>
                  </tr>
                }
              >
                <For each={props.data}>
                  {(row, idx) => (
                    <>
                      <tr
                        class={`border-b border-border last:border-0 transition-colors ${
                          props.expandRow ? "cursor-pointer hover:bg-accent/30" : "hover:bg-accent/20"
                        } ${expandedIdx() === idx() ? "bg-accent/20" : ""}`}
                        onClick={() => props.expandRow && toggleExpand(idx())}
                        {...(props.expandRow ? {
                          tabIndex: 0,
                          role: "button" as const,
                          "aria-expanded": expandedIdx() === idx(),
                          "aria-controls": `detail-${idx()}`,
                          onKeyDown: (e: KeyboardEvent) => {
                            if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
                              e.preventDefault();
                              toggleExpand(idx());
                            }
                          },
                        } : {})}
                      >
                        <For each={props.columns}>
                          {(col) => (
                            <td class={`px-4 py-2.5 ${col.class ?? ""}`}>
                              {col.accessor(row)}
                            </td>
                          )}
                        </For>
                      </tr>
                      <Show when={props.expandRow && expandedIdx() === idx()}>
                        <tr id={`detail-${idx()}`} class="border-b border-border last:border-0 bg-muted/20">
                          <td colSpan={props.columns.length} class="px-4 py-3">
                            {props.expandRow!(row)}
                          </td>
                        </tr>
                      </Show>
                    </>
                  )}
                </For>
              </Show>
            </Show>
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <Show when={totalPages() > 1}>
        <div class="flex items-center justify-between">
          <p class="text-xs text-muted-foreground">
            {props.total.toLocaleString()} total
          </p>
          <div class="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={props.page <= 1}
              onClick={() => props.onPageChange(props.page - 1)}
              aria-label="Previous page"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6" /></svg>
            </Button>
            <For each={pageNumbers()}>
              {(p) =>
                p === "..." ? (
                  <span class="px-1.5 text-xs text-muted-foreground">...</span>
                ) : (
                  <button
                    class={`h-8 min-w-8 rounded-lg px-2 text-xs font-medium transition-colors ${
                      props.page === p
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                    onClick={() => props.onPageChange(p as number)}
                  >
                    {p}
                  </button>
                )
              }
            </For>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={props.page >= totalPages()}
              onClick={() => props.onPageChange(props.page + 1)}
              aria-label="Next page"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6" /></svg>
            </Button>
          </div>
        </div>
      </Show>
    </div>
  );
}
