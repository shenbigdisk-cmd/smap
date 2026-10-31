<script lang="ts">
  import { getModuleComponent } from './registry'

  let { id }: { id: string } = $props()
  let Component = $derived(getModuleComponent(id))
</script>

{#if Component}
  <Component />
{/if}
