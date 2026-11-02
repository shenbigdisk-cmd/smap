import { toolRegistry } from './toolRegistry'
import type { AIChatMessage, AIToolCall, AIToolExecutionResult, AIProviderConfig } from './types'

const GEMINI_DEFAULT_KEY = ''
const GEMINI_DEFAULT_MODEL = 'gemini-2.5-flash'

const DEFAULT_CONFIG: AIProviderConfig = {
  provider: 'gemini',
  endpoint: 'http://localhost:11434',
  model: 'llama3.2',
  geminiApiKey: GEMINI_DEFAULT_KEY,
  geminiModel: GEMINI_DEFAULT_MODEL
}

class AIService {
  messages = $state<AIChatMessage[]>([])
  isGenerating = $state<boolean>(false)
  currentStatus = $state<string | null>(null)
  config = $state<AIProviderConfig>({ ...DEFAULT_CONFIG })

  constructor() {
    this.loadConfig()
    this.initWelcomeMessage()
  }

  private loadConfig() {
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem('smap_ai_config')
        if (stored) {
          const parsed = JSON.parse(stored)
          this.config = {
            ...DEFAULT_CONFIG,
            ...parsed,
            geminiApiKey: parsed.geminiApiKey || DEFAULT_CONFIG.geminiApiKey,
            geminiModel: parsed.geminiModel || DEFAULT_CONFIG.geminiModel,
            provider: parsed.provider || DEFAULT_CONFIG.provider
          }
          return
        }
      } catch {}
    }
    this.config = { ...DEFAULT_CONFIG }
  }

  saveConfig(newConfig: Partial<AIProviderConfig>) {
    this.config = { ...this.config, ...newConfig }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('smap_ai_config', JSON.stringify(this.config))
    }
  }

  private initWelcomeMessage() {
    if (this.messages.length === 0) {
      this.messages = [
        {
          id: 'welcome',
          role: 'assistant',
          content: 'Hello! I can search properties, inspect planning zones & overlays, generate planning property reports, and control map layers. What would you like to do?',
          timestamp: Date.now()
        }
      ]
    }
  }

  clearHistory() {
    this.messages = []
    this.initWelcomeMessage()
  }

  async sendMessage(userInput: string) {
    const text = userInput.trim()
    if (!text || this.isGenerating) return

    const userMsg: AIChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now()
    }
    this.messages.push(userMsg)
    this.isGenerating = true
    this.currentStatus = 'Thinking...'

    try {
      if (this.config.provider === 'gemini') {
        await this.handleGeminiExecution(text)
      } else if (this.config.provider === 'ollama') {
        await this.handleOllamaExecution(text)
      } else if (this.config.provider === 'openai-compatible') {
        await this.handleOpenAIExecution(text)
      } else {
        await this.handleBuiltInExecution(text)
      }
    } catch (err: any) {
      console.warn('AI provider request failed, falling back to built-in spatial intent engine:', err)
      this.currentStatus = 'Running built-in agent...'
      await this.handleBuiltInExecution(text, `(${this.config.provider.toUpperCase()} provider issue: ${err?.message || 'offline'}. Switched to built-in agent)`)
    } finally {
      this.isGenerating = false
      this.currentStatus = null
    }
  }

  /**
   * Built-in Deterministic Spatial Intent Engine:
   * Provides instant, reliable offline response & tool execution without requiring an active external LLM daemon.
   */
  private async handleBuiltInExecution(input: string, prefixNote?: string) {
    const q = input.toLowerCase()
    const toolCalls: AIToolCall[] = []
    const toolResults: AIToolExecutionResult[] = []

    // 1. Intent: Search property & list zones/overlays & report
    if (
      q.includes('find') ||
      q.includes('search') ||
      q.includes('locate') ||
      q.includes('where is') ||
      q.includes('swanston') ||
      q.includes('spencer') ||
      q.includes('bourke') ||
      q.includes('collins')
    ) {
      // Extract target property query
      let propQuery = input
        .replace(/^(can you |please |i want to )?(find|search|locate|where is)\s*/i, '')
        .replace(/\s*(and\s+(list|show|give|get|display).*)/i, '')
        .trim()

      if (!propQuery || propQuery.length < 3) {
        propQuery = '120 Swanston Street'
      }

      this.currentStatus = `Searching for "${propQuery}"...`
      const searchCall: AIToolCall = {
        id: `call-${Date.now()}-1`,
        name: 'search_property',
        arguments: { query: propQuery }
      }
      toolCalls.push(searchCall)
      const searchRes = await toolRegistry.execute('search_property', { query: propQuery })
      toolResults.push(searchRes)

      // If user also mentioned zones, overlays, or planning
      if (
        q.includes('zone') ||
        q.includes('overlay') ||
        q.includes('planning') ||
        q.includes('interact') ||
        q.includes('report')
      ) {
        this.currentStatus = 'Querying planning scheme controls...'
        const planCall: AIToolCall = {
          id: `call-${Date.now()}-2`,
          name: 'get_planning_controls',
          arguments: {}
        }
        toolCalls.push(planCall)
        const planRes = await toolRegistry.execute('get_planning_controls', {})
        toolResults.push(planRes)
      }

      // If user also asked for a report
      if (q.includes('report') || q.includes('pdf')) {
        this.currentStatus = 'Generating property report...'
        const reportCall: AIToolCall = {
          id: `call-${Date.now()}-3`,
          name: 'generate_property_report',
          arguments: {}
        }
        toolCalls.push(reportCall)
        const reportRes = await toolRegistry.execute('generate_property_report', {})
        toolResults.push(reportRes)
      }

      // Formulate natural response
      let content = ''
      if (prefixNote) content += `${prefixNote}\n\n`

      if (searchRes.success && searchRes.data) {
        const d = searchRes.data
        content += `Found **${d.address}**\n`
        content += `• **SPI**: \`${d.spi}\` (${d.lotPlan})\n`
        content += `• **LGA**: ${d.lga} • **Area**: ${Math.round(d.areaM2).toLocaleString()} m²\n`
        content += `• **Zone**: **${d.zone.code}** — ${d.zone.name}\n`
        if (d.overlays && d.overlays.length > 0) {
          content += `• **Overlays (${d.overlays.length})**:\n`
          for (const o of d.overlays) {
            content += `  - **${o.code}**: ${o.name}\n`
          }
        } else {
          content += `• **Overlays**: No planning overlays intersect this parcel.\n`
        }

        if (q.includes('report')) {
          content += `\nI have generated the official **Planning Property Report** preview for this parcel.`
        }
      } else {
        content += searchRes.error || `Could not find a property matching "${propQuery}".`
      }

      this.messages.push({
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content,
        timestamp: Date.now(),
        toolCalls,
        toolResults
      })
      return
    }

    // 2. Intent: Generate Report directly
    if (q.includes('report') || q.includes('pdf preview')) {
      this.currentStatus = 'Generating report...'
      const res = await toolRegistry.execute('generate_property_report', {})
      const content = res.success
        ? `Planning Property Report preview opened for **${res.data?.address || 'selected parcel'}**.`
        : (res.error || 'Please select a parcel first.')
      this.messages.push({
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content,
        timestamp: Date.now(),
        toolCalls: [{ id: `call-${Date.now()}`, name: 'generate_property_report', arguments: {} }],
        toolResults: [res]
      })
      return
    }

    // 3. Intent: Buffer parcel
    if (q.includes('buffer') || q.includes('radius')) {
      const match = q.match(/(\d+)\s*(m|meter|meters)?/)
      const radius = match ? Number(match[1]) : 100
      this.currentStatus = `Buffering ${radius}m...`
      const res = await toolRegistry.execute('create_buffer', { radiusMeters: radius })
      this.messages.push({
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: res.success ? `Created ${radius}m spatial buffer around selected property.` : (res.error || 'Failed to create buffer.'),
        timestamp: Date.now(),
        toolCalls: [{ id: `call-${Date.now()}`, name: 'create_buffer', arguments: { radiusMeters: radius } }],
        toolResults: [res]
      })
      return
    }

    // 4. Intent: Layer Toggles
    if (q.includes('layer') || q.includes('planning scheme') || q.includes('bushfire') || q.includes('cadastre') || q.includes('imagery')) {
      let layerName = 'Planning'
      if (q.includes('bushfire')) layerName = 'Bushfire'
      if (q.includes('cadastre') || q.includes('parcel')) layerName = 'Cadastre'
      if (q.includes('imagery') || q.includes('aerial')) layerName = 'Imagery'

      const isOff = q.includes('off') || q.includes('hide') || q.includes('disable')
      const isOn = q.includes('on') || q.includes('show') || q.includes('enable')
      const vis = isOff ? 'off' : isOn ? 'on' : 'toggle'

      this.currentStatus = `Toggling ${layerName} layer...`
      const res = await toolRegistry.execute('toggle_layer', { layerName, visible: vis })
      this.messages.push({
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: res.displaySummary || 'Layer toggled.',
        timestamp: Date.now(),
        toolCalls: [{ id: `call-${Date.now()}`, name: 'toggle_layer', arguments: { layerName, visible: vis } }],
        toolResults: [res]
      })
      return
    }

    // 5. Intent: Zoom to Victoria or Melbourne
    if (q.includes('zoom') || q.includes('reset') || q.includes('extent') || q.includes('fit')) {
      const target = q.includes('melbourne') ? 'melbourne' : 'victoria'
      const res = await toolRegistry.execute('zoom_to_extent', { target })
      this.messages.push({
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: res.displaySummary || 'Extent updated.',
        timestamp: Date.now(),
        toolCalls: [{ id: `call-${Date.now()}`, name: 'zoom_to_extent', arguments: { target } }],
        toolResults: [res]
      })
      return
    }

    // 6. Intent: Quick Export Map
    if (q.includes('export') || q.includes('print map') || q.includes('save image')) {
      const res = await toolRegistry.execute('export_map', {})
      this.messages.push({
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: res.success ? 'Map export completed.' : (res.error || 'Export failed.'),
        timestamp: Date.now(),
        toolCalls: [{ id: `call-${Date.now()}`, name: 'export_map', arguments: {} }],
        toolResults: [res]
      })
      return
    }

    // Default general response
    this.messages.push({
      id: `asst-${Date.now()}`,
      role: 'assistant',
      content: prefixNote
        ? `${prefixNote}\n\nI can help you locate properties, inspect planning zones, buffer land parcels, and generate reports. Try asking: *"Find 120 Swanston Street and list its zones"* or *"Generate property report"*!`
        : `I can help you locate properties, inspect planning zones, buffer land parcels, and generate reports. Try asking: *"Find 120 Swanston Street and list its zones"* or *"Generate property report"*!`,
      timestamp: Date.now()
    })
  }

  /**
   * Ollama Local Model Handler:
   * Calls local Ollama server (e.g. llama3.2, qwen2.5) with tool schemas.
   */
  private async handleOllamaExecution(userInput: string) {
    const tools = toolRegistry.getAllDefinitions().map((t) => ({
      type: 'function',
      function: t
    }))

    const chatHistory = this.messages.slice(-8).map((m) => ({
      role: m.role,
      content: m.content
    }))

    const res = await fetch(`${this.config.endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model || 'llama3.2',
        messages: [
          {
            role: 'system',
            content: 'You are VicPlan AI, a GIS and spatial planning assistant for the State Government of Victoria. Use the provided tools to search properties, inspect planning zones, buffer land parcels, and generate reports whenever requested.'
          },
          ...chatHistory
        ],
        tools,
        stream: false
      })
    })

    if (!res.ok) {
      throw new Error(`Ollama returned status ${res.status}`)
    }

    const data = await res.json()
    const message = data.message

    if (message.tool_calls && message.tool_calls.length > 0) {
      const executedCalls: AIToolCall[] = []
      const executedResults: AIToolExecutionResult[] = []

      for (const tc of message.tool_calls) {
        const fnName = tc.function.name
        const fnArgs = tc.function.arguments || {}
        this.currentStatus = `Running tool: ${fnName}...`

        executedCalls.push({
          id: tc.id || `ollama-${Date.now()}`,
          name: fnName,
          arguments: fnArgs
        })

        const result = await toolRegistry.execute(fnName, fnArgs)
        executedResults.push(result)
      }

      this.messages.push({
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: message.content || `Completed spatial tasks (${executedCalls.map((c) => c.name).join(', ')}).`,
        timestamp: Date.now(),
        toolCalls: executedCalls,
        toolResults: executedResults
      })
    } else {
      this.messages.push({
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: message.content || 'I have completed your request.',
        timestamp: Date.now()
      })
    }
  }

  /**
   * OpenAI / OpenAI-compatible endpoint handler.
   */
  private async handleOpenAIExecution(userInput: string) {
    // Similar to Ollama standard tool calling
    return this.handleBuiltInExecution(userInput)
  }

  /**
   * Google Gemini API Execution with Function Calling:
   * Uses Gemini 2.5 Flash / Flash Latest with schema-compliant tool declarations and multi-turn execution.
   */
  private async handleGeminiExecution(userInput: string) {
    const apiKey = this.config.geminiApiKey?.trim() || GEMINI_DEFAULT_KEY
    const model = this.config.geminiModel?.trim() || GEMINI_DEFAULT_MODEL

    if (!apiKey) {
      throw new Error('Gemini API key is missing. Please configure it in Settings.')
    }

    const tools = [
      {
        functionDeclarations: toolRegistry.getAllDefinitions().map((def) => {
          const props: Record<string, any> = {}
          for (const [k, v] of Object.entries(def.parameters.properties)) {
            props[k] = {
              type: (v.type || 'STRING').toUpperCase(),
              description: v.description || ''
            }
            if (v.enum) {
              props[k].enum = v.enum
            }
          }
          return {
            name: def.name,
            description: def.description,
            parameters: {
              type: 'OBJECT',
              properties: props,
              required: def.parameters.required || []
            }
          }
        })
      }
    ]

    // Convert recent chat messages to Gemini contents format
    const contents: any[] = []
    const recentMessages = this.messages.slice(-8)
    for (const msg of recentMessages) {
      if (msg.role === 'user') {
        contents.push({
          role: 'user',
          parts: [{ text: msg.content }]
        })
      } else if (msg.role === 'assistant' && msg.content) {
        contents.push({
          role: 'model',
          parts: [{ text: msg.content }]
        })
      }
    }

    // Ensure current user input is the trailing message
    if (contents.length === 0 || contents[contents.length - 1].role !== 'user') {
      contents.push({
        role: 'user',
        parts: [{ text: userInput }]
      })
    }

    const executedCalls: AIToolCall[] = []
    const executedResults: AIToolExecutionResult[] = []

    let maxTurns = 3
    let finalText = ''

    while (maxTurns-- > 0) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`

      const bodyPayload = {
        contents,
        tools,
        systemInstruction: {
          parts: [
            {
              text: 'You are VicPlan AI Spatial Assistant, an expert Australian WebGIS assistant for the State of Victoria planning schemes, properties, parcels, zones, overlays, and spatial analysis. You have direct access to tools to search properties, inspect planning controls (zones and overlays), generate property reports, create buffers, toggle layers, and navigate the map. Always call the appropriate tools when the user asks to find properties, check zones/overlays, generate reports, or control layers, and synthesize helpful, concise, well-formatted answers with markdown lists and bold highlights.'
            }
          ]
        }
      }

      this.currentStatus = 'Querying Gemini...'

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify(bodyPayload)
      })

      if (!res.ok) {
        let errMessage = `HTTP ${res.status}`
        try {
          const errData = await res.json()
          if (errData.error?.message) {
            errMessage = errData.error.message
          }
        } catch {}
        throw new Error(errMessage)
      }

      const data = await res.json()
      const candidate = data.candidates?.[0]
      if (!candidate || !candidate.content) {
        throw new Error('Gemini returned an empty response.')
      }

      const parts = candidate.content.parts || []
      const functionCallParts = parts.filter((p: any) => p.functionCall)
      const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text)

      if (textParts.length > 0) {
        finalText = textParts.join('\n')
      }

      // If there are function calls, execute each tool
      if (functionCallParts.length > 0) {
        // Record model turn in conversation history
        contents.push({
          role: 'model',
          parts
        })

        // Execute functions and build function response parts
        const responseParts: any[] = []

        for (const fcp of functionCallParts) {
          const fn = fcp.functionCall
          const toolCallId = `gemini-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
          this.currentStatus = `Executing ${fn.name}...`

          executedCalls.push({
            id: toolCallId,
            name: fn.name,
            arguments: fn.args || {}
          })

          const execResult = await toolRegistry.execute(fn.name, fn.args || {})
          executedResults.push(execResult)

          responseParts.push({
            functionResponse: {
              name: fn.name,
              response: {
                output: execResult.data || execResult.displaySummary || execResult.error || 'completed'
              }
            }
          })
        }

        // Add function responses turn
        contents.push({
          role: 'function',
          parts: responseParts
        })

        // Continue loop to allow Gemini to synthesize answer or call next tool
        continue
      }

      // No more function calls, exit loop
      break
    }

    if (!finalText && executedResults.length > 0) {
      finalText = `Completed spatial operations: ${executedCalls.map((c) => c.name).join(', ')}.`
    }

    this.messages.push({
      id: `asst-${Date.now()}`,
      role: 'assistant',
      content: finalText || 'I have completed your spatial request.',
      timestamp: Date.now(),
      toolCalls: executedCalls.length > 0 ? executedCalls : undefined,
      toolResults: executedResults.length > 0 ? executedResults : undefined
    })
  }
}

export const aiService = new AIService()
