import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { loadAppConfig } from './lib/config/map.config'
import { mapStore } from './lib/stores/mapStore.svelte'

async function bootstrap() {
  try {
    const config = await loadAppConfig('/config.json')
    mapStore.initFromConfig(config)
    if (typeof window !== 'undefined') {
      ;(window as any).__mapStore = mapStore
    }
  } catch (err) {
    console.error('[bootstrap] Failed to load /config.json:', err)
  }

  const app = mount(App, {
    target: document.getElementById('app')!,
  })

  return app
}

export default bootstrap()
