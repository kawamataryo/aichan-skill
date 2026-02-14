.PHONY: build deploy

build:
	sam build

deploy: build
	sam deploy \
	  --no-confirm-changeset \
		--parameter-overrides \
			"GoogleApiKey=$${GOOGLE_GENERATIVE_AI_API_KEY}" \
			"OpenAIApiKey=$${OPENAI_API_KEY}" \
			"AnthropicApiKey=$${ANTHROPIC_API_KEY}" \
			"TavilyApiKey=$${TAVILY_API_KEY}"
