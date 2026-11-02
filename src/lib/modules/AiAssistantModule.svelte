<script lang="ts">
  import { tick } from 'svelte'
  import { aiService } from '../services/ai/aiService.svelte'

  let inputValue = $state('')
  let chatScrollContainer: HTMLDivElement | null = null

  const quickPrompts = [
    'Find 120 Swanston Street and list its zones',
    'Generate property report',
    'Buffer selected parcel by 100m',
    'Toggle Bushfire overlay',
    'Zoom to Victoria extent'
  ]

  async function scrollToBottom() {
    await tick()
    if (chatScrollContainer) {
      chatScrollContainer.scrollTop = chatScrollContainer.scrollHeight
    }
  }

  async function handleSubmit(e?: Event) {
    if (e) e.preventDefault()
    const val = inputValue.trim()
    if (!val || aiService.isGenerating) return

    inputValue = ''
    await aiService.sendMessage(val)
    scrollToBottom()
  }

  function handlePromptClick(p: string) {
    inputValue = p
    handleSubmit()
  }

  function formatMarkdown(text: string): string {
    if (!text) return ''
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
    const lines = html.split('\n')
    return lines
      .map((line) => {
        const trimmed = line.trim()
        if (trimmed.startsWith('* ') || trimmed.startsWith('• ') || trimmed.startsWith('- ')) {
          return `<li class="chat-bullet">${trimmed.replace(/^[*•-]\s*/, '')}</li>`
        }
        return trimmed ? `<p class="chat-para">${trimmed}</p>` : ''
      })
      .join('')
  }
</script>

