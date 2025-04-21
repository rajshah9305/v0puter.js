"use client"

import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Loader2, Send, AlertCircle, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"

// Define available models based on Puter.js documentation
const AI_MODELS = [
  { id: "gpt-4o", name: "GPT-4o" },
  { id: "claude-3-7-sonnet", name: "Claude 3.7 Sonnet" },
  { id: "llama-3-70b", name: "Llama 3 70B" },
  { id: "mistral-large", name: "Mistral Large" },
  { id: "gemini-pro", name: "Gemini Pro" },
]

interface Message {
  role: "user" | "assistant" | "system"
  content: string
}

export default function Home() {
  const [selectedModel, setSelectedModel] = useState<string>(AI_MODELS[0].id)
  const [prompt, setPrompt] = useState<string>("")
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [scriptStatus, setScriptStatus] = useState<"loading" | "loaded" | "error">("loading")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const puterRef = useRef<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [debugMode, setDebugMode] = useState<boolean>(false)

  // Load Puter.js script
  useEffect(() => {
    const script = document.createElement("script")
    script.src = "https://js.puter.com/v2/"
    script.async = true

    // Set a timeout to detect if script loading takes too long
    const timeoutId = setTimeout(() => {
      if (scriptStatus === "loading") {
        setScriptStatus("error")
        setErrorMessage("Puter.js script loading timed out. Please check your connection and try again.")
      }
    }, 10000) // 10 seconds timeout

    script.onload = () => {
      clearTimeout(timeoutId)
      setScriptStatus("loaded")

      // Check if puter object exists and store it in ref
      if (window.puter) {
        puterRef.current = window.puter
        console.log("Puter.js loaded successfully")

        // Add a welcome message
        setMessages([
          {
            role: "system",
            content: "Welcome! Select an AI model and start chatting. The models are powered by Puter.js.",
          },
        ])
      } else {
        setScriptStatus("error")
        setErrorMessage("Puter.js loaded but the puter object is not available.")
      }
    }

    script.onerror = () => {
      clearTimeout(timeoutId)
      setScriptStatus("error")
      setErrorMessage("Failed to load Puter.js script. Please check your connection and try again.")
    }

    document.body.appendChild(script)

    return () => {
      clearTimeout(timeoutId)
      if (document.body.contains(script)) {
        document.body.removeChild(script)
      }
    }
  }, [])

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Extract text content from Puter.js response object
  const extractTextFromResponse = (response: any): string => {
    if (debugMode) {
      console.log("Extracting text from response:", response)
    }

    // Handle string responses
    if (typeof response === "string") {
      try {
        // Check if the string is a JSON string with type/text structure
        const parsed = JSON.parse(response)
        if (parsed && Array.isArray(parsed)) {
          // Handle array of message objects
          return parsed
            .map((item) => {
              if (item && typeof item === "object" && "text" in item) {
                return item.text
              }
              return ""
            })
            .filter(Boolean)
            .join("\n")
        } else if (parsed && typeof parsed === "object") {
          // Handle single message object
          if ("text" in parsed) {
            return parsed.text
          }
        }
      } catch (e) {
        // Not a JSON string, return as is
        return response
      }
      return response
    }

    // Handle null or undefined
    if (!response) {
      return "No response received"
    }

    try {
      // Handle array responses (like in the screenshot)
      if (Array.isArray(response)) {
        return response
          .map((item) => {
            if (item && typeof item === "object" && "text" in item) {
              return item.text
            }
            return ""
          })
          .filter(Boolean)
          .join("\n")
      }

      // Try to extract text from common response structures
      if (response.message?.content?.text) {
        return response.message.content.text
      }

      if (response.text) {
        return response.text
      }

      if (response.content) {
        return typeof response.content === "string" ? response.content : JSON.stringify(response.content)
      }

      if (response.message?.content) {
        if (typeof response.message.content === "string") {
          return response.message.content
        }

        // Handle array of content objects
        if (Array.isArray(response.message.content)) {
          return response.message.content
            .map((item) => {
              if (item && typeof item === "object" && "text" in item) {
                return item.text
              }
              return ""
            })
            .filter(Boolean)
            .join("\n")
        }

        return JSON.stringify(response.message.content)
      }

      // If response has a toString method that's not the default Object.toString
      if (typeof response.toString === "function" && response.toString !== Object.prototype.toString) {
        const stringValue = response.toString()
        if (stringValue !== "[object Object]") {
          return stringValue
        }
      }

      // Last resort: stringify the entire response
      return JSON.stringify(response)
    } catch (error) {
      console.error("Error extracting text from response:", error)
      return "Error processing response"
    }
  }

  // Use the correct chat method based on Puter.js documentation
  const callPuterChat = async (promptText: string, model: string) => {
    try {
      // Make sure puter is available
      if (!puterRef.current) {
        throw new Error("Puter.js is not loaded")
      }

      if (debugMode) {
        console.log("Calling Puter AI chat with model:", model)
      }

      // Check if ai property exists
      if (!puterRef.current.ai) {
        console.error("puter.ai is not available")
        return "Sorry, the AI service is not available. This might be due to Puter.js API changes."
      }

      // Check if chat method exists
      if (typeof puterRef.current.ai.chat !== "function") {
        console.error("puter.ai.chat is not a function")
        return "Sorry, the chat method is not available in this version of Puter.js."
      }

      // According to docs, the chat method is the correct one to use
      const response = await puterRef.current.ai.chat(promptText, { model })

      if (debugMode) {
        console.log("Chat response:", response)
      }

      // Extract and return the text content from the response
      return extractTextFromResponse(response)
    } catch (error) {
      console.error("Error in callPuterChat:", error)
      throw error
    }
  }

  // Mock response for testing when Puter.js fails
  const getMockResponse = (prompt: string) => {
    if (prompt.toLowerCase().includes("hello") || prompt.toLowerCase().includes("hi")) {
      return "Hello! I'm a mock AI assistant. Puter.js isn't working correctly, but I can still chat with you in a limited way."
    }

    if (prompt.toLowerCase().includes("help")) {
      return "I'm currently running in mock mode because Puter.js isn't working correctly. Try checking the console for more information about the error."
    }

    return "I'm a mock AI assistant. The Puter.js API seems to be unavailable or has changed. This is a fallback response."
  }

  const handleSubmit = async () => {
    if (!prompt.trim() || isLoading) return

    try {
      setIsLoading(true)
      setErrorMessage(null)

      // Add user message
      const userMessage: Message = { role: "user", content: prompt }
      setMessages((prev) => [...prev, userMessage])
      const currentPrompt = prompt
      setPrompt("")

      let responseText: string

      // Try to use Puter.js if it's loaded
      if (scriptStatus === "loaded" && puterRef.current?.ai) {
        try {
          responseText = await callPuterChat(currentPrompt, selectedModel)
        } catch (puterError) {
          console.error("Error calling Puter.js:", puterError)
          // Fall back to mock response
          responseText = getMockResponse(currentPrompt)
        }
      } else {
        // Use mock response if Puter.js isn't available
        responseText = getMockResponse(currentPrompt)
      }

      // Add assistant message with the extracted text
      const assistantMessage: Message = {
        role: "assistant",
        content: responseText,
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error("Error in handleSubmit:", error)
      setErrorMessage(error instanceof Error ? error.message : "An unknown error occurred")

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, there was an error processing your request. Please try again.",
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-24">
      <div className="w-full max-w-3xl flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <h1 className="text-3xl font-bold">AI Model Selector</h1>
          <div className="flex items-center gap-2 mt-2 md:mt-0">
            <Link
              href="https://docs.puter.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm flex items-center gap-1 hover:underline"
            >
              Puter.js Docs <ExternalLink className="h-3 w-3" />
            </Link>
            <Button variant="outline" size="sm" onClick={() => setDebugMode(!debugMode)} className="text-xs">
              {debugMode ? "Disable Debug" : "Enable Debug"}
            </Button>
          </div>
        </div>

        {errorMessage && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Select AI Model</span>
              {scriptStatus === "loading" && (
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading Puter.js...
                </div>
              )}
              {scriptStatus === "error" && (
                <div className="text-sm text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Failed to load Puter.js
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {AI_MODELS.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {debugMode && (
              <div className="mt-4 p-2 bg-muted rounded-md text-xs font-mono overflow-auto max-h-32">
                <p>Script Status: {scriptStatus}</p>
                <p>Selected Model: {selectedModel}</p>
                <p>Puter.js Available: {puterRef.current ? "Yes" : "No"}</p>
                {puterRef.current?.ai && (
                  <p>
                    AI Methods:{" "}
                    {Object.keys(puterRef.current.ai)
                      .filter((key) => typeof puterRef.current.ai[key] === "function")
                      .join(", ")}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex-1">
          <CardHeader>
            <CardTitle>Chat</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 h-[400px] overflow-y-auto p-2 border rounded-md">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Select a model and start chatting
                </div>
              ) : (
                messages.map((message, index) => (
                  <div
                    key={index}
                    className={cn(
                      "p-3 rounded-lg max-w-[80%]",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground self-end"
                        : message.role === "system"
                          ? "bg-secondary self-start"
                          : "bg-muted self-start",
                    )}
                  >
                    {message.content}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="flex gap-2">
              <Textarea
                placeholder="Type your message here..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit()
                  }
                }}
                className="flex-1"
                disabled={isLoading}
              />
              <Button onClick={handleSubmit} disabled={isLoading || !prompt.trim()} className="self-end">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground">
            {scriptStatus === "loaded"
              ? "Puter.js loaded successfully"
              : scriptStatus === "loading"
                ? "Loading Puter.js..."
                : "Failed to load Puter.js. Using mock responses."}
          </CardFooter>
        </Card>
      </div>
    </main>
  )
}

// Add this type declaration at the end of the file
declare global {
  interface Window {
    puter?: any
  }
}
