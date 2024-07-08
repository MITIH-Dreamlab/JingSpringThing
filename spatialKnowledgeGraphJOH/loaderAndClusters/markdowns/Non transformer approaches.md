public:: true

	- # Mamba: Linear-Time Sequence Modelling with Selective State Spaces
		- [Mamba: Linear-Time Sequence Modeling with Selective State Spaces](https://arxiv.org/pdf/2312.00752.pdf)
		- **Research Design & Rationale**: The study introduces a new architecture, Mamba, which incorporates a selection mechanism and hardware-aware computation into structured state space models.
		- **Significance**: Addresses the inefficiency of Transformer models with a novel architecture that scales linearly and achieves superior performance.
		- **Real-world Implications**: Potential to improve a wide range of applications in natural language processing, bioinformatics, and other areas where sequence data is prevalent.
		- **Takeaways**: Mamba architecture improves upon structured state space models (SSMs) by adding selectivity and hardware-aware algorithms, achieving linear-time modeling with high-quality performance across several modalities.
		- **Practical Implications**: Provides a more efficient alternative to Transformers, especially beneficial for long sequence data.
		- **Potential Impact**: Could influence future developments in sequence modeling and foundational models across various domains.
		- **Abstract in a nutshell**: Mamba is a novel architecture for sequence modeling that enhances structured state space models (SSMs) with selective mechanisms and hardware-aware algorithms, achieving superior performance and efficiency.
		- **Gap/Need**: Traditional Transformer models have significant computational inefficiency, especially for long sequences. Mamba addresses this by incorporating a selection mechanism and hardware-aware computation in SSMs.
		- **Innovation**: Introduces a selection mechanism in SSMs, allowing input-dependent parameterization and a simplified architecture without attention or MLP blocks, enabling linear-time computation with maintained or enhanced performance.
		- ### Key Quotes
		- "Mamba enjoys fast inference (5× higher throughput than Transformers) and linear scaling in sequence length and its performance improves on real data up to million-length sequences."
		- **"This class of models can be computed very efficiently as either a recurrence or convolution with linear or near-linear scaling in sequence length."**
		- "Selective SSMs and by extension the Mamba architecture are fully recurrent models with key properties that make them suitable as the backbone of general foundation models operating on sequences."
		- **How does Mamba achieve linear-time modeling?**: By introducing a selection mechanism in structured state space models and designing a hardware-aware algorithm that avoids materializing expanded states, thereby enhancing computational efficiency.
		- **What improvements does Mamba offer over traditional models?**: It achieves faster inference, linear scaling with sequence length, and competitive or superior performance across various data modalities including language, audio, and genomics.
		- **Can Mamba handle long sequences efficiently?**: Yes, it is specifically designed to address the computational inefficiencies of traditional models like Transformers in handling long sequences, offering linear scaling and improved performance.
		- Mamba outperforms Transformers of the same size in language modelling and matches Transformers twice its size both in pretraining and downstream evaluation, demonstrating its efficiency and effectiveness.
		- **Authors' Views**: The authors propose Mamba as a significant step forward in sequence modeling, addressing the inefficiency of Transformers while maintaining or improving performance.
		- **Comparative Analysis**: Mamba is positioned as superior to existing models, particularly Transformers, in terms of efficiency and scalability
- ## Quick lit survey.  (based on [Mamba-Palooza](https://www.youtube.com/watch?v=Bg1LQ_jWliU))
	- Over 30 new papers and projects since original Mamba paper, with new ones coming out every 1-2 days
	- 60% of papers address vision/image processing, 25% natural language, and the rest cover various applications
	- 80% of papers modified the original Mamba architecture in some way
	- 73% of papers reported state-of-the-art results (though not independently verified yet)
	- Handling of state in Mamba architecture is not always clear in papers, more research needed
	- Swapping out selective state space portion of Mamba in MoE architectures could be an interesting avenue to explore
	- Infrastructure and capital advantages for big tech incumbents in deploying large-scale MoE models
	- ## Mamba Learning Theory and Interpretability
		- ### In-Context Learning (Is Mamba Capable of In-Context Learning?)
			- Mamba can do in-context learning, gradually optimizing internal representations through layers
			- Similar pattern to Transformers: elevation of concepts and more accurate activations through layers, then collapse at final prediction
		- ### Learning Rules from Sequences (Othello Mamba)
			- Mamba learns rules of Othello from just a sequence of moves, achieving higher board accuracy than OthelloGPT
			- More data efficient, but becomes less accurate as game progresses and requires longer training than same-sized Transformer
		- ### Strengths and Weaknesses (Can Mamba Learn How to Learn?)
			- Mamba outperforms Transformers on tasks with irrelevance and noise
			- Mamba struggles with high-precision memory recall compared to Transformers
			- Hybrid MambaFormer model outperforms both Transformer and Mamba on various evaluation tasks
	- ## Mixture of Experts (MoE) Architectures
		- Major force driving frontier models (e.g., GPT-4, Gemini 1.5)
		- MoE-Mamba (MoE-Mamba) achieved same loss as original Mamba with 2.2x less training steps, scaling up to 32 experts
		- BlackMamba scaled up to 2.8B parameters and 8 experts, with generation latency well below Transformer, Transformer MoE, and Mamba
	- # Vision Mamba
		- Majority of Mamba papers (over 60%) address vision/image processing, especially biomedical image segmentation
		- Key themes:
			- Representing data as sequences is crucial
			- Images are not inherently sequential like language, music, or DNA
			- Multi-scan approaches enable handling non-sequential data
			- Hybrid architectures leverage strengths of different models
		- Open questions and challenges:
			- Scaling to larger models and datasets
			- Developing state regularization methods
			- Integrating Mamba with other architectural advances (e.g., memory tokens)
		- Potential for transformative impact, especially in biology and vision applications
		- Approaches:
			- U-Mamba (U-Mamba): Hybrid CNN-SSM architecture outperforming CNN and Transformers in biomedical image segmentation
			- Swin-UMamba (Swin-UMamba): Combines Mamba with ImageNet pre-training, outperforms U-Mamba
			- Vision Mamba: Bidirectional (forward and backward) scanning for learning visual representations
			- VMamba: Four-way "cross-scan" starting at each corner, combining representations
			- VM-UNet (VM-UNet): Applies VMamba's four-way scan to medical image segmentation
			- Mamba-ND: Multi-dimensional sequencing for video and weather data, using sequential SSMs
			- SegMamba: 3D image segmentation with three-way scan, handling long sequences
			- Vivim: Three-way scan for video
			- MambaMorph: Aligns two input images by generating deformation field
		- Key insights:
			- Turning images into sequences is crucial, can be done through multi-scan approaches
			- Combining scans sequentially may be more effective than parallel
			- Mamba enables memory-efficient processing of high-resolution images, promising for edge applications (e.g., robotics)
	- # Mixture of Experts (MoE) Architectures
		- Major force in frontier models (GPT-4, Gemini 1.5)
		- MoE-Mamba and BlackMamba demonstrate MoE's effectiveness with Mamba
		- Open questions around scaling and infrastructure requirements for large-scale MoE-Mamba models
		- [Introducing Jamba: AI21's Groundbreaking SSM-Transformer Model](https://www.ai21.com/blog/announcing-jamba)
	- # Long Context Modeling
		- LongMamba (LongMamba): Generalizes to 40k tokens after training on 16k, nearly perfect on "needle in a haystack" task
		- Evo: Models long DNA sequences, learning a "cell model" analogous to language models' "world model"
		- Potential challenges:
			- Eventual "rotting" of internal states with extreme context lengths
			- Need for state regularization or "pruning" to maintain performance
		- Implications for biology: Foundation models could revolutionize drug discovery and biological research
	- # Potential Applications
		- ## Climate Science?
			- To approach the problem of using Mamba to analyze space-acquired time series image-based climate data from multi-spectrum sensors, we can draw upon several techniques and architectures discussed in the Mamba literature. Here's a proposed approach:
				- Data Preprocessing:
					- Combine multi-spectrum sensor data:
						- Use techniques like MambaMorph to align and merge data from different sensors
						- Generate deformation fields to spatially align images from various sources
				- Normalize data to ensure consistent scales and ranges across sensors
					- Temporal alignment:
						- Use techniques like dynamic time warping (DTW) to align time series data temporally
						- Handle missing data points and inconsistent sampling frequencies
				- Create a unified temporal grid for all data sources
					- Incorporate historical data:
						- Preprocess and align historical records (e.g., weather station data, satellite imagery) with the space-acquired data
						- Use techniques like transfer learning or domain adaptation to handle differences in data modalities and distributions
				- Mamba Architecture:
					- Multi-dimensional sequencing (Mamba-ND):
						- Treat the aligned and preprocessed data as a multi-dimensional sequence (e.g., spatial dimensions, time, and spectral channels)
						- Apply Mamba-ND to capture dependencies across all dimensions
					- Cross-scanning (VMamba or SegMamba):
						- Perform multi-directional scans (e.g., four-way or three-way) to capture spatial dependencies
						- Combine the representations from different scans to obtain a comprehensive understanding of the data
					- Hybrid architectures (U-Mamba or Swin-UMamba):
						- Incorporate convolutional layers (CNN) for local feature extraction
						- Use Mamba layers for capturing long-range dependencies and global context
			- Leverage pre-training on large-scale datasets (e.g., ImageNet) to improve performance
			  high-level diagram of the proposed approach using Mermaid:
			- ```mermaid
			  graph TD
			      A[Multi-spectrum Sensor Data] --> B{Data Preprocessing}
			      C[Historical Data] --> B
			      
			      subgraph Data Preprocessing
			          B --> D[Combine Multi-spectrum Data]
			          B --> E[Temporal Alignment]
			          B --> F[Incorporate Historical Data]
			          
			          D --> G[MambaMorph for Alignment]
			          D --> H[Generate Deformation Fields]
			          D --> I[Normalize Data]
			          
			          E --> J[Dynamic Time Warping]
			          E --> K[Handle Missing Data]
			          E --> L[Create Unified Temporal Grid]
			          
			          F --> M[Align Historical Records]
			          F --> N[Transfer Learning/Domain Adaptation]
			      end
			      
			      B --> O{Mamba Architecture}
			      
			      subgraph Mamba Architecture
			          O --> P[Multi-dimensional Sequencing]
			          O --> Q[Cross-scanning]
			          O --> R[Hybrid Architectures]
			          
			          P --> S[Mamba-ND]
			          P --> T[Capture Dependencies Across Dimensions]
			          
			          Q --> U[VMamba/SegMamba]
			          Q --> V[Multi-directional Scans]
			          Q --> W[Combine Scan Representations]
			          
			          R --> X[U-Mamba/Swin-UMamba]
			          R --> Y[Convolutional Layers for Local Features]
			          R --> Z[Mamba Layers for Long-range Dependencies]
			          R --> AA[Pre-training on Large-scale Datasets]
			      end
			      
			      O --> AB[Comprehensive Data Representation]
			      AB --> AC[Predictive Component]
			      AB --> AD[Up-to-date Data vs. Historical Context]
			      
			      subgraph Additional Considerations
			          AE[Handle Data Quality Issues]
			          AF[Incorporate Domain Knowledge]
			          AG[Leverage Transfer Learning]
			          AH[Evaluate Model Performance]
			          AI[Interpret and Visualize Representations]
			      end
			      
			      AC --> AJ{Output Formats}
			      AJ --> AK[Short-term Forecasts]
			      AJ --> AL[Long-term Projections]
			      
			      AE --> AB
			      AF --> AB
			      AG --> AB
			      AH --> AB
			      AI --> AB
			  ```
			- ## Things to do
				- TODO What is the spatial and temporal resolution of the space-acquired data?
				- TODO How far back does the historical data go, and at what resolution?
				- TODO Are there any specific climate variables or phenomena of interest (e.g., temperature, precipitation, extreme events)?
				- TODO What is the desired output format for the predictive component (e.g., short-term forecasts, long-term projections)?
				- TODO Handling data quality issues (e.g., cloud cover, sensor noise)
				- TODO Incorporating domain knowledge (e.g., physical constraints, climate models)
				- TODO Leveraging transfer learning from pre-trained models on similar datasets
				- TODO Evaluating the model's performance using appropriate metrics and validation techniques
				- TODO Interpreting and visualizing the learned representations for stakeholder communication
		- ## Ontological Layer for Metaverse
			- To approach the problem of using Mamba to analyze formal ontological graphs as used by the W3C, we can draw upon several techniques and architectures discussed in the Mamba literature. Here's a proposed approach:
			- Data Preprocessing:
				- Graph Normalization:
					- Ensure consistent formatting and structure of the ontological graphs
					- Handle missing or inconsistent data
					- Normalize node and edge labels
				- Graph Merging:
					- Combine multiple ontological graphs into a single unified graph
					- Resolve conflicts and inconsistencies between different ontologies
					- Establish mappings between equivalent concepts across ontologies
				- Graph Embedding:
					- Generate low-dimensional vector representations of nodes and edges
					- Preserve the semantic relationships and structure of the ontological graphs
					- Use techniques like RDF2Vec, TransE, or Graph Convolutional Networks (GCNs)
			- Mamba Architecture:
				- Graph-Mamba:
					- Adapt the Mamba architecture to handle graph-structured data
					- Utilize the selective state space mechanism to capture long-range dependencies in the ontological graphs
					- Achieve efficient memory usage and reduced computational complexity compared to traditional graph neural networks (GNNs)
				- Multi-dimensional Sequencing (Mamba-ND):
					- Treat the ontological graphs as multi-dimensional sequences (e.g., node features, edge types, and graph structure)
					- Apply Mamba-ND to capture dependencies across all dimensions
			- Hybrid Architectures:
				- Combine Graph-Mamba with other graph neural network architectures (e.g., GCNs, GraphSAGE)
				- Leverage the strengths of both approaches to capture local and global patterns in the ontological graphs
				-
				-
			- ```mermaid
			  graph TD
			   A[Ontological Graphs] --> B(Data Preprocessing)
			   B --> C{Mamba Architecture}
			   C --> D[Graph-Mamba]
			   C --> E[Multi-dimensional Sequencing Mamba-ND]
			   C --> F[Hybrid Architectures]
			   D --> G[Comprehensive Graph Representation]
			   E --> G
			   F --> G
			   G --> H[Ontology Alignment]
			   G --> I[Knowledge Graph Completion]
			   G --> J[Semantic Similarity]
			   ```
				-
				- TODO What are the specific ontologies being used (e.g., RDF, OWL)?
				- TODO Are there any domain-specific requirements or constraints to consider?
				- TODO What are the desired output tasks (e.g., ontology alignment, knowledge graph completion, semantic similarity)?
				- TODO How large and complex are the ontological graphs being analyzed?
				- TODO Handling scalability issues for large-scale ontological graphs
				- TODO Incorporating domain knowledge and ontology-specific constraints
				- TODO Leveraging transfer learning from pre-trained models on similar ontological graphs
				- TODO Evaluating the model's performance using appropriate graph-based metrics and validation techniques
				- TODO Interpreting and visualizing the learned graph representations for ontology engineers and domain experts
- ## Implementations
	- https://www.statespace.info/  Lots of tracked projects here. This is the best place.
	- Can use the https://huggingface.co/docs/accelerate/usage_guides/fsdp for sharded training
	- [[2401.04081] MoE-Mamba: Efficient Selective State Space Models with Mixture of Experts (arxiv.org)](https://arxiv.org/abs/2401.04081)
	- [havenhq/mamba-chat: Mamba-Chat: A chat LLM based on the state-space model architecture 🐍 (github.com)](https://github.com/havenhq/mamba-chat)
	- [[2401.13660] MambaByte: Token-free Selective State Space Model (arxiv.org)](https://arxiv.org/abs/2401.13660) doesn't need tokens!!
-