<div class="ai-assistant-module">
  <!-- Top Control Bar -->
  <div class="assistant-top-bar">
    <div class="provider-pill">
      <span class="status-dot" class:active={!aiService.isGenerating}></span>
      <span class="provider-label">
        {#if aiService.config.provider === 'gemini'}
          Gemini ({aiService.config.geminiModel || '2.5-flash'})
        {:else if aiService.config.provider === 'ollama'}
          Ollama ({aiService.config.model})
        {:else}
          Built-in Spatial Agent
        {/if}
      </span>
    </div>

    <button
      type="button"
      class="clear-history-btn"
      onclick={() => aiService.clearHistory()}
      title="Clear conversation history"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
      </svg>
      <span>Clear</span>
    </button>
  </div>

  <!-- Messages Stream -->
  <div class="chat-messages-container" bind:this={chatScrollContainer}>
    {#each aiService.messages as msg (msg.id)}
      <div class="message-wrapper" class:user={msg.role === 'user'} class:assistant={msg.role === 'assistant'}>
        <div class="message-bubble">
          <!-- Text Body -->
          <div class="message-text">
            {@html formatMarkdown(msg.content)}
          </div>

          <!-- Tool Results Cards -->
          {#if msg.toolResults && msg.toolResults.length > 0}
            <div class="tool-results-list">
              {#each msg.toolResults as res}
                <div class="tool-card" class:success={res.success} class:error={!res.success}>
                  <div class="tool-card-header">
                    <span class="tool-badge">{res.toolName}</span>
                    <span class="tool-status">{res.success ? 'Executed' : 'Failed'}</span>
                  </div>

                  {#if res.displaySummary}
                    <div class="tool-summary">{res.displaySummary}</div>
                  {/if}

                  {#if res.actions && res.actions.length > 0}
                    <div class="tool-actions-row">
                      {#each res.actions as act}
                        <button type="button" class="tool-action-btn" onclick={act.action}>
                          {act.label}
                        </button>
                      {/each}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/each}

    {#if aiService.isGenerating}
      <div class="generating-indicator">
        <span class="pulse-dot"></span>
        <span>{aiService.currentStatus || 'Processing spatial intent...'}</span>
      </div>
    {/if}
  </div>

  <!-- Quick Prompts Chips -->
  <div class="quick-prompts-bar">
    {#each quickPrompts as prompt}
      <button
        type="button"
        class="prompt-chip"
        onclick={() => handlePromptClick(prompt)}
        disabled={aiService.isGenerating}
      >
        {prompt}
      </button>
    {/each}
  </div>

  <!-- Input Form -->
  <form class="chat-input-form" onsubmit={handleSubmit}>
    <input
      type="text"
      class="chat-text-input"
      placeholder="Type a spatial request (e.g. Find 120 Swanston St)..."
      bind:value={inputValue}
      disabled={aiService.isGenerating}
    />
    <button
      type="submit"
      class="send-btn"
      disabled={!inputValue.trim() || aiService.isGenerating}
      aria-label="Send message"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="22" y1="2" x2="11" y2="13"></line>
        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
      </svg>
    </button>
  </form>
</div>

<style>
  .ai-assistant-module {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 480px;
    gap: 8px;
    box-sizing: border-box;
  }

  .assistant-top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px;
    background-color: var(--bg-card-subtle);
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    font-size: 11px;
  }

  .provider-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    color: var(--text-main);
  }

  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background-color: var(--text-muted);
  }

  .status-dot.active {
    background-color: #10b981;
    box-shadow: 0 0 6px rgba(16, 185, 129, 0.4);
  }

  .clear-history-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 10px;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .clear-history-btn:hover {
    background-color: var(--bg-subtle);
    color: var(--text-main);
  }

  .chat-messages-container {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 4px 2px;
  }

  .message-wrapper {
    display: flex;
    width: 100%;
  }

  .message-wrapper.user {
    justify-content: flex-end;
  }

  .message-wrapper.assistant {
    justify-content: flex-start;
  }

  .message-bubble {
    max-width: 90%;
    padding: 8px 11px;
    border-radius: 8px;
    font-size: 12px;
    line-height: 1.45;
  }

  .message-wrapper.user .message-bubble {
    background-color: var(--accent-primary);
    color: #ffffff;
    border-bottom-right-radius: 2px;
  }

  .message-wrapper.assistant .message-bubble {
    background-color: var(--bg-card);
    color: var(--text-main);
    border: 1px solid var(--border-color);
    border-bottom-left-radius: 2px;
  }

  .message-text :global(.chat-para) {
    margin: 0 0 5px 0;
  }

  .message-text :global(.chat-para:last-child) {
    margin-bottom: 0;
  }

  .message-text :global(.chat-bullet) {
    margin: 2px 0 2px 14px;
    list-style-type: disc;
  }

  .message-text :global(strong) {
    font-weight: 600;
  }

  .message-text :global(code) {
    background: rgba(0, 0, 0, 0.06);
    padding: 1px 4px;
    border-radius: 3px;
    font-family: monospace;
    font-size: 11px;
  }

  .message-wrapper.user .message-text :global(code) {
    background: rgba(255, 255, 255, 0.2);
    color: #ffffff;
  }

  .tool-results-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 8px;
  }

  .tool-card {
    background-color: var(--bg-card-subtle);
    border: 1px solid var(--border-subtle);
    border-left: 3px solid #0284c7;
    border-radius: 4px;
    padding: 6px 8px;
    font-size: 11px;
  }

  .tool-card.error {
    border-left-color: #ef4444;
  }

  .tool-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 3px;
  }

  .tool-badge {
    font-size: 9.5px;
    font-weight: 700;
    font-family: monospace;
    color: #0284c7;
    text-transform: uppercase;
  }

  .tool-status {
    font-size: 9px;
    color: var(--text-muted);
  }

  .tool-summary {
    color: var(--text-main);
    font-weight: 500;
    margin-bottom: 4px;
  }

  .tool-actions-row {
    display: flex;
    gap: 6px;
    margin-top: 4px;
  }

  .tool-action-btn {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    color: var(--accent-primary);
    font-size: 10px;
    font-weight: 600;
    padding: 3px 7px;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.12s, border-color 0.12s;
  }

  .tool-action-btn:hover {
    background-color: var(--accent-subtle);
    border-color: var(--accent-primary);
  }

  .generating-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--text-muted);
    padding: 4px 8px;
  }

  .pulse-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--accent-primary);
    animation: pulse 1s infinite alternate;
  }

  @keyframes pulse {
    from {
      opacity: 0.3;
      transform: scale(0.85);
    }
    to {
      opacity: 1;
      transform: scale(1.15);
    }
  }

  .quick-prompts-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 2px 0;
  }

  .prompt-chip {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    color: var(--text-muted);
    font-size: 10.5px;
    padding: 3px 7px;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.12s;
    white-space: nowrap;
  }

  .prompt-chip:hover:not(:disabled) {
    background-color: var(--accent-subtle);
    border-color: var(--accent-primary);
    color: var(--text-main);
  }

  .chat-input-form {
    display: flex;
    gap: 6px;
    margin-top: auto;
    padding-top: 4px;
  }

  .chat-text-input {
    flex: 1;
    height: 34px;
    padding: 0 10px;
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    font-size: 12px;
    color: var(--text-main);
    outline: none;
    font-family: inherit;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .chat-text-input:focus {
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 2px var(--accent-subtle);
  }

  .send-btn {
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--accent-primary);
    color: #ffffff;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background-color 0.15s, transform 0.08s;
  }

  .send-btn:hover:not(:disabled) {
    background-color: var(--accent-hover);
  }

  .send-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
