# will-it-run

Tell us your PC. We tell you which free local AI to run, and what to buy.

Enter your operating system, memory, graphics memory and goal. The page shows, for 12 widely used open models, whether each one runs well, runs slowly or will not run. It names the app to use, the file size to expect, and the hardware tier you would need. Nothing is uploaded. It works offline, from `docs/index.html`.

Open `docs/index.html` in a browser. No install, no build step for users.

## How the verdict works

The check is memory needed against memory available, with a stated margin.

1. Memory needed is an estimate: `file size * 1.15 + 1 GB`. The file size comes from the source page for that model. The extra covers the context cache and the runtime.
2. Memory available depends on your machine:

| Machine | Fast memory | Slow memory |
|---|---|---|
| PC with a graphics card | Graphics memory (VRAM) | RAM minus 4 GB for the system |
| Apple chip (unified memory) | 75 percent of memory | Memory minus 4 GB |
| No graphics card | None | RAM minus 4 GB |

3. Only 90 percent of a pool counts. This is the margin.
4. Verdicts:
   - **Runs well**: needed memory fits in fast memory with the margin. With no graphics card, only models needing 4 GB or less count as runs well.
   - **Runs slowly**: it fits only if part of the model sits in slower memory (system memory, or the processor does the work).
   - **Will not run**: it does not fit even then. Image models also will not run with no graphics card and no Apple chip.
5. Hardware tiers are our own grouping by memory. The "what to buy" table shows which models each tier first runs well. It lists no products and no prices, because prices move.

The 75 percent share for Apple chips is a community figure, not an Apple number: the mlx-lm issue at https://github.com/ml-explore/mlx-lm/issues/883 describes the GPU wiring about 75 percent of memory by default (read 10 Nov 2026). It varies by machine and macOS version.

The 4 GB system reserve, the 90 percent margin, the 1.15 factor and the 1 GB extra are our own choices. They are estimates and are labelled as estimates in the data.

## The models

Chosen on 10 Nov 2026 from the most pulled open models on the Ollama library (https://ollama.com/library?sort=popular, read 10 Nov 2026), plus one image model added by hand so the images goal has an answer. Sizes are file sizes from each source page, read 10 Nov 2026. Every row in `data/models.json` has a source URL and a read date, and `tools/validate.py` fails any row that lacks them.

| Model | File size | Quantisation | Licence | Source |
|---|---|---|---|---|
| Llama 3.2 3B | 2.0 GB | Q4_K_M (inferred) | Llama 3.2 Community License | https://ollama.com/library/llama3.2/tags |
| Gemma 3 4B | 3.4 GB | Q4_K_M (inferred) | Gemma Terms of Use | https://ollama.com/library/gemma3/tags |
| Mistral 7B | 4.4 GB | Q4_K_M (inferred) | Apache license | https://ollama.com/library/mistral/tags |
| Qwen2.5 Coder 7B | 4.7 GB | Q4_K_M (inferred) | Apache 2.0 | https://ollama.com/library/qwen2.5-coder/tags |
| Llama 3.1 8B | 4.9 GB | Q4_K_M (inferred) | Llama 3.1 Community License | https://ollama.com/library/llama3.1/tags |
| Qwen3 8B | 5.2 GB | Q4_K_M (inferred) | Apache 2.0 | https://ollama.com/library/qwen3/tags |
| Gemma 3 12B | 8.2 GB | Q4_K_M (inferred) | Gemma Terms of Use | https://ollama.com/library/gemma3/tags |
| DeepSeek R1 14B (distilled) | 9.0 GB | Q4_K_M (inferred) | MIT (weights), derived from a Qwen model | https://ollama.com/library/deepseek-r1/tags |
| gpt-oss 20B | 14 GB | not stated | Apache 2.0 | https://ollama.com/library/gpt-oss/tags |
| Qwen3 32B | 20 GB | Q4_K_M (inferred) | Apache 2.0 | https://ollama.com/library/qwen3/tags |
| Llama 3.1 70B | 43 GB | Q4_K_M (inferred) | Llama 3.1 Community License | https://ollama.com/library/llama3.1/tags |
| Stable Diffusion XL 1.0 base | 6.94 GB | full weights | CreativeML Open RAIL++-M | https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/tree/main |

"Inferred" means the source page does not state the quantisation for that tag, but the tag shares its digest with a tag named q4_K_M. Licences for the Llama and Qwen rows were read on model cards of the same family (see `licence_source_url` in the data). Check the licence before commercial use.

Apps: Ollama (Windows, macOS, Linux, https://ollama.com/download) for the text models, and ComfyUI (Windows and macOS desktop, https://github.com/comfyanonymous/ComfyUI) for the image model. LM Studio (https://lmstudio.ai/docs/app/system-requirements) is another local app. This tool has not checked which of these models it lists, so check its catalog.

## Limits

- Every memory figure is an estimate, not a measurement.
- Speed classes are rough. This is not a benchmark and gives no tokens per second.
- Models, file sizes and apps change often. Each row shows the date it was read. The list is narrow on purpose.
- Longer context needs more memory than the estimate assumes.
- Browsers hide most hardware details, so you type the numbers. The page can fill in the operating system, and a rough memory figure on some browsers.
- Model and app names are used as facts with sources. They are not endorsements, and no affiliation is implied.
- No prices and no products. Hardware tiers only.

## Found a wrong number?

Open an issue with the model, the number you expected, and a link to a page that shows it. Corrections with a source get merged. Edit `data/models.json`, keep the source URL and the read date, then run the checks below.

## For contributors

```
python tools/validate.py
python tools/build_site.py
python -m unittest discover -s tests
node --test tests/engine.test.js tests/card.test.js
python tools/check_release.py
```

Plain browser JavaScript and the Python standard library. No dependencies. See CONTRIBUTING.md.

## Licence

MIT. See LICENSE.
