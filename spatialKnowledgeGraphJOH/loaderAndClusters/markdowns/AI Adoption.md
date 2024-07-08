public:: true

- ## The Gap
  id:: 659fe0be-a52a-42ef-8f50-73695a802945
	- McKinsey identified in 2022 that companies with a 5 year AI roadmap would likely pull ahead. [They called this "The Gap"](https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai-in-2022-and-a-half-decade-in-review#gap)
	- Hindsight shows us that this was correct. Those companies feel somewhat unassailable, but the nature of the research publishing environment, and pace of progress, means there are plenty of opportunities.
	- ### Ways to close The Gap
		- [Daily Papers Hugging Face](https://huggingface.co/papers)  << you can do worse than this to ambiently learn
- ## Custom Gen AI models in business
  id:: 659a9231-4d21-415e-8b07-25b215e6b712
	- ![image.png](../assets/image_1704997279791_0.png){:width 500}
	- ### **DO play with tools**
		- Use the tools that come free with where you already keep your data.
		- Start to sort out your data. Learn it's structure, and whether it's useful to optimise it.
		- High quality data gives high quality outcomes.
		- Use the paid and private version of [RunDiffusion](https://app.rundiffusion.com/) to start to play with the open tooling. [[Fooocus]] is new and very accessible and on that platform with **everything** else of value.
		- See if there's something on the market that is trustable when your data and product are ready, don't spread data about too much.
		- Do check if this is worth it. Get an expert opinion. Bloomberg spent around $20M on a model based on their financial data only to find that GPT4 [still beats it](https://arxiv.org/pdf/2305.05862.pdf).
		- Think about integrating the open tooling into your product development, consider the software licenses. Take **some** legal advice.
	- ### Avoid the [Secret Cyborg](https://www.oneusefulthing.org/p/reshaping-the-tree-rebuilding-organizations).
		- [twitter link to the render loading below](https://twitter.com/emollick/status/1775176524653642164){{twitter https://twitter.com/emollick/status/1775176524653642164}}
		- Acknowledge that employees are already using AI at work, often without approval. Over half of people using AI at work are doing so without telling their bosses. [Microsoft put this number at a staggering 75%](https://www.microsoft.com/en-us/worklab/work-trend-index/ai-at-work-is-here-now-comes-the-hard-part/) [[Microsoft Work Trends Impact 2024]]
			- | Statistic | Value |
			  |-----------|-------|
			  | Percentage of global knowledge workers using generative AI | 75% |
			  | Percentage of AI users who say it helps them save time | 90% |
			  | Percentage of AI users who say it helps them focus on their most important work | 85% |
			  | Percentage of AI users who say it helps them be more creative | 84% |
			  | Percentage of AI users who say it helps them enjoy their work more | 83% |
			  | Percentage of AI users who are bringing their own AI tools to work (BYOAI) | 78% |
			  | Percentage of AI users at small and medium-sized companies who are bringing their own AI to work | 80% |
			  | Percentage of AI users reluctant to admit using AI for their most important tasks | 52% |
			  | Percentage of leaders who would rather hire a less experienced candidate with AI skills than a more experienced candidate without them | 71% |
			  | Percentage of leaders who say early-in-career talent will be given greater responsibilities with AI | 77% |
		- Create a culture of exploration and openness around AI use. Encourage employees to share how they are using AI to assist their work.
		- Completely rethink and redesign work processes around AI capabilities, rather than just using AI to automate existing processes. Cut down the org chart and regrow it for AI.
		- Let teams develop their own methods for incorporating AI as an "intelligence" that adds to processes. Manage AI more like additional team members than external IT solutions.
		- Align incentives and provide clear guidelines so employees feel empowered to ethically experiment with AI.
		- Build for the rapidly evolving future of AI, not just today's models. Organizational change takes time, so consider future AI capabilities.
		- Act quickly
		- organizations that wait too long to experiment and adapt processes for AI efficiency gains will fall behind. Provide guidelines for short-term experimentation vs slow top-down solutions.
		- Realize there are only two ways to react to exponential AI change
		- too early or too late. The capabilities are increasing rapidly, so it's better to start adapting sooner than later.
	- ### Custom models
		- AI/ML is the high interest rate credit card of product development
		- The likely emerging trend for [[Large language models]] is small models optimised for your data, with API collaboration and support from a big foundational model.
		- Think [[Mistral]], replacing one of the experts with YOUR expert
		- This is kinda true for image and video too, in that you can blend workflows between powerful online systems and more nuanced personal models. (imagebashing).
		- ### How to train models?
			- Smaller data and workflows:
				- Do it yourself with suitable cloud hardware. This applies to all Gen AI.
				- [[LoRA]] are very accessible. Basically nudge the existing models for your requirements.
				- Low legal peril.
			- Medium scale problems:
				- Own the skills you need for your data / product problem.
				- There's a lot of guidance from the major players like Microsoft
				  [Develop Generative AI solutions with Azure OpenAI Service
			- Training | Microsoft Learn](https://learn.microsoft.com/en-us/training/paths/develop-ai-solutions-azure-openai/)
				- Get in a private consultant like me and onboard the skills for your product / data problem
				- This is the same model a the hub and spokes needed for larger models
			- Large / complex product and data challenges:
				- The industry is set up around the necessary datacentres. These are centres of excellence, commercial labs, Universities, etc.
				- Engage commercial data team who get you up to speed and train your model on their hardware.
					- Salford Uni will doubtless have a strategy with Azure.
					- [Deep Learning & Artificial Intelligence SCAN Business | SCAN UK](https://www.scan.co.uk/business/deep-learning)
					- [Europe’s largest private AI lab | Silo AI](https://www.silo.ai/)
					- [Advanced Solutions Lab Google Cloud](https://cloud.google.com/asl/)
					- Hartree?
		- ### Roll out in the cloud.
		- Play with [Runpod](https://www.runpod.io/). There's some great [YouTube tutorials](https://www.youtube.com/watch?v=WjiX3lCnwUI)
		- I use a [Lambda Labs H100](https://lambdalabs.com/).
		- Unless you really know what you're doing, or you have a LOT of data, I wouldn't buy GPUs and attempt the inferencing side yourself
		- ## In Politics.
			- [An AI Bot Is (Sort of) Running for Mayor in Wyoming | WIRED](https://www.wired.com/story/ai-bot-running-for-mayor-wyoming/)
			- [There’s an AI Candidate Running for Parliament in the UK | WIRED](https://www.wired.com/story/ai-candidate-running-for-parliament-uk/)
			- [[Politics, Law, Privacy]]
- This is a [[presentation]] slide and the next slide is [[State of the art in AI]]