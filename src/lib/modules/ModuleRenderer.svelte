<script lang="ts">
  import type { Component as SvelteComponent } from 'svelte'
  import { moduleManager } from './core/ModuleManager'
  import { getModuleComponent } from './registry'

  let { id }: { id: string } = $props()

  let syncComponent = $derived(getModuleComponent(id))
  let asyncComponent = $state<SvelteComponent | null>(null)
  let isLoading = $state(false)
  let loadError = $state<string | null>(null)

  $effect(() => {
    // If already synchronously available or cached, no async load needed
    if (syncComponent) {
      asyncComponent = null
      isLoading = false
      loadError = null
      return
    }

    let active = true
    isLoading = true
    loadError = null

    moduleManager
      .loadComponent(id)
      .then((comp) => {
        if (active) {
          asyncComponent = comp
          isLoading = false
        }
      })
      .catch((err) => {
        if (active) {
          console.error(`[ModuleRenderer] Failed to load component for '${id}':`, err)
          loadError = err instanceof Error ? err.message : 'Failed to load component'
          isLoading = false
        }
      })

    return () => {
      active = false
    }
  })

  let ActiveComponent = $derived(syncComponent || asyncComponent)
</script>

{#if ActiveComponent}
  <ActiveComponent />
{:else if isLoading}
  <div class="module-skeleton" role="status" aria-label="Loading module">
    <div class="skeleton-line full"></div>
    <div class="skeleton-line half"></div>
    <div class="skeleton-card"></div>
  </div>
{:else if loadError}
  <div class="module-error" role="alert">
    <span>Module failed to load</span>
  </div>
{/if}

<style>
  .module-skeleton {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .skeleton-line {
    height: 12px;
    border-radius: 4px;
    background: linear-gradient(90deg, var(--bg-card-subtle) 25%, var(--border-color) 50%, var(--bg-card-subtle) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .skeleton-line.full {
    width: 100%;
  }

  .skeleton-line.half {
    width: 60%;
  }

  .skeleton-card {
    height: 90px;
    border-radius: 6px;
    background: var(--bg-card-subtle);
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  .module-error {
    padding: 16px;
    font-size: 13px;
    color: var(--text-muted);
    text-align: center;
  }
</style>
