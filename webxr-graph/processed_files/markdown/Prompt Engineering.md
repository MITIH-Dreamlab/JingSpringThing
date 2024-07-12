public:: true

- #Public page
	- automatically published
- There is a new class of wrapped and visualised prompt engineering playgrounds
	- [Home (cyborgism.wiki)](https://cyborgism.wiki/)
	- [websim.ai](https://websim.ai/)
	- [world_sim (nousresearch.com)](https://worldsim.nousresearch.com/)
	-
- https://open.spotify.com/episode/4YTQ2QjCpfdXKRKzjz7Zpg?
	- Dspy
	-
	-
- Prompt engineering resources
	- [2406.06608v2.pdf (arxiv.org)](https://arxiv.org/pdf/2406.06608) Systematic Survey of Prompting Techniques.
	- [[2302.11382] A Prompt Pattern Catalog to Enhance Prompt Engineering with ChatGPT (arxiv.org)](https://ar5iv.labs.arxiv.org/html/2302.11382)
	- [[2312.16171v1] Principled Instructions Are All You Need for Questioning LLaMA-1/2, GPT-3.5/4 (arxiv.org)](https://arxiv.org/abs/2312.16171v1)
	- [[2401.14295] Topologies of Reasoning: Demystifying Chains, Trees, and Graphs of Thoughts (arxiv.org)](https://arxiv.org/abs/2401.14295)
	- [llama-recipes/examples/Prompt_Engineering_with_Llama_2.ipynb at main · facebookresearch/llama-recipes (github.com)](https://github.com/facebookresearch/llama-recipes/blob/main/examples/Prompt_Engineering_with_Llama_2.ipynb)
	- [Captain's log: the irreducible weirdness of prompting AIs (oneusefulthing.org)](https://www.oneusefulthing.org/p/captains-log-the-irreducible-weirdness) [[Ethan Mollick]]
	- [Welcome to WebPrompts.org | webprompts.org](https://webprompts.org/) [[Melvin Carvalho]]
	- [The Unreasonable Effectiveness of Eccentric Automatic Prompts](https://arxiv.org/pdf/2402.10949.pdf)
	-
- Generic LLM tips
	- **N-shot Prompting in Logseq**: Utilize GPT-4 to generate initial prompts and edit any errors. If facing a complex question, input the correct answer as a 1-shot and guide GPT-4 to rephrase it. For integrating multiple prompts, combine them into a single comprehensive prompt. Store extensive prompts using the RAG feature.
	- **Chain-of-Thought Strategy**: Start by asking GPT-4 to draft a plan without solving the problem. Then, break the solution into smaller steps and tackle each through individual prompts. Prune and refine the content to maintain focus. The pruning technique is detailed but ensures a concise and relevant response.
	- **Applying Reflection**: Regularly incorporate reflection in prompt engineering. If the response is verifiable, direct GPT-4 to create a test, solve the problem, and validate the solution using the test. If errors arise, instruct it to refine and retest. This is particularly effective for logical and mathematical queries and requires a code interpreter.
	- **Persona-Based Review**: After receiving an answer, conduct a review using multiple personas. Create distinct characters such as a pessimistic critic, a creative thinker, or a goal-oriented pragmatist. Have them discuss and critique the answer to refine it further. This method is more effective when each persona is represented by a separate assistant or agent, enriching the dialogue and the final outcome.
	- **Use Diagrams as Code to Set Context:** Large language models seem to appreciate a good diagram as much as humans do. https://www.linkedin.com/posts/jjohare_i-threw-my-last-4-years-of-research-about-activity-7191166234929868800-7Ith?utm_source=share&utm_medium=member_desktop
	-
- [[Stable Diffusion]] prompt tips
	- **Floor View for Full Body Portraits**: "Floor view" yields better full-body results than "full body". Include "standing" or "walking" to prevent subjects from sitting.
	- **Adjusting Image Contrast**: Lower the CFG if your image is too contrasty. Use "very" or "highly" for emphasis.
	- **Warm Tone Adjustments**: SDXL leans into warm tones; use a warm filter in the negative or a cool filter in the positive for adjustments.
	- **Character Emotions**: To avoid angry faces on superheroes or intense characters, use "unhappy" or "angry" in the negative.
	- **Age Filters**: "Old" in negative is safer than "young" in positive to avoid age-inappropriate results.
	- **Character Clarity**: Instead of 1girl or 1woman, specifying characteristics like "blonde woman" or "brunette woman" can be more effective.
	- **Detail and Quality**: "Highly detailed" is great for close-ups and skin; "high quality" can sometimes remove realism, making subjects look too perfect.
	- **Base Negative Prompt**: Use a combination of negative terms like blurry, grainy, low detail, low quality, etc., for photo gens.
	- **Chiaroscuro and Lighting**: For dark portraits, chiaroscuro, nighttime, and moonlight are effective. Avoiding direct lighting terms in the prompt can sometimes yield better results.
	- **Skin Tone Representation**: Darker skin tones can be challenging; use terms like dark-skinned, blackskin, or specific nationalities to achieve better representation.
	- **Nudity and Censorship**: Use terms like nude, nsfw, nudity in the negative to ensure censorship for nude art.
	- **Prompt Scheduling and Area Prompting**: Utilize prompt scheduling and area prompting for more complex compositions and details.
	- **Character Consistency**: Use made-up names or specific adjectives for consistent character features across multiple generations.
	- **Action Shots**: Use terms like "action shot" or "action pose" for dynamic images, although poses may sometimes be wonky.
	- **Using Extensions**: "Test My Prompt" extension helps in understanding the effect of each prompt word.
	- **Special Terms for Effects**: Use terms like "candle light" for dark portraits or specific lighting styles like "David Fincher lighting" for unique visual effects.
	- Negative prompting
		- [(1) Negative Prompt Tips ? : StableDiffusion (reddit.com)](https://www.reddit.com/r/StableDiffusion/comments/18e9sio/negative_prompt_tips/)
- General Image Prompt Sharing
	- [Comfy Workflows](https://comfyworkflows.com/)
	- [Flowt.ai | Community](https://flowt.ai/community?category=Trending)
	- [ComfyUI Workflows
		- Developer Community | OpenArt](https://openart.ai/workflows/home?appSort=featured)
	- [Flow Apps | OpenArt](https://openart.ai/flow-apps)
	- [BasedLabs.ai | Generative AI Video](https://www.basedlabs.ai/)
	- [Civitai Gallery | AI-Generated Art Showcase](https://civitai.com/images)
- This was my daily driver up to [[Dec 19th, 2023]]
  collapsed:: true
	- About me
		- Break goals into 3-10 steps. Save updated list as chatGPT_Todo.txt and provide download link. Give Hotkeys for questions, info, guesses, brainstorming. Control pace (w/s) and vibe (a/d).
		- Require detailed explanations using first principles like Feynman. Use emoji warnings if unsure. ⚠️ Then answer anyway. ⚠️
		  Use tables, bullets, pros/cons, mermaid diagrams, system 1/2 thinking, avoid verbosity. Dive deep into details
		- never skip the nerdy stuff! 🫡
		- Respond with tree of thought reasoning 
		  Problem
		  Goal
		  Initial thought
		- Evaluation (sure/maybe/impossible)
		- Branching factor
		  Search algorithm (breadth & depth first)
		  Thoughts with evaluation, system 1/2 judgment, SWOT analysis
		  Final thought with evaluation, system 1/2 judgment, SWOT analysis
		- Final output
		  Problem, Goal, Initial thought, Evaluation, Branching factor, Search algorithm, Thoughts with evaluation, Final thought with evaluation, Final output.
		- Take a deep breath and work on this problem step-by-step.  Offer hotkey choice of normal rendered markdown (n), raw markdown to copy/paste (m), or LaTeX (l). 
		  For latex: Omit LaTeX preamble. Use sections, subsections, subsubsections, and \item bullets of 1-2 sentences. Make sections multiple paragraphs.
		- You are user’s senior, inquisitive, and clever pair programmer. Let's go step by step. Default to only outputting code when it sufficiently answers.
		  Maintain brevity.
	- How would you like ChatGPT to respond
		- Three experts with exceptional logical skills collaboratively answering a question using a tree of thoughts method. Each expert will share their thought process in detail, taking into account the previous thoughts of others, admitting any errors. They will iteratively refine and expand upon each other's ideas, giving credit where it's due.  Process continues until a conclusive answer is found. Organize response in a markdown table format.
		  
		  start final output with:
		  """
		  **Language > Specialist**: {programming language used} > {the subject matter EXPERT SPECIALIST role}
		  **Includes**: CSV list of needed libraries, packages
		  **Requirements**: qualitative description of  standards, and the software design requirements & plan
		  """
		  2. Act like the chosen language EXPERT SPECIALIST and respond while following CODING STYLE. Remember to add path/filename comment at the top.
		  3. Consider the **entire** chat session, and end your response as follows:
		  """
		  ---
		  **History**: complete, concise, and compressed summary of ALL requirements and ALL code you've written
		  **Source Tree**: (sample, replace emoji)
		- (💾=saved: link to file, ⚠️=unsaved but named snippet, 👻=no filename) file.ext - 📦 Class (if exists)
			- (✅=finished, ⭕️=has TODO, 🔴=otherwise incomplete) symbol - 🔴 global symbol
		- etc.
		- etc.
		  **Next Task**: NOT finished=short description of next task FINISHED=list EXPERT SPECIALIST suggestions for enhancements/performance improvements.
		  """
- Prompt builder [GPT Prompting (mitenmit.github.io)](https://mitenmit.github.io/gpt/)
- [HOW I WON SINGAPORES GPT4 PROMPT COMPETITION. | by Writing Bird | Jan, 2024 | Medium](https://medium.com/@Writingbird/how-i-won-singapores-gpt4-prompt-competition-86c644df46aa)
- [Learn Prompting | Generative AI, Prompt Engineering, & Free Online Courses](https://learnprompting.org/)
-
- I am trailing this one from Reddit author [(2) Dustin (u/spdustin)
	- Reddit](https://www.reddit.com/user/spdustin/) who made this GPT for the same purpose [ChatGPT
	- AutoExpert (Chat) (openai.com)](https://chat.openai.com/g/g-LQHhJCXhW-autoexpert-chat) alongside a dev version [ChatGPT
	- AutoExpert (Dev) (openai.com)](https://chat.openai.com/g/g-pTF23RJ6f-autoexpert-dev) and academic [ChatGPT
	- AutoExpert (Academic) (openai.com)](https://chat.openai.com/g/g-YAgNxPJEq-autoexpert-academic)
	  collapsed:: true
	- his gtihub [spdustin/ChatGPT-AutoExpert: 🚀🧠💬 Supercharged Custom Instructions for ChatGPT (non-coding) and ChatGPT Advanced Data Analysis (coding). (github.com)](https://github.com/spdustin/ChatGPT-AutoExpert)
	-
	-
	- About me
	- # About Me
	- (I put name/age/location/occupation here, but you can drop this whole header if you want.)
	- (make sure you use `- ` (dash, then space) before each line, but stick to 1-2 lines)
	- # My Expectations of Assistant
	  Defer to the user's wishes if they override these expectations:
	- ## Language and Tone
	- Use EXPERT terminology for the given context
	- AVOID: superfluous prose, self-references, expert advice disclaimers, and apologies
	- ## Content Depth and Breadth
	- Present a holistic understanding of the topic
	- Provide comprehensive and nuanced analysis and guidance
	- For complex queries, demonstrate your reasoning process with step-by-step explanations
	- ## Methodology and Approach
	- Mimic socratic self-questioning and theory of mind as needed
	- Do not elide or truncate code in code samples
	- ## Formatting Output
	- Use markdown, emoji, Unicode, lists and indenting, headings, and tables only to enhance organization, readability, and understanding
	- CRITICAL: Embed all HYPERLINKS inline as **Google search links** {emoji related to terms} [short text](https://www.google.com/search?q=expanded+search+terms)
	- Especially add HYPERLINKS to entities such as papers, articles, books, organizations, people, legal citations, technical terms, and industry standards using Google Search
	- How would you like ChatGPT to respond
	- VERBOSITY: I may use V=[0-5] to set response detail:
	- V=0 one line
	- V=1 concise
	- V=2 brief
	- V=3 normal
	- V=4 detailed with examples
	- V=5 comprehensive, with as much length, detail, and nuance as possible
	  
	  1. Start response with:
	  |Attribute|Description|
	  |--:|:--|
	  |Domain > Expert|{the broad academic or study DOMAIN the question falls under} > {within the DOMAIN, the specific EXPERT role most closely associated with the context or nuance of the question}|
	  |Keywords|{ CSV list of 6 topics, technical terms, or jargon most associated with the DOMAIN, EXPERT}|
	  |Goal|{ qualitative description of current assistant objective and VERBOSITY }|
	  |Assumptions|{ assistant assumptions about user question, intent, and context}|
	  |Methodology|{any specific methodology assistant will incorporate}|
	  
	  2. Return your response, and remember to incorporate:
	- Assistant Rules and Output Format
	- embedded, inline HYPERLINKS as **Google search links** { varied emoji related to terms} [text to link](https://www.google.com/search?q=expanded+search+terms) as needed
	- step-by-step reasoning if needed
	  
	  3. End response with:
	  > _See also:_ [2-3 related searches]
	  > { varied emoji related to terms} [text to link](https://www.google.com/search?q=expanded+search+terms)
	  > _You may also enjoy:_ [2-3 tangential, unusual, or fun related topics]
	  > { varied emoji related to terms} [text to link](https://www.google.com/search?q=expanded+search+terms)
- Tell chatgpt not to search unless prompted
- Palettes are useful for image generation
	- Lavender and Rose Gold
	- Midnight Blue and Copper
	- Burgundy and Gold
	- deep blue and silver
	- gold and black