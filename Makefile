.PHONY: build deploy

build:
	sam build

deploy: build
	sam deploy \
	  --no-confirm-changeset \
		--parameter-overrides \
			"AIModel=$${AI_MODEL:-google:gemini-2.5-flash}" \
			"GoogleApiKey=$${GOOGLE_GENERATIVE_AI_API_KEY}" \
			"OpenAIApiKey=$${OPENAI_API_KEY}" \
			"AnthropicApiKey=$${ANTHROPIC_API_KEY}" \
			"TavilyApiKey=$${TAVILY_API_KEY}" \
			"MemoryPromptMaxFacts=$${MEMORY_PROMPT_MAX_FACTS:-4}" \
			"MemoryPromptMaxEpisodes=$${MEMORY_PROMPT_MAX_EPISODES:-1}" \
			"MemoryPromptMaxChars=$${MEMORY_PROMPT_MAX_CHARS:-1000}"